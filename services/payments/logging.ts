// Universal Payment Protocol - PCI Compliant Audit Logging
// Comprehensive logging with PII masking and security event tracking

import { CloudWatchLogs } from 'aws-sdk';
import crypto from 'crypto';

export interface AuditLogEntry {
  timestamp: string;
  event_type: string;
  user_id?: string;
  session_id?: string;
  request_id: string;
  ip_address?: string;
  user_agent?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  success: boolean;
  processing_time_ms?: number;
  metadata?: Record<string, any>;
}

export interface PaymentAuditEntry extends AuditLogEntry {
  payment_id?: string;
  merchant_id?: string;
  amount?: number;
  currency?: string;
  device_type?: string;
  fraud_score?: number;
  refund_id?: string;
  reason?: string;
}

export interface SecurityEvent extends AuditLogEntry {
  threat_type?: string;
  block_reason?: string;
  fraud_indicators?: string[];
  risk_level?: 'low' | 'medium' | 'high' | 'critical';
}

export interface DataAccessEvent extends AuditLogEntry {
  resource: string;
  action: 'read' | 'write' | 'delete' | 'list';
  result_count?: number;
  filters?: Record<string, any>;
}

export class AuditLogger {
  private cloudWatchLogs: CloudWatchLogs;
  private logGroupName: string;
  private environment: string;

  constructor() {
    this.cloudWatchLogs = new CloudWatchLogs({
      region: process.env.AWS_REGION || 'us-west-2'
    });
    
    this.logGroupName = process.env.AUDIT_LOG_GROUP || '/aws/lambda/upp-audit-logs';
    this.environment = process.env.NODE_ENV || 'development';
  }

  /**
   * Log payment-related activities with PCI compliance
   */
  async logPaymentActivity(entry: PaymentAuditEntry): Promise<void> {
    const sanitizedEntry = this.sanitizePaymentEntry(entry);
    
    // Add standard audit fields
    const auditEntry: AuditLogEntry = {
      ...sanitizedEntry,
      timestamp: new Date().toISOString(),
      success: true,
      metadata: {
        ...sanitizedEntry.metadata,
        pci_compliant: true,
        data_classification: 'payment_data',
        retention_period_days: 2555, // PCI requirement: 7 years
        log_version: '1.0'
      }
    };

    await this.writeLog('payment_audit', auditEntry);

    // High-value transactions get additional logging
    if (sanitizedEntry.amount && sanitizedEntry.amount > 10000) {
      await this.logSecurityEvent({
        event_type: 'HIGH_VALUE_TRANSACTION',
        user_id: entry.user_id,
        payment_id: entry.payment_id,
        amount: entry.amount,
        currency: entry.currency,
        ip_address: entry.ip_address,
        request_id: entry.request_id,
        severity: 'medium',
        metadata: {
          automated_alert: true,
          requires_review: true
        }
      });
    }
  }

  /**
   * Log security events and potential threats
   */
  async logSecurityEvent(event: Partial<SecurityEvent>): Promise<void> {
    const securityEntry: SecurityEvent = {
      timestamp: new Date().toISOString(),
      event_type: event.event_type || 'SECURITY_EVENT',
      user_id: event.user_id,
      session_id: event.session_id,
      request_id: event.request_id || this.generateRequestId(),
      ip_address: event.ip_address ? this.hashIP(event.ip_address) : undefined,
      user_agent: event.user_agent ? this.hashUserAgent(event.user_agent) : undefined,
      severity: event.severity || 'medium',
      success: false,
      threat_type: event.threat_type,
      block_reason: event.block_reason,
      fraud_indicators: event.fraud_indicators,
      risk_level: event.risk_level,
      metadata: {
        ...event.metadata,
        data_classification: 'security_event',
        automated_response: true,
        investigation_required: event.severity === 'high' || event.severity === 'critical'
      }
    };

    await this.writeLog('security_audit', securityEntry);

    // Critical security events trigger immediate alerts
    if (event.severity === 'critical') {
      await this.triggerSecurityAlert(securityEntry);
    }
  }

  /**
   * Log data access activities for compliance
   */
  async logDataAccess(event: Partial<DataAccessEvent>): Promise<void> {
    const accessEntry: DataAccessEvent = {
      timestamp: new Date().toISOString(),
      event_type: event.event_type || 'DATA_ACCESS',
      user_id: event.user_id,
      session_id: event.session_id,
      request_id: event.request_id || this.generateRequestId(),
      ip_address: event.ip_address ? this.hashIP(event.ip_address) : undefined,
      severity: event.severity || 'low',
      success: true,
      resource: event.resource || 'unknown',
      action: event.action || 'read',
      result_count: event.result_count,
      filters: event.filters ? this.sanitizeFilters(event.filters) : undefined,
      metadata: {
        ...event.metadata,
        data_classification: 'data_access',
        compliance_tracking: true
      }
    };

    await this.writeLog('data_access_audit', accessEntry);
  }

  /**
   * Log system errors with context
   */
  async logError(error: {
    event_type: string;
    user_id?: string;
    error_message: string;
    error_stack?: string;
    request_id: string;
    ip_address?: string;
    url?: string;
    method?: string;
    payment_id?: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    metadata?: Record<string, any>;
  }): Promise<void> {
    const errorEntry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      event_type: error.event_type,
      user_id: error.user_id,
      request_id: error.request_id,
      ip_address: error.ip_address ? this.hashIP(error.ip_address) : undefined,
      severity: error.severity,
      success: false,
      metadata: {
        error_message: error.error_message,
        error_stack: this.sanitizeStackTrace(error.error_stack),
        url: error.url,
        method: error.method,
        payment_id: error.payment_id,
        data_classification: 'error_log',
        ...error.metadata
      }
    };

    await this.writeLog('error_audit', errorEntry);

    // High severity errors trigger alerts
    if (error.severity === 'high' || error.severity === 'critical') {
      await this.triggerErrorAlert(errorEntry);
    }
  }

  /**
   * Log user authentication events
   */
  async logAuthenticationEvent(event: {
    event_type: 'LOGIN_SUCCESS' | 'LOGIN_FAILED' | 'LOGOUT' | 'MFA_CHALLENGE' | 'MFA_SUCCESS' | 'MFA_FAILED';
    user_id?: string;
    email?: string;
    ip_address: string;
    user_agent: string;
    request_id: string;
    failure_reason?: string;
    mfa_method?: string;
    session_duration_ms?: number;
  }): Promise<void> {
    const authEntry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      event_type: event.event_type,
      user_id: event.user_id,
      request_id: event.request_id,
      ip_address: this.hashIP(event.ip_address),
      user_agent: this.hashUserAgent(event.user_agent),
      severity: event.event_type.includes('FAILED') ? 'medium' : 'low',
      success: !event.event_type.includes('FAILED'),
      metadata: {
        email_hash: event.email ? this.hashEmail(event.email) : undefined,
        failure_reason: event.failure_reason,
        mfa_method: event.mfa_method,
        session_duration_ms: event.session_duration_ms,
        data_classification: 'authentication_log'
      }
    };

    await this.writeLog('auth_audit', authEntry);
  }

  /**
   * Private helper methods
   */
  private sanitizePaymentEntry(entry: PaymentAuditEntry): PaymentAuditEntry {
    return {
      ...entry,
      // Never log sensitive payment data
      ip_address: entry.ip_address ? this.hashIP(entry.ip_address) : undefined,
      user_agent: entry.user_agent ? this.hashUserAgent(entry.user_agent) : undefined,
      metadata: {
        ...entry.metadata,
        // Remove any accidentally included sensitive data
        card_number: undefined,
        cvv: undefined,
        track_data: undefined,
        pin: undefined
      }
    };
  }

  private sanitizeFilters(filters: Record<string, any>): Record<string, any> {
    const sanitized = { ...filters };
    
    // Remove or mask potentially sensitive filter values
    if (sanitized.email) {
      sanitized.email_hash = this.hashEmail(sanitized.email);
      delete sanitized.email;
    }
    
    if (sanitized.card_number) {
      sanitized.card_last4 = sanitized.card_number.slice(-4);
      delete sanitized.card_number;
    }

    return sanitized;
  }

  private sanitizeStackTrace(stack?: string): string | undefined {
    if (!stack) return undefined;
    
    // Remove potentially sensitive information from stack traces
    return stack
      .replace(/\/home\/[^\/]+/g, '/home/[USER]')
      .replace(/password=[^&\s]+/gi, 'password=[REDACTED]')
      .replace(/token=[^&\s]+/gi, 'token=[REDACTED]')
      .replace(/key=[^&\s]+/gi, 'key=[REDACTED]');
  }

  private hashIP(ip: string): string {
    const salt = process.env.IP_HASH_SALT || 'default_salt_change_in_production';
    return crypto.createHash('sha256').update(ip + salt).digest('hex').substring(0, 16);
  }

  private hashUserAgent(userAgent: string): string {
    const salt = process.env.UA_HASH_SALT || 'default_salt_change_in_production';
    return crypto.createHash('sha256').update(userAgent + salt).digest('hex').substring(0, 16);
  }

  private hashEmail(email: string): string {
    const salt = process.env.EMAIL_HASH_SALT || 'default_salt_change_in_production';
    return crypto.createHash('sha256').update(email.toLowerCase() + salt).digest('hex').substring(0, 16);
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  private async writeLog(logStream: string, entry: AuditLogEntry): Promise<void> {
    try {
      const logEvent = {
        timestamp: Date.now(),
        message: JSON.stringify({
          ...entry,
          environment: this.environment,
          service: 'universal-payment-protocol',
          version: '1.0.0'
        })
      };

      const params = {
        logGroupName: this.logGroupName,
        logStreamName: `${logStream}-${new Date().toISOString().split('T')[0]}`,
        logEvents: [logEvent]
      };

      await this.cloudWatchLogs.putLogEvents(params).promise();

      // Also log to console in development
      if (this.environment === 'development') {
        console.log(`[${entry.severity.toUpperCase()}] ${entry.event_type}:`, {
          user_id: entry.user_id,
          request_id: entry.request_id,
          success: entry.success,
          metadata: entry.metadata
        });
      }

    } catch (error) {
      // Fallback logging if CloudWatch fails
      console.error('Failed to write audit log:', error);
      console.log('AUDIT LOG ENTRY:', JSON.stringify(entry));
    }
  }

  private async triggerSecurityAlert(event: SecurityEvent): Promise<void> {
    // Implementation would integrate with incident response system
    console.error('🚨 CRITICAL SECURITY EVENT:', {
      type: event.event_type,
      user_id: event.user_id,
      severity: event.severity,
      threat_type: event.threat_type,
      block_reason: event.block_reason,
      timestamp: event.timestamp
    });
  }

  private async triggerErrorAlert(event: AuditLogEntry): Promise<void> {
    // Implementation would integrate with error monitoring system
    console.error('💥 HIGH SEVERITY ERROR:', {
      type: event.event_type,
      user_id: event.user_id,
      severity: event.severity,
      error_message: event.metadata?.error_message,
      timestamp: event.timestamp
    });
  }
}

// Export singleton instance
export const auditLogger = new AuditLogger();