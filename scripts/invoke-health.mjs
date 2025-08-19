// Invoke the /health route handler directly without opening sockets

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-1234567890-abcdefghijklmnopqrstuvwxyz-ABCDEFGHIJKLMNOPQRSTUVWXYZ-123';

await import('../patches/express-catchall-fix.mjs');

const serverModule = await import('../server/index.ts');
const app = serverModule.default || serverModule.app;

// Find the GET /health route handler
const layers = app._router?.stack || [];
// Debug: list available routes
for (const layer of layers) {
  if (layer?.route) {
    console.error('ROUTE', layer.route.path, layer.route.methods);
  }
}
let handler = null;
for (const layer of layers) {
  if (layer?.route && layer.route.path === '/health' && layer.route.methods?.get) {
    const stack = layer.route.stack || [];
    if (stack.length > 0 && typeof stack[0].handle === 'function') {
      handler = stack[0].handle;
      break;
    }
  }
}

if (!handler) {
  console.error('Health route handler not found');
  process.exit(2);
}

// Minimal req/res mocks
const req = { headers: { accept: 'application/json' } };

const result = await new Promise((resolve, reject) => {
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(payload) { resolve({ statusCode: this.statusCode, body: payload }); },
    setHeader() {},
  };
  try {
    const maybePromise = handler(req, res);
    if (maybePromise && typeof maybePromise.then === 'function') {
      maybePromise.catch(reject);
    }
  } catch (e) {
    reject(e);
  }
});

console.log(JSON.stringify(result, null, 2));
