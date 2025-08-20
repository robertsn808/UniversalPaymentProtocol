// Error handling system for UPP

export class UPPError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): { success: boolean; error: { code: string; message: string; statusCode: number; details?: any } } {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        statusCode: this.statusCode,
        details: this.details
      }
    };
  }
}

export class ValidationError extends UPPError {
  constructor(message: string, field?: string) {
    super(message, 'VALIDATION_ERROR', 400, { field });
  }
}

export class PaymentError extends UPPError {
  constructor(message: string, paymentCode?: string) {
    super(message, 'PAYMENT_ERROR', 402, { paymentCode });
  }
}

export class DeviceError extends UPPError {
  constructor(message: string, deviceId?: string) {
    super(message, 'DEVICE_ERROR', 404, { deviceId });
  }
}

export class AuthenticationError extends UPPError {
  constructor(message: string) {
    super(message, 'AUTHENTICATION_ERROR', 401);
  }
}

export class SecurityError extends UPPError {
  constructor(message: string) {
    super(message, 'SECURITY_ERROR', 403);
  }
}

export class ExternalServiceError extends UPPError {
  constructor(message: string, service?: string) {
    super(message, 'EXTERNAL_SERVICE_ERROR', 502, { service });
  }
}

// Helper factory functions for common error scenarios
export const createDeviceError = (message: string, details?: any) => 
  new UPPError(message, 'DEVICE_ERROR', 400, details);

export const createPaymentError = (message: string, details?: any) => 
  new UPPError(message, 'PAYMENT_ERROR', 400, details);

export const createSecurityError = (message: string, details?: any) => 
  new UPPError(message, 'SECURITY_ERROR', 403, details);

export const createValidationError = (message: string, details?: any) => 
  new UPPError(message, 'VALIDATION_ERROR', 400, details);

export const createConnectionError = (message: string, details?: any) => 
  new UPPError(message, 'CONNECTION_ERROR', 500, details);

// Error handling middleware for Express
export const errorHandler = (error: any, req: any, res: any, _next: any): void => {
  // Log the error
  console.error('💥 Error occurred:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });

  // Handle known UPP errors
  if (error instanceof UPPError) {
    return res.status(error.statusCode).json(error.toJSON());
  }

  // Handle validation errors (Zod)
  if (error.name === 'ZodError') {
    const validationError = new ValidationError('Invalid request data');
    validationError.details = { errors: error.issues };
    return res.status(400).json(validationError.toJSON());
  }

  // Handle generic errors
  const genericError = new UPPError(
    'An unexpected error occurred',
    'INTERNAL_SERVER_ERROR',
    500
  );
  
  res.status(500).json(genericError.toJSON());
};

// Async error wrapper to catch promise rejections
export const asyncHandler = (fn: Function): ((req: any, res: any, next: any) => void) => {
  return (req: any, res: any, next: any): void => {
    void Promise.resolve(fn(req, res, next)).catch(next);
  };
};
