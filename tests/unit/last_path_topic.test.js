const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { pickActivePathTopic, lastPathTopicStorageKey } = require('../../shared/dailyPractice/lastPathTopic.cjs');

describe('lastPathTopic', () => {
  const topics = [
    { topic: { id: 'win', name: 'Windows' }, completedUnits: 5, totalUnits: 5, next: null },
    { topic: { id: 'word', name: 'Word' }, completedUnits: 0, totalUnits: 1, next: { unitId: 'u1' } },
    { topic: { id: 'excel', name: 'Excel' }, completedUnits: 0, totalUnits: 1, next: { unitId: 'u2' } },
  ];

  it('ưu tiên chủ đề đã lưu hơn môn đầu tiên đã hoàn thành', () => {
    const picked = pickActivePathTopic({ topics }, '', 'word');
    assert.equal(picked.topic.id, 'word');
  });

  it('URL topicId vẫn ưu tiên hơn đã lưu', () => {
    const picked = pickActivePathTopic({ topics }, 'excel', 'word');
    assert.equal(picked.topic.id, 'excel');
  });

  it('storage key theo user', () => {
    assert.equal(lastPathTopicStorageKey('abc'), 'cms_last_path_topic:abc');
    assert.equal(lastPathTopicStorageKey(), 'cms_last_path_topic:anonymous');
  });

  it('server ưu tiên hơn local khi đồng bộ', () => {
    const { coalesceSavedPathTopicId } = require('../../shared/dailyPractice/lastPathTopic.cjs');
    assert.equal(coalesceSavedPathTopicId('win', 'word'), 'word');
    assert.equal(coalesceSavedPathTopicId('word', ''), 'word');
  });

  it('CTA lộ trình: chưa học thì Bắt đầu', () => {
    const {
      pathTopicHasLearningProgress,
      pathTopicPrimaryCtaLabel,
    } = require('../../shared/dailyPractice/lastPathTopic.cjs');
    const fresh = {
      completedUnits: 0,
      units: [{ state: 'active', steps: [{ state: 'active' }], pathNodes: [] }],
    };
    assert.equal(pathTopicHasLearningProgress(fresh), false);
    assert.equal(pathTopicPrimaryCtaLabel(fresh), 'Bắt đầu');
    const touched = {
      completedUnits: 0,
      units: [{ state: 'active', steps: [{ state: 'completed' }], pathNodes: [] }],
    };
    assert.equal(pathTopicPrimaryCtaLabel(touched), 'Tiếp tục học');
  });
});
