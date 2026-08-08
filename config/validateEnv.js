/**
 * Fail-fast validation for required secrets and production invariants.
 * Call immediately after dotenv.config().
 */
const { cqrsFlagsEnabled, mongoUriLooksLikeReplicaSet } = require('../shared/cqrs/flags');

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

  // CQRS multi-doc transactions need a replica set (or Atlas mongodb+srv)
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
}

module.exports = validateEnv;
module.exports.cqrsFlagsEnabled = cqrsFlagsEnabled;
module.exports.mongoUriLooksLikeReplicaSet = mongoUriLooksLikeReplicaSet;
