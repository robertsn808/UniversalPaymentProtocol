import { db } from '../../database/connection.js';

export interface ConnectAccountRecord {
  email: string;
  user_id?: string;
  stripe_account_id: string;
  created_at: Date;
  updated_at: Date;
}

export async function ensureTable(): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS connect_accounts (
      email TEXT PRIMARY KEY,
      user_id TEXT,
      stripe_account_id TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);
}

export async function upsertConnectAccount(email: string, stripeAccountId: string, userId?: string): Promise<void> {
  await ensureTable();
  await db.query(`
    INSERT INTO connect_accounts (email, user_id, stripe_account_id)
    VALUES ($1, $2, $3)
    ON CONFLICT (email) DO UPDATE SET
      user_id = EXCLUDED.user_id,
      stripe_account_id = EXCLUDED.stripe_account_id,
      updated_at = NOW();
  `, [email, userId || null, stripeAccountId]);
}

export async function getConnectAccountByEmail(email: string): Promise<ConnectAccountRecord | null> {
  await ensureTable();
  const res = await db.query(`SELECT * FROM connect_accounts WHERE email = $1`, [email]);
  return res.rows[0] || null;
}

