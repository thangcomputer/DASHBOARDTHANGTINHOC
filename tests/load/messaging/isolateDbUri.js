'use strict';

/**
 * Force Phase 10 traffic onto an isolated Mongo database.
 * Never mutates production collection data in the primary app DB name.
 */
function toPhase10Uri(uri, dbName = 'dashboardthangtinhoc_p10load') {
  if (!uri || typeof uri !== 'string') {
    throw new Error('MONGODB_URI required for Phase 10 isolation');
  }
  const q = uri.indexOf('?');
  const base = q >= 0 ? uri.slice(0, q) : uri;
  const qs = q >= 0 ? uri.slice(q) : '';
  const replaced = base.replace(/\/([^/?]+)\/?$/, `/${dbName}`);
  if (replaced === base && !/\/[^/?]+$/.test(base)) {
    return `${base.replace(/\/$/, '')}/${dbName}${qs}`;
  }
  return `${replaced}${qs}`;
}

module.exports = { toPhase10Uri };