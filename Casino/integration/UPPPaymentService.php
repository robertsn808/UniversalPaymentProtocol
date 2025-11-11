<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Universal Payment Protocol (UPP) Integration Service
 *
 * This service connects your Laravel casino to the UPP payment system.
 * It handles deposits, withdrawals, and balance management.
 *
 * Installation:
 * 1. Copy this file to: app/Services/UPPPaymentService.php
 * 2. Add to .env:
 *    UPP_API_URL=http://localhost:9000/api/casino
 *    UPP_API_KEY=your_api_key_here
 * 3. Use in controllers: $service = new UPPPaymentService();
 */
class UPPPaymentService
{
    protected $apiUrl;
    protected $apiKey;
    protected $timeout = 30; // 30 seconds timeout

    public function __construct()
    {
        $this->apiUrl = env('UPP_API_URL', 'http://localhost:9000/api/casino');
        $this->apiKey = env('UPP_API_KEY', '');
    }

    /**
     * Process a player deposit
     *
     * @param string $playerId
     * @param string $playerEmail
     * @param float $amount
     * @param string $currency
     * @param string $paymentMethod (card|crypto|bank_transfer|visa_direct)
     * @param array $metadata Optional additional data
     * @return array Response with success status and transaction details
     */
    public function processDeposit(
        string $playerId,
        string $playerEmail,
        float $amount,
        string $currency = 'USD',
        string $paymentMethod = 'card',
        array $metadata = []
    ): array {
        try {
            Log::info('UPP Deposit Request', [
                'player_id' => $playerId,
                'amount' => $amount,
                'method' => $paymentMethod
            ]);

            $response = Http::timeout($this->timeout)
                ->withHeaders($this->getHeaders())
                ->post("{$this->apiUrl}/deposit", [
                    'playerId' => $playerId,
                    'playerEmail' => $playerEmail,
                    'amount' => $amount,
                    'currency' => $currency,
                    'paymentMethod' => $paymentMethod,
                    'metadata' => array_merge($metadata, [
                        'casino_id' => env('CASINO_ID', 'captain_cashout'),
                        'timestamp' => now()->toIso8601String()
                    ])
                ]);

            if ($response->successful()) {
                $data = $response->json();
                Log::info('UPP Deposit Success', ['transaction_id' => $data['data']['transactionId']]);
                return $data;
            } else {
                Log::error('UPP Deposit Failed', [
                    'status' => $response->status(),
                    'body' => $response->body()
                ]);
                return [
                    'success' => false,
                    'error' => $response->json()['error'] ?? 'Deposit failed',
                    'status' => $response->status()
                ];
            }
        } catch (\Exception $e) {
            Log::error('UPP Deposit Exception', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return [
                'success' => false,
                'error' => 'Payment service unavailable: ' . $e->getMessage()
            ];
        }
    }

    /**
     * Process a player withdrawal
     *
     * @param string $playerId
     * @param string $playerEmail
     * @param float $amount
     * @param string $currency
     * @param string $withdrawalMethod (bank_transfer|crypto|visa_direct|check)
     * @param array $accountDetails Bank account, crypto address, etc.
     * @param array $metadata Optional additional data
     * @return array Response with success status and transaction details
     */
    public function processWithdrawal(
        string $playerId,
        string $playerEmail,
        float $amount,
        string $currency = 'USD',
        string $withdrawalMethod = 'bank_transfer',
        array $accountDetails = [],
        array $metadata = []
    ): array {
        try {
            Log::info('UPP Withdrawal Request', [
                'player_id' => $playerId,
                'amount' => $amount,
                'method' => $withdrawalMethod
            ]);

            $requestData = [
                'playerId' => $playerId,
                'playerEmail' => $playerEmail,
                'amount' => $amount,
                'currency' => $currency,
                'withdrawalMethod' => $withdrawalMethod,
                'metadata' => array_merge($metadata, [
                    'casino_id' => env('CASINO_ID', 'captain_cashout'),
                    'timestamp' => now()->toIso8601String()
                ])
            ];

            // Add account details based on withdrawal method
            if (isset($accountDetails['bankAccount'])) {
                $requestData['bankAccount'] = $accountDetails['bankAccount'];
            }
            if (isset($accountDetails['cryptoAddress'])) {
                $requestData['cryptoAddress'] = $accountDetails['cryptoAddress'];
            }
            if (isset($accountDetails['cardNumber'])) {
                $requestData['cardNumber'] = $accountDetails['cardNumber'];
            }

            $response = Http::timeout($this->timeout)
                ->withHeaders($this->getHeaders())
                ->post("{$this->apiUrl}/withdrawal", $requestData);

            if ($response->successful()) {
                $data = $response->json();
                Log::info('UPP Withdrawal Success', ['transaction_id' => $data['data']['transactionId']]);
                return $data;
            } else {
                Log::error('UPP Withdrawal Failed', [
                    'status' => $response->status(),
                    'body' => $response->body()
                ]);
                return [
                    'success' => false,
                    'error' => $response->json()['error'] ?? 'Withdrawal failed',
                    'status' => $response->status()
                ];
            }
        } catch (\Exception $e) {
            Log::error('UPP Withdrawal Exception', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return [
                'success' => false,
                'error' => 'Payment service unavailable: ' . $e->getMessage()
            ];
        }
    }

    /**
     * Get player balance from UPP
     *
     * @param string $playerId
     * @param string $currency
     * @return array Balance information
     */
    public function getPlayerBalance(string $playerId, string $currency = 'USD'): array
    {
        try {
            $response = Http::timeout($this->timeout)
                ->withHeaders($this->getHeaders())
                ->get("{$this->apiUrl}/balance/{$playerId}", [
                    'currency' => $currency
                ]);

            if ($response->successful()) {
                return $response->json();
            } else {
                return [
                    'success' => false,
                    'error' => 'Failed to retrieve balance'
                ];
            }
        } catch (\Exception $e) {
            Log::error('UPP Balance Check Exception', ['error' => $e->getMessage()]);
            return [
                'success' => false,
                'error' => 'Balance check unavailable'
            ];
        }
    }

    /**
     * Get player transaction history
     *
     * @param string $playerId
     * @param int $limit
     * @return array Transaction history
     */
    public function getPlayerTransactions(string $playerId, int $limit = 50): array
    {
        try {
            $response = Http::timeout($this->timeout)
                ->withHeaders($this->getHeaders())
                ->get("{$this->apiUrl}/transactions/{$playerId}", [
                    'limit' => $limit
                ]);

            if ($response->successful()) {
                return $response->json();
            } else {
                return [
                    'success' => false,
                    'error' => 'Failed to retrieve transactions'
                ];
            }
        } catch (\Exception $e) {
            Log::error('UPP Transaction History Exception', ['error' => $e->getMessage()]);
            return [
                'success' => false,
                'error' => 'Transaction history unavailable'
            ];
        }
    }

    /**
     * Get specific transaction details
     *
     * @param string $transactionId
     * @return array Transaction details
     */
    public function getTransaction(string $transactionId): array
    {
        try {
            $response = Http::timeout($this->timeout)
                ->withHeaders($this->getHeaders())
                ->get("{$this->apiUrl}/transaction/{$transactionId}");

            if ($response->successful()) {
                return $response->json();
            } else {
                return [
                    'success' => false,
                    'error' => 'Transaction not found'
                ];
            }
        } catch (\Exception $e) {
            Log::error('UPP Transaction Lookup Exception', ['error' => $e->getMessage()]);
            return [
                'success' => false,
                'error' => 'Transaction lookup unavailable'
            ];
        }
    }

    /**
     * Get casino configuration from UPP
     *
     * @return array Casino configuration
     */
    public function getCasinoConfig(): array
    {
        try {
            $response = Http::timeout($this->timeout)
                ->withHeaders($this->getHeaders())
                ->get("{$this->apiUrl}/config");

            if ($response->successful()) {
                return $response->json();
            } else {
                return [
                    'success' => false,
                    'error' => 'Failed to retrieve configuration'
                ];
            }
        } catch (\Exception $e) {
            Log::error('UPP Config Exception', ['error' => $e->getMessage()]);
            return [
                'success' => false,
                'error' => 'Configuration unavailable'
            ];
        }
    }

    /**
     * Health check for UPP service
     *
     * @return bool True if service is healthy
     */
    public function healthCheck(): bool
    {
        try {
            $response = Http::timeout(5)
                ->withHeaders($this->getHeaders())
                ->get("{$this->apiUrl}/health");

            return $response->successful();
        } catch (\Exception $e) {
            return false;
        }
    }

    /**
     * Get headers for API requests
     *
     * @return array Headers
     */
    protected function getHeaders(): array
    {
        $headers = [
            'Content-Type' => 'application/json',
            'Accept' => 'application/json',
        ];

        if ($this->apiKey) {
            $headers['Authorization'] = 'Bearer ' . $this->apiKey;
        }

        return $headers;
    }
}
