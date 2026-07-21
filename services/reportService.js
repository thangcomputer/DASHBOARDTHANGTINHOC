/**
 * Report builder — dinh nghia bao cao tu nguon he thong / form submissions.
 */
const ReportDefinition = require('../models/ReportDefinition');
const FormDefinition = require('../models/FormDefinition');
const FormSubmission = require('../models/FormSubmission');
const Student = require('../models/Student');
const Teacher = require('../models/Teacher');
const Schedule = require('../models/Schedule');
const Transaction = require('../models/Transaction');

const SOURCES = {
  students: {
    label: 'Hoc vien',
    columns: ['_id', 'name', 'phone', 'course', 'paid', 'price', 'status', 'branchCode', 'createdAt'],
    model: Student,
  },
  teachers: {
    label: 'Giang vien',
    columns: ['_id', 'name', 'phone', 'status', 'testScore', 'branchCode', 'createdAt'],
    model: Teacher,
    defaultFilter: { role: 'teacher' },
  },
  schedules: {
    label: 'Lich day',
    columns: ['_id', 'teacherName', 'studentName', 'course', 'date', 'startTime', 'status', 'branchCode'],
    model: Schedule,
  },
  transactions: {
    label: 'Giao dich',
    columns: ['_id', 'teacherName', 'amount', 'status', 'month', 'createdAt'],
    model: Transaction,
  },
};

function listSources() {
  return Object.entries(SOURCES).map(([key, s]) => ({
    key,
    label: s.label,
    columns: s.columns,
  })).concat([{ key: 'form', label: 'Form submissions (can formId)', columns: [] }]);
}

async function createReport({ name, description, source, columns, filters, createdBy }) {
  if (!name?.trim()) {
    const err = new Error('Thieu ten bao cao');
    err.status = 400;
    throw err;
  }
  if (!source) {
    const err = new Error('Thieu source');
    err.status = 400;
    throw err;
  }
  return ReportDefinition.create({
    name: name.trim().slice(0, 120),
    description: String(description || '').slice(0, 500),
    source: String(source),
    columns: Array.isArray(columns) ? columns.map(String) : [],
    filters: filters || {},
    createdBy: String(createdBy || ''),
  });
}

async function updateReport(id, patch) {
  const report = await ReportDefinition.findById(id);
  if (!report) {
    const err = new Error('Khong tim thay bao cao');
    err.status = 404;
    throw err;
  }
  if (patch.name != null) report.name = String(patch.name).trim().slice(0, 120);
  if (patch.description != null) report.description = String(patch.description).slice(0, 500);
  if (patch.source != null) report.source = String(patch.source);
  if (patch.columns != null) report.columns = Array.isArray(patch.columns) ? patch.columns.map(String) : [];
  if (patch.filters != null) report.filters = patch.filters;
  await report.save();
  return report;
}

async function listReports({ page = 1, limit = 30 } = {}) {
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 30));
  const skip = (pageNum - 1) * limitNum;
  const [data, total] = await Promise.all([
    ReportDefinition.find().sort({ updatedAt: -1 }).skip(skip).limit(limitNum).lean(),
    ReportDefinition.countDocuments(),
  ]);
  return {
    data,
    pagination: { page: pageNum, limit: limitNum, total, pages: Math.max(1, Math.ceil(total / limitNum)) },
  };
}

async function deleteReport(id) {
  const r = await ReportDefinition.findByIdAndDelete(id);
  if (!r) {
    const err = new Error('Khong tim thay bao cao');
    err.status = 404;
    throw err;
  }
  return { id };
}

async function runReport(id, { limit = 500 } = {}) {
  const report = await ReportDefinition.findById(id).lean();
  if (!report) {
    const err = new Error('Khong tim thay bao cao');
    err.status = 404;
    throw err;
  }
  return executeReport(report, { limit });
}

async function executeReport(report, { limit = 500 } = {}) {
  const lim = Math.min(2000, Math.max(1, Number(limit) || 500));
  const source = report.source || '';

  if (source.startsWith('form:')) {
    const formId = source.slice(5);
    const form = await FormDefinition.findById(formId).lean();
    if (!form) {
      const err = new Error('Form khong ton tai');
      err.status = 404;
      throw err;
    }
    const subs = await FormSubmission.find({ formId }).sort({ createdAt: -1 }).limit(lim).lean();
    const fieldKeys = (form.fields || []).map((f) => f.key);
    const columns = report.columns?.length
      ? report.columns
      : ['createdAt', 'submittedBy', ...fieldKeys];
    const rows = subs.map((s) => {
      const row = {};
      for (const col of columns) {
        if (col === 'createdAt') row[col] = s.createdAt;
        else if (col === 'submittedBy') row[col] = s.submittedBy;
        else row[col] = s.answers?.[col];
      }
      return row;
    });
    return { report, columns, rows, total: rows.length };
  }

  const src = SOURCES[source];
  if (!src) {
    const err = new Error('Source khong hop le');
    err.status = 400;
    throw err;
  }
  const columns = (report.columns?.length ? report.columns : src.columns)
    .filter((c) => src.columns.includes(c));
  const filter = { ...(src.defaultFilter || {}), ...(report.filters || {}) };
  // chi cho phep filter don gian: paid, status
  const safeFilter = {};
  if (filter.paid === true || filter.paid === false || filter.paid === 'true' || filter.paid === 'false') {
    safeFilter.paid = filter.paid === true || filter.paid === 'true';
  }
  if (filter.status) safeFilter.status = String(filter.status);

  const docs = await src.model.find(safeFilter).sort({ createdAt: -1 }).limit(lim).lean();
  const rows = docs.map((d) => {
    const row = {};
    for (const col of columns) {
      let v = d[col];
      if (v instanceof Date) v = v.toISOString();
      if (v && typeof v === 'object') v = String(v._id || v);
      row[col] = v;
    }
    return row;
  });
  return { report, columns, rows, total: rows.length };
}

function rowsToCsv(columns, rows) {
  const lines = [columns.join(',')];
  for (const row of rows) {
    lines.push(columns.map((c) => {
      const str = row[c] == null ? '' : String(row[c]).replace(/"/g, '""');
      return '"' + str + '"';
    }).join(','));
  }
  return lines.join('\n');
}

module.exports = {
  SOURCES,
  listSources,
  createReport,
  updateReport,
  listReports,
  deleteReport,
  runReport,
  executeReport,
  rowsToCsv,
};