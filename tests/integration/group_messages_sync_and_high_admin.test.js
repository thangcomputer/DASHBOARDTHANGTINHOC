const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('Group messages sync on reload and High Admin messaging verification', () => {
  it('messageRoutes.js sync endpoint queries group messages for all user identifiers', () => {
    const src = read('routes/messageRoutes.js');
    assert.ok(src.includes("router.get('/sync/:userId'"), 'Sync endpoint must exist');
    assert.ok(src.includes("'participants.userId': { $in: targetIds }"), 'Must query participants matching targetIds');
    assert.ok(src.includes("'createdBy.userId': { $in: targetIds }"), 'Must query createdBy matching targetIds');
    assert.ok(src.includes("conversationId: { $in: groupIds.map(id => `group_${id}`) }"), 'Must query group conversationId in messages');
    assert.ok(src.includes("isGroup: true, groupId: { $in: groupIds }"), 'Must query isGroup and groupId');
  });

  it('messageRoutes.js group_list endpoint supports all targetIds', () => {
    const src = read('routes/messageRoutes.js');
    assert.ok(src.includes("router.get('/groups/user/:userId'"), 'Group list endpoint must exist');
    assert.ok(src.includes("createdBy.userId': { $in: targetIds }"), 'Must query groups where user is creator or participant');
  });

  it('server.js joins user groups on connect and handles group:join', () => {
    const src = read('server.js');
    assert.ok(src.includes("socket.join(`group_${g._id}`)"), 'Must auto-join socket into user group rooms on connect');
    assert.ok(src.includes("socket.on('group:join'"), 'Must handle socket group:join event');
  });

  it('directMessageService.js notifies group members in realtime', () => {
    const src = read('services/directMessageService.js');
    assert.ok(
      src.includes("io.to(`group_${groupIdFinal}`).emit('message:receive', clientMessage)")
      || src.includes("io.to(`group_${groupId}`).emit('message:receive', clientMessage)"),
      'Must emit to group room'
    );
    assert.ok(src.includes("groupDoc.participants.forEach"), 'Must notify group participants');
  });

  it('useDataMessaging.js normalizes group messages in sync and getConversations', () => {
    const src = read('client/src/context/useDataMessaging.js');
    assert.ok(src.includes("convId = isGrp && gId"), 'Must construct convId for group messages');
    assert.ok(src.includes("const convId = `group_${gid}`"), 'Must construct group convId in getConversations');
    assert.ok(src.includes("String(m.convId) === `group_${gid}`"), 'Must match group messages by convId and groupId');
  });

  it('Inbox.jsx deduplicates contacts by c.id without dropping High Admin', () => {
    const src = read('client/src/components/Inbox.jsx');
    assert.ok(src.includes("const idStr = String(c.id);"), 'Must deduplicate contacts by id');
    assert.ok(!src.includes("admin:${nameKey}"), 'Must not deduplicate admin by name key');
    assert.ok(src.includes("isAliveMessagingPeer(id, { contacts, students, teachers, staffs })"), 'Must use isAliveMessagingPeer fallback');
  });

  it('FloatingMessenger.jsx includes HIGH_ADMIN and SUPER_ADMIN in unread conversations', () => {
    const src = read('client/src/components/FloatingMessenger.jsx');
    assert.ok(src.includes("ar === 'HIGH_ADMIN'"), 'Must include HIGH_ADMIN in unread filtering');
    assert.ok(src.includes("ar === 'SUPER_ADMIN'"), 'Must include SUPER_ADMIN in unread filtering');
  });
});
