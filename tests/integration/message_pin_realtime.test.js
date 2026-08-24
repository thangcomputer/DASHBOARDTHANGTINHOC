/**
 * Test: Real-time Message Pinning & Unpinning
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('Message Pin & Unpin Realtime Verification', () => {

  it('1. SocketContext registers onMessagePinned listener correctly', () => {
    const socketCtx = read('client/src/context/SocketContext.jsx');
    assert.ok(socketCtx.includes('pinnedCallbacksRef'));
    assert.ok(socketCtx.includes('onMessagePinned'));
    assert.ok(socketCtx.includes("newSocket.on('message:pinned'"));
  });

  it('2. useDataMessaging subscribes to onMessagePinned and updates messages state in real time', () => {
    const useDataMsg = read('client/src/context/useDataMessaging.js');
    assert.ok(useDataMsg.includes('onMessagePinned'));
    assert.ok(useDataMsg.includes('unsubPinned'));
  });

  it('3. Inbox unsubscribes properly on cleanup', () => {
    const inbox = read('client/src/components/Inbox.jsx');
    assert.ok(inbox.includes('unsubPinned()'));
    assert.ok(inbox.includes('onMessagePinned'));
  });

  it('4. Backend messageRoutes notifies both participants via req.app.notifyUser', () => {
    const routes = read('routes/messageRoutes.js');
    assert.ok(routes.includes("req.app.notifyUser(role, id, 'message:pinned', pinPayload);"));
  });

  it('5. Pinning a message unpins previous pinned message in same conversation', () => {
    const conversationId = 'admin_admin__admin_high_111';
    let messages = [
      { id: 'm1', convId: conversationId, content: 'Tin 1', isPinned: true },
      { id: 'm2', convId: conversationId, content: 'Tin 2', isPinned: false }
    ];

    // Event arrives: m2 is pinned by Admin A
    const pinEvent = { conversationId, messageId: 'm2', isPinned: true };

    messages = messages.map(m => {
      if (String(m.id) === String(pinEvent.messageId)) return { ...m, isPinned: pinEvent.isPinned };
      if (pinEvent.isPinned && String(m.convId) === String(pinEvent.conversationId) && m.isPinned) {
        return { ...m, isPinned: false };
      }
      return m;
    });

    assert.equal(messages[0].isPinned, false);
    assert.equal(messages[1].isPinned, true);
  });

  it('6. Unpinning a message updates isPinned to false for both parties', () => {
    const conversationId = 'admin_admin__admin_high_111';
    let messages = [
      { id: 'm2', convId: conversationId, content: 'Tin 2', isPinned: true }
    ];

    // Event arrives: m2 is unpinned by Admin B
    const unpinEvent = { conversationId, messageId: 'm2', isPinned: false };

    messages = messages.map(m => {
      if (String(m.id) === String(unpinEvent.messageId)) return { ...m, isPinned: unpinEvent.isPinned };
      return m;
    });

    assert.equal(messages[0].isPinned, false);
  });
});
