// Casino Payment Routes - API endpoints for casino integration
// RESTful API for deposits, withdrawals, and balance management

import express, { Request, Response } from 'express';
import { secureLogger } from '../../shared/logger.js';
import { asyncHandler, ValidationError } from '../../utils/errors.js';
import { validateInput } from '../../utils/validation.js';
import {
  CasinoDepositSchema,
  CasinoWithdrawalSchema,
  CasinoBalanceCheckSchema,
  CasinoDeviceConfig
} from './types.js';
import { casinoTransactionManager } from './CasinoTransactionManager.js';
import { CasinoDeviceAdapter } from './CasinoDeviceAdapter.js';

const router = express.Router();

// Initialize casino device adapter
const casinoConfig: CasinoDeviceConfig = {
  casinoId: process.env.CASINO_ID || 'casino_001',
  casinoName: process.env.CASINO_NAME || 'Captain Cashout Casino',
  operatorId: process.env.CASINO_OPERATOR_ID || 'operator_001',
  licenseNumber: process.env.CASINO_LICENSE,
  maxDepositAmount: Number(process.env.CASINO_MAX_DEPOSIT) || 50000,
  maxWithdrawalAmount: Number(process.env.CASINO_MAX_WITHDRAWAL) || 100000,
  supportedCurrencies: (process.env.CASINO_CURRENCIES || 'USD,EUR,GBP,CAD').split(','),
  supportedPaymentMethods: ['card', 'crypto', 'bank_transfer', 'visa_direct'],
  kycRequired: process.env.CASINO_KYC_REQUIRED === 'true',
  ageVerificationRequired: true,
  geoRestrictions: (process.env.CASINO_GEO_RESTRICTIONS || '').split(',').filter(Boolean)
};

const casinoAdapter = new CasinoDeviceAdapter(casinoConfig);

/**
 * POST /api/casino/deposit
 * Process a player deposit
 */
router.post(
  '/deposit',
  asyncHandler(async (req: Request, res: Response) => {
    secureLogger.info('🎰 Casino deposit request received', {
      playerId: req.body.playerId,
      amount: req.body.amount
    });

    // Validate request
    const depositRequest = validateInput(CasinoDepositSchema, req.body);

    // Validate against casino rules
    const validation = await casinoAdapter.validateCasinoTransaction(
      depositRequest.amount,
      depositRequest.playerId,
      'deposit'
    );

    if (!validation.valid) {
      throw new ValidationError(validation.reason || 'Deposit validation failed');
    }

    // Process deposit
    const result = await casinoTransactionManager.processDeposit(depositRequest);

    res.status(200).json({
      success: true,
      data: result,
      message: 'Deposit processed successfully'
    });
  })
);

/**
 * POST /api/casino/withdrawal
 * Process a player withdrawal
 */
router.post(
  '/withdrawal',
  asyncHandler(async (req: Request, res: Response) => {
    secureLogger.info('🎰 Casino withdrawal request received', {
      playerId: req.body.playerId,
      amount: req.body.amount
    });

    // Validate request
    const withdrawalRequest = validateInput(CasinoWithdrawalSchema, req.body);

    // Validate against casino rules
    const validation = await casinoAdapter.validateCasinoTransaction(
      withdrawalRequest.amount,
      withdrawalRequest.playerId,
      'withdrawal'
    );

    if (!validation.valid) {
      throw new ValidationError(validation.reason || 'Withdrawal validation failed');
    }

    // Process withdrawal
    const result = await casinoTransactionManager.processWithdrawal(withdrawalRequest);

    res.status(200).json({
      success: true,
      data: result,
      message: 'Withdrawal processed successfully'
    });
  })
);

/**
 * GET /api/casino/balance/:playerId
 * Get player balance
 */
router.get(
  '/balance/:playerId',
  asyncHandler(async (req: Request, res: Response) => {
    const { playerId } = req.params;
    const currency = (req.query.currency as string) || 'USD';

    secureLogger.info('🎰 Casino balance check', { playerId, currency });

    const balance = casinoTransactionManager.getPlayerBalance(playerId, currency);

    res.status(200).json({
      success: true,
      data: balance
    });
  })
);

/**
 * GET /api/casino/transactions/:playerId
 * Get player transaction history
 */
router.get(
  '/transactions/:playerId',
  asyncHandler(async (req: Request, res: Response) => {
    const { playerId } = req.params;
    const limit = Number(req.query.limit) || 50;

    secureLogger.info('🎰 Casino transaction history request', { playerId, limit });

    const transactions = casinoTransactionManager.getPlayerTransactions(playerId, limit);

    res.status(200).json({
      success: true,
      data: {
        playerId,
        transactions,
        count: transactions.length
      }
    });
  })
);

/**
 * GET /api/casino/transaction/:transactionId
 * Get specific transaction details
 */
router.get(
  '/transaction/:transactionId',
  asyncHandler(async (req: Request, res: Response) => {
    const { transactionId } = req.params;

    secureLogger.info('🎰 Casino transaction lookup', { transactionId });

    const transaction = casinoTransactionManager.getTransaction(transactionId);

    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found',
        transactionId
      });
    }

    res.status(200).json({
      success: true,
      data: transaction
    });
  })
);

/**
 * GET /api/casino/config
 * Get casino configuration
 */
router.get(
  '/config',
  asyncHandler(async (req: Request, res: Response) => {
    secureLogger.info('🎰 Casino config request');

    const config = casinoAdapter.getConfig();

    // Return public configuration (remove sensitive data)
    const publicConfig = {
      casinoId: config.casinoId,
      casinoName: config.casinoName,
      maxDepositAmount: config.maxDepositAmount,
      maxWithdrawalAmount: config.maxWithdrawalAmount,
      supportedCurrencies: config.supportedCurrencies,
      supportedPaymentMethods: config.supportedPaymentMethods,
      kycRequired: config.kycRequired,
      ageVerificationRequired: config.ageVerificationRequired
    };

    res.status(200).json({
      success: true,
      data: publicConfig
    });
  })
);

/**
 * GET /api/casino/health
 * Casino service health check
 */
router.get(
  '/health',
  asyncHandler(async (req: Request, res: Response) => {
    const health = {
      status: 'healthy',
      service: 'casino-payment-api',
      timestamp: new Date().toISOString(),
      casinoId: casinoConfig.casinoId,
      casinoName: casinoConfig.casinoName,
      adapters: {
        casino: casinoAdapter.getDeviceId(),
        transactionManager: 'active'
      }
    };

    res.status(200).json(health);
  })
);

/**
 * POST /api/casino/webhook
 * Receive webhooks from payment providers
 */
router.post(
  '/webhook',
  asyncHandler(async (req: Request, res: Response) => {
    secureLogger.info('🎰 Casino webhook received', {
      type: req.body.type,
      source: req.headers['user-agent']
    });

    // TODO: Implement webhook verification and processing
    // This would handle Stripe webhooks, Visa Direct notifications, etc.

    res.status(200).json({
      success: true,
      message: 'Webhook received'
    });
  })
);

export default router;
