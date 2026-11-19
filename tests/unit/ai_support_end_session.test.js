'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('Backend mounts POST /ai-support/end and implements endAiSession closing the AI session', () => {
  const service = read('services/aiSupportService.js');
  assert.match(service, /async function endAiSession\(/);
  assert.match(service, /doc\.status = AI_SUPPORT_STATUS\.CLOSED;/);
  assert.match(service, /doc\.lastUserMessageAt = null;/);
  assert.match(service, /endAiSession,/);

  const routes = read('routes/aiSupportRoutes.js');
  assert.match(routes, /router\.post\('\/end'/);
  assert.match(routes, /endAiSession/);
  assert.match(routes, /status === 'CLOSED'/);
});

test('Mobile AI conversation ends the backend & UI session when user finishes support', () => {
  const api = read('thang-tin-hoc-mobile/src/services/aiSupportApi.ts');
  assert.match(api, /endAiSupportConversation/);
  assert.match(api, /\/ai-support\/end/);

  const screen = read('thang-tin-hoc-mobile/src/screens/MessageScreens.tsx');
  assert.match(screen, /handleEndAiSession/);
  assert.match(screen, /handleStartNewAiSession/);
  assert.match(screen, /void handleEndAiSession\(\)/);
  assert.match(screen, /Phiên trả lời với Trợ lý AI đã kết thúc/);
  assert.match(screen, /aiSessionEnded/);
});

test('Web FloatingMessenger ends the backend & UI session when user finishes support', () => {
  const webApi = read('client/src/services/api.js');
  assert.match(webApi, /end:\s*async\s*\(conversationId\)/);
  assert.match(webApi, /\/ai-support\/end/);

  const fm = read('client/src/components/FloatingMessenger.jsx');
  assert.match(fm, /const handleEndAi = useCallback/);
  assert.match(fm, /await aiSupportAPI\.end\(tab\.id\)/);
  assert.match(fm, /Phiên trả lời với Trợ lý AI đã kết thúc/);
  assert.match(fm, /aiSessionEnded/);
});
