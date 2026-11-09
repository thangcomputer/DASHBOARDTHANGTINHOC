'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '../..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

test('mobile group management uses the existing authenticated group APIs', () => {
  const api = read('thang-tin-hoc-mobile/src/services/messageApi.ts');
  const service = read('thang-tin-hoc-mobile/src/services/mockService.ts');
  const routes = read('routes/messageRoutes.js');

  assert.ok(api.includes("`/messages/groups/${encodeURIComponent(groupId)}/members`"));
  assert.ok(api.includes("`/messages/groups/${encodeURIComponent(groupId)}/leave`"));
  assert.ok(api.includes("`/messages/groups/${encodeURIComponent(groupId)}`"));
  assert.ok(routes.includes("router.post('/groups/:groupId/members'"));
  assert.ok(routes.includes("router.post('/groups/:groupId/leave'"));
  assert.ok(routes.includes("router.delete('/groups/:groupId'"));
  assert.ok(routes.includes('Chỉ người tạo nhóm mới có quyền thêm thành viên'));
  assert.ok(routes.includes('Chỉ người tạo nhóm hoặc Super Admin mới có quyền xóa nhóm'));
  assert.ok(service.includes('async addGroupMembers('));
  assert.ok(service.includes('async leaveGroup('));
  assert.ok(service.includes('async deleteGroup('));
});

test('mobile group chat shows creator actions and lets other members leave', () => {
  const api = read('thang-tin-hoc-mobile/src/services/messageApi.ts');
  const screen = read('thang-tin-hoc-mobile/src/screens/MessageScreens.tsx');
  const types = read('thang-tin-hoc-mobile/src/types/index.ts');

  assert.ok(api.includes('groupCreatorId: text(group.createdBy?.userId)'));
  assert.ok(api.includes('groupParticipants: (group.participants || [])'));
  assert.ok(types.includes('groupCreatorId?: string'));
  assert.ok(types.includes('groupParticipants?: Array<'));
  assert.ok(screen.includes('accessibilityLabel="Thêm thành viên vào nhóm"'));
  assert.ok(screen.includes('accessibilityLabel="Xóa nhóm vĩnh viễn"'));
  assert.ok(screen.includes('accessibilityLabel="Rời nhóm"'));
  assert.ok(screen.includes("setGroupActionDialog('leave')"));
  assert.ok(screen.includes('visible={groupActionDialog !== null}'));
  assert.ok(screen.includes("await messageService.leaveGroup(groupId, user)"));
  assert.ok(screen.includes('accessibilityLabel={groupActionDialog === \'delete\' ? \'Xác nhận xóa nhóm\' : \'Xác nhận rời nhóm\'}'));
  assert.ok(screen.includes('groupActionError ?'));
  assert.ok(screen.includes('Không thể thêm thành viên'));
  assert.ok(screen.includes('Toàn bộ tin nhắn và dữ liệu nhóm sẽ bị xóa'));
  assert.ok(screen.includes('Bạn sẽ không còn nhận được tin nhắn trong nhóm này.'));
  assert.ok(screen.includes('Thành viên nhóm'));
});

test('mobile group messages use the actual sender avatar and role', () => {
  const api = read('thang-tin-hoc-mobile/src/services/messageApi.ts');
  const screen = read('thang-tin-hoc-mobile/src/screens/MessageScreens.tsx');
  const types = read('thang-tin-hoc-mobile/src/types/index.ts');

  assert.ok(api.includes('senderAvatarUri: resolveMobilePublicUrl'));
  assert.ok(api.includes('senderRole: text(raw.senderRole || raw.sender?.role)'));
  assert.ok(types.includes('senderAvatarUri?: string'));
  assert.ok(screen.includes('source={(isGroupConversation || isAiSupportConversation)'));
  assert.ok(screen.includes('message.senderAvatarUri'));
});

test('mobile group header subtitle shows only the member count', () => {
  const screen = read('thang-tin-hoc-mobile/src/screens/MessageScreens.tsx');

  assert.ok(
    screen.includes("? groupMemberCount == null ? '' : `${groupMemberCount} thành viên`")
    || screen.includes("groupMemberCount == null ? '' : `${groupMemberCount} thành viên`")
  );
  assert.ok(!screen.includes("? groupMemberCount == null ? 'Nhóm trò chuyện'"));
});

test('leaving a group also leaves its realtime socket room', () => {
  const socketClient = read('thang-tin-hoc-mobile/src/services/socketService.ts');
  const service = read('thang-tin-hoc-mobile/src/services/mockService.ts');
  const server = read('server.js');

  assert.ok(socketClient.includes("emit('group:leave', { groupId })"));
  assert.ok(service.includes('leaveSocketChatGroup(groupId)'));
  assert.ok(server.includes("socket.on('group:leave'"));
  assert.ok(server.includes('socket.leave(`group_${groupId}`)'));
});
