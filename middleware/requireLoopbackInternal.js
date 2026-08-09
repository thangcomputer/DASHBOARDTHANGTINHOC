/**
 * Phase 8.20C — INTERNAL ONLY gate for runtime evidence export.
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
  // Prefer socket peer — do not trust X-Forwarded-For for this gate.
  return req.socket?.remoteAddress || req.connection?.remoteAddress || req.ip || '';
}

/**
 * Express middleware: allow only loopback clients.
 * If RBAC_RUNTIME_EVIDENCE_TOKEN is set, require matching x-rbac-evidence-token header.
 */
function requireLoopbackInternal(req, res, next) {
  const ip = resolveClientIp(req);
  if (!isLoopbackAddress(ip)) {
    return res.status(403).json({
      success: false,
      code: 'INTERNAL_ONLY',
      message: 'RBAC runtime evidence is loopback-only',
    });
  }

  const expected = String(process.env.RBAC_RUNTIME_EVIDENCE_TOKEN || '').trim();
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
