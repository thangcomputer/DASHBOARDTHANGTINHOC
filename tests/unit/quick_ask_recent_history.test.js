'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('quickAskRecentHistory push dedupes and caps at 5', async () => {
  const {
    filterRecentQuickAskForDisplay,
    parseQuickAskRecentList,
    pushQuickAskRecentQuestion,
  } = await import('../../shared/ai/quickAskRecentHistory.mjs');

  let list = [];
  list = pushQuickAskRecentQuestion(list, 'Excel: SUMIF là gì?');
  list = pushQuickAskRecentQuestion(list, 'LMS: lịch dạy');
  list = pushQuickAskRecentQuestion(list, 'excel: sumif la gi?');
  assert.equal(list.length, 2);
  assert.equal(list[0], 'excel: sumif la gi?');
  for (let i = 0; i < 6; i += 1) {
    list = pushQuickAskRecentQuestion(list, `Câu ${i}`);
  }
  assert.equal(list.length, 5);
  assert.equal(filterRecentQuickAskForDisplay(parseQuickAskRecentList(JSON.stringify(list)), { limit: 3 }).length, 3);
});

test('quickAskRecentHistory parse and filter', async () => {
  const {
    filterRecentQuickAskForDisplay,
    parseQuickAskRecentList,
  } = await import('../../shared/ai/quickAskRecentHistory.mjs');

  assert.deepEqual(parseQuickAskRecentList(null), []);
  assert.deepEqual(parseQuickAskRecentList('not-json'), []);
  assert.deepEqual(parseQuickAskRecentList(JSON.stringify(['ab', 'Excel pivot OK'])), ['Excel pivot OK']);

  const recent = [
    'Excel: VLOOKUP lỗi #N/A',
    'PowerPoint: Slide Master',
    'Canva: xóa nền ảnh',
  ];
  const empty = filterRecentQuickAskForDisplay(recent, {
    exclude: ['PowerPoint: Slide Master'],
  });
  assert.equal(empty.length, 2);
  const matched = filterRecentQuickAskForDisplay(recent, { query: 'excel' });
  assert.equal(matched.length, 1);
  assert.match(matched[0], /VLOOKUP/i);
});

test('quickAskThreadPersistence preserves both path and href on serialized action links', async () => {
  const { serializeQuickAskThread } = await import('../../shared/ai/quickAskThreadPersistence.mjs');
  const saved = serializeQuickAskThread([
    {
      id: 'a1',
      role: 'assistant',
      text: 'Hướng dẫn lịch học',
      actions: [{ label: 'Mở Lịch học', path: '/student#schedule' }],
    },
  ]);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].actions[0].path, '/student#schedule');
  assert.equal(saved[0].actions[0].href, '/student#schedule');
});

test('quickAskSessionArchive keeps 30-day sessions, previews 3, expands all 30-day history, and rotates cleanly', async () => {
  const {
    SESSION_LIST_PREVIEW,
    SESSION_RETENTION_MS,
    formatSessionRelativeTime,
    getQuickAskSessionById,
    hydrateArchiveFromLegacyThread,
    listQuickAskSessions,
    parseSessionArchive,
    rotateQuickAskSession,
    setActiveQuickAskSession,
    upsertActiveQuickAskSession,
  } = await import('../../shared/ai/quickAskSessionArchive.mjs');

  assert.equal(SESSION_LIST_PREVIEW, 3);
  assert.equal(SESSION_RETENTION_MS, 30 * 24 * 60 * 60 * 1000);

  const now = Date.now();
  const archive = parseSessionArchive({
    activeSessionId: 's5',
    sessions: [
      { id: 's_expired', updatedAt: now - 31 * 24 * 60 * 60 * 1000, messages: [{ id: 'u0', role: 'user', text: 'Old >30 days' }] },
      { id: 's1', updatedAt: now - 12 * 24 * 60 * 60 * 1000, messages: [{ id: 'u1', role: 'user', text: 'GMetrix là gì?' }] },
      { id: 's2', updatedAt: now - 5 * 24 * 60 * 60 * 1000, messages: [{ id: 'u2', role: 'user', text: 'SUMIFS trong Excel 365' }] },
      { id: 's3', updatedAt: now - 2 * 60 * 60 * 1000, messages: [{ id: 'u3', role: 'user', text: 'Tạo mục lục Word' }] },
      { id: 's4', updatedAt: now - 15 * 60 * 1000, messages: [{ id: 'u4', role: 'user', text: 'API là gì?' }] },
      { id: 's5', updatedAt: now - 60 * 1000, messages: [{ id: 'u5', role: 'user', text: 'Slide Master PowerPoint' }], active: true },
    ],
  });

  // Expired (>30d) session dropped; 5 valid sessions kept newest-first
  assert.equal(archive.sessions.length, 5);
  assert.equal(getQuickAskSessionById(archive, 's_expired'), null);

  const preview = listQuickAskSessions(archive);
  assert.equal(preview.items.length, 3);
  assert.deepEqual(preview.items.map((s) => s.id), ['s5', 's4', 's3']);
  assert.equal(preview.totalCount, 5);
  assert.equal(preview.hiddenCount, 2);
  assert.equal(preview.hasMore, true);

  const expanded = listQuickAskSessions(archive, { includeAll: true });
  assert.equal(expanded.items.length, 5);
  assert.deepEqual(expanded.items.map((s) => s.id), ['s5', 's4', 's3', 's2', 's1']);

  // Rotating & adding a new session keeps all 5 prior sessions intact
  const rotated = rotateQuickAskSession(archive);
  assert.ok(rotated.activeSessionId && rotated.activeSessionId !== 's5');
  const withSixth = upsertActiveQuickAskSession(rotated, [
    { id: 'u6', role: 'user', text: 'Docker là gì?' },
  ], rotated.activeSessionId);
  assert.equal(withSixth.sessions.length, 6);

  // Activating an older session does not delete others
  const activated = setActiveQuickAskSession(withSixth, 's1');
  assert.equal(activated.activeSessionId, 's1');
  assert.equal(activated.sessions.length, 6);

  // Legacy single-thread migration
  const migrated = hydrateArchiveFromLegacyThread(
    { activeSessionId: '', sessions: [] },
    [{ id: 'lu1', role: 'user', text: 'Hàm IF lồng nhau' }],
  );
  assert.equal(migrated.sessions.length, 1);
  assert.match(migrated.sessions[0].preview, /Hàm IF lồng nhau/);

  // Relative formatting helper
  assert.equal(formatSessionRelativeTime(now - 20_000, 'vi', now), 'Vừa xong');
  assert.equal(formatSessionRelativeTime(now - 10 * 60_000, 'vi', now), '10 phút trước');
  assert.equal(formatSessionRelativeTime(now - 3 * 3600_000, 'vi', now), '3 giờ trước');
  assert.equal(formatSessionRelativeTime(now - 2 * 86400_000, 'vi', now), '2 ngày trước');
  assert.match(formatSessionRelativeTime(now - 10 * 86400_000, 'vi', now), /^\d{2}\/\d{2}$/);
});

test('Web CommandPalette and Mobile QuickAiPopupModal wire 3-item preview, 30-day Xem thêm, and minimal default nav', () => {
  const root = path.resolve(__dirname, '../..');
  const webSrc = fs.readFileSync(path.join(root, 'client/src/components/ui/CommandPalette.jsx'), 'utf8');
  const mobileSrc = fs.readFileSync(path.join(root, 'thang-tin-hoc-mobile/src/components/QuickAiPopupModal.tsx'), 'utf8');

  // Web invariants
  assert.match(webSrc, /listQuickAskSessions\(/);
  assert.match(webSrc, /SESSION_LIST_PREVIEW/);
  assert.match(webSrc, /Xem thêm \(\$\{sessionList\.hiddenCount\} lịch sử trong 30 ngày\)/);
  assert.match(webSrc, /primaryNavItems/);
  assert.match(webSrc, /DewSkill AI, trợ lý cá nhân/);

  // Mobile invariants
  assert.match(mobileSrc, /const isEn = language === 'en';/);
  assert.match(mobileSrc, /listQuickAskSessions\(/);
  assert.match(mobileSrc, /Xem thêm \(\$\{sessionList\.hiddenCount\} trong 30 ngày\)/);
  assert.match(mobileSrc, /destinations\.slice\(0, 3\)/);
  assert.match(mobileSrc, /trimmedQuery && filteredActions\.length > 0/);
});
