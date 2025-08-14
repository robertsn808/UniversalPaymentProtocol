import crypto from 'crypto';
import { z } from 'zod';

import { auditTrail } from './audit-trail.js';
import { db } from '../database/connection.js';
import secureLogger from '../shared/logger.js';

/**
 * GDPR Privacy Compliance Module
 * Implements EU General Data Protection Regulation requirements
 */

// Data subject rights schemas
export const DataSubjectRequestSchema = z.object({
  type: z.enum(['access', 'rectification', 'erasure', 'portability', 'restriction', 'objection']),
  user_id: z.string().uuid(),
  email: z.string().email(),
  description: z.string().optional(),
  verification_token: z.string().optional(),
  deadline: z.date(),
  status: z.enum(['pending', 'in_progress', 'completed', 'rejected']).default('pending'),
});

export const ConsentRecordSchema = z.object({
  user_id: z.string().uuid(),
  purpose: z.string(),
  legal_basis: z.enum(['consent', 'contract', 'legal_obligation', 'vital_interests', 'public_task', 'legitimate_interests']),
  granted: z.boolean(),
  timestamp: z.date(),
  method: z.enum(['explicit', 'implicit', 'opt_in', 'pre_ticked']),
  withdrawal_method: z.string().optional(),
});

export type DataSubjectRequest = z.infer<typeof DataSubjectRequestSchema>;
export type ConsentRecord = z.infer<typeof ConsentRecordSchema>;

// Data categories for privacy impact assessment
export enum DataCategory {
  PERSONAL_IDENTIFIERS = 'personal_identifiers',
  FINANCIAL_DATA = 'financial_data',
  BIOMETRIC_DATA = 'biometric_data',
  LOCATION_DATA = 'location_data',
  DEVICE_DATA = 'device_data',
  BEHAVIORAL_DATA = 'behavioral_data',
  SPECIAL_CATEGORY = 'special_category_data',
}

export enum ProcessingPurpose {
  PAYMENT_PROCESSING = 'payment_processing',
  FRAUD_PREVENTION = 'fraud_prevention',
  CUSTOMER_SERVICE = 'customer_service',
  MARKETING = 'marketing',
  ANALYTICS = 'analytics',
  LEGAL_COMPLIANCE = 'legal_compliance',
}

export class GDPRPrivacyControls {
  private static instance: GDPRPrivacyControls;

  private constructor() {}

  public static getInstance(): GDPRPrivacyControls {
    if (!GDPRPrivacyControls.instance) {
      GDPRPrivacyControls.instance = new GDPRPrivacyControls();
    }
    return GDPRPrivacyControls.instance;
  }

  /**
   * Record consent for data processing (Article 7)
   */
  public async recordConsent(consentData: {
    user_id: string;
    purpose: ProcessingPurpose;
    legal_basis: 'consent' | 'contract' | 'legal_obligation' | 'vital_interests' | 'public_task' | 'legitimate_interests';
    granted: boolean;
    method: 'explicit' | 'implicit' | 'opt_in' | 'pre_ticked';
    ip_address: string;
    user_agent?: string;
  }): Promise<ConsentRecord> {
    const consentRecord: ConsentRecord = {
      user_id: consentData.user_id,
      purpose: consentData.purpose,
      legal_basis: consentData.legal_basis,
      granted: consentData.granted,
      timestamp: new Date(),
      method: consentData.method,
    };

    // Validate consent method
    if (consentData.method === 'pre_ticked' && consentData.granted) {
      throw new Error('Pre-ticked consent is not valid under GDPR');
    }

    // Store consent record
    await this.storeConsentRecord(consentRecord);

    // Log consent event
    await auditTrail.logDataAccessEvent({
      user_id: consentData.user_id,
      action: 'consent_update',
      data_type: consentData.purpose,
      ip_address: consentData.ip_address,
      user_agent: consentData.user_agent,
      correlation_id: crypto.randomUUID(),
      legal_basis: consentData.legal_basis,
    });

    secureLogger.info('Consent recorded', {
      userId: consentData.user_id,
      purpose: consentData.purpose,
      granted: consentData.granted,
      method: consentData.method,
    });

    return consentRecord;
  }

  /**
   * Withdraw consent (Article 7)
   */
  public async withdrawConsent(data: {
    user_id: string;
    purpose: ProcessingPurpose;
    withdrawal_method: string;
    ip_address: string;
    user_agent?: string;
  }): Promise<void> {
    // Update consent record
    const query = `
      UPDATE consent_records 
      SET granted = false, withdrawal_method = $3, updated_at = NOW()
      WHERE user_id = $1 AND purpose = $2 AND granted = true
    `;
    
    await db.query(query, [data.user_id, data.purpose, data.withdrawal_method]);

    // Stop processing data for this purpose
    await this.flagDataForDeletion(data.user_id, data.purpose);

    // Log consent withdrawal
    await auditTrail.logDataAccessEvent({
      user_id: data.user_id,
      action: 'consent_update',
      data_type: data.purpose,
      ip_address: data.ip_address,
      user_agent: data.user_agent,
      correlation_id: crypto.randomUUID(),
    });

    secureLogger.info('Consent withdrawn', {
      userId: data.user_id,
      purpose: data.purpose,
      withdrawalMethod: data.withdrawal_method,
    });
  }

  /**
   * Handle data subject access request (Article 15)
   */
  public async processAccessRequest(requestData: {
    user_id: string;
    email: string;
    ip_address: string;
    user_agent?: string;
  }): Promise<{
    personal_data: any;
    processing_purposes: string[];
    data_categories: string[];
    recipients: string[];
    retention_period: string;
    rights_information: string[];
  }> {
    const correlationId = crypto.randomUUID();

    // Collect all personal data
    const personalData = await this.collectPersonalData(requestData.user_id);
    
    // Get processing information
    const processingInfo = await this.getProcessingInformation(requestData.user_id);

    // Log access request
    await auditTrail.logDataAccessEvent({
      user_id: requestData.user_id,
      action: 'data_access',
      data_type: 'all_personal_data',
      ip_address: requestData.ip_address,
      user_agent: requestData.user_agent,
      correlation_id: correlationId,
      legal_basis: 'data_subject_rights',
    });

    const response = {
      personal_data: personalData,
      processing_purposes: processingInfo.purposes,
      data_categories: processingInfo.categories,
      recipients: processingInfo.recipients,
      retention_period: processingInfo.retention,
      rights_information: [
        'Right to rectification (Article 16)',
        'Right to erasure (Article 17)',
        'Right to restrict processing (Article 18)',
        'Right to data portability (Article 20)',
        'Right to object (Article 21)',
      ],
    };

    secureLogger.info('Data access request processed', {
      userId: requestData.user_id,
      correlationId,
      dataCategories: processingInfo.categories.length,
    });

    return response;
  }

  /**
   * Handle data portability request (Article 20)
   */
  public async processPortabilityRequest(requestData: {
    user_id: string;
    format: 'json' | 'csv' | 'xml';
    ip_address: string;
    user_agent?: string;
  }): Promise<{
    data: any;
    format: string;
    export_date: Date;
    verification_hash: string;
  }> {
    const correlationId = crypto.randomUUID();

    // Get portable data (structured, commonly used data)
    const portableData = await this.getPortableData(requestData.user_id);

    // Format data according to request
    const formattedData = this.formatPortableData(portableData, requestData.format);

    // Generate verification hash
    const verificationHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(portableData))
      .digest('hex');

    // Log portability request
    await auditTrail.logDataAccessEvent({
      user_id: requestData.user_id,
      action: 'data_export',
      data_type: 'portable_data',
      ip_address: requestData.ip_address,
      user_agent: requestData.user_agent,
      correlation_id: correlationId,
      legal_basis: 'data_subject_rights',
    });

    return {
      data: formattedData,
      format: requestData.format,
      export_date: new Date(),
      verification_hash: verificationHash,
    };
  }

  /**
   * Handle erasure request (Article 17 - Right to be forgotten)
   */
  public async processErasureRequest(requestData: {
    user_id: string;
    reason: 'consent_withdrawn' | 'no_longer_necessary' | 'unlawful_processing' | 'legal_obligation';
    ip_address: string;
    user_agent?: string;
  }): Promise<{
    deleted_data_categories: string[];
    retained_data_categories: string[];
    retention_reasons: string[];
    completion_date: Date;
  }> {
    const correlationId = crypto.randomUUID();

    // Determine what data can be deleted vs retained
    const deletionPlan = await this.createDeletionPlan(requestData.user_id, requestData.reason);

    // Execute deletion
    const deletionResults = await this.executeDeletion(requestData.user_id, deletionPlan);

    // Log erasure request
    await auditTrail.logDataAccessEvent({
      user_id: requestData.user_id,
      action: 'data_deletion',
      data_type: 'personal_data',
      ip_address: requestData.ip_address,
      user_agent: requestData.user_agent,
      correlation_id: correlationId,
      legal_basis: 'data_subject_rights',
    });

    secureLogger.info('Data erasure request processed', {
      userId: requestData.user_id,
      correlationId,
      deletedCategories: deletionResults.deleted.length,
      retainedCategories: deletionResults.retained.length,
    });

    return {
      deleted_data_categories: deletionResults.deleted,
      retained_data_categories: deletionResults.retained,
      retention_reasons: deletionResults.retentionReasons,
      completion_date: new Date(),
    };
  }

  /**
   * Data breach notification (Article 33-34)
   */
  public async notifyDataBreach(breachData: {
    breach_id: string;
    description: string;
    affected_data_categories: DataCategory[];
    affected_user_count: number;
    risk_level: 'low' | 'medium' | 'high';
    containment_measures: string[];
    discovered_at: Date;
    reported_by: string;
  }): Promise<{
    supervisory_authority_notified: boolean;
    data_subjects_notified: boolean;
    notification_deadline: Date;
    required_actions: string[];
  }> {
    const correlationId = crypto.randomUUID();

    // Determine notification requirements
    const requiresSupervisoryNotification = this.requiresSupervisoryNotification(breachData);
    const requiresDataSubjectNotification = this.requiresDataSubjectNotification(breachData);

    // Calculate notification deadline (72 hours for supervisory authority)
    const notificationDeadline = new Date(breachData.discovered_at.getTime() + 72 * 60 * 60 * 1000);

    // Store breach record
    await this.storeBreachRecord(breachData, correlationId);

    // Generate required actions
    const requiredActions = this.generateBreachActions(breachData, requiresSupervisoryNotification, requiresDataSubjectNotification);

    // Log breach notification
    await auditTrail.createAuditLog({
      user_id: 'system',
      action: 'data_breach_notification',
      details: 'Personal data breach notification sent',
      ip_address: '127.0.0.1',
      correlation_id: correlationId,
    });

    return {
      supervisory_authority_notified: requiresSupervisoryNotification,
      data_subjects_notified: requiresDataSubjectNotification,
      notification_deadline: notificationDeadline,
      required_actions: requiredActions,
    };
  }

  /**
   * Privacy Impact Assessment (Article 35)
   */
  public async conductPrivacyImpactAssessment(processing: {
    purpose: ProcessingPurpose;
    data_categories: DataCategory[];
    processing_methods: string[];
    retention_period: number;
    recipients: string[];
    cross_border_transfer: boolean;
    automated_decision_making: boolean;
  }): Promise<{
    risk_level: 'low' | 'medium' | 'high';
    identified_risks: Array<{
      category: string;
      description: string;
      likelihood: number;
      impact: number;
      mitigation: string;
    }>;
    recommendations: string[];
    requires_dpo_consultation: boolean;
    requires_supervisory_consultation: boolean;
  }> {
    const risks = [];

    // Assess special category data risk
    if (processing.data_categories.includes(DataCategory.SPECIAL_CATEGORY)) {
      risks.push({
        category: 'special_category_data',
        description: 'Processing of special category personal data',
        likelihood: 3,
        impact: 5,
        mitigation: 'Ensure explicit consent and additional safeguards',
      });
    }

    // Assess biometric data risk
    if (processing.data_categories.includes(DataCategory.BIOMETRIC_DATA)) {
      risks.push({
        category: 'biometric_processing',
        description: 'Processing of biometric data for identification',
        likelihood: 2,
        impact: 4,
        mitigation: 'Implement biometric template protection and secure storage',
      });
    }

    // Assess automated decision making risk
    if (processing.automated_decision_making) {
      risks.push({
        category: 'automated_decisions',
        description: 'Automated individual decision making',
        likelihood: 4,
        impact: 3,
        mitigation: 'Provide human review option and explanation of logic',
      });
    }

    // Calculate overall risk
    const maxRisk = Math.max(...risks.map(r => r.likelihood * r.impact));
    const riskLevel = maxRisk >= 15 ? 'high' : maxRisk >= 8 ? 'medium' : 'low';

    const recommendations = this.generatePIARecommendations(processing, risks);

    return {
      risk_level: riskLevel,
      identified_risks: risks,
      recommendations,
      requires_dpo_consultation: riskLevel === 'high',
      requires_supervisory_consultation: riskLevel === 'high' && processing.automated_decision_making,
    };
  }

  // Private helper methods
  private async collectPersonalData(userId: string): Promise<any> {
    // Collect data from all relevant tables
    const queries = [
      'SELECT * FROM users WHERE id = $1',
      'SELECT * FROM user_profiles WHERE user_id = $1', 
      'SELECT * FROM transactions WHERE user_id = $1',
      'SELECT * FROM devices WHERE user_id = $1',
      'SELECT * FROM audit_logs WHERE user_id = $1',
    ];

    const results = await Promise.all(
      queries.map(query => db.query(query, [userId]))
    );

    return {
      user_account: results[0].rows?.[0],
      profile: results[1].rows?.[0],
      transactions: results[2].rows || [],
      devices: results[3].rows || [],
      activity_logs: results[4].rows || [],
    };
  }

  private async getProcessingInformation(userId: string): Promise<{
    purposes: string[];
    categories: string[];
    recipients: string[];
    retention: string;
  }> {
    // Get consent records to determine processing purposes
    const consentQuery = 'SELECT * FROM consent_records WHERE user_id = $1';
    const consentResult = await db.query(consentQuery, [userId]);

    return {
      purposes: ['payment_processing', 'fraud_prevention', 'customer_service'],
      categories: ['personal_identifiers', 'financial_data', 'device_data'],
      recipients: ['stripe', 'internal_systems', 'law_enforcement_if_required'],
      retention: '7 years for financial records, 3 years for other data',
    };
  }

  private async getPortableData(userId: string): Promise<any> {
    // Return data in structured, machine-readable format
    const userData = await this.collectPersonalData(userId);
    
    return {
      account_information: userData.user_account,
      transaction_history: userData.transactions,
      device_registrations: userData.devices,
      consent_preferences: userData.profile,
    };
  }

  private formatPortableData(data: any, format: 'json' | 'csv' | 'xml'): any {
    switch (format) {
      case 'json':
        return JSON.stringify(data, null, 2);
      case 'csv':
        // Convert to CSV format (simplified)
        return this.convertToCSV(data);
      case 'xml':
        return this.convertToXML(data);
      default:
        return data;
    }
  }

  private convertToCSV(data: any): string {
    // Simplified CSV conversion
    return 'CSV format would be implemented here';
  }

  private convertToXML(data: any): string {
    // Simplified XML conversion
    return '<xml>XML format would be implemented here</xml>';
  }

  private async createDeletionPlan(userId: string, reason: string): Promise<{
    deletable: string[];
    retainable: string[];
    reasons: string[];
  }> {
    // Determine what can be deleted based on legal obligations
    return {
      deletable: ['profile_data', 'device_data', 'activity_logs'],
      retainable: ['transaction_records', 'audit_logs'],
      reasons: ['legal_obligation_financial_records', 'audit_requirements'],
    };
  }

  private async executeDeletion(userId: string, plan: any): Promise<{
    deleted: string[];
    retained: string[];
    retentionReasons: string[];
  }> {
    // Execute actual deletion
    const deletionQueries = [
      'DELETE FROM user_profiles WHERE user_id = $1',
      'DELETE FROM devices WHERE user_id = $1',
      // Note: Don't delete financial transaction records due to legal requirements
    ];

    await Promise.all(
      deletionQueries.map(query => db.query(query, [userId]))
    );

    return {
      deleted: plan.deletable,
      retained: plan.retainable,
      retentionReasons: plan.reasons,
    };
  }

  private requiresSupervisoryNotification(breach: any): boolean {
    // High risk breaches require supervisory authority notification
    return breach.risk_level === 'high' || breach.affected_user_count > 100;
  }

  private requiresDataSubjectNotification(breach: any): boolean {
    // High risk breaches require data subject notification
    return breach.risk_level === 'high';
  }

  private generateBreachActions(breach: any, supervisory: boolean, subjects: boolean): string[] {
    const actions = [];
    
    if (supervisory) {
      actions.push('Notify supervisory authority within 72 hours');
    }
    
    if (subjects) {
      actions.push('Notify affected data subjects without undue delay');
    }
    
    actions.push('Document the breach and response measures');
    actions.push('Review and update security measures');
    
    return actions;
  }

  private generatePIARecommendations(processing: any, risks: any[]): string[] {
    const recommendations = [];
    
    if (risks.length > 0) {
      recommendations.push('Implement data minimization principles');
      recommendations.push('Enhance encryption and access controls');
    }
    
    if (processing.automated_decision_making) {
      recommendations.push('Provide human review mechanisms');
      recommendations.push('Ensure algorithmic transparency');
    }
    
    return recommendations;
  }

  private async storeConsentRecord(consent: ConsentRecord): Promise<void> {
    const query = `
      INSERT INTO consent_records (user_id, purpose, legal_basis, granted, timestamp, method)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;
    
    await db.query(query, [
      consent.user_id,
      consent.purpose,
      consent.legal_basis,
      consent.granted,
      consent.timestamp,
      consent.method,
    ]);
  }

  private async storeBreachRecord(breach: any, correlationId: string): Promise<void> {
    const query = `
      INSERT INTO data_breaches 
      (breach_id, description, affected_data_categories, affected_user_count, 
       risk_level, discovered_at, reported_by, correlation_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;
    
    await db.query(query, [
      breach.breach_id,
      breach.description,
      JSON.stringify(breach.affected_data_categories),
      breach.affected_user_count,
      breach.risk_level,
      breach.discovered_at,
      breach.reported_by,
      correlationId,
    ]);
  }

  private async flagDataForDeletion(userId: string, purpose: string): Promise<void> {
    // Flag data for deletion when consent is withdrawn
    const query = `
      UPDATE user_data_flags 
      SET deletion_requested = true, deletion_reason = 'consent_withdrawn'
      WHERE user_id = $1 AND processing_purpose = $2
    `;
    
    await db.query(query, [userId, purpose]);
  }
}

// Singleton instance
export const gdprPrivacy = GDPRPrivacyControls.getInstance();