const PolicyService = require('../../../modules/rbac/policy.service');

const SUPER_ADMIN = { roleCode: 'SUPER_ADMIN', tenantId: 'T1', assignedBranches: ['B1'] };
// STAFF has an explicit id so ownership checks work correctly
const STAFF = { id: 'staff-1', tenantId: 'T1', assignedBranches: ['B1'], isBlocked: false };

describe('PolicyService Orchestrator', () => {
  test('All policies allow — returns allowed: true', () => {
    // Resource has userId matching STAFF.id → ownership passes
    const result = PolicyService.evaluate(
      STAFF,
      { tenantId: 'T1', branchId: 'B1', userId: STAFF.id },
      {}
    );
    expect(result.allowed).toBe(true);
    expect(result.reason).toBe('All policies passed');
    expect(result.failedPolicy).toBeUndefined();
  });

  test('Null subject — returns denied with PreCheck failure', () => {
    const result = PolicyService.evaluate(null, {}, {});
    expect(result.allowed).toBe(false);
    expect(result.failedPolicy).toBe('PreCheck');
  });

  test('Tenant denial stops evaluation at TenantPolicy', () => {
    const result = PolicyService.evaluate(
      { id: 's1', tenantId: 'T1', assignedBranches: ['B1'] },
      { tenantId: 'T2', branchId: 'B1' },
      {}
    );
    expect(result.allowed).toBe(false);
    expect(result.failedPolicy).toBe('TenantPolicy');
    expect(result.reason).toContain('Tenant mismatch');
  });

  test('Branch denial stops evaluation at BranchPolicy', () => {
    const result = PolicyService.evaluate(
      { id: 's1', tenantId: 'T1', assignedBranches: ['B1'] },
      { tenantId: 'T1', branchId: 'B2' },
      {}
    );
    expect(result.allowed).toBe(false);
    expect(result.failedPolicy).toBe('BranchPolicy');
    expect(result.reason).toContain('Branch mismatch');
  });

  test('Ownership denial stops evaluation at OwnershipPolicy', () => {
    const result = PolicyService.evaluate(
      { id: 'user-1', tenantId: 'T1', assignedBranches: ['B1'] },
      { tenantId: 'T1', branchId: 'B1', userId: 'user-2' },
      { requireOwnership: true }
    );
    expect(result.allowed).toBe(false);
    expect(result.failedPolicy).toBe('OwnershipPolicy');
  });

  test('Condition denial stops evaluation at ConditionPolicy', () => {
    // userId matches subject.id so OwnershipPolicy passes; ConditionPolicy denies due to isBlocked
    const subject = { id: 'user-5', isBlocked: true, tenantId: 'T1', assignedBranches: ['B1'] };
    const result = PolicyService.evaluate(
      subject,
      { tenantId: 'T1', branchId: 'B1', userId: 'user-5' },
      {}
    );
    expect(result.allowed).toBe(false);
    expect(result.failedPolicy).toBe('ConditionPolicy');
    expect(result.reason).toContain('blocked');
  });

  test('Null resource — policies handle gracefully and pass', () => {
    const result = PolicyService.evaluate(STAFF, null, {});
    expect(result.allowed).toBe(true);
  });

  test('Missing context — defaults to empty object, policies pass', () => {
    // Resource must match STAFF's id so ownership policy passes
    const result = PolicyService.evaluate(STAFF, { tenantId: 'T1', branchId: 'B1', userId: STAFF.id });
    expect(result.allowed).toBe(true);
  });

  test('Super Admin bypasses all policies', () => {
    const result = PolicyService.evaluate(
      SUPER_ADMIN,
      { tenantId: 'T9', branchId: 'B9', userId: 'other-user' },
      { requiresVerification: true, requireOwnership: true }
    );
    expect(result.allowed).toBe(true);
  });
});
