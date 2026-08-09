const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { policyShadowBuilder } = require('../middleware/policyShadowBuilder');
const { builderCutoverGate } = require('../middleware/builderCutoverGate');
const formService = require('../services/formService');
const reportService = require('../services/reportService');

/**
 * Phase 7.10 — Controlled cutover for /api/builder ONLY.
 *
 * Admin routes:
 *   auth → policyShadowBuilder → builderCutoverGate → (Legacy isAdmin when not Policy) → handler
 *
 * Public form_get / form_submit:
 *   policyShadowBuilder → builderCutoverGate → handler
 *   (no authMiddleware; draft hide remains 404; soft JWT stays in shadow only)
 *
 * form_submit_auth:
 *   auth → policyShadowBuilder → builderCutoverGate → handler
 *
 * Handlers retain create/update/delete/submit/run. Mass-assignment behavior unchanged.
 */
const adminGuard = (action) => [
  authMiddleware,
  policyShadowBuilder(action),
  builderCutoverGate(action),
];

// ── Forms ────────────────────────────────────────────────────────────────────
router.get('/forms', adminGuard('form_list'), async (req, res) => {
  try {
    const result = await formService.listForms({ status: req.query.status });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/forms/:idOrSlug', policyShadowBuilder('form_get'), builderCutoverGate('form_get'), async (req, res) => {
  try {
    // public neu published; admin xem moi trang thai
    let form;
    try {
      form = await formService.getForm(req.params.idOrSlug, { publishedOnly: true });
    } catch (e) {
      if (e.status !== 404) throw e;
      // thu admin
      const token = req.headers.authorization;
      if (!token) throw e;
      return authMiddleware(req, res, async () => {
        if (req.user?.role !== 'admin' && req.user?.role !== 'staff' && req.user?.id !== 'admin') {
          return res.status(404).json({ success: false, message: 'Khong tim thay form' });
        }
        try {
          const f = await formService.getForm(req.params.idOrSlug);
          return res.json({ success: true, data: f });
        } catch (err2) {
          return res.status(err2.status || 500).json({ success: false, message: err2.message });
        }
      });
    }
    res.json({ success: true, data: form });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

router.post('/forms', adminGuard('form_create'), async (req, res) => {
  try {
    const form = await formService.createForm({ ...req.body, createdBy: req.user.id });
    res.status(201).json({ success: true, data: form });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

router.put('/forms/:id', adminGuard('form_update'), async (req, res) => {
  try {
    const form = await formService.updateForm(req.params.id, req.body || {});
    res.json({ success: true, data: form });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

router.delete('/forms/:id', adminGuard('form_delete'), async (req, res) => {
  try {
    const data = await formService.deleteForm(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

// Public submit (published forms)
router.post('/forms/:idOrSlug/submit', policyShadowBuilder('form_submit'), builderCutoverGate('form_submit'), async (req, res) => {
  try {
    const user = req.user; // co the khong co
    const sub = await formService.submitForm(req.params.idOrSlug, {
      answers: req.body?.answers || req.body,
      submittedBy: user?.id || req.body?.submittedBy || '',
      submittedByRole: user?.role || 'guest',
      meta: { ip: req.ip },
    });
    res.status(201).json({ success: true, data: { id: sub._id } });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

// Optional auth for submit identity
router.post('/forms/:idOrSlug/submit-auth', authMiddleware, policyShadowBuilder('form_submit_auth'), builderCutoverGate('form_submit_auth'), async (req, res) => {
  try {
    const sub = await formService.submitForm(req.params.idOrSlug, {
      answers: req.body?.answers || req.body,
      submittedBy: String(req.user.id || ''),
      submittedByRole: req.user.role || '',
      meta: { ip: req.ip },
    });
    res.status(201).json({ success: true, data: { id: sub._id } });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

router.get('/forms/:id/submissions', adminGuard('form_submissions'), async (req, res) => {
  try {
    const form = await formService.getForm(req.params.id);
    const result = await formService.listSubmissions(form._id, {
      page: req.query.page,
      limit: req.query.limit,
    });
    res.json({ success: true, form: { _id: form._id, name: form.name, fields: form.fields }, ...result });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

router.get('/forms/:id/submissions/export', adminGuard('form_submissions_export'), async (req, res) => {
  try {
    const form = await formService.getForm(req.params.id);
    const result = await formService.listSubmissions(form._id, { page: 1, limit: 2000 });
    const csv = formService.submissionsToCsv(form, result.data);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="form-' + form.slug + '.csv"');
    res.send('\uFEFF' + csv);
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

// ── Reports ──────────────────────────────────────────────────────────────────
router.get('/reports/sources', adminGuard('report_sources'), (req, res) => {
  res.json({ success: true, data: reportService.listSources() });
});

router.get('/reports', adminGuard('report_list'), async (req, res) => {
  try {
    const result = await reportService.listReports({ page: req.query.page });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/reports', adminGuard('report_create'), async (req, res) => {
  try {
    const report = await reportService.createReport({ ...req.body, createdBy: req.user.id });
    res.status(201).json({ success: true, data: report });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

router.put('/reports/:id', adminGuard('report_update'), async (req, res) => {
  try {
    const report = await reportService.updateReport(req.params.id, req.body || {});
    res.json({ success: true, data: report });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

router.delete('/reports/:id', adminGuard('report_delete'), async (req, res) => {
  try {
    const data = await reportService.deleteReport(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

router.get('/reports/:id/run', adminGuard('report_run'), async (req, res) => {
  try {
    const data = await reportService.runReport(req.params.id, { limit: req.query.limit });
    res.json({ success: true, data });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

router.get('/reports/:id/export', adminGuard('report_export'), async (req, res) => {
  try {
    const data = await reportService.runReport(req.params.id, { limit: req.query.limit || 2000 });
    const csv = reportService.rowsToCsv(data.columns, data.rows);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="report-' + (data.report.name || 'export') + '.csv"');
    res.send('\uFEFF' + csv);
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

module.exports = router;
