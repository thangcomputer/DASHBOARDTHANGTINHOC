'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.join(__dirname, '../..');
const loadMjs = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);

test('pathNodeNudgeLabel shows BẮT ĐẦU when untouched and TIẾP TỤC when started', async () => {
  const { pathNodeNudgeLabel, pathNodeStartBubbleLabel } = await loadMjs('shared/dailyPractice/pathNodeNudge.mjs');

  const untouchedQuizNode = {
    key: 'practice-1',
    state: 'active',
    levels: [
      { key: 'learn', state: 'active' },
      { key: 'practice', state: 'locked' },
      { key: 'challenge', state: 'locked' },
    ],
  };
  assert.equal(pathNodeNudgeLabel(untouchedQuizNode), 'BẮT ĐẦU');

  const partialQuizNode = {
    key: 'practice-1',
    state: 'active',
    levels: [
      { key: 'learn', state: 'completed' },
      { key: 'practice', state: 'active' },
      { key: 'challenge', state: 'locked' },
    ],
  };
  assert.equal(pathNodeNudgeLabel(partialQuizNode), 'TIẾP TỤC');

  const untouchedStudyNode = {
    key: 'study',
    kind: 'study',
    icon: 'book',
    state: 'active',
    levels: [{ key: 'lesson-1', state: 'active' }],
  };
  assert.equal(pathNodeStartBubbleLabel(untouchedStudyNode, []), 'BẮT ĐẦU');
  assert.equal(pathNodeStartBubbleLabel(untouchedStudyNode, ['other:easy:content']), 'BẮT ĐẦU');
  assert.equal(pathNodeStartBubbleLabel(untouchedStudyNode, ['study:easy:content']), 'TIẾP TỤC');
});

test('pathHubLevelStates resolves 3-segment completion for study and quiz nodes', async () => {
  const {
    PATH_HUB_PROGRESS_RING,
    pathHubLevelStates,
    pathHubNodeProgress,
  } = await loadMjs('shared/dailyPractice/pathHubProgressRing.mjs');
  const { PATH_HUB_DUO } = await loadMjs('shared/dailyPractice/pathHubDuoVisual.mjs');

  assert.equal(PATH_HUB_DUO.showProgressRing, true);
  assert.equal(PATH_HUB_PROGRESS_RING.segmentAngles.length, 3);

  const studyNode = {
    key: 'study',
    kind: 'study',
    icon: 'book',
    state: 'active',
    levelConfigs: {
      easy: { sectionOrder: ['content', 'video'], hiddenSections: [] },
      medium: { sectionOrder: ['content', 'practice'], hiddenSections: ['practice'] },
      hard: { sectionOrder: ['content'], hiddenSections: [] },
    },
  };

  assert.deepEqual(pathHubLevelStates(studyNode, []), [false, false, false]);
  assert.equal(pathHubNodeProgress(studyNode, []), 0);

  // Easy partially finished -> still 0/3 full ring segments until all easy sections done
  assert.deepEqual(pathHubLevelStates(studyNode, ['study:easy:content']), [false, false, false]);

  // Easy completed -> segment 1 lights up
  assert.deepEqual(pathHubLevelStates(studyNode, ['study:easy:content', 'study:easy:video']), [true, false, false]);

  // Easy + Medium completed -> 2/3 lit up
  assert.deepEqual(
    pathHubLevelStates(studyNode, ['study:easy:content', 'study:easy:video', 'study:medium:content']),
    [true, true, false],
  );

  // Completed node -> all 3 segments lit up
  assert.deepEqual(pathHubLevelStates({ ...studyNode, state: 'completed' }, []), [true, true, true]);

  const quizNode = {
    key: 'practice-1',
    kind: 'quiz',
    state: 'active',
    levels: [
      { key: 'learn', state: 'completed' },
      { key: 'practice', state: 'completed' },
      { key: 'challenge', state: 'active' },
    ],
  };
  assert.deepEqual(pathHubLevelStates(quizNode), [true, true, false]);
});

test('path droplets use glossy silhouette and sit cleanly in open path segments', async () => {
  const { PATH_DROPLET } = await loadMjs('shared/dailyPractice/pathDropletDecor.mjs');
  const { dewSkillDropletPoints } = await loadMjs('shared/dailyPractice/dewSkillJourneyAnchors.mjs');
  const { dewSkillPlainAnchorsForCount } = await loadMjs('shared/dailyPractice/pathPlainJourney.mjs');

  assert.ok(PATH_DROPLET.glossyPath && PATH_DROPLET.fillDoneTop && PATH_DROPLET.fillTodoTop);
  const anchors = dewSkillPlainAnchorsForCount(3);
  const drops = dewSkillDropletPoints(anchors);
  assert.ok(drops.length >= 2);
  assert.ok(drops.every((d) => d.kind === 'droplet'));
});
