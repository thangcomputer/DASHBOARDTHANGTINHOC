/** Vàng đồng nhất trên lộ trình phẳng kiểu Duolingo (nút đã mở). */
export const PATH_MAP_DUO_GOLD = {
  from: '#FFC800',
  to: '#E5A100',
  soft: '#FFFBEB',
  text: '#B45309',
};

/** Màu từng mốc lộ trình (web + mobile) — nút và vòng tiến độ cùng tông. */
export const PATH_NODE_ICON_COLORS = {
  book: { from: '#4ADE80', to: '#16A34A', soft: '#F0FDF4', text: '#15803D' },
  dumbbell: { from: '#38BDF8', to: '#0284C7', soft: '#F0F9FF', text: '#0369A1' },
  flame: { from: '#FB923C', to: '#EA580C', soft: '#FFF7ED', text: '#C2410C' },
  crown: { from: '#FBBF24', to: '#D97706', soft: '#FFFBEB', text: '#B45309' },
};

/** Chuỗi màu theo thứ tự mốc trong chặng (Học → Luyện → Thử thách → …). */
export const PATH_NODE_SEQUENCE = [
  PATH_NODE_ICON_COLORS.book,
  { from: '#2DD4BF', to: '#0D9488', soft: '#F0FDFA', text: '#0F766E' },
  PATH_NODE_ICON_COLORS.flame,
  { from: '#818CF8', to: '#4F46E5', soft: '#EEF2FF', text: '#4338CA' },
  PATH_NODE_ICON_COLORS.crown,
];

function resolveIconKey(node) {
  if (!node) return 'book';
  if (node.kind === 'study') return 'book';
  const icon = String(node.icon || 'dumbbell').toLowerCase();
  if (PATH_NODE_ICON_COLORS[icon]) return icon;
  return 'dumbbell';
}

/** Màu mốc: ưu tiên vị trí trong chặng, icon là fallback. `mapDuo` = vàng đồng loạt. */
export function pathNodeColor(node, index = 0, opts = {}) {
  if (opts.mapDuo) return PATH_MAP_DUO_GOLD;
  const i = Math.max(0, Number(index) || 0);
  if (PATH_NODE_SEQUENCE[i]) return PATH_NODE_SEQUENCE[i];
  const key = resolveIconKey(node);
  return PATH_NODE_ICON_COLORS[key] || PATH_NODE_ICON_COLORS.dumbbell;
}
