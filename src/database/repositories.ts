// Database repositories for UPP models
import { db } from './connection.js';
import { 
  User, Device, Transaction, AuditLog,
  CreateUser, UpdateUser, CreateDevice, UpdateDevice, 
  CreateTransaction, UpdateTransaction, CreateAuditLog 
} from './models.js';
import { UPPTracing, MetricRecorders } from '../monitoring/metrics.js';

// Cache utilities
const CACHE_TTL = {
  USER: 300, // 5 minutes
  DEVICE: 600, // 10 minutes
  TRANSACTION: 60, // 1 minute
};

function getCacheKey(prefix: string, id: string | number): string {
  return `upp:${prefix}:${id}`;
}

export class UserRepository {
  async create(user: CreateUser): Promise<User> {
    const query = `
      INSERT INTO users (email, password_hash, first_name, last_name, role, is_active, email_verified)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const values = [
      user.email, user.password_hash, user.first_name, user.last_name,
      user.role, user.is_active, user.email_verified
    ];
    const result = await db.query(query, values);
    return result.rows[0];
  }

  async findById(id: number): Promise<User | null> {
    const cacheKey = getCacheKey('user', id);
    
    // Try cache first (with fallback)
    try {
      const cached = await db.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      // Redis unavailable, continue without cache
    }
    
    const query = 'SELECT * FROM users WHERE id = $1';
    const result = await db.query(query, [id]);
    const user = result.rows[0] || null;
    
    // Cache the result (with fallback)
    if (user) {
      try {
        await db.redis.setex(cacheKey, CACHE_TTL.USER, JSON.stringify(user));
      } catch (error) {
        // Redis unavailable, continue without caching
      }
    }
    
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    const cacheKey = getCacheKey('user_email', email);
    
    // Try cache first (with fallback)
    try {
      const cached = await db.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      // Redis unavailable, continue without cache
    }
    
    const query = 'SELECT * FROM users WHERE email = $1';
    const result = await db.query(query, [email]);
    const user = result.rows[0] || null;
    
    // Cache the result (with fallback)
    if (user) {
      try {
        await db.redis.setex(cacheKey, CACHE_TTL.USER, JSON.stringify(user));
      } catch (error) {
        // Redis unavailable, continue without caching
      }
    }
    
    return user;
  }

  async update(id: number, updates: UpdateUser): Promise<User | null> {
    const fields = Object.keys(updates).map((key, index) => `${key} = $${index + 2}`).join(', ');
    const values = [id, ...Object.values(updates)];
    
    const query = `
      UPDATE users SET ${fields}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 RETURNING *
    `;
    const result = await db.query(query, values);
    const user = result.rows[0] || null;
    
    // Invalidate cache (with fallback)
    if (user) {
      try {
        await db.redis.del(getCacheKey('user', id));
        await db.redis.del(getCacheKey('user_email', user.email));
      } catch (error) {
        // Redis unavailable, continue without cache invalidation
      }
    }
    
    return user;
  }

  async updateLastLogin(id: number): Promise<void> {
    const query = 'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1';
    await db.query(query, [id]);
    
    // Invalidate cache (with fallback)
    try {
      await db.redis.del(getCacheKey('user', id));
    } catch (error) {
      // Redis unavailable, continue without cache invalidation
    }
  }

  async delete(id: number): Promise<boolean> {
    const query = 'DELETE FROM users WHERE id = $1';
    const result = await db.query(query, [id]);
    return result.rowCount > 0;
  }

  async list(limit = 50, offset = 0): Promise<User[]> {
    const query = `
      SELECT * FROM users 
      ORDER BY created_at DESC 
      LIMIT $1 OFFSET $2
    `;
    const result = await db.query(query, [limit, offset]);
    return result.rows;
  }
}

export class DeviceRepository {
  async create(device: CreateDevice): Promise<Device> {
    const query = `
      INSERT INTO devices (id, user_id, device_type, fingerprint, capabilities, security_context, status, last_seen, ip_address, user_agent, location)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;
    const values = [
      device.id, device.user_id, device.device_type, device.fingerprint,
      JSON.stringify(device.capabilities), JSON.stringify(device.security_context),
      device.status, device.last_seen, device.ip_address, device.user_agent,
      device.location ? JSON.stringify(device.location) : null
    ];
    const result = await db.query(query, values);
    return result.rows[0];
  }

  async findById(id: string): Promise<Device | null> {
    const cacheKey = getCacheKey('device', id);
    
    // Try cache first (with fallback)
    try {
      const cached = await db.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      // Redis unavailable, continue without cache
    }
    
    const query = 'SELECT * FROM devices WHERE id = $1';
    const result = await db.query(query, [id]);
    const device = result.rows[0] || null;
    
    // Cache the result (with fallback)
    if (device) {
      try {
        await db.redis.setex(cacheKey, CACHE_TTL.DEVICE, JSON.stringify(device));
      } catch (error) {
        // Redis unavailable, continue without caching
      }
    }
    
    return device;
  }

  async findByFingerprint(fingerprint: string): Promise<Device | null> {
    const cacheKey = getCacheKey('device_fingerprint', fingerprint);
    
    // Try cache first (with fallback)
    try {
      const cached = await db.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      // Redis unavailable, continue without cache
    }
    
    const query = 'SELECT * FROM devices WHERE fingerprint = $1';
    const result = await db.query(query, [fingerprint]);
    const device = result.rows[0] || null;
    
    // Cache the result (with fallback)
    if (device) {
      try {
        await db.redis.setex(cacheKey, CACHE_TTL.DEVICE, JSON.stringify(device));
      } catch (error) {
        // Redis unavailable, continue without caching
      }
    }
    
    return device;
  }

  async findByUserId(userId: number): Promise<Device[]> {
    const query = 'SELECT * FROM devices WHERE user_id = $1 ORDER BY last_seen DESC';
    const result = await db.query(query, [userId]);
    return result.rows;
  }

  async update(id: string, updates: UpdateDevice): Promise<Device | null> {
    const fields: string[] = [];
    const values: any[] = [id];
    let paramIndex = 2;

    Object.entries(updates).forEach(([key, value]) => {
      if (key === 'capabilities' || key === 'security_context' || key === 'location') {
        fields.push(`${key} = $${paramIndex}`);
        values.push(JSON.stringify(value));
      } else {
        fields.push(`${key} = $${paramIndex}`);
        values.push(value);
      }
      paramIndex++;
    });

    const query = `
      UPDATE devices SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 RETURNING *
    `;
    const result = await db.query(query, values);
    const device = result.rows[0] || null;
    
    // Invalidate cache (with fallback)
    if (device) {
      try {
        await db.redis.del(getCacheKey('device', id));
        await db.redis.del(getCacheKey('device_fingerprint', device.fingerprint));
      } catch (error) {
        // Redis unavailable, continue without cache invalidation
      }
    }
    
    return device;
  }

  async updateLastSeen(id: string): Promise<void> {
    const query = 'UPDATE devices SET last_seen = CURRENT_TIMESTAMP WHERE id = $1';
    await db.query(query, [id]);
    
    // Invalidate cache (with fallback)
    try {
      await db.redis.del(getCacheKey('device', id));
    } catch (error) {
      // Redis unavailable, continue without cache invalidation
    }
  }

  async delete(id: string): Promise<boolean> {
    const query = 'DELETE FROM devices WHERE id = $1';
    const result = await db.query(query, [id]);
    return result.rowCount > 0;
  }

  async listActive(limit = 50): Promise<Device[]> {
    const query = `
      SELECT * FROM devices 
      WHERE status = 'active' 
      ORDER BY last_seen DESC 
      LIMIT $1
    `;
    const result = await db.query(query, [limit]);
    return result.rows;
  }

  async findByType(deviceType: string): Promise<Device[]> {
    const query = `
      SELECT * FROM devices 
      WHERE device_type = $1 AND status = 'active'
      ORDER BY last_seen DESC
    `;
    const result = await db.query(query, [deviceType]);
    return result.rows;
  }

  async findMany(options: { filters?: any; page?: number; limit?: number } = {}): Promise<Device[]> {
    const { filters = {}, page = 1, limit = 50 } = options;
    const offset = (page - 1) * limit;
    
    let query = 'SELECT * FROM devices WHERE 1=1';
    const values: any[] = [];
    let paramIndex = 1;
    
    if (filters.user_id !== undefined) {
      query += ` AND user_id = $${paramIndex++}`;
      values.push(filters.user_id);
    }
    
    if (filters.status) {
      query += ` AND status = $${paramIndex++}`;
      values.push(filters.status);
    }
    
    if (filters.device_type) {
      query += ` AND device_type = $${paramIndex++}`;
      values.push(filters.device_type);
    }
    
    query += ` ORDER BY last_seen DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    values.push(limit, offset);
    
    const result = await db.query(query, values);
    return result.rows;
  }
}

export class TransactionRepository {
  async create(transaction: CreateTransaction): Promise<Transaction> {
    const startTime = Date.now();
    
    return await UPPTracing.trace('transaction.create', async () => {
      // 🔍 Check if device exists
      const deviceCheck = await db.query(
        'SELECT id FROM devices WHERE id = $1',
        [transaction.device_id]
      );

    if (deviceCheck.rows.length === 0) {
      throw {
        code: 'DEVICE_NOT_FOUND',
        message: `Device ID '${transaction.device_id}' does not exist`,
        statusCode: 400,
        details: { device_id: transaction.device_id }
      };
    }

    const query = `
      INSERT INTO transactions (id, user_id, device_id, amount, currency, status, payment_intent_id, payment_method, merchant_id, description, metadata, stripe_data, processed_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;
    const values = [
      transaction.id, transaction.user_id, transaction.device_id, transaction.amount,
      transaction.currency, transaction.status, transaction.payment_intent_id,
      transaction.payment_method, transaction.merchant_id, transaction.description,
      transaction.metadata ? JSON.stringify(transaction.metadata) : null,
      transaction.stripe_data ? JSON.stringify(transaction.stripe_data) : null,
      transaction.processed_at
    ];
    const result = await db.query(query, values);
    const createdTransaction = result.rows[0];
    
    // Record metrics
    const duration = Date.now() - startTime;
    MetricRecorders.recordDatabaseOperation('create', 'transactions', duration, true);
    
    return createdTransaction;
    }, {
      'upp.transaction.amount': transaction.amount,
      'upp.transaction.currency': transaction.currency,
      'upp.transaction.device_id': transaction.device_id,
    });
  }

  async findById(id: string): Promise<Transaction | null> {
    const cacheKey = getCacheKey('transaction', id);
    
    // Try cache first (with fallback)
    try {
      const cached = await db.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      // Redis unavailable, continue without cache
    }
    
    const query = 'SELECT * FROM transactions WHERE id = $1';
    const result = await db.query(query, [id]);
    const transaction = result.rows[0] || null;
    
    // Cache the result (shorter TTL for transactions due to status changes) (with fallback)
    if (transaction) {
      try {
        await db.redis.setex(cacheKey, CACHE_TTL.TRANSACTION, JSON.stringify(transaction));
      } catch (error) {
        // Redis unavailable, continue without caching
      }
    }
    
    return transaction;
  }

  async findByPaymentIntentId(paymentIntentId: string): Promise<Transaction | null> {
    const query = 'SELECT * FROM transactions WHERE payment_intent_id = $1';
    const result = await db.query(query, [paymentIntentId]);
    return result.rows[0] || null;
  }

  async findByUserId(userId: number, options: { status?: string; page?: number; limit?: number } = {}): Promise<Transaction[]> {
    const { status, page = 1, limit = 50 } = options;
    const offset = (page - 1) * limit;
    
    let query = 'SELECT * FROM transactions WHERE user_id = $1';
    const values: any[] = [userId];
    
    if (status) {
      query += ' AND status = $2';
      values.push(status);
    }
    
    query += ' ORDER BY created_at DESC LIMIT $' + (values.length + 1) + ' OFFSET $' + (values.length + 2);
    values.push(limit, offset);
    
    const result = await db.query(query, values);
    return result.rows;
  }

  async findByDeviceId(deviceId: string, limit = 50): Promise<Transaction[]> {
    const query = `
      SELECT * FROM transactions 
      WHERE device_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2
    `;
    const result = await db.query(query, [deviceId, limit]);
    return result.rows;
  }

  async update(id: string, updates: UpdateTransaction): Promise<Transaction | null> {
    const fields: string[] = [];
    const values: any[] = [id];
    let paramIndex = 2;

    Object.entries(updates).forEach(([key, value]) => {
      if (key === 'metadata' || key === 'stripe_data') {
        fields.push(`${key} = $${paramIndex}`);
        values.push(JSON.stringify(value));
      } else {
        fields.push(`${key} = $${paramIndex}`);
        values.push(value);
      }
      paramIndex++;
    });

    const query = `
      UPDATE transactions SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 RETURNING *
    `;
    const result = await db.query(query, values);
    return result.rows[0] || null;
  }

  async updateStatus(id: string, status: Transaction['status'], errorMessage?: string): Promise<void> {
    const query = `
      UPDATE transactions 
      SET status = $2, error_message = $3, processed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;
    await db.query(query, [id, status, errorMessage]);
    
    // Invalidate cache (with fallback)
    try {
      await db.redis.del(getCacheKey('transaction', id));
    } catch (error) {
      // Redis unavailable, continue without cache invalidation
    }
  }

  async getStats(userId?: number): Promise<any> {
    const whereClause = userId ? 'WHERE user_id = $1' : '';
    const params = userId ? [userId] : [];
    
    const query = `
      SELECT 
        COUNT(*) as total_transactions,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_transactions,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_transactions,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0) as total_amount,
        COALESCE(AVG(CASE WHEN status = 'completed' THEN amount ELSE NULL END), 0) as average_amount
      FROM transactions 
      ${whereClause}
    `;
    const result = await db.query(query, params);
    return result.rows[0];
  }
}

export class AuditLogRepository {
  async create(auditLog: CreateAuditLog): Promise<AuditLog> {
    const query = `
      INSERT INTO audit_logs (user_id, device_id, action, resource, result, ip_address, user_agent, correlation_id, request_data, response_data, error_data, sensitive_data_accessed)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;
    const values = [
      auditLog.user_id, auditLog.device_id, auditLog.action, auditLog.resource,
      auditLog.result, auditLog.ip_address, auditLog.user_agent, auditLog.correlation_id,
      auditLog.request_data ? JSON.stringify(auditLog.request_data) : null,
      auditLog.response_data ? JSON.stringify(auditLog.response_data) : null,
      auditLog.error_data ? JSON.stringify(auditLog.error_data) : null,
      auditLog.sensitive_data_accessed
    ];
    const result = await db.query(query, values);
    return result.rows[0];
  }

  async findByUserId(userId: number, limit = 100, offset = 0): Promise<AuditLog[]> {
    const query = `
      SELECT * FROM audit_logs 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2 OFFSET $3
    `;
    const result = await db.query(query, [userId, limit, offset]);
    return result.rows;
  }

  async findByCorrelationId(correlationId: string): Promise<AuditLog[]> {
    const query = `
      SELECT * FROM audit_logs 
      WHERE correlation_id = $1 
      ORDER BY created_at ASC
    `;
    const result = await db.query(query, [correlationId]);
    return result.rows;
  }

  async findSecurityEvents(hours = 24): Promise<AuditLog[]> {
    const query = `
      SELECT * FROM audit_logs 
      WHERE (result = 'failure' OR sensitive_data_accessed = true)
        AND created_at > NOW() - INTERVAL '${hours} hours'
      ORDER BY created_at DESC
    `;
    const result = await db.query(query);
    return result.rows;
  }
}

// Export repository instances
export const userRepository = new UserRepository();
export const deviceRepository = new DeviceRepository();
export const transactionRepository = new TransactionRepository();
export const auditLogRepository = new AuditLogRepository();