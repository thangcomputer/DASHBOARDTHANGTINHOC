/**
 * Unit tests — RBAC-S2 Data Scope helpers (observe contract).
 * Does not mount LIVE deny.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  DATA_SCOPES,
  resolveDataScope,
  assertInScope,
} = require('../../shared/security/authorization/dataScope');

describe('RBAC-S2 dataScope', () => {
  it('resolves 6 role scopes', () => {
    assert.equal(resolveDataScope({ id: 'admin' }), DATA_SCOPES.ALL);
    assert.equal(resolveDataScope({ adminRole: 'SUPER_ADMIN' }), DATA_SCOPES.ALL);
    assert.equal(resolveDataScope({ adminRole: 'HIGH_ADMIN' }), DATA_SCOPES.ALL_OPERATIONAL);
    assert.equal(resolveDataScope({ adminRole: 'STAFF' }), DATA_SCOPES.BRANCH_ASSIGNED);
    assert.equal(resolveDataScope({ role: 'staff' }), DATA_SCOPES.BRANCH_ASSIGNED);
    assert.equal(resolveDataScope({ adminRole: 'SUPPORT' }), DATA_SCOPES.SUPPORT_RELATED);
    assert.equal(resolveDataScope({ role: 'teacher' }), DATA_SCOPES.OWN_AND_ASSIGNED_CLASS);
    assert.equal(resolveDataScope({ role: 'student' }), DATA_SCOPES.OWN_AND_AUTHORIZED);
    assert.equal(resolveDataScope({ role: 'admin' }), DATA_SCOPES.NONE);
  });

  it('SUPPORT cannot treat course/class as staff ops', () => {
    const actor = { id: 's1', adminRole: 'SUPPORT' };
    assert.equal(assertInScope(actor, 'ticket', null, { listMode: true }).inScope, true);
    assert.equal(assertInScope(actor, 'course', { id: 'c1' }).inScope, false);
    assert.equal(assertInScope(actor, 'class', { id: 'c1' }).reason, 'support_not_staff_ops');
  });

  it('STAFF branch mismatch is out of scope', () => {
    const actor = { id: 'st1', adminRole: 'STAFF', branchCode: 'HN' };
    const ok = assertInScope(actor, 'student', { branchCode: 'HN' });
    const bad = assertInScope(actor, 'student', { branchCode: 'HCM' });
    assert.equal(ok.inScope, true);
    assert.equal(bad.inScope, false);
    assert.equal(bad.reason, 'branch_mismatch');
  });

  it('TEACHER only assigned students', () => {
    const actor = { id: 't1', role: 'teacher' };
    const mine = assertInScope(actor, 'student', { teacherId: 't1' });
    const other = assertInScope(actor, 'student', { teacherId: 't2' });
    assert.equal(mine.inScope, true);
    assert.equal(other.inScope, false);
  });

  it('STUDENT only own records', () => {
    const actor = { id: 'stu1', role: 'student' };
    assert.equal(assertInScope(actor, 'student', { id: 'stu1' }).inScope, true);
    assert.equal(assertInScope(actor, 'student', { id: 'stu2' }).inScope, false);
    assert.equal(assertInScope(actor, 'result', { studentId: 'stu1' }).inScope, true);
    assert.equal(assertInScope(actor, 'result', { studentId: 'stu2' }).inScope, false);
  });
});
