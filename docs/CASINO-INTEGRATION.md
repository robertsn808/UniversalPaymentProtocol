# 🎰 Casino Integration Guide - Universal Payment Protocol

Complete guide to integrating your casino platform with UPP payment processing.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Quick Start](#quick-start)
4. [API Reference](#api-reference)
5. [Laravel Integration](#laravel-integration)
6. [Testing](#testing)
7. [Production Deployment](#production-deployment)
8. [Troubleshooting](#troubleshooting)

---

## Overview

The Universal Payment Protocol (UPP) provides a complete payment infrastructure for your casino platform. It handles:

- ✅ **Player Deposits** - Credit card, crypto, bank transfers, Visa Direct
- ✅ **Player Withdrawals** - Multiple payout methods with fraud detection
- ✅ **Balance Management** - Real-time balance tracking and synchronization
- ✅ **Transaction History** - Complete audit trail of all transactions
- ✅ **Security** - PCI-compliant payment processing with encryption
- ✅ **Multi-currency** - Support for USD, EUR, GBP, CAD, and more

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Your Laravel Casino                        │
│  ┌──────────────┐      ┌──────────────┐                    │
│  │    Player    │──────▶│ Payment UI   │                    │
│  │  Interface   │      │  (Blade)     │                    │
│  └──────────────┘      └──────┬───────┘                    │
│                               │                              │
│                               ▼                              │
│  ┌────────────────────────────────────────────────┐        │
│  │   PaymentController (Laravel)                   │        │
│  │   - Validates requests                          │        │
│  │   - Calls UPP API                               │        │
│  │   - Updates local database                      │        │
│  └────────────────┬───────────────────────────────┘        │
│                   │                                          │
└───────────────────┼──────────────────────────────────────────┘
                    │ HTTP/JSON
                    │
┌───────────────────▼──────────────────────────────────────────┐
│              Universal Payment Protocol (UPP)                │
│  ┌──────────────────────────────────────────────────┐      │
│  │   Casino API Routes                               │      │
│  │   /api/casino/deposit                             │      │
│  │   /api/casino/withdrawal                          │      │
│  │   /api/casino/balance/:playerId                   │      │
│  │   /api/casino/transactions/:playerId              │      │
│  └────────────────┬─────────────────────────────────┘      │
│                   │                                          │
│  ┌────────────────▼─────────────────────────────────┐      │
│  │   Casino Transaction Manager                      │      │
│  │   - Business logic                                │      │
│  │   - Balance calculations                          │      │
│  │   - Transaction validation                        │      │
│  └────────────────┬─────────────────────────────────┘      │
│                   │                                          │
│  ┌────────────────▼─────────────────────────────────┐      │
│  │   Payment Processors                              │      │
│  │   ├─ Stripe (Cards)                               │      │
│  │   ├─ Visa Direct (P2P)                            │      │
│  │   ├─ Bitcoin (Crypto)                             │      │
│  │   └─ Bank Transfers                               │      │
│  └───────────────────────────────────────────────────┘      │
└──────────────────────────────────────────────────────────────┘
```

---

## Quick Start

### Step 1: Start the UPP Server

```bash
cd /home/user/UniversalPaymentProtocol

# Install dependencies (if not already done)
npm install

# Configure environment
cp .env.example .env
nano .env
```

Add to your `.env`:
```env
# Casino Configuration
CASINO_ID=captain_cashout
CASINO_NAME=Captain Cashout Casino
CASINO_OPERATOR_ID=operator_001
CASINO_MAX_DEPOSIT=50000
CASINO_MAX_WITHDRAWAL=100000
CASINO_CURRENCIES=USD,EUR,GBP,CAD
CASINO_KYC_REQUIRED=true

# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_stripe_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key

# Server Configuration
PORT=9000
NODE_ENV=development
```

```bash
# Start the server
npm run dev
```

The UPP API will be available at: `http://localhost:9000/api/casino`

### Step 2: Install PHP Integration Files

Copy the integration files to your Laravel casino:

```bash
# From the UPP directory
cp Casino/integration/UPPPaymentService.php /path/to/your/casino/app/Services/
cp Casino/integration/PaymentController.php /path/to/your/casino/app/Http/Controllers/
```

### Step 3: Configure Laravel Casino

Add to your Laravel `.env`:
```env
UPP_API_URL=http://localhost:9000/api/casino
UPP_API_KEY=your_api_key_here
CASINO_ID=captain_cashout
```

### Step 4: Add Routes

In `routes/web.php`:
```php
use App\Http\Controllers\PaymentController;

Route::middleware(['auth'])->group(function () {
    Route::post('/deposit', [PaymentController::class, 'deposit']);
    Route::post('/withdrawal', [PaymentController::class, 'withdrawal']);
    Route::get('/balance', [PaymentController::class, 'balance']);
    Route::get('/transactions', [PaymentController::class, 'transactions']);
});

Route::get('/payment/health', [PaymentController::class, 'health']);
```

### Step 5: Test the Integration

```bash
# Check UPP health
curl http://localhost:9000/api/casino/health

# Test deposit (from your casino frontend)
curl -X POST http://localhost:9000/api/casino/deposit \
  -H "Content-Type: application/json" \
  -d '{
    "playerId": "player_123",
    "playerEmail": "player@example.com",
    "amount": 100,
    "currency": "USD",
    "paymentMethod": "card"
  }'
```

---

## API Reference

### POST /api/casino/deposit

Process a player deposit.

**Request:**
```json
{
  "playerId": "player_123",
  "playerEmail": "player@example.com",
  "amount": 100.00,
  "currency": "USD",
  "paymentMethod": "card",
  "gameId": "slots_001",
  "metadata": {
    "username": "johnny123",
    "ip_address": "192.168.1.1"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transactionId": "DEP_1234567890_ABC",
    "amount": 100.00,
    "currency": "USD",
    "newBalance": {
      "playerId": "player_123",
      "realBalance": 100.00,
      "bonusBalance": 0,
      "totalBalance": 100.00,
      "currency": "USD"
    },
    "paymentIntentId": "pi_stripe_123456",
    "message": "Deposit of USD 100 successful"
  }
}
```

**Payment Methods:**
- `card` - Credit/debit card via Stripe
- `crypto` - Bitcoin/cryptocurrency
- `bank_transfer` - ACH/wire transfer
- `visa_direct` - Visa Direct P2P

---

### POST /api/casino/withdrawal

Process a player withdrawal.

**Request:**
```json
{
  "playerId": "player_123",
  "playerEmail": "player@example.com",
  "amount": 50.00,
  "currency": "USD",
  "withdrawalMethod": "bank_transfer",
  "bankAccount": "****1234",
  "metadata": {
    "username": "johnny123"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transactionId": "WTH_1234567890_XYZ",
    "amount": 50.00,
    "currency": "USD",
    "newBalance": {
      "playerId": "player_123",
      "realBalance": 50.00,
      "totalBalance": 50.00
    },
    "message": "Withdrawal of USD 50 processed"
  }
}
```

---

### GET /api/casino/balance/:playerId

Get player balance.

**Request:**
```bash
GET /api/casino/balance/player_123?currency=USD
```

**Response:**
```json
{
  "success": true,
  "data": {
    "playerId": "player_123",
    "realBalance": 100.00,
    "bonusBalance": 25.00,
    "totalBalance": 125.00,
    "currency": "USD",
    "pendingWithdrawals": 0,
    "lastUpdated": "2025-01-15T10:30:00Z"
  }
}
```

---

### GET /api/casino/transactions/:playerId

Get player transaction history.

**Request:**
```bash
GET /api/casino/transactions/player_123?limit=50
```

**Response:**
```json
{
  "success": true,
  "data": {
    "playerId": "player_123",
    "transactions": [
      {
        "id": "DEP_1234567890_ABC",
        "type": "deposit",
        "amount": 100.00,
        "currency": "USD",
        "status": "completed",
        "createdAt": "2025-01-15T10:00:00Z"
      }
    ],
    "count": 1
  }
}
```

---

## Laravel Integration

### Using the UPP Service in Your Controller

```php
use App\Services\UPPPaymentService;

class YourController extends Controller
{
    protected $uppService;

    public function __construct(UPPPaymentService $uppService)
    {
        $this->uppService = $uppService;
    }

    public function processDeposit(Request $request)
    {
        $user = Auth::user();

        $result = $this->uppService->processDeposit(
            playerId: (string) $user->id,
            playerEmail: $user->email,
            amount: (float) $request->amount,
            currency: 'USD',
            paymentMethod: 'card'
        );

        if ($result['success']) {
            // Update local balance
            $user->balance = $result['data']['newBalance']['totalBalance'];
            $user->save();

            return redirect()->back()->with('success', 'Deposit successful!');
        }

        return redirect()->back()->with('error', $result['error']);
    }
}
```

### Frontend Integration (Blade Template)

```blade
<!-- Deposit Form -->
<form action="{{ route('deposit') }}" method="POST">
    @csrf
    <div class="form-group">
        <label>Amount</label>
        <input type="number" name="amount" class="form-control" min="10" max="50000" required>
    </div>

    <div class="form-group">
        <label>Payment Method</label>
        <select name="paymentMethod" class="form-control" required>
            <option value="card">Credit/Debit Card</option>
            <option value="crypto">Cryptocurrency</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="visa_direct">Visa Direct</option>
        </select>
    </div>

    <button type="submit" class="btn btn-primary">Deposit</button>
</form>

<!-- Display Balance -->
<div class="balance-widget">
    <h3>Your Balance</h3>
    <p class="amount">${{ number_format($balance, 2) }}</p>
    <button onclick="refreshBalance()">Refresh</button>
</div>

<script>
function refreshBalance() {
    fetch('/balance')
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                document.querySelector('.amount').textContent =
                    '$' + data.data.totalBalance.toFixed(2);
            }
        });
}
</script>
```

---

## Testing

### Test Deposits

```bash
# Test card deposit
curl -X POST http://localhost:9000/api/casino/deposit \
  -H "Content-Type: application/json" \
  -d '{
    "playerId": "test_player",
    "playerEmail": "test@example.com",
    "amount": 100,
    "currency": "USD",
    "paymentMethod": "card"
  }'
```

### Test Withdrawals

```bash
# Test withdrawal
curl -X POST http://localhost:9000/api/casino/withdrawal \
  -H "Content-Type: application/json" \
  -d '{
    "playerId": "test_player",
    "playerEmail": "test@example.com",
    "amount": 50,
    "currency": "USD",
    "withdrawalMethod": "bank_transfer",
    "bankAccount": "****1234"
  }'
```

### Test Balance Check

```bash
curl http://localhost:9000/api/casino/balance/test_player
```

---

## Production Deployment

### 1. Environment Configuration

```env
NODE_ENV=production
PORT=9000

# Use production Stripe keys
STRIPE_SECRET_KEY=sk_live_your_production_key
STRIPE_PUBLISHABLE_KEY=pk_live_your_production_key

# Enable security features
CASINO_KYC_REQUIRED=true
ENABLE_RATE_LIMITING=true
```

### 2. Database Setup

The UPP system currently uses in-memory storage. For production, integrate with PostgreSQL:

```bash
# Your existing PostgreSQL connection from .env
DATABASE_URL=postgresql://user:pass@host:5432/database
```

### 3. Deploy on Render.com

Your `render.yaml` already includes casino configuration:

```yaml
services:
  - type: web
    name: upp-server
    runtime: node
    buildCommand: npm install && npm run build
    startCommand: npm start
    envVars:
      - key: CASINO_ID
        value: captain_cashout
```

### 4. SSL/HTTPS

Ensure all connections use HTTPS in production. Render.com provides automatic SSL certificates.

---

## Troubleshooting

### Issue: "Payment service unavailable"

**Solution:**
1. Check UPP server is running: `curl http://localhost:9000/api/casino/health`
2. Verify `UPP_API_URL` in Laravel `.env`
3. Check firewall rules if servers are on different machines

### Issue: "Insufficient balance"

**Solution:**
1. Sync balances between UPP and your casino database
2. Call `/api/casino/balance/:playerId` to get authoritative balance
3. Update local database accordingly

### Issue: "Deposit succeeded but balance not updated"

**Solution:**
Implement the `recordLocalTransaction()` method in PaymentController to sync with your database:

```php
protected function recordLocalTransaction(int $userId, string $type, array $data): void
{
    DB::table('w_users')
        ->where('id', $userId)
        ->update(['balance' => $data['newBalance']['totalBalance']]);
}
```

### Issue: Stripe errors

**Solution:**
1. Verify `STRIPE_SECRET_KEY` is set correctly
2. Check Stripe dashboard for error details
3. Ensure test mode for development, live mode for production

---

## Support

For issues or questions:
1. Check UPP logs: Server logs show all transactions
2. Check Laravel logs: `storage/logs/laravel.log`
3. Review transaction history: GET `/api/casino/transactions/:playerId`

---

## Next Steps

- ✅ **Implement Database Persistence** - Store transactions in PostgreSQL
- ✅ **Add Webhooks** - Receive real-time payment notifications
- ✅ **Implement KYC** - Add identity verification for high-value transactions
- ✅ **Add Fraud Detection** - Integrate AI-powered fraud analysis
- ✅ **Multi-currency Support** - Enable EUR, GBP, CAD processing

---

**🎰 Your casino is now integrated with Universal Payment Protocol!**

Players can deposit, play, and withdraw seamlessly through the UPP infrastructure.
