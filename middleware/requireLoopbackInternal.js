/**
 * Phase 8.20C - INTERNAL ONLY gate for runtime evidence export.
 * Loopback remote address required. Optional shared token (no auth bypass).
 */
function normalizeIp(ip) {
  let a = String(ip || '').trim().toLowerCase();
  if (a.startsWith('::ffff:')) a = a.slice(7);
  return a;
}

function isLoopbackAddress(ip) {
  const a = normalizeIp(ip);
  return a === '127.0.0.1' || a === '::1' || a === 'localhost' || a === '0:0:0:0:0:0:0:1';
}

function resolveClientIp(req) {
  // Prefer socket peer - do not trust X-Forwarded-For for this gate.
  return req.socket?.remoteAddress || req.connection?.remoteAddress || req.ip || '';
}

function hasExternalProxyHeader(req) {
  const xff = String(req.get?.('x-forwarded-for') || req.headers?.['x-forwarded-for'] || '').trim();
  const xRealIp = String(req.get?.('x-real-ip') || req.headers?.['x-real-ip'] || '').trim();
  const candidates = [
    ...xff.split(',').map((s) => s.trim()).filter(Boolean),
    ...(xRealIp ? [xRealIp] : []),
  ];
  return candidates.some((addr) => !isLoopbackAddress(addr));
}

/**
 * Express middleware: allow only direct loopback clients (not external proxied requests).
 * In production, RBAC_RUNTIME_EVIDENCE_TOKEN must be configured and matched.
 */
function requireLoopbackInternal(req, res, next) {
  const ip = resolveClientIp(req);
  if (!isLoopbackAddress(ip) || hasExternalProxyHeader(req)) {
    return res.status(403).json({
      success: false,
      code: 'INTERNAL_ONLY',
      message: 'RBAC runtime evidence is loopback-only',
    });
  }

  const expected = String(process.env.RBAC_RUNTIME_EVIDENCE_TOKEN || '').trim();
  const isProd = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
  if (isProd && !expected) {
    return res.status(403).json({
      success: false,
      code: 'EVIDENCE_TOKEN_REQUIRED',
      message: 'RBAC_RUNTIME_EVIDENCE_TOKEN must be configured in production',
    });
  }
  if (expected) {
    const got = String(req.get('x-rbac-evidence-token') || '').trim();
    if (!got || got !== expected) {
      return res.status(403).json({
        success: false,
        code: 'EVIDENCE_TOKEN_REQUIRED',
        message: 'Valid x-rbac-evidence-token required',
      });
    }
  }

  return next();
}

module.exports = {
  requireLoopbackInternal,
  isLoopbackAddress,
  normalizeIp,
  resolveClientIp,
};
