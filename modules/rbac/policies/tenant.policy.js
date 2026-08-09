const tenantPolicy = {
  /**
   * Evaluate multi-tenant scope isolation between subject and resource.
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

    const subjectTenant = subject.tenantId || context.tenantId;
    const resourceTenant = resource ? (resource.tenantId || resource.tenant) : context.resourceTenantId;

    if (!subjectTenant || !resourceTenant) {
      return { allowed: true, reason: 'Tenancy context not present, bypassing check' };
    }

    if (String(subjectTenant) === String(resourceTenant)) {
      return { allowed: true, reason: 'Tenant match success' };
    }

    return { allowed: false, reason: 'Tenant mismatch: Access denied' };
  }
};

module.exports = tenantPolicy;
