
import { db } from '../database/connection.js';
import secureLogger from '../shared/logger.js';
import * as crypto from 'crypto';
import { env } from '../config/environment.js';

export interface AuditEvent {
  user_id: string;
  action: string;
  transaction_id?: string;
  amount?: number;
  currency?: string;
  ip_address?: string;
  user_agent?: string;
  correlation_id?: string;
  metadata?: Record<string, any>;
}

export interface AuditLog extends AuditEvent {
  id: number;
  created_at: Date;
  event_hash: string;
}

class AuditTrail {
  private static instance: AuditTrail;
  private encryptionKey: string;

  private constructor() {
    this.encryptionKey = env.ENCRYPTION_KEY || 'default-audit-encryption-key-32chars-long-for-demo';
    secureLogger.info('Audit trail initialized');
  }

  public static getInstance(): AuditTrail {
    if (!AuditTrail.instance) {
      AuditTrail.instance = new AuditTrail();
    }
    return AuditTrail.instance;
  }

  /**
   * Log a payment-related event
   */
  public async logPaymentEvent(event: AuditEvent): Promise<void> {
    try {
      const eventHash = this.calculateEventHash(event);
      
      const query = `
        INSERT INTO audit_logs (
          user_id, action, transaction_id, amount, currency, 
          ip_address, user_agent, correlation_id, metadata, 
          created_at, event_hash
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `;

      await db.query(query, [
        event.user_id,
        event.action,
        event.transaction_id,
        event.amount,
        event.currency,
        event.ip_address,
        event.user_agent,
        event.correlation_id,
        JSON.stringify(event.metadata || {}),
        new Date(),
        eventHash
      ]);

      secureLogger.info('Audit event logged', {
        action: event.action,
        userId: event.user_id,
        transactionId: event.transaction_id,
        correlationId: event.correlation_id
      });

    } catch (error) {
      secureLogger.error('Failed to log audit event', {
        error: error instanceof Error ? error.message : 'Unknown error',
        event: event
      });
      
      // Don't throw - audit logging should not break main flow
    }
  }

  /**
   * Log user authentication events
   */
  public async logAuthEvent(event: {
    user_id: string;
    action: 'login_success' | 'login_failure' | 'logout' | 'password_change' | 'account_created';
    ip_address?: string;
    user_agent?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    await this.logPaymentEvent({
      ...event,
      correlation_id: `auth_${Date.now()}_${crypto.randomUUID().substring(0, 8)}`
    });
  }

  /**
   * Log security events
   */
  public async logSecurityEvent(event: {
    user_id: string;
    action: 'suspicious_activity' | 'rate_limit_exceeded' | 'fraud_detected' | 'security_violation';
    ip_address?: string;
    user_agent?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    await this.logPaymentEvent({
      ...event,
      correlation_id: `security_${Date.now()}_${crypto.randomUUID().substring(0, 8)}`
    });

    // Also log to security logger with high severity
    secureLogger.security('Security event detected', {
      action: event.action,
      userId: event.user_id,
      ipAddress: event.ip_address,
      metadata: event.metadata
    });
  }

  /**
   * Log administrative actions
   */
  public async logAdminEvent(event: {
    user_id: string;
    action: string;
    target_user_id?: string;
    ip_address?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    await this.logPaymentEvent({
      ...event,
      correlation_id: `admin_${Date.now()}_${crypto.randomUUID().substring(0, 8)}`
    });
  }

  /**
   * Log data access events for GDPR compliance
   */
  public async logDataAccessEvent(event: {
    user_id: string;
    action: string;
    data_type: string;
    ip_address: string;
    user_agent?: string;
    correlation_id: string;
    legal_basis?: string;
  }): Promise<void> {
    await this.logPaymentEvent({
      user_id: event.user_id,
      action: event.action,
      transaction_id: undefined,
      ip_address: event.ip_address,
      correlation_id: event.correlation_id,
      metadata: {
        data_type: event.data_type,
        user_agent: event.user_agent
      }
    });
  }

  /**
   * Create audit log entry for GDPR compliance
   */
  public async createAuditLog(event: {
    user_id: string;
    action: string;
    details: string;
    ip_address: string;
    correlation_id: string;
  }): Promise<void> {
    await this.logPaymentEvent({
      user_id: event.user_id,
      action: event.action,
      transaction_id: undefined,
      ip_address: event.ip_address,
      correlation_id: event.correlation_id,
      metadata: {
        details: event.details
      }
    });
  }

  /**
   * Get audit logs with filtering
   */
  public async getAuditLogs(filters: {
    user_id?: string;
    action?: string;
    transaction_id?: string;
    start_date?: Date;
    end_date?: Date;
    limit?: number;
    offset?: number;
  }): Promise<AuditLog[]> {
    try {
      let query = 'SELECT * FROM audit_logs WHERE 1=1';
      const params: any[] = [];
      let paramIndex = 1;

      if (filters.user_id) {
        query += ` AND user_id = $${paramIndex++}`;
        params.push(filters.user_id);
      }

      if (filters.action) {
        query += ` AND action = $${paramIndex++}`;
        params.push(filters.action);
      }

      if (filters.transaction_id) {
        query += ` AND transaction_id = $${paramIndex++}`;
        params.push(filters.transaction_id);
      }

      if (filters.start_date) {
        query += ` AND created_at >= $${paramIndex++}`;
        params.push(filters.start_date);
      }

      if (filters.end_date) {
        query += ` AND created_at <= $${paramIndex++}`;
        params.push(filters.end_date);
      }

      query += ' ORDER BY created_at DESC';

      if (filters.limit) {
        query += ` LIMIT $${paramIndex++}`;
        params.push(filters.limit);
      }

      if (filters.offset) {
        query += ` OFFSET $${paramIndex++}`;
        params.push(filters.offset);
      }

      const result = await db.query(query, params);
      return result.rows.map((row: any) => ({
        ...row,
        metadata: JSON.parse(row.metadata || '{}')
      }));

    } catch (error) {
      secureLogger.error('Failed to retrieve audit logs', {
        error: error instanceof Error ? error.message : 'Unknown error',
        filters
      });
      return [];
    }
  }

  /**
   * Generate audit report for compliance
   */
  public async generateAuditReport(options: {
    start_date: Date;
    end_date: Date;
    include_payment_events?: boolean;
    include_auth_events?: boolean;
    include_security_events?: boolean;
  }): Promise<{
    total_events: number;
    payment_events: number;
    auth_events: number;
    security_events: number;
    unique_users: number;
    events_by_day: Record<string, number>;
    top_actions: Array<{ action: string; count: number }>;
  }> {
    try {
      const baseQuery = `
        SELECT 
          COUNT(*) as total,
          COUNT(DISTINCT user_id) as unique_users,
          DATE(created_at) as event_date,
          action
        FROM audit_logs 
        WHERE created_at >= $1 AND created_at <= $2
      `;

      // Get overall stats
      const totalResult = await db.query(
        baseQuery + ' GROUP BY DATE(created_at), action ORDER BY event_date, action',
        [options.start_date, options.end_date]
      );

      // Get event counts by category
      const categoryQueries = [];
      if (options.include_payment_events) {
        categoryQueries.push("action LIKE '%payment%' OR action LIKE '%transaction%'");
      }
      if (options.include_auth_events) {
        categoryQueries.push("action LIKE '%login%' OR action LIKE '%logout%' OR action LIKE '%auth%'");
      }
      if (options.include_security_events) {
        categoryQueries.push("action LIKE '%security%' OR action LIKE '%fraud%' OR action LIKE '%suspicious%'");
      }

      const eventsByDay: Record<string, number> = {};
      const actionCounts: Record<string, number> = {};
      let totalEvents = 0;
      let uniqueUsers = 0;

      for (const row of totalResult.rows) {
        const date = row.event_date.toISOString().split('T')[0];
        eventsByDay[date] = (eventsByDay[date] || 0) + parseInt(row.total);
        actionCounts[row.action] = (actionCounts[row.action] || 0) + parseInt(row.total);
        totalEvents += parseInt(row.total);
        uniqueUsers = Math.max(uniqueUsers, parseInt(row.unique_users));
      }

      // Get category-specific counts
      let paymentEvents = 0;
      let authEvents = 0;
      let securityEvents = 0;

      if (options.include_payment_events) {
        const paymentResult = await db.query(
          `SELECT COUNT(*) as count FROM audit_logs 
           WHERE created_at >= $1 AND created_at <= $2 
           AND (action LIKE '%payment%' OR action LIKE '%transaction%')`,
          [options.start_date, options.end_date]
        );
        paymentEvents = parseInt(paymentResult.rows[0]?.count || '0');
      }

      if (options.include_auth_events) {
        const authResult = await db.query(
          `SELECT COUNT(*) as count FROM audit_logs 
           WHERE created_at >= $1 AND created_at <= $2 
           AND (action LIKE '%login%' OR action LIKE '%logout%' OR action LIKE '%auth%')`,
          [options.start_date, options.end_date]
        );
        authEvents = parseInt(authResult.rows[0]?.count || '0');
      }

      if (options.include_security_events) {
        const securityResult = await db.query(
          `SELECT COUNT(*) as count FROM audit_logs 
           WHERE created_at >= $1 AND created_at <= $2 
           AND (action LIKE '%security%' OR action LIKE '%fraud%' OR action LIKE '%suspicious%')`,
          [options.start_date, options.end_date]
        );
        securityEvents = parseInt(securityResult.rows[0]?.count || '0');
      }

      const topActions = Object.entries(actionCounts)
        .map(([action, count]) => ({ action, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return {
        total_events: totalEvents,
        payment_events: paymentEvents,
        auth_events: authEvents,
        security_events: securityEvents,
        unique_users: uniqueUsers,
        events_by_day: eventsByDay,
        top_actions: topActions
      };

    } catch (error) {
      secureLogger.error('Failed to generate audit report', {
        error: error instanceof Error ? error.message : 'Unknown error',
        options
      });
      
      return {
        total_events: 0,
        payment_events: 0,
        auth_events: 0,
        security_events: 0,
        unique_users: 0,
        events_by_day: {},
        top_actions: []
      };
    }
  }

  /**
   * Verify audit log integrity
   */
  public async verifyAuditIntegrity(logId: number): Promise<boolean> {
    try {
      const result = await db.query(
        'SELECT * FROM audit_logs WHERE id = $1',
        [logId]
      );

      if (result.rows.length === 0) {
        return false;
      }

      const log = result.rows[0];
      const expectedHash = this.calculateEventHash({
        user_id: log.user_id,
        action: log.action,
        transaction_id: log.transaction_id,
        amount: log.amount,
        currency: log.currency,
        ip_address: log.ip_address,
        user_agent: log.user_agent,
        correlation_id: log.correlation_id,
        metadata: JSON.parse(log.metadata || '{}')
      });

      return expectedHash === log.event_hash;

    } catch (error) {
      secureLogger.error('Failed to verify audit integrity', {
        error: error instanceof Error ? error.message : 'Unknown error',
        logId
      });
      return false;
    }
  }

  /**
   * Clean up old audit logs (for GDPR compliance)
   */
  public async cleanupOldLogs(retentionDays: number = 2555): Promise<number> { // ~7 years default
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const result = await db.query(
        'DELETE FROM audit_logs WHERE created_at < $1',
        [cutoffDate]
      );

      const deletedCount = result.rowCount || 0;

      secureLogger.info('Audit log cleanup completed', {
        deletedCount,
        cutoffDate: cutoffDate.toISOString(),
        retentionDays
      });

      return deletedCount;

    } catch (error) {
      secureLogger.error('Failed to cleanup audit logs', {
        error: error instanceof Error ? error.message : 'Unknown error',
        retentionDays
      });
      return 0;
    }
  }

  /**
   * Calculate hash for event integrity
   */
  private calculateEventHash(event: AuditEvent): string {
    const data = JSON.stringify({
      user_id: event.user_id,
      action: event.action,
      transaction_id: event.transaction_id || '',
      amount: event.amount || 0,
      currency: event.currency || '',
      ip_address: event.ip_address || '',
      correlation_id: event.correlation_id || '',
      metadata: event.metadata || {}
    });

    return crypto
      .createHmac('sha256', this.encryptionKey)
      .update(data)
      .digest('hex');
  }

  /**
   * Export audit logs for compliance (encrypted)
   */
  public async exportAuditLogs(filters: {
    start_date: Date;
    end_date: Date;
    user_id?: string;
  }): Promise<string> {
    try {
      const logs = await this.getAuditLogs(filters);
      const exportData = {
        export_timestamp: new Date().toISOString(),
        filters,
        total_records: logs.length,
        logs
      };

      // Encrypt the export
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-cbc', this.encryptionKey, iv);
      let encrypted = cipher.update(JSON.stringify(exportData), 'utf8', 'hex');
      encrypted += cipher.final('hex');

      secureLogger.info('Audit logs exported', {
        recordCount: logs.length,
        filters
      });

      return encrypted;

    } catch (error) {
      secureLogger.error('Failed to export audit logs', {
        error: error instanceof Error ? error.message : 'Unknown error',
        filters
      });
      throw error;
    }
  }
}

export const auditTrail = AuditTrail.getInstance();
export default auditTrail;
