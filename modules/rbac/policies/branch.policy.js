const branchPolicy = {
  /**
   * Evaluate branch scope isolation rules.
   *
   * @param {Object} subject - The user/actor object
   * @param {Object} resource - The target resource/entity
   * @param {Object} [context] - Context parameters
   * @returns {{allowed: boolean, reason: string}}
   */
  evaluate: (subject, resource, context = {}) => {
    if (!subject) {
      return { allowed: false, reason: 'Subject not provided' };
    }

    // Super Admin bypass
    if (subject.roleCode === 'SUPER_ADMIN' || subject.adminRole === 'SUPER_ADMIN') {
      return { allowed: true, reason: 'Super Admin bypass' };
    }

    const subjectBranches = Array.isArray(subject.assignedBranches)
      ? subject.assignedBranches.map(b => String(b))
      : subject.branchId
        ? [String(subject.branchId)]
        : [];

    const resourceBranch = resource ? (resource.branchId || resource.branch) : context.resourceBranchId;

    if (!resourceBranch) {
      return { allowed: true, reason: 'Resource has no branch scope, bypassing check' };
    }

    if (subjectBranches.includes(String(resourceBranch))) {
      return { allowed: true, reason: 'Branch scope validation success' };
    }

    return { allowed: false, reason: 'Branch mismatch: Access denied' };
  }
};

module.exports = branchPolicy;
