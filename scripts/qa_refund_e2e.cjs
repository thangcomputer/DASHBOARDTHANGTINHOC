/**
 * QA — Refund E2E (full + partial probe + ledger/invoice/access/audit).
 * Usage: node scripts/qa_refund_e2e.cjs
 * Prefers existing QA seed phones; creates disposable HV if needed.
 * Does NOT modify product code.
 */
require('dotenv').config();
const http = require('http');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const BASE = process.env.QA_API_BASE || 'http://127.0.0.1:5000';
const PASSWORD = 'Test@123456';
const OUT = path.join(__dirname, '..', 'docs', 'QA_REFUND_E2E_REPORT.md');

const Student = require('../models/Student');
const Teacher = require('../models/Teacher');
const Branch = require('../models/Branch');
const Invoice = require('../models/Invoice');
const LedgerEntry = require('../models/LedgerEntry');
const AuditLog = require('../models/AuditLog');
const { PERMISSIONS } = require('../constants/permissions');

const results = [];
let csrf = { token: '', cookie: '' };

function record(tc) {
  results.push(tc);
  console.log(`[${tc.result}] ${tc.id} — ${tc.name}${tc.actual ? ` | ${tc.actual}` : ''}`);
}

function req(method, p, { token, body } = {}) {
  return new Promise((resolve) => {
    const url = new URL(p, BASE);
    const headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (csrf.cookie) headers.Cookie = csrf.cookie;
    if (csrf.token && !['GET', 'HEAD', 'OPTIONS'].includes(method)) headers['X-CSRF-Token'] = csrf.token;
    const data = body != null ? JSON.stringify(body) : null;
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    const r = http.request(
      { hostname: url.hostname, port: url.port || 80, path: url.pathname + url.search, method, headers, timeout: 30000 },
      (res) => {
        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('end', () => {
          let json = null;
          try { json = raw ? JSON.parse(raw) : null; } catch { json = { _raw: raw.slice(0, 300) }; }
          resolve({ status: res.statusCode, json, headers: res.headers });
        });
      },
    );
    r.on('error', (err) => resolve({ status: 0, json: { message: err.message }, headers: {} }));
    if (data) r.write(data);
    r.end();
  });
}

async function refreshCsrf() {
  const res = await req('GET', '/api/auth/csrf-token');
  csrf.token = res.json?.csrfToken || res.json?.data?.csrfToken || '';
  csrf.cookie = (res.headers['set-cookie'] || []).map((c) => c.split(';')[0]).join('; ');
}

function mint(user) {
  return jwt.sign(
    {
      id: String(user._id),
      role: user.role || 'admin',
      adminRole: user.adminRole || 'STAFF',
      permissions: user.permissions || [PERMISSIONS.MANAGE_FINANCE, PERMISSIONS.MANAGE_STUDENTS],
      branchId: user.branchId ? String(user.branchId) : undefined,
      aud: 'internal',
      name: user.name,
    },
    process.env.JWT_SECRET,
    { expiresIn: '1h' },
  );
}

async function main() {
  console.log(`\n=== QA REFUND E2E @ ${BASE} ===\n`);
  await mongoose.connect(process.env.MONGODB_URI);

  let branch = await Branch.findOne({ code: 'CN1' });
  if (!branch) {
    branch = await Branch.create({ name: 'Chi nhánh QA CN1', code: 'CN1', isActive: true });
  }

  let admin = await Teacher.findOne({ phone: '0981100001' });
  if (!admin) {
    admin = await Teacher.create({
      name: 'QA Admin CN1',
      phone: '0981100001',
      zalo: '0981100001',
      password: PASSWORD,
      role: 'admin',
      adminRole: 'STAFF',
      permissions: [PERMISSIONS.MANAGE_FINANCE, PERMISSIONS.MANAGE_STUDENTS],
      branchId: branch._id,
      branchCode: 'CN1',
      status: 'active',
    });
  }

  // Disposable paid student for refund
  const phone = `0961999${String(Date.now()).slice(-4)}`;
  const student = await Student.create({
    name: 'QA REFUND HV',
    phone,
    zalo: phone,
    email: `qa.refund.${Date.now()}@test.local`,
    password: PASSWORD,
    course: 'Excel MOS',
    price: 2500000,
    paid: true,
    paidAmount: 2500000,
    paidAt: new Date(),
    paymentMethod: 'transfer',
    teacherId: null,
    branchId: branch._id,
    branchCode: 'CN1',
    status: 'Đang học',
    totalSessions: 20,
    remainingSessions: 20,
    enrollments: [{
      courseName: 'Excel MOS',
      price: 2500000,
      paid: true,
      paidAt: new Date(),
      status: 'active',
      learningAccess: true,
      isPrimary: true,
      totalSessions: 20,
      remainingSessions: 20,
      completedSessions: 0,
    }],
  });

  // Seed invoice (ADR: refund must NOT delete invoices)
  let invBefore = null;
  try {
    invBefore = await Invoice.create({
      maHoaDon: `HD-QA-${Date.now()}`,
      hocVien: student._id,
      hoTen: 'QA REFUND HV',
      khoaHoc: 'Excel MOS',
      hocPhi: 2500000,
      ghiChu: 'QA refund E2E invoice',
    });
  } catch (e) {
    console.warn('Invoice seed failed:', e.message);
  }

  const invoiceCountBefore = await Invoice.countDocuments({ hocVien: student._id });

  await refreshCsrf();
  const tok = mint(admin);

  // --- FULL REFUND ---
  await refreshCsrf();
  const refund = await req('PUT', `/api/students/${student._id}/refund`, {
    token: tok,
    body: { note: 'QA full refund E2E' },
  });
  const after = await Student.findById(student._id).lean();
  const ledgerRefund = await LedgerEntry.findOne({ studentId: student._id, type: 'refund' }).sort({ createdAt: -1 }).lean();
  const invoiceCountAfter = await Invoice.countDocuments({ hocVien: student._id });
  const audit = await AuditLog.findOne({ action: /payment\.refund/i, studentId: student._id }).sort({ createdAt: -1 }).lean()
    || await AuditLog.findOne({ action: /refund/i }).sort({ createdAt: -1 }).lean();

  record({
    id: 'REF-01',
    name: 'Full refund API 200',
    expected: '200 success',
    actual: `status=${refund.status} msg=${refund.json?.message || ''}`,
    result: refund.status === 200 ? 'PASS' : 'FAIL',
    severity: 'Critical',
  });
  record({
    id: 'REF-02',
    name: 'Student paid=false after refund',
    expected: 'paid=false paidAmount=0',
    actual: `paid=${after?.paid} paidAmount=${after?.paidAmount}`,
    result: after && after.paid === false && Number(after.paidAmount || 0) === 0 ? 'PASS' : 'FAIL',
    severity: 'Critical',
  });
  record({
    id: 'REF-03',
    name: 'Enrollment learningAccess revoked / status refunded',
    expected: 'learningAccess false or status refunded',
    actual: JSON.stringify((after?.enrollments || []).map((e) => ({ paid: e.paid, access: e.learningAccess, status: e.status }))),
    result: (after?.enrollments || []).some((e) => e.learningAccess === false || e.status === 'refunded' || e.paid === false) ? 'PASS' : 'FAIL',
    severity: 'Critical',
  });
  record({
    id: 'REF-04',
    name: 'Ledger refund entry created',
    expected: 'LedgerEntry type=refund amount=2500000',
    actual: ledgerRefund ? `amount=${ledgerRefund.amount} id=${ledgerRefund._id}` : 'none',
    result: ledgerRefund && Number(ledgerRefund.amount) === 2500000 ? 'PASS' : 'FAIL',
    severity: 'Critical',
  });
  record({
    id: 'REF-05',
    name: 'Invoice preserved (soft finance — no delete)',
    expected: 'invoiceCount after >= before and seeded invoice still exists',
    actual: `before=${invoiceCountBefore} after=${invoiceCountAfter} seeded=${Boolean(invBefore)} still=${invBefore ? Boolean(await Invoice.findById(invBefore._id)) : 'n/a'}`,
    result: invBefore && invoiceCountAfter >= invoiceCountBefore && invoiceCountBefore > 0
      ? 'PASS'
      : 'FAIL',
    severity: 'High',
  });
  record({
    id: 'REF-06',
    name: 'Audit payment.refund',
    expected: 'audit row exists',
    actual: audit ? `action=${audit.action}` : 'none',
    result: audit ? 'PASS' : 'FAIL',
    severity: 'High',
  });

  // --- Idempotency / double refund ---
  await refreshCsrf();
  const again = await req('PUT', `/api/students/${student._id}/refund`, {
    token: tok,
    body: { note: 'QA double refund' },
  });
  record({
    id: 'REF-07',
    name: 'Double refund rejected (409 unpaid)',
    expected: '409',
    actual: `status=${again.status} msg=${again.json?.message || ''}`,
    result: again.status === 409 ? 'PASS' : 'FAIL',
    severity: 'High',
  });

  // --- Partial refund probe ---
  const phone2 = `0961988${String(Date.now()).slice(-4)}`;
  const s2 = await Student.create({
    name: 'QA PARTIAL REFUND HV',
    phone: phone2,
    zalo: phone2,
    email: `qa.partial.${Date.now()}@test.local`,
    password: PASSWORD,
    course: 'Excel MOS',
    price: 2500000,
    paid: true,
    paidAmount: 2500000,
    paidAt: new Date(),
    branchId: branch._id,
    branchCode: 'CN1',
    status: 'Đang học',
    enrollments: [{
      courseName: 'Excel MOS', price: 2500000, paid: true, status: 'active', learningAccess: true, isPrimary: true,
      totalSessions: 20, remainingSessions: 20, completedSessions: 0,
    }],
  });
  await refreshCsrf();
  const partial = await req('PUT', `/api/students/${s2._id}/refund`, {
    token: tok,
    body: { note: 'QA partial', amount: 500000 },
  });
  const s2after = await Student.findById(s2._id).lean();
  const partialLedger = await LedgerEntry.findOne({
    studentId: s2._id,
    type: 'refund',
    amount: 500000,
  }).lean();
  const isPartialSupported = partial.status === 200
    && s2after?.paid === true
    && Number(s2after?.paidAmount) === 2000000
    && (s2after?.enrollments || []).some((e) => e.learningAccess !== false && e.status !== 'refunded');
  record({
    id: 'REF-08',
    name: 'Partial refund (amount=500000) giữ paid + giảm paidAmount',
    expected: 'paid=true paidAmount=2000000 access giữ + ledger 500000',
    actual: `status=${partial.status} paid=${s2after?.paid} paidAmount=${s2after?.paidAmount} ledger=${partialLedger?.amount || 'none'} partial=${partial.json?.data?.partial} msg=${partial.json?.message || ''}`,
    result: isPartialSupported && Number(partialLedger?.amount) === 500000 ? 'PASS' : 'FAIL',
    severity: 'Critical',
    note: isPartialSupported ? '' : 'Partial refund chưa đúng nghiệp vụ',
  });

  // Over-refund after partial should 400
  await refreshCsrf();
  const over = await req('PUT', `/api/students/${s2._id}/refund`, {
    token: tok,
    body: { amount: 99999999, note: 'QA over' },
  });
  record({
    id: 'REF-09',
    name: 'Partial vượt paidAmount → 400',
    expected: '400',
    actual: `status=${over.status} msg=${over.json?.message || ''}`,
    result: over.status === 400 ? 'PASS' : 'FAIL',
    severity: 'High',
  });

  // Cleanup disposable
  await Student.deleteMany({ _id: { $in: [student._id, s2._id] } });
  if (invBefore?._id) await Invoice.deleteOne({ _id: invBefore._id }).catch(() => {});

  const pass = results.filter((r) => r.result === 'PASS').length;
  const fail = results.filter((r) => r.result === 'FAIL').length;
  const md = [
    '# QA Refund E2E Report',
    '',
    `**Date:** ${new Date().toISOString()}`,
    `**API:** ${BASE}`,
    `**Result:** PASS ${pass} · FAIL ${fail}`,
    '',
    ...results.map((r) => `- **[${r.result}]** \`${r.id}\` — ${r.name} — \`${r.actual}\`${r.note ? `\n  - Note: ${r.note}` : ''}`),
    '',
    '## Findings',
    '- Full refund + ledger + invoice preserve + double-refund guard: covered above.',
    '- Partial refund: nếu FAIL → cần API `amount` partial + cập nhật paidAmount/revenue (Critical before Production finance).',
    '',
  ].join('\n');
  fs.writeFileSync(OUT, md, 'utf8');
  console.log(`\nReport: ${OUT}`);
  console.log(`PASS ${pass} FAIL ${fail}`);

  await mongoose.disconnect();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  try { await mongoose.disconnect(); } catch { /* */ }
  process.exit(1);
});
