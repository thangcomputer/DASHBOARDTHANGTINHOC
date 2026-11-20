'use strict';

const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCK_DURATION_MS = 15 * 60 * 1000;
const LOGIN_LOCK_DURATION_SECONDS = Math.round(LOGIN_LOCK_DURATION_MS / 1000);

// IP+phone failure tracker for config-backed Super Admin (avoids global DB DoS while protecting locally).
const masterAdminFailures = new Map();
const PRUNE_INTERVAL_MS = 5 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of masterAdminFailures.entries()) {
    if (!entry) {
      masterAdminFailures.delete(key);
      continue;
    }
    const lockExpired = entry.lockUntilMs && entry.lockUntilMs <= now;
    const windowExpired = entry.windowResetAt && entry.windowResetAt <= now && !entry.lockUntilMs;
    if (lockExpired || windowExpired) {
      masterAdminFailures.delete(key);
    }
  }
}, PRUNE_INTERVAL_MS).unref?.();

function computeRemainingSeconds(targetMs, nowMs = Date.now()) {
  if (!Number.isFinite(targetMs) || targetMs <= nowMs) return 0;
  return Math.max(1, Math.ceil((targetMs - nowMs) / 1000));
}

function getAccountLockSeconds(doc, lockField = 'lockUntil', nowMs = Date.now()) {
  if (!doc) return 0;
  const raw = doc[lockField];
  if (!raw) return 0;
  const lockMs = raw instanceof Date ? raw.getTime() : new Date(raw).getTime();
  return computeRemainingSeconds(lockMs, nowMs);
}

/**
 * Atomically increments failed login attempts on a Student or Teacher document
 * and locks the account for LOGIN_LOCK_DURATION_MS after LOGIN_MAX_ATTEMPTS.
 */
async function incrementAccountLoginAttempts({
  doc,
  lockField = 'lockUntil',
  nowMs = Date.now(),
  maxAttempts = LOGIN_MAX_ATTEMPTS,
  lockDurationMs = LOGIN_LOCK_DURATION_MS,
}) {
  const lockDurationSeconds = Math.max(1, Math.ceil(lockDurationMs / 1000));
  if (!doc) {
    return {
      attempts: 0,
      maxAttempts,
      remainingAttempts: maxAttempts,
      isLocked: false,
      lockUntil: null,
      lockSeconds: 0,
      lockDurationSeconds,
    };
  }

  const rawLock = doc[lockField];
  const existingLockMs = rawLock ? new Date(rawLock).getTime() : NaN;

  if (Number.isFinite(existingLockMs) && existingLockMs > nowMs) {
    return {
      attempts: Math.max(maxAttempts, Number(doc.loginAttempts || maxAttempts)),
      maxAttempts,
      remainingAttempts: 0,
      isLocked: true,
      lockUntil: new Date(existingLockMs),
      lockSeconds: computeRemainingSeconds(existingLockMs, nowMs),
      lockDurationSeconds,
    };
  }

  const hasAtomicModel = typeof doc?.constructor?.findOneAndUpdate === 'function' && doc._id;

  if (Number.isFinite(existingLockMs) && existingLockMs <= nowMs) {
    if (hasAtomicModel) {
      await doc.constructor.updateOne(
        { _id: doc._id },
        { $set: { loginAttempts: 1 }, $unset: { [lockField]: 1 } },
      );
    } else if (typeof doc.updateOne === 'function') {
      await doc.updateOne({ $set: { loginAttempts: 1 }, $unset: { [lockField]: 1 } });
    }
    doc.loginAttempts = 1;
    doc[lockField] = undefined;
    return {
      attempts: 1,
      maxAttempts,
      remainingAttempts: Math.max(0, maxAttempts - 1),
      isLocked: false,
      lockUntil: null,
      lockSeconds: 0,
      lockDurationSeconds,
    };
  }

  let nextAttempts;
  if (hasAtomicModel) {
    const updated = await doc.constructor
      .findOneAndUpdate(
        { _id: doc._id },
        { $inc: { loginAttempts: 1 } },
        { returnDocument: 'after' },
      )
      .select(`loginAttempts ${lockField}`)
      .lean();
    nextAttempts = Math.max(1, Number(updated?.loginAttempts ?? ((Number(doc.loginAttempts) || 0) + 1)));
  } else {
    nextAttempts = Math.max(1, (Number(doc.loginAttempts) || 0) + 1);
    const updates = { $inc: { loginAttempts: 1 } };
    if (nextAttempts >= maxAttempts) {
      updates.$set = { [lockField]: new Date(nowMs + lockDurationMs) };
    }
    if (typeof doc.updateOne === 'function') {
      await doc.updateOne(updates);
    }
  }

  doc.loginAttempts = nextAttempts;

  if (nextAttempts >= maxAttempts) {
    const lockUntil = new Date(nowMs + lockDurationMs);
    if (hasAtomicModel) {
      await doc.constructor.updateOne(
        { _id: doc._id },
        { $set: { [lockField]: lockUntil } },
      );
    }
    doc[lockField] = lockUntil;
    return {
      attempts: nextAttempts,
      maxAttempts,
      remainingAttempts: 0,
      isLocked: true,
      lockUntil,
      lockSeconds: lockDurationSeconds,
      lockDurationSeconds,
    };
  }

  return {
    attempts: nextAttempts,
    maxAttempts,
    remainingAttempts: Math.max(0, maxAttempts - nextAttempts),
    isLocked: false,
    lockUntil: null,
    lockSeconds: 0,
    lockDurationSeconds,
  };
}

function masterAdminKey(ipKey, phone) {
  return `${String(ipKey || 'local').trim()}:${String(phone || '').trim()}`;
}

function getMasterAdminLockState(ipKey, phone, nowMs = Date.now()) {
  const key = masterAdminKey(ipKey, phone);
  const entry = masterAdminFailures.get(key);
  if (!entry) {
    return {
      attempts: 0,
      maxAttempts: LOGIN_MAX_ATTEMPTS,
      remainingAttempts: LOGIN_MAX_ATTEMPTS,
      isLocked: false,
      lockUntil: null,
      lockSeconds: 0,
      lockDurationSeconds: LOGIN_LOCK_DURATION_SECONDS,
    };
  }
  if (entry.lockUntilMs) {
    if (entry.lockUntilMs > nowMs) {
      return {
        attempts: entry.attempts,
        maxAttempts: LOGIN_MAX_ATTEMPTS,
        remainingAttempts: 0,
        isLocked: true,
        lockUntil: new Date(entry.lockUntilMs),
        lockSeconds: computeRemainingSeconds(entry.lockUntilMs, nowMs),
        lockDurationSeconds: LOGIN_LOCK_DURATION_SECONDS,
      };
    }
    masterAdminFailures.delete(key);
    return {
      attempts: 0,
      maxAttempts: LOGIN_MAX_ATTEMPTS,
      remainingAttempts: LOGIN_MAX_ATTEMPTS,
      isLocked: false,
      lockUntil: null,
      lockSeconds: 0,
      lockDurationSeconds: LOGIN_LOCK_DURATION_SECONDS,
    };
  }
  if (entry.windowResetAt && entry.windowResetAt <= nowMs) {
    masterAdminFailures.delete(key);
    return {
      attempts: 0,
      maxAttempts: LOGIN_MAX_ATTEMPTS,
      remainingAttempts: LOGIN_MAX_ATTEMPTS,
      isLocked: false,
      lockUntil: null,
      lockSeconds: 0,
      lockDurationSeconds: LOGIN_LOCK_DURATION_SECONDS,
    };
  }
  return {
    attempts: entry.attempts,
    maxAttempts: LOGIN_MAX_ATTEMPTS,
    remainingAttempts: Math.max(0, LOGIN_MAX_ATTEMPTS - entry.attempts),
    isLocked: false,
    lockUntil: null,
    lockSeconds: 0,
    lockDurationSeconds: LOGIN_LOCK_DURATION_SECONDS,
  };
}

function recordMasterAdminFailure(ipKey, phone, nowMs = Date.now()) {
  const key = masterAdminKey(ipKey, phone);
  const current = getMasterAdminLockState(ipKey, phone, nowMs);
  if (current.isLocked) return current;

  const attempts = current.attempts + 1;
  if (attempts >= LOGIN_MAX_ATTEMPTS) {
    const lockUntilMs = nowMs + LOGIN_LOCK_DURATION_MS;
    masterAdminFailures.set(key, { attempts, lockUntilMs, windowResetAt: lockUntilMs });
    return {
      attempts,
      maxAttempts: LOGIN_MAX_ATTEMPTS,
      remainingAttempts: 0,
      isLocked: true,
      lockUntil: new Date(lockUntilMs),
      lockSeconds: LOGIN_LOCK_DURATION_SECONDS,
      lockDurationSeconds: LOGIN_LOCK_DURATION_SECONDS,
    };
  }

  masterAdminFailures.set(key, {
    attempts,
    lockUntilMs: 0,
    windowResetAt: nowMs + LOGIN_LOCK_DURATION_MS,
  });
  return {
    attempts,
    maxAttempts: LOGIN_MAX_ATTEMPTS,
    remainingAttempts: Math.max(0, LOGIN_MAX_ATTEMPTS - attempts),
    isLocked: false,
    lockUntil: null,
    lockSeconds: 0,
    lockDurationSeconds: LOGIN_LOCK_DURATION_SECONDS,
  };
}

function resetMasterAdminFailures(ipKey, phone) {
  masterAdminFailures.delete(masterAdminKey(ipKey, phone));
}

function buildTemporarilyLockedPayload({
  maxAttempts = LOGIN_MAX_ATTEMPTS,
  lockSeconds,
  lockUntil = null,
  lockDurationSeconds = LOGIN_LOCK_DURATION_SECONDS,
}) {
  const safeSeconds = Math.max(1, Math.ceil(Number(lockSeconds) || lockDurationSeconds));
  return {
    success: false,
    publicMessage: true,
    code: 'LOGIN_TEMPORARILY_LOCKED',
    message: `Sai mật khẩu quá ${maxAttempts} lần.`,
    remainingAttempts: 0,
    maxAttempts,
    retryAfterSeconds: safeSeconds,
    lockDurationSeconds,
    ...(lockUntil ? { lockUntil: new Date(lockUntil).toISOString() } : {}),
  };
}

function buildWrongPasswordPayload({ basePayload, attemptInfo }) {
  const maxAttempts = Number(attemptInfo?.maxAttempts || LOGIN_MAX_ATTEMPTS);
  const remainingAttempts = Number(attemptInfo?.remainingAttempts);
  const lockDurationSeconds = Number(attemptInfo?.lockDurationSeconds || LOGIN_LOCK_DURATION_SECONDS);
  const hasCounts = Number.isFinite(remainingAttempts) && remainingAttempts > 0;

  return {
    ...basePayload,
    ...(hasCounts ? { remainingAttempts, maxAttempts, lockDurationSeconds } : {}),
  };
}

module.exports = {
  LOGIN_MAX_ATTEMPTS,
  LOGIN_LOCK_DURATION_MS,
  LOGIN_LOCK_DURATION_SECONDS,
  computeRemainingSeconds,
  getAccountLockSeconds,
  incrementAccountLoginAttempts,
  getMasterAdminLockState,
  recordMasterAdminFailure,
  resetMasterAdminFailures,
  buildTemporarilyLockedPayload,
  buildWrongPasswordPayload,
};
