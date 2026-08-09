const express = require('express');
const router = express.Router();
const cmsController = require('../controllers/CmsController');
const { authMiddleware } = require('../../../shared/middleware/authMiddleware');
const { authorize } = require('../../../shared/middleware/authorize');
const NEW_PERMISSIONS = require('../../../shared/constants/permissions');
const formService = require('../services/formService');
const reportService = require('../../report/services/reportService');
const logger = require('../../../config/logger');

const adminGuard = [authMiddleware, authorize(NEW_PERMISSIONS.CMS_PUBLISH)];

// ── Forms ────────────────────────────────────────────────────────────────────
router.get('/forms', adminGuard,cmsController.get_forms);

router.get('/forms/:idOrSlug',cmsController.get_forms_idOrSlug);

router.post('/forms', adminGuard,cmsController.post_forms);

router.put('/forms/:id', adminGuard,cmsController.put_forms_id);

router.delete('/forms/:id', adminGuard,cmsController.delete_forms_id);

// Public submit (published forms)
router.post('/forms/:idOrSlug/submit',cmsController.post_forms_idOrSlug_submit);

// Optional auth for submit identity
router.post('/forms/:idOrSlug/submit-auth', authMiddleware,cmsController.post_forms_idOrSlug_submit_auth);

router.get('/forms/:id/submissions', adminGuard,cmsController.get_forms_id_submissions);

router.get('/forms/:id/submissions/export', adminGuard,cmsController.get_forms_id_submissions_export);

// ── Reports ──────────────────────────────────────────────────────────────────
router.get('/reports/sources', adminGuard, (req, res) => {
  res.json({ success: true, data: reportService.listSources() });
});

router.get('/reports', adminGuard,cmsController.get_reports);

router.post('/reports', adminGuard,cmsController.post_reports);

router.put('/reports/:id', adminGuard,cmsController.put_reports_id);

router.delete('/reports/:id', adminGuard,cmsController.delete_reports_id);

router.get('/reports/:id/run', adminGuard,cmsController.get_reports_id_run);

router.get('/reports/:id/export', adminGuard,cmsController.get_reports_id_export);

module.exports = router;