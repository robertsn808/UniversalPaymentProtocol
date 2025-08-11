import { Request, Response, NextFunction } from 'express';

import { db } from '../database/connection';
import secureLogger from '../shared/logger';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  onLimitReached?: (req: Request, res: Response) => void;
}

interface RateLimitRule {
  endpoint: string;
  method?: string;
  config: RateLimitConfig;
  businessType?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export class AdvancedRateLimiter {
  private rules: Map<string, RateLimitRule> = new Map();
  private cleanupInterval: NodeJS.Timeout | undefined;

  constructor() {
    this.initializeRules();
    this.startCleanupProcess();
  }

  private initializeRules(): void {
    // General API rate limits
    this.addRule({
      endpoint: '/api/*',
      config: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 1000,
        keyGenerator: (req) => this.getClientIP(req)
      },
      priority: 'low'
    });

    // Payment processing - strict limits
    this.addRule({
      endpoint: '/api/process-payment',
      method: 'POST',
      config: {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 10,
        keyGenerator: (req) => {
          const deviceId = req.body?.deviceId;
          const ip = this.getClientIP(req);
          return deviceId ? `device:${deviceId}` : `ip:${ip}`;
        },
        onLimitReached: this.handlePaymentRateLimit.bind(this)
      },
      priority: 'critical'
    });

    // Authentication endpoints
    this.addRule({
      endpoint: '/api/auth/login',
      method: 'POST',
      config: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 5,
        keyGenerator: (req) => {
          const email = req.body?.email;
          const ip = this.getClientIP(req);
          return email ? `email:${email}` : `ip:${ip}`;
        },
        skipSuccessfulRequests: true,
        onLimitReached: this.handleAuthRateLimit.bind(this)
      },
      priority: 'high'
    });

    // Device registration
    this.addRule({
      endpoint: '/api/register-device',
      method: 'POST',
      config: {
        windowMs: 60 * 60 * 1000, // 1 hour
        maxRequests: 5,
        keyGenerator: (req) => this.getClientIP(req),
        onLimitReached: this.handleDeviceRegistrationLimit.bind(this)
      },
      priority: 'medium'
    });

    // Business-specific limits
    this.addBusinessSpecificRules();
  }

  private addBusinessSpecificRules(): void {
    // Gaming payments - higher frequency allowed
    this.addRule({
      endpoint: '/api/process-payment',
      method: 'POST',
      businessType: 'gaming',
      config: {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 20,
        keyGenerator: (req) => `device:${req.body?.deviceId}`
      },
      priority: 'medium'
    });

    // IoT payments - very high frequency for automation
    this.addRule({
      endpoint: '/api/process-payment',
      method: 'POST',
      businessType: 'iot',
      config: {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 50,
        keyGenerator: (req) => `device:${req.body?.deviceId}`
      },
      priority: 'low'
    });

    // Service payments - lower frequency, higher value
    this.addRule({
      endpoint: '/api/process-payment',
      method: 'POST',
      businessType: 'service',
      config: {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 3,
        keyGenerator: (req) => `device:${req.body?.deviceId}`
      },
      priority: 'high'
    });
  }

  addRule(rule: RateLimitRule): void {
    const key = this.generateRuleKey(rule);
    this.rules.set(key, rule);
    secureLogger.info('Rate limit rule added', {
      endpoint: rule.endpoint,
      method: rule.method,
      businessType: rule.businessType,
      maxRequests: rule.config.maxRequests,
      windowMs: rule.config.windowMs
    });
  }

  createMiddleware(): (req: Request, res: Response, next: NextFunction) => Promise<void> {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const applicableRules = this.getApplicableRules(req);
        
        for (const rule of applicableRules) {
          const allowed = await this.checkRateLimit(req, rule);
          
          if (!allowed) {
            // Rate limit exceeded
            await this.logSecurityIncident(req, 'rate_limit_exceeded', rule);
            
            res.status(429).json({
              success: false,
              error: 'Rate limit exceeded',
              message: 'Too many requests. Please try again later.',
              retryAfter: Math.ceil(rule.config.windowMs / 1000)
            });
            
            return;
          }
        }
        
        next();
      } catch (error) {
        secureLogger.error('Rate limiter error', { error, path: req.path });
        // Don't block on rate limiter errors
        next();
      }
    };
  }

  private async checkRateLimit(req: Request, rule: RateLimitRule): Promise<boolean> {
    const key = rule.config.keyGenerator(req);
    const windowStart = this.getWindowStart(rule.config.windowMs);
    const identifier = `${rule.endpoint}:${key}`;

    try {
      // Try to increment counter or create new record
      const result = await db.query(`
        INSERT INTO rate_limit_tracking (identifier, endpoint, window_start, request_count)
        VALUES ($1, $2, $3, 1)
        ON CONFLICT (identifier, endpoint, window_start)
        DO UPDATE SET 
          request_count = rate_limit_tracking.request_count + 1,
          updated_at = CURRENT_TIMESTAMP
        RETURNING request_count
      `, [identifier, rule.endpoint, windowStart]);

      const currentCount = parseInt(result.rows[0].request_count);
      
      if (currentCount > rule.config.maxRequests) {
        // Rate limit exceeded
        if (rule.config.onLimitReached) {
          rule.config.onLimitReached(req, {} as Response);
        }
        
        secureLogger.warn('Rate limit exceeded', {
          identifier,
          endpoint: rule.endpoint,
          currentCount,
          maxRequests: rule.config.maxRequests,
          windowStart
        });
        
        return false;
      }

      return true;
    } catch (error) {
      secureLogger.error('Rate limit check failed', { error, identifier });
      // Allow request on database errors
      return true;
    }
  }

  private getApplicableRules(req: Request): RateLimitRule[] {
    const rules: RateLimitRule[] = [];
    const path = req.path;
    const method = req.method;
    const businessType = req.body?.businessType;

    for (const [key, rule] of this.rules) {
      // Check if rule applies to this request
      if (this.matchesPattern(path, rule.endpoint)) {
        if (rule.method && rule.method !== method) continue;
        if (rule.businessType && rule.businessType !== businessType) continue;
        
        rules.push(rule);
      }
    }

    // Sort by priority (critical first)
    return rules.sort((a, b) => {
      const priorities = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorities[b.priority] - priorities[a.priority];
    });
  }

  private matchesPattern(path: string, pattern: string): boolean {
    // Convert pattern to regex
    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(path);
  }

  private generateRuleKey(rule: RateLimitRule): string {
    return `${rule.endpoint}:${rule.method || '*'}:${rule.businessType || '*'}`;
  }

  private getWindowStart(windowMs: number): Date {
    const now = Date.now();
    const windowStart = Math.floor(now / windowMs) * windowMs;
    return new Date(windowStart);
  }

  private getClientIP(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'] as string;
    const realIP = req.headers['x-real-ip'] as string;
    
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }
    if (realIP) {
      return realIP;
    }
    
    return req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
  }

  private async handlePaymentRateLimit(req: Request, res: Response): Promise<void> {
    await this.logSecurityIncident(req, 'payment_rate_limit_exceeded');
    
    // Additional security measures for payment rate limits
    const deviceId = req.body?.deviceId;
    if (deviceId) {
      await this.temporarilyBlockDevice(deviceId, 5 * 60 * 1000); // 5 minutes
    }
  }

  private async handleAuthRateLimit(req: Request, res: Response): Promise<void> {
    await this.logSecurityIncident(req, 'auth_rate_limit_exceeded');
    
    // Additional security for auth attempts
    const email = req.body?.email;
    if (email) {
      await this.reportSuspiciousActivity(email, 'multiple_login_attempts');
    }
  }

  private async handleDeviceRegistrationLimit(req: Request, res: Response): Promise<void> {
    await this.logSecurityIncident(req, 'device_registration_rate_limit_exceeded');
    
    // Block IP from device registration for 1 hour
    const ip = this.getClientIP(req);
    await this.temporarilyBlockIP(ip, 60 * 60 * 1000); // 1 hour
  }

  private async logSecurityIncident(
    req: Request, 
    incidentType: string, 
    rule?: RateLimitRule
  ): Promise<void> {
    try {
      await db.query(`
        INSERT INTO security_incidents (
          incident_type, severity, description, metadata, 
          device_id, ip_address, user_agent
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        incidentType,
        rule?.priority || 'medium',
        `Rate limit exceeded for ${req.path}`,
        JSON.stringify({
          endpoint: req.path,
          method: req.method,
          rule: rule ? {
            endpoint: rule.endpoint,
            maxRequests: rule.config.maxRequests,
            windowMs: rule.config.windowMs
          } : null,
          timestamp: new Date().toISOString()
        }),
        req.body?.deviceId || null,
        this.getClientIP(req),
        req.get('User-Agent') || null
      ]);
    } catch (error) {
      secureLogger.error('Failed to log security incident', { error });
    }
  }

  private async temporarilyBlockDevice(deviceId: string, durationMs: number): Promise<void> {
    const expiresAt = new Date(Date.now() + durationMs);
    
    try {
      await db.query(`
        INSERT INTO blacklist (type, value, reason, expires_at, active)
        VALUES ('device', $1, 'Temporary block for rate limit violation', $2, true)
        ON CONFLICT (type, value) 
        DO UPDATE SET expires_at = $2, active = true
      `, [deviceId, expiresAt]);
      
      secureLogger.warn('Device temporarily blocked', { deviceId, expiresAt });
    } catch (error) {
      secureLogger.error('Failed to block device', { error, deviceId });
    }
  }

  private async temporarilyBlockIP(ip: string, durationMs: number): Promise<void> {
    const expiresAt = new Date(Date.now() + durationMs);
    
    try {
      await db.query(`
        INSERT INTO blacklist (type, value, reason, expires_at, active)
        VALUES ('ip', $1, 'Temporary block for rate limit violation', $2, true)
        ON CONFLICT (type, value) 
        DO UPDATE SET expires_at = $2, active = true
      `, [ip, expiresAt]);
      
      secureLogger.warn('IP temporarily blocked', { ip, expiresAt });
    } catch (error) {
      secureLogger.error('Failed to block IP', { error, ip });
    }
  }

  private async reportSuspiciousActivity(identifier: string, activity: string): Promise<void> {
    secureLogger.warn('Suspicious activity detected', { identifier, activity });
    // You could integrate with external security services here
  }

  private startCleanupProcess(): void {
    // Clean up old rate limit records every hour
    this.cleanupInterval = setInterval(async () => {
      try {
        await this.cleanupOldRecords();
      } catch (error) {
        secureLogger.error('Rate limit cleanup failed', { error });
      }
    }, 60 * 60 * 1000); // 1 hour
  }

  private async cleanupOldRecords(): Promise<void> {
    // Remove records older than 24 hours
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const result = await db.query(`
      DELETE FROM rate_limit_tracking 
      WHERE window_start < $1
    `, [cutoff]);
    
    secureLogger.info('Rate limit records cleaned up', { 
      deletedRecords: result.rowCount 
    });

    // Clean up expired blacklist entries
    const blacklistResult = await db.query(`
      UPDATE blacklist 
      SET active = false 
      WHERE expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP AND active = true
    `);
    
    if (blacklistResult.rowCount > 0) {
      secureLogger.info('Expired blacklist entries deactivated', { 
        count: blacklistResult.rowCount 
      });
    }
  }

  // Public methods for monitoring and management
  async getRateLimitStats(): Promise<any> {
    const result = await db.query(`
      SELECT 
        endpoint,
        COUNT(*) as total_requests,
        COUNT(CASE WHEN request_count > 10 THEN 1 END) as high_usage_windows,
        MAX(request_count) as max_requests_in_window,
        AVG(request_count) as avg_requests_in_window
      FROM rate_limit_tracking 
      WHERE window_start >= NOW() - INTERVAL '24 hours'
      GROUP BY endpoint
      ORDER BY total_requests DESC
    `);
    
    return result.rows;
  }

  async getSecurityIncidents(hours: number = 24): Promise<any> {
    const result = await db.query(`
      SELECT 
        incident_type,
        severity,
        COUNT(*) as count,
        MAX(created_at) as latest_incident
      FROM security_incidents 
      WHERE created_at >= NOW() - INTERVAL '${hours} hours'
      GROUP BY incident_type, severity
      ORDER BY count DESC
    `);
    
    return result.rows;
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

export const advancedRateLimiter = new AdvancedRateLimiter();