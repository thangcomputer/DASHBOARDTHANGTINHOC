'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const screenPath = path.join(__dirname, '../../thang-tin-hoc-mobile/src/screens/MessageScreens.tsx');
const screen = fs.readFileSync(screenPath, 'utf8');

describe('mobile chat read receipts', () => {
  it('updates outgoing messages in the active conversation when a read acknowledgement arrives', () => {
    assert.ok(screen.includes('DeviceEventEmitter.addListener(SOCKET_EVENTS.READ_ACK'));
    assert.ok(screen.includes("String(event.conversationId || '') !== route.params.conversationId"));
    assert.ok(screen.includes("message.mine && !message.recipientRejected ? { ...message, state: 'read' as const } : message"));
    assert.ok(screen.includes('setMessages((current) => (current || resource.data || []).map(markOwnMessagesRead))'));
    assert.ok(screen.includes('setSearchResults((current) => current?.map(markOwnMessagesRead) || null)'));
    assert.ok(screen.includes('readAckSubscription.remove()'));
  });

  it('marks a conversation read on focus, when incoming messages arrive, and after reconnect', () => {
    assert.ok(screen.includes('const isFocused = useIsFocused()'));
    assert.ok(screen.includes('if (!message.mine && isFocused) markCurrentConversationRead()'));
    assert.match(screen, /DeviceEventEmitter\.addListener\(\s*SOCKET_EVENTS\.CONNECTED,\s*markCurrentConversationRead/);
    assert.ok(screen.includes('if (!isFocused || isPreview || resource.loading || resource.error || !user) return;'));
    assert.ok(screen.includes('messageService.markRead(route.params.conversationId, user)'));
  });

  it('renders the message time inside the final bubble of each sender group', () => {
    assert.ok(screen.includes('{endsSenderGroup && message.time ? ('));
    assert.ok(screen.includes('<Text style={styles.messageBubbleTime}>{message.time}</Text>'));
    assert.ok(screen.includes('messageBubbleTime: { alignSelf: \'flex-start\''));
    assert.equal(screen.includes('<Text style={styles.msgFooterTime}>{message.time}</Text>'), false);
  });
});
