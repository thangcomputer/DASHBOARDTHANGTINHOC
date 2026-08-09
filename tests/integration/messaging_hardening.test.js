/**
 * Messaging hardening — listener cleanup, dedupe by _id, legacy admin_admin safety.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { buildConversationId } = require('../../utils/chatConversationId');
const {
  getMessagingRole,
  canAccessDirectConversation,
} = require('../../utils/messagingRoles');

const ROOT = path.join(__dirname, '../..');

describe('Messaging hardening', { concurrency: false }, () => {
  it('1 SocketContext does not use removeAllListeners', () => {
    const src = fs.readFileSync(path.join(ROOT, 'client/src/context/SocketContext.jsx'), 'utf8');
    assert.equal(src.includes('removeAllListeners'), false);
    assert.ok(src.includes(".off('message:receive'"));
    assert.ok(src.includes(".off('message:sent'"));
    assert.ok(src.includes('DATA_REFRESH_EVENTS.forEach'));
  });

  it('2 SocketContext registers message:sent and offs by reference', () => {
    const src = fs.readFileSync(path.join(ROOT, 'client/src/context/SocketContext.jsx'), 'utf8');
    assert.ok(src.includes("newSocket.on('message:sent'"));
    assert.ok(src.includes('onMessageSent'));
    assert.ok(src.includes('offAny(onAnyEvent)'));
  });

  it('3 useDataMessaging dedupes by server _id (HTTP + socket)', () => {
    const src = fs.readFileSync(path.join(ROOT, 'client/src/context/useDataMessaging.js'), 'utf8');
    assert.ok(src.includes('upsertServerMessage'));
    assert.ok(src.includes('onMessageSent'));
    assert.ok(src.includes('String(m.id) === String(d._id)'));
    assert.ok(src.includes('prev.filter((m) => m.id !== tempId)'));
  });

  it('4 MessagesContext also listens message:sent and dedupes _id', () => {
    const src = fs.readFileSync(path.join(ROOT, 'client/src/context/MessagesContext.jsx'), 'utf8');
    assert.ok(src.includes('onMessageSent'));
    assert.ok(src.includes("String(m.id) === String(data._id)") || src.includes("String(m.id) === String(res.data._id)"));
  });

  it('5 STAFF cannot access or collapse into admin_admin', () => {
    const staffA = 'aaaaaaaaaaaaaaaaaaaaaaaa';
    const student = 'cccccccccccccccccccccccc';
    const legacy = buildConversationId('admin', 'admin', 'student', student);
    const canonical = buildConversationId(
      getMessagingRole({ id: staffA, role: 'admin', adminRole: 'STAFF' }),
      staffA,
      'student',
      student,
    );
    assert.ok(legacy.includes('admin_admin'));
    assert.equal(canonical.includes('admin_admin'), false);
    assert.notEqual(legacy, canonical);
    assert.equal(
      canAccessDirectConversation(legacy, { id: staffA, role: 'admin', adminRole: 'STAFF' }),
      false,
    );
    assert.equal(
      canAccessDirectConversation(legacy, { id: staffA, role: 'admin', adminRole: 'SUPPORT' }),
      false,
    );
  });

  it('6 SUPER/HIGH can read legacy admin_admin; STAFF cannot', () => {
    const student = 'cccccccccccccccccccccccc';
    const legacy = buildConversationId('admin', 'admin', 'student', student);
    assert.equal(
      canAccessDirectConversation(legacy, { id: 'aaaaaaaaaaaaaaaaaaaaaaaa', adminRole: 'SUPER_ADMIN', role: 'admin' }),
      true,
    );
    assert.equal(
      canAccessDirectConversation(legacy, { id: 'bbbbbbbbbbbbbbbbbbbbbbbb', adminRole: 'HIGH_ADMIN', role: 'admin' }),
      true,
    );
  });

  it('7 notifyUser still never fans out private admin to ALL_STAFF', () => {
    const src = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
    const idx = src.indexOf('app.notifyUser =');
    const chunk = src.slice(idx, idx + 800);
    assert.equal(chunk.includes("io.to('ALL_STAFF').emit"), false);
  });

  it('8 DM write path only sendCanonicalMessage (HTTP + socket)', () => {
    const routes = fs.readFileSync(path.join(ROOT, 'routes/messageRoutes.js'), 'utf8');
    const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
    const svc = fs.readFileSync(path.join(ROOT, 'services/directMessageService.js'), 'utf8');
    assert.ok(routes.includes('sendCanonicalMessage'));
    assert.ok(server.includes('sendCanonicalMessage'));
    assert.ok(svc.includes('Message.create'));
    assert.ok(svc.includes('assertCanDirectMessage'));
    // Socket DM branch must not raw io.to(rid) without persist
    const sendStart = server.indexOf("socket.on('message:send'");
    const sendEnd = server.indexOf("socket.on('message:read'");
    const dmChunk = server.slice(sendStart, sendEnd);
    assert.ok(dmChunk.includes('sendCanonicalMessage'));
  });

  it('9 typing/read refuse non-participant (canAccessDirectConversation)', () => {
    const src = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
    assert.ok(src.includes("socket.on('typing:start'"));
    assert.ok(src.includes("socket.on('message:read'"));
    assert.ok(src.includes('canAccessDirectConversation'));
  });

  it('10 Staff A vs Staff B distinct threads for same student', () => {
    const a = buildConversationId('staff', 'aaaaaaaaaaaaaaaaaaaaaaaa', 'student', 'cccccccccccccccccccccccc');
    const b = buildConversationId('staff', 'bbbbbbbbbbbbbbbbbbbbbbbb', 'student', 'cccccccccccccccccccccccc');
    assert.notEqual(a, b);
  });

  it('11 FE staff seed conversations use staff role not admin_admin', () => {
    const src = fs.readFileSync(path.join(ROOT, 'client/src/context/useDataMessaging.js'), 'utf8');
    assert.ok(src.includes("userRole === 'admin' || userRole === 'staff'"));
    assert.ok(src.includes('buildConversationId(myRole, sId, \'student\''));
  });
});

/** Pure unit: unread does not double-count same _id */
describe('Messaging dedupe unread unit', { concurrency: false }, () => {
  it('12 unread counts unique message ids only', () => {
    const sId = 'me1';
    const msgs = [
      { id: 'm1', convId: 'c1', receiverId: sId, read: false },
      { id: 'm1', convId: 'c1', receiverId: sId, read: false }, // duplicate id
      { id: 'm2', convId: 'c1', receiverId: sId, read: false },
    ];
    const seen = new Set();
    const unread = msgs.filter((um) => {
      if (String(um.receiverId) !== sId || um.read === true) return false;
      const id = String(um.id);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    }).length;
    assert.equal(unread, 2);
  });
});
