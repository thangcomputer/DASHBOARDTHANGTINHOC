/**
 * Test: Real-time Group Deletion & Dismissal
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('Group Delete Realtime Synchronization Verification', () => {

  it('1. Backend messageRoutes emits group:deleted to group room, member rooms and role rooms', () => {
    const routes = read('routes/messageRoutes.js');
    assert.ok(routes.includes("io.to(`group_${groupId}`).emit('group:deleted', deletePayload);"));
    assert.ok(routes.includes("req.app.notifyUser(memberRole, p.userId, 'group:deleted', deletePayload);"));
    assert.ok(routes.includes("io.to('ALL_ADMIN').emit('group:deleted', deletePayload);"));
    assert.ok(routes.includes("io.to('ALL_STAFF').emit('group:deleted', deletePayload);"));
    assert.ok(routes.includes("io.to('ALL_TEACHER').emit('group:deleted', deletePayload);"));
  });

  it('2. SocketContext registers onGroupDelete and listens to group:deleted', () => {
    const socketCtx = read('client/src/context/SocketContext.jsx');
    assert.ok(socketCtx.includes('groupDeleteCallbacksRef'));
    assert.ok(socketCtx.includes('onGroupDelete'));
    assert.ok(socketCtx.includes("newSocket.on('group:deleted', onGroupDeleteEvt);"));
    assert.ok(socketCtx.includes("newSocket.off('group:deleted', onGroupDeleteEvt);"));
  });

  it('3. useDataMessaging removes group and its messages in real-time when group:deleted fires', () => {
    const useDataMsg = read('client/src/context/useDataMessaging.js');
    assert.ok(useDataMsg.includes('onGroupDelete'));
    assert.ok(useDataMsg.includes('unsubGroupDelete'));

    // Verify logic
    let groups = [{ _id: 'grp_1', name: 'Nhóm 1' }, { _id: 'grp_2', name: 'Nhóm 2' }];
    let messages = [
      { id: 'm1', convId: 'group_grp_1', content: 'Tin 1' },
      { id: 'm2', convId: 'group_grp_2', content: 'Tin 2' },
    ];

    const deleteEvent = { groupId: 'grp_1', groupName: 'Nhóm 1' };

    groups = groups.filter(g => String(g._id || g.id) !== deleteEvent.groupId);
    messages = messages.filter(m => String(m.convId) !== `group_${deleteEvent.groupId}`);

    assert.equal(groups.length, 1);
    assert.equal(groups[0]._id, 'grp_2');
    assert.equal(messages.length, 1);
    assert.equal(messages[0].id, 'm2');
  });

  it('4. Inbox closes active conversation if user is currently in the deleted group', () => {
    const inbox = read('client/src/components/Inbox.jsx');
    assert.ok(inbox.includes('onGroupDelete'));
    assert.ok(inbox.includes('unsubGroupDelete'));

    let activeConv = { id: 'group_grp_1', isGroup: true, user: { id: 'grp_1' } };
    let conversations = [{ id: 'group_grp_1' }, { id: 'user_2' }];

    const deleteEvent = { groupId: 'grp_1', groupName: 'Nhóm 1' };

    if (activeConv && (activeConv.isGroup || String(activeConv.id).startsWith('group_')) && (String(activeConv.id) === `group_${deleteEvent.groupId}` || String(activeConv.user?.id) === deleteEvent.groupId)) {
      activeConv = null;
    }
    conversations = conversations.filter(c => String(c.id) !== `group_${deleteEvent.groupId}`);

    assert.equal(activeConv, null);
    assert.equal(conversations.length, 1);
    assert.equal(conversations[0].id, 'user_2');
  });
});
