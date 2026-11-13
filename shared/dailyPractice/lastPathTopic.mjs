/** Khóa lưu chủ đề lộ trình học viên chọn gần nhất (theo user). */
export const LAST_PATH_TOPIC_STORAGE_PREFIX = 'cms_last_path_topic';

export function lastPathTopicStorageKey(userId = '') {
  const id = String(userId || '').trim();
  return `${LAST_PATH_TOPIC_STORAGE_PREFIX}:${id || 'anonymous'}`;
}

/**
 * Chọn hàng chủ đề lộ trình: URL → đã lưu → đang dở → còn bước tiếp → đầu danh sách.
 * @param {Array<{ topic: { id: string } }>} topics
 */
export function resolveActivePathTopicRow(topics, { initialTopicId = '', savedTopicId = '' } = {}) {
  if (!Array.isArray(topics) || !topics.length) return null;
  const linked = initialTopicId
    ? topics.find((item) => item?.topic?.id === initialTopicId)
    : null;
  const saved = savedTopicId
    ? topics.find((item) => item?.topic?.id === savedTopicId)
    : null;
  const inProgress = topics.find((item) => item?.next && (item.completedUnits || 0) > 0);
  const hasNext = topics.find((item) => item?.next);
  return linked || saved || inProgress || hasNext || topics[0];
}

export function pickActivePathTopic(path, initialTopicId = '', savedTopicId = '') {
  return resolveActivePathTopicRow(path?.topics || [], { initialTopicId, savedTopicId });
}

/** Server (đồng bộ tài khoản) ưu tiên hơn bộ nhớ máy khi còn giá trị. */
export function coalesceSavedPathTopicId(localId = '', serverId = '') {
  const server = String(serverId || '').trim();
  const local = String(localId || '').trim();
  return server || local;
}

/** Đã từng học ít nhất một bước / video / chặng trong chủ đề lộ trình này. */
export function pathTopicHasLearningProgress(topicRow) {
  if (!topicRow) return false;
  if ((topicRow.completedUnits || 0) > 0) return true;
  for (const unit of topicRow.units || []) {
    if (unit.state === 'completed') return true;
    if (unit.state === 'locked') continue;
    for (const step of unit.steps || []) {
      if (step.state === 'completed') return true;
    }
    for (const node of unit.pathNodes || []) {
      for (const level of node.levels || []) {
        if (level.state === 'completed') return true;
      }
      for (const lesson of node.lessons || []) {
        if (lesson.state === 'completed') return true;
      }
      for (const video of node.videos || []) {
        if (video.state === 'completed') return true;
      }
    }
  }
  return false;
}

export function pathTopicPrimaryCtaLabel(topicRow) {
  return pathTopicHasLearningProgress(topicRow) ? 'Tiếp tục học' : 'Bắt đầu';
}

export function pathTopicNextLinePrefix(topicRow) {
  return pathTopicHasLearningProgress(topicRow) ? 'Tiếp theo' : 'Bắt đầu';
}

function unitHasTouchedProgress(unit) {
  if (!unit) return false;
  for (const step of unit.steps || []) {
    if (step.state === 'completed' || step.state === 'active') return true;
  }
  for (const node of unit.pathNodes || []) {
    if (node.state === 'completed' || node.state === 'active') return true;
  }
  return false;
}

/** Nhãn nút hành động trên banner chặng: Bắt đầu / Tiếp tục học / Ôn lại. */
export function unitStageCtaLabel(unit, { isNextUnit = false } = {}) {
  if (!unit || unit.state === 'locked') return null;
  if (unit.state === 'completed') return 'Ôn lại';
  if (unitHasTouchedProgress(unit) || isNextUnit) return 'Tiếp tục học';
  return 'Bắt đầu';
}
