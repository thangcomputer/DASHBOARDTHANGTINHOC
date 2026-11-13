'use strict';

const LAST_PATH_TOPIC_STORAGE_PREFIX = 'cms_last_path_topic';

function lastPathTopicStorageKey(userId = '') {
  const id = String(userId || '').trim();
  return `${LAST_PATH_TOPIC_STORAGE_PREFIX}:${id || 'anonymous'}`;
}

function resolveActivePathTopicRow(topics, { initialTopicId = '', savedTopicId = '' } = {}) {
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

function pickActivePathTopic(path, initialTopicId = '', savedTopicId = '') {
  return resolveActivePathTopicRow(path?.topics || [], { initialTopicId, savedTopicId });
}

function coalesceSavedPathTopicId(localId = '', serverId = '') {
  const server = String(serverId || '').trim();
  const local = String(localId || '').trim();
  return server || local;
}

function pathTopicHasLearningProgress(topicRow) {
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

function pathTopicPrimaryCtaLabel(topicRow) {
  return pathTopicHasLearningProgress(topicRow) ? 'Tiếp tục học' : 'Bắt đầu';
}

function pathTopicNextLinePrefix(topicRow) {
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

function unitStageCtaLabel(unit, { isNextUnit = false } = {}) {
  if (!unit || unit.state === 'locked') return null;
  if (unit.state === 'completed') return 'Ôn lại';
  if (unitHasTouchedProgress(unit) || isNextUnit) return 'Tiếp tục học';
  return 'Bắt đầu';
}

module.exports = {
  LAST_PATH_TOPIC_STORAGE_PREFIX,
  lastPathTopicStorageKey,
  resolveActivePathTopicRow,
  pickActivePathTopic,
  coalesceSavedPathTopicId,
  pathTopicHasLearningProgress,
  pathTopicPrimaryCtaLabel,
  pathTopicNextLinePrefix,
  unitStageCtaLabel,
};
