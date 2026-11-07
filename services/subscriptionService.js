'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');
const Student = require('../models/Student');
const ActivationCode = require('../models/ActivationCode');
const SubscriptionLog = require('../models/SubscriptionLog');
const PaymentSession = require('../models/PaymentSession');
const DailyPracticeProfile = require('../models/DailyPracticeProfile');
const { xpPack } = require('./dailyPracticeRules');
const SystemSettings = require('../models/SystemSettings');
const { settlePayment } = require('./ledgerService');
const { unlockFreePortal } = require('./freePortal');
const { buildStudentSearchAndConditions } = require('../utils/personSearchQuery');

const PLANS = ['1m', '3m', '6m', '12m', 'lifetime'];
const PLAN_MONTHS = { '1m': 1, '3m': 3, '6m': 6, '12m': 12, lifetime: null };
const PLAN_LABELS = { '1m': '1 tháng', '3m': '3 tháng', '6m': '6 tháng', '12m': '1 năm', lifetime: 'Vĩnh viễn' };
const DAY_MS = 24 * 60 * 60 * 1000;
/** Còn ≤ số ngày này thì coi là "sắp hết hạn" (nhắc + màu cam). */
const EXPIRING_DAYS = 7;
const DAILY_XP = 200;
const PLAN_BENEFITS = [
  'Học qua Meet với giảng viên',
  '300 XP mỗi ngày khi gói còn hạn',
  'Hết hạn thì tài khoản miễn phí về 60 XP mỗi ngày',
  'Xem video và dùng tính năng tự học trong hạn gói',
];
/** Nhắc gia hạn đúng 2 lần mỗi kỳ hạn: còn ≤7 ngày và ngày cuối (≤1 ngày). */
const REMINDER_THRESHOLDS = [7, 1];
const MAX_CODES_PER_BATCH = 500;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function httpError(status, message, code) {
  const err = new Error(message);
  err.status = status;
  if (code) err.code = code;
  return err;
}

function assertPlan(plan) {
  if (!PLANS.includes(plan)) throw httpError(400, 'Gói không hợp lệ');
  return plan;
}

function addMonths(date, months) {
  const next = new Date(date.getTime());
  const day = next.getDate();
  next.setMonth(next.getMonth() + months);
  if (next.getDate() < day) next.setDate(0); // 31/1 + 1 tháng → 28/29/2, không nhảy sang tháng 3
  return next;
}

/** Hạn mới khi gia hạn: cộng từ max(hôm nay, hạn hiện tại); vĩnh viễn = null. */
function nextExpiry(currentExpiresAt, plan, now = new Date()) {
  if (plan === 'lifetime') return null;
  const current = currentExpiresAt ? new Date(currentExpiresAt) : null;
  const base = current && current > now ? current : now;
  return addMonths(base, PLAN_MONTHS[plan]);
}

/** Trạng thái gói để hiển thị + chặn truy cập. Thiếu trường (HV cũ) = vĩnh viễn. */
function statusOf(student, now = new Date()) {
  const sub = student?.subscription || {};
  const plan = PLANS.includes(sub.plan) ? sub.plan : 'lifetime';
  const expiresAt = sub.expiresAt ? new Date(sub.expiresAt) : null;
  if (plan === 'lifetime' || !expiresAt) {
    const boughtLifetime = plan === 'lifetime' && Boolean(sub.activatedAt);
    const freeTier = student?.freePortal === true && !boughtLifetime;
    return {
      plan: 'lifetime',
      planLabel: freeTier ? 'Miễn phí' : PLAN_LABELS.lifetime,
      expiresAt: null,
      state: 'lifetime',
      daysLeft: null,
      activated: student?.freePortal === true ? boughtLifetime : true,
      meetLifetime: student?.freePortal === true && boughtLifetime,
      freeTier,
    };
  }
  const msLeft = expiresAt.getTime() - now.getTime();
  const daysLeft = Math.ceil(msLeft / DAY_MS);
  let state = 'active';
  if (msLeft <= 0) state = 'expired';
  else if (daysLeft <= EXPIRING_DAYS) state = 'expiring';
  return {
    plan,
    planLabel: student?.freePortal === true && state === 'expired' ? 'Miễn phí' : PLAN_LABELS[plan],
    expiresAt: expiresAt.toISOString(),
    state,
    daysLeft: Math.max(0, daysLeft),
    activated: Boolean(sub.activatedAt),
    meetLifetime: false,
    freeTier: student?.freePortal === true && state === 'expired',
  };
}

function isExpired(student, now = new Date()) {
  return statusOf(student, now).state === 'expired';
}

/**
 * Gói Meet còn hiệu lực — chỉ tài khoản miễn phí (freePortal) đã mua gói Meet.
 * HV đăng ký khóa học truyền thống (không freePortal) không thuộc nhóm Meet online.
 */
function hasMeetAccess(student, now = new Date()) {
  if (student?.freePortal !== true) return false;
  const status = statusOf(student, now);
  if (status.state === 'expired' || status.freeTier) return false;
  return Boolean(status.meetLifetime || status.state === 'active' || status.state === 'expiring');
}

/** Gói Vĩnh viễn đã mua thì không gia hạn. Tài khoản miễn phí chưa mua Meet vẫn đăng ký được. */
function renewalBlocked(student) {
  const status = statusOf(student);
  if (status.state !== 'lifetime') return false;
  if (student?.freePortal === true && !status.meetLifetime) return false;
  return true;
}

/**
 * Gia hạn một lần (atomic theo hạn cũ để 2 lần gia hạn đồng thời không đè nhau).
 * Ghi lịch sử, xóa mốc nhắc của kỳ cũ.
 */
async function applyRenewal(studentId, plan, { source, code = '', paymentSessionId = '', amount = 0, actor = {}, note = '' } = {}) {
  assertPlan(plan);
  if (!mongoose.Types.ObjectId.isValid(String(studentId || ''))) throw httpError(400, 'Học viên không hợp lệ');
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const student = await Student.findById(studentId).select('name subscription freePortal').lean();
    if (!student) throw httpError(404, 'Không tìm thấy học viên');
    const previous = statusOf(student);
    if (previous.state === 'lifetime' && plan !== 'lifetime' && student.freePortal !== true) {
      throw httpError(409, 'Tài khoản đang ở gói Vĩnh viễn, không cần gia hạn', 'SUBSCRIPTION_LIFETIME');
    }
    const previousExpiresAt = student.subscription?.expiresAt || null;
    const newExpiresAt = nextExpiry(previousExpiresAt, plan);
    const now = new Date();
    const updated = await Student.findOneAndUpdate(
      { _id: studentId, 'subscription.expiresAt': previousExpiresAt },
      {
        $set: {
          'subscription.plan': plan,
          'subscription.expiresAt': newExpiresAt,
          'subscription.activatedAt': now,
          'subscription.remindedFor': [],
        },
      },
      { returnDocument: 'after' },
    ).select('name subscription').lean();
    if (!updated) continue;
    await SubscriptionLog.create({
      studentId,
      source,
      plan,
      previousPlan: previous.plan,
      previousExpiresAt,
      newExpiresAt,
      code,
      paymentSessionId,
      amount,
      actorId: String(actor.id || ''),
      actorName: String(actor.name || ''),
      note,
    });
    if (plan !== 'lifetime' || student.freePortal === true) {
      await unlockFreePortal(studentId);
      try {
        const { refillDailyXp } = require('./dailyPracticeService');
        await refillDailyXp(studentId);
      } catch (err) {
        console.error('[subscription] không cộng được mức 300 XP/ngày:', err.message);
      }
    }
    return statusOf({ ...updated, freePortal: student.freePortal });
  }
  throw httpError(409, 'Đang có thao tác gia hạn khác, vui lòng thử lại');
}

function normalizeCode(code) {
  return String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function formatCode(raw) {
  return `TTH-${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
}

function randomCode() {
  let raw = '';
  for (let i = 0; i < 8; i += 1) raw += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  return formatCode(raw);
}

/** HV nhập mã: mỗi mã chỉ dùng 1 lần (claim atomic), lỗi gia hạn thì trả mã về. */
async function redeemCode(studentId, rawCode) {
  const compact = normalizeCode(rawCode).replace(/^TTH/, '');
  if (compact.length !== 8) throw httpError(400, 'Mã kích hoạt không hợp lệ');
  const code = formatCode(compact);
  const student = await Student.findById(studentId).select('name subscription freePortal').lean();
  if (!student) throw httpError(404, 'Không tìm thấy học viên');

  const existing = await ActivationCode.findOne({ code }).lean();
  if (!existing) throw httpError(404, 'Mã kích hoạt không tồn tại');
  if (existing.status === 'used') throw httpError(409, 'Mã kích hoạt đã được sử dụng');
  if (existing.status === 'revoked') throw httpError(409, 'Mã kích hoạt đã bị thu hồi');
  if (renewalBlocked(student) && existing.plan !== 'lifetime') {
    throw httpError(409, 'Tài khoản đang ở gói Vĩnh viễn, không cần gia hạn', 'SUBSCRIPTION_LIFETIME');
  }

  const claimed = await ActivationCode.findOneAndUpdate(
    { code, status: 'unused' },
    { $set: { status: 'used', usedBy: studentId, usedByName: student.name || '', usedAt: new Date() } },
    { returnDocument: 'after' },
  ).lean();
  if (!claimed) throw httpError(409, 'Mã kích hoạt đã được sử dụng');

  try {
    const status = await applyRenewal(studentId, claimed.plan, {
      source: 'code',
      code,
      actor: { id: String(studentId), name: student.name || '' },
    });
    return { ...status, redeemedPlan: claimed.plan, redeemedPlanLabel: PLAN_LABELS[claimed.plan] };
  } catch (err) {
    await ActivationCode.updateOne(
      { _id: claimed._id, status: 'used', usedBy: studentId },
      { $set: { status: 'unused', usedBy: null, usedByName: '', usedAt: null } },
    );
    throw err;
  }
}

async function generateCodes({ plan, quantity, note = '', actor = {} }) {
  assertPlan(plan);
  const count = Math.floor(Number(quantity));
  if (!(count >= 1 && count <= MAX_CODES_PER_BATCH)) {
    throw httpError(400, `Số lượng mã từ 1 đến ${MAX_CODES_PER_BATCH}`);
  }
  const batchId = `B${Date.now().toString(36).toUpperCase()}`;
  const docs = [];
  const seen = new Set();
  while (docs.length < count) {
    const code = randomCode();
    if (seen.has(code)) continue;
    seen.add(code);
    docs.push({
      code,
      plan,
      batchId,
      note: String(note || '').trim().slice(0, 200),
      createdBy: String(actor.id || ''),
      createdByName: String(actor.name || ''),
    });
  }
  try {
    await ActivationCode.insertMany(docs, { ordered: false });
  } catch (err) {
    if (err?.code !== 11000 && !err?.writeErrors) throw err;
  }
  const created = await ActivationCode.find({ batchId }).sort({ createdAt: 1 }).lean();
  return { batchId, plan, codes: created.map(codeView) };
}

function codeView(doc) {
  return {
    id: String(doc._id),
    code: doc.code,
    plan: doc.plan,
    planLabel: PLAN_LABELS[doc.plan],
    status: doc.status,
    batchId: doc.batchId || '',
    note: doc.note || '',
    createdByName: doc.createdByName || '',
    usedBy: doc.usedBy ? String(doc.usedBy) : '',
    usedByName: doc.usedByName || '',
    usedAt: doc.usedAt || null,
    createdAt: doc.createdAt,
  };
}

async function listCodes({ status = '', plan = '', q = '', limit = 500 } = {}) {
  const filter = {};
  if (['unused', 'used', 'revoked'].includes(status)) filter.status = status;
  if (PLANS.includes(plan)) filter.plan = plan;
  const query = String(q || '').trim();
  if (query) {
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { code: { $regex: escaped, $options: 'i' } },
      { batchId: { $regex: escaped, $options: 'i' } },
      { note: { $regex: escaped, $options: 'i' } },
      { usedByName: { $regex: escaped, $options: 'i' } },
    ];
  }
  const rows = await ActivationCode.find(filter).sort({ createdAt: -1 }).limit(Math.min(Number(limit) || 500, 2000)).lean();
  const counts = await ActivationCode.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]);
  return {
    codes: rows.map(codeView),
    counts: Object.fromEntries(counts.map((row) => [row._id, row.n])),
  };
}

async function revokeCode(id) {
  if (!mongoose.Types.ObjectId.isValid(String(id || ''))) throw httpError(400, 'Mã không hợp lệ');
  const doc = await ActivationCode.findOneAndUpdate(
    { _id: id, status: 'unused' },
    { $set: { status: 'revoked' } },
    { returnDocument: 'after' },
  ).lean();
  if (!doc) throw httpError(409, 'Chỉ thu hồi được mã chưa sử dụng');
  return codeView(doc);
}

async function getPrices() {
  const settings = await SystemSettings.findOne({ _key: 'main' }).select('subscriptionPrices').lean();
  const raw = settings?.subscriptionPrices || {};
  return Object.fromEntries(PLANS.map((plan) => [plan, Math.max(0, Number(raw[plan]) || 0)]));
}

async function setPrices(input = {}) {
  const update = {};
  for (const plan of PLANS) {
    if (input[plan] === undefined) continue;
    const value = Math.round(Number(input[plan]));
    if (!Number.isFinite(value) || value < 0 || value > 1_000_000_000) throw httpError(400, `Giá gói ${PLAN_LABELS[plan]} không hợp lệ`);
    update[`subscriptionPrices.${plan}`] = value;
  }
  await SystemSettings.findOneAndUpdate({ _key: 'main' }, { $set: update }, { upsert: true, setDefaultsOnInsert: true });
  return getPrices();
}

async function planCatalog() {
  const prices = await getPrices();
  return PLANS.map((plan) => ({
    id: plan,
    label: PLAN_LABELS[plan],
    months: PLAN_MONTHS[plan],
    price: prices[plan],
    dailyXp: 300,
    benefits: PLAN_BENEFITS,
  }));
}

async function myOverview(studentId) {
  const student = await Student.findById(studentId).select('name subscription freePortal').lean();
  if (!student) throw httpError(404, 'Không tìm thấy học viên');
  const [plans, history, xpPurchases] = await Promise.all([
    planCatalog(),
    SubscriptionLog.find({ studentId }).sort({ createdAt: -1 }).limit(20).lean(),
    xpPurchaseHistory(studentId),
  ]);
  return {
    subscription: statusOf(student),
    plans,
    history: history.map(logView),
    xpPurchases,
  };
}

async function xpPurchaseHistory(studentId) {
  const [profile, sessions] = await Promise.all([
    DailyPracticeProfile.findOne({ studentId }).select('xpPurchases').lean(),
    PaymentSession.find({ studentId, kind: 'daily_practice_xp', status: 'paid' }).sort({ createdAt: -1 }).limit(20).lean(),
  ]);
  const seen = new Set();
  const rows = [];
  const add = (row) => {
    const id = String(row.sessionId || row._id || '');
    if (!id || seen.has(id)) return;
    seen.add(id);
    const pack = xpPack(row.packId || row.plan);
    const xp = Number(row.xp || pack?.xp || 0);
    rows.push({
      id,
      xp,
      label: pack?.label || (xp ? `${xp} XP` : 'XP'),
      amount: Number(row.amount || row.paidAmount || 0),
      createdAt: row.at || row.createdAt,
    });
  };
  for (const row of profile?.xpPurchases || []) add(row);
  for (const row of sessions) add(row);
  return rows.slice(0, 20);
}

function logView(row) {
  return {
    id: String(row._id),
    source: row.source,
    plan: row.plan,
    planLabel: String(row.note || '').startsWith('Về gói miễn phí') ? 'Miễn phí' : (PLAN_LABELS[row.plan] || row.plan),
    previousExpiresAt: row.previousExpiresAt,
    newExpiresAt: row.newExpiresAt,
    amount: row.amount || 0,
    actorName: row.actorName || '',
    note: row.note || '',
    createdAt: row.createdAt,
  };
}

function makeRenewalRef(studentCode) {
  const studentPart = String(studentCode || 'HV').replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase() || 'HV';
  return `${studentPart} GIA HAN ${crypto.randomInt(10000, 100000)}`;
}

/** HV bấm Gia hạn: tạo phiên chuyển khoản SePay; webhook khớp nội dung + số tiền sẽ tự gia hạn. */
async function checkout(studentId, plan) {
  assertPlan(plan);
  const student = await Student.findById(studentId).select('name studentCode branchId subscription freePortal').lean();
  if (!student) throw httpError(404, 'Không tìm thấy học viên');
  if (renewalBlocked(student)) {
    throw httpError(409, 'Tài khoản đang ở gói Vĩnh viễn, không cần gia hạn', 'SUBSCRIPTION_LIFETIME');
  }
  const amount = (await getPrices())[plan];
  if (!(amount > 0)) throw httpError(400, 'Gói này chưa mở thanh toán — vui lòng dùng mã kích hoạt hoặc liên hệ trung tâm');

  const pending = await PaymentSession.findOne({ studentId, kind: 'subscription_renewal', status: 'pending' }).sort({ createdAt: -1 });
  if (pending && pending.plan === plan && Number(pending.amount) === amount) {
    return { sessionId: pending.sessionId, ref: pending.ref, amount, plan, planLabel: PLAN_LABELS[plan] };
  }
  if (pending) {
    pending.status = 'expired';
    await pending.save();
  }
  const sessionId = `ps_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const ref = makeRenewalRef(student.studentCode);
  await PaymentSession.create({
    sessionId,
    ref,
    amount,
    status: 'pending',
    studentName: student.name || '',
    courseName: `Gia hạn tài khoản ${PLAN_LABELS[plan]}`,
    branchId: student.branchId || null,
    studentId,
    kind: 'subscription_renewal',
    plan,
  });
  return { sessionId, ref, amount, plan, planLabel: PLAN_LABELS[plan] };
}

async function sessionStatus(studentId, sessionId) {
  const session = await PaymentSession.findOne({ sessionId, studentId, kind: 'subscription_renewal' }).lean();
  if (!session) throw httpError(404, 'Không tìm thấy phiên thanh toán');
  return { paid: session.status === 'paid', status: session.status, amount: session.amount, ref: session.ref, plan: session.plan };
}

/** Webhook SePay đã claim phiên (status=paid): ghi sổ thu + gia hạn; idempotent theo phiên. */
async function fulfillSubscriptionPayment({ session, amount }) {
  if (!session?.studentId || !PLANS.includes(session.plan)) {
    throw new Error(`Phiên gia hạn thiếu học viên hoặc gói: ${session?.sessionId || ''}`);
  }
  const already = await SubscriptionLog.findOne({ paymentSessionId: session.sessionId }).lean();
  if (already) return { studentId: String(session.studentId), plan: session.plan, duplicated: true };
  const student = await Student.findById(session.studentId).select('name branchId').lean();
  if (!student) throw new Error(`Không tìm thấy học viên ${session.studentId}`);
  await settlePayment({
    student: { _id: student._id, branchId: session.branchId || student.branchId || null },
    amount,
    courseName: `Gia hạn tài khoản ${PLAN_LABELS[session.plan]}`,
    source: 'sepay_session',
    sourceRef: session.sessionId,
    idempotencyKey: `payment:sepay:subscription:${session.sessionId}`,
    actor: { id: 'sepay', role: 'system' },
    note: 'Gia hạn tài khoản qua SePay',
    metadata: {
      sessionId: session.sessionId,
      ref: session.ref,
      plan: session.plan,
      studentName: session.studentName || student.name || '',
      purchaseType: 'subscription_renewal',
      paymentMethod: 'transfer',
    },
    reqMeta: { ip: '', userAgent: 'sepay-webhook', branchId: session.branchId || student.branchId || null },
  });
  const status = await applyRenewal(session.studentId, session.plan, {
    source: 'payment',
    paymentSessionId: session.sessionId,
    amount,
    actor: { id: 'sepay', name: 'SePay' },
  });
  return { studentId: String(session.studentId), plan: session.plan, subscription: status };
}

/** Chỉ dùng ngoài production để thử luồng thanh toán. */
async function simulatePayment(studentId, sessionId) {
  const session = await PaymentSession.findOne({ sessionId, studentId, kind: 'subscription_renewal' });
  if (!session) throw httpError(404, 'Không tìm thấy phiên thanh toán');
  if (session.status !== 'pending') throw httpError(409, 'Phiên thanh toán không còn hiệu lực');
  const claimed = await PaymentSession.findOneAndUpdate(
    { _id: session._id, status: 'pending' },
    { $set: { status: 'paid', paidAmount: session.amount } },
    { returnDocument: 'after' },
  ).lean();
  if (!claimed) throw httpError(409, 'Phiên thanh toán không còn hiệu lực');
  try {
    return await fulfillSubscriptionPayment({ session: claimed, amount: claimed.amount });
  } catch (err) {
    await PaymentSession.updateOne({ _id: session._id, status: 'paid' }, { $set: { status: 'pending' }, $unset: { paidAmount: 1 } });
    throw err;
  }
}

/**
 * Admin đặt gói cho 1 HV:
 * - mode "extend": gia hạn thêm gói (cộng từ max(hôm nay, hạn cũ)); gói lifetime = vĩnh viễn;
 * - mode "set": đặt ngày hết hạn cụ thể (expiresAt) hoặc "require_activation" = hết hạn ngay, HV phải nhập mã.
 */
async function syncPlanAllowance(studentId) {
  try {
    const { refillDailyXp } = require('./dailyPracticeService');
    await refillDailyXp(studentId);
  } catch (err) {
    console.error('[subscription] không cộng được XP theo gói:', err.message);
  }
}

async function adminSetSubscription(studentId, { mode = 'extend', plan = '', expiresAt = null, note = '' } = {}, actor = {}) {
  if (!mongoose.Types.ObjectId.isValid(String(studentId || ''))) throw httpError(400, 'Học viên không hợp lệ');
  const student = await Student.findById(studentId).select('name subscription freePortal').lean();
  if (!student) throw httpError(404, 'Không tìm thấy học viên');

  if (mode === 'extend') {
    assertPlan(plan);
    const previous = statusOf(student);
    if (previous.state === 'lifetime' && plan !== 'lifetime' && student.freePortal !== true) {
      await Student.updateOne({ _id: studentId }, { $set: { 'subscription.plan': plan, 'subscription.expiresAt': new Date() } });
    }
    return applyRenewal(studentId, plan, { source: 'admin', actor, note });
  }

  if (mode === 'free') {
    if (student.freePortal !== true) throw httpError(400, 'Chỉ tài khoản miễn phí được đưa về gói miễn phí');
  }

  const currentPlan = PLANS.includes(student.subscription?.plan) ? student.subscription.plan : 'lifetime';
  let nextPlan = currentPlan !== 'lifetime' ? currentPlan : '1m';
  let nextExpiresAt;
  let nextActivatedAt = null;
  let defaultNote = 'Đặt ngày hết hạn';
  if (mode === 'free') {
    nextPlan = 'lifetime';
    nextExpiresAt = null;
    nextActivatedAt = null;
    defaultNote = 'Về gói miễn phí';
  } else if (mode === 'require_activation') {
    nextExpiresAt = new Date();
    nextActivatedAt = null;
    defaultNote = 'Yêu cầu nhập mã kích hoạt';
  } else if (mode === 'set') {
    nextExpiresAt = expiresAt ? new Date(expiresAt) : null;
    if (!nextExpiresAt || Number.isNaN(nextExpiresAt.getTime())) throw httpError(400, 'Ngày hết hạn không hợp lệ');
    nextActivatedAt = new Date();
  } else {
    throw httpError(400, 'Thao tác không hợp lệ');
  }
  const previous = statusOf(student);
  const updated = await Student.findOneAndUpdate(
    { _id: studentId },
    {
      $set: {
        'subscription.plan': nextPlan,
        'subscription.expiresAt': nextExpiresAt,
        'subscription.activatedAt': nextActivatedAt,
        'subscription.remindedFor': [],
        ...(mode === 'free' ? { freeUnlocked: false } : {}),
      },
    },
    { returnDocument: 'after' },
  ).select('name subscription freePortal').lean();
  await SubscriptionLog.create({
    studentId,
    source: 'admin',
    plan: nextPlan,
    previousPlan: previous.plan,
    previousExpiresAt: student.subscription?.expiresAt || null,
    newExpiresAt: nextExpiresAt,
    actorId: String(actor.id || ''),
    actorName: String(actor.name || ''),
    note: mode === 'free' ? (note ? `Về gói miễn phí · ${note}` : 'Về gói miễn phí') : (note || defaultNote),
  });
  await syncPlanAllowance(studentId);
  return statusOf(updated);
}

/** Admin tìm HV để gia hạn tay (tên / SĐT / mã HV), trong phạm vi chi nhánh được xem. */
const MAX_MEET_CLASS_STUDENTS = 100;

async function listMeetEligibleStudents(scopeFilter = {}, { limit = MAX_MEET_CLASS_STUDENTS } = {}) {
  const query = { accountLocked: { $ne: true }, freePortal: true, ...(scopeFilter || {}) };
  const rows = await Student.find(query)
    .select('name phone studentCode subscription freePortal')
    .sort({ name: 1 })
    .limit(3000)
    .lean();
  return rows
    .filter((row) => hasMeetAccess(row))
    .slice(0, Math.min(Math.max(1, limit), MAX_MEET_CLASS_STUDENTS))
    .map((row) => ({
      id: String(row._id),
      name: row.name || '',
      phone: row.phone || '',
      studentCode: row.studentCode || '',
    }));
}

async function searchStudents(query, scopeFilter = {}) {
  const conditions = buildStudentSearchAndConditions(String(query || '').slice(0, 80));
  if (!conditions.length) return [];
  if (scopeFilter && Object.keys(scopeFilter).length) conditions.push(scopeFilter);
  const rows = await Student.find({ $and: conditions })
    .select('name phone studentCode subscription freePortal')
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();
  return rows.map((row) => ({
    id: String(row._id),
    name: row.name || '',
    phone: row.phone || '',
    studentCode: row.studentCode || '',
    freePortal: row.freePortal === true,
    subscription: statusOf(row),
  }));
}

async function studentHistory(studentId) {
  const [student, rows] = await Promise.all([
    Student.findById(studentId).select('name subscription freePortal').lean(),
    SubscriptionLog.find({ studentId }).sort({ createdAt: -1 }).limit(50).lean(),
  ]);
  if (!student) throw httpError(404, 'Không tìm thấy học viên');
  return { subscription: statusOf(student), freePortal: student.freePortal === true, history: rows.map(logView) };
}

function dayKey(date) {
  return new Date(date).toISOString().slice(0, 10);
}

/**
 * Học viên cần nhắc hôm nay: mốc nhỏ nhất đã tới (còn ≤7 ngày, ngày cuối ≤1 ngày);
 * mỗi mốc của một kỳ hạn chỉ nhắc 1 lần. Đã hết hạn thì không nhắc (HV chỉ còn màn gia hạn).
 */
function pickReminder(student, now = new Date()) {
  const status = statusOf(student, now);
  if (status.state !== 'expiring' && status.state !== 'active') return null;
  if (status.daysLeft > REMINDER_THRESHOLDS[0]) return null;
  const expiresKey = dayKey(status.expiresAt);
  const reminded = new Set(student.subscription?.remindedFor || []);
  const threshold = [...REMINDER_THRESHOLDS].reverse().find((t) => status.daysLeft <= t);
  if (!threshold) return null;
  const key = `${expiresKey}:${threshold}`;
  return reminded.has(key) ? null : { key, status };
}

function reminderMessage(status) {
  const date = new Date(status.expiresAt).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  if (status.daysLeft <= 1) {
    return {
      title: 'Hôm nay là ngày cuối của gói tài khoản',
      content: `Tài khoản của bạn hết hạn ${date}. Gia hạn ngay để không bị gián đoạn việc học nhé!`,
    };
  }
  return {
    title: `Tài khoản còn ${status.daysLeft} ngày`,
    content: `Gói tài khoản của bạn hết hạn ngày ${date}. Gia hạn sớm để không bị gián đoạn việc học.`,
  };
}

/** Cron: gửi nhắc gia hạn; trả số HV đã nhắc. */
async function sendExpiryReminders({ io = null, notify = null, now = new Date() } = {}) {
  const horizon = new Date(now.getTime() + (REMINDER_THRESHOLDS[0] + 1) * DAY_MS);
  const students = await Student.find({
    'subscription.plan': { $in: ['1m', '3m', '6m', '12m'] },
    'subscription.expiresAt': { $gt: now, $lte: horizon },
  }).select('name subscription').lean();
  let sent = 0;
  for (const student of students) {
    const reminder = pickReminder(student, now);
    if (!reminder) continue;
    const claimed = await Student.updateOne(
      { _id: student._id, 'subscription.remindedFor': { $ne: reminder.key } },
      { $addToSet: { 'subscription.remindedFor': reminder.key } },
    );
    if (!claimed.modifiedCount) continue;
    const message = reminderMessage(reminder.status);
    if (typeof notify === 'function') {
      await notify({ studentId: String(student._id), ...message, status: reminder.status, io });
    }
    sent += 1;
  }
  return { sent };
}

module.exports = {
  PLANS,
  PLAN_LABELS,
  PLAN_MONTHS,
  EXPIRING_DAYS,
  addMonths,
  nextExpiry,
  statusOf,
  isExpired,
  hasMeetAccess,
  listMeetEligibleStudents,
  MAX_MEET_CLASS_STUDENTS,
  applyRenewal,
  redeemCode,
  generateCodes,
  listCodes,
  revokeCode,
  getPrices,
  setPrices,
  planCatalog,
  myOverview,
  checkout,
  sessionStatus,
  fulfillSubscriptionPayment,
  simulatePayment,
  adminSetSubscription,
  searchStudents,
  studentHistory,
  pickReminder,
  sendExpiryReminders,
};
