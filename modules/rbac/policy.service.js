const tenantPolicy = require('./policies/tenant.policy');
const branchPolicy = require('./policies/branch.policy');
const ownershipPolicy = require('./policies/ownership.policy');
const conditionPolicy = require('./policies/condition.policy');

/**
 * Ordered policy chain.
 * Evaluated sequentially — stops at the first denial (fail-fast).
 */
const POLICY_CHAIN = [
  { name: 'TenantPolicy',    policy: tenantPolicy },
  { name: 'BranchPolicy',   policy: branchPolicy },
  { name: 'OwnershipPolicy', policy: ownershipPolicy },
  { name: 'ConditionPolicy', policy: conditionPolicy },
];

const PolicyService = {
  /**
   * Orchestrate all policy checks.
   *
   * @param {Object} subject  - Authenticated user/actor
   * @param {Object} resource - Target resource being accessed (may be null)
   * @param {Object} [context] - Optional contextual metadata
   * @returns {{ allowed: boolean, reason: string, failedPolicy?: string, metadata?: object }}
   */
  evaluate: (subject, resource, context = {}) => {
    if (!subject) {
      return {
        allowed: false,
        reason: 'Subject not provided',
        failedPolicy: 'PreCheck',
      };
    }

    for (const { name, policy } of POLICY_CHAIN) {
      const result = policy.evaluate(subject, resource, context);
      if (!result.allowed) {
        return {
          allowed: false,
          reason: result.reason,
          failedPolicy: name,
          metadata: result.metadata || {},
        };
      }
    }

    return {
      allowed: true,
      reason: 'All policies passed',
    };
  }
};

module.exports = PolicyService;
