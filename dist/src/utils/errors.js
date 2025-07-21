// Error handling system for UPP
export class UPPError extends Error {
    constructor(message, code, statusCode = 500, details) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.details = details;
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
    toJSON() {
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
    constructor(message, field) {
        super(message, 'VALIDATION_ERROR', 400, { field });
    }
}
export class PaymentError extends UPPError {
    constructor(message, paymentCode) {
        super(message, 'PAYMENT_ERROR', 402, { paymentCode });
    }
}
export class DeviceError extends UPPError {
    constructor(message, deviceId) {
        super(message, 'DEVICE_ERROR', 404, { deviceId });
    }
}
export class AuthenticationError extends UPPError {
    constructor(message) {
        super(message, 'AUTHENTICATION_ERROR', 401);
    }
}
export class SecurityError extends UPPError {
    constructor(message) {
        super(message, 'SECURITY_ERROR', 403);
    }
}
export class ExternalServiceError extends UPPError {
    constructor(message, service) {
        super(message, 'EXTERNAL_SERVICE_ERROR', 502, { service });
    }
}
// Error handling middleware for Express
export const errorHandler = (error, req, res, next) => {
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
        validationError.details = { errors: error.errors };
        return res.status(400).json(validationError.toJSON());
    }
    // Handle generic errors
    const genericError = new UPPError('An unexpected error occurred', 'INTERNAL_SERVER_ERROR', 500);
    res.status(500).json(genericError.toJSON());
};
// Error factory functions
export const createPaymentError = (message, details) => {
    return new PaymentError(message, details?.code);
};
export const createDeviceError = (message, deviceId) => {
    return new DeviceError(message, deviceId);
};
export const createValidationError = (message, field) => {
    return new ValidationError(message, field);
};
// Async error wrapper to catch promise rejections
export const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
