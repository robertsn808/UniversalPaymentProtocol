import { secureLogger } from '../shared/logger.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Error classification for different handling strategies
 */
export enum ErrorCategory {
  PAYMENT_PROCESSING = 'payment_processing',
  AUTHENTICATION = 'authentication',
  VALIDATION = 'validation',
  EXTERNAL_SERVICE = 'external_service',
  INTERNAL_SERVER = 'internal_server',
  SECURITY = 'security',
  RATE_LIMITING = 'rate_limiting',
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Standardized error response interface
 */
export interface StandardErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    category: ErrorCategory;
    severity: ErrorSeverity;
    timestamp: string;
    correlationId: string;
    details?: Record<string, any>;
  };
}

/**
 * PCI-compliant error handling utility
 */
export class SecureErrorHandler {
  /**
   * Sanitizes error messages to remove sensitive information
   */
  private static sanitizeErrorMessage(error: any): string {
    if (!error) return 'Unknown error occurred';
    
    const message = error.message || error.toString();
    
    // Remove sensitive patterns that might leak PCI data
    const sensitivePatterns = [
      // Credit card numbers (basic patterns)
      /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
      /\b\d{13,19}\b/g, // Card numbers without separators
      
      // CVV codes
      /\bcvv\s*:?\s*\d{3,4}\b/gi,
      /\bcvc\s*:?\s*\d{3,4}\b/gi,
      
      // API keys and tokens
      /sk_live_[a-zA-Z0-9]+/g,
      /pk_live_[a-zA-Z0-9]+/g,
      /rk_live_[a-zA-Z0-9]+/g,
      
      // Database connection strings with credentials
      /postgresql:\/\/[^:]+:[^@]+@/g,
      /mysql:\/\/[^:]+:[^@]+@/g,
      
      // JWT tokens
      /eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/g,
      
      // Email addresses (for privacy)
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      
      // Phone numbers
      /\b\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    ];
    
    let sanitizedMessage = message;
    sensitivePatterns.forEach(pattern => {
      sanitizedMessage = sanitizedMessage.replace(pattern, '[REDACTED]');
    });
    
    return sanitizedMessage;
  }

  /**
   * Determines error category from error object
   */
  private static categorizeError(error: any): ErrorCategory {
    if (!error) return ErrorCategory.INTERNAL_SERVER;
    
    const message = (error.message || '').toLowerCase();
    const code = error.code || error.statusCode || '';
    
    // Payment-specific errors
    if (message.includes('stripe') || message.includes('payment') || message.includes('card')) {
      return ErrorCategory.PAYMENT_PROCESSING;
    }
    
    // Authentication errors
    if (message.includes('unauthorized') || message.includes('token') || code === 401) {
      return ErrorCategory.AUTHENTICATION;
    }
    
    // Validation errors
    if (message.includes('validation') || message.includes('invalid') || code === 400) {
      return ErrorCategory.VALIDATION;
    }
    
    // Rate limiting
    if (message.includes('rate limit') || code === 429) {
      return ErrorCategory.RATE_LIMITING;
    }
    
    // Security-related errors
    if (message.includes('security') || message.includes('forbidden') || code === 403) {
      return ErrorCategory.SECURITY;
    }
    
    // External service errors
    if (message.includes('timeout') || message.includes('network') || code >= 500) {
      return ErrorCategory.EXTERNAL_SERVICE;
    }
    
    return ErrorCategory.INTERNAL_SERVER;
  }

  /**
   * Determines error severity
   */
  private static assessSeverity(error: any, category: ErrorCategory): ErrorSeverity {
    if (!error) return ErrorSeverity.MEDIUM;
    
    const code = error.code || error.statusCode || 0;
    
    // Critical errors
    if (category === ErrorCategory.SECURITY || 
        category === ErrorCategory.PAYMENT_PROCESSING && code >= 500) {
      return ErrorSeverity.CRITICAL;
    }
    
    // High severity errors
    if (category === ErrorCategory.PAYMENT_PROCESSING || 
        category === ErrorCategory.AUTHENTICATION ||
        code >= 500) {
      return ErrorSeverity.HIGH;
    }
    
    // Medium severity errors
    if (category === ErrorCategory.VALIDATION || 
        category === ErrorCategory.EXTERNAL_SERVICE ||
        code >= 400) {
      return ErrorSeverity.MEDIUM;
    }
    
    return ErrorSeverity.LOW;
  }

  /**
   * Creates a standardized error response with detailed logging
   */
  public static handleError(
    error: any,
    context: {
      operation: string;
      userId?: string;
      deviceId?: string;
      correlationId?: string;
      additionalContext?: Record<string, any>;
    }
  ): StandardErrorResponse {
    const correlationId = context.correlationId || uuidv4();
    const category = this.categorizeError(error);
    const severity = this.assessSeverity(error, category);
    const sanitizedMessage = this.sanitizeErrorMessage(error);
    
    // Log detailed error information securely
    const logData = {
      correlationId,
      operation: context.operation,
      category,
      severity,
      originalError: {
        name: error?.constructor?.name,
        code: error?.code,
        statusCode: error?.statusCode,
        // Don't log the full message - use sanitized version
        sanitizedMessage,
      },
      context: {
        userId: context.userId,
        deviceId: context.deviceId,
        ...context.additionalContext,
      },
      stack: error?.stack ? error.stack.substring(0, 1000) : undefined, // Truncate stack trace
      timestamp: new Date().toISOString(),
    };
    
    // Log based on severity
    switch (severity) {
      case ErrorSeverity.CRITICAL:
        secureLogger.error('Critical error occurred', logData);
        break;
      case ErrorSeverity.HIGH:
        secureLogger.error('High severity error', logData);
        break;
      case ErrorSeverity.MEDIUM:
        secureLogger.warn('Medium severity error', logData);
        break;
      case ErrorSeverity.LOW:
        secureLogger.info('Low severity error', logData);
        break;
    }
    
    // Generate user-friendly error message based on category
    const userMessage = this.generateUserFriendlyMessage(category, error);
    
    return {
      success: false,
      error: {
        code: this.generateErrorCode(category, error),
        message: userMessage,
        category,
        severity,
        timestamp: new Date().toISOString(),
        correlationId,
        // Only include safe details in response
        details: severity === ErrorSeverity.LOW ? {
          suggestion: this.getSuggestionForError(category),
        } : undefined,
      },
    };
  }

  /**
   * Generates user-friendly error messages
   */
  private static generateUserFriendlyMessage(category: ErrorCategory, error: any): string {
    switch (category) {
      case ErrorCategory.PAYMENT_PROCESSING:
        return 'Payment could not be processed at this time. Please try again or contact support.';
      
      case ErrorCategory.AUTHENTICATION:
        return 'Authentication failed. Please check your credentials and try again.';
      
      case ErrorCategory.VALIDATION:
        return 'Invalid input provided. Please check your data and try again.';
      
      case ErrorCategory.RATE_LIMITING:
        return 'Too many requests. Please wait a moment and try again.';
      
      case ErrorCategory.SECURITY:
        return 'Security validation failed. Access denied.';
      
      case ErrorCategory.EXTERNAL_SERVICE:
        return 'External service temporarily unavailable. Please try again later.';
      
      default:
        return 'An unexpected error occurred. Please try again later.';
    }
  }

  /**
   * Generates structured error codes
   */
  private static generateErrorCode(category: ErrorCategory, error: any): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const categoryCode = category.toUpperCase().replace('_', '');
    const errorCode = error?.code || error?.statusCode || 'UNK';
    
    return `${categoryCode}_${errorCode}_${timestamp}`;
  }

  /**
   * Provides suggestions for different error categories
   */
  private static getSuggestionForError(category: ErrorCategory): string {
    switch (category) {
      case ErrorCategory.PAYMENT_PROCESSING:
        return 'Verify payment details and try again';
      case ErrorCategory.AUTHENTICATION:
        return 'Check your login credentials';
      case ErrorCategory.VALIDATION:
        return 'Ensure all required fields are filled correctly';
      case ErrorCategory.RATE_LIMITING:
        return 'Wait a few moments before making another request';
      default:
        return 'Contact support if the problem persists';
    }
  }

  /**
   * Creates a safe error response for production
   */
  public static createSafeResponse(correlationId: string): StandardErrorResponse {
    return {
      success: false,
      error: {
        code: `INTERNAL_SAFE_${Date.now().toString(36).toUpperCase()}`,
        message: 'An error occurred while processing your request',
        category: ErrorCategory.INTERNAL_SERVER,
        severity: ErrorSeverity.MEDIUM,
        timestamp: new Date().toISOString(),
        correlationId,
        details: {
          suggestion: 'Please try again later or contact support',
        },
      },
    };
  }
}