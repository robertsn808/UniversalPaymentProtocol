// Stripe Integration for Universal Payment Protocol
// Hawaii-based payment processing! 🌊💳
import Stripe from 'stripe';
export class UPPStripeProcessor {
    constructor() {
        const secretKey = process.env.STRIPE_SECRET_KEY;
        if (!secretKey) {
            throw new Error('STRIPE_SECRET_KEY environment variable is required');
        }
        this.stripe = new Stripe(secretKey, {
            apiVersion: '2025-07-30.basil'
        });
        console.log('💳 Stripe processor initialized for UPP');
    }
    async processDevicePayment(paymentData) {
        try {
            console.log(`💳 Processing ${paymentData.deviceType} payment: $${paymentData.amount}`);
            // Convert amount to cents (Stripe requirement)
            const amountInCents = Math.round(paymentData.amount * 100);
            // Create payment intent
            const paymentIntent = await this.stripe.paymentIntents.create({
                amount: amountInCents,
                currency: 'usd',
                description: paymentData.description,
                metadata: {
                    device_type: paymentData.deviceType,
                    device_id: paymentData.deviceId,
                    upp_payment: 'true',
                    hawaii_processing: 'true',
                    ...paymentData.metadata
                },
                automatic_payment_methods: {
                    enabled: true
                }
            });
            // For demo purposes, we'll auto-confirm the payment
            // In production, this would be handled by the client
            const confirmedPayment = await this.stripe.paymentIntents.confirm(paymentIntent.id, {
                payment_method: 'pm_card_visa', // Test payment method
                return_url: 'https://your-website.com/return'
            });
            const success = confirmedPayment.status === 'succeeded';
            const result = {
                success,
                transaction_id: paymentIntent.id,
                amount: paymentData.amount,
                currency: 'USD',
                status: success ? 'completed' : 'failed',
                receipt_data: {
                    payment_intent_id: paymentIntent.id,
                    amount: paymentData.amount,
                    currency: 'USD',
                    description: paymentData.description,
                    device_type: paymentData.deviceType,
                    timestamp: new Date().toISOString(),
                    hawaii_processed: true
                }
            };
            if (!success) {
                result.error_message = 'Payment confirmation failed';
            }
            console.log(`${success ? '✅' : '❌'} Stripe payment ${success ? 'completed' : 'failed'}: ${paymentIntent.id}`);
            return result;
        }
        catch (error) {
            console.error('💥 Stripe payment error:', error.message);
            return {
                success: false,
                status: 'failed',
                error_message: error.message || 'Payment processing failed'
            };
        }
    }
    async processPayment(request) {
        try {
            console.log(`💳 Processing UPP payment: $${request.amount} ${request.currency}`);
            // Convert amount to cents
            const amountInCents = Math.round(request.amount * 100);
            // Create payment intent
            const paymentIntent = await this.stripe.paymentIntents.create({
                amount: amountInCents,
                currency: request.currency.toLowerCase(),
                description: request.description,
                metadata: {
                    merchant_id: request.merchant_id,
                    upp_protocol: 'true',
                    hawaii_processing: 'true',
                    ...(request.location ? { location: JSON.stringify(request.location) } : {}),
                    ...request.metadata
                },
                automatic_payment_methods: {
                    enabled: true
                }
            });
            // Auto-confirm for demo (in production, client would confirm)
            const confirmedPayment = await this.stripe.paymentIntents.confirm(paymentIntent.id, {
                payment_method: 'pm_card_visa'
            });
            const success = confirmedPayment.status === 'succeeded';
            const result = {
                success,
                transaction_id: paymentIntent.id,
                amount: request.amount,
                currency: request.currency,
                status: success ? 'completed' : 'failed',
                receipt_data: {
                    payment_intent_id: paymentIntent.id,
                    amount: request.amount,
                    currency: request.currency,
                    description: request.description,
                    merchant_id: request.merchant_id,
                    timestamp: new Date().toISOString(),
                    hawaii_processed: true,
                    location: request.location
                }
            };
            if (!success) {
                result.error_message = 'Payment confirmation failed';
            }
            console.log(`${success ? '✅' : '❌'} UPP payment ${success ? 'completed' : 'failed'}: ${paymentIntent.id}`);
            return result;
        }
        catch (error) {
            console.error('💥 UPP payment error:', error.message);
            return {
                success: false,
                status: 'failed',
                error_message: error.message || 'Payment processing failed'
            };
        }
    }
    async createCustomer(email, name, metadata) {
        try {
            const customer = await this.stripe.customers.create({
                email,
                name,
                metadata: {
                    upp_customer: 'true',
                    created_by: 'kai_upp_system',
                    hawaii_based: 'true',
                    ...metadata
                }
            });
            console.log(`👤 Customer created: ${customer.id} (${email})`);
            return customer;
        }
        catch (error) {
            console.error('Customer creation failed:', error);
            throw error;
        }
    }
    async getPaymentStatus(paymentIntentId) {
        try {
            const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
            return {
                id: paymentIntent.id,
                status: paymentIntent.status,
                amount: paymentIntent.amount / 100, // Convert back from cents
                currency: paymentIntent.currency.toUpperCase(),
                description: paymentIntent.description,
                metadata: paymentIntent.metadata
            };
        }
        catch (error) {
            console.error('Failed to retrieve payment status:', error);
            throw error;
        }
    }
    async refundPayment(paymentIntentId, amount) {
        try {
            const refund = await this.stripe.refunds.create({
                payment_intent: paymentIntentId,
                amount: amount ? Math.round(amount * 100) : undefined // Convert to cents if specified
            });
            console.log(`💰 Refund processed: ${refund.id}`);
            return refund;
        }
        catch (error) {
            console.error('Refund failed:', error);
            throw error;
        }
    }
}
// Mock payment gateway for demo/testing when Stripe is not configured
export class MockPaymentGateway {
    async processPayment(request) {
        console.log('🎭 Mock payment processing (Stripe not configured)');
        // Simulate processing delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        // Simulate 90% success rate
        const success = Math.random() > 0.1;
        return {
            success,
            transaction_id: `mock_txn_${Date.now()}`,
            amount: request.amount,
            currency: request.currency,
            status: success ? 'completed' : 'failed',
            error_message: success ? undefined : 'Mock payment failed',
            receipt_data: {
                mock_payment: true,
                amount: request.amount,
                currency: request.currency,
                description: request.description,
                merchant_id: request.merchant_id,
                timestamp: new Date().toISOString()
            }
        };
    }
}
