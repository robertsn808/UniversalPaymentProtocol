// Lightweight health check using supertest without binding a port
import request from 'supertest';

// Ensure environment will not start the listener in server/index.ts
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-1234567890-abcdefghijklmnopqrstuvwxyz-ABCDEFGHIJKLMNOPQRSTUVWXYZ-123';

// Load Express 5 catch-all patch to avoid path-to-regexp '*' crash
await import('../patches/express-catchall-fix.mjs');

// Use tsx loader via CLI when executing this script to import TS entrypoint
const serverModule = await import('../server/index.ts');
const app = serverModule.default || serverModule.app;

const res = await request(app).get('/health').expect(200);
console.log(JSON.stringify(res.body, null, 2));

