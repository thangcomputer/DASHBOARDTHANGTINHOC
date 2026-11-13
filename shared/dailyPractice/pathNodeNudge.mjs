/** Mốc đã có tiến độ → Tiếp tục, chưa → Bắt đầu. */
export function pathNodeNudgeLabel(node) {
  if (!node) return 'BẮT ĐẦU';
  const levels = node.levels || [];
  const lessons = node.lessons || [];
  const touched =
    levels.some((l) => l.state === 'completed' || l.state === 'active')
    || lessons.some((l) => l.state === 'completed' || l.state === 'active');
  return touched ? 'TIẾP TỤC' : 'BẮT ĐẦU';
}

/** Nhãn dưới nút — chỉ tên mốc (giống mẫu Duolingo). */
export function pathNodeMapLabel(node) {
  return String(node?.label || '').trim();
}

/** Bubble phía trên mốc đang học. */
export function pathNodeStartBubbleLabel(node) {
  return pathNodeNudgeLabel(node);
}
