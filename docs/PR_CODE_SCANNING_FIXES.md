## Summary

This PR resolves multiple code scanning findings and addresses Dependabot concerns by tightening security in auth/session handling, CORS, file serving, and logging, while migrating ESLint to a flat config compatible with ESLint v9.

## Key Changes

- JWT Refresh Security
  - Add `jti` to refresh tokens using UUIDs.
  - Replace unsafe `jwt.decode()` with verified token parsing for session CRUD operations.
  - File: `src/auth/jwt.ts`.

- CORS Hardening
  - Replace permissive fallback `app.use(cors())` with `app.use(cors({ origin: false }))` to avoid allow-all.
  - File: `server/index.ts`.

- Secure Static File Serving
  - Rework `/mobile`, `/pos`, and `/register` routes to use `SecureFileHandler` with allowlisted directories, path traversal checks, and strict response headers.
  - Files: `server/index.ts`, `src/utils/file-security.ts` (util already present).

- Sensitive Logging Removed
  - Stop logging full `req.body` for payment, device registration, card saving, and quick payments.
  - File: `server/index.ts`.

- Helmet Config Modernization
  - Remove deprecated X-XSS-Protection usage; rely on CSP and modern browser defaults.
  - File: `src/middleware/security.ts`.

- ESLint v9 Migration
  - Add flat config `eslint.config.js`, mapping prior rules and ignoring generated directories. This unblocks `npm run lint` under ESLint 9.

## Rationale

These changes directly address common CodeQL patterns:
- Token verification before database and session logic (no reliance on unverified payloads).
- Avoid permissive CORS defaults.
- Guard against path traversal when serving files.
- Reduce sensitive data exposure in logs.
- Keep security headers current.

## Validation

- `npm audit`: 0 vulnerabilities.
- `npm run build`: successful TypeScript build.
- Linting now uses a flat config and should run without config errors (`npm run lint`).

## Deployment Notes

- No breaking env changes, but ensure `JWT_SECRET` and Stripe keys are set in production.
- No DB migrations required; session table should already exist if used. If not, ensure appropriate schema for `user_sessions`.

## Follow-ups (Optional)

- Apply secure file handler to any other routes that serve static files.
- Add Prettier integration if desired (`eslint-plugin-prettier` and `eslint-config-prettier`).
- Consider adding CodeQL queries for log PII detection.

