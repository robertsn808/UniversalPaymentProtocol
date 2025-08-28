export interface FeeConfig {
  model: 'buyer_pays' | 'merchant_pays';
  stripePct: number; // e.g., 0.029 for 2.9%
  stripeFixed: number; // e.g., 0.30 (USD)
  platformPct: number; // e.g., 0.020 for 2.0%
  platformFixed: number; // e.g., 0.00
}

export interface FeeBreakdown {
  chargeAmount: number; // total charged to buyer in currency units
  netToMerchant: number; // amount merchant receives
  stripeFee: number;
  platformFee: number;
}

export function computeFees(targetNetToMerchant: number, cfg: FeeConfig): FeeBreakdown {
  const round = (n: number) => Math.round(n * 100) / 100;
  if (cfg.model === 'merchant_pays') {
    const stripeFee = round(targetNetToMerchant * cfg.stripePct + cfg.stripeFixed);
    const platformFee = round(targetNetToMerchant * cfg.platformPct + cfg.platformFixed);
    const chargeAmount = round(targetNetToMerchant + stripeFee + platformFee);
    return { chargeAmount, netToMerchant: round(targetNetToMerchant), stripeFee, platformFee };
  }
  // buyer_pays: solve A = (M + s_fixed + p_fixed) / (1 - s_pct - p_pct)
  const denom = 1 - cfg.stripePct - cfg.platformPct;
  const chargeAmount = round((targetNetToMerchant + cfg.stripeFixed + cfg.platformFixed) / denom);
  const stripeFee = round(chargeAmount * cfg.stripePct + cfg.stripeFixed);
  const platformFee = round(chargeAmount * cfg.platformPct + cfg.platformFixed);
  const netToMerchant = round(chargeAmount - stripeFee - platformFee);
  return { chargeAmount, netToMerchant, stripeFee, platformFee };
}

