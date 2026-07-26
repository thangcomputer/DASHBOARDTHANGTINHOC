/**
 * Form builder service — CRUD form + submissions.
 */
const FormDefinition = require('../models/FormDefinition');
const FormSubmission = require('../models/FormSubmission');

const FIELD_TYPES = ['text', 'textarea', 'number', 'select', 'checkbox', 'date', 'email', 'phone'];

function slugify(name) {
  return String(name || 'form')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'form';
}

function normalizeFields(fields) {
  if (!Array.isArray(fields)) return [];
  return fields.map((f, i) => {
    const key = String(f.key || f.label || 'field_' + i)
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .slice(0, 40) || 'field_' + i;
    const type = FIELD_TYPES.includes(f.type) ? f.type : 'text';
    return {
      key,
      label: String(f.label || key).slice(0, 120),
      type,
      required: Boolean(f.required),
      options: Array.isArray(f.options) ? f.options.map((o) => String(o).slice(0, 80)) : [],
      placeholder: String(f.placeholder || '').slice(0, 120),
      order: Number.isFinite(f.order) ? f.order : i,
    };
  }).sort((a, b) => a.order - b.order);
}

function validateAnswers(form, answers) {
  const errors = [];
  const clean = {};
  for (const field of form.fields || []) {
    const val = answers?.[field.key];
    const empty = val === undefined || val === null || val === '' || (Array.isArray(val) && !val.length);
    if (field.required && empty) {
      errors.push('Thieu: ' + field.label);
      continue;
    }
    if (empty) continue;
    if (field.type === 'number') {
      const n = Number(val);
      if (!Number.isFinite(n)) errors.push(field.label + ' phai la so');
      else clean[field.key] = n;
    } else if (field.type === 'checkbox') {
      clean[field.key] = Boolean(val);
    } else if (field.type === 'select') {
      const s = String(val);
      if (field.options.length && !field.options.includes(s)) {
        errors.push(field.label + ' khong hop le');
      } else clean[field.key] = s;
    } else {
      clean[field.key] = String(val).slice(0, 2000);
    }
  }
  return { errors, answers: clean };
}

async function uniqueSlug(base, excludeId) {
  let slug = slugify(base);
  let i = 0;
  while (true) {
    const candidate = i === 0 ? slug : slug + '-' + i;
    const q = { slug: candidate };
    if (excludeId) q._id = { $ne: excludeId };
    const exists = await FormDefinition.findOne(q).select('_id').lean();
    if (!exists) return candidate;
    i += 1;
    if (i > 50) return candidate + '-' + Date.now();
  }
}

async function createForm({ name, description, fields, status, createdBy }) {
  if (!name?.trim()) {
    const err = new Error('Thieu ten form');
    err.status = 400;
    throw err;
  }
  const slug = await uniqueSlug(name);
  return FormDefinition.create({
    name: name.trim().slice(0, 120),
    description: String(description || '').slice(0, 500),
    slug,
    fields: normalizeFields(fields),
    status: ['draft', 'published', 'archived'].includes(status) ? status : 'draft',
    createdBy: String(createdBy || ''),
  });
}

async function updateForm(id, patch) {
  const form = await FormDefinition.findById(id);
  if (!form) {
    const err = new Error('Khong tim thay form');
    err.status = 404;
    throw err;
  }
  if (patch.name != null) form.name = String(patch.name).trim().slice(0, 120);
  if (patch.description != null) form.description = String(patch.description).slice(0, 500);
  if (patch.fields != null) form.fields = normalizeFields(patch.fields);
  if (patch.status && ['draft', 'published', 'archived'].includes(patch.status)) {
    form.status = patch.status;
  }
  await form.save();
  return form;
}

async function listForms({ status, page = 1, limit = 30 } = {}) {
  const filter = {};
  if (status && status !== 'all') filter.status = status;
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 30));
  const skip = (pageNum - 1) * limitNum;
  const [data, total] = await Promise.all([
    FormDefinition.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limitNum).lean(),
    FormDefinition.countDocuments(filter),
  ]);
  return {
    data,
    pagination: { page: pageNum, limit: limitNum, total, pages: Math.max(1, Math.ceil(total / limitNum)) },
  };
}

async function getForm(idOrSlug, { publishedOnly = false } = {}) {
  const q = idOrSlug.match(/^[a-f\d]{24}$/i)
    ? { _id: idOrSlug }
    : { slug: String(idOrSlug).toLowerCase() };
  if (publishedOnly) q.status = 'published';
  const form = await FormDefinition.findOne(q).lean();
  if (!form) {
    const err = new Error('Khong tim thay form');
    err.status = 404;
    throw err;
  }
  return form;
}

async function deleteForm(id) {
  const form = await FormDefinition.findByIdAndDelete(id);
  if (!form) {
    const err = new Error('Khong tim thay form');
    err.status = 404;
    throw err;
  }
  await FormSubmission.deleteMany({ formId: id });
  return { id };
}

async function submitForm(idOrSlug, { answers, submittedBy, submittedByRole, meta } = {}) {
  const form = await getForm(idOrSlug, { publishedOnly: true });
  const { errors, answers: clean } = validateAnswers(form, answers || {});
  if (errors.length) {
    const err = new Error(errors.join('; '));
    err.status = 400;
    throw err;
  }
  return FormSubmission.create({
    formId: form._id,
    formSlug: form.slug,
    answers: clean,
    submittedBy: String(submittedBy || ''),
    submittedByRole: String(submittedByRole || ''),
    meta: meta || {},
  });
}

async function listSubmissions(formId, { page = 1, limit = 50 } = {}) {
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(200, Math.max(1, Number(limit) || 50));
  const skip = (pageNum - 1) * limitNum;
  const filter = { formId };
  const [data, total] = await Promise.all([
    FormSubmission.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
    FormSubmission.countDocuments(filter),
  ]);
  return {
    data,
    pagination: { page: pageNum, limit: limitNum, total, pages: Math.max(1, Math.ceil(total / limitNum)) },
  };
}

function submissionsToCsv(form, submissions) {
  const fields = form.fields || [];
  const headers = ['submittedAt', 'submittedBy', ...fields.map((f) => f.key)];
  const lines = [headers.join(',')];
  for (const s of submissions) {
    const row = [
      s.createdAt ? new Date(s.createdAt).toISOString() : '',
      s.submittedBy || '',
      ...fields.map((f) => {
        const v = s.answers?.[f.key];
        const str = v == null ? '' : String(v).replace(/"/g, '""');
        return '"' + str + '"';
      }),
    ];
    lines.push(row.join(','));
  }
  return lines.join('\n');
}

module.exports = {
  FIELD_TYPES,
  createForm,
  updateForm,
  listForms,
  getForm,
  deleteForm,
  submitForm,
  listSubmissions,
  submissionsToCsv,
  normalizeFields,
  validateAnswers,
};