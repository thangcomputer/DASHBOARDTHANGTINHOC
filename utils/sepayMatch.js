/**
 * Helpers match SePay — tách để unit test (audit M10).
 */
function extractStudentCodeCandidates(content) {
  const c = String(content || '').toLowerCase();
  const codeCandidates = new Set();
  for (const m of c.matchAll(/\bhv[a-z0-9]{4,16}\b/g)) {
    codeCandidates.add(m[0]);
  }
  for (const m of c.matchAll(/[a-z0-9]{5,16}/g)) {
    if (codeCandidates.size >= 40) break;
    codeCandidates.add(m[0]);
  }
  const variants = new Set();
  for (const t of codeCandidates) {
    variants.add(t);
    variants.add(t.toUpperCase());
    if (t.startsWith('hv')) variants.add(`HV${t.slice(2)}`);
  }
  return [...variants];
}

function amountsMatch(expected, actual, tolerance = 1) {
  const a = Number(expected);
  const b = Number(actual);
  if (!(a > 0)) return true;
  return Math.abs(a - b) <= tolerance;
}

module.exports = { extractStudentCodeCandidates, amountsMatch };
