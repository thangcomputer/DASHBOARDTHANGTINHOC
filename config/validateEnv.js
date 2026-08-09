/**
 * Fail-fast validation for required secrets and production invariants.
 * Call immediately after dotenv.config().
 */

function cqrsFlagsEnabled() {
  return [
    'ENABLE_CQRS_STUDENT_CREATE',
    'ENABLE_CQRS_INVOICE',
    'ENABLE_CQRS_TEACHER',
  ].some((k) => String(process.env[k] || '').toLowerCase() === 'true' || process.env[k] === '1');
}

function mongoUriLooksLikeReplicaSet(uri) {
  const u = String(uri || '');
  return /(?:[?&]replicaSet=)|(?:mongodb\+srv:\/\/)/i.test(u);
}

function validateEnv() {
  const isProd = process.env.NODE_ENV === 'production';
  const minLen = isProd ? 32 : 16;

  const jwt = process.env.JWT_SECRET || '';
  const jwr = process.env.JWT_REFRESH_SECRET || '';
  if (jwt.length < minLen) {
    throw new Error(
      `JWT_SECRET must be at least ${minLen} characters (use: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")`
    );
  }
  if (jwr.length < minLen) {
    throw new Error(
      `JWT_REFRESH_SECRET must be at least ${minLen} characters and MUST differ from JWT_SECRET`
    );
  }
  if (jwt === jwr) {
    throw new Error('JWT_REFRESH_SECRET must not equal JWT_SECRET');
  }

  if (isProd && !(process.env.CLIENT_URL || '').trim()) {
    throw new Error('CLIENT_URL is required when NODE_ENV=production (CORS / OAuth)');
  }

  if (isProd && !(process.env.SEPAY_API_KEY || '').trim() && !(process.env.SEPAY_SECRET_KEY || '').trim()) {
    throw new Error(
      'SEPAY_API_KEY or SEPAY_SECRET_KEY is required in production (webhook fail-closed)'
    );
  }

  if (isProd && !(process.env.REDIS_URL || '').trim()) {
    throw new Error('REDIS_URL is required when NODE_ENV=production (queue / cache)');
  }

  // Sprint 5.6.2: Add SMTP fail-fast validation
  if (isProd) {
    if (!(process.env.SMTP_HOST || '').trim()) throw new Error('SMTP_HOST is required in production');
    if (!(process.env.SMTP_PORT || '').trim()) throw new Error('SMTP_PORT is required in production');
    if (!(process.env.SMTP_USER || '').trim()) throw new Error('SMTP_USER is required in production');
    if (!(process.env.SMTP_PASS || '').trim()) throw new Error('SMTP_PASS is required in production');
  }

  // Sprint 5.6.2: Add Storage fail-fast validation (if using s3 or if variables are strictly required)
  if (isProd && (process.env.STORAGE_PROVIDER === 's3' || (process.env.AWS_ACCESS_KEY_ID || '').trim())) {
    if (!(process.env.AWS_ACCESS_KEY_ID || '').trim()) throw new Error('AWS_ACCESS_KEY_ID is required for s3 storage');
    if (!(process.env.AWS_SECRET_ACCESS_KEY || '').trim()) throw new Error('AWS_SECRET_ACCESS_KEY is required for s3 storage');
    if (!(process.env.AWS_REGION || '').trim()) throw new Error('AWS_REGION is required for s3 storage');
    if (!(process.env.S3_BUCKET || '').trim()) throw new Error('S3_BUCKET is required for s3 storage');
  }

  // Wave 6.1 / Security freeze: production must not silently run CQRS.
  // Explicit opt-in required: ALLOW_CQRS_IN_PRODUCTION=true|1
  if (isProd && cqrsFlagsEnabled()) {
    const allow =
      String(process.env.ALLOW_CQRS_IN_PRODUCTION || '').toLowerCase() === 'true' ||
      process.env.ALLOW_CQRS_IN_PRODUCTION === '1';
    if (!allow) {
      throw new Error(
        'CQRS flags are enabled in production but ALLOW_CQRS_IN_PRODUCTION is not set. ' +
          'Frozen contract requires ENABLE_CQRS_* = OFF unless an explicit safety decision is recorded. ' +
          'Set ALLOW_CQRS_IN_PRODUCTION=true only after rollout checklist, or disable all ENABLE_CQRS_* flags.',
      );
    }
  }

  // Phase A CQRS: multi-doc transactions need a replica set (or Atlas / mongodb+srv)
  if (cqrsFlagsEnabled()) {
    const uri = process.env.MONGODB_URI || '';
    if (!mongoUriLooksLikeReplicaSet(uri)) {
      const msg =
        'CQRS flags require MongoDB replica set. Set MONGODB_URI with ?replicaSet=rs0 ' +
        '(docker compose) or use mongodb+srv://. See docs/architecture/cqrs-phase-a-rollout.md';
      if (isProd) throw new Error(msg);
      // eslint-disable-next-line no-console
      console.warn(`[validateEnv] WARNING: ${msg}`);
    }
  }

  // Phase 7.1: Policy cutover flags are optional. Missing/malformed → Legacy (handled by cutoverAuthority).
  // validateEnv does NOT activate cutover. Defaults must remain ENABLED=false / ROUTES empty.
}

module.exports = validateEnv;
module.exports.cqrsFlagsEnabled = cqrsFlagsEnabled;
module.exports.mongoUriLooksLikeReplicaSet = mongoUriLooksLikeReplicaSet;
