import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { z } from 'zod';
import { AuthenticatedRequest as JwtReq } from '../../auth/jwt.js';
import { authenticateAPIKey, optionalAPIKeyAuth } from '../../middleware/api-key-auth.js';
import { paymentRateLimit } from '../../middleware/security.js';
import { env } from '../../config/environment.js';
import secureLogger from '../../shared/logger.js';
import { upsertConnectAccount, getConnectAccountByEmail } from './repository.js';
import { computeFees } from './fees.js';

const router = Router();

function stripeClient(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'STRIPE_DISABLED') {
    throw new Error('Stripe disabled. Set STRIPE_SECRET_KEY.');
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-07-30.basil' });
}

function effectiveEmail(req: Request & Partial<JwtReq>): string | undefined {
  const authHeader = req.get('Authorization');
  const jwtUser = (req as any).user;
  const apiKeyUser = (req as any).apiKey; // from API key auth
  return jwtUser?.email || apiKeyUser?.email || undefined;
}

const AccountSchema = z.object({
  country: z.string().min(2).max(2).default('US'),
  email: z.string().email().optional(),
  business_type: z.enum(['individual', 'company']).default('individual'),
});

router.post('/account', optionalAPIKeyAuth, async (req: Request & Partial<JwtReq>, res: Response) => {
  try {
    const { country, email, business_type } = AccountSchema.parse(req.body || {});
    const requesterEmail = email || effectiveEmail(req);
    if (!requesterEmail) {
      return res.status(400).json({ error: 'Email is required (login or provide email)' });
    }

    const stripe = stripeClient();
    const ip = req.ip || '0.0.0.0';
    const acct = await stripe.accounts.create({
      type: 'custom',
      country,
      email: requesterEmail,
      business_type,
      capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
      tos_acceptance: { date: Math.floor(Date.now() / 1000), ip }
    });

    await upsertConnectAccount(requesterEmail, acct.id, (req as any).user?.userId || (req as any).apiKey?.id);
    secureLogger.info('Connect account created', { email: requesterEmail, accountId: acct.id });
    res.json({ success: true, account_id: acct.id });
  } catch (err: any) {
    secureLogger.error('Connect account creation failed', { error: err?.message || String(err) });
    res.status(400).json({ error: err?.message || 'Connect account error' });
  }
});

const ChargeSchema = z.object({
  amount: z.number().positive(), // amount merchant should receive (net)
  currency: z.string().default('usd'),
  recipient_email: z.string().email(),
  description: z.string().optional(),
});

router.post('/charge', authenticateAPIKey, async (req: Request & Partial<JwtReq>, res: Response) => {
  try {
    const { amount, currency, recipient_email, description } = ChargeSchema.parse(req.body);
    const recipient = await getConnectAccountByEmail(recipient_email);
    if (!recipient) return res.status(404).json({ error: 'Recipient not connected' });

    // Fee model configuration
    const cfg = {
      model: (process.env.FEE_MODEL as any) === 'merchant_pays' ? 'merchant_pays' : 'buyer_pays',
      stripePct: Number(process.env.STRIPE_FEE_BPS || 290) / 10000,
      stripeFixed: Number(process.env.STRIPE_FEE_FIXED || 30) / 100, // cents → dollars
      platformPct: Number(process.env.PLATFORM_FEE_BPS || 200) / 10000,
      platformFixed: Number(process.env.PLATFORM_FEE_FIXED || 0) / 100
    } as const;

    const breakdown = computeFees(amount, cfg);
    const amountInCents = Math.round(breakdown.chargeAmount * 100);
    const applicationFeeAmount = Math.round(breakdown.platformFee * 100);

    const stripe = stripeClient();
    const pi = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency,
      description: description || `UPP payment to ${recipient_email}`,
      transfer_data: { destination: recipient.stripe_account_id },
      application_fee_amount: applicationFeeAmount,
      automatic_payment_methods: { enabled: true },
      metadata: {
        upp_payment: 'true',
        recipient_email,
        fee_model: cfg.model,
        platform_fee: applicationFeeAmount,
      }
    });

    // Auto-confirm in test env; for production add client-side confirmation
    const confirmed = await stripe.paymentIntents.confirm(pi.id, { payment_method: 'pm_card_visa' });
    const success = confirmed.status === 'succeeded';

    res.json({
      success,
      payment_intent_id: pi.id,
      charge_amount: breakdown.chargeAmount,
      net_to_recipient: breakdown.netToMerchant,
      platform_fee: breakdown.platformFee,
      stripe_fee_estimate: breakdown.stripeFee,
      currency,
      message: success ? 'Payment routed to recipient' : 'Payment requires action',
    });
  } catch (err: any) {
    secureLogger.error('Connect charge error', { error: err?.message || String(err) });
    res.status(400).json({ error: err?.message || 'Charge error' });
  }
});

export default router;

// --- Direct card charge (fully hidden Stripe, SAQ D scope) ---
// We export an additional router to be mounted by the server after security middleware
export const directChargeRouter = Router();

const DirectChargeSchema = z.object({
  amount: z.number().positive(), // amount merchant should receive (net)
  currency: z.string().default('usd'),
  recipient_email: z.string().email(),
  description: z.string().optional(),
  card_number: z.string().min(12).max(19),
  exp_month: z.number().min(1).max(12),
  exp_year: z.number().min(new Date().getFullYear()).max(new Date().getFullYear() + 15),
  cvc: z.string().min(3).max(4),
  billing_details: z.object({
    name: z.string().optional(),
    email: z.string().email().optional(),
    address: z.object({
      line1: z.string().optional(),
      line2: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      postal_code: z.string().optional(),
      country: z.string().optional()
    }).optional()
  }).optional()
});

directChargeRouter.post('/charge-direct', paymentRateLimit, authenticateAPIKey, async (req: Request & Partial<JwtReq>, res: Response) => {
  try {
    if (env.PCI_COMPLIANCE_MODE !== true) {
      return res.status(403).json({ error: 'Direct card handling disabled. Enable PCI_COMPLIANCE_MODE=true' });
    }

    const body = DirectChargeSchema.parse(req.body);
    const recipient = await getConnectAccountByEmail(body.recipient_email);
    if (!recipient) return res.status(404).json({ error: 'Recipient not connected' });

    const cfg = {
      model: (process.env.FEE_MODEL as any) === 'merchant_pays' ? 'merchant_pays' : 'buyer_pays',
      stripePct: Number(process.env.STRIPE_FEE_BPS || 290) / 10000,
      stripeFixed: Number(process.env.STRIPE_FEE_FIXED || 30) / 100,
      platformPct: Number(process.env.PLATFORM_FEE_BPS || 200) / 10000,
      platformFixed: Number(process.env.PLATFORM_FEE_FIXED || 0) / 100
    } as const;
    const breakdown = computeFees(body.amount, cfg);

    const stripe = stripeClient();

    // Create PaymentMethod server-side (SAQ D)
    const pm = await stripe.paymentMethods.create({
      type: 'card',
      card: {
        number: body.card_number,
        exp_month: body.exp_month,
        exp_year: body.exp_year,
        cvc: body.cvc
      },
      billing_details: body.billing_details
    });

    const amountInCents = Math.round(breakdown.chargeAmount * 100);
    const appFee = Math.round(breakdown.platformFee * 100);

    const pi = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: body.currency,
      description: body.description || `UPP payment to ${body.recipient_email}`,
      transfer_data: { destination: recipient.stripe_account_id },
      application_fee_amount: appFee,
      payment_method: pm.id,
      confirm: true,
      statement_descriptor: env.STATEMENT_DESCRIPTOR?.slice(0, 22),
      metadata: {
        upp_payment: 'true',
        recipient_email: body.recipient_email,
        fee_model: cfg.model,
        platform_fee: appFee,
      }
    });

    const ch = pi.latest_charge ? await stripe.charges.retrieve(String(pi.latest_charge)) : null;
    const last4 = (ch?.payment_method_details as any)?.card?.last4 || '****';
    const brand = (ch?.payment_method_details as any)?.card?.brand || 'card';

    return res.json({
      success: pi.status === 'succeeded',
      payment_intent_id: pi.id,
      charge_amount: breakdown.chargeAmount,
      net_to_recipient: breakdown.netToMerchant,
      platform_fee: breakdown.platformFee,
      currency: body.currency,
      card: { brand, last4 },
      message: pi.status === 'succeeded' ? 'Payment routed successfully' : 'Payment requires action'
    });
  } catch (err: any) {
    // Never log PAN/CVC
    secureLogger.error('Direct charge error', { error: err?.message || String(err) });
    return res.status(400).json({ error: 'Charge failed' });
  }
});

// --- Onboarding (KYC/KYB) ---
const OnboardingSchema = z.object({
  email: z.string().email().optional(),
  business_type: z.enum(['individual', 'company']).default('individual'),
  business_profile: z.object({
    mcc: z.string().optional(),
    url: z.string().optional(),
    product_description: z.string().optional(),
  }).optional(),
  individual: z.object({
    first_name: z.string(),
    last_name: z.string(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    dob: z.object({ day: z.number().min(1).max(31), month: z.number().min(1).max(12), year: z.number().min(1900).max(2100) }),
    address: z.object({
      line1: z.string(),
      city: z.string(),
      state: z.string().optional(),
      postal_code: z.string(),
      country: z.string().default('US')
    })
  }).optional(),
  company: z.object({
    name: z.string(),
    phone: z.string().optional(),
    address: z.object({ line1: z.string(), city: z.string(), state: z.string().optional(), postal_code: z.string(), country: z.string().default('US') })
  }).optional()
});

router.post('/onboarding', authenticateAPIKey, async (req: Request & Partial<JwtReq>, res: Response) => {
  try {
    const body = OnboardingSchema.parse(req.body || {});
    const requesterEmail = body.email || effectiveEmail(req);
    if (!requesterEmail) return res.status(400).json({ error: 'email required' });
    const acc = await getConnectAccountByEmail(requesterEmail);
    if (!acc) return res.status(404).json({ error: 'No connect account for email' });

    const stripe = stripeClient();
    const params: Stripe.AccountUpdateParams = {};
    if (body.business_profile) params.business_profile = body.business_profile as any;
    if (body.business_type === 'individual' && body.individual) {
      params.business_type = 'individual';
      params.individual = body.individual as any;
    }
    if (body.business_type === 'company' && body.company) {
      params.business_type = 'company';
      params.company = body.company as any;
    }

    const updated = await stripe.accounts.update(acc.stripe_account_id, params);
    return res.json({ success: true, account_id: updated.id, requirements: updated.requirements });
  } catch (err: any) {
    secureLogger.error('Onboarding update failed', { error: err?.message || String(err) });
    return res.status(400).json({ error: 'Onboarding failed' });
  }
});

// --- Payout method (bank account) ---
const PayoutSchema = z.object({
  recipient_email: z.string().email(),
  country: z.string().default('US'),
  currency: z.string().default('usd'),
  account_holder_name: z.string(),
  account_holder_type: z.enum(['individual', 'company']).default('individual'),
  routing_number: z.string().min(5),
  account_number: z.string().min(4)
});

router.post('/payout_method', authenticateAPIKey, async (req: Request & Partial<JwtReq>, res: Response) => {
  try {
    const body = PayoutSchema.parse(req.body);
    const recipient = await getConnectAccountByEmail(body.recipient_email);
    if (!recipient) return res.status(404).json({ error: 'Recipient not connected' });
    const stripe = stripeClient();

    // Create bank account token server-side (do not log details)
    const token = await stripe.tokens.create({
      bank_account: {
        country: body.country,
        currency: body.currency,
        account_holder_name: body.account_holder_name,
        account_holder_type: body.account_holder_type,
        routing_number: body.routing_number,
        account_number: body.account_number
      }
    });

    const updated = await stripe.accounts.update(recipient.stripe_account_id, {
      external_account: token.id
    });

    // Return masked info
    const ext = (updated.external_accounts as any)?.data?.[0];
    return res.json({ success: true, bank: { last4: ext?.last4, bank_name: ext?.bank_name, country: ext?.country, currency: ext?.currency } });
  } catch (err: any) {
    secureLogger.error('Payout method add failed', { error: err?.message || String(err) });
    return res.status(400).json({ error: 'Payout method failed' });
  }
});

// --- Read-only endpoints for dashboard ---
router.get('/account', authenticateAPIKey, async (req: Request & Partial<JwtReq>, res: Response) => {
  try {
    const email = (req.query.email as string) || effectiveEmail(req);
    if (!email) return res.status(400).json({ error: 'email required' });
    const acc = await getConnectAccountByEmail(email);
    if (!acc) return res.status(404).json({ error: 'No connect account' });
    const stripe = stripeClient();
    const account = await stripe.accounts.retrieve(acc.stripe_account_id);
    res.json({ success: true, account: { id: account.id, requirements: account.requirements, charges_enabled: account.charges_enabled, payouts_enabled: account.payouts_enabled } });
  } catch (err: any) {
    secureLogger.error('Fetch account failed', { error: err?.message || String(err) });
    res.status(400).json({ error: 'Fetch failed' });
  }
});

router.get('/balance', authenticateAPIKey, async (req: Request & Partial<JwtReq>, res: Response) => {
  try {
    const email = (req.query.recipient_email as string) || effectiveEmail(req);
    if (!email) return res.status(400).json({ error: 'recipient_email required' });
    const acc = await getConnectAccountByEmail(email);
    if (!acc) return res.status(404).json({ error: 'No connect account' });
    const stripe = stripeClient();
    const bal = await stripe.balance.retrieve({ stripeAccount: acc.stripe_account_id });
    res.json({ success: true, balance: bal });
  } catch (err: any) {
    secureLogger.error('Fetch balance failed', { error: err?.message || String(err) });
    res.status(400).json({ error: 'Fetch failed' });
  }
});

router.get('/payouts', authenticateAPIKey, async (req: Request & Partial<JwtReq>, res: Response) => {
  try {
    const email = (req.query.recipient_email as string) || effectiveEmail(req);
    if (!email) return res.status(400).json({ error: 'recipient_email required' });
    const acc = await getConnectAccountByEmail(email);
    if (!acc) return res.status(404).json({ error: 'No connect account' });
    const stripe = stripeClient();
    const payouts = await stripe.payouts.list({ limit: 10 }, { stripeAccount: acc.stripe_account_id });
    res.json({ success: true, payouts: payouts.data.map(p => ({ id: p.id, status: p.status, amount: p.amount, currency: p.currency, arrival_date: p.arrival_date })) });
  } catch (err: any) {
    secureLogger.error('Fetch payouts failed', { error: err?.message || String(err) });
    res.status(400).json({ error: 'Fetch failed' });
  }
});
