/**
 * Phase 4 — Canonical MessagingPolicy lock.
 * Authority: MESSAGING_BUSINESS_DECISIONS.md + pairing 8.24 + contacts 8.24B.
 * No DB required for structural / discover / identity tests.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { buildConversationId } = require('../../utils/chatConversationId');
const {
  PRODUCT_ROLES,
  normalizeIdentity,
  canDiscoverContacts,
  canSendStructurally,
  canViewConversation,
  canMarkRead,
  canReceiveMessage,
  canReceiveNotification,
  canStartConversation,
} = require('../../services/messagingPolicy');

const ROOT = path.join(__dirname, '../..');

const IDS = {
  studentA: '111111111111111111111111',
  studentB: '222222222222222222222222',
  teacherA: '333333333333333333333333',
  teacherB: '444444444444444444444444',
  staffA: '555555555555555555555555',
  supportA: '666666666666666666666666',
  supportB: '777777777777777777777777',
  highA: '888888888888888888888888',
  superA: '999999999999999999999999',
};

const TENANT = '607f1f77bcf86cd7994390aa';

const actors = {
  student: { id: IDS.studentA, role: 'student', branchId: 'brA', branchCode: 'A', tenantId: TENANT },
  studentB: { id: IDS.studentB, role: 'student', branchId: 'brB', branchCode: 'B', tenantId: TENANT },
  teacher: { id: IDS.teacherA, role: 'teacher', branchId: 'brA', branchCode: 'A', tenantId: TENANT },
  teacherB: { id: IDS.teacherB, role: 'teacher', branchId: 'brB', branchCode: 'B', tenantId: TENANT },
  staff: { id: IDS.staffA, role: 'admin', adminRole: 'STAFF', branchId: 'brA', branchCode: 'A', tenantId: TENANT },
  support: { id: IDS.supportA, role: 'admin', adminRole: 'SUPPORT', branchId: 'brA', branchCode: 'A', tenantId: TENANT },
  supportB: { id: IDS.supportB, role: 'admin', adminRole: 'SUPPORT', branchId: 'brB', branchCode: 'B', tenantId: TENANT },
  high: { id: IDS.highA, role: 'admin', adminRole: 'HIGH_ADMIN', tenantId: TENANT },
  super: { id: IDS.superA, role: 'admin', adminRole: 'SUPER_ADMIN', tenantId: TENANT },
  root: { id: 'admin', role: 'admin', adminRole: 'SUPER_ADMIN', tenantId: TENANT },
};

describe('Phase 4 MessagingPolicy', { concurrency: false }, () => {
  it('SUPPORT transportRole is staff but productRole is SUPPORT', () => {
    const n = normalizeIdentity(actors.support);
    assert.equal(n.productRole, PRODUCT_ROLES.SUPPORT);
    assert.equal(n.transportRole, 'staff');
    assert.notEqual(n.productRole, PRODUCT_ROLES.STAFF);
  });

  it('STAFF productRole remains STAFF with transport staff', () => {
    const n = normalizeIdentity(actors.staff);
    assert.equal(n.productRole, PRODUCT_ROLES.STAFF);
    assert.equal(n.transportRole, 'staff');
  });

  it('never treats transport staff alone as product STAFF for SUPPORT', () => {
    const d = canDiscoverContacts(actors.student, actors.support, { sameBranch: true });
    assert.equal(d.allowed, true);
    assert.equal(d.targetProductRole, PRODUCT_ROLES.SUPPORT);
    const staffDiscover = canDiscoverContacts(actors.student, actors.staff, { sameBranch: true });
    assert.equal(staffDiscover.allowed, true);
    assert.equal(staffDiscover.targetProductRole, PRODUCT_ROLES.STAFF);
  });

  it('discover matrix — student', () => {
    assert.equal(canDiscoverContacts(actors.student, actors.studentB).allowed, false);
    assert.equal(canDiscoverContacts(actors.student, actors.teacher, { assigned: true }).allowed, true);
    assert.equal(canDiscoverContacts(actors.student, actors.teacher, { assigned: false }).allowed, false);
    assert.equal(canDiscoverContacts(actors.student, actors.support).allowed, true);
    assert.equal(canDiscoverContacts(actors.student, actors.staff, { sameBranch: true }).allowed, true);
    assert.equal(canDiscoverContacts(actors.student, actors.staff, { sameBranch: false }).allowed, false);
    assert.equal(canDiscoverContacts(actors.student, actors.high).allowed, false);
    assert.equal(canDiscoverContacts(actors.student, actors.super).allowed, false);
  });

  it('discover matrix — teacher', () => {
    assert.equal(canDiscoverContacts(actors.teacher, actors.teacherB).allowed, false);
    assert.equal(canDiscoverContacts(actors.teacher, actors.student, { assigned: true }).allowed, true);
    assert.equal(canDiscoverContacts(actors.teacher, actors.support).allowed, true);
    assert.equal(canDiscoverContacts(actors.teacher, actors.staff).allowed, true);
    assert.equal(canDiscoverContacts(actors.teacher, actors.high).allowed, true);
    assert.equal(canDiscoverContacts(actors.teacher, actors.super).allowed, false);
  });

  it('discover matrix — staff / support / elevated', () => {
    assert.equal(canDiscoverContacts(actors.staff, actors.support).allowed, true);
    assert.equal(canDiscoverContacts(actors.staff, actors.student, { sameBranch: true }).allowed, true);
    assert.equal(canDiscoverContacts(actors.staff, actors.student, { sameBranch: false }).allowed, false);
    assert.equal(canDiscoverContacts(actors.staff, actors.super).allowed, false);
    assert.equal(canDiscoverContacts(actors.support, actors.student).allowed, true);
    assert.equal(canDiscoverContacts(actors.support, actors.teacher).allowed, true);
    assert.equal(canDiscoverContacts(actors.support, actors.staff).allowed, true);
    assert.equal(canDiscoverContacts(actors.support, actors.supportB).allowed, true);
    assert.equal(canDiscoverContacts(actors.support, actors.super).allowed, false);
    assert.equal(canDiscoverContacts(actors.super, actors.high).allowed, true);
    assert.equal(canDiscoverContacts(actors.super, actors.student).allowed, false);
    assert.equal(canDiscoverContacts(actors.high, actors.student).allowed, false);
    assert.equal(canDiscoverContacts(actors.high, actors.teacher).allowed, true);
    assert.equal(canDiscoverContacts(actors.high, actors.super).allowed, true);
  });

  it('structural send — dual-layer C1 (send allow, discover deny SUPER); HIGH↔student deny both', () => {
    assert.equal(canSendStructurally(actors.student, actors.super).allowed, true);
    assert.equal(canSendStructurally(actors.student, actors.high).allowed, false);
    assert.equal(canDiscoverContacts(actors.student, actors.super).allowed, false);
    assert.equal(canDiscoverContacts(actors.student, actors.high).allowed, false);
  });

  it('structural send — deny peer same role; allow approved pairs', () => {
    assert.equal(canSendStructurally(actors.student, actors.studentB).allowed, false);
    assert.equal(canSendStructurally(actors.teacher, actors.teacherB).allowed, false);
    assert.equal(canSendStructurally(actors.student, actors.teacher).allowed, true);
    assert.equal(canSendStructurally(actors.student, actors.support).allowed, true);
    assert.equal(canSendStructurally(actors.teacher, actors.support).allowed, true);
    assert.equal(canSendStructurally(actors.support, actors.student).allowed, true);
    assert.equal(canSendStructurally(actors.support, actors.teacher).allowed, true);
    assert.equal(canSendStructurally(actors.support, actors.supportB).allowed, true);
    assert.equal(canSendStructurally(actors.staff, actors.support).allowed, true);
    assert.equal(canSendStructurally(actors.support, actors.staff).allowed, true);
    assert.equal(canSendStructurally(actors.staff, actors.student).allowed, true);
    assert.equal(canSendStructurally(actors.high, actors.student).allowed, false);
    assert.equal(canSendStructurally(actors.super, actors.staff).allowed, true);
  });

  it('canStartConversation requires discover+structural for directory starts', async () => {
    const fromDirectory = await canStartConversation(
      actors.student,
      actors.support,
      { sameBranch: true },
    );
    assert.equal(fromDirectory.allowed, true);

    const elevatedHidden = await canStartConversation(
      actors.student,
      actors.super,
      {},
    );
    assert.equal(elevatedHidden.allowed, false);
    // C1 freeze: discover deny, structural send still allow
    assert.equal(canDiscoverContacts(actors.student, actors.super).allowed, false);
    assert.equal(canSendStructurally(actors.student, actors.super).allowed, true);
  });

  it('conversation view/read — participant vs STAFF on admin_admin', () => {
    const legacy = buildConversationId('admin', 'admin', 'student', IDS.studentA);
    assert.equal(canViewConversation(actors.super, legacy).allowed, true);
    assert.equal(canViewConversation(actors.high, legacy).allowed, true);
    assert.equal(canViewConversation(actors.staff, legacy).allowed, false);
    assert.equal(canViewConversation(actors.support, legacy).allowed, false);
    assert.equal(canMarkRead(actors.staff, legacy).allowed, false);
    assert.equal(canReceiveMessage(actors.support, legacy).allowed, false);

    const supportThread = buildConversationId('staff', IDS.supportA, 'student', IDS.studentA);
    assert.equal(canViewConversation(actors.support, supportThread).allowed, true);
    assert.equal(canViewConversation(actors.supportB, supportThread).allowed, false);
    assert.equal(canReceiveNotification(actors.support, supportThread).allowed, true);
    assert.equal(canReceiveNotification(actors.supportB, supportThread).allowed, false);
  });

  it('wiring: DMS uses assertCanDirectMessage; socket uses MessagingPolicy', () => {
    const dms = fs.readFileSync(path.join(ROOT, 'services/directMessageService.js'), 'utf8');
    const chat = fs.readFileSync(path.join(ROOT, 'services/chatAccessService.js'), 'utf8');
    const policy = fs.readFileSync(path.join(ROOT, 'services/messagingPolicy.js'), 'utf8');
    const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');

    assert.ok(dms.includes('assertCanDirectMessage'));
    assert.ok(dms.includes("require('./chatAccessService')"));
    assert.ok(chat.includes("require('./messagingPolicy')"));
    assert.ok(policy.includes('canDiscoverContacts'));
    assert.ok(policy.includes('canSendMessage'));
    assert.ok(server.includes("require('./services/messagingPolicy')"));
    assert.ok(server.includes('canMarkRead'));
    assert.ok(server.includes('canViewConversation'));
    assert.ok(server.includes('sendCanonicalMessage'));
  });

  it('fail closed on unknown product role', () => {
    const weird = { id: IDS.studentA, role: 'ghost' };
    assert.equal(canDiscoverContacts(weird, actors.support).allowed, false);
    assert.equal(canSendStructurally(weird, actors.support).code, 'MESSAGING_UNKNOWN_PRODUCT_ROLE');
  });
});
