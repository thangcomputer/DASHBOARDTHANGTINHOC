/**
 * Phase 7 — Frontend messaging policy cleanup & deep-link hardening.
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  resolveMessagingDeepLink,
  existingPeerIdsFromConversations,
} = require('../../utils/messagingDeepLink');

const ROOT = path.join(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('Phase 7 frontend messaging policy cleanup', { concurrency: false }, () => {
  it('deep-link util: existing conversation allowed without contacts', () => {
    const d = resolveMessagingDeepLink({
      peerId: 'aaa',
      contacts: [],
      existingPeerIds: ['aaa'],
    });
    assert.equal(d.allowed, true);
    assert.equal(d.mode, 'EXISTING_CONVERSATION');
  });

  it('deep-link util: authorized contact allowed with empty activity', () => {
    const d = resolveMessagingDeepLink({
      peerId: 'bbb',
      contacts: [{ id: 'bbb', productRole: 'SUPPORT', transportRole: 'staff' }],
      existingPeerIds: [],
    });
    assert.equal(d.allowed, true);
    assert.equal(d.mode, 'AUTHORIZED_CONTACT');
  });

  it('deep-link util: unauthorized peer blocked (Case B)', () => {
    const d = resolveMessagingDeepLink({
      peerId: 'evil',
      contacts: [{ id: 'bbb' }],
      existingPeerIds: ['ccc'],
    });
    assert.equal(d.allowed, false);
    assert.equal(d.mode, 'DENIED');
  });

  it('deep-link util: empty contacts does not invent peers', () => {
    assert.equal(
      resolveMessagingDeepLink({ peerId: 'x', contacts: [], existingPeerIds: [] }).allowed,
      false,
    );
  });

  it('existingPeerIdsFromConversations ignores groups', () => {
    const ids = existingPeerIdsFromConversations([
      { id: 'g1', isGroup: true, user: { id: 'guser' } },
      { id: 'd1', isGroup: false, user: { id: 'peer1' } },
    ]);
    assert.deepEqual(ids, ['peer1']);
  });

  it('Inbox uses resolveMessagingDeepLink and never invents selectUser conversation', () => {
    const inbox = read('client/src/components/Inbox.jsx');
    assert.ok(inbox.includes('resolveMessagingDeepLink'));
    assert.ok(inbox.includes('contactsLoaded'));
    assert.ok(inbox.includes('do not create a synthetic conversation')
      || inbox.includes('never invent unauthorized'));
    assert.equal(inbox.includes("lastMessage: 'Bắt đầu cuộc trò chuyện',\n        lastTime: new Date(),\n        unread: 0,\n      });\n    }\n  }, [location.state"), false);
  });

  it('FloatingMessenger: STAFF/SUPPORT use contacts not presence directory', () => {
    const presence = read('client/src/utils/supportPresence.js');
    const fm = read('client/src/components/FloatingMessenger.jsx');
    assert.ok(presence.includes('isElevatedPresenceDirectoryViewer'));
    assert.ok(presence.includes("ar === 'SUPER_ADMIN' || ar === 'HIGH_ADMIN'"));
    assert.ok(fm.includes('usePresenceDirectory'));
    assert.ok(fm.includes('isElevatedPresenceDirectoryViewer'));
    assert.equal(fm.includes('fmContacts.length > 0 ? fmContacts : staffs'), false);
  });

  it('openSiteChat / cms:open-chat gated by contacts or existing conversation', () => {
    const ctx = read('client/src/context/FloatingMessengerContext.jsx');
    assert.ok(ctx.includes('resolveMessagingDeepLink'));
    assert.ok(ctx.includes('messagesAPI.getContacts'));
    assert.ok(ctx.includes('existingPeerIdsFromConversations'));
  });

  it('MessagesContext is LEGACY / UNMOUNTED / no live import', () => {
    const app = read('client/src/App.jsx');
    const data = read('client/src/context/DataContext.jsx');
    const legacy = read('client/src/context/MessagesContext.jsx');
    assert.equal(/MessagesProvider|MessagesContext|useMessagesContext/.test(app), false);
    assert.equal(app.includes("from './context/MessagesContext'"), false);
    assert.ok(data.includes('MessagesContext chưa mount') || data.includes('useDataMessaging'));
    assert.ok(legacy.includes('LEGACY / UNMOUNTED'));
    assert.ok(legacy.includes('NO LIVE EXECUTION PATH'));
  });

  it('GET /contacts remains canonical in live FE', () => {
    const inbox = read('client/src/components/Inbox.jsx');
    const fm = read('client/src/components/FloatingMessenger.jsx');
    const routes = read('routes/messageRoutes.js');
    assert.ok(inbox.includes('messagesAPI.getContacts'));
    assert.ok(fm.includes('messagesAPI.getContacts'));
    assert.ok(routes.includes('listDiscoverableContacts'));
  });

  it('SUPPORT product identity not collapsed to STAFF in deep-link/contact UI', () => {
    const inbox = read('client/src/components/Inbox.jsx');
    const presence = read('client/src/utils/supportPresence.js');
    assert.ok(inbox.includes('productRole'));
    assert.ok(presence.includes('productRole'));
    assert.ok(presence.includes("adminRole === 'SUPPORT' ? 'SUPPORT'"));
  });

  it('no second messaging policy authority on FE', () => {
    const files = [
      'client/src/components/Inbox.jsx',
      'client/src/components/FloatingMessenger.jsx',
      'client/src/context/useDataMessaging.js',
      'client/src/utils/supportPresence.js',
    ];
    for (const f of files) {
      const src = read(f);
      assert.equal(/\bcanDiscoverContacts\b/.test(src), false, f);
      assert.equal(/\bisContactAllowed\b/.test(src), false, f);
      assert.equal(/\bcanMessageUser\b/.test(src), false, f);
    }
  });
});
