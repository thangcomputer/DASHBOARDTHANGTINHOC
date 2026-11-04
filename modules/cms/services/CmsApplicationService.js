'use strict';
const formService = require('./formService');
const reportService = require('./../../report/services/reportService');
const workflowService = require('./workflowService');
const logger = require('./../../../config/logger');

function errorResult(err) {
  return {
    _status: err.status || 500,
    _body: { success: false, message: err.message || 'Lỗi server' },
  };
}

// ── Forms ────────────────────────────────────────────────────────────────────

class CmsApplicationService {
  async get_forms(data) {
  try {
    const result = await formService.listForms({ status: data.status });
    return { _status: 200, _body: { success: true, ...result } };
  } catch (err) {
    return { _status: 500, _body: { success: false, message: err.message } };
  }
}

  async get_forms_idOrSlug(data) {
  try {
    const form = await formService.getForm(data.idOrSlug, { publishedOnly: true });
    return { _status: 200, _body: { success: true, data: form } };
  } catch (err) {
    return errorResult(err);
  }
}

  async post_forms(data) {
  try {
    const form = await formService.createForm({ ...data.body, createdBy: data.currentUser.id });
    return { _status: 201, _body: { success: true, data: form } };
  } catch (err) {
    return errorResult(err);
  }
}

  async put_forms_id(data) {
  try {
    const form = await formService.updateForm(data.id, data.body || {});
    return { _status: 200, _body: { success: true, data: form } };
  } catch (err) {
    return errorResult(err);
  }
}

  async delete_forms_id(data) {
  try {
    const data = await formService.deleteForm(data.id);
    return { _status: 200, _body: { success: true, data } };
  } catch (err) {
    return errorResult(err);
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
    return { _status: 201, _body: { success: true, data: { id: sub._id } } };
  } catch (err) {
    return errorResult(err);
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
    return { _status: 201, _body: { success: true, data: { id: sub._id } } };
  } catch (err) {
    return errorResult(err);
  }
}

  async get_forms_id_submissions(data) {
  try {
    const form = await formService.getForm(data.id);
    const result = await formService.listSubmissions(form._id, {
      page: data.page,
      limit: data.limit,
    });
    return { _status: 200, _body: { success: true, form: { _id: form._id, name: form.name, fields: form.fields }, ...result } };
  } catch (err) {
    return errorResult(err);
  }
}

  async get_forms_id_submissions_export(data) {
  try {
    const form = await formService.getForm(data.id);
    const result = await formService.listSubmissions(form._id, { page: 1, limit: 2000 });
    const csv = formService.submissionsToCsv(form, result.data);
    return {
      _isSend: true,
      _status: 200,
      _headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="form-${form.slug}.csv"`,
      },
      _body: '\uFEFF' + csv,
    };
  } catch (err) {
    return errorResult(err);
  }
}

  async get_reports_sources() {
    return { _status: 200, _body: { success: true, data: reportService.listSources() } };
  }

  async get_reports(data) {
  try {
    const result = await reportService.listReports({ page: data.page });
    return { _status: 200, _body: { success: true, ...result } };
  } catch (err) {
    return { _status: 500, _body: { success: false, message: err.message } };
  }
}

  async post_reports(data) {
  try {
    const report = await reportService.createReport({ ...data.body, createdBy: data.currentUser.id });
    return { _status: 201, _body: { success: true, data: report } };
  } catch (err) {
    return errorResult(err);
  }
}

  async put_reports_id(data) {
  try {
    const report = await reportService.updateReport(data.id, data.body || {});
    return { _status: 200, _body: { success: true, data: report } };
  } catch (err) {
    return errorResult(err);
  }
}

  async delete_reports_id(data) {
  try {
    const result = await reportService.deleteReport(data.id);
    return { _status: 200, _body: { success: true, data: result } };
  } catch (err) {
    return errorResult(err);
  }
}

  async get_reports_id_run(data) {
  try {
    const result = await reportService.runReport(data.id, { limit: data.limit });
    return { _status: 200, _body: { success: true, data: result } };
  } catch (err) {
    return errorResult(err);
  }
}

  async get_reports_id_export(data) {
  try {
    const reportResult = await reportService.runReport(data.id, { limit: data.limit || 2000 });
    const csv = reportService.rowsToCsv(reportResult.columns, reportResult.rows);
    const filename = String(reportResult.report.name || 'export').replace(/[\\/"\r\n]/g, '_');
    return {
      _isSend: true,
      _status: 200,
      _headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="report-${filename}.csv"`,
      },
      _body: '\uFEFF' + csv,
    };
  } catch (err) {
    return errorResult(err);
  }
}

  async get_definitions() {
    return { _status: 200, _body: { success: true, data: workflowService.listDefinitions() } };
  }

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
    return { _status: 200, _body: { success: true, ...result } };
  } catch (err) {
    logger.error('[Workflow] list:', err);
    return { _status: 500, _body: { success: false, message: err.message } };
  }
}

  async post_sync(data) {
  try {
    const result = await workflowService.syncFromDomain();
    return { _status: 200, _body: { success: true, message: 'Da dong bo ' + result.created + ' workflow', data: result } };
  } catch (err) {
    return { _status: 500, _body: { success: false, message: err.message } };
  }
}

  async get_id(data) {
  try {
    const result = await workflowService.getInstance(data.id);
    return { _status: 200, _body: { success: true, data: result } };
  } catch (err) {
    return errorResult(err);
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
    return { _status: 201, _body: { success: true, data: instance } };
  } catch (err) {
    return errorResult(err);
  }
}

  async post_id_advance(data) {
  try {
    const { action, note } = data.body || {};
    if (!action) {
      return { _status: 400, _body: { success: false, message: 'Thieu action' } };
    }
    const io = data.app.get('io');
    const instance = await workflowService.advance(
      data.id,
      { action, note },
      data.currentUser,
      io,
    );
    return { _status: 200, _body: { success: true, message: 'Da cap nhat workflow', data: instance } };
  } catch (err) {
    return errorResult(err);
  }
}

}

module.exports = new CmsApplicationService();
