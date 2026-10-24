function isMobileMultiSessionAuthEnabled(env = process.env) {
  return String(env.MOBILE_MULTI_SESSION_AUTH || '').trim().toLowerCase() === 'true';
}

module.exports = { isMobileMultiSessionAuthEnabled };
