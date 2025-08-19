#!/usr/bin/env bash
set -euo pipefail

# Stripe CLI demo script for UPP webhook testing
# Requirements: stripe CLI installed and authenticated (stripe login)

PORT="${PORT:-9000}"
FORWARD_URL="http://localhost:${PORT}/webhooks/stripe"

echo "== UPP Stripe CLI Demo =="
echo "Forwarding Stripe events to: ${FORWARD_URL}"

if ! command -v stripe >/dev/null 2>&1; then
  echo "ERROR: stripe CLI not found. Install from https://stripe.com/docs/stripe-cli"
  exit 1
fi

echo "Obtaining webhook signing secret..."
WEBHOOK_SECRET=$(stripe listen --print-secret 2>/dev/null | tail -n 1)

if [ -z "${WEBHOOK_SECRET}" ]; then
  echo "ERROR: Could not obtain webhook secret. Ensure 'stripe login' succeeded."
  exit 1
fi

echo "Export this in your API server environment before starting it:"
echo "  export STRIPE_WEBHOOK_SECRET=${WEBHOOK_SECRET}"
echo

echo "Starting stripe listen in background (press Ctrl+C to stop)"
stripe listen --forward-to "${FORWARD_URL}" >/tmp/upp_stripe_listen.log 2>&1 &
LISTEN_PID=$!
trap 'echo "Stopping stripe listen"; kill ${LISTEN_PID} >/dev/null 2>&1 || true' EXIT

sleep 2
echo "Triggering test events..."
stripe trigger payment_intent.succeeded || true
stripe trigger payment_intent.payment_failed || true

echo
echo "Logs: tail -f /tmp/upp_stripe_listen.log"
echo "Done. Remember to set STRIPE_SECRET_KEY and start the UPP server."

