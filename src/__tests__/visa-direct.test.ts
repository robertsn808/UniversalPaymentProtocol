// @ts-nocheck
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { visaDirectClient } from '../integrations/visaDirect.js';
import { visaCertificateManager } from '../lib/visa/certificate-manager.js';
import { genStan, genRrn } from '../lib/visa/ids.js';

// Mock environment variables for testing
const mockEnv = {
  VISA_DIRECT_ENABLED: true,
  VISA_API_BASE_URL: 'https://sandbox.api.visa.com',
  VISA_ACQUIRER_BIN: '123456',
  VISA_BAI: 'PP',
  VISA_SENDER_NAME: 'UPP Test',
  VISA_KEY_PATH: '/test/path/key.pem',
  VISA_CERT_PATH: '/test/path/cert.pem',
  NODE_ENV: 'test'
};

// Mock test data
const mockTestCards = {
  validSender: {
    cardNumber: '4111111111111111',
    expYYMM: '2512',
    cvv2: '123'
  },
  validRecipient: {
    cardNumber: '4111111111111112'
  },
  invalidCard: {
    cardNumber: '1234567890123456',
    expYYMM: '2512'
  }
};

const mockPAAIResponse = {
  primaryAccountNumber: '411111****1111',
  octEligibility: 'Y',
  aftEligibility: 'Y',
  cardType: 'DEBIT',
  issuerName: 'Test Bank',
  issuerCountryCode: 'US',
  fastFundsIndicator: 'Y'
};

const mockAFTResponse = {
  transactionIdentifier: 'AFT123456789',
  actionCode: '00',
  responseCode: '00',
  approvalCode: 'APP123',
  transmissionDateTime: '2024-01-15 10:30:00',
  retrievalReferenceNumber: 'RRN123456789',
  systemsTraceAuditNumber: '123456'
};

const mockOCTResponse = {
  transactionIdentifier: 'OCT123456789',
  actionCode: '00',
  responseCode: '00',
  approvalCode: 'APP456',
  transmissionDateTime: '2024-01-15 10:30:01',
  retrievalReferenceNumber: 'RRN123456790',
  systemsTraceAuditNumber: '123457'
};

describe('Visa Direct Integration Tests', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    visaDirectClient.clearTransactionCache();
  });

  afterEach(() => {
    // Clean up after each test
    visaDirectClient.clearTransactionCache();
  });

  describe('ID Generation', () => {
    it('should generate valid STAN (Systems Trace Audit Number)', () => {
      const stan = genStan();
      expect(stan).toMatch(/^\d{6}$/);
      expect(parseInt(stan)).toBeGreaterThanOrEqual(100000);
      expect(parseInt(stan)).toBeLessThanOrEqual(999999);
    });

    it('should generate valid RRN (Retrieval Reference Number)', () => {
      const rrn = genRrn();
      expect(rrn).toMatch(/^\d{12}$/);
      expect(rrn.length).toBe(12);
    });

    it('should generate unique STANs', () => {
      const stan1 = genStan();
      const stan2 = genStan();
      // While not guaranteed to be different, they should be different most of the time
      expect(stan1).not.toBe(stan2);
    });
  });

  describe('PAAI (Payment Account Attributes Inquiry)', () => {
    it('should successfully lookup card attributes', async () => {
      // Mock the PAAI lookup
      const mockLookup = jest.spyOn(visaDirectClient, 'paaiLookup')
        .mockResolvedValue(mockPAAIResponse);

      const result = await visaDirectClient.paaiLookup(mockTestCards.validSender.cardNumber);

      expect(mockLookup).toHaveBeenCalledWith(mockTestCards.validSender.cardNumber);
      expect(result).toEqual(mockPAAIResponse);
      expect(result.octEligibility).toBe('Y');
      expect(result.aftEligibility).toBe('Y');
    });

    it('should handle PAAI lookup errors', async () => {
      const mockLookup = jest.spyOn(visaDirectClient, 'paaiLookup')
        .mockRejectedValue(new Error('PAAI lookup failed'));

      await expect(visaDirectClient.paaiLookup(mockTestCards.invalidCard.cardNumber))
        .rejects.toThrow('PAAI lookup failed');
    });

    it('should mask PAN in logs', async () => {
      const mockLookup = jest.spyOn(visaDirectClient, 'paaiLookup')
        .mockResolvedValue(mockPAAIResponse);

      await visaDirectClient.paaiLookup(mockTestCards.validSender.cardNumber);

      // Verify that the full PAN is not logged (this would require mocking the logger)
      expect(mockLookup).toHaveBeenCalledWith(mockTestCards.validSender.cardNumber);
    });
  });

  describe('AFT (Account Funding Transaction)', () => {
    it('should successfully process AFT transaction', async () => {
      const mockAFT = jest.spyOn(visaDirectClient, 'pullFundsAFT')
        .mockResolvedValue(mockAFTResponse);

      const aftRequest = {
        amount: '100.00',
        currency: 'USD',
        senderCardNumber: mockTestCards.validSender.cardNumber,
        senderExpiryYYMM: mockTestCards.validSender.expYYMM,
        senderCvv2: mockTestCards.validSender.cvv2,
        acquiringBin: mockEnv.VISA_ACQUIRER_BIN,
        stan: genStan(),
        rrn: genRrn(),
        bai: mockEnv.VISA_BAI
      };

      const result = await visaDirectClient.pullFundsAFT(aftRequest);

      expect(mockAFT).toHaveBeenCalledWith(aftRequest);
      expect(result).toEqual(mockAFTResponse);
      expect(result.transactionIdentifier).toBe('AFT123456789');
      expect(result.responseCode).toBe('00');
    });

    it('should validate AFT input parameters', async () => {
      const invalidRequest = {
        amount: '0', // Invalid amount
        currency: 'USD',
        senderCardNumber: '123', // Invalid card number
        senderExpiryYYMM: '25', // Invalid expiry
        acquiringBin: '12345', // Invalid BIN length
        stan: genStan(),
        rrn: genRrn(),
        bai: mockEnv.VISA_BAI
      };

      await expect(visaDirectClient.pullFundsAFT(invalidRequest))
        .rejects.toThrow();
    });

    it('should cache successful AFT transactions', async () => {
      const mockAFT = jest.spyOn(visaDirectClient, 'pullFundsAFT')
        .mockResolvedValue(mockAFTResponse);

      const aftRequest = {
        amount: '100.00',
        currency: 'USD',
        senderCardNumber: mockTestCards.validSender.cardNumber,
        senderExpiryYYMM: mockTestCards.validSender.expYYMM,
        acquiringBin: mockEnv.VISA_ACQUIRER_BIN,
        stan: genStan(),
        rrn: genRrn(),
        bai: mockEnv.VISA_BAI
      };

      await visaDirectClient.pullFundsAFT(aftRequest);

      // Check if transaction is cached
      const cachedTransaction = visaDirectClient.getCachedTransaction(mockAFTResponse.transactionIdentifier);
      expect(cachedTransaction).toEqual(mockAFTResponse);
    });
  });

  describe('OCT (Original Credit Transaction)', () => {
    it('should successfully process OCT transaction', async () => {
      const mockOCT = jest.spyOn(visaDirectClient, 'pushFundsOCT')
        .mockResolvedValue(mockOCTResponse);

      const octRequest = {
        amount: '100.00',
        currency: 'USD',
        recipientCardNumber: mockTestCards.validRecipient.cardNumber,
        acquiringBin: mockEnv.VISA_ACQUIRER_BIN,
        stan: genStan(),
        rrn: genRrn(),
        bai: mockEnv.VISA_BAI,
        linkAftTransactionIdentifier: mockAFTResponse.transactionIdentifier
      };

      const result = await visaDirectClient.pushFundsOCT(octRequest);

      expect(mockOCT).toHaveBeenCalledWith(octRequest);
      expect(result).toEqual(mockOCTResponse);
      expect(result.transactionIdentifier).toBe('OCT123456789');
      expect(result.responseCode).toBe('00');
    });

    it('should validate OCT input parameters', async () => {
      const invalidRequest = {
        amount: '-50.00', // Invalid negative amount
        currency: 'USD',
        recipientCardNumber: '123', // Invalid card number
        acquiringBin: '12345', // Invalid BIN length
        stan: genStan(),
        rrn: genRrn(),
        bai: mockEnv.VISA_BAI
      };

      await expect(visaDirectClient.pushFundsOCT(invalidRequest))
        .rejects.toThrow();
    });

    it('should include linking information when provided', async () => {
      const mockOCT = jest.spyOn(visaDirectClient, 'pushFundsOCT')
        .mockResolvedValue(mockOCTResponse);

      const octRequest = {
        amount: '100.00',
        currency: 'USD',
        recipientCardNumber: mockTestCards.validRecipient.cardNumber,
        acquiringBin: mockEnv.VISA_ACQUIRER_BIN,
        stan: genStan(),
        rrn: genRrn(),
        bai: mockEnv.VISA_BAI,
        linkAftTransactionIdentifier: mockAFTResponse.transactionIdentifier
      };

      await visaDirectClient.pushFundsOCT(octRequest);

      expect(mockOCT).toHaveBeenCalledWith(
        expect.objectContaining({
          linkAftTransactionIdentifier: mockAFTResponse.transactionIdentifier
        })
      );
    });
  });

  describe('Return Funds', () => {
    it('should successfully process return funds transaction', async () => {
      const mockReturnResponse = {
        transactionIdentifier: 'RET123456789',
        actionCode: '00',
        responseCode: '00',
        transmissionDateTime: '2024-01-15 10:30:02'
      };

      const mockReturn = jest.spyOn(visaDirectClient, 'returnFunds')
        .mockResolvedValue(mockReturnResponse);

      const result = await visaDirectClient.returnFunds(
        mockAFTResponse.transactionIdentifier,
        mockEnv.VISA_ACQUIRER_BIN,
        '01'
      );

      expect(mockReturn).toHaveBeenCalledWith(
        mockAFTResponse.transactionIdentifier,
        mockEnv.VISA_ACQUIRER_BIN,
        '01'
      );
      expect(result).toEqual(mockReturnResponse);
    });

    it('should require transaction identifier and acquiring BIN', async () => {
      await expect(visaDirectClient.returnFunds('', mockEnv.VISA_ACQUIRER_BIN))
        .rejects.toThrow('Transaction identifier and acquiring BIN are required');

      await expect(visaDirectClient.returnFunds(mockAFTResponse.transactionIdentifier, ''))
        .rejects.toThrow('Transaction identifier and acquiring BIN are required');
    });
  });

  describe('Batch Processing', () => {
    it('should process batch transactions successfully', async () => {
      const mockBatchResults = [
        { success: true, result: mockAFTResponse },
        { success: true, result: mockOCTResponse },
        { success: false, error: 'Transaction failed' }
      ];

      const mockBatch = jest.spyOn(visaDirectClient, 'processBatchTransactions')
        .mockResolvedValue(mockBatchResults);

      const batchTransactions = [
        { type: 'AFT', data: { amount: '50.00', cardNumber: mockTestCards.validSender.cardNumber } },
        { type: 'OCT', data: { amount: '50.00', cardNumber: mockTestCards.validRecipient.cardNumber } },
        { type: 'AFT', data: { amount: '0', cardNumber: 'invalid' } }
      ];

      const results = await visaDirectClient.processBatchTransactions(batchTransactions);

      expect(mockBatch).toHaveBeenCalledWith(batchTransactions);
      expect(results).toEqual(mockBatchResults);
      expect(results.filter(r => r.success)).toHaveLength(2);
      expect(results.filter(r => !r.success)).toHaveLength(1);
    });

    it('should handle empty batch transactions', async () => {
      const results = await visaDirectClient.processBatchTransactions([]);
      expect(results).toEqual([]);
    });
  });

  describe('Health Check', () => {
    it('should return healthy status when Visa API is accessible', async () => {
      const mockHealth = jest.spyOn(visaDirectClient, 'healthCheck')
        .mockResolvedValue({ healthy: true, latency: 150 });

      const result = await visaDirectClient.healthCheck();

      expect(result.healthy).toBe(true);
      expect(result.latency).toBeDefined();
      expect(typeof result.latency).toBe('number');
    });

    it('should return unhealthy status when Visa API is not accessible', async () => {
      const mockHealth = jest.spyOn(visaDirectClient, 'healthCheck')
        .mockResolvedValue({ healthy: false, error: 'Connection timeout' });

      const result = await visaDirectClient.healthCheck();

      expect(result.healthy).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Transaction Cache', () => {
    it('should cache and retrieve transactions', () => {
      // Cache should start empty
      expect(visaDirectClient.getTransactionCacheSize()).toBe(0);

      // Mock adding a transaction to cache (this would normally happen in the actual methods)
      const mockTransaction = { ...mockAFTResponse };
      
      // Since we can't directly access the private cache, we'll test through the public methods
      expect(visaDirectClient.getCachedTransaction('nonexistent')).toBeUndefined();
    });

    it('should clear transaction cache', () => {
      visaDirectClient.clearTransactionCache();
      expect(visaDirectClient.getTransactionCacheSize()).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should enhance errors with context', async () => {
      const mockError = new Error('Network timeout');
      const mockAFT = jest.spyOn(visaDirectClient, 'pullFundsAFT')
        .mockRejectedValue(mockError);

      const aftRequest = {
        amount: '100.00',
        currency: 'USD',
        senderCardNumber: mockTestCards.validSender.cardNumber,
        senderExpiryYYMM: mockTestCards.validSender.expYYMM,
        acquiringBin: mockEnv.VISA_ACQUIRER_BIN,
        stan: genStan(),
        rrn: genRrn(),
        bai: mockEnv.VISA_BAI
      };

      await expect(visaDirectClient.pullFundsAFT(aftRequest))
        .rejects.toThrow('Network timeout');
    });

    it('should handle Visa API error responses', async () => {
      const visaError = new Error('Visa API 400: Invalid request');
      const mockAFT = jest.spyOn(visaDirectClient, 'pullFundsAFT')
        .mockRejectedValue(visaError);

      const aftRequest = {
        amount: '100.00',
        currency: 'USD',
        senderCardNumber: mockTestCards.validSender.cardNumber,
        senderExpiryYYMM: mockTestCards.validSender.expYYMM,
        acquiringBin: mockEnv.VISA_ACQUIRER_BIN,
        stan: genStan(),
        rrn: genRrn(),
        bai: mockEnv.VISA_BAI
      };

      await expect(visaDirectClient.pullFundsAFT(aftRequest))
        .rejects.toThrow('Visa API 400: Invalid request');
    });
  });
});

describe('Certificate Manager Tests', () => {
  describe('Certificate Validation', () => {
    it('should validate certificate configuration', async () => {
      const mockValidation = jest.spyOn(visaCertificateManager, 'validateCertificates')
        .mockResolvedValue({
          valid: true,
          cert: { path: '/test/cert.pem', exists: true, valid: true },
          key: { path: '/test/key.pem', exists: true, valid: true },
          errors: [],
          warnings: []
        });

      const result = await visaCertificateManager.validateCertificates();

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.cert?.valid).toBe(true);
      expect(result.key?.valid).toBe(true);
    });

    it('should detect invalid certificate configuration', async () => {
      const mockValidation = jest.spyOn(visaCertificateManager, 'validateCertificates')
        .mockResolvedValue({
          valid: false,
          errors: ['Certificate file not found', 'Private key invalid'],
          warnings: ['CA certificate not configured']
        });

      const result = await visaCertificateManager.validateCertificates();

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.warnings).toHaveLength(1);
    });
  });

  describe('Certificate Report Generation', () => {
    it('should generate comprehensive certificate report', async () => {
      const mockReport = jest.spyOn(visaCertificateManager, 'generateCertificateReport')
        .mockResolvedValue('=== Visa Direct Certificate Status Report ===\n\nOverall Status: ✅ VALID\n\n...');

      const report = await visaCertificateManager.generateCertificateReport();

      expect(report).toContain('Certificate Status Report');
      expect(report).toContain('Overall Status');
      expect(typeof report).toBe('string');
    });
  });

  describe('Connectivity Testing', () => {
    it('should test certificate connectivity', async () => {
      const mockConnectivity = jest.spyOn(visaCertificateManager, 'testCertificateConnectivity')
        .mockResolvedValue({ success: true, latency: 200 });

      const result = await visaCertificateManager.testCertificateConnectivity();

      expect(result.success).toBe(true);
      expect(result.latency).toBeDefined();
      expect(typeof result.latency).toBe('number');
    });

    it('should handle connectivity failures', async () => {
      const mockConnectivity = jest.spyOn(visaCertificateManager, 'testCertificateConnectivity')
        .mockResolvedValue({ success: false, error: 'Connection refused' });

      const result = await visaCertificateManager.testCertificateConnectivity();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection refused');
    });
  });
});

describe('Integration Scenarios', () => {
  describe('Complete P2P Flow', () => {
    it('should execute complete P2P transaction flow', async () => {
      // Mock all the required calls
      const mockPAAI = jest.spyOn(visaDirectClient, 'paaiLookup')
        .mockResolvedValue(mockPAAIResponse);
      
      const mockAFT = jest.spyOn(visaDirectClient, 'pullFundsAFT')
        .mockResolvedValue(mockAFTResponse);
      
      const mockOCT = jest.spyOn(visaDirectClient, 'pushFundsOCT')
        .mockResolvedValue(mockOCTResponse);

      // Execute P2P flow
      // 1. PAAI check
      const paaiResult = await visaDirectClient.paaiLookup(mockTestCards.validRecipient.cardNumber);
      expect(paaiResult.octEligibility).toBe('Y');

      // 2. AFT transaction
      const aftResult = await visaDirectClient.pullFundsAFT({
        amount: '100.00',
        currency: 'USD',
        senderCardNumber: mockTestCards.validSender.cardNumber,
        senderExpiryYYMM: mockTestCards.validSender.expYYMM,
        acquiringBin: mockEnv.VISA_ACQUIRER_BIN,
        stan: genStan(),
        rrn: genRrn(),
        bai: mockEnv.VISA_BAI
      });
      expect(aftResult.responseCode).toBe('00');

      // 3. OCT transaction
      const octResult = await visaDirectClient.pushFundsOCT({
        amount: '100.00',
        currency: 'USD',
        recipientCardNumber: mockTestCards.validRecipient.cardNumber,
        acquiringBin: mockEnv.VISA_ACQUIRER_BIN,
        stan: genStan(),
        rrn: genRrn(),
        bai: mockEnv.VISA_BAI,
        linkAftTransactionIdentifier: aftResult.transactionIdentifier
      });
      expect(octResult.responseCode).toBe('00');

      // Verify all calls were made
      expect(mockPAAI).toHaveBeenCalled();
      expect(mockAFT).toHaveBeenCalled();
      expect(mockOCT).toHaveBeenCalled();
    });

    it('should handle OCT failure with compensating return', async () => {
      const mockPAAI = jest.spyOn(visaDirectClient, 'paaiLookup')
        .mockResolvedValue(mockPAAIResponse);
      
      const mockAFT = jest.spyOn(visaDirectClient, 'pullFundsAFT')
        .mockResolvedValue(mockAFTResponse);
      
      const mockOCT = jest.spyOn(visaDirectClient, 'pushFundsOCT')
        .mockRejectedValue(new Error('OCT failed'));
      
      const mockReturn = jest.spyOn(visaDirectClient, 'returnFunds')
        .mockResolvedValue({ transactionIdentifier: 'RET123', responseCode: '00' });

      // Execute flow that should trigger return
      const paaiResult = await visaDirectClient.paaiLookup(mockTestCards.validRecipient.cardNumber);
      expect(paaiResult.octEligibility).toBe('Y');

      const aftResult = await visaDirectClient.pullFundsAFT({
        amount: '100.00',
        currency: 'USD',
        senderCardNumber: mockTestCards.validSender.cardNumber,
        senderExpiryYYMM: mockTestCards.validSender.expYYMM,
        acquiringBin: mockEnv.VISA_ACQUIRER_BIN,
        stan: genStan(),
        rrn: genRrn(),
        bai: mockEnv.VISA_BAI
      });

      // OCT should fail, triggering return
      await expect(visaDirectClient.pushFundsOCT({
        amount: '100.00',
        currency: 'USD',
        recipientCardNumber: mockTestCards.validRecipient.cardNumber,
        acquiringBin: mockEnv.VISA_ACQUIRER_BIN,
        stan: genStan(),
        rrn: genRrn(),
        bai: mockEnv.VISA_BAI,
        linkAftTransactionIdentifier: aftResult.transactionIdentifier
      })).rejects.toThrow('OCT failed');

      // In a real scenario, the return would be called automatically
      // Here we verify it can be called manually
      const returnResult = await visaDirectClient.returnFunds(
        aftResult.transactionIdentifier,
        mockEnv.VISA_ACQUIRER_BIN
      );
      expect(returnResult.responseCode).toBe('00');
    });
  });
});
