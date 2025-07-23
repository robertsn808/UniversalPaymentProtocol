import secureLogger from '../shared/logger.js';
import { db } from '../database/connection';
import { BusinessPaymentRequest } from './PaymentFlowManager';

export interface FraudScore {
  score: number; // 0-100, higher = more suspicious
  level: 'low' | 'medium' | 'high' | 'critical';
  reasons: string[];
  requiresManualReview: boolean;
  shouldBlock: boolean;
}

export interface FraudRule {
  name: string;
  enabled: boolean;
  weight: number;
  check: (request: BusinessPaymentRequest, context: any) => Promise<boolean>;
  description: string;
}

export class FraudDetectionSystem {
  private rules: FraudRule[] = [];
  private riskThresholds = {
    low: 20,
    medium: 40,
    high: 70,
    critical: 85
  };

  constructor() {
    this.initializeFraudRules();
  }

  private initializeFraudRules(): void {
    this.rules = [
      {
        name: 'velocity_check',
        enabled: true,
        weight: 25,
        check: this.checkVelocity.bind(this),
        description: 'Too many transactions in short time period'
      },
      {
        name: 'amount_anomaly',
        enabled: true,
        weight: 20,
        check: this.checkAmountAnomaly.bind(this),
        description: 'Transaction amount is unusual for this device/customer'
      },
      {
        name: 'device_fingerprint',
        enabled: true,
        weight: 15,
        check: this.checkDeviceFingerprint.bind(this),
        description: 'Suspicious device characteristics'
      },
      {
        name: 'location_anomaly',
        enabled: true,
        weight: 20,
        check: this.checkLocationAnomaly.bind(this),
        description: 'Transaction from unusual location'
      },
      {
        name: 'time_pattern',
        enabled: true,
        weight: 10,
        check: this.checkTimePattern.bind(this),
        description: 'Transaction at unusual time'
      },
      {
        name: 'blacklist_check',
        enabled: true,
        weight: 50,
        check: this.checkBlacklist.bind(this),
        description: 'Device/email/IP on blacklist'
      },
      {
        name: 'business_logic',
        enabled: true,
        weight: 15,
        check: this.checkBusinessLogic.bind(this),
        description: 'Violates business-specific rules'
      },
      {
        name: 'ml_risk_score',
        enabled: false, // Disabled until ML model is trained
        weight: 30,
        check: this.checkMLRiskScore.bind(this),
        description: 'Machine learning fraud detection model'
      }
    ];
  }

  async assessFraudRisk(request: BusinessPaymentRequest): Promise<FraudScore> {
    const context = await this.gatherContext(request);
    const scores: { rule: string; score: number; triggered: boolean }[] = [];
    let totalScore = 0;
    const triggeredReasons: string[] = [];

    for (const rule of this.rules) {
      if (!rule.enabled) continue;

      try {
        const triggered = await rule.check(request, context);
        const ruleScore = triggered ? rule.weight : 0;
        
        scores.push({
          rule: rule.name,
          score: ruleScore,
          triggered
        });

        if (triggered) {
          totalScore += ruleScore;
          triggeredReasons.push(rule.description);
        }

      } catch (error) {
        secureLogger.error('Fraud rule execution failed', {
          rule: rule.name,
          error,
          deviceId: request.deviceId
        });
        // Don't fail the entire fraud check for one rule
      }
    }

    // Normalize score to 0-100
    const normalizedScore = Math.min(totalScore, 100);
    
    const fraudScore: FraudScore = {
      score: normalizedScore,
      level: this.determineRiskLevel(normalizedScore),
      reasons: triggeredReasons,
      requiresManualReview: normalizedScore >= this.riskThresholds.high,
      shouldBlock: normalizedScore >= this.riskThresholds.critical
    };

    // Log fraud assessment
    await this.logFraudAssessment(request, fraudScore, scores);

    return fraudScore;
  }

  private async gatherContext(request: BusinessPaymentRequest): Promise<any> {
    // Gather contextual information for fraud analysis
    const [deviceHistory, customerHistory, recentTransactions] = await Promise.all([
      this.getDeviceHistory(request.deviceId),
      request.customerEmail ? this.getCustomerHistory(request.customerEmail) : null,
      this.getRecentTransactions(request.deviceId, 24) // Last 24 hours
    ]);

    return {
      deviceHistory,
      customerHistory,
      recentTransactions,
      timestamp: new Date(),
      requestMetadata: request.metadata || {}
    };
  }

  // Fraud rule implementations
  private async checkVelocity(request: BusinessPaymentRequest, context: any): Promise<boolean> {
    const recentCount = context.recentTransactions.length;
    const hourlyLimit = this.getHourlyLimitForBusinessType(request.businessType);
    
    if (recentCount >= hourlyLimit) {
      secureLogger.warn('Velocity rule triggered', {
        deviceId: request.deviceId,
        recentCount,
        hourlyLimit
      });
      return true;
    }

    // Check for rapid-fire transactions (more than 3 in 5 minutes)
    const rapidTransactions = await this.getRecentTransactions(request.deviceId, 0.083); // 5 minutes
    return rapidTransactions.length > 3;
  }

  private async checkAmountAnomaly(request: BusinessPaymentRequest, context: any): Promise<boolean> {
    if (!context.deviceHistory || context.deviceHistory.averageAmount === 0) {
      // New device - check against business type averages
      const businessAverage = await this.getBusinessTypeAverage(request.businessType);
      return request.amount > businessAverage * 5; // 5x business average
    }

    const deviceAverage = context.deviceHistory.averageAmount;
    const deviation = Math.abs(request.amount - deviceAverage) / deviceAverage;
    
    // Flag if amount is 3x higher than normal for this device
    return deviation > 3;
  }

  private async checkDeviceFingerprint(request: BusinessPaymentRequest, context: any): Promise<boolean> {
    // Check for suspicious device characteristics
    const device = await this.getDeviceInfo(request.deviceId);
    
    if (!device) return true; // Unknown device is suspicious
    
    // Check for device anomalies
    const suspiciousPatterns = [
      device.device_type === 'unknown',
      !device.capabilities || Object.keys(device.capabilities).length === 0,
      device.created_at && new Date(device.created_at) > new Date(Date.now() - 5 * 60 * 1000) // Very recent registration
    ];

    return suspiciousPatterns.some(pattern => pattern);
  }

  private async checkLocationAnomaly(request: BusinessPaymentRequest, context: any): Promise<boolean> {
    // This would integrate with IP geolocation services
    // For now, check if device location changed dramatically
    
    if (!request.metadata?.location) return false;
    
    const previousLocation = context.deviceHistory?.lastLocation;
    if (!previousLocation) return false;

    // Calculate distance (simplified - you'd use proper geolocation)
    const distance = this.calculateDistance(
      request.metadata.location,
      previousLocation
    );

    // Flag if device moved more than 1000km in less than 1 hour
    const timeDiff = Date.now() - new Date(context.deviceHistory.lastTransactionTime).getTime();
    const hoursDiff = timeDiff / (1000 * 60 * 60);
    
    return distance > 1000 && hoursDiff < 1;
  }

  private async checkTimePattern(request: BusinessPaymentRequest, context: any): Promise<boolean> {
    const hour = new Date().getHours();
    
    // Flag transactions at unusual hours (2 AM - 5 AM) for retail/restaurant
    if (['retail', 'restaurant'].includes(request.businessType)) {
      return hour >= 2 && hour <= 5;
    }
    
    return false;
  }

  private async checkBlacklist(request: BusinessPaymentRequest, context: any): Promise<boolean> {
    // Check against blacklisted devices, emails, IPs
    const blacklistChecks = await Promise.all([
      this.isDeviceBlacklisted(request.deviceId),
      request.customerEmail ? this.isEmailBlacklisted(request.customerEmail) : false,
      request.metadata?.ipAddress ? this.isIPBlacklisted(request.metadata.ipAddress) : false
    ]);

    return blacklistChecks.some(check => check);
  }

  private async checkBusinessLogic(request: BusinessPaymentRequest, context: any): Promise<boolean> {
    // Business-specific fraud rules
    switch (request.businessType) {
      case 'gaming':
        // Check for unusual gaming purchase patterns
        return this.checkGamingFraud(request, context);
      
      case 'subscription':
        // Check for subscription fraud patterns
        return this.checkSubscriptionFraud(request, context);
      
      case 'iot':
        // Check for IoT fraud patterns
        return this.checkIoTFraud(request, context);
      
      default:
        return false;
    }
  }

  private async checkMLRiskScore(request: BusinessPaymentRequest, context: any): Promise<boolean> {
    // Placeholder for ML-based fraud detection
    // This would call your trained ML model
    try {
      // const mlScore = await this.mlModel.predict(this.extractFeatures(request, context));
      // return mlScore > 0.7; // 70% fraud probability threshold
      return false; // Disabled for now
    } catch (error) {
      secureLogger.error('ML fraud detection failed', { error });
      return false;
    }
  }

  // Helper methods
  private getHourlyLimitForBusinessType(businessType: string): number {
    const limits: Record<string, number> = {
      'retail': 10,
      'restaurant': 5,
      'service': 3,
      'subscription': 2,
      'gaming': 15,
      'iot': 20
    };
    
    return limits[businessType] || 5;
  }

  private async getRecentTransactions(deviceId: string, hours: number): Promise<any[]> {
    const result = await db.query(`
      SELECT * FROM transactions 
      WHERE device_id = $1 
        AND created_at >= NOW() - INTERVAL '${hours} hours'
      ORDER BY created_at DESC
    `, [deviceId]);
    
    return result.rows;
  }

  private async getDeviceHistory(deviceId: string): Promise<any> {
    const result = await db.query(`
      SELECT 
        COUNT(*) as transaction_count,
        AVG(amount) as average_amount,
        MAX(created_at) as last_transaction_time,
        metadata->>'location' as last_location
      FROM transactions 
      WHERE device_id = $1 AND status = 'completed'
    `, [deviceId]);
    
    return result.rows[0];
  }

  private async getCustomerHistory(email: string): Promise<any> {
    const result = await db.query(`
      SELECT 
        COUNT(*) as transaction_count,
        AVG(amount) as average_amount,
        SUM(amount) as total_amount,
        MIN(created_at) as first_transaction
      FROM transactions 
      WHERE customer_email = $1 AND status = 'completed'
    `, [email]);
    
    return result.rows[0];
  }

  private async getBusinessTypeAverage(businessType: string): Promise<number> {
    const result = await db.query(`
      SELECT AVG(amount) as average_amount
      FROM transactions t
      JOIN devices d ON t.device_id = d.id
      WHERE d.metadata->>'business_type' = $1 
        AND t.status = 'completed'
        AND t.created_at >= NOW() - INTERVAL '30 days'
    `, [businessType]);
    
    return parseFloat(result.rows[0]?.average_amount) || 100;
  }

  private async getDeviceInfo(deviceId: string): Promise<any> {
    const result = await db.query(`
      SELECT * FROM devices WHERE id = $1
    `, [deviceId]);
    
    return result.rows[0];
  }

  private calculateDistance(loc1: any, loc2: any): number {
    // Simplified distance calculation - use proper geolocation library in production
    if (!loc1 || !loc2 || !loc1.lat || !loc1.lng || !loc2.lat || !loc2.lng) {
      return 0;
    }
    
    const R = 6371; // Earth's radius in km
    const dLat = (loc2.lat - loc1.lat) * Math.PI / 180;
    const dLon = (loc2.lng - loc1.lng) * Math.PI / 180;
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(loc1.lat * Math.PI / 180) * Math.cos(loc2.lat * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    
    return R * c;
  }

  private async isDeviceBlacklisted(deviceId: string): Promise<boolean> {
    const result = await db.query(`
      SELECT COUNT(*) as count FROM blacklist 
      WHERE type = 'device' AND value = $1 AND active = true
    `, [deviceId]);
    
    return parseInt(result.rows[0].count) > 0;
  }

  private async isEmailBlacklisted(email: string): Promise<boolean> {
    const result = await db.query(`
      SELECT COUNT(*) as count FROM blacklist 
      WHERE type = 'email' AND value = $1 AND active = true
    `, [email]);
    
    return parseInt(result.rows[0].count) > 0;
  }

  private async isIPBlacklisted(ip: string): Promise<boolean> {
    const result = await db.query(`
      SELECT COUNT(*) as count FROM blacklist 
      WHERE type = 'ip' AND value = $1 AND active = true
    `, [ip]);
    
    return parseInt(result.rows[0].count) > 0;
  }

  private async checkGamingFraud(request: BusinessPaymentRequest, context: any): Promise<boolean> {
    // Gaming-specific fraud patterns
    const todaySpent = await this.getTodaySpending(request.deviceId);
    const unusualSpending = todaySpent > 500; // More than $500 in gaming in one day
    
    return unusualSpending;
  }

  private async checkSubscriptionFraud(request: BusinessPaymentRequest, context: any): Promise<boolean> {
    // Check for subscription signup fraud patterns
    if (!request.customerEmail) return true;
    
    // Check if email has multiple recent subscription attempts
    const recentAttempts = await db.query(`
      SELECT COUNT(*) as count FROM transactions 
      WHERE customer_email = $1 
        AND metadata->>'business_type' = 'subscription'
        AND created_at >= NOW() - INTERVAL '1 hour'
    `, [request.customerEmail]);
    
    return parseInt(recentAttempts.rows[0].count) > 3;
  }

  private async checkIoTFraud(request: BusinessPaymentRequest, context: any): Promise<boolean> {
    // IoT-specific fraud patterns
    if (!request.metadata?.automatedPurchase) return true;
    
    // Check for unusual IoT spending patterns
    const monthlySpent = await this.getMonthlySpending(request.deviceId);
    return monthlySpent > 1000; // More than $1000/month from IoT device
  }

  private async getTodaySpending(deviceId: string): Promise<number> {
    const result = await db.query(`
      SELECT COALESCE(SUM(amount), 0) as today_spent
      FROM transactions 
      WHERE device_id = $1 
        AND DATE(created_at) = CURRENT_DATE
        AND status = 'completed'
    `, [deviceId]);
    
    return parseFloat(result.rows[0].today_spent);
  }

  private async getMonthlySpending(deviceId: string): Promise<number> {
    const result = await db.query(`
      SELECT COALESCE(SUM(amount), 0) as monthly_spent
      FROM transactions 
      WHERE device_id = $1 
        AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)
        AND status = 'completed'
    `, [deviceId]);
    
    return parseFloat(result.rows[0].monthly_spent);
  }

  private determineRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= this.riskThresholds.critical) return 'critical';
    if (score >= this.riskThresholds.high) return 'high';
    if (score >= this.riskThresholds.medium) return 'medium';
    return 'low';
  }

  private async logFraudAssessment(
    request: BusinessPaymentRequest,
    fraudScore: FraudScore,
    ruleScores: any[]
  ): Promise<void> {
    try {
      await db.query(`
        INSERT INTO fraud_assessments (
          device_id, amount, business_type, fraud_score, fraud_level,
          reasons, rule_scores, should_block, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
      `, [
        request.deviceId,
        request.amount,
        request.businessType,
        fraudScore.score,
        fraudScore.level,
        JSON.stringify(fraudScore.reasons),
        JSON.stringify(ruleScores),
        fraudScore.shouldBlock
      ]);
    } catch (error) {
      secureLogger.error('Failed to log fraud assessment', { error });
    }
  }

  // Public methods for rule management
  enableRule(ruleName: string): void {
    const rule = this.rules.find(r => r.name === ruleName);
    if (rule) {
      rule.enabled = true;
      secureLogger.info('Fraud rule enabled', { ruleName });
    }
  }

  disableRule(ruleName: string): void {
    const rule = this.rules.find(r => r.name === ruleName);
    if (rule) {
      rule.enabled = false;
      secureLogger.info('Fraud rule disabled', { ruleName });
    }
  }

  updateRuleWeight(ruleName: string, weight: number): void {
    const rule = this.rules.find(r => r.name === ruleName);
    if (rule) {
      rule.weight = weight;
      secureLogger.info('Fraud rule weight updated', { ruleName, weight });
    }
  }

  getRuleStatus(): Array<{ name: string; enabled: boolean; weight: number }> {
    return this.rules.map(rule => ({
      name: rule.name,
      enabled: rule.enabled,
      weight: rule.weight
    }));
  }
}

export const fraudDetectionSystem = new FraudDetectionSystem();