/**
 * Fail-fast validation for required secrets and production invariants.
 * Call immediately after dotenv.config().
 *
 * CQRS without replica set must NOT brick the whole API — force legacy off instead of throw.
 */

const CQRS_FLAG_KEYS = [
  'ENABLE_CQRS_STUDENT_CREATE',
  'ENABLE_CQRS_INVOICE',
  'ENABLE_CQRS_TEACHER',
  'ENABLE_CQRS_FINANCE',
];

function envFlagOn(name) {
  const v = String(process.env[name] || '').toLowerCase();
  return v === 'true' || v === '1';
}

function cqrsFlagsEnabled() {
  // Prefer shared resolver when present (main / CQRS cutover)
  try {
    const flags = require('../shared/cqrs/flags');
    if (typeof flags.cqrsFlagsEnabled === 'function') return flags.cqrsFlagsEnabled();
  } catch {
    /* local / older trees */
  }
  return CQRS_FLAG_KEYS.some((k) => envFlagOn(k));
}

function mongoUriLooksLikeReplicaSet(uri) {
  try {
    const flags = require('../shared/cqrs/flags');
    if (typeof flags.mongoUriLooksLikeReplicaSet === 'function') {
      return flags.mongoUriLooksLikeReplicaSet(uri);
    }
  } catch {
    /* ignore */
  }
  const u = String(uri || '');
  return /(?:[?&]replicaSet=)|(?:mongodb\+srv:\/\/)/i.test(u);
}

/** Disable CQRS for this process so LIVE legacy routes can boot. */
function forceDisableCqrs(reason) {
  // eslint-disable-next-line no-console
  console.error(`[validateEnv] ${reason}`);
  process.env.ENABLE_CQRS = 'false';
  for (const k of CQRS_FLAG_KEYS) {
    process.env[k] = 'false';
  }
}

function validateEnv() {
  const isProd = process.env.NODE_ENV === 'production';
  const minLen = isProd ? 32 : 16;

  const jwt = process.env.JWT_SECRET || '';
  const jwr = process.env.JWT_REFRESH_SECRET || '';
  if (jwt.length < minLen) {
    throw new Error(
      `JWT_SECRET must be at least ${minLen} characters (use: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")`,
    );
  }
  if (jwr.length < minLen) {
    throw new Error(
      `JWT_REFRESH_SECRET must be at least ${minLen} characters and MUST differ from JWT_SECRET`,
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
      'SEPAY_API_KEY or SEPAY_SECRET_KEY is required in production (webhook fail-closed)',
    );
  }

  if (isProd && !(process.env.REDIS_URL || '').trim()) {
    throw new Error('REDIS_URL is required when NODE_ENV=production (queue / cache)');
  }

  if (isProd) {
    if (!(process.env.SMTP_HOST || '').trim()) throw new Error('SMTP_HOST is required in production');
    if (!(process.env.SMTP_PORT || '').trim()) throw new Error('SMTP_PORT is required in production');
    if (!(process.env.SMTP_USER || '').trim()) throw new Error('SMTP_USER is required in production');
    if (!(process.env.SMTP_PASS || '').trim()) throw new Error('SMTP_PASS is required in production');
  }

  if (isProd && (process.env.STORAGE_PROVIDER === 's3' || (process.env.AWS_ACCESS_KEY_ID || '').trim())) {
    if (!(process.env.AWS_ACCESS_KEY_ID || '').trim()) throw new Error('AWS_ACCESS_KEY_ID is required for s3 storage');
    if (!(process.env.AWS_SECRET_ACCESS_KEY || '').trim()) throw new Error('AWS_SECRET_ACCESS_KEY is required for s3 storage');
    if (!(process.env.AWS_REGION || '').trim()) throw new Error('AWS_REGION is required for s3 storage');
    if (!(process.env.S3_BUCKET || '').trim()) throw new Error('S3_BUCKET is required for s3 storage');
  }

  // Wave 6.1: production CQRS needs explicit allow — otherwise force legacy
  if (isProd && cqrsFlagsEnabled()) {
    const allow =
      String(process.env.ALLOW_CQRS_IN_PRODUCTION || '').toLowerCase() === 'true'
      || process.env.ALLOW_CQRS_IN_PRODUCTION === '1';
    if (!allow) {
      forceDisableCqrs(
        'CQRS flags on in production without ALLOW_CQRS_IN_PRODUCTION — forcing ENABLE_CQRS_*=false (legacy boot).',
      );
    }
  }

  // Phase A: CQRS needs replica set / Atlas. Missing RS → legacy, do not crash API.
  if (cqrsFlagsEnabled()) {
    const uri = process.env.MONGODB_URI || '';
    if (!mongoUriLooksLikeReplicaSet(uri)) {
      forceDisableCqrs(
        'CQRS flags require MongoDB replica set but MONGODB_URI has none — forcing ENABLE_CQRS_*=false so API can boot. '
        + 'Later: add ?replicaSet=rs0 or mongodb+srv://, then re-enable flags. See docs/architecture/cqrs-phase-a-rollout.md',
      );
    }
  }
}

module.exports = validateEnv;
module.exports.cqrsFlagsEnabled = cqrsFlagsEnabled;
module.exports.mongoUriLooksLikeReplicaSet = mongoUriLooksLikeReplicaSet;
module.exports.forceDisableCqrs = forceDisableCqrs;
