const tenantPolicy = require('../../../modules/rbac/policies/tenant.policy');
const branchPolicy = require('../../../modules/rbac/policies/branch.policy');
const ownershipPolicy = require('../../../modules/rbac/policies/ownership.policy');
const conditionPolicy = require('../../../modules/rbac/policies/condition.policy');

describe('RBAC Modular Policies Unit Tests', () => {
  describe('Tenant Policy', () => {
    test('Super Admin bypasses tenant mismatch check', () => {
      const res = tenantPolicy.evaluate(
        { roleCode: 'SUPER_ADMIN', tenantId: 'tenant-1' },
        { tenantId: 'tenant-2' }
      );
      expect(res.allowed).toBe(true);
      expect(res.reason).toContain('Super Admin bypass');
    });

    test('Identical tenantIds pass check', () => {
      const res = tenantPolicy.evaluate(
        { tenantId: 'tenant-A' },
        { tenantId: 'tenant-A' }
      );
      expect(res.allowed).toBe(true);
      expect(res.reason).toContain('Tenant match success');
    });

    test('Different tenantIds fail check', () => {
      const res = tenantPolicy.evaluate(
        { tenantId: 'tenant-A' },
        { tenantId: 'tenant-B' }
      );
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('Tenant mismatch');
    });
  });

  describe('Branch Policy', () => {
    test('Super Admin bypasses branch check', () => {
      const res = branchPolicy.evaluate(
        { roleCode: 'SUPER_ADMIN', assignedBranches: ['br-1'] },
        { branchId: 'br-2' }
      );
      expect(res.allowed).toBe(true);
    });

    test('User with matching assigned branch passes check', () => {
      const res = branchPolicy.evaluate(
        { assignedBranches: ['br-1', 'br-2'] },
        { branchId: 'br-2' }
      );
      expect(res.allowed).toBe(true);
    });

    test('User without matching assigned branch fails check', () => {
      const res = branchPolicy.evaluate(
        { assignedBranches: ['br-1'] },
        { branchId: 'br-2' }
      );
      expect(res.allowed).toBe(false);
    });
  });

  describe('Ownership Policy', () => {
    test('Matches ownership fields (e.g. userId)', () => {
      const res = ownershipPolicy.evaluate(
        { id: 'user-123' },
        { userId: 'user-123' }
      );
      expect(res.allowed).toBe(true);
    });

    test('Allows edit on self profile', () => {
      const res = ownershipPolicy.evaluate(
        { id: 'user-123' },
        { id: 'user-123' },
        { entityType: 'self' }
      );
      expect(res.allowed).toBe(true);
    });

    test('Fails on non-matching ID values', () => {
      const res = ownershipPolicy.evaluate(
        { id: 'user-123' },
        { userId: 'user-999' }
      );
      expect(res.allowed).toBe(false);
    });
  });

  describe('Condition Policy', () => {
    test('Denies blocked users', () => {
      const res = conditionPolicy.evaluate({ isBlocked: true });
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('blocked');
    });

    test('Denies unverified users if verification is required in context', () => {
      const res = conditionPolicy.evaluate(
        { isVerified: false },
        null,
        { requiresVerification: true }
      );
      expect(res.allowed).toBe(false);
    });

    test('Passes for active, verified users', () => {
      const res = conditionPolicy.evaluate(
        { isBlocked: false, isVerified: true },
        null,
        { requiresVerification: true }
      );
      expect(res.allowed).toBe(true);
    });
  });
});
