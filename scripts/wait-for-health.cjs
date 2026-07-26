/**
 * Wait until /healthz returns ok.
 * Usage: node scripts/wait-for-health.cjs [url] [timeoutMs]
 */
const url = process.argv[2] || process.env.HEALTH_URL || 'http://127.0.0.1:5000/healthz';
const timeoutMs = Number(process.argv[3] || process.env.HEALTH_TIMEOUT_MS || 60000);
const start = Date.now();

async function tick() {
  try {
    const r = await fetch(url);
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.ok) {
      console.log('healthy:', url, j);
      process.exit(0);
    }
    console.log('waiting...', r.status, j.db || j.status || '');
  } catch (e) {
    console.log('waiting...', e.message);
  }
  if (Date.now() - start > timeoutMs) {
    console.error('timeout waiting for', url);
    process.exit(1);
  }
  setTimeout(tick, 1500);
}

tick();