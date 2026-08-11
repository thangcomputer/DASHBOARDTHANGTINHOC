/**
 * UI-only helpers: learningMode → label, branch → display name.
 * Does NOT infer learningMode from branch.name.
 */

const MODE_LIKE_PHRASES = [
  'online',
  'offline',
  'truc tiep',
  'tai co so',
  'online hoc',
  'hoc online',
  'tai co so hoc',
];

function stripDiacritics(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normalizeBranchText(s) {
  return stripDiacritics(s)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @param {string} learningMode
 * @returns {'Trực tiếp'|'Online'}
 */
export function resolveLearningModeLabel(learningMode) {
  return String(learningMode || '').toUpperCase() === 'ONLINE' ? 'Online' : 'Trực tiếp';
}

/**
 * True when branch.name is essentially a learning-mode synonym
 * (would confuse users if shown next to the mode badge).
 * @param {string} branchName
 * @param {string} [_learningMode] unused — kept for call-site clarity
 */
export function isModeLikeBranchName(branchName, _learningMode) {
  const n = normalizeBranchText(branchName);
  if (!n) return false;
  if (MODE_LIKE_PHRASES.includes(n)) return true;

  const stripped = n
    .replace(/^(chi nhanh|co so|khu|branch|campus)\s+/, '')
    .trim();
  if (MODE_LIKE_PHRASES.includes(stripped)) return true;

  return false;
}

/**
 * @param {{ name?: string, code?: string }|null|undefined} branch
 * @param {string} [learningMode]
 * @returns {string}
 */
export function resolveBranchDisplayName(branch, learningMode) {
  if (!branch) return 'Chưa phân chi nhánh';

  const name = String(branch.name || '').trim();
  const code = String(branch.code || '').trim();

  if (name && !isModeLikeBranchName(name, learningMode)) {
    return name;
  }
  if (code) return code;
  return 'Chưa phân chi nhánh';
}
