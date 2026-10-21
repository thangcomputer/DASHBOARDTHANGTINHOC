function positiveSeconds(value) {
  return Math.max(0, Math.round(Number(value) || 0));
}

export function resolvePracticeGroupTimeLimit(groupLimits, groupId, fallbackLimitSec = 0) {
  const configured = (Array.isArray(groupLimits) ? groupLimits : [])
    .find((entry) => String(entry.groupId) === String(groupId));
  return positiveSeconds(configured ? configured.timeLimitSec : fallbackLimitSec);
}

export function resolvePracticeClock(unitLimitSec, itemLimitSec) {
  const sharedLimit = positiveSeconds(unitLimitSec);
  if (sharedLimit > 0) return { limitSec: sharedLimit, shared: true };
  return { limitSec: positiveSeconds(itemLimitSec), shared: false };
}

export function createPracticeClockSession(current, key, limitSec, now = Date.now()) {
  if (current?.key === key) return current;
  return { key, deadline: now + limitSec * 1000 };
}

export function restorePracticeClockSession(current, key, limitSec, remainingSec, now = Date.now()) {
  if (current?.key === key) return current;
  const configuredLimit = positiveSeconds(limitSec);
  const savedRemaining = remainingSec == null ? Number.NaN : Number(remainingSec);
  const restoredLimit = Number.isFinite(savedRemaining)
    ? Math.min(configuredLimit, Math.max(0, Math.round(savedRemaining)))
    : configuredLimit;
  return { key, deadline: now + restoredLimit * 1000 };
}

export function remainingPracticeSeconds(session, now = Date.now()) {
  return Math.max(0, Math.ceil((session.deadline - now) / 1000));
}
