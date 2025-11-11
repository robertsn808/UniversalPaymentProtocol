<?php

namespace App\Http\Controllers;

use App\Services\UPPPaymentService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;

/**
 * Payment Controller for Casino - UPP Integration
 *
 * This controller handles all payment operations through the UPP system.
 * It's designed to integrate seamlessly with your existing casino platform.
 *
 * Installation:
 * 1. Copy to: app/Http/Controllers/PaymentController.php
 * 2. Add routes to routes/web.php:
 *    Route::post('/deposit', [PaymentController::class, 'deposit'])->middleware('auth');
 *    Route::post('/withdrawal', [PaymentController::class, 'withdrawal'])->middleware('auth');
 *    Route::get('/balance', [PaymentController::class, 'balance'])->middleware('auth');
 *    Route::get('/transactions', [PaymentController::class, 'transactions'])->middleware('auth');
 */
class PaymentController extends Controller
{
    protected $uppService;

    public function __construct(UPPPaymentService $uppService)
    {
        $this->uppService = $uppService;
    }

    /**
     * Process a deposit
     *
     * POST /deposit
     * Body: { amount: 100, currency: "USD", paymentMethod: "card" }
     */
    public function deposit(Request $request)
    {
        // Validate request
        $validator = Validator::make($request->all(), [
            'amount' => 'required|numeric|min:10|max:50000',
            'currency' => 'string|size:3|in:USD,EUR,GBP,CAD',
            'paymentMethod' => 'required|string|in:card,crypto,bank_transfer,visa_direct',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $user = Auth::user();

            // Process deposit through UPP
            $result = $this->uppService->processDeposit(
                playerId: (string) $user->id,
                playerEmail: $user->email,
                amount: (float) $request->amount,
                currency: $request->currency ?? 'USD',
                paymentMethod: $request->paymentMethod,
                metadata: [
                    'username' => $user->username ?? $user->name,
                    'ip_address' => $request->ip(),
                    'user_agent' => $request->userAgent(),
                ]
            );

            if ($result['success']) {
                // Update your local database with the transaction
                $this->recordLocalTransaction($user->id, 'deposit', $result['data']);

                return response()->json([
                    'success' => true,
                    'message' => 'Deposit successful',
                    'data' => [
                        'transactionId' => $result['data']['transactionId'],
                        'amount' => $result['data']['amount'],
                        'newBalance' => $result['data']['newBalance']['totalBalance']
                    ]
                ]);
            } else {
                return response()->json([
                    'success' => false,
                    'error' => $result['error'] ?? 'Deposit failed'
                ], 400);
            }
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'An error occurred processing your deposit'
            ], 500);
        }
    }

    /**
     * Process a withdrawal
     *
     * POST /withdrawal
     * Body: { amount: 50, currency: "USD", withdrawalMethod: "bank_transfer", accountDetails: {...} }
     */
    public function withdrawal(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'amount' => 'required|numeric|min:20|max:100000',
            'currency' => 'string|size:3|in:USD,EUR,GBP,CAD',
            'withdrawalMethod' => 'required|string|in:bank_transfer,crypto,visa_direct,check',
            'accountDetails' => 'array'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $user = Auth::user();

            // Check if user has sufficient local balance
            // This should match your existing casino balance system
            if ($user->balance < $request->amount) {
                return response()->json([
                    'success' => false,
                    'error' => 'Insufficient balance'
                ], 400);
            }

            // Process withdrawal through UPP
            $result = $this->uppService->processWithdrawal(
                playerId: (string) $user->id,
                playerEmail: $user->email,
                amount: (float) $request->amount,
                currency: $request->currency ?? 'USD',
                withdrawalMethod: $request->withdrawalMethod,
                accountDetails: $request->accountDetails ?? [],
                metadata: [
                    'username' => $user->username ?? $user->name,
                    'ip_address' => $request->ip(),
                ]
            );

            if ($result['success']) {
                // Update your local database
                $this->recordLocalTransaction($user->id, 'withdrawal', $result['data']);

                return response()->json([
                    'success' => true,
                    'message' => 'Withdrawal processed successfully',
                    'data' => [
                        'transactionId' => $result['data']['transactionId'],
                        'amount' => $result['data']['amount'],
                        'newBalance' => $result['data']['newBalance']['totalBalance']
                    ]
                ]);
            } else {
                return response()->json([
                    'success' => false,
                    'error' => $result['error'] ?? 'Withdrawal failed'
                ], 400);
            }
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'An error occurred processing your withdrawal'
            ], 500);
        }
    }

    /**
     * Get player balance
     *
     * GET /balance
     */
    public function balance(Request $request)
    {
        try {
            $user = Auth::user();
            $currency = $request->query('currency', 'USD');

            $result = $this->uppService->getPlayerBalance((string) $user->id, $currency);

            if ($result['success']) {
                return response()->json([
                    'success' => true,
                    'data' => $result['data']
                ]);
            } else {
                return response()->json([
                    'success' => false,
                    'error' => 'Failed to retrieve balance'
                ], 500);
            }
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'Balance unavailable'
            ], 500);
        }
    }

    /**
     * Get transaction history
     *
     * GET /transactions?limit=50
     */
    public function transactions(Request $request)
    {
        try {
            $user = Auth::user();
            $limit = (int) $request->query('limit', 50);

            $result = $this->uppService->getPlayerTransactions((string) $user->id, $limit);

            if ($result['success']) {
                return response()->json([
                    'success' => true,
                    'data' => $result['data']
                ]);
            } else {
                return response()->json([
                    'success' => false,
                    'error' => 'Failed to retrieve transactions'
                ], 500);
            }
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'Transactions unavailable'
            ], 500);
        }
    }

    /**
     * UPP Service health check
     *
     * GET /payment/health
     */
    public function health()
    {
        $isHealthy = $this->uppService->healthCheck();

        return response()->json([
            'success' => $isHealthy,
            'service' => 'UPP Payment Gateway',
            'status' => $isHealthy ? 'operational' : 'unavailable'
        ], $isHealthy ? 200 : 503);
    }

    /**
     * Record transaction in local casino database
     * This syncs UPP transactions with your existing casino database
     *
     * @param int $userId
     * @param string $type
     * @param array $data
     * @return void
     */
    protected function recordLocalTransaction(int $userId, string $type, array $data): void
    {
        try {
            // Example: Insert into your existing transactions table
            // Adjust this to match your database schema

            /*
            DB::table('w_transactions')->insert([
                'user_id' => $userId,
                'type' => $type,
                'amount' => $data['amount'],
                'currency' => $data['currency'],
                'transaction_id' => $data['transactionId'],
                'payment_intent_id' => $data['paymentIntentId'] ?? null,
                'status' => 'completed',
                'balance_before' => $data['newBalance']['totalBalance'] - $data['amount'],
                'balance_after' => $data['newBalance']['totalBalance'],
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            // Update user balance
            DB::table('w_users')
                ->where('id', $userId)
                ->update([
                    'balance' => $data['newBalance']['totalBalance'],
                    'updated_at' => now()
                ]);
            */

            \Log::info('Local transaction recorded', [
                'user_id' => $userId,
                'type' => $type,
                'transaction_id' => $data['transactionId']
            ]);
        } catch (\Exception $e) {
            \Log::error('Failed to record local transaction', [
                'error' => $e->getMessage(),
                'user_id' => $userId
            ]);
        }
    }
}
