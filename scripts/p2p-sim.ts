#!/usr/bin/env tsx

// Simple Visa Direct P2P simulator for sandbox
// Usage: UPP_API_KEY=your_key tsx scripts/p2p-sim.ts \
//   --amount 12.34 --sender 4111111111111111:2612:123 --recipient 4111111111111111

import 'dotenv/config';

const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i += 2) {
  const k = process.argv[i];
  const v = process.argv[i + 1];
  if (k && v && k.startsWith('--')) args.set(k.slice(2), v);
}

const amount = parseFloat(args.get('amount') || '1.00');
const senderSpec = args.get('sender') || '4111111111111111:2612:123';
const recipientPan = args.get('recipient') || '4111111111111111';
const baseUrl = `http://localhost:${process.env.PORT || '9000'}`;
const apiKey = process.env.UPP_API_KEY || process.env.API_KEY;

if (!apiKey) {
  console.error('❌ Missing API key. Set UPP_API_KEY in env.');
  process.exit(1);
}

const [senderPan, senderYYMM, senderCvv] = senderSpec.split(':');

async function main() {
  const payload = {
    amount,
    currency: 'USD',
    sender: { cardNumber: senderPan, expYYMM: senderYYMM, cvv2: senderCvv },
    recipient: { cardNumber: recipientPan },
  };
  const res = await fetch(`${baseUrl}/api/p2p/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`❌ ${res.status} ${res.statusText}: ${text}`);
    process.exit(1);
  }
  console.log('✅ P2P sent:', text);
}

main().catch((e) => {
  console.error('❌ P2P sim failed:', e?.message || e);
  process.exit(1);
});

