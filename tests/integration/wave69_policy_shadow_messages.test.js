/**
 * Wave 6.9 — Policy SHADOW for LIVE /api/messages authorization.
 * Equivalence only; Legacy remains HTTP authority. Socket path documented, not redesigned.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { PERMISSIONS } = require('../../constants/permissions');
const {
  buildSubject,
  evaluateLegacyMessage,
  evaluatePolicyMessage,
  compareDecisions,
  isAdminLevelAccount,
} = require('../../services/policyShadow/messagePolicy');

const BRANCH_A = '507f1f77bcf86cd7994390aa';
const TEACHER_A = '507f1f77bcf86cd7994390t1';
const TEACHER_B = '507f1f77bcf86cd7994390t2';
const STUDENT_A = '507f1f77bcf86cd7994390s1';
const STUDENT_B = '507f1f77bcf86cd7994390s2';
const ROOT = path.join(__dirname, '../..');

function subjectOf({
  id = '507f1f77bcf86cd799439011',
  role = 'staff',
  adminRole = 'STAFF',
  permissions = [],
  userBranchId = BRANCH_A,
  branchCode = 'A',
} = {}) {
  return buildSubject({
    user: { id, role, branchCode },
    actorDoc: { adminRole, permissions, role, branchCode },
    userBranchId,
  });
}

async function assertMatch(label, subject, action, ctx = {}, untrusted = {}) {
  const legacy = await evaluateLegacyMessage(subject, action, ctx);
  const policy = await evaluatePolicyMessage(subject, action, ctx, untrusted);
  const result = compareDecisions(legacy, policy);
  assert.equal(
    result,
    'MATCH',
    `${label}: ${result} L=${legacy.decision}/${legacy.reason} P=${policy.decision}/${policy.reason}`,
  );
  return { legacy, policy, result };
}

// ── Auth / role ──────────────────────────────────────────────────────────────

test('Wave6.9 MESSAGE: contacts/hidden/upload/hide auth-only', async () => {
  const staff = subjectOf({ permissions: [] });
  for (const a of ['contacts', 'hidden', 'upload', 'hide']) {
    assert.equal((await assertMatch(`auth-${a}`, staff, a)).legacy.decision, 'ALLOW');
  }
});

test('Wave6.9 MESSAGE: conversations self ALLOW; staff other DENY; admin ALLOW', async () => {
  const staff = subjectOf({ id: TEACHER_A, role: 'staff', adminRole: 'STAFF' });
  const admin = subjectOf({ id: 'admin', role: 'admin', adminRole: 'SUPER_ADMIN', userBranchId: null });
  assert.equal(
    (await assertMatch('conv-self', staff, 'conversations', { targetUserId: TEACHER_A })).legacy
      .decision,
    'ALLOW',
  );
  assert.equal(
    (await assertMatch('conv-other', staff, 'conversations', { targetUserId: TEACHER_B })).legacy
      .decision,
    'DENY',
  );
  assert.equal(
    (await assertMatch('conv-admin', admin, 'conversations', { targetUserId: TEACHER_B })).legacy
      .decision,
    'ALLOW',
  );
});

test('Wave6.9 MESSAGE: unread self-only (stricter)', async () => {
  const admin = subjectOf({ id: 'x1', role: 'admin', adminRole: 'HIGH_ADMIN' });
  assert.equal(
    (await assertMatch('unr+', admin, 'unread', { targetUserId: 'x1' })).legacy.decision,
    'ALLOW',
  );
  assert.equal(
    (await assertMatch('unr-', admin, 'unread', { targetUserId: 'other' })).legacy.decision,
    'DENY',
  );
});

test('Wave6.9 MESSAGE: VIEW/MANAGE_MESSAGES unused — missing perm still ALLOW contacts', async () => {
  const staff = subjectOf({ permissions: [PERMISSIONS.VIEW_TEACHERS] });
  assert.equal((await assertMatch('no-msg-perm', staff, 'contacts')).legacy.decision, 'ALLOW');
  assert.ok(PERMISSIONS.MANAGE_MESSAGES);
});

// ── Conversation / ownership ─────────────────────────────────────────────────

test('Wave6.9 MESSAGE: get_conversation participant vs non-participant', async () => {
  const teacher = subjectOf({
    id: TEACHER_A,
    role: 'teacher',
    adminRole: null,
    permissions: [],
  });
  const convSelf = `student_${STUDENT_A}__teacher_${TEACHER_A}`;
  const convOther = `student_${STUDENT_B}__teacher_${TEACHER_B}`;
  assert.equal(
    (await assertMatch('gc+', teacher, 'get_conversation', { conversationId: convSelf })).legacy
      .decision,
    'ALLOW',
  );
  assert.equal(
    (await assertMatch('gc-', teacher, 'get_conversation', { conversationId: convOther })).legacy
      .decision,
    'DENY',
  );
});

test('Wave6.9 MESSAGE: admin_admin mailbox only for admin-level', async () => {
  const staff = subjectOf({ id: TEACHER_A, role: 'staff', adminRole: 'STAFF' });
  const superSub = subjectOf({
    id: 'admin',
    role: 'admin',
    adminRole: 'SUPER_ADMIN',
    userBranchId: null,
  });
  assert.equal(
    (await assertMatch('aa-', staff, 'get_conversation', { conversationId: 'admin_admin' })).legacy
      .decision,
    'DENY',
  );
  assert.equal(
    (await assertMatch('aa+', superSub, 'get_conversation', { conversationId: 'admin_admin' }))
      .legacy.decision,
    'ALLOW',
  );
  assert.equal(isAdminLevelAccount(superSub), true);
});

test('Wave6.9 MESSAGE: send broadcast role gate; DM uses dmAccess ctx', async () => {
  const teacher = subjectOf({
    id: TEACHER_A,
    role: 'teacher',
    adminRole: null,
    permissions: [],
  });
  const staff = subjectOf({ role: 'staff', adminRole: 'STAFF' });
  assert.equal(
    (await assertMatch('bc-', teacher, 'send', { receiverId: 'ALL_USERS' })).legacy.decision,
    'DENY',
  );
  assert.equal(
    (await assertMatch('bc+', staff, 'send', { receiverId: 'ALL_STUDENTS' })).legacy.decision,
    'ALLOW',
  );
  assert.equal(
    (await assertMatch('dm+', teacher, 'send', {
      receiverId: STUDENT_A,
      receiverRole: 'student',
      dmAccess: { ok: true },
    })).legacy.decision,
    'ALLOW',
  );
  assert.equal(
    (await assertMatch('dm-', teacher, 'send', {
      receiverId: STUDENT_B,
      receiverRole: 'student',
      dmAccess: { ok: false, message: 'denied' },
    })).legacy.decision,
    'DENY',
  );
});

test('Wave6.9 MESSAGE: group send member vs non-member; missing group ALLOW 404', async () => {
  const teacher = subjectOf({
    id: TEACHER_A,
    role: 'teacher',
    adminRole: null,
    permissions: [],
  });
  assert.equal(
    (await assertMatch('gs+', teacher, 'send', {
      isGroup: true,
      groupId: 'g1',
      groupMember: true,
    })).legacy.decision,
    'ALLOW',
  );
  assert.equal(
    (await assertMatch('gs-', teacher, 'send', {
      isGroup: true,
      groupId: 'g1',
      groupMember: false,
    })).legacy.decision,
    'DENY',
  );
  assert.equal(
    (await assertMatch('gs-miss', teacher, 'send', {
      isGroup: true,
      groupId: 'g1',
      groupMissing: true,
    })).legacy.decision,
    'ALLOW',
  );
});

test('Wave6.9 MESSAGE: reaction/soft_delete participant; recall sender', async () => {
  const teacher = subjectOf({
    id: TEACHER_A,
    role: 'teacher',
    adminRole: null,
    permissions: [],
  });
  const other = subjectOf({
    id: TEACHER_B,
    role: 'teacher',
    adminRole: null,
    permissions: [],
  });
  const msg = { senderId: TEACHER_A, receiverId: STUDENT_A, isGroup: false };
  assert.equal(
    (await assertMatch('rx+', teacher, 'reaction', { message: msg })).legacy.decision,
    'ALLOW',
  );
  assert.equal(
    (await assertMatch('rx-', other, 'reaction', { message: msg })).legacy.decision,
    'DENY',
  );
  assert.equal(
    (await assertMatch('rc+', teacher, 'recall', { message: msg })).legacy.decision,
    'ALLOW',
  );
  assert.equal(
    (await assertMatch('rc-', other, 'recall', { message: msg })).legacy.decision,
    'DENY',
  );
});

test('Wave6.9 MESSAGE: group_create student DENY; group_delete creator/admin-level', async () => {
  const student = subjectOf({
    id: STUDENT_A,
    role: 'student',
    adminRole: null,
    permissions: [],
    userBranchId: null,
  });
  const teacher = subjectOf({
    id: TEACHER_A,
    role: 'teacher',
    adminRole: null,
    permissions: [],
  });
  const other = subjectOf({
    id: TEACHER_B,
    role: 'teacher',
    adminRole: null,
    permissions: [],
  });
  assert.equal((await assertMatch('gc-s', student, 'group_create')).legacy.decision, 'DENY');
  assert.equal((await assertMatch('gc-t', teacher, 'group_create')).legacy.decision, 'ALLOW');
  assert.equal(
    (await assertMatch('gd+', teacher, 'group_delete', {
      group: { createdBy: { userId: TEACHER_A } },
    })).legacy.decision,
    'ALLOW',
  );
  assert.equal(
    (await assertMatch('gd-', other, 'group_delete', {
      group: { createdBy: { userId: TEACHER_A } },
    })).legacy.decision,
    'DENY',
  );
});

test('Wave6.9 MESSAGE: broadcast HTTP role gate; spoof cannot widen', async () => {
  const teacher = subjectOf({
    id: TEACHER_A,
    role: 'teacher',
    adminRole: null,
    permissions: [PERMISSIONS.MANAGE_MESSAGES],
  });
  const staff = subjectOf({ role: 'staff', adminRole: 'STAFF', permissions: [] });
  assert.equal(
    (await assertMatch('br-', teacher, 'broadcast', {}, {
      clientRole: 'admin',
      clientPermissions: [PERMISSIONS.MANAGE_MESSAGES],
      bodyBranchId: BRANCH_A,
    })).legacy.decision,
    'DENY',
  );
  assert.equal((await assertMatch('br+', staff, 'broadcast')).legacy.decision, 'ALLOW');
});

test('Wave6.9 MESSAGE: spoof senderId/branch/tenant ignored on send', async () => {
  const teacher = subjectOf({
    id: TEACHER_A,
    role: 'teacher',
    adminRole: null,
    permissions: [],
  });
  assert.equal(
    (await assertMatch('spoof-send', teacher, 'send', {
      receiverId: 'ALL_USERS',
    }, {
      bodySenderId: 'admin',
      clientRole: 'admin',
      bodyBranchId: BRANCH_A,
      bodyTenantId: 'tenant-x',
      queryTenantId: 'tenant-y',
    })).legacy.decision,
    'DENY',
  );
});

// ── Fail-closed ──────────────────────────────────────────────────────────────

test('Wave6.9 fail-closed: Policy throw → ERROR; next()', async () => {
  const policyPath = require.resolve('../../services/policyShadow/messagePolicy');
  const mwPath = require.resolve('../../middleware/policyShadowMessage');
  const teacherPath = require.resolve('../../models/Teacher');
  delete require.cache[policyPath];
  delete require.cache[mwPath];
  delete require.cache[teacherPath];
  const policyMod = require('../../services/policyShadow/messagePolicy');
  policyMod.evaluatePolicyMessage = async () => {
    throw new Error('forced message policy failure');
  };
  const Teacher = require('../../models/Teacher');
  const orig = Teacher.findById;
  Teacher.findById = () => ({
    select() {
      return {
        lean: async () => ({
          adminRole: 'STAFF',
          permissions: [],
          role: 'staff',
          branchCode: 'A',
        }),
      };
    },
  });
  try {
    const { policyShadowMessage } = require('../../middleware/policyShadowMessage');
    const mw = policyShadowMessage('contacts');
    let nextCount = 0;
    const req = {
      user: { id: '507f1f77bcf86cd799439011', role: 'staff' },
      userBranchId: BRANCH_A,
      params: {},
      body: {},
      query: {},
      method: 'GET',
      originalUrl: '/api/messages/contacts',
      requestId: 'req-wave69',
      correlationId: 'corr-wave69',
    };
    const res = {
      statusCode: null,
      status(c) { this.statusCode = c; return this; },
      json() { return this; },
    };
    await mw(req, res, () => { nextCount += 1; });
    assert.equal(nextCount, 1);
    assert.equal(res.statusCode, null);
    assert.equal(req.policyShadow.comparison, 'ERROR');
  } finally {
    Teacher.findById = orig;
    delete require.cache[policyPath];
    delete require.cache[mwPath];
    delete require.cache[teacherPath];
    require('../../services/policyShadow/messagePolicy');
    require('../../middleware/policyShadowMessage');
  }
});

// ── Static ───────────────────────────────────────────────────────────────────

test('Wave6.9 static: routes keep legacy + shadow; CQRS OFF; no global Policy', () => {
  const src = fs.readFileSync(path.join(ROOT, 'routes/messageRoutes.js'), 'utf8');
  const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  for (const a of [
    'contacts', 'conversations', 'search', 'hidden', 'get_conversation', 'sync',
    'upload', 'send', 'hide', 'read', 'reaction', 'recall', 'soft_delete',
    'group_create', 'group_list', 'group_delete', 'unread', 'broadcast',
  ]) {
    assert.ok(
      src.includes(`messagesGuard('${a}')`) || src.includes(`policyShadowMessage('${a}')`),
      a,
    );
  }
  assert.ok(src.includes('messagesCutoverGate') || src.includes('messagesGuard'));
  assert.ok(src.includes('sendCanonicalMessage'));
  const dms = fs.readFileSync(path.join(ROOT, 'services/directMessageService.js'), 'utf8');
  assert.ok(dms.includes('assertCanDirectMessage'));
  assert.ok(src.includes('authMiddleware'));
  assert.ok(!src.includes('checkPermission'));
  assert.ok(!src.includes('MANAGE_MESSAGES'));
  assert.ok(!/new Message\(req\.body\)/.test(src));
  assert.ok(!/findOneAndUpdate\([^,]+,\s*req\.body/.test(src));
  assert.ok(src.includes('Message.create({') || dms.includes('Message.create('));
  assert.ok(server.includes("app.use('/api/messages'"));
  assert.ok(!server.includes("require('./modules/chat"));
  assert.ok(server.includes("socket.on('message:send'"));
  assert.ok(server.includes("io.emit('message:receive'")); // intentional ALL_USERS global
  assert.ok(/ENABLE_CQRS_TEACHER\s*=\s*false/.test(env));
  assert.ok(/ENABLE_CQRS_STUDENT_CREATE\s*=\s*false/.test(env));
  assert.ok(/ENABLE_CQRS_INVOICE\s*=\s*false/.test(env));
  assert.ok(!/app\.use\(\s*['"]\/api\/.*policy/i.test(server));
  const gate = fs.readFileSync(path.join(ROOT, 'middleware/messagesCutoverGate.js'), 'utf8');
  assert.ok(gate.includes("getAuthorizationAuthority('messages')"));
  assert.ok(gate.includes('legacyMessagesGate'));
  assert.ok(!gate.includes('Message.create'));
  assert.ok(!gate.includes("io.emit("));
  const adapter = fs.readFileSync(
    path.join(ROOT, 'services/policyShadow/livePermissionAdapter.js'),
    'utf8',
  );
  assert.ok(adapter.includes("require('../../constants/permissions')"));
  assert.ok(!adapter.includes("require('../../shared/constants/permissions')"));
});

test('Wave6.9 static: shadow middleware always next(); never HTTP deny', () => {
  const src = fs.readFileSync(path.join(ROOT, 'middleware/policyShadowMessage.js'), 'utf8');
  assert.ok(src.includes('return next()'));
  assert.ok(!/res\.status\(403\)/.test(src));
  assert.ok(!/res\.status\(401\)/.test(src));
  assert.ok(src.includes('POLICY_MISMATCH') || src.includes('POLICY_SHADOW_ERROR'));
});

test('Wave6.9 inventory: modules/chat UNMOUNTED; live chatAccess via directMessageService', () => {
  const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const dms = fs.readFileSync(path.join(ROOT, 'services/directMessageService.js'), 'utf8');
  assert.ok(server.includes("require('./routes/messageRoutes')"));
  assert.ok(server.includes('sendCanonicalMessage') || server.includes('directMessageService'));
  assert.ok(dms.includes('chatAccessService'));
  assert.ok(!server.includes("modules/chat/routes/messageRoutes"));
  assert.ok(fs.existsSync(path.join(ROOT, 'modules/chat/routes/messageRoutes.js')));
});
