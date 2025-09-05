export function genStan(): string {
  // Systems Trace Audit Number: 6-digit numeric, rolling
  const n = Math.floor(Math.random() * 900000) + 100000;
  return String(n);
}

export function genRrn(): string {
  // Retrieval Reference Number: 12-digit; sandbox-friendly
  const ts = Date.now().toString().slice(-10); // last 10 digits of epoch
  const rand = Math.floor(Math.random() * 90) + 10; // 2 digits
  return `${ts}${rand}`.slice(0, 12);
}

