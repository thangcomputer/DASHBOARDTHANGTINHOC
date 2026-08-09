const ownershipPolicy = {
  /**
   * Evaluate resource ownership rules (e.g. users editing their own profile/submissions).
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

    if (!resource) {
      return { allowed: true, reason: 'No resource provided for ownership evaluation, bypassing check' };
    }

    const subjectId = String(subject.id || subject._id);

    // Common ownership fields
    const ownerFields = ['userId', 'studentId', 'teacherId', 'createdBy', 'ownerId', 'id', '_id'];

    const isOwner = ownerFields.some(field => {
      const val = resource[field];
      if (!val) return false;
      // If matches 'id' or '_id', it represents profile ownership check (e.g. self profile edit)
      if ((field === 'id' || field === '_id') && context.entityType !== 'self') {
        return false;
      }
      return String(val) === subjectId;
    });

    if (isOwner) {
      return { allowed: true, reason: 'Resource ownership verified' };
    }

    return { allowed: false, reason: 'Ownership verification failed: Subject does not own the resource' };
  }
};

module.exports = ownershipPolicy;
