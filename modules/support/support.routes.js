const express = require('express');
const router = express.Router();
const supportController = require('../controllers/SupportController');
const supportController = require('./support.controller');
const { requireAuth, requireRole, requirePermission } = require('../../shared/middleware/authMiddleware');
const { UserRole, PermissionCode } = require('../../shared/enums');

// All routes require auth
router.use(requireAuth);

// GET /api/v2/support/agents
// Requires ADMIN_STAFF or HIGH_ADMIN or SUPER_ADMIN
router.get('/agents', requireRole(UserRole.SUPER_ADMIN, UserRole.HIGH_ADMIN, UserRole.ADMIN_STAFF), supportController.getAgents);

// GET /api/v2/support/teams
router.get('/teams', requireRole(UserRole.SUPER_ADMIN, UserRole.HIGH_ADMIN, UserRole.ADMIN_STAFF), supportController.getTeams);

// GET /api/v2/support/conversations
// Support agents can get their own, Admins can get all
router.get('/conversations', supportController.getConversations);

// GET /api/v2/support/messages
router.get('/messages', supportController.getMessages);

// POST /api/v2/support/assignments
// Requires specific permission
router.post('/assignments', requirePermission(PermissionCode.SUPPORT_ASSIGN), supportController.createAssignment);

// PUT /api/v2/support/presence
// For Support Agent to update their own presence
router.put('/presence', requireRole(UserRole.SUPPORT_AGENT), supportController.updatePresence);

module.exports = router;
