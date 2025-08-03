#!/usr/bin/env node

// UPP Encryption Key Generator
// Generates secure encryption keys for the Universal Payment Protocol

import crypto from 'crypto';

console.log('🔐 Universal Payment Protocol - Encryption Key Generator');
console.log('=======================================================\n');

// Generate different types of keys
const aes256Key = crypto.randomBytes(32).toString('hex');
const aes128Key = crypto.randomBytes(16).toString('hex');
const base64Key = crypto.randomBytes(32).toString('base64');
const urlSafeKey = crypto.randomBytes(32).toString('base64url');

console.log('🔑 AES-256 Key (32 bytes, 64 hex chars) - RECOMMENDED:');
console.log(`ENCRYPTION_KEY=${aes256Key}`);
console.log('');

console.log('🔑 AES-128 Key (16 bytes, 32 hex chars):');
console.log(`ENCRYPTION_KEY=${aes128Key}`);
console.log('');

console.log('🔑 Base64 Encoded Key (44 chars):');
console.log(`ENCRYPTION_KEY=${base64Key}`);
console.log('');

console.log('🔑 URL-Safe Base64 Key (43 chars):');
console.log(`ENCRYPTION_KEY=${urlSafeKey}`);
console.log('');

console.log('📝 Instructions:');
console.log('1. Copy one of the keys above (AES-256 recommended)');
console.log('2. Add it to your .env file');
console.log('3. Keep this key secure and never commit it to version control');
console.log('4. Use the same key across all your UPP instances');
console.log('');

console.log('⚠️  Security Notes:');
console.log('- Store this key securely (password manager, secure vault)');
console.log('- Use different keys for development, staging, and production');
console.log('- Rotate keys periodically for enhanced security');
console.log('- Never share keys in plain text communications');