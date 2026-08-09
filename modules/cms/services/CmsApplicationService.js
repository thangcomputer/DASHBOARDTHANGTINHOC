'use strict';
const formService = require('./formService');
const reportService = require('./../../report/services/reportService');
const logger = require('./../../../config/logger');

const adminGuard = [authMiddleware, authorize(NEW_PERMISSIONS.CMS_PUBLISH)];
// ── Forms ────────────────────────────────────────────────────────────────────

class CmsApplicationService {
  async get_forms(data) {
  try {
    const result = await formService.listForms({ status: data.status });
    return { _status: 200, _body: ({ success: true, ...result });
  } catch (err) {
    return { _status: 500, _body: ({ success: false, message: err.message });
  }
}

  async get_forms_idOrSlug(data) {
  try {
    // public neu published; admin xem moi trang thai
    let form;
    try {
      form = await formService.getForm(data.idOrSlug, { publishedOnly: true });
    } catch (e) {
      if (e.status !== 404) throw e;
      // thu admin
      const token = data.headers.authorization;
      if (!token) throw e;
      return authMiddleware(req, res, async () => {
        if (data.currentUser?.role !== 'admin' && data.currentUser?.role !== 'staff' && data.currentUser?.id !== 'admin') {
          return { _status: 404, _body: ({ success: false, message: 'Khong tim thay form' });
        }
        try {
          const f = await formService.getForm(data.idOrSlug);
          return { _status: 200, _body: ({ success: true, data: f });
        } catch (err2) {
          return res.status(err2.status || 500).json({ success: false, message: err2.message });
        }
      });
    }
    return { _status: 200, _body: ({ success: true, data: form });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

  async post_forms(data) {
  try {
    const form = await formService.createForm({ ...data.body, createdBy: data.currentUser.id });
    return { _status: 201, _body: ({ success: true, data: form });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

  async put_forms_id(data) {
  try {
    const form = await formService.updateForm(data.id, data.body || {});
    return { _status: 200, _body: ({ success: true, data: form });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

  async delete_forms_id(data) {
  try {
    const data = await formService.deleteForm(data.id);
    return { _status: 200, _body: ({ success: true, data });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

  async post_forms_idOrSlug_submit(data) {
  try {
    const user = data.currentUser; // co the khong co
    const sub = await formService.submitForm(data.idOrSlug, {
      answers: data.body?.answers || data.body,
      submittedBy: user?.id || data.body?.submittedBy || '',
      submittedByRole: user?.role || 'guest',
      meta: { ip: data.ip },
    });
    return { _status: 201, _body: ({ success: true, data: { id: sub._id } });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

  async post_forms_idOrSlug_submit_auth(data) {
  try {
    const sub = await formService.submitForm(data.idOrSlug, {
      answers: data.body?.answers || data.body,
      submittedBy: String(data.currentUser.id || ''),
      submittedByRole: data.currentUser.role || '',
      meta: { ip: data.ip },
    });
    return { _status: 201, _body: ({ success: true, data: { id: sub._id } });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

  async get_forms_id_submissions(data) {
  try {
    const form = await formService.getForm(data.id);
    const result = await formService.listSubmissions(form._id, {
      page: data.page,
      limit: data.limit,
    });
    return { _status: 200, _body: ({ success: true, form: { _id: form._id, name: form.name, fields: form.fields }, ...result });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

  async get_forms_id_submissions_export(data) {
  try {
    const form = await formService.getForm(data.id);
    const result = await formService.listSubmissions(form._id, { page: 1, limit: 2000 });
    const csv = formService.submissionsToCsv(form, result.data);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="form-' + form.slug + '.csv"');
    res.send('\uFEFF' + csv);
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

  async get_reports_sources(data) {}

  async get_reports(data) {
  try {
    const result = await reportService.listReports({ page: data.page });
    return { _status: 200, _body: ({ success: true, ...result });
  } catch (err) {
    return { _status: 500, _body: ({ success: false, message: err.message });
  }
}

  async post_reports(data) {
  try {
    const report = await reportService.createReport({ ...data.body, createdBy: data.currentUser.id });
    return { _status: 201, _body: ({ success: true, data: report });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

  async put_reports_id(data) {
  try {
    const report = await reportService.updateReport(data.id, data.body || {});
    return { _status: 200, _body: ({ success: true, data: report });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

  async delete_reports_id(data) {
  try {
    const data = await reportService.deleteReport(data.id);
    return { _status: 200, _body: ({ success: true, data });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

  async get_reports_id_run(data) {
  try {
    const data = await reportService.runReport(data.id, { limit: data.limit });
    return { _status: 200, _body: ({ success: true, data });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

  async get_reports_id_export(data) {
  try {
    const data = await reportService.runReport(data.id, { limit: data.limit || 2000 });
    const csv = reportService.rowsToCsv(data.columns, data.rows);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="report-' + (data.report.name || 'export') + '.csv"');
    res.send('\uFEFF' + csv);
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

  async get_definitions(data) {}

  async get_root(data) {
  try {
    if (data.sync === '1' || data.sync === 'true') {
      await workflowService.syncFromDomain();
    }
    const result = await workflowService.listInstances({
      status: data.status || 'open',
      definitionKey: data.definitionKey,
      page: data.page,
      limit: data.limit,
    });
    return { _status: 200, _body: ({ success: true, ...result });
  } catch (err) {
    logger.error('[Workflow] list:', err);
    return { _status: 500, _body: ({ success: false, message: err.message });
  }
}

  async post_sync(data) {
  try {
    const data = await workflowService.syncFromDomain();
    return { _status: 200, _body: ({ success: true, message: 'Da dong bo ' + data.created + ' workflow', data });
  } catch (err) {
    return { _status: 500, _body: ({ success: false, message: err.message });
  }
}

  async get_id(data) {
  try {
    const data = await workflowService.getInstance(data.id);
    return { _status: 200, _body: ({ success: true, data });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

  async post_root(data) {
  try {
    const { definitionKey, entityId, entityLabel, title, payload } = data.body || {};
    const instance = await workflowService.start({
      definitionKey,
      entityId,
      entityLabel,
      title,
      payload,
      createdBy: String(data.currentUser.id || ''),
    });
    return { _status: 201, _body: ({ success: true, data: instance });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

  async post_id_advance(data) {
  try {
    const { action, note } = data.body || {};
    if (!action) {
      return { _status: 400, _body: ({ success: false, message: 'Thieu action' });
    }
    const io = data.app.get('io');
    const instance = await workflowService.advance(
      data.id,
      { action, note },
      data.currentUser,
      io,
    );
    return { _status: 200, _body: ({ success: true, message: 'Da cap nhat workflow', data: instance });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

}

module.exports = new CmsApplicationService();
