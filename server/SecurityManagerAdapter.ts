// Security Manager Adapter for Server
// Simplified interface adapter for the security manager

export interface SimpleFraudDetectionResult {
  risk_score: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  flags: string[];
  recommendation: 'approve' | 'review' | 'decline';
  explanation: string;
}

export interface SimpleDeviceFingerprint {
  device_id: string;
  trust_score: number;
  known_device: boolean;
  location_history: any[];
  behavior_pattern: any;
  last_seen: Date;
}

export interface SimpleBiometricData {
  type: string;
  deviceId: string;
  biometricHash: string;
  confidence: number;
  metadata?: any;
}

export interface SimpleBiometricResult {
  success: boolean;
  confidence: number;
  authMethod: string;
  timestamp: string;
  error?: string;
}

export class SecurityManagerAdapter {
  private deviceCache = new Map<string, SimpleDeviceFingerprint>();
  private recentTransactions = new Map<string, number[]>();

  async detectFraud(
    amount: number,
    deviceId: string,
    context: { ipAddress?: string; userAgent?: string }
  ): Promise<SimpleFraudDetectionResult> {
    const flags: string[] = [];
    let riskScore = 0;

    // Amount-based risk assessment
    if (amount > 10000) {
      flags.push('High transaction amount');
      riskScore += 40;
    } else if (amount > 1000) {
      flags.push('Medium transaction amount');
      riskScore += 15;
    }

    // User agent validation
    if (!context.userAgent) {
      flags.push('Missing user agent');
      riskScore += 20;
    } else if (context.userAgent.includes('bot') || context.userAgent.includes('crawler')) {
      flags.push('Suspicious user agent');
      riskScore += 50;
    }

    // Device velocity check
    const deviceTransactions = this.recentTransactions.get(deviceId) || [];
    const now = Date.now();
    const recentCount = deviceTransactions.filter(time => now - time < 300000).length; // 5 minutes

    if (recentCount > 5) {
      flags.push('High transaction velocity');
      riskScore += 30;
    }

    // Update transaction history
    deviceTransactions.push(now);
    this.recentTransactions.set(deviceId, deviceTransactions.slice(-20)); // Keep last 20

    // Risk level determination
    let risk_level: 'low' | 'medium' | 'high' | 'critical';
    if (riskScore >= 80) risk_level = 'critical';
    else if (riskScore >= 60) risk_level = 'high';
    else if (riskScore >= 30) risk_level = 'medium';
    else risk_level = 'low';

    // Recommendation
    let recommendation: 'approve' | 'review' | 'decline';
    if (risk_level === 'critical') recommendation = 'decline';
    else if (risk_level === 'high') recommendation = 'review';
    else recommendation = 'approve';

    return {
      risk_score: riskScore,
      risk_level,
      flags,
      recommendation,
      explanation: `Transaction assessed with ${flags.length} risk factors`
    };
  }

  async attestDevice(
    fingerprint: string,
    context: {
      deviceType?: string;
      capabilities?: string[];
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<SimpleDeviceFingerprint> {
    const cached = this.deviceCache.get(fingerprint);
    
    if (cached) {
      cached.last_seen = new Date();
      return cached;
    }

    // Calculate trust score based on context
    let trustScore = 50; // Base score

    if (context.capabilities && context.capabilities.length > 0) {
      trustScore += 20;
    }

    if (context.userAgent) {
      // Check for legitimate device user agents
      if (context.userAgent.includes('iPhone') || 
          context.userAgent.includes('Android') ||
          context.userAgent.includes('SmartTV') ||
          context.userAgent.includes('PlayStation') ||
          context.userAgent.includes('CarOS')) {
        trustScore += 15;
      }
    }

    if (context.deviceType) {
      // Higher trust for common device types
      const commonTypes = ['smartphone', 'smart_tv', 'gaming_console'];
      if (commonTypes.includes(context.deviceType)) {
        trustScore += 10;
      }
    }

    const deviceFingerprint: SimpleDeviceFingerprint = {
      device_id: fingerprint,
      trust_score: Math.min(trustScore, 100),
      known_device: false,
      location_history: [],
      behavior_pattern: {},
      last_seen: new Date()
    };

    this.deviceCache.set(fingerprint, deviceFingerprint);
    return deviceFingerprint;
  }

  async authenticateBiometric(data: SimpleBiometricData): Promise<SimpleBiometricResult> {
    if (!data.type || !data.deviceId || !data.biometricHash) {
      return {
        success: false,
        confidence: 0,
        authMethod: 'none',
        timestamp: new Date().toISOString(),
        error: 'Invalid biometric data'
      };
    }

    // Simulate biometric validation
    const supportedTypes = ['fingerprint', 'face', 'voice', 'behavioral'];
    
    if (!supportedTypes.includes(data.type)) {
      return {
        success: false,
        confidence: 0,
        authMethod: data.type,
        timestamp: new Date().toISOString(),
        error: `Unsupported biometric type: ${data.type}`
      };
    }

    // Simulate confidence based on type and provided confidence
    let finalConfidence = data.confidence || 0.8;
    
    // Different thresholds for different biometric types
    const thresholds = {
      fingerprint: 0.8,
      face: 0.85,
      voice: 0.75,
      behavioral: 0.7
    };

    const threshold = thresholds[data.type as keyof typeof thresholds] || 0.8;
    const success = finalConfidence >= threshold;

    return {
      success,
      confidence: finalConfidence,
      authMethod: data.type,
      timestamp: new Date().toISOString()
    };
  }
}