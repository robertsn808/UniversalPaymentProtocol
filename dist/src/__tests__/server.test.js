// Server API endpoint tests
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
// Mock Stripe before importing the server
vi.mock('stripe', () => ({
    default: vi.fn().mockImplementation(() => ({
        paymentIntents: {
            create: vi.fn().mockResolvedValue({
                id: 'pi_test_123',
                amount: 2599,
                currency: 'usd',
                status: 'requires_payment_method'
            }),
            confirm: vi.fn().mockResolvedValue({
                id: 'pi_test_123',
                status: 'succeeded'
            })
        }
    }))
}));
describe('UPP Server API', () => {
    let app;
    beforeAll(async () => {
        // Import server after mocking
        const serverModule = await import('../../server/index');
        app = serverModule.default || serverModule.app;
    });
    describe('GET /', () => {
        it('should return welcome message', async () => {
            const response = await request(app)
                .get('/')
                .expect(200);
            expect(response.body).toEqual(expect.objectContaining({
                message: '🌊 Universal Payment Protocol - LIVE!',
                tagline: 'ANY Device + Internet = Payment Terminal',
                version: '1.0.0'
            }));
        });
    });
    describe('GET /health', () => {
        it('should return health status', async () => {
            const response = await request(app)
                .get('/health')
                .expect(200);
            expect(response.body).toEqual(expect.objectContaining({
                status: 'healthy',
                message: 'UPP System ALIVE and MAKING MONEY! 🌊💰'
            }));
        });
    });
    describe('POST /api/process-payment', () => {
        it('should process valid payment request', async () => {
            const paymentRequest = testUtils.createMockPaymentRequest();
            const response = await request(app)
                .post('/api/process-payment')
                .send(paymentRequest)
                .expect(200);
            expect(response.body).toEqual(expect.objectContaining({
                success: true,
                transaction_id: expect.any(String),
                amount: paymentRequest.amount
            }));
        });
        it('should reject invalid payment request', async () => {
            const invalidRequest = {
                amount: -10, // Invalid negative amount
                deviceType: '',
                deviceId: ''
            };
            const response = await request(app)
                .post('/api/process-payment')
                .send(invalidRequest)
                .expect(400);
            expect(response.body).toEqual(expect.objectContaining({
                success: false,
                error: expect.objectContaining({
                    code: 'VALIDATION_ERROR'
                })
            }));
        });
    });
    describe('POST /api/register-device', () => {
        it('should register valid device', async () => {
            const deviceRegistration = testUtils.createMockDeviceRegistration();
            const response = await request(app)
                .post('/api/register-device')
                .send(deviceRegistration)
                .expect(200);
            expect(response.body).toEqual(expect.objectContaining({
                success: true,
                deviceId: expect.any(String),
                message: 'Device registered successfully'
            }));
        });
        it('should reject invalid device registration', async () => {
            const invalidRegistration = {
                deviceType: '', // Invalid empty device type
                capabilities: {},
                fingerprint: ''
            };
            const response = await request(app)
                .post('/api/register-device')
                .send(invalidRegistration)
                .expect(400);
            expect(response.body).toEqual(expect.objectContaining({
                success: false,
                error: expect.objectContaining({
                    code: 'VALIDATION_ERROR'
                })
            }));
        });
    });
    describe('GET /api/device/:deviceId', () => {
        it('should return device status', async () => {
            const response = await request(app)
                .get('/api/device/test_device_123')
                .expect(200);
            expect(response.body).toEqual(expect.objectContaining({
                success: true,
                device: expect.objectContaining({
                    id: 'test_device_123',
                    status: 'active'
                })
            }));
        });
    });
    describe('GET /api/devices', () => {
        it('should return device list', async () => {
            const response = await request(app)
                .get('/api/devices')
                .expect(200);
            expect(response.body).toEqual(expect.objectContaining({
                success: true,
                devices: expect.any(Array)
            }));
        });
    });
    describe('404 handler', () => {
        it('should return 404 for unknown endpoints', async () => {
            const response = await request(app)
                .get('/api/unknown-endpoint')
                .expect(404);
            expect(response.body).toEqual(expect.objectContaining({
                success: false,
                error: 'Not found',
                availableEndpoints: expect.any(Array)
            }));
        });
    });
});
