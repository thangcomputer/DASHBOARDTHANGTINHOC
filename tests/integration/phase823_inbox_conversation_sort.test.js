/**
 * Phase 8.23 — Inbox conversation sort / new-message priority.
 * FE-only. Does not touch RBAC / backend conversationId / Enterprise.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/** Load ESM-like conversationList via Function (no bundler). */
function loadConversationList() {
  const src = read('client/src/lib/conversationList.js')
    .replace(/export function /g, 'function ')
    .replace(/export \{[^}]+\};?/g, '');
  const wrapped = `${src}\nmodule.exports = { conversationActivityTime, sortConversationsByLastMessageAt, mergeConversationsById, mergeDirectConversationsByPeer, conversationPeerKey };`;
  const mod = { exports: {} };
  vm.runInNewContext(wrapped, { module: mod, exports: mod.exports });
  return mod.exports;
}

describe('Phase 8.23 conversation list ordering', { concurrency: false }, () => {
  const {
    sortConversationsByLastMessageAt,
    mergeConversationsById,
    mergeDirectConversationsByPeer,
    conversationPeerKey,
    conversationActivityTime,
  } = loadConversationList();

  it('1 new message from B → B, A, C', () => {
    const list = sortConversationsByLastMessageAt([
      { id: 'A', lastTime: '2026-01-01T10:00:00Z' },
      { id: 'B', lastTime: '2026-01-01T10:05:00Z' },
      { id: 'C', lastTime: '2026-01-01T09:55:00Z' },
    ]);
    assert.equal(list.map((c) => c.id).join(','), 'B,A,C');
  });

  it('2 new message from A at 10:10 → A, B, C', () => {
    const list = sortConversationsByLastMessageAt([
      { id: 'A', lastTime: '2026-01-01T10:10:00Z' },
      { id: 'B', lastTime: '2026-01-01T10:05:00Z' },
      { id: 'C', lastTime: '2026-01-01T09:55:00Z' },
    ]);
    assert.equal(list.map((c) => c.id).join(','), 'A,B,C');
  });

  it('3 two messages from C → C first', () => {
    const list = sortConversationsByLastMessageAt([
      { id: 'A', lastTime: '2026-01-01T10:10:00Z' },
      { id: 'B', lastTime: '2026-01-01T10:05:00Z' },
      { id: 'C', lastTime: '2026-01-01T10:20:00Z' },
    ]);
    assert.equal(list.map((c) => c.id).join(','), 'C,A,B');
  });

  it('4 immutable sort does not mutate input', () => {
    const input = [
      { id: 'A', lastTime: '2026-01-01T10:00:00Z' },
      { id: 'B', lastTime: '2026-01-01T10:05:00Z' },
    ];
    const copy = input.map((c) => ({ ...c }));
    sortConversationsByLastMessageAt(input);
    assert.deepEqual(input.map((c) => c.id), copy.map((c) => c.id));
  });

  it('5 merge by conversationId keeps newer lastTime + single row', () => {
    const merged = mergeConversationsById([
      { id: 'staff_1__student_s', lastTime: '2026-01-01T10:00:00Z', lastMessage: 'old', unread: 0, user: { id: '1', name: 'Staff' } },
      { id: 'staff_1__student_s', lastTime: '2026-01-01T10:10:00Z', lastMessage: 'new', unread: 1, user: { id: '1', name: 'Staff' } },
    ]);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].lastMessage, 'new');
    assert.equal(merged[0].unread, 1);
    assert.equal(conversationActivityTime(merged[0]), new Date('2026-01-01T10:10:00Z').getTime());
  });

  it('6 teacher/staff/support threads stay separate when ordered', () => {
    const merged = mergeConversationsById([
      { id: 'teacher_t__student_s', lastTime: '2026-01-01T10:00:00Z', user: { id: 't' } },
      { id: 'staff_a__student_s', lastTime: '2026-01-01T10:05:00Z', user: { id: 'a' } },
      { id: 'staff_b__student_s', lastTime: '2026-01-01T10:03:00Z', user: { id: 'b' } },
    ]);
    assert.equal(merged.length, 3);
    assert.equal(merged.map((c) => c.id).join(','), 'staff_a__student_s,staff_b__student_s,teacher_t__student_s');
  });

  it('7 Inbox uses mergeConversationsById / no in-place list.sort + userKey dedupe', () => {
    const inbox = read('client/src/components/Inbox.jsx');
    assert.ok(inbox.includes('mergeConversationsById'));
    assert.ok(inbox.includes('activityByPeer') || inbox.includes('activityById'));
    assert.equal(inbox.includes('finalSeenUserKeys'), false);
    assert.equal(/list\.sort\(/.test(inbox), false);
  });

  it('8 useDataMessaging uses immutable sortConversationsByLastMessageAt', () => {
    const src = read('client/src/context/useDataMessaging.js');
    assert.ok(src.includes('sortConversationsByLastMessageAt'));
    assert.equal(/Object\.values\(convMap\)\.sort\(/.test(src), false);
  });

  it('9 invalid lastTime does not break ordering', () => {
    const list = sortConversationsByLastMessageAt([
      { id: 'A', lastTime: 'bogus' },
      { id: 'B', lastTime: '2026-01-01T10:05:00Z' },
    ]);
    assert.equal(list[0].id, 'B');
  });

  it('10 legacy direct threads for one peer collapse while groups stay separate', () => {
    const merged = mergeDirectConversationsByPeer([
      { id: 'old_admin_high__teacher_t', lastTime: '2026-01-01T10:00:00Z', lastMessage: 'old', unread: 1, user: { id: 'high-1', adminRole: 'HIGH_ADMIN' } },
      { id: 'admin_admin__teacher_t', lastTime: '2026-01-01T10:05:00Z', lastMessage: 'new', unread: 0, user: { id: 'high-1', adminRole: 'HIGH_ADMIN' } },
      { id: 'group_g1', isGroup: true, lastTime: '2026-01-01T10:10:00Z', user: { id: 'high-1' } },
    ]);
    assert.equal(merged.length, 2);
    assert.equal(merged.find((c) => !c.isGroup).lastMessage, 'new');
    assert.equal(merged.find((c) => !c.isGroup).unread, 1);
    assert.equal(merged.find((c) => c.isGroup).id, 'group_g1');
  });

  it('11 default-named High Admin contacts collapse across legacy IDs', () => {
    assert.equal(conversationPeerKey({
      id: 'high-a',
      name: 'High Admin',
      adminRole: 'HIGH_ADMIN',
    }), 'admin:high_admin');
    assert.equal(conversationPeerKey({
      id: 'high-b',
      name: 'Admin cấp cao',
      adminRole: 'HIGH_ADMIN',
    }), 'admin:high_admin');
    assert.equal(conversationPeerKey({
      id: 'high-c',
      name: 'Nguyễn Văn A',
      adminRole: 'HIGH_ADMIN',
    }), 'high-c');
  });

  it('12 teacher mobile inbox only shows All and Students filters without hiding other conversations from All', () => {
    const mobileInbox = read('thang-tin-hoc-mobile/src/screens/MessageScreens.tsx');
    const teacherFilterDefinition = mobileInbox.match(/const categoryFilters = user\?\.role === 'teacher'[\s\S]*?\n    : \[/)?.[0] || '';

    assert.ok(teacherFilterDefinition.includes("{ id: 'all' as const, label: 'Tất cả' }"));
    assert.ok(teacherFilterDefinition.includes("{ id: 'student' as const, label: 'Học viên' }"));
    assert.ok(teacherFilterDefinition.includes("{ id: 'group' as const, label: 'Nhóm' }"));
    assert.equal(teacherFilterDefinition.includes("label: 'Admin'"), false);
    assert.equal(teacherFilterDefinition.includes("label: 'Tuyển sinh'"), false);
    assert.ok(mobileInbox.includes("(category === 'all' || item.category === category)"));
    assert.ok(mobileInbox.includes('styles.inboxFilterRow'));
    assert.ok(mobileInbox.includes('style={styles.filtersWrapper}'));
    assert.ok(mobileInbox.includes('inboxFilterRow: { width: \'100%\''));
    assert.ok(mobileInbox.includes('<Plus size={25} color={colors.brand} strokeWidth={2.8} />'));
    assert.equal(mobileInbox.includes('>Tạo nhóm chat</Text>'), false);
  });

  it('hides recruitment and support filters from the student mobile inbox but keeps all conversations visible in All', () => {
    const mobileInbox = read('thang-tin-hoc-mobile/src/screens/MessageScreens.tsx');
    const studentFilterDefinition = mobileInbox.match(/:\s*\[([\s\S]*?)\n      \];/)?.[1] || '';

    assert.ok(studentFilterDefinition.includes("{ id: 'all' as const, label: 'Tất cả' }"));
    assert.ok(studentFilterDefinition.includes("{ id: 'teacher' as const, label: 'Giảng viên' }"));
    assert.ok(studentFilterDefinition.includes("{ id: 'group' as const, label: 'Nhóm' }"));
    assert.equal(studentFilterDefinition.includes("'recruitment'"), false);
    assert.equal(studentFilterDefinition.includes("'support'"), false);
    assert.ok(mobileInbox.includes("(category === 'all' || item.category === category)"));
  });

  it('13 web inbox only shows All, Teachers, and Groups while keeping contact filtering and title-case names', () => {
    const inbox = read('client/src/components/Inbox.jsx');
    const tabBlock = inbox.match(/\/\* Hàng Tabs \(Pills\) Phân loại danh bạ \*\/[\s\S]*?\]\.map\(tab => \(/)?.[0] || '';

    assert.ok(tabBlock.includes("{ id: 'all', label: 'Tất cả' }"));
    assert.ok(tabBlock.includes("{ id: 'teacher', label: 'Giảng viên' }"));
    assert.ok(tabBlock.includes("{ id: 'group', label: 'Nhóm' }"));
    assert.equal(tabBlock.includes("label: 'Học viên'"), false);
    assert.equal(tabBlock.includes("label: 'Admin'"), false);
    assert.equal(tabBlock.includes("label: 'Tuyển sinh'"), false);
    assert.equal(tabBlock.includes("label: 'Hỗ trợ'"), false);
    assert.ok(inbox.includes("if (contactTab === 'all') return true;"));
    assert.ok(inbox.includes("if (contactTab === 'group') return c.isGroup;"));
    assert.ok(inbox.includes('<h4 className="font-semibold text-[#1E293B] text-base truncate">{formatDisplayName(conv.user.name)}</h4>'));
    assert.ok(inbox.includes('{formatDisplayName(c.user?.name) || \'Không rõ tên\'}'));
    assert.ok(inbox.includes('{formatDisplayName(u.name)}'));
  });

  it('14 mobile bottom navigation hides on downward scroll and returns on upward scroll', () => {
    const ui = read('thang-tin-hoc-mobile/src/components/ui.tsx');
    const navigation = read('thang-tin-hoc-mobile/src/navigation/RootNavigator.tsx');

    assert.ok(ui.includes("export const MOBILE_NAVIGATION_BAR_VISIBILITY_EVENT = 'mobile:navigation-bar-visibility'"));
    assert.ok(ui.includes('DeviceEventEmitter.emit(MOBILE_NAVIGATION_BAR_VISIBILITY_EVENT, false)'));
    assert.ok(ui.includes('DeviceEventEmitter.emit(MOBILE_NAVIGATION_BAR_VISIBILITY_EVENT, true)'));
    assert.ok(navigation.includes('MOBILE_NAVIGATION_BAR_VISIBILITY_EVENT,'));
    assert.ok(navigation.includes('translateY: visibility.interpolate'));
    assert.ok(navigation.includes('translateY: navigationBarVisibility.interpolate'));
    assert.ok(navigation.includes("AppState.addEventListener('change'"));
    assert.ok(navigation.includes('Animated.timing(navigationBarVisibility'));
    assert.ok(navigation.includes('fill={colors.canvas}'));
    assert.equal(navigation.includes('stroke="#E2E8F0"'), false);
    assert.ok(navigation.includes('borderTopColor: \'transparent\''));
    assert.equal(
      (navigation.match(/M0 26 C18 8 45 8 62 25 C78 40 77 82 106 86 C132 90 148 79 160 42 C170 9 183 0 200 0 C217 0 230 9 240 42 C252 79 268 90 294 86 C323 82 322 40 338 25 C355 8 382 8 400 26 V100 H0 Z/g) || []).length,
      2,
      'main and persistent tab bars should share the same curved background',
    );
  });

  it('15 mobile conversation preserves adminRole for consistent peer avatars', () => {
    const mobileInbox = read('thang-tin-hoc-mobile/src/screens/MessageScreens.tsx');
    const navigationTypes = read('thang-tin-hoc-mobile/src/navigation/types.ts');

    assert.ok(navigationTypes.includes('participantAdminRole?: string | null'));
    assert.ok(mobileInbox.includes('participantAdminRole: conversation.adminRole'));
    assert.equal(
      (mobileInbox.match(/route\.params\.participantAdminRole/g) || []).length,
      3,
      'chat header, message bubbles, and contact info should all resolve the avatar with the same admin role',
    );
    assert.ok(mobileInbox.includes('participantAvatarUri: conversation.avatarUri'));
  });

  it('mobile header and footer return to their visible state at screen focus and scroll top', () => {
    const ui = read('thang-tin-hoc-mobile/src/components/ui.tsx');

    assert.ok(ui.includes('useFocusEffect(useCallback(() => {'));
    assert.ok(ui.includes('DeviceEventEmitter.emit(BRANDING_HEADER_VISIBILITY_EVENT, true);'));
    assert.ok(ui.includes('DeviceEventEmitter.emit(MOBILE_NAVIGATION_BAR_VISIBILITY_EVENT, true);'));
    assert.ok(ui.includes('onScrollEndDrag={handleScroll}'));
    assert.ok(ui.includes('onMomentumScrollEnd={handleScroll}'));
    assert.ok(ui.includes('if (offsetY <= 8)'));
  });
});
