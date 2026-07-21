/**
 * Workflow engine (Phase 13) — dinh nghia san + instance + side effects.
 */
const WorkflowInstance = require('../models/WorkflowInstance');
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');
const Transaction = require('../models/Transaction');
const logger = require('../config/logger');

const DEFINITIONS = {
  teacher_approval: {
    key: 'teacher_approval',
    name: 'Duyet giang vien',
    description: 'GV dang ky / nop bai → Admin duyet active',
    entityType: 'teacher',
    initialStep: 'pending_review',
    terminalSteps: ['approved', 'rejected'],
    actions: {
      pending_review: ['approve', 'reject'],
    },
  },
  exam_unlock: {
    key: 'exam_unlock',
    name: 'Mo khoa phong thi',
    description: 'Yeu cau mo khoa thi cho hoc vien',
    entityType: 'student',
    initialStep: 'pending_review',
    terminalSteps: ['approved', 'rejected'],
    actions: {
      pending_review: ['approve', 'reject'],
    },
  },
  payout_request: {
    key: 'payout_request',
    name: 'Duyet chi luong GV',
    description: 'Yeu cau thanh toan giao dich cho giang vien',
    entityType: 'transaction',
    initialStep: 'pending_review',
    terminalSteps: ['approved', 'rejected'],
    actions: {
      pending_review: ['approve', 'reject'],
    },
  },
};

function listDefinitions() {
  return Object.values(DEFINITIONS).map((d) => ({
    key: d.key,
    name: d.name,
    description: d.description,
    entityType: d.entityType,
    initialStep: d.initialStep,
    actions: d.actions,
  }));
}

function getDefinition(key) {
  return DEFINITIONS[key] || null;
}

async function start({
  definitionKey,
  entityId,
  entityLabel = '',
  title = '',
  payload = {},
  createdBy = '',
  force = false,
} = {}) {
  const def = getDefinition(definitionKey);
  if (!def) {
    const err = new Error('Workflow khong ton tai');
    err.status = 400;
    throw err;
  }
  if (!entityId) {
    const err = new Error('Thieu entityId');
    err.status = 400;
    throw err;
  }

  if (!force) {
    const existing = await WorkflowInstance.findOne({
      definitionKey,
      entityId: String(entityId),
      status: 'open',
    });
    if (existing) return existing;
  }

  const instance = await WorkflowInstance.create({
    definitionKey,
    status: 'open',
    currentStep: def.initialStep,
    entityType: def.entityType,
    entityId: String(entityId),
    entityLabel: entityLabel || String(entityId),
    title: title || def.name + ': ' + (entityLabel || entityId),
    payload,
    createdBy: String(createdBy || ''),
    history: [{
      step: def.initialStep,
      action: 'start',
      by: String(createdBy || 'system'),
      byName: 'system',
      note: 'Khoi tao workflow',
      at: new Date(),
    }],
  });
  return instance;
}

async function listInstances({ status = 'open', definitionKey, page = 1, limit = 30 } = {}) {
  const filter = {};
  if (status && status !== 'all') filter.status = status;
  if (definitionKey) filter.definitionKey = definitionKey;

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 30));
  const skip = (pageNum - 1) * limitNum;

  const [rows, total, openCount] = await Promise.all([
    WorkflowInstance.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
    WorkflowInstance.countDocuments(filter),
    WorkflowInstance.countDocuments({ status: 'open' }),
  ]);

  return {
    data: rows.map((r) => ({
      ...r,
      definitionName: DEFINITIONS[r.definitionKey]?.name || r.definitionKey,
    })),
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.max(1, Math.ceil(total / limitNum)),
    },
    openCount,
  };
}

async function getInstance(id) {
  const row = await WorkflowInstance.findById(id).lean();
  if (!row) {
    const err = new Error('Khong tim thay workflow');
    err.status = 404;
    throw err;
  }
  return {
    ...row,
    definitionName: DEFINITIONS[row.definitionKey]?.name || row.definitionKey,
    definition: DEFINITIONS[row.definitionKey] || null,
  };
}

async function applySideEffects(instance, action, io) {
  const key = instance.definitionKey;
  const id = instance.entityId;

  if (key === 'teacher_approval' && action === 'approve') {
    const teacher = await Teacher.findById(id);
    if (!teacher) throw Object.assign(new Error('Khong tim thay GV'), { status: 404 });
    const score = Number(teacher.testScore);
    if (Number.isFinite(score) && score < 80) {
      throw Object.assign(
        new Error('Khong the duyet: diem test ' + score + '/100 (can >= 80)'),
        { status: 403 },
      );
    }
    teacher.status = 'active';
    teacher.approvedAt = new Date();
    await teacher.save();
    if (io) {
      io.emit('teacher:approved', {
        teacherId: teacher._id.toString(),
        name: teacher.name,
        message: 'Tai khoan da duoc phe duyet qua Workflow.',
      });
      io.emit('data:refresh', { type: 'teacher', id: teacher._id });
    }
    return { teacherId: teacher._id.toString(), status: teacher.status };
  }

  if (key === 'teacher_approval' && action === 'reject') {
    const teacher = await Teacher.findByIdAndUpdate(
      id,
      { status: 'suspended', rejectedAt: new Date() },
      { new: true },
    );
    if (io) io.emit('data:refresh', { type: 'teacher', id });
    return { teacherId: id, status: teacher?.status || 'suspended' };
  }

  if (key === 'exam_unlock' && action === 'approve') {
    const student = await Student.findByIdAndUpdate(
      id,
      { studentExamUnlocked: true, examApproved: true },
      { new: true },
    );
    if (!student) throw Object.assign(new Error('Khong tim thay HV'), { status: 404 });
    if (io) {
      try {
        const NotificationService = require('./NotificationService');
        await NotificationService.send(io, {
          type: 'EXAM',
          title: 'Phong thi da mo',
          content: 'Yeu cau mo khoa thi da duoc duyet.',
          receivers: student._id.toString(),
          link: '/student/exam',
        });
      } catch (e) {
        logger.warn({ err: e.message }, '[Workflow] exam notify');
      }
      io.emit('exam:unlocked', { studentId: student._id.toString(), studentName: student.name });
      io.emit('data:refresh', { type: 'student', id: student._id });
    }
    return { studentId: student._id.toString(), unlocked: true };
  }

  if (key === 'exam_unlock' && action === 'reject') {
    return { studentId: id, unlocked: false };
  }

  if (key === 'payout_request' && action === 'approve') {
    const tx = await Transaction.findByIdAndUpdate(
      id,
      { status: 'confirmed', confirmedAt: new Date(), confirmedBy: 'workflow' },
      { new: true },
    );
    if (!tx) throw Object.assign(new Error('Khong tim thay giao dich'), { status: 404 });
    if (io) io.emit('data:refresh', { type: 'transaction', id });
    return { transactionId: id, status: 'confirmed' };
  }

  if (key === 'payout_request' && action === 'reject') {
    const tx = await Transaction.findByIdAndUpdate(
      id,
      { status: 'cancelled' },
      { new: true },
    );
    return { transactionId: id, status: tx?.status || 'cancelled' };
  }

  return null;
}

async function advance(id, { action, note = '' } = {}, user = {}, io = null) {
  const instance = await WorkflowInstance.findById(id);
  if (!instance) {
    const err = new Error('Khong tim thay workflow');
    err.status = 404;
    throw err;
  }
  if (instance.status !== 'open') {
    const err = new Error('Workflow da ket thuc');
    err.status = 400;
    throw err;
  }

  const def = getDefinition(instance.definitionKey);
  const allowed = def?.actions?.[instance.currentStep] || [];
  if (!allowed.includes(action)) {
    const err = new Error('Hanh dong khong hop le o buoc ' + instance.currentStep);
    err.status = 400;
    throw err;
  }

  const effect = await applySideEffects(instance, action, io);

  const nextStep = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : action;
  instance.history.push({
    step: instance.currentStep,
    action,
    by: String(user.id || user._id || ''),
    byName: user.name || '',
    note: String(note || '').slice(0, 500),
    at: new Date(),
  });
  instance.currentStep = nextStep;
  instance.status = action === 'approve' ? 'completed' : action === 'reject' ? 'rejected' : 'cancelled';
  instance.completedAt = new Date();
  if (effect) instance.payload = { ...(instance.payload || {}), lastEffect: effect };
  await instance.save();
  return instance;
}

/**
 * Dong bo GV dang cho duyet / GD pending thanh workflow open.
 */
async function syncFromDomain() {
  let created = 0;

  const pendingTeachers = await Teacher.find({
    role: 'teacher',
    status: { $in: ['Pending', 'pending', 'practical_submitted'] },
  }).select('name phone testScore status').lean();

  for (const t of pendingTeachers) {
    const before = await WorkflowInstance.countDocuments({
      definitionKey: 'teacher_approval',
      entityId: String(t._id),
      status: 'open',
    });
    if (before) continue;
    await start({
      definitionKey: 'teacher_approval',
      entityId: t._id,
      entityLabel: t.name,
      title: 'Duyet GV: ' + t.name,
      payload: { testScore: t.testScore, phone: t.phone },
      createdBy: 'sync',
    });
    created += 1;
  }

  const pendingTx = await Transaction.find({ status: 'pending' }).select('teacherId amount').limit(50).lean();
  for (const tx of pendingTx) {
    const before = await WorkflowInstance.countDocuments({
      definitionKey: 'payout_request',
      entityId: String(tx._id),
      status: 'open',
    });
    if (before) continue;
    await start({
      definitionKey: 'payout_request',
      entityId: tx._id,
      entityLabel: 'GD ' + String(tx._id).slice(-6),
      title: 'Chi luong: ' + (tx.amount || 0).toLocaleString('vi-VN') + 'd',
      payload: { amount: tx.amount, teacherId: tx.teacherId },
      createdBy: 'sync',
    });
    created += 1;
  }

  return { created };
}

/** Goi khi domain action xong de dong workflow lien quan */
async function completeOpenForEntity(definitionKey, entityId, { action = 'approve', user, note } = {}) {
  const open = await WorkflowInstance.findOne({
    definitionKey,
    entityId: String(entityId),
    status: 'open',
  });
  if (!open) return null;
  open.history.push({
    step: open.currentStep,
    action,
    by: String(user?.id || 'system'),
    byName: user?.name || 'system',
    note: note || 'Dong bo tu hanh dong domain',
    at: new Date(),
  });
  open.currentStep = action === 'approve' ? 'approved' : 'rejected';
  open.status = action === 'approve' ? 'completed' : 'rejected';
  open.completedAt = new Date();
  await open.save();
  return open;
}

module.exports = {
  DEFINITIONS,
  listDefinitions,
  getDefinition,
  start,
  listInstances,
  getInstance,
  advance,
  syncFromDomain,
  completeOpenForEntity,
};