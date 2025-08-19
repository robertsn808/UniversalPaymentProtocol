import express, { Express, Request, Response } from 'express';
import Stripe from 'stripe';

import secureLogger from '../shared/logger.js';
import { env } from '../config/environment.js';
import { transactionRepository } from '../database/repositories.js';

/**
 * Registers the Stripe webhook endpoint with proper raw body parsing and
 * signature verification. Falls back to a no-op logger in demo mode.
 */
export function registerStripeWebhook(app: Express) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret || webhookSecret.trim().length === 0) {
    secureLogger.warn('Stripe webhook secret not set; running webhook in demo mode');
    // Accepts requests and logs basic info; does not verify signature.
    app.post('/webhooks/stripe', express.json({ limit: '1mb' }), async (req: Request, res: Response) => {
      try {
        const type = (req.body && req.body.type) || 'unknown';
        secureLogger.info('Stripe webhook (demo mode) received', { type });
        res.status(200).json({ received: true, demo: true });
      } catch (err) {
        secureLogger.error('Stripe webhook (demo mode) error', { error: err instanceof Error ? err.message : String(err) });
        res.status(200).json({ received: true, demo: true });
      }
    });
    return;
  }

  // Important: Use raw body for Stripe signature verification
  app.post('/webhooks/stripe', express.raw({ type: 'application/json', limit: '1mb' }), async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature'];
    if (!sig || typeof sig !== 'string') {
      secureLogger.warn('Missing Stripe signature header');
      return res.status(400).send('Missing signature');
    }

    let event: Stripe.Event;
    try {
      // Verify signature using the raw buffer and webhook secret
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const buf = req.body as any; // Buffer provided by express.raw
      event = Stripe.webhooks.constructEvent(buf, sig, webhookSecret);
    } catch (err) {
      secureLogger.warn('Stripe webhook signature verification failed', { error: err instanceof Error ? err.message : String(err) });
      return res.status(400).send('Signature verification failed');
    }

    try {
      const type = event.type;
      secureLogger.info('Stripe webhook verified', { type });

      // Handle a subset of high-value events for operational readiness
      switch (type) {
        case 'payment_intent.succeeded': {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          const pid = paymentIntent.id;
          try {
            const existing = await transactionRepository.findByPaymentIntentId(pid);
            if (existing) {
              await transactionRepository.updateStatus(existing.id, 'completed');
              secureLogger.payment('Payment completed via webhook', { transactionId: existing.id, paymentIntentId: pid, success: true });
            } else {
              secureLogger.warn('PaymentIntent not linked to a transaction', { paymentIntentId: pid });
            }
          } catch (dbErr) {
            secureLogger.error('Failed to reconcile transaction on webhook', { error: dbErr instanceof Error ? dbErr.message : String(dbErr), paymentIntentId: pid });
          }
          break;
        }
        case 'payment_intent.payment_failed': {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          const pid = paymentIntent.id;
          try {
            const existing = await transactionRepository.findByPaymentIntentId(pid);
            if (existing) {
              await transactionRepository.updateStatus(existing.id, 'failed', paymentIntent.last_payment_error?.message);
              secureLogger.payment('Payment failed via webhook', { transactionId: existing.id, paymentIntentId: pid, success: false, error: paymentIntent.last_payment_error?.message });
            } else {
              secureLogger.warn('Failed payment not linked to a transaction', { paymentIntentId: pid });
            }
          } catch (dbErr) {
            secureLogger.error('Failed to mark transaction failed on webhook', { error: dbErr instanceof Error ? dbErr.message : String(dbErr), paymentIntentId: pid });
          }
          break;
        }
        case 'charge.refunded':
        case 'charge.refund.updated': {
          const charge = event.data.object as Stripe.Charge;
          const pid = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
          if (pid) {
            try {
              const existing = await transactionRepository.findByPaymentIntentId(pid);
              if (existing) {
                await transactionRepository.update(existing.id, { stripe_data: { refunded: true, charge_id: charge.id } });
                secureLogger.payment('Refund processed via webhook', { transactionId: existing.id, paymentIntentId: pid, success: true });
              }
            } catch (dbErr) {
              secureLogger.error('Failed to reconcile refund on webhook', { error: dbErr instanceof Error ? dbErr.message : String(dbErr), paymentIntentId: String(pid) });
            }
          }
          break;
        }
        default:
          // For other events, just acknowledge
          break;
      }

      res.json({ received: true });
    } catch (err) {
      secureLogger.error('Stripe webhook handling error', { error: err instanceof Error ? err.message : String(err) });
      res.status(500).send('Webhook handler error');
    }
  });
}

