/**
 * Phase 8.24 — Messaging pairing lock + canonical conversationId.
 * Does NOT touch Enterprise RBAC.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { buildConversationId } = require('../../utils/chatConversationId');
const { getMessagingRole, canAccessDirectConversation } = require('../../utils/messagingRoles');
const {
  PRODUCT_ROLES,
  resolveProductRole,
  isPairStructurallyAllowed,
  buildCanonicalConversationId,
  aliasStaffMislabelledConversationId,
  expandConversationIdAliases,
} = require('../../services/messagingPairing');

const ROOT = path.join(__dirname, '../..');
const STAFF_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const STUDENT_ID = 'cccccccccccccccccccccccc';

describe('Phase 8.24 messaging pairing lock', { concurrency: false }, () => {
  it('product roles resolve from adminRole', () => {
    assert.equal(resolveProductRole({ id: 'admin' }), PRODUCT_ROLES.SUPER_ADMIN);
    assert.equal(resolveProductRole({ adminRole: 'HIGH_ADMIN', role: 'admin' }), PRODUCT_ROLES.HIGH_ADMIN);
    assert.equal(resolveProductRole({ adminRole: 'STAFF', role: 'admin' }), PRODUCT_ROLES.STAFF);
    assert.equal(resolveProductRole({ adminRole: 'SUPPORT', role: 'admin' }), PRODUCT_ROLES.SUPPORT);
    assert.equal(resolveProductRole({ role: 'teacher' }), PRODUCT_ROLES.TEACHER);
    assert.equal(resolveProductRole({ role: 'student' }), PRODUCT_ROLES.STUDENT);
  });

  it('deny student↔student and teacher↔teacher', () => {
    assert.equal(
      isPairStructurallyAllowed(PRODUCT_ROLES.STUDENT, PRODUCT_ROLES.STUDENT),
      false,
    );
    assert.equal(
      isPairStructurallyAllowed(PRODUCT_ROLES.TEACHER, PRODUCT_ROLES.TEACHER),
      false,
    );
  });

  it('allow SUPPORT↔student/teacher and TEACHER↔STUDENT structurally', () => {
    assert.equal(
      isPairStructurallyAllowed(PRODUCT_ROLES.SUPPORT, PRODUCT_ROLES.STUDENT),
      true,
    );
    assert.equal(
      isPairStructurallyAllowed(PRODUCT_ROLES.SUPPORT, PRODUCT_ROLES.TEACHER),
      true,
    );
    assert.equal(
      isPairStructurallyAllowed(PRODUCT_ROLES.TEACHER, PRODUCT_ROLES.STUDENT),
      true,
    );
    assert.equal(
      isPairStructurallyAllowed(PRODUCT_ROLES.STUDENT, PRODUCT_ROLES.TEACHER),
      true,
    );
  });

  it('canonical id ignores client admin role for STAFF peer', () => {
    const sender = { id: STUDENT_ID, role: 'student' };
    // Wrong client would say admin — server must still build staff_* when peer transport is staff
    const wrongClientWouldBe = buildConversationId('student', STUDENT_ID, 'admin', STAFF_ID);
    const canonical = buildCanonicalConversationId(sender, 'staff', STAFF_ID);
    assert.notEqual(wrongClientWouldBe, canonical);
    assert.ok(canonical.includes(`staff_${STAFF_ID}`));
    assert.ok(!canonical.includes(`admin_${STAFF_ID}`));
    assert.ok(!canonical.includes('admin_admin'));
  });

  it('same pair with correct role does not create second thread id', () => {
    const sender = { id: STUDENT_ID, role: 'student' };
    const a = buildCanonicalConversationId(sender, 'staff', STAFF_ID);
    const b = buildCanonicalConversationId(sender, 'staff', STAFF_ID);
    assert.equal(a, b);
  });

  it('alias admin_<staffMongoId> → staff_<id>', () => {
    const legacy = ['admin_' + STAFF_ID, 'student_' + STUDENT_ID].sort().join('__');
    const { conversationId, aliased } = aliasStaffMislabelledConversationId(legacy);
    assert.equal(aliased, true);
    assert.ok(conversationId.includes(`staff_${STAFF_ID}`));
    assert.ok(!conversationId.includes(`admin_${STAFF_ID}`));
  });

  it('alias does not rewrite legacy admin_admin mailbox', () => {
    const mailbox = buildConversationId('admin', 'admin', 'student', STUDENT_ID);
    const { conversationId, aliased } = aliasStaffMislabelledConversationId(mailbox);
    assert.equal(aliased, false);
    assert.equal(conversationId, mailbox);
    assert.ok(mailbox.includes('admin_admin'));
  });

  it('expandConversationIdAliases includes both staff and mislabelled admin forms', () => {
    const canonical = buildConversationId('staff', STAFF_ID, 'student', STUDENT_ID);
    const { ids } = expandConversationIdAliases(canonical);
    assert.ok(ids.includes(canonical));
    assert.ok(ids.some((id) => id.includes(`admin_${STAFF_ID}`)));
  });

  it('SUPER/HIGH still access admin_admin; STAFF does not', () => {
    const conv = buildConversationId('admin', 'admin', 'student', STUDENT_ID);
    assert.equal(
      canAccessDirectConversation(conv, { id: 'bbbbbbbbbbbbbbbbbbbbbbbb', role: 'admin', adminRole: 'SUPER_ADMIN' }),
      true,
    );
    assert.equal(
      canAccessDirectConversation(conv, { id: STAFF_ID, role: 'admin', adminRole: 'STAFF' }),
      false,
    );
    assert.equal(
      canAccessDirectConversation(conv, { id: STAFF_ID, role: 'admin', adminRole: 'SUPPORT' }),
      false,
    );
  });

  it('STAFF getMessagingRole remains staff (not admin)', () => {
    assert.equal(getMessagingRole({ id: STAFF_ID, role: 'admin', adminRole: 'STAFF' }), 'staff');
  });

  it('wiring: pairing module + send path + docs exist', () => {
    assert.ok(fs.existsSync(path.join(ROOT, 'services/messagingPairing.js')));
    assert.ok(fs.existsSync(path.join(ROOT, 'services/messagingPolicy.js')));
    assert.ok(fs.existsSync(path.join(ROOT, 'docs/messaging/pairing-matrix-824.md')));
    assert.ok(fs.existsSync(path.join(ROOT, 'docs/messaging/contact-visibility-824b.md')));
    const send = fs.readFileSync(path.join(ROOT, 'services/directMessageService.js'), 'utf8');
    assert.ok(send.includes('buildCanonicalConversationId'));
    // Phase 4: DMS → assertCanDirectMessage → MessagingPolicy → pairing
    assert.ok(send.includes('assertCanDirectMessage'));
    assert.ok(!send.includes("buildConversationId(senderRole, senderId, rRole, rid)"));
    const access = fs.readFileSync(path.join(ROOT, 'services/chatAccessService.js'), 'utf8');
    assert.ok(access.includes('messagingPolicy'));
    const policy = fs.readFileSync(path.join(ROOT, 'services/messagingPolicy.js'), 'utf8');
    assert.ok(policy.includes('assertMessagingPairAllowed'));
    const routes = fs.readFileSync(path.join(ROOT, 'routes/messageRoutes.js'), 'utf8');
    assert.ok(routes.includes('expandConversationIdAliases'));
    assert.ok(routes.includes('listDiscoverableContacts') || routes.includes('messagingContactsService'));
    const contactsSvc = fs.readFileSync(path.join(ROOT, 'services/messagingContactsService.js'), 'utf8');
    assert.ok(contactsSvc.includes('loadHighAdminDocs') || contactsSvc.includes('HIGH_ADMIN'));
    assert.ok(contactsSvc.includes('SUPER_ADMIN') && contactsSvc.includes('HIGH_ADMIN'));
  });
});
