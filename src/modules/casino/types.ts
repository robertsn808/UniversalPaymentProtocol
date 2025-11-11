// Casino Payment Types - Universal Payment Protocol for Gaming
// Handles deposits, withdrawals, and gaming transactions

import { z } from 'zod';

// Casino-specific transaction types
export enum CasinoTransactionType {
  DEPOSIT = 'deposit',
  WITHDRAWAL = 'withdrawal',
  GAME_BET = 'game_bet',
  GAME_WIN = 'game_win',
  BONUS_CREDIT = 'bonus_credit',
  REFUND = 'refund'
}

export enum CasinoPlayerStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  BANNED = 'banned',
  PENDING_VERIFICATION = 'pending_verification'
}

// Zod validation schemas
export const CasinoDepositSchema = z.object({
  playerId: z.string().min(1, 'Player ID is required'),
  playerEmail: z.string().email('Valid email is required'),
  amount: z.number().positive('Amount must be positive').max(50000, 'Maximum deposit is $50,000'),
  currency: z.string().length(3, 'Currency must be 3-letter code (e.g., USD)').default('USD'),
  paymentMethod: z.enum(['card', 'crypto', 'bank_transfer', 'visa_direct']),
  gameId: z.string().optional(),
  sessionId: z.string().optional(),
  metadata: z.record(z.any()).optional()
});

export const CasinoWithdrawalSchema = z.object({
  playerId: z.string().min(1, 'Player ID is required'),
  playerEmail: z.string().email('Valid email is required'),
  amount: z.number().positive('Amount must be positive').max(100000, 'Maximum withdrawal is $100,000'),
  currency: z.string().length(3).default('USD'),
  withdrawalMethod: z.enum(['bank_transfer', 'crypto', 'visa_direct', 'check']),
  bankAccount: z.string().optional(),
  cryptoAddress: z.string().optional(),
  cardNumber: z.string().optional(), // Last 4 digits for Visa Direct
  metadata: z.record(z.any()).optional()
});

export const CasinoGameTransactionSchema = z.object({
  playerId: z.string().min(1),
  gameId: z.string().min(1),
  transactionType: z.nativeEnum(CasinoTransactionType),
  amount: z.number().positive(),
  currency: z.string().length(3).default('USD'),
  gameSessionId: z.string(),
  balanceBefore: z.number(),
  balanceAfter: z.number(),
  metadata: z.record(z.any()).optional()
});

export const CasinoBalanceCheckSchema = z.object({
  playerId: z.string().min(1),
  includeBonus: z.boolean().default(true)
});

// TypeScript types derived from schemas
export type CasinoDepositRequest = z.infer<typeof CasinoDepositSchema>;
export type CasinoWithdrawalRequest = z.infer<typeof CasinoWithdrawalSchema>;
export type CasinoGameTransaction = z.infer<typeof CasinoGameTransactionSchema>;
export type CasinoBalanceCheck = z.infer<typeof CasinoBalanceCheckSchema>;

// Casino Player Balance
export interface CasinoPlayerBalance {
  playerId: string;
  realBalance: number;
  bonusBalance: number;
  totalBalance: number;
  currency: string;
  pendingWithdrawals: number;
  lastUpdated: Date;
}

// Casino Transaction Record
export interface CasinoTransaction {
  id: string;
  playerId: string;
  type: CasinoTransactionType;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  paymentIntentId?: string;
  gameId?: string;
  gameSessionId?: string;
  balanceBefore: number;
  balanceAfter: number;
  metadata?: Record<string, any>;
  createdAt: Date;
  completedAt?: Date;
  errorMessage?: string;
}

// Casino Payment Response
export interface CasinoPaymentResponse {
  success: boolean;
  transactionId: string;
  amount: number;
  currency: string;
  newBalance: CasinoPlayerBalance;
  paymentIntentId?: string;
  message?: string;
  error?: string;
}

// Casino Device Configuration
export interface CasinoDeviceConfig {
  casinoId: string;
  casinoName: string;
  operatorId: string;
  licenseNumber?: string;
  maxDepositAmount: number;
  maxWithdrawalAmount: number;
  supportedCurrencies: string[];
  supportedPaymentMethods: string[];
  kycRequired: boolean;
  ageVerificationRequired: boolean;
  geoRestrictions: string[]; // Country codes
}

// Compliance and KYC
export interface CasinoPlayerKYC {
  playerId: string;
  verified: boolean;
  idVerified: boolean;
  addressVerified: boolean;
  ageVerified: boolean;
  verificationDate?: Date;
  documents: string[];
  riskLevel: 'low' | 'medium' | 'high';
}
