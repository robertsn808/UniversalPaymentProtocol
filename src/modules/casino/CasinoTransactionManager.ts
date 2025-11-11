// Casino Transaction Manager - Business logic for casino payments
// Handles deposits, withdrawals, and balance management

import { secureLogger } from '../../shared/logger.js';
import {
  CasinoDepositRequest,
  CasinoWithdrawalRequest,
  CasinoTransaction,
  CasinoPlayerBalance,
  CasinoTransactionType,
  CasinoPaymentResponse
} from './types.js';
import { PaymentError } from '../../utils/errors.js';
import Stripe from 'stripe';

export class CasinoTransactionManager {
  private stripe: Stripe | null = null;
  private playerBalances: Map<string, CasinoPlayerBalance> = new Map();
  private transactions: Map<string, CasinoTransaction> = new Map();

  constructor(stripeSecretKey?: string) {
    if (stripeSecretKey) {
      this.stripe = new Stripe(stripeSecretKey, {
        apiVersion: '2024-12-18.acacia'
      });
      secureLogger.info('🎰 Casino Transaction Manager initialized with Stripe');
    } else {
      secureLogger.warn('🎰 Casino Transaction Manager running in demo mode (no Stripe)');
    }
  }

  /**
   * Process a casino deposit
   */
  async processDeposit(request: CasinoDepositRequest): Promise<CasinoPaymentResponse> {
    secureLogger.info('🎰 Processing casino deposit', {
      playerId: request.playerId,
      amount: request.amount,
      paymentMethod: request.paymentMethod
    });

    try {
      // Generate transaction ID
      const transactionId = this.generateTransactionId('DEP');

      // Get current balance
      const currentBalance = this.getPlayerBalance(request.playerId, request.currency);

      // Create pending transaction
      const transaction: CasinoTransaction = {
        id: transactionId,
        playerId: request.playerId,
        type: CasinoTransactionType.DEPOSIT,
        amount: request.amount,
        currency: request.currency,
        status: 'pending',
        balanceBefore: currentBalance.totalBalance,
        balanceAfter: currentBalance.totalBalance + request.amount,
        metadata: request.metadata,
        createdAt: new Date()
      };

      this.transactions.set(transactionId, transaction);

      // Process payment based on method
      let paymentIntentId: string | undefined;

      switch (request.paymentMethod) {
        case 'card':
          paymentIntentId = await this.processStripeDeposit(request);
          break;
        case 'crypto':
          paymentIntentId = await this.processCryptoDeposit(request);
          break;
        case 'visa_direct':
          paymentIntentId = await this.processVisaDirectDeposit(request);
          break;
        case 'bank_transfer':
          paymentIntentId = await this.processBankTransferDeposit(request);
          break;
        default:
          throw new PaymentError('Unsupported payment method', {
            method: request.paymentMethod
          });
      }

      // Update transaction with payment intent
      transaction.paymentIntentId = paymentIntentId;
      transaction.status = 'completed';
      transaction.completedAt = new Date();

      // Update player balance
      const newBalance = this.updatePlayerBalance(
        request.playerId,
        request.amount,
        request.currency,
        'deposit'
      );

      transaction.balanceAfter = newBalance.totalBalance;
      this.transactions.set(transactionId, transaction);

      secureLogger.info('🎰 Casino deposit successful', {
        transactionId,
        playerId: request.playerId,
        amount: request.amount,
        newBalance: newBalance.totalBalance
      });

      return {
        success: true,
        transactionId,
        amount: request.amount,
        currency: request.currency,
        newBalance,
        paymentIntentId,
        message: `Deposit of ${request.currency} ${request.amount} successful`
      };
    } catch (error) {
      secureLogger.error('🎰 Casino deposit failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        playerId: request.playerId,
        amount: request.amount
      });

      throw new PaymentError(
        `Deposit failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { playerId: request.playerId }
      );
    }
  }

  /**
   * Process a casino withdrawal
   */
  async processWithdrawal(request: CasinoWithdrawalRequest): Promise<CasinoPaymentResponse> {
    secureLogger.info('🎰 Processing casino withdrawal', {
      playerId: request.playerId,
      amount: request.amount,
      withdrawalMethod: request.withdrawalMethod
    });

    try {
      // Get current balance
      const currentBalance = this.getPlayerBalance(request.playerId, request.currency);

      // Check if player has sufficient balance
      if (currentBalance.realBalance < request.amount) {
        throw new PaymentError('Insufficient balance for withdrawal', {
          requested: request.amount,
          available: currentBalance.realBalance
        });
      }

      // Generate transaction ID
      const transactionId = this.generateTransactionId('WTH');

      // Create pending transaction
      const transaction: CasinoTransaction = {
        id: transactionId,
        playerId: request.playerId,
        type: CasinoTransactionType.WITHDRAWAL,
        amount: request.amount,
        currency: request.currency,
        status: 'pending',
        balanceBefore: currentBalance.totalBalance,
        balanceAfter: currentBalance.totalBalance - request.amount,
        metadata: request.metadata,
        createdAt: new Date()
      };

      this.transactions.set(transactionId, transaction);

      // Process withdrawal based on method
      let paymentIntentId: string | undefined;

      switch (request.withdrawalMethod) {
        case 'bank_transfer':
          paymentIntentId = await this.processBankTransferWithdrawal(request);
          break;
        case 'crypto':
          paymentIntentId = await this.processCryptoWithdrawal(request);
          break;
        case 'visa_direct':
          paymentIntentId = await this.processVisaDirectWithdrawal(request);
          break;
        case 'check':
          paymentIntentId = await this.processCheckWithdrawal(request);
          break;
        default:
          throw new PaymentError('Unsupported withdrawal method', {
            method: request.withdrawalMethod
          });
      }

      // Update transaction
      transaction.paymentIntentId = paymentIntentId;
      transaction.status = 'completed';
      transaction.completedAt = new Date();

      // Update player balance (deduct withdrawal amount)
      const newBalance = this.updatePlayerBalance(
        request.playerId,
        request.amount,
        request.currency,
        'withdrawal'
      );

      transaction.balanceAfter = newBalance.totalBalance;
      this.transactions.set(transactionId, transaction);

      secureLogger.info('🎰 Casino withdrawal successful', {
        transactionId,
        playerId: request.playerId,
        amount: request.amount,
        newBalance: newBalance.totalBalance
      });

      return {
        success: true,
        transactionId,
        amount: request.amount,
        currency: request.currency,
        newBalance,
        paymentIntentId,
        message: `Withdrawal of ${request.currency} ${request.amount} processed`
      };
    } catch (error) {
      secureLogger.error('🎰 Casino withdrawal failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        playerId: request.playerId,
        amount: request.amount
      });

      throw new PaymentError(
        `Withdrawal failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { playerId: request.playerId }
      );
    }
  }

  /**
   * Get player balance
   */
  getPlayerBalance(playerId: string, currency: string = 'USD'): CasinoPlayerBalance {
    let balance = this.playerBalances.get(playerId);

    if (!balance) {
      // Initialize new player balance
      balance = {
        playerId,
        realBalance: 0,
        bonusBalance: 0,
        totalBalance: 0,
        currency,
        pendingWithdrawals: 0,
        lastUpdated: new Date()
      };
      this.playerBalances.set(playerId, balance);
    }

    return balance;
  }

  /**
   * Get player transaction history
   */
  getPlayerTransactions(playerId: string, limit: number = 50): CasinoTransaction[] {
    const playerTransactions = Array.from(this.transactions.values())
      .filter(tx => tx.playerId === playerId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);

    return playerTransactions;
  }

  /**
   * Get transaction by ID
   */
  getTransaction(transactionId: string): CasinoTransaction | undefined {
    return this.transactions.get(transactionId);
  }

  // Private helper methods

  private updatePlayerBalance(
    playerId: string,
    amount: number,
    currency: string,
    type: 'deposit' | 'withdrawal'
  ): CasinoPlayerBalance {
    const balance = this.getPlayerBalance(playerId, currency);

    if (type === 'deposit') {
      balance.realBalance += amount;
      balance.totalBalance += amount;
    } else {
      balance.realBalance -= amount;
      balance.totalBalance -= amount;
    }

    balance.lastUpdated = new Date();
    this.playerBalances.set(playerId, balance);

    return balance;
  }

  private generateTransactionId(prefix: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    return `${prefix}_${timestamp}_${random}`.toUpperCase();
  }

  // Payment method processors

  private async processStripeDeposit(request: CasinoDepositRequest): Promise<string> {
    if (!this.stripe) {
      // Demo mode
      secureLogger.info('🎰 Demo mode: Simulating Stripe deposit');
      return `pi_demo_${Date.now()}`;
    }

    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: Math.round(request.amount * 100), // Convert to cents
      currency: request.currency.toLowerCase(),
      description: `Casino deposit for player ${request.playerId}`,
      metadata: {
        playerId: request.playerId,
        playerEmail: request.playerEmail,
        type: 'casino_deposit',
        ...request.metadata
      }
    });

    return paymentIntent.id;
  }

  private async processCryptoDeposit(request: CasinoDepositRequest): Promise<string> {
    // TODO: Integrate with Bitcoin processor
    secureLogger.info('🎰 Processing crypto deposit', { playerId: request.playerId });
    return `crypto_${Date.now()}`;
  }

  private async processVisaDirectDeposit(request: CasinoDepositRequest): Promise<string> {
    // TODO: Integrate with Visa Direct
    secureLogger.info('🎰 Processing Visa Direct deposit', { playerId: request.playerId });
    return `visa_${Date.now()}`;
  }

  private async processBankTransferDeposit(request: CasinoDepositRequest): Promise<string> {
    secureLogger.info('🎰 Processing bank transfer deposit', { playerId: request.playerId });
    return `bank_${Date.now()}`;
  }

  private async processBankTransferWithdrawal(request: CasinoWithdrawalRequest): Promise<string> {
    secureLogger.info('🎰 Processing bank transfer withdrawal', { playerId: request.playerId });
    return `bank_wth_${Date.now()}`;
  }

  private async processCryptoWithdrawal(request: CasinoWithdrawalRequest): Promise<string> {
    secureLogger.info('🎰 Processing crypto withdrawal', { playerId: request.playerId });
    return `crypto_wth_${Date.now()}`;
  }

  private async processVisaDirectWithdrawal(request: CasinoWithdrawalRequest): Promise<string> {
    secureLogger.info('🎰 Processing Visa Direct withdrawal', { playerId: request.playerId });
    return `visa_wth_${Date.now()}`;
  }

  private async processCheckWithdrawal(request: CasinoWithdrawalRequest): Promise<string> {
    secureLogger.info('🎰 Processing check withdrawal', { playerId: request.playerId });
    return `check_${Date.now()}`;
  }
}

// Export singleton instance
export const casinoTransactionManager = new CasinoTransactionManager(
  process.env.STRIPE_SECRET_KEY
);
