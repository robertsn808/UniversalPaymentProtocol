import crypto from 'crypto';
import { z } from 'zod';

import { db } from '../database/connection.js';
import { env } from '../config/environment.js';
import secureLogger from '../shared/logger.js';

/**
 * Comprehensive audit trail system for financial compliance
 * Implements PCI DSS, SOX, and GDPR audit requirements
 */

// Audit log schema for validation
export const AuditLogSchema = z.object({
  timestamp: z.string().datetime(),
  user_id: z.string().optional(),
  device_id: z.string().optional(),
  action: z.string().min(1),
  resource: z.string().min(1),
  result: z.enum(['success', 'failure']),
  ip_address: z.string().ip(),
  user_agent: z.string().optional(),
  correlation_id: z.string().uuid(),
  sensitive_data_accessed: z.boolean(),
  risk_level: z.enum(['low', 'medium', 'high']).default('medium'),
  compliance_flags: z.array(z.enum(['PCI_DSS', 'SOX', 'GDPR', 'AML'])).default([]),
  changes: z
    .object({
      before: z.any().optional(),
      after: z.any().optional(),
    })
    .optional(),
  metadata: z.record(z.any()).optional(),
});

export type AuditLog = z.infer<typeof AuditLogSchema>;

// Immutable audit log entry with cryptographic integrity
export interface SecureAuditEntry {
  id: string;
  log: AuditLog;
  hash: string;
  previousHash: string;
  blockNumber: number;
  signature: string;
  created_at: Date;
}

export class ComplianceAuditTrail {
  private static instance: ComplianceAuditTrail;
  private readonly encryptionKey: string;
  private readonly signingKey: string;
  private lastBlockHash: string = '0';
  private blockNumber: number = 0;

  private constructor() {
    this.encryptionKey = env.AUDIT_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
    this.signingKey = env.AUDIT_SIGNING_KEY || crypto.randomBytes(32).toString('hex');
    this.initializeAuditChain();
  }

  public static getInstance(): ComplianceAuditTrail {
    if (!ComplianceAuditTrail.instance) {
      ComplianceAuditTrail.instance = new ComplianceAuditTrail();
    }
    return ComplianceAuditTrail.instance;
  }

  /**
   * Initialize the audit blockchain chain
   */
  private async initializeAuditChain(): Promise<void> {
    try {
      const result = await db.query(
        'SELECT block_number, hash FROM audit_chain ORDER BY block_number DESC LIMIT 1'
      );
      if (result.rows && result.rows.length > 0) {
        this.blockNumber = result.rows[0].block_number;
        this.lastBlockHash = result.rows[0].hash;
      }
    } catch (error) {
      secureLogger.error('Failed to initialize audit chain', { error });
    }
  }

  /**
   * Create immutable audit log entry
   */
  public async createAuditLog(auditData: Partial<AuditLog>): Promise<SecureAuditEntry> {
    // Validate audit data
    const validatedLog = AuditLogSchema.parse({
      timestamp: new Date().toISOString(),
      correlation_id: crypto.randomUUID(),
      ...auditData,
    });

    // Sanitize sensitive data
    const sanitizedLog = this.sanitizeSensitiveData(validatedLog);

    // Create cryptographic hash chain
    const entryId = crypto.randomUUID();
    const logHash = this.calculateHash(sanitizedLog, this.lastBlockHash);
    const signature = this.signEntry(sanitizedLog, logHash);

    const secureEntry: SecureAuditEntry = {
      id: entryId,
      log: sanitizedLog,
      hash: logHash,
      previousHash: this.lastBlockHash,
      blockNumber: ++this.blockNumber,
      signature,
      created_at: new Date(),
    };

    // Store in database with encryption
    await this.storeSecureEntry(secureEntry);

    // Update chain state
    this.lastBlockHash = logHash;

    // Log for compliance monitoring
    secureLogger.audit('Audit trail entry created', {
      auditId: entryId,
      action: sanitizedLog.action,
      resource: sanitizedLog.resource,
      userId: sanitizedLog.user_id,
      riskLevel: sanitizedLog.risk_level,
      complianceFlags: sanitizedLog.compliance_flags,
    });

    return secureEntry;
  }

  /**
   * Log payment processing events (PCI DSS compliance)
   */
  public async logPaymentEvent(data: {
    user_id?: string;
    device_id?: string;
    action: 'payment_attempt' | 'payment_success' | 'payment_failure' | 'refund';
    transaction_id?: string;
    amount?: number;
    currency?: string;
    ip_address: string;
    user_agent?: string;
    correlation_id: string;
    error_code?: string;
  }): Promise<void> {
    await this.createAuditLog({
      user_id: data.user_id,
      device_id: data.device_id,
      action: data.action,
      resource: 'payment',
      result: data.action.includes('failure') ? 'failure' : 'success',
      ip_address: data.ip_address,
      user_agent: data.user_agent,
      correlation_id: data.correlation_id,
      sensitive_data_accessed: true,
      risk_level: 'high',
      compliance_flags: ['PCI_DSS'],
      metadata: {
        transaction_id: data.transaction_id,
        amount: data.amount,
        currency: data.currency,
        error_code: data.error_code,
      },
    });
  }

  /**
   * Log authentication events
   */
  public async logAuthEvent(data: {
    user_id?: string;
    action: 'login' | 'logout' | 'failed_login' | 'password_change' | 'account_locked';
    ip_address: string;
    user_agent?: string;
    correlation_id: string;
    risk_factors?: string[];
  }): Promise<void> {
    await this.createAuditLog({
      user_id: data.user_id,
      action: data.action,
      resource: 'authentication',
      result: data.action.includes('failed') || data.action.includes('locked') ? 'failure' : 'success',
      ip_address: data.ip_address,
      user_agent: data.user_agent,
      correlation_id: data.correlation_id,
      sensitive_data_accessed: false,
      risk_level: data.action.includes('failed') ? 'high' : 'medium',
      compliance_flags: ['GDPR'],
      metadata: {
        risk_factors: data.risk_factors,
      },
    });
  }

  /**
   * Log data access events (GDPR compliance)
   */
  public async logDataAccessEvent(data: {
    user_id?: string;
    action: 'data_access' | 'data_export' | 'data_deletion' | 'consent_update';
    data_type: string;
    ip_address: string;
    user_agent?: string;
    correlation_id: string;
    legal_basis?: string;
  }): Promise<void> {
    await this.createAuditLog({
      user_id: data.user_id,
      action: data.action,
      resource: 'personal_data',
      result: 'success',
      ip_address: data.ip_address,
      user_agent: data.user_agent,
      correlation_id: data.correlation_id,
      sensitive_data_accessed: true,
      risk_level: 'high',
      compliance_flags: ['GDPR'],
      metadata: {
        data_type: data.data_type,
        legal_basis: data.legal_basis,
      },
    });
  }

  /**
   * Log administrative events (SOX compliance)
   */
  public async logAdminEvent(data: {
    user_id: string;
    action: 'config_change' | 'user_privilege_change' | 'system_access' | 'data_backup';
    resource: string;
    ip_address: string;
    user_agent?: string;
    correlation_id: string;
    changes?: { before: any; after: any };
  }): Promise<void> {
    await this.createAuditLog({
      user_id: data.user_id,
      action: data.action,
      resource: data.resource,
      result: 'success',
      ip_address: data.ip_address,
      user_agent: data.user_agent,
      correlation_id: data.correlation_id,
      sensitive_data_accessed: true,
      risk_level: 'high',
      compliance_flags: ['SOX'],
      changes: data.changes,
    });
  }

  /**
   * Verify audit trail integrity
   */
  public async verifyIntegrity(startBlock?: number, endBlock?: number): Promise<boolean> {
    try {
      const query = `
        SELECT * FROM secure_audit_logs 
        WHERE block_number >= $1 AND block_number <= $2
        ORDER BY block_number ASC
      `;
      
      const start = startBlock || 0;
      const end = endBlock || this.blockNumber;
      
      const result = await db.query(query, [start, end]);
      
      if (!result.rows) return false;

      let previousHash = start === 0 ? '0' : '';
      
      for (const row of result.rows) {
        const entry: SecureAuditEntry = {
          id: row.id,
          log: JSON.parse(row.encrypted_log),
          hash: row.hash,
          previousHash: row.previous_hash,
          blockNumber: row.block_number,
          signature: row.signature,
          created_at: row.created_at,
        };

        // Verify hash chain
        const expectedHash = this.calculateHash(entry.log, entry.previousHash);
        if (expectedHash !== entry.hash) {
          secureLogger.error('Audit trail integrity violation', {
            blockNumber: entry.blockNumber,
            expectedHash,
            actualHash: entry.hash,
          });
          return false;
        }

        // Verify signature
        if (!this.verifySignature(entry.log, entry.hash, entry.signature)) {
          secureLogger.error('Audit trail signature verification failed', {
            blockNumber: entry.blockNumber,
          });
          return false;
        }

        previousHash = entry.hash;
      }

      secureLogger.info('Audit trail integrity verified', { startBlock: start, endBlock: end });
      return true;
    } catch (error) {
      secureLogger.error('Audit trail integrity verification failed', { error });
      return false;
    }
  }

  /**
   * Generate compliance reports
   */
  public async generateComplianceReport(
    complianceType: 'PCI_DSS' | 'SOX' | 'GDPR' | 'AML',
    startDate: Date,
    endDate: Date
  ): Promise<any> {
    const query = `
      SELECT 
        log_data->>'action' as action,
        log_data->>'resource' as resource,
        log_data->>'result' as result,
        log_data->>'risk_level' as risk_level,
        COUNT(*) as event_count,
        MIN(created_at) as first_event,
        MAX(created_at) as last_event
      FROM secure_audit_logs 
      WHERE log_data->'compliance_flags' @> $1
        AND created_at >= $2 
        AND created_at <= $3
      GROUP BY action, resource, result, risk_level
      ORDER BY event_count DESC
    `;

    const result = await db.query(query, [
      JSON.stringify([complianceType]),
      startDate,
      endDate,
    ]);

    return {
      compliance_type: complianceType,
      period: { start: startDate, end: endDate },
      summary: result.rows,
      integrity_verified: await this.verifyIntegrity(),
      generated_at: new Date().toISOString(),
    };
  }

  // Private helper methods
  private sanitizeSensitiveData(log: AuditLog): AuditLog {
    const sensitiveFields = ['password', 'token', 'key', 'secret', 'card', 'ssn'];
    
    const sanitized = { ...log };
    
    // Sanitize metadata
    if (sanitized.metadata) {
      for (const [key, value] of Object.entries(sanitized.metadata)) {
        if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
          sanitized.metadata[key] = '[REDACTED]';
        }
      }
    }

    // Sanitize changes
    if (sanitized.changes) {
      sanitized.changes = {
        before: this.redactSensitiveFields(sanitized.changes.before),
        after: this.redactSensitiveFields(sanitized.changes.after),
      };
    }

    return sanitized;
  }

  private redactSensitiveFields(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;
    
    const redacted = { ...obj };
    const sensitiveFields = ['password', 'token', 'key', 'secret', 'card', 'ssn'];
    
    for (const [key, value] of Object.entries(redacted)) {
      if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
        redacted[key] = '[REDACTED]';
      }
    }
    
    return redacted;
  }

  private calculateHash(log: AuditLog, previousHash: string): string {
    const data = JSON.stringify({ log, previousHash });
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private signEntry(log: AuditLog, hash: string): string {
    const data = JSON.stringify({ log, hash });
    return crypto.createHmac('sha256', this.signingKey).update(data).digest('hex');
  }

  private verifySignature(log: AuditLog, hash: string, signature: string): boolean {
    const expectedSignature = this.signEntry(log, hash);
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  }

  private async storeSecureEntry(entry: SecureAuditEntry): Promise<void> {
    // Encrypt sensitive audit data
    const encryptedLog = this.encryptData(JSON.stringify(entry.log));
    
    const query = `
      INSERT INTO secure_audit_logs (
        id, encrypted_log, hash, previous_hash, block_number, 
        signature, created_at, compliance_flags
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;

    await db.query(query, [
      entry.id,
      encryptedLog,
      entry.hash,
      entry.previousHash,
      entry.blockNumber,
      entry.signature,
      entry.created_at,
      JSON.stringify(entry.log.compliance_flags),
    ]);
  }

  private encryptData(data: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  }

  private decryptData(encryptedData: string): string {
    const [ivHex, encrypted] = encryptedData.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}

// Singleton instance for global access
export const auditTrail = ComplianceAuditTrail.getInstance();