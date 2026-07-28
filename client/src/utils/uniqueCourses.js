/** Deduplicate admin Course catalog for enrollment / LMS pickers. */

function normName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

/**
 * Unique courses by name (prefer published). Skip archived.
 * @param {Array} courses
 * @returns {Array}
 */
export function uniqueCoursesByName(courses) {
  const seen = new Set();
  const out = [];
  const list = [...(courses || [])].sort((a, b) => {
    const ap = a?.status === 'published' ? 0 : a?.status === 'draft' ? 1 : 2;
    const bp = b?.status === 'published' ? 0 : b?.status === 'draft' ? 1 : 2;
    if (ap !== bp) return ap - bp;
    return String(a?.name || '').localeCompare(String(b?.name || ''), 'vi');
  });

  for (const c of list) {
    if (!c || c.status === 'archived') continue;
    const key = normName(c.name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}
