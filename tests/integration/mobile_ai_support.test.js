'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '../..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

test('mobile support entry opens the authenticated AI conversation for students and teachers', () => {
  const home = read('thang-tin-hoc-mobile/src/screens/HomeScreen.tsx');
  const api = read('thang-tin-hoc-mobile/src/services/aiSupportApi.ts');
  const routes = read('routes/aiSupportRoutes.js');

  assert.ok(home.includes('openAiSupportConversation()'));
  assert.ok(home.includes('!user.previewMode ? <Pressable'));
  assert.ok(home.includes("navigation?.navigate('Conversation'"));
  assert.ok(home.includes("participantId: 'ai_support'"));
  assert.ok(api.includes("'/ai-support/open'"));
  assert.ok(routes.includes("router.post('/open'"));
  assert.ok(routes.includes('sendWelcomeIfEmpty'));
});

test('mobile AI conversation supports staff escalation, live status, and return to AI', () => {
  const screen = read('thang-tin-hoc-mobile/src/screens/MessageScreens.tsx');
  const api = read('thang-tin-hoc-mobile/src/services/aiSupportApi.ts');
  const socket = read('thang-tin-hoc-mobile/src/services/socketService.ts');
  const routes = read('routes/aiSupportRoutes.js');
  const messageService = read('services/directMessageService.js');

  assert.ok(api.includes("'/ai-support/escalate'"));
  assert.ok(api.includes("'/ai-support/reset'"));
  assert.ok(screen.includes('escalateAiSupportConversation(route.params.conversationId)'));
  assert.ok(screen.includes('resetAiSupportConversation(route.params.conversationId)'));
  assert.ok(screen.includes('Chuyển sang nhân viên hỗ trợ'));
  assert.ok(screen.includes('SOCKET_EVENTS.AI_SUPPORT_STATUS'));
  assert.ok(socket.includes("instance.on('ai-support:status'"));
  assert.ok(routes.includes("router.post('/escalate'"));
  assert.ok(routes.includes("router.post('/reset'"));
  assert.ok(messageService.includes('scheduleAiSupportReply'));
});

test('mobile AI conversation presents the same role-based business FAQs and AI follow-up prompts as web', () => {
  const screen = read('thang-tin-hoc-mobile/src/screens/MessageScreens.tsx');
  const api = read('thang-tin-hoc-mobile/src/services/aiSupportApi.ts');
  const webFaq = read('client/src/utils/aiSupport.js');
  const webMessenger = read('client/src/components/FloatingMessenger.jsx');

  for (const label of [
    'Hướng dẫn sử dụng LMS',
    'Hướng dẫn tạo lịch dạy cho học viên',
    'Xem tài chính',
    'Lịch học',
    'Học video',
    'Cách sử dụng hàm SUMIF, SUMIFS',
    'Cách sử dụng hàm VLOOKUP',
    'Cách sử dụng hàm IF',
  ]) {
    assert.ok(api.includes(label), `mobile FAQ is missing: ${label}`);
    assert.ok(webFaq.includes(label), `web FAQ is missing: ${label}`);
  }

  assert.ok(webMessenger.includes('welcomeChips'));
  assert.ok(screen.includes('getAiSupportReplyPresentation(message.text)'));
  assert.ok(screen.includes('aiReplyPresentation.suggestions'));
  assert.ok(screen.includes('void send(prompt.label)'));
});
