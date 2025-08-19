UPP Local Setup and Integration
================================

This guide gets UPP running locally with PostgreSQL + Redis, configures Stripe test keys, and shows how to point the alii Fish Market backend at UPP.

Prerequisites
-------------
- Node.js 18+
- Docker (Desktop) and Docker Compose
- Stripe account (test mode is fine) and Stripe CLI (optional for webhooks)

Environment
-----------
- Copy the template and set required values:

  cp .env.example .env

- Minimum required vars for local dev:
  - STRIPE_SECRET_KEY: Stripe test secret key (starts with `sk_test_...`)
  - JWT_SECRET: any long random string for auth
  - DATABASE_URL: leave default to use Docker postgres (`postgresql://upp:upp_password@localhost:5432/upp`)
  - REDIS_URL: `redis://localhost:6379` (defaults fine)

Local Services (DB/Cache/UI)
----------------------------
- Start infra only (Postgres, Redis, Adminer):

  docker compose up -d postgres redis adminer

- Adminer (DB UI): http://localhost:8080
  - System: PostgreSQL
  - Server: localhost
  - Username: upp
  - Password: upp_password
  - Database: upp

Run UPP
-------
- Install deps and start dev server:

  npm install
  npm run dev

- Health check: http://localhost:9000/health

Stripe (Test Mode)
------------------
- Set `STRIPE_SECRET_KEY` to your test key from the Stripe Dashboard.
- Optional: receive webhooks locally with Stripe CLI:

  stripe listen --forward-to http://localhost:9000/webhooks/stripe

- Copy the printed webhook signing secret into `.env` as `STRIPE_WEBHOOK_SECRET`.

Key Endpoints
-------------
- Register device: POST http://localhost:9000/api/register-device
- Process payment: POST http://localhost:9000/api/process-payment
- Payment status:  GET http://localhost:9000/api/payment-status/:paymentIntentId
- POS routes:      under `/api/pos/...` (see `src/modules/pos`)

alii Backend → UPP Integration
------------------------------
Configure the alii Spring Boot backend to call UPP. Suggested `.env` (or application properties) for alii:

- UPP_BASE_URL: `http://localhost:9000`
- UPP_API_KEY or JWT: if using API key/JWT, supply header on calls
- STRIPE_PUBLISHABLE_KEY: for alii frontend if needed

Example mapping:
- Create payment intent → POST `${UPP_BASE_URL}/api/process-payment`
- Check status → GET `${UPP_BASE_URL}/api/payment-status/{id}`
- Register device → POST `${UPP_BASE_URL}/api/register-device`

End-to-End Test
---------------
- With infra and UPP running:
  1) From alii frontend, create an order → alii backend → UPP `/api/process-payment`
  2) Confirm payment succeeds (Stripe test card `4242 4242 4242 4242` handled server-side for demos)
  3) Verify transaction shows in Adminer (`transactions` table)
  4) Verify UPP `/api/payment-status/{id}` returns `succeeded`

Troubleshooting
---------------
- Database connection: ensure Postgres is up (`docker compose ps postgres`) and `DATABASE_URL` matches
- Redis: optional; UPP runs without Redis, but logs a warning if missing
- Stripe: must use test secret key in dev; production requires `sk_live_...`
- Ports: UPP `9000`, Adminer `8080`, Postgres `5432`, Redis `6379`

