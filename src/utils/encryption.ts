// Encryption Utilities - Universal Payment Protocol
// Secure encryption and decryption for sensitive payment data

import crypto from 'crypto';
import { encryptionConfig } from '../config/security.js';

export interface EncryptedData {
  encrypted: string;
  iv: string;
  timestamp: number;
  algorithm: string;
}

export interface DecryptionResult {
  data: any;
  timestamp: number;
  isExpired: boolean;
}

// Main encryption class
export class SecureEncryption {
  private readonly algorithm = 'aes-256-cbc'; // Simplified algorithm
  private readonly keyLength = encryptionConfig.keyLength;
  private readonly ivLength = encryptionConfig.ivLength;
  private readonly maxAge = 24 * 60 * 60 * 1000; // 24 hours

  constructor(private encryptionKey?: string) {
    if (!encryptionKey) {
      this.encryptionKey = process.env.ENCRYPTION_KEY;
    }
    
    if (!this.encryptionKey) {
      throw new Error('Encryption key not provided');
    }

    if (this.encryptionKey.length < this.keyLength) {
      throw new Error(`Encryption key must be at least ${this.keyLength} characters`);
    }
  }

  // Encrypt sensitive data
  encrypt(data: any): EncryptedData {
    try {
      // Convert data to JSON string
      const plaintext = JSON.stringify(data);
      
      // Generate random IV
      const iv = crypto.randomBytes(this.ivLength);
      
      // Create key from the encryption key
      const key = crypto.scryptSync(this.encryptionKey!, 'salt', this.keyLength);
      
      // Create cipher
      const cipher = crypto.createCipher(this.algorithm, key);
      
      // Encrypt the data
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      return {
        encrypted,
        iv: iv.toString('hex'),
        timestamp: Date.now(),
        algorithm: this.algorithm
      };
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  // Decrypt sensitive data
  decrypt(encryptedData: EncryptedData): DecryptionResult {
    try {
      // Check if data is too old
      const age = Date.now() - encryptedData.timestamp;
      const isExpired = age > this.maxAge;
      
      if (isExpired) {
        throw new Error('Encrypted data too old');
      }

      // Create key from the encryption key
      const key = crypto.scryptSync(this.encryptionKey!, 'salt', this.keyLength);
      
      // Create decipher
      const decipher = crypto.createDecipher(
        encryptedData.algorithm,
        key
      );
      
      // Decrypt the data
      let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      // Parse JSON
      const data = JSON.parse(decrypted);
      
      return {
        data,
        timestamp: encryptedData.timestamp,
        isExpired
      };
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  // Encrypt payment card data (PCI DSS compliance)
  encryptPaymentData(paymentData: {
    cardNumber?: string;
    cvv?: string;
    expiryDate?: string;
    cardholderName?: string;
    [key: string]: any;
  }): EncryptedData {
    // Remove or mask sensitive fields before encryption
    const sanitizedData = {
      ...paymentData,
      cardNumber: paymentData.cardNumber ? this.maskCardNumber(paymentData.cardNumber) : undefined,
      cvv: undefined, // Never store CVV
    };

    return this.encrypt(sanitizedData);
  }

  // Encrypt biometric data
  encryptBiometricData(biometricData: {
    hash: string;
    type: string;
    deviceId: string;
    confidence: number;
    [key: string]: any;
  }): EncryptedData {
    return this.encrypt(biometricData);
  }

  // Hash sensitive data (one-way)
  hashSensitiveData(data: string, salt?: string): string {
    const useSalt = salt || crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(data, useSalt, 100000, 64, 'sha512');
    return `${useSalt}:${hash.toString('hex')}`;
  }

  // Verify hashed data
  verifyHashedData(data: string, hashedData: string): boolean {
    try {
      const [salt, hash] = hashedData.split(':');
      const verifyHash = crypto.pbkdf2Sync(data, salt, 100000, 64, 'sha512');
      return hash === verifyHash.toString('hex');
    } catch (error) {
      return false;
    }
  }

  // Generate secure random token
  generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  // Generate cryptographically secure random ID
  generateSecureId(): string {
    const timestamp = Date.now().toString(36);
    const randomBytes = crypto.randomBytes(16).toString('hex');
    return `${timestamp}_${randomBytes}`;
  }

  // Mask credit card number for display
  private maskCardNumber(cardNumber: string): string {
    const cleaned = cardNumber.replace(/\D/g, '');
    if (cleaned.length < 4) return '****';
    
    const lastFour = cleaned.slice(-4);
    const masked = '*'.repeat(cleaned.length - 4) + lastFour;
    
    // Format as XXXX-XXXX-XXXX-1234
    return masked.replace(/(.{4})/g, '$1-').slice(0, -1);
  }
}

// Utility functions
export const createEncryption = (key?: string): SecureEncryption => {
  return new SecureEncryption(key);
};

// Encrypt data with default instance
export const encryptData = (data: any): EncryptedData => {
  const encryption = createEncryption();
  return encryption.encrypt(data);
};

// Decrypt data with default instance
export const decryptData = (encryptedData: EncryptedData): DecryptionResult => {
  const encryption = createEncryption();
  return encryption.decrypt(encryptedData);
};

// Hash password or sensitive string
export const hashPassword = (password: string): string => {
  const encryption = createEncryption();
  return encryption.hashSensitiveData(password);
};

// Verify password hash
export const verifyPassword = (password: string, hash: string): boolean => {
  const encryption = createEncryption();
  return encryption.verifyHashedData(password, hash);
};

// Generate secure API key
export const generateAPIKey = (): string => {
  const encryption = createEncryption();
  return `upp_${encryption.generateSecureToken(32)}`;
};

// Generate secure session token
export const generateSessionToken = (): string => {
  const encryption = createEncryption();
  return encryption.generateSecureToken(48);
};

// Generate transaction ID
export const generateTransactionId = (): string => {
  const encryption = createEncryption();
  return `txn_${encryption.generateSecureId()}`;
};

// Redact sensitive data from logs
export const redactSensitiveData = (data: any): any => {
  const sensitiveFields = [
    'password',
    'cardNumber', 
    'cvv',
    'ssn',
    'apiKey',
    'token',
    'secret',
    'key',
    'authorization',
    'biometricHash'
  ];

  const redactValue = (value: any, key: string): any => {
    if (typeof value === 'string') {
      // Check if key contains sensitive field names
      const isSensitive = sensitiveFields.some(field => 
        key.toLowerCase().includes(field.toLowerCase())
      );
      
      if (isSensitive) {
        return '[REDACTED]';
      }
      
      // Check if value looks like sensitive data
      if (value.length > 10 && /^[a-zA-Z0-9+/=]+$/.test(value)) {
        return '[REDACTED]';
      }
    }
    
    return value;
  };

  const redactObject = (obj: any): any => {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(redactObject);
    }
    
    const redacted: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object' && value !== null) {
        redacted[key] = redactObject(value);
      } else {
        redacted[key] = redactValue(value, key);
      }
    }
    
    return redacted;
  };

  return redactObject(data);
};