/**
 * Regression: soft-delete course + ledger pay + partial/full refund
 * Usage: node scripts/_qa_critical_finance_course.cjs
 */
require('dotenv').config();
const http = require('http');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const BASE = process.env.QA_API_BASE || 'http://127.0.0.1:5000';
const out = [];

function record(id, name, pass, actual) {
  out.push({ id, name, result: pass ? 'PASS' : 'FAIL', actual });
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${id} — ${name} | ${actual}`);
}

function req(method, urlPath, { token, body, cookie, csrfToken } = {}) {
  return new Promise((resolve) => {
    const url = new URL(urlPath, BASE);
    const headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (cookie) headers.Cookie = cookie;
    if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
    const data = body !== undefined ? JSON.stringify(body) : null;
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    const r = http.request(
      { hostname: url.hostname, port: url.port, path: url.pathname + url.search, method, headers, timeout: 20000 },
      (res) => {
        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('end', () => {
          let json = null;
          try { json = raw ? JSON.parse(raw) : null; } catch { json = { _raw: raw.slice(0, 200) }; }
          resolve({ status: res.statusCode, json, headers: res.headers });
        });
      },
    );
    r.on('error', (e) => resolve({ status: 0, json: { message: e.message } }));
    if (data) r.write(data);
    r.end();
  });
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Course = require('../models/Course');
  const Student = require('../models/Student');
  const LedgerEntry = require('../models/LedgerEntry');
  const Invoice = require('../models/Invoice');
  const AuditLog = require('../models/AuditLog');

  const csrfRes = await req('GET', '/api/auth/csrf-token');
  const csrfToken = csrfRes.json?.csrfToken;
  const cookie = (csrfRes.headers['set-cookie'] || []).map((c) => c.split(';')[0]).join('; ');
  const token = jwt.sign(
    { id: 'admin', role: 'admin', name: 'Super Admin', adminRole: 'SUPER_ADMIN', aud: 'internal' },
    process.env.JWT_SECRET,
    { expiresIn: '30m' },
  );
  const mut = (method, p, body) => req(method, p, { token, body, cookie, csrfToken });

  // Soft-delete
  const name = `QA SoftDel ${Date.now()}`;
  const created = await mut('POST', '/api/courses', {
    name, price: 111000, totalSessions: 4, category: 'khac', status: 'published',
  });
  const courseId = created.json?.data?._id;
  const del = await mut('DELETE', `/api/courses/${courseId}`);
  const doc = await Course.findById(courseId).lean();
  const list = await req('GET', '/api/courses');
  const stillInList = (list.json?.data || []).some((c) => String(c._id) === String(courseId));
  record('COURSE-01', 'Soft-delete keeps doc + hides catalog',
    del.status === 200 && !!doc?.deletedAt && doc.status === 'archived' && !stillInList,
    `api=${del.status} deletedAt=${doc?.deletedAt} status=${doc?.status} inList=${stillInList}`);

  const ledgerBefore = await LedgerEntry.countDocuments();

  // Pay + ledger
  const phone = `0968${String(Date.now()).slice(-7)}`;
  const st = await mut('POST', '/api/students', {
    name: `QA FIN ${phone.slice(-6)}`,
    phone,
    zalo: phone,
    course: 'Excel MOS',
    price: 2500000,
    totalSessions: 20,
    password: 'Test@123456',
  });
  const sid = st.json?.data?._id;
  const pay = await mut('PUT', `/api/students/${sid}/pay`, { note: 'qa pay' });
  const afterPay = await Student.findById(sid).lean();
  const payLedger = await LedgerEntry.find({ studentId: sid, type: 'payment' }).lean();
  const invBefore = await Invoice.countDocuments({ hocVien: sid });
  record('PAY-01', 'Pay creates ledger payment',
    pay.status === 200 && afterPay?.paid === true && payLedger.length >= 1,
    `status=${pay.status} paid=${afterPay?.paid} ledger=${payLedger.length} amt=${payLedger[0]?.amount}`);

  // Partial refund
  const partial = await mut('PUT', `/api/students/${sid}/refund`, { amount: 500000, note: 'qa partial' });
  const afterPartial = await Student.findById(sid).lean();
  const refundPartial = await LedgerEntry.find({ studentId: sid, type: 'refund' }).lean();
  record('PAY-REF-01', 'Partial refund 500k keeps paid',
    partial.status === 200
      && afterPartial?.paid === true
      && Number(afterPartial?.paidAmount) === 2000000
      && refundPartial.some((r) => Number(r.amount) === 500000)
      && partial.json?.data?.partial === true,
    `status=${partial.status} paid=${afterPartial?.paid} paidAmount=${afterPartial?.paidAmount} ledgerRefunds=${refundPartial.map((r) => r.amount).join(',')} msg=${partial.json?.message}`);

  // Over-refund
  const over = await mut('PUT', `/api/students/${sid}/refund`, { amount: 99999999 });
  record('PAY-REF-09', 'Over-refund rejected 400',
    over.status === 400,
    `status=${over.status} msg=${over.json?.message}`);

  // Full refund remaining
  const invMid = await Invoice.countDocuments({ hocVien: sid });
  const full = await mut('PUT', `/api/students/${sid}/refund`, { note: 'qa full' });
  const afterFull = await Student.findById(sid).lean();
  const invAfter = await Invoice.countDocuments({ hocVien: sid });
  const refunds = await LedgerEntry.find({ studentId: sid, type: 'refund' }).lean();
  const audit = await AuditLog.find({ action: 'payment.refund', studentId: sid }).lean();
  record('PAY-REF-02', 'Full refund + invoice preserved + ledger',
    full.status === 200 && afterFull?.paid === false && invAfter === invMid && invAfter >= 1 && refunds.length >= 2 && audit.length >= 1,
    `status=${full.status} paid=${afterFull?.paid} inv=${invBefore}->${invAfter} refunds=${refunds.length} audit=${audit.length}`);

  // Soft-delete không đổi ledger count (aside from our own pay/refund)
  const ledgerAfterCourseDelete = await LedgerEntry.countDocuments();
  record('COURSE-LEDGER', 'Course soft-delete không xóa ledger',
    ledgerAfterCourseDelete >= ledgerBefore + payLedger.length,
    `before=${ledgerBefore} after=${ledgerAfterCourseDelete}`);

  // Double refund
  const again = await mut('PUT', `/api/students/${sid}/refund`, { note: 'again' });
  record('PAY-REF-07', 'Double refund 409',
    again.status === 409,
    `status=${again.status} msg=${again.json?.message}`);

  // cleanup
  await mut('DELETE', `/api/students/${sid}`);
  // keep soft-deleted course for evidence or restore+delete
  await Course.deleteOne({ _id: courseId }); // test cleanup only

  await mongoose.disconnect();
  const fail = out.filter((x) => x.result === 'FAIL').length;
  console.log(`\n=== Critical finance/course: PASS ${out.length - fail} FAIL ${fail} ===`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
