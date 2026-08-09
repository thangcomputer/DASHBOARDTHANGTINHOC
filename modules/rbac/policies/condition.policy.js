const conditionPolicy = {
  /**
   * Evaluate dynamic environment/status condition rules.
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

    // Block access if user status is explicitly blocked or inactive
    if (subject.isBlocked === true || subject.status === 'inactive') {
      return { allowed: false, reason: 'Access denied: Subject status is blocked or inactive' };
    }

    // Dynamic verification check
    if (context.requiresVerification === true && subject.isVerified === false) {
      return { allowed: false, reason: 'Access denied: Subject is not verified' };
    }

    return { allowed: true, reason: 'Condition evaluation success' };
  }
};

module.exports = conditionPolicy;
