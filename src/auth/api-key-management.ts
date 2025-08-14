import crypto from 'crypto';
import { secureLogger } from '../shared/logger.js';
import { db } from '../database/connection.js';

export interface APIKeyData {
  id: string;
  key: string;
  name: string;
  email: string;
  organization: string;
  usage: 'development' | 'production' | 'testing';
  permissions: string[];
  rateLimit: number;
  createdAt: Date;
  lastUsed?: Date;
  isActive: boolean;
  webhookUrl?: string;
  allowedOrigins?: string[];
}

export interface APIKeyRegistration {
  name: string;
  email: string;
  organization: string;
  usage: 'development' | 'production' | 'testing';
  description: string;
  webhookUrl?: string;
  allowedOrigins?: string[];
}

export interface APIKeyValidationResult {
  isValid: boolean;
  keyData?: APIKeyData;
  error?: string;
}

export class APIKeyManager {
  private static instance: APIKeyManager;

  private constructor() {}

  static getInstance(): APIKeyManager {
    if (!APIKeyManager.instance) {
      APIKeyManager.instance = new APIKeyManager();
    }
    return APIKeyManager.instance;
  }

  async generateAPIKey(registration: APIKeyRegistration): Promise<APIKeyData> {
    try {
      const keyId = crypto.randomUUID();
      const apiKey = this.generateSecureKey();
      const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');

      const keyData: APIKeyData = {
        id: keyId,
        key: apiKey,
        name: registration.name,
        email: registration.email,
        organization: registration.organization,
        usage: registration.usage,
        permissions: this.getDefaultPermissions(registration.usage),
        rateLimit: this.getDefaultRateLimit(registration.usage),
        createdAt: new Date(),
        isActive: true,
        webhookUrl: registration.webhookUrl,
        allowedOrigins: registration.allowedOrigins
      };

      // Store in database (without the plain text key)
      const { key, ...storedData } = keyData;
      await db.query(
        `INSERT INTO api_keys (
          id, name, email, organization, usage, permissions, rate_limit, 
          created_at, is_active, webhook_url, allowed_origins, key_hash
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          keyData.id, keyData.name, keyData.email, keyData.organization,
          keyData.usage, JSON.stringify(keyData.permissions), keyData.rateLimit,
          keyData.createdAt, keyData.isActive, keyData.webhookUrl,
          JSON.stringify(keyData.allowedOrigins), hashedKey
        ]
      );

      // Store in Redis for fast access
      await db.redis.setex(
        `api_key:${keyId}`,
        3600, // 1 hour cache
        JSON.stringify({ ...storedData, keyHash: hashedKey })
      );

      secureLogger.info(`API key generated for ${registration.email} (${registration.organization})`);
      return keyData;
    } catch (error) {
      secureLogger.error(`Failed to generate API key: ${String(error)}`);
      throw new Error('Failed to generate API key');
    }
  }

  async validateAPIKey(apiKey: string): Promise<APIKeyValidationResult> {
    try {
      if (!apiKey || !apiKey.startsWith('upp_')) {
        return { isValid: false, error: 'Invalid API key format' };
      }

      const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');
      
      // Check Redis first
      const cachedData = await db.redis.get(`api_key_hash:${hashedKey}`);
      if (cachedData) {
        const keyData = JSON.parse(cachedData);
        if (!keyData.isActive) {
          return { isValid: false, error: 'API key is inactive' };
        }
        return { isValid: true, keyData: { ...keyData, key: apiKey } };
      }

      // Check database
      const result = await db.query(
        `SELECT * FROM api_keys WHERE key_hash = $1 AND is_active = true`,
        [hashedKey]
      );

      if (result.rows.length === 0) {
        return { isValid: false, error: 'Invalid or inactive API key' };
      }

      const keyData = result.rows[0];
      
      // Update last used
      await db.query(
        `UPDATE api_keys SET last_used = NOW() WHERE id = $1`,
        [keyData.id]
      );

      // Cache in Redis
      await db.redis.setex(
        `api_key_hash:${hashedKey}`,
        3600,
        JSON.stringify({
          id: keyData.id,
          name: keyData.name,
          email: keyData.email,
          organization: keyData.organization,
          usage: keyData.usage,
          permissions: keyData.permissions,
          rateLimit: keyData.rate_limit,
          createdAt: keyData.created_at,
          lastUsed: keyData.last_used,
          isActive: keyData.is_active,
          webhookUrl: keyData.webhook_url,
          allowedOrigins: keyData.allowed_origins
        })
      );

      return {
        isValid: true,
        keyData: {
          id: keyData.id,
          key: apiKey,
          name: keyData.name,
          email: keyData.email,
          organization: keyData.organization,
          usage: keyData.usage,
          permissions: keyData.permissions,
          rateLimit: keyData.rate_limit,
          createdAt: keyData.created_at,
          lastUsed: keyData.last_used,
          isActive: keyData.is_active,
          webhookUrl: keyData.webhook_url,
          allowedOrigins: keyData.allowed_origins
        }
      };
    } catch (error) {
      secureLogger.error(`API key validation error: ${String(error)}`);
      return { isValid: false, error: 'Validation error' };
    }
  }

  async getAPIKeyInfo(apiKey: string): Promise<APIKeyData | null> {
    const validation = await this.validateAPIKey(apiKey);
    return validation.isValid ? validation.keyData || null : null;
  }

  async deactivateAPIKey(apiKey: string): Promise<boolean> {
    try {
      const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');
      
      const result = await db.query(
        `UPDATE api_keys SET is_active = false WHERE key_hash = $1`,
        [hashedKey]
      );

      if (result.rowCount > 0) {
        // Remove from cache
        await db.redis.del(`api_key_hash:${hashedKey}`);
        secureLogger.info(`API key deactivated: ${hashedKey.substring(0, 8)}...`);
        return true;
      }

      return false;
    } catch (error) {
      secureLogger.error(`Failed to deactivate API key: ${String(error)}`);
      return false;
    }
  }

  async updateAPIKeyUsage(apiKey: string, usage: 'development' | 'production' | 'testing'): Promise<boolean> {
    try {
      const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');
      
      const result = await db.query(
        `UPDATE api_keys SET usage = $1, rate_limit = $2 WHERE key_hash = $3`,
        [usage, this.getDefaultRateLimit(usage), hashedKey]
      );

      if (result.rowCount > 0) {
        // Update cache
        await db.redis.del(`api_key_hash:${hashedKey}`);
        secureLogger.info(`API key usage updated to ${usage}`);
        return true;
      }

      return false;
    } catch (error) {
      secureLogger.error(`Failed to update API key usage: ${String(error)}`);
      return false;
    }
  }

  async getAPIKeyStats(apiKey: string): Promise<any> {
    try {
      const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');
      
      const result = await db.query(
        `SELECT 
          COUNT(*) as total_requests,
          COUNT(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as requests_24h,
          COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as requests_7d,
          AVG(response_time) as avg_response_time,
          MAX(created_at) as last_request
        FROM api_requests 
        WHERE api_key_hash = $1`,
        [hashedKey]
      );

      return result.rows[0] || {
        total_requests: 0,
        requests_24h: 0,
        requests_7d: 0,
        avg_response_time: 0,
        last_request: null
      };
    } catch (error) {
      secureLogger.error(`Failed to get API key stats: ${String(error)}`);
      return null;
    }
  }

  private generateSecureKey(): string {
    const randomBytes = crypto.randomBytes(32);
    const base64 = randomBytes.toString('base64url');
    return `upp_${base64}`;
  }

  private getDefaultPermissions(usage: string): string[] {
    switch (usage) {
      case 'production':
        return ['payments:read', 'payments:write', 'devices:read', 'devices:write', 'webhooks:read'];
      case 'development':
        return ['payments:read', 'payments:write', 'devices:read', 'devices:write', 'webhooks:read', 'testing:write'];
      case 'testing':
        return ['payments:read', 'devices:read', 'testing:write'];
      default:
        return ['payments:read'];
    }
  }

  private getDefaultRateLimit(usage: string): number {
    switch (usage) {
      case 'production':
        return 1000; // 1000 requests per hour
      case 'development':
        return 500; // 500 requests per hour
      case 'testing':
        return 100; // 100 requests per hour
      default:
        return 100;
    }
  }
}

export const apiKeyManager = APIKeyManager.getInstance();
