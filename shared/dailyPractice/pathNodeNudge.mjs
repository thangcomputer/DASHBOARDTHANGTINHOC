/** Mốc đã có ít nhất 1 phần/nấc hoàn thành → Tiếp tục, chưa học gì → Bắt đầu. */
export function pathNodeNudgeLabel(node, completedSections = []) {
  if (!node) return 'BẮT ĐẦU';
  const levels = node.levels || [];
  const lessons = node.lessons || [];
  const prefix = `${node.key}:`;
  const hasSectionDone = Array.isArray(completedSections)
    && completedSections.some((key) => String(key || '').startsWith(prefix));
  const hasLevelDone = levels.some((l) => l.state === 'completed')
    || lessons.some((l) => l.state === 'completed');
  return (hasSectionDone || hasLevelDone) ? 'TIẾP TỤC' : 'BẮT ĐẦU';
}

/** Nhãn dưới nút — chỉ tên mốc (giống mẫu Duolingo). */
export function pathNodeMapLabel(node) {
  return String(node?.label || '').trim();
}

/** Bubble phía trên mốc đang học. */
export function pathNodeStartBubbleLabel(node, completedSections = []) {
  return pathNodeNudgeLabel(node, completedSections);
}
