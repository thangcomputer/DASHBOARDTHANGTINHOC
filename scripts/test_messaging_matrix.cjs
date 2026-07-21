/**
 * Messaging matrix smoke test (API-level).
 *
 * Requires MongoDB running + existing accounts for teacher/student/staff (if you test them).
 *
 * Env vars:
 *   API_ORIGIN=http://localhost:5000
 *
 *   # Admin master (works without DB for login, but messaging requires DB)
 *   ADMIN_IDENTIFIER=admin
 *   ADMIN_PASSWORD=admin123
 *
 *   # Optional: staff/teacher/student accounts (in DB)
 *   STAFF_IDENTIFIER=...
 *   STAFF_PASSWORD=...
 *   TEACHER_IDENTIFIER=...
 *   TEACHER_PASSWORD=...
 *   STUDENT_IDENTIFIER=...
 *   STUDENT_PASSWORD=...
 *
 * Notes:
 * - This script tests that conversationId is stable and matches roles/ids.
 * - It sends small text messages; it does NOT test socket delivery.
 */
const axios = require('axios');
const { getMessagingRole } = require('../utils/messagingRoles');

const API_ORIGIN = process.env.API_ORIGIN || 'http://localhost:5000';

function reqEnv(name, fallback = undefined) {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === null || String(v).trim() === '') return null;
  return String(v).trim();
}

function makeConvId(role1, id1, role2, id2) {
  return [`${role1}_${id1}`, `${role2}_${id2}`].sort().join('__');
}

async function login({ identifier, password, roleHint }) {
  const res = await axios.post(
    `${API_ORIGIN}/api/auth/login`,
    { identifier, password, role: roleHint },
    { headers: { 'Content-Type': 'application/json' }, timeout: 15_000 }
  );
  if (!res.data?.success) throw new Error(`Login failed: ${res.data?.message || 'unknown'}`);
  const wrapper = res.data.data || {};
  const data = wrapper.user ? { ...wrapper.user, ...wrapper } : wrapper;
  const accessToken = wrapper.accessToken || data.accessToken || data.token;
  if (!accessToken) throw new Error('Login ok but missing accessToken');
  const user = {
    id: data.id || data._id,
    role: data.role,
    name: data.name,
    adminRole: data.adminRole,
    accessToken,
  };
  if (!user.id || !user.role) throw new Error('Login ok but missing user id/role');
  return user;
}

function apiFor(user) {
  return axios.create({
    baseURL: `${API_ORIGIN}/api`,
    timeout: 20_000,
    headers: {
      Authorization: `Bearer ${user.accessToken}`,
      'Content-Type': 'application/json',
    },
  });
}

async function getContacts(user) {
  const api = apiFor(user);
  const res = await api.get('/messages/contacts');
  if (!res.data?.success) throw new Error(`contacts failed: ${res.data?.message || 'unknown'}`);
  return res.data.data || [];
}

async function sendDirectMessage(sender, receiver, content) {
  const api = apiFor(sender);
  const payload = {
    receiverId: receiver.id,
    receiverName: receiver.name || receiver.id,
    receiverRole: receiver.role,
    content,
    isGroup: false,
    messageType: 'text',
  };
  const res = await api.post('/messages', payload);
  if (!res.data?.success) throw new Error(`send failed: ${res.data?.message || 'unknown'}`);
  return res.data.data;
}

async function getConversationMessages(viewer, conversationId) {
  const api = apiFor(viewer);
  const res = await api.get(`/messages/${encodeURIComponent(conversationId)}`);
  if (!res.data?.success) throw new Error(`get messages failed: ${res.data?.message || 'unknown'}`);
  return res.data.data || [];
}

function pickContactByRole(contacts, role) {
  return contacts.find((c) => String(c.role) === String(role)) || null;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function run() {
  const plan = [];

  const adminIdentifier = reqEnv('ADMIN_IDENTIFIER', 'admin');
  const adminPassword = reqEnv('ADMIN_PASSWORD', 'admin123');
  const staffIdentifier = reqEnv('STAFF_IDENTIFIER');
  const staffPassword = reqEnv('STAFF_PASSWORD');
  const teacherIdentifier = reqEnv('TEACHER_IDENTIFIER');
  const teacherPassword = reqEnv('TEACHER_PASSWORD');
  const studentIdentifier = reqEnv('STUDENT_IDENTIFIER');
  const studentPassword = reqEnv('STUDENT_PASSWORD');

  console.log(`API_ORIGIN=${API_ORIGIN}`);

  const admin = await login({ identifier: adminIdentifier, password: adminPassword, roleHint: 'admin' });
  console.log(`✅ login admin: ${admin.id} (${admin.role}) adminRole=${admin.adminRole || ''}`);

  // Contacts requires DB — so fail here with a clear message if DB is down
  let adminContacts;
  try {
    adminContacts = await getContacts(admin);
  } catch (e) {
    console.error('❌ Cannot query /messages/contacts. Is MongoDB running?');
    throw e;
  }

  // Validate: staff must be role=staff (never admin)
  const anyBadStaff = adminContacts.filter((c) => (c.adminRole === 'STAFF' || c.role === 'staff') && c.role === 'admin');
  assert(anyBadStaff.length === 0, 'Contacts contains STAFF mapped to role=admin (should be staff)');

  // Validate: SuperAdmin must not be forced to id="admin"
  const forcedAdminId = adminContacts.filter((c) => c.adminRole === 'SUPER_ADMIN' && String(c.id) === 'admin');
  assert(forcedAdminId.length === 0, 'Contacts contains SUPER_ADMIN with id="admin" (should be real _id)');

  // Optional logins (full bidirectional checks)
  const staff = (staffIdentifier && staffPassword)
    ? await login({ identifier: staffIdentifier, password: staffPassword, roleHint: 'admin' })
    : null;
  if (staff) console.log(`✅ login staff: ${staff.id} (${staff.role}) adminRole=${staff.adminRole || ''}`);

  const teacher = (teacherIdentifier && teacherPassword)
    ? await login({ identifier: teacherIdentifier, password: teacherPassword, roleHint: 'teacher' })
    : null;
  if (teacher) console.log(`✅ login teacher: ${teacher.id} (${teacher.role})`);

  const student = (studentIdentifier && studentPassword)
    ? await login({ identifier: studentIdentifier, password: studentPassword, roleHint: 'student' })
    : null;
  if (student) console.log(`✅ login student: ${student.id} (${student.role})`);

  // Always do admin -> (staff/teacher/student) using contacts (no receiver creds needed)
  const cStaff = pickContactByRole(adminContacts, 'staff');
  const cTeacher = pickContactByRole(adminContacts, 'teacher');
  const cStudent = pickContactByRole(adminContacts, 'student');

  if (cStaff) plan.push([admin, { id: cStaff.id, role: cStaff.role, name: cStaff.name }, 'admin->staff']);
  if (cTeacher) plan.push([admin, { id: cTeacher.id, role: cTeacher.role, name: cTeacher.name }, 'admin->teacher']);
  if (cStudent) plan.push([admin, { id: cStudent.id, role: cStudent.role, name: cStudent.name }, 'admin->student']);

  // Build additional pairs we can run based on provided accounts (bidirectional)
  if (teacher) plan.push([admin, teacher, 'admin->teacher (cred)']);
  if (student) plan.push([admin, student, 'admin->student (cred)']);
  if (teacher && student) {
    plan.push([teacher, student, 'teacher->student']);
    plan.push([student, teacher, 'student->teacher']);
  }
  if (staff && teacher) plan.push([staff, teacher, 'staff->teacher']);
  if (staff && student) plan.push([staff, student, 'staff->student']);
  if (staff) plan.push([staff, admin, 'staff->admin']);

  assert(plan.length > 0, 'No test pairs available. Ensure your DB has at least one contact, or provide TEACHER_*/STUDENT_*/STAFF_* env vars.');

  for (const [from, to, label] of plan) {
    const fromRole = getMessagingRole(from);
    const toRole = getMessagingRole({ id: to.id, role: to.role, adminRole: to.adminRole });
    const convId = makeConvId(fromRole, from.id, toRole, to.id);
    const content = `[matrix:${label}] ${new Date().toISOString()}`;

    console.log(`\n→ ${label}`);
    const sent = await sendDirectMessage(from, to, content);

    assert(String(sent.conversationId) === String(convId), `conversationId mismatch: expected ${convId} got ${sent.conversationId}`);
    assert(String(sent.senderId) === String(from.id), `senderId mismatch: expected ${from.id} got ${sent.senderId}`);
    assert(String(sent.senderRole) === String(fromRole), `senderRole mismatch: expected ${fromRole} got ${sent.senderRole}`);

    // Verify the receiver can fetch that conversation (RBAC) if receiver creds exist
    if (to.accessToken) {
      const msgs = await getConversationMessages(to, convId);
      assert(msgs.some((m) => String(m._id) === String(sent._id)), 'Receiver cannot see sent message in conversation');
    }

    // Verify no "role drift": conversation tokens must match exact roles
    const tokens = convId.split('__').map((p) => p.split('_')[0]);
    assert(tokens.includes(fromRole) && tokens.includes(toRole), `conversationId roles missing: ${convId}`);

    console.log(`✅ ok: ${convId}`);
  }

  console.log('\n✅ Messaging matrix PASSED');
}

async function runPrivacyCheck() {
  const admin = await login({
    identifier: process.env.ADMIN_IDENTIFIER || 'admin',
    password: process.env.ADMIN_PASSWORD || 'admin123',
    roleHint: 'admin',
  });
  const staff = await login({
    identifier: process.env.STAFF_IDENTIFIER || '0920000010',
    password: process.env.STAFF_PASSWORD || 'Test@123',
    roleHint: 'admin',
  });
  const student = await login({
    identifier: process.env.STUDENT_IDENTIFIER || '0900000010',
    password: process.env.STUDENT_PASSWORD || 'Test@123',
    roleHint: 'student',
  });

  const staffRole = getMessagingRole(staff);
  const convId = makeConvId('student', student.id, staffRole, staff.id);

  console.log('\n→ privacy: student->staff (super admin must NOT access)');
  const sent = await sendDirectMessage(student, {
    id: staff.id,
    role: staffRole,
    name: staff.name,
    adminRole: staff.adminRole,
  }, `[privacy:student-staff] ${Date.now()}`);

  assert(String(sent.conversationId) === convId, `unexpected convId ${sent.conversationId}`);

  try {
    await getConversationMessages(admin, convId);
    throw new Error('super admin could read student-staff conversation');
  } catch (e) {
    const status = e.response?.status;
    if (status !== 403) throw e;
  }

  const staffMsgs = await getConversationMessages(staff, convId);
  assert(staffMsgs.some((m) => String(m._id) === String(sent._id)), 'staff should see student message');

  console.log('✅ privacy ok: super admin blocked, staff can read');
}

async function runAll() {
  await run();
  await runPrivacyCheck();
  console.log('\n✅ All messaging checks PASSED');
}

runAll().catch((e) => {
  console.error('\n❌ Messaging matrix FAILED');
  console.error(e?.message || e);
  process.exit(1);
});

