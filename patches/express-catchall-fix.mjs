// Runtime monkey patch to make Express 5 catch-all compatible with `app.use('*', ...)`.
// Some apps still register a 404 handler using '*', which throws in path-to-regexp v6.
// This patch transparently converts `app.use('*', fn)` to `app.use(fn)`.

import app from '../node_modules/express/lib/application.js';

const originalUse = app.use;

app.use = function patchedUse(...args) {
  try {
    if (args.length > 0 && typeof args[0] === 'string' && args[0] === '*') {
      // Drop the '*' path so it applies to all routes without path-to-regexp parsing
      args = args.slice(1);
    }
  } catch (_) {
    // If anything goes wrong, fall back to original args
  }
  return originalUse.apply(this, args);
};

