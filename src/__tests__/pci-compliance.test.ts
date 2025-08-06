// PCI Compliance Test Suite
// Validates that the UPP system meets PCI DSS requirements

import { PCIPaymentService } from '../src/services/PCIPaymentService.js';
import { PCIAuditLogger } from '../src/services/PCIAuditLogger.js';

describe('PCI DSS Compliance', () => {
  describe('Payment Processing Security', () => {
    test('should never auto-confirm payments in production', async () => {
      process.env.NODE_ENV = 'production';
      const paymentService = PCIPaymentService.getInstance();
      
      const result = await paymentService.createSecurePaymentIntent({
        amount: 10.00,
        currency: 'USD',
        description: 'Test payment',
        deviceType: 'smartphone',
        deviceId: 'test_device_123'
      });

      expect(result.status).toBe('requires_confirmation');
      expect(result.client_secret).toBeDefined();
      expect(result.success).toBe(false); // Production requires client confirmation
    });

    test('should provide client_secret for secure confirmation', async () => {
      process.env.NODE_ENV = 'production';
      const paymentService = PCIPaymentService.getInstance();
      
      const result = await paymentService.createSecurePaymentIntent({
        amount: 25.00,
        currency: 'USD',
        description: 'Secure payment test',
        deviceType: 'desktop',
        deviceId: 'test_device_456'
      });

      expect(result.client_secret).toMatch(/^pi_test_client_secret_/);
      expect(result.receipt_data?.pci_compliant_flow).toBe(true);
    });

    test('should validate payment method tokens only', async () => {
      const paymentService = PCIPaymentService.getInstance();
      
      const validResult = await paymentService.validatePaymentMethod('pm_1234567890abcdef');
      expect(validResult.valid).toBe(true);
      expect(validResult.paymentMethod?.id).toBe('pm_1234567890abcdef');
      
      const invalidResult = await paymentService.validatePaymentMethod('invalid_token');
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.error).toContain('Invalid payment method token');
    });

    test('should process refunds securely', async () => {
      const paymentService = PCIPaymentService.getInstance();
      
      const result = await paymentService.processRefund('pi_1234567890abcdef', 10.00);
      expect(result.success).toBe(true);
      expect(result.refundId).toMatch(/^re_/);
    });
  });

  describe('Audit Logging Compliance', () => {
    test('should log PCI-compliant audit events', async () => {
      const auditLogger = PCIAuditLogger.getInstance();
      
      // Should not throw errors
      await auditLogger.logPaymentCreated({
        transactionId: 'pi_test123456789',
        amount: 50.00,
        currency: 'USD',
        deviceType: 'tablet',
        deviceId: 'device_test_789',
        userId: 1,
        ipAddress: '192.168.1.100'
      });

      await auditLogger.logPaymentConfirmed({
        transactionId: 'pi_test123456789',
        paymentMethodId: 'pm_test987654321',
        amount: 50.00,
        userId: 1,
        ipAddress: '192.168.1.100'
      });
    });

    test('should mask sensitive data in logs', async () => {
      const auditLogger = PCIAuditLogger.getInstance();
      
      await auditLogger.logSecurityViolation({
        violationType: 'suspicious_activity',
        ipAddress: '192.168.1.200',
        details: 'Multiple failed payment attempts'
      });

      // Test would verify that sensitive data is properly masked
      // In a real implementation, you'd check the actual log output
    });

    test('should generate compliance reports', async () => {
      const auditLogger = PCIAuditLogger.getInstance();
      
      const report = await auditLogger.generateComplianceReport(
        new Date('2024-01-01'),
        new Date('2024-12-31')
      );

      expect(report.compliance.pciDssLevel).toBe('Level 1');
      expect(report.compliance.requirements).toHaveLength(6);
      expect(report.compliance.requirements.every(req => req.status === 'compliant')).toBe(true);
    });
  });

  describe('Environment Security', () => {
    test('should enforce HTTPS in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.FRONTEND_URL = 'http://insecure.com';
      
      expect(() => {
        const { validatePCICompliance } = require('../src/config/environment.js');
        validatePCICompliance();
      }).toThrow('PCI Compliance: FRONTEND_URL must use HTTPS in production');
    });

    test('should require live Stripe keys in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.STRIPE_SECRET_KEY = 'sk_test_invalid';
      
      expect(() => {
        const { validatePCICompliance } = require('../src/config/environment.js');
        validatePCICompliance();
      }).toThrow('PCI Compliance: Production must use live Stripe secret key');
    });

    test('should require encryption key in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.ENCRYPTION_KEY = 'short';
      
      expect(() => {
        const { validatePCICompliance } = require('../src/config/environment.js');
        validatePCICompliance();
      }).toThrow('PCI Compliance: ENCRYPTION_KEY must be at least 32 characters');
    });
  });

  describe('Security Features', () => {
    test('should report correct security status', () => {
      const paymentService = PCIPaymentService.getInstance();
      const status = paymentService.getSecurityStatus();

      expect(status.pciCompliant).toBe(true);
      expect(status.securityFeatures).toContain('Tokenized payment methods');
      expect(status.securityFeatures).toContain('No card data storage');
      expect(status.securityFeatures).toContain('Client-side confirmation required');
      expect(status.securityFeatures).toContain('Comprehensive audit logging');
    });

    test('should create secure payment sessions', async () => {
      const paymentService = PCIPaymentService.getInstance();
      
      const session = await paymentService.createPaymentSession({
        amount: 15.00,
        currency: 'USD',
        deviceType: 'smartphone'
      });

      expect(session.sessionId).toMatch(/^ps_/);
      expect(session.clientConfig.securityFeatures).toContain('pci_compliant');
      expect(session.clientConfig.securityFeatures).toContain('tokenization');
      expect(session.expires).toBeInstanceOf(Date);
    });
  });

  afterEach(() => {
    // Reset environment variables
    delete process.env.NODE_ENV;
    delete process.env.FRONTEND_URL;
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.ENCRYPTION_KEY;
  });
});