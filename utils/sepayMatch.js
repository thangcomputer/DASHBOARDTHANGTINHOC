/**
 * Helpers match SePay — tách để unit test (audit M10 / Phase C2).
 * Session-first matching lives in webhookRoutes; this module supports studentCode fallback.
 */

function extractStudentCodeCandidates(content) {
  const c = String(content || '').toLowerCase();
  const codeCandidates = new Set();
  // Canonical / legacy HV… and TTH… business tokens
  for (const m of c.matchAll(/\b(?:hv|tth)[a-z0-9]{4,16}\b/g)) {
    codeCandidates.add(m[0]);
  }
  // Keep loose tokens for session-like content, but settlement still requires exact unpaid match
  for (const m of c.matchAll(/[a-z0-9]{5,16}/g)) {
    if (codeCandidates.size >= 40) break;
    codeCandidates.add(m[0]);
  }
  const variants = new Set();
  for (const t of codeCandidates) {
    variants.add(t);
    variants.add(t.toUpperCase());
    if (t.startsWith('hv')) variants.add(`HV${t.slice(2)}`);
    if (t.startsWith('tth')) variants.add(`TTH${t.slice(3)}`);
  }
  return [...variants];
}

function amountsMatch(expected, actual, tolerance = 1) {
  const a = Number(expected);
  const b = Number(actual);
  // Fail-closed: zero/unknown expected price must not auto-match arbitrary transfers
  if (!(a > 0) || Number.isNaN(a) || Number.isNaN(b)) return false;
  return Math.abs(a - b) <= tolerance;
}

/**
 * Build unpaid students whose studentCode OR legacyStudentCodes hits variants,
 * then filter to exact content containment + amount.
 *
 * FAIL CLOSED when more than one candidate passes filters.
 *
 * @returns {{ status: 'none'|'one'|'ambiguous', candidates: object[], reason?: string }}
 */
function selectUnpaidStudentCandidates(students, content, amount) {
  const c = String(content || '').toLowerCase();
  const list = Array.isArray(students) ? students : [];
  const passed = [];

  for (const s of list) {
    if (!s || s.paid === true) continue;
    const primary = String(s.studentCode || '').toLowerCase().trim();
    const legacy = Array.isArray(s.legacyStudentCodes)
      ? s.legacyStudentCodes.map((x) => String(x || '').toLowerCase().trim()).filter(Boolean)
      : [];
    const identities = [];
    if (primary && primary.length >= 4) identities.push(primary);
    for (const L of legacy) {
      if (L.length >= 4 && !identities.includes(L)) identities.push(L);
    }
    if (!identities.length) continue;

    const hit = identities.find((id) => c.includes(id));
    if (!hit) continue;
    if (!amountsMatch(s.price, amount)) continue;
    passed.push({ student: s, matchedIdentity: hit });
  }

  if (passed.length === 0) {
    return { status: 'none', candidates: [], reason: 'no_match' };
  }
  if (passed.length === 1) {
    return { status: 'one', candidates: passed };
  }
  return {
    status: 'ambiguous',
    candidates: passed,
    reason: 'multiple_unpaid_students_match_identity_and_amount',
  };
}

module.exports = {
  extractStudentCodeCandidates,
  amountsMatch,
  selectUnpaidStudentCandidates,
};
