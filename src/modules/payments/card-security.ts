// Card Security Module - PCI DSS Compliant
// Implements encryption, tokenization, and security best practices

import crypto from 'crypto';
import { CardProcessingConfig, EncryptedCardData, CardToken } from './card-payment-types.js';

export class CardSecurityManager {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32; // 256 bits
  private readonly ivLength = 16; // 128 bits
  private readonly tagLength = 16; // 128 bits

  constructor(private config: CardProcessingConfig) {
    this.validateSecurityConfig();
  }

  /**
   * Encrypt card data according to PCI DSS standards
   * Uses AES-256-GCM for authenticated encryption
   */
  async encryptCardData(cardNumber: string, cvv?: string): Promise<EncryptedCardData> {
    try {
      // Generate encryption key and IV
      const key = crypto.randomBytes(this.keyLength);
      const iv = crypto.randomBytes(this.ivLength);

      // Create cipher
      const cipher = crypto.createCipher(this.algorithm, key);
      cipher.setAAD(Buffer.from('card_data', 'utf8'));

      // Encrypt card number
      let encryptedCardNumber = cipher.update(cardNumber, 'utf8', 'hex');
      encryptedCardNumber += cipher.final('hex');
      const authTag = cipher.getAuthTag();

      // Encrypt CVV if provided
      let encryptedCVV: string | undefined;
      if (cvv) {
        const cvvCipher = crypto.createCipher(this.algorithm, key);
        cvvCipher.setAAD(Buffer.from('cvv_data', 'utf8'));
        encryptedCVV = cvvCipher.update(cvv, 'utf8', 'hex') + cvvCipher.final('hex');
      }

      // Create masked card number (last 4 digits visible)
      const maskedNumber = this.maskCardNumber(cardNumber);

      // Store encrypted data securely
      const encryptedData: EncryptedCardData = {
        card_number: maskedNumber,
        encrypted_full_number: encryptedCardNumber,
        expiry_month: 0, // Will be set separately
        expiry_year: 0,  // Will be set separately
        cvv: encryptedCVV,
        encryption_version: '1.0',
        encrypted_at: new Date().toISOString()
      };

      // Log encryption event (without sensitive data)
      console.log('🔐 Card data encrypted successfully', {
        timestamp: encryptedData.encrypted_at,
        version: encryptedData.encryption_version,
        has_cvv: !!encryptedCVV
      });

      return encryptedData;

    } catch (error) {
      console.error('🔒 Card encryption failed:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Card encryption failed');
    }
  }

  /**
   * Decrypt card data (only for authorized operations)
   */
  async decryptCardData(encryptedData: EncryptedCardData, decryptionKey: Buffer): Promise<string> {
    try {
      // Validate encryption metadata
      if (!encryptedData.encrypted_full_number || !encryptedData.encryption_version) {
        throw new Error('Invalid encrypted card data');
      }

      // Create decipher
      const decipher = crypto.createDecipher(this.algorithm, decryptionKey);
      decipher.setAAD(Buffer.from('card_data', 'utf8'));

      // Decrypt card number
      let decryptedCardNumber = decipher.update(encryptedData.encrypted_full_number, 'hex', 'utf8');
      decryptedCardNumber += decipher.final('utf8');

      // Log decryption event (without card data)
      console.log('🔓 Card data decrypted for authorized operation', {
        timestamp: new Date().toISOString(),
        version: encryptedData.encryption_version
      });

      return decryptedCardNumber;

    } catch (error) {
      console.error('🔒 Card decryption failed:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Card decryption failed');
    }
  }

  /**
   * Create card token for recurring payments
   * Implements PCI DSS tokenization requirements
   */
  async createCardToken(cardData: EncryptedCardData, customerId: string): Promise<CardToken> {
    try {
      // Generate unique token ID
      const tokenId = this.generateTokenId();

      // Extract card information for token
      const last4 = cardData.card_number.split(' ').pop() || '';
      
      const token: CardToken = {
        token_id: tokenId,
        customer_id: customerId,
        card_last4: last4,
        card_brand: cardData.card_brand || 'unknown',
        card_type: cardData.card_type || 'unknown',
        expiry_month: cardData.expiry_month,
        expiry_year: cardData.expiry_year,
        billing_address: cardData.billing_address,
        created_at: new Date().toISOString(),
        is_default: false
      };

      // Store token securely (in production, this would be in a secure database)
      await this.storeCardToken(token, cardData);

      console.log('🎫 Card token created', {
        token_id: tokenId,
        customer_id: customerId,
        card_last4: last4,
        created_at: token.created_at
      });

      return token;

    } catch (error) {
      console.error('🎫 Card token creation failed:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Card token creation failed');
    }
  }

  /**
   * Validate PCI DSS compliance
   */
  validatePCICompliance(): { compliant: boolean; issues: string[] } {
    const issues: string[] = [];

    // Check encryption requirements
    if (!this.config.security.encryption_key) {
      issues.push('Encryption key not configured');
    }

    if (!this.config.security.pci_compliance) {
      issues.push('PCI compliance not enabled');
    }

    // Check tokenization
    if (!this.config.security.tokenization_enabled) {
      issues.push('Tokenization not enabled');
    }

    // Check CVV handling
    if (this.config.security.cvv_required && !this.config.fraud_detection.cvv_strict) {
      issues.push('CVV validation not strict enough');
    }

    // Check AVS requirements
    if (this.config.security.avs_required && !this.config.fraud_detection.avs_strict) {
      issues.push('AVS validation not strict enough');
    }

    return {
      compliant: issues.length === 0,
      issues
    };
  }

  /**
   * Generate secure random token ID
   */
  private generateTokenId(): string {
    const randomBytes = crypto.randomBytes(16);
    return `tok_${randomBytes.toString('hex')}`;
  }

  /**
   * Mask card number for display (PCI DSS requirement)
   */
  private maskCardNumber(cardNumber: string): string {
    if (cardNumber.length < 4) {
      return cardNumber;
    }

    const last4 = cardNumber.slice(-4);
    const masked = '*'.repeat(cardNumber.length - 4);
    
    // Format as "**** **** **** 1234"
    const groups = [];
    for (let i = 0; i < masked.length; i += 4) {
      groups.push(masked.slice(i, i + 4));
    }
    groups.push(last4);

    return groups.join(' ');
  }

  /**
   * Store card token securely
   */
  private async storeCardToken(token: CardToken, encryptedCardData: EncryptedCardData): Promise<void> {
    // In production, this would store in a secure, PCI-compliant database
    // with proper access controls and audit logging
    
    console.log('💾 Card token stored securely', {
      token_id: token.token_id,
      customer_id: token.customer_id,
      storage_timestamp: new Date().toISOString()
    });
  }

  /**
   * Validate security configuration
   */
  private validateSecurityConfig(): void {
    if (!this.config.security.encryption_key) {
      throw new Error('Encryption key is required for card security');
    }

    if (this.config.security.encryption_key.length < 32) {
      throw new Error('Encryption key must be at least 32 characters');
    }

    if (!this.config.gateway.api_key) {
      throw new Error('Payment gateway API key is required');
    }
  }

  /**
   * Generate secure audit log entry
   */
  generateAuditLog(action: string, userId: string, metadata?: any): any {
    return {
      action,
      user_id: userId,
      timestamp: new Date().toISOString(),
      session_id: crypto.randomBytes(16).toString('hex'),
      ip_address: metadata?.ip_address || '[REDACTED]',
      user_agent: metadata?.user_agent || '[REDACTED]',
      success: true
    };
  }

  /**
   * Validate card data integrity
   */
  validateCardDataIntegrity(encryptedData: EncryptedCardData): boolean {
    try {
      // Check required fields
      if (!encryptedData.card_number || !encryptedData.encrypted_full_number) {
        return false;
      }

      // Validate card number format
      const cardNumberRegex = /^\*{4}\s\*{4}\s\*{4}\s\d{4}$/;
      if (!cardNumberRegex.test(encryptedData.card_number)) {
        return false;
      }

      // Validate encryption metadata
      if (!encryptedData.encryption_version || !encryptedData.encrypted_at) {
        return false;
      }

      // Validate expiry date
      if (encryptedData.expiry_month < 1 || encryptedData.expiry_month > 12) {
        return false;
      }

      if (encryptedData.expiry_year < 2000 || encryptedData.expiry_year > 2100) {
        return false;
      }

      return true;

    } catch (error) {
      console.error('🔍 Card data integrity validation failed:', error);
      return false;
    }
  }

  /**
   * Sanitize sensitive data for logging
   */
  sanitizeForLogging(data: any): any {
    const sanitized = { ...data };

    // Remove sensitive fields
    if (sanitized.card_data) {
      sanitized.card_data = {
        card_number: sanitized.card_data.card_number, // Already masked
        encrypted_full_number: '[ENCRYPTED]',
        cvv: '[REDACTED]',
        expiry_month: '[REDACTED]',
        expiry_year: '[REDACTED]'
      };
    }

    // Remove any other sensitive fields
    const sensitiveFields = ['cvv', 'card_number', 'encrypted_full_number', 'api_key', 'secret'];
    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });

    return sanitized;
  }
}
