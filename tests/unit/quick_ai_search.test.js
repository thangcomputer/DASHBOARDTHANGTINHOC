const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('shared quickSearchMemory classifies questions, resolves built-in Office IT memory, and maps mobile routes', async () => {
  const {
    normalizeQuickQuery,
    isLikelyQuestion,
    matchLocalOfficeMemory,
    mapActionPathToMobileRoute,
  } = await import('../../shared/ai/quickSearchMemory.mjs');

  assert.equal(normalizeQuickQuery('  Lịch  Học  '), 'lich hoc');
  assert.equal(normalizeQuickQuery('Đặt mục tiêu'), 'dat muc tieu');

  assert.equal(isLikelyQuestion('Hàm VLOOKUP dùng thế nào?'), true);
  assert.equal(isLikelyQuestion('how to use SUMIFS'), true);
  assert.equal(isLikelyQuestion('Cách tạo mục lục tự động Word'), true);
  assert.equal(isLikelyQuestion('Lịch học'), false);
  assert.equal(isLikelyQuestion('Tài chính'), false);

  const vlookupVi = matchLocalOfficeMemory('Hàm VLOOKUP dùng thế nào?', 'vi');
  assert.ok(vlookupVi);
  assert.equal(vlookupVi.source, 'memory');
  assert.match(vlookupVi.answer, /VLOOKUP/);

  const vlookupEn = matchLocalOfficeMemory('What is VLOOKUP formula?', 'en');
  assert.ok(vlookupEn);
  assert.equal(vlookupEn.source, 'memory');
  assert.match(vlookupEn.answer, /searches for a value/i);

  // Comparisons / complex queries bypass built-in memory so AI handles them
  assert.equal(matchLocalOfficeMemory('So sánh VLOOKUP và XLOOKUP chi tiết', 'vi'), null);

  assert.deepEqual(mapActionPathToMobileRoute('/student#schedule', 'student'), { tab: 'Schedule' });
  assert.deepEqual(mapActionPathToMobileRoute('/student/daily-practice', 'student'), { tab: 'DailyPractice' });
  assert.deepEqual(mapActionPathToMobileRoute('/teacher/finance', 'teacher'), { tab: 'Finance' });
  assert.deepEqual(mapActionPathToMobileRoute('/teacher#students', 'teacher'), { stack: 'Students' });
});

test('services/aiSupportService quickAskAssistant hits memory for FAQs & simple Office queries without LLM call', async () => {
  const {
    extractActionLinks,
    officeItQuickMemory,
    quickAskAssistant,
  } = require('../../services/aiSupportService');

  const extracted = extractActionLinks('Xem lịch:\n**Bước 1:** Mở.\n⟦go:/student#schedule|Mở Lịch học ngay⟧ · ⟦go:/student#materials|Tài liệu⟧');
  assert.deepEqual(extracted.actions, [
    { path: '/student#schedule', label: 'Mở Lịch học ngay' },
    { path: '/student#materials', label: 'Tài liệu' },
  ]);
  assert.doesNotMatch(extracted.cleanText, /⟦go:/);

  assert.match(officeItQuickMemory('cách dùng SUMIFS', 'vi'), /SUMIFS/);
  assert.match(officeItQuickMemory('PivotTable', 'en'), /Insert.*PivotTable/);

  const studentFaqRes = await quickAskAssistant({
    user: { id: 'stu-1', role: 'student', name: 'An' },
    question: 'Lịch học',
    preferredLang: 'vi',
  });
  assert.equal(studentFaqRes.source, 'memory');
  assert.equal(studentFaqRes.actions[0]?.path, '/student#schedule');

  const officeEnRes = await quickAskAssistant({
    user: { id: 'admin-1', role: 'admin', name: 'Admin' },
    question: 'VLOOKUP',
    preferredLang: 'en',
  });
  assert.equal(officeEnRes.source, 'memory');
  assert.equal(officeEnRes.lang, 'en');
  assert.match(officeEnRes.answer, /Excel `VLOOKUP`/);

  const greetingRes = await quickAskAssistant({
    user: { id: 'tea-1', role: 'teacher', name: 'Thang' },
    question: 'Hello',
    preferredLang: 'en',
  });
  assert.equal(greetingRes.source, 'memory');
  assert.match(greetingRes.answer, /DewSkill AI/);
});

test('Web and Mobile headers merge AI + Search into a single AI button wired to unified popups', () => {
  const webHeader = read('client/src/components/DashboardLayout.jsx');
  assert.match(webHeader, /aria-label="Tìm kiếm bằng AI"/);
  assert.match(webHeader, /<SearchCheck\b/);
  assert.match(webHeader, /Tìm kiếm/);
  assert.doesNotMatch(webHeader, /dewskill-ai-icon\.webp/);
  assert.match(webHeader, />\s*AI\s*<\/span>/);
  assert.match(webHeader, /rounded-full/);
  assert.doesNotMatch(webHeader, /conic-gradient\(/);
  assert.doesNotMatch(webHeader, /aria-label="Tìm kiếm nhanh \(Ctrl\+K\)"/);

  const mobileHeader = read('thang-tin-hoc-mobile/src/components/ui.tsx');
  assert.match(mobileHeader, /accessibilityLabel="Tìm kiếm bằng AI"/);
  assert.match(mobileHeader, /<Search\b/);
  assert.match(mobileHeader, /<Sparkles\b/);
  assert.match(mobileHeader, />AI</);
  assert.doesNotMatch(mobileHeader, /topBarAiLabel/);
  assert.doesNotMatch(mobileHeader, /dewskill-ai-icon\.webp/);
  assert.doesNotMatch(mobileHeader, /topBarAiBorderSpinner/);
  assert.doesNotMatch(mobileHeader, /accessibilityLabel="Tìm kiếm và tác vụ nhanh"/);
  assert.doesNotMatch(mobileHeader, /accessibilityLabel="Mở Trợ lý AI và Hỗ trợ"/);

  const webPopup = read('client/src/components/ui/CommandPalette.jsx');
  assert.match(webPopup, /aiSupportAPI\.quickAsk/);
  assert.match(webPopup, /matchLocalOfficeMemory/);
  assert.match(webPopup, /dewskill-ai-icon\.webp/);
  assert.match(webPopup, /DewSkill AI, trợ lý cá nhân/);

  const mobilePopup = read('thang-tin-hoc-mobile/src/components/QuickAiPopupModal.tsx');
  assert.match(mobilePopup, /quickAskAi/);
  assert.match(mobilePopup, /matchLocalOfficeMemory/);
  assert.match(mobilePopup, /dewskill-ai-icon\.webp/);
  assert.match(mobilePopup, /DewSkill AI/);

  const rootNav = read('thang-tin-hoc-mobile/src/navigation/RootNavigator.tsx');
  assert.match(rootNav, /<QuickAiPopupModal\b/);
  assert.doesNotMatch(rootNav, /GlobalSearchOverlay/);

  const routesSrc = read('routes/aiSupportRoutes.js');
  assert.match(routesSrc, /router\.post\('\/quick-ask'/);
  assert.match(routesSrc, /attachment/);

  // Image paste + file attachment wiring on Web and Mobile popups
  assert.match(webPopup, /onPaste=\{handlePaste\}/);
  assert.match(webPopup, /type="file"/);
  assert.match(webPopup, /fileInputRef\.current\?\.click\(\)/);
  assert.match(webPopup, /processQuickAttachFile/);

  assert.match(mobilePopup, /DocumentPicker\.getDocumentAsync/);
  assert.match(mobilePopup, /window\.addEventListener\('paste', onWindowPaste\)/);
  assert.match(mobilePopup, /handlePickAttachment/);
});

test('quickAskAssistant normalizes and forwards pasted images and attached text files to LLM', async () => {
  const { normalizeQuickAttachment } = require('../../services/aiSupportService');

  assert.equal(normalizeQuickAttachment(null), null);
  assert.equal(normalizeQuickAttachment({}), null);

  const imgNorm = normalizeQuickAttachment({
    name: 'screenshot.png',
    mimeType: 'IMAGE/PNG',
    dataBase64: 'data:image/png;base64,iVBORw0KGgo=',
  });
  assert.deepEqual(imgNorm, {
    name: 'screenshot.png',
    mimeType: 'image/png',
    dataBase64: 'iVBORw0KGgo=',
    textContent: '',
  });

  const llmPath = require.resolve('../../services/ai/llmClient');
  const svcPath = require.resolve('../../services/aiSupportService');
  const origLlmEntry = require.cache[llmPath];
  const origSvcEntry = require.cache[svcPath];

  const capturedCalls = [];
  require.cache[llmPath] = {
    id: llmPath,
    filename: llmPath,
    loaded: true,
    exports: {
      isAiConfigured: () => true,
      chatCompletion: async (opts) => {
        capturedCalls.push(opts);
        return { content: '**Bước 1:** Kiểm tra công thức.', model: 'gemini-test' };
      },
    },
  };
  delete require.cache[svcPath];

  try {
    const { quickAskAssistant } = require('../../services/aiSupportService');

    const imgReply = await quickAskAssistant({
      user: { id: 'stu-2', role: 'student', name: 'Binh' },
      question: '',
      preferredLang: 'vi',
      attachment: {
        name: 'excel-error.png',
        mimeType: 'image/png',
        dataBase64: 'data:image/png;base64,AAAA',
      },
    });
    assert.equal(imgReply.source, 'ai');
    assert.match(imgReply.answer, /Kiểm tra công thức/);
    assert.equal(capturedCalls.length, 1);
    assert.deepEqual(capturedCalls[0].images, [{ mimeType: 'image/png', data: 'AAAA' }]);

    const txtReply = await quickAskAssistant({
      user: { id: 'tea-2', role: 'teacher', name: 'Minh' },
      question: 'VLOOKUP',
      preferredLang: 'en',
      attachment: {
        name: 'formulas.csv',
        mimeType: 'text/csv',
        textContent: 'A,B\n1,2',
      },
    });
    assert.equal(txtReply.source, 'ai');
    assert.equal(capturedCalls.length, 2);
    const lastMsg = capturedCalls[1].messages[capturedCalls[1].messages.length - 1];
    assert.match(lastMsg.content, /formulas\.csv/);
    assert.match(lastMsg.content, /1,2/);
  } finally {
    if (origLlmEntry) require.cache[llmPath] = origLlmEntry;
    else delete require.cache[llmPath];
    if (origSvcEntry) require.cache[svcPath] = origSvcEntry;
    else delete require.cache[svcPath];
  }
});
