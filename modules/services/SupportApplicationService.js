'use strict';
const supportController = require('./../support/support.controller');
const { UserRole, PermissionCode } = require('./../../shared/enums');

// All routes require auth
router.use(requireAuth);
// GET /api/v2/support/agents
// Requires ADMIN_STAFF or HIGH_ADMIN or SUPER_ADMIN

class SupportApplicationService {
  async get_agents(data) {}

  async get_teams(data) {}

  async get_conversations(data) {}

  async get_messages(data) {}

  async post_assignments(data) {}

  async put_presence(data) {}

}

module.exports = new SupportApplicationService();
