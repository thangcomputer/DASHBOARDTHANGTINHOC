/**
 * Phase 7.1 — Controlled Policy cutover infrastructure (LEGACY-RESTORE TOGGLE).
 *
 * Default / fail-safe: LEGACY authority for every family.
 * Policy authority is ONLY possible when BOTH:
 *   POLICY_CUTOVER_ENABLED=true|1
 *   AND family is explicitly listed in POLICY_CUTOVER_ROUTES
 *
 * This module does NOT enforce authorization and does NOT alter HTTP.
 * No route may call this for primary deny/allow until an explicit cutover wave.
 *
 * Recommended first future candidate: monitoring (/api/monitoring)
 * — NOT enabled in this phase.
 */

const AUTHORITY = Object.freeze({
  LEGACY: 'LEGACY',
  POLICY: 'POLICY',
});

/** Families eligible for future allowlist opt-in (must match LIVE shadow coverage). */
const KNOWN_FAMILIES = Object.freeze(new Set([
  'auth',
  'students',
  'invoices',
  'messages',
  'schedules',
  'courses',
  'teachers',
  'assignments',
  'quizzes',
  'evaluations',
  'exam-results',
  'system-logs',
  'training',
  'training-lms',
  'transactions',
  'settings',
  'webhooks',
  'staff',
  'branches',
  'analytics',
  'employees',
  'notifications',
  'files',
  'backups',
  'monitoring',
  'proctor',
  'ai',
  'bi',
  'finance',
  'workflows',
  'builder',
  'tenants',
  'feed',
  'blog',
]));

/** Documented first future cutover candidate — must stay OFF until explicit wave. */
const RECOMMENDED_FIRST_CUTOVER_FAMILY = 'monitoring';

const FAMILY_ALIASES = Object.freeze({
  'system_logs': 'system-logs',
  systemlogs: 'system-logs',
  'exam_results': 'exam-results',
  examresults: 'exam-results',
  'training_lms': 'training-lms',
  traininglms: 'training-lms',
});

/**
 * Parse env boolean. Malformed / unknown → false (Legacy fail-safe).
 * Never reads request / role / body.
 */
function parseEnabledFlag(raw) {
  if (raw === undefined || raw === null) return false;
  if (typeof raw === 'boolean') return raw === true;
  if (typeof raw !== 'string' && typeof raw !== 'number') return false;
  const s = String(raw).trim().toLowerCase();
  if (s === '' || s === 'false' || s === '0' || s === 'no' || s === 'off') return false;
  if (s === 'true' || s === '1' || s === 'yes' || s === 'on') return true;
  return false;
}

/**
 * Normalize a route family token.
 * Accepts: monitoring | /api/monitoring | api/monitoring
 * Unknown / empty → null (caller treats as Legacy).
 */
function normalizeFamily(raw) {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'string' && typeof raw !== 'number') return null;
  let s = String(raw).trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/^\/+/, '');
  if (s.startsWith('api/')) s = s.slice(4);
  s = s.replace(/\/+$/, '');
  if (!s || s.includes('*') || s.includes('?')) return null; // no wildcards
  if (FAMILY_ALIASES[s]) s = FAMILY_ALIASES[s];
  // Reject path segments beyond family (e.g. monitoring/health)
  if (s.includes('/')) s = s.split('/')[0];
  if (!KNOWN_FAMILIES.has(s)) return null;
  return s;
}

/**
 * Parse allowlist. Malformed → empty (Legacy).
 * Duplicates collapsed. Whitespace/comma/semicolon separators.
 */
function parseRouteAllowlist(raw) {
  if (raw === undefined || raw === null) return [];
  if (typeof raw !== 'string') return [];
  const parts = raw.split(/[,;\s]+/);
  const out = [];
  const seen = new Set();
  for (const part of parts) {
    const fam = normalizeFamily(part);
    if (!fam) continue;
    if (seen.has(fam)) continue;
    seen.add(fam);
    out.push(fam);
  }
  return out;
}

function readCutoverConfigFromEnv(env = process.env) {
  try {
    const enabled = parseEnabledFlag(env?.POLICY_CUTOVER_ENABLED);
    const routes = parseRouteAllowlist(env?.POLICY_CUTOVER_ROUTES);
    return { enabled, routes, valid: true };
  } catch {
    return { enabled: false, routes: [], valid: false };
  }
}

/**
 * Deterministic authority selector. Side-effect free.
 * Ignores any request/user/role/header/query/body — second arg is intentionally unused
 * so future call sites cannot accidentally pass client trust.
 *
 * @param {string} routeFamily
 * @param {unknown} [_ignoredRequestContext] — MUST NOT influence decision
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {'LEGACY'|'POLICY'}
 */
function getAuthorizationAuthority(routeFamily, _ignoredRequestContext, env = process.env) {
  void _ignoredRequestContext;
  try {
    const { enabled, routes } = readCutoverConfigFromEnv(env);
    if (!enabled) return AUTHORITY.LEGACY;

    const family = normalizeFamily(routeFamily);
    if (!family) return AUTHORITY.LEGACY;
    if (!routes.includes(family)) return AUTHORITY.LEGACY;

    return AUTHORITY.POLICY;
  } catch {
    return AUTHORITY.LEGACY;
  }
}

function shouldPolicyBeAuthoritative(routeFamily, _ignoredRequestContext, env = process.env) {
  return getAuthorizationAuthority(routeFamily, _ignoredRequestContext, env) === AUTHORITY.POLICY;
}

/** Runtime proof helper: true only if a family would actually be Policy-primary. */
function isAnyCutoverFamilyActive(env = process.env) {
  const { enabled, routes } = readCutoverConfigFromEnv(env);
  if (!enabled || !routes.length) return false;
  return routes.some((f) => KNOWN_FAMILIES.has(f));
}

module.exports = {
  AUTHORITY,
  KNOWN_FAMILIES,
  RECOMMENDED_FIRST_CUTOVER_FAMILY,
  parseEnabledFlag,
  normalizeFamily,
  parseRouteAllowlist,
  readCutoverConfigFromEnv,
  getAuthorizationAuthority,
  shouldPolicyBeAuthoritative,
  isAnyCutoverFamilyActive,
};
