/**
 * Local fullstack QA — doanh thu vào/ra + hủy khóa.
 * Usage: node scripts/_qa_local_finance_revenue_flow.cjs
 */
require('dotenv').config();
const http = require('http');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const BASE = process.env.QA_API_BASE || 'http://127.0.0.1:5000';
const PRICE_A = 2_500_000;
const PRICE_B = 1_500_000;
const results = [];

function ok(id, name, pass, actual) {
  results.push({ id, name, pass: !!pass, actual: String(actual) });
  console.log(`${pass ? '✅ PASS' : '❌ FAIL'}  ${id} — ${name}`);
  console.log(`         ${actual}`);
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
      {
        hostname: url.hostname,
        port: url.port || 80,
        path: url.pathname + url.search,
        method,
        headers,
        timeout: 30000,
      },
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
    r.on('error', (e) => resolve({ status: 0, json: { message: e.message } }));
    if (data) r.write(data);
    r.end();
  });
}

async function main() {
  console.log(`\n=== LOCAL FINANCE REVENUE FLOW @ ${BASE} ===\n`);

  await mongoose.connect(process.env.MONGODB_URI);
  const Student = require('../models/Student');
  const LedgerEntry = require('../models/LedgerEntry');
  const { sumFinancialRevenue, getStudentFinanceCard } = require('../services/ledgerService');

  const csrfRes = await req('GET', '/api/auth/csrf-token');
  const csrfToken = csrfRes.json?.csrfToken;
  const cookie = (csrfRes.headers['set-cookie'] || []).map((c) => c.split(';')[0]).join('; ');
  ok('BOOT-01', 'CSRF + API sống', csrfRes.status === 200 && !!csrfToken, `status=${csrfRes.status} csrf=${!!csrfToken}`);

  const token = jwt.sign(
    { id: 'admin', role: 'admin', name: 'Super Admin', adminRole: 'SUPER_ADMIN', aud: 'internal' },
    process.env.JWT_SECRET,
    { expiresIn: '45m' },
  );
  const mut = (method, p, body) => req(method, p, { token, body, cookie, csrfToken });
  const get = (p) => req('GET', p, { token, cookie, csrfToken });

  const snap0 = await sumFinancialRevenue({});
  console.log(`\n[SNAP0] global ledger payments=${snap0.payments} refunds=${snap0.refunds} net=${snap0.net}\n`);

  // ─── 1) Tạo HV đã thu khóa A ─────────────────────────────────────────────
  const phone = `097${String(Date.now()).slice(-7)}`;
  const create = await mut('POST', '/api/students', {
    name: `QA REV ${phone.slice(-6)}`,
    phone,
    zalo: phone,
    course: 'QA Excel Flow',
    price: PRICE_A,
    totalSessions: 20,
    paid: true,
    paymentMethod: 'cash',
    password: 'Test@123456',
  });
  const sid = create.json?.data?._id || create.json?.data?.id;
  ok('IN-01', 'POST student paid tạo được HV', create.status === 200 || create.status === 201, `status=${create.status} sid=${sid} msg=${create.json?.message || ''}`);

  if (!sid) {
    console.error('Abort: no student id');
    process.exit(1);
  }

  let st = await Student.findById(sid).lean();
  let pays = await LedgerEntry.find({ studentId: sid, type: 'payment', status: 'posted' }).lean();
  let refunds = await LedgerEntry.find({ studentId: sid, type: 'refund', status: 'posted' }).lean();
  const paySum = pays.reduce((s, e) => s + Number(e.amount || 0), 0);

  ok('IN-02', 'Ledger có PAYMENT = giá khóa A', pays.length >= 1 && paySum === PRICE_A,
    `payments=${pays.length} sum=${paySum} expect=${PRICE_A}`);
  ok('IN-03', 'Student.paid=true sau thu', st?.paid === true, `paid=${st?.paid}`);

  let card = await getStudentFinanceCard(sid);
  ok('IN-04', 'Card: Đã TT = khóa active, Net = PRICE_A',
    card.paidCashIn === PRICE_A && card.netCollected === PRICE_A && card.outstanding === 0,
    `paidCashIn=${card.paidCashIn} net=${card.netCollected} outstanding=${card.outstanding} registered=${card.registeredFee}`);

  const sum1 = await get('/api/finance/summary');
  const net1 = Number(sum1.json?.data?.net);
  ok('IN-05', 'GET /finance/summary phản hồi OK', sum1.status === 200 && sum1.json?.success,
    `status=${sum1.status} net=${net1} payments=${sum1.json?.data?.payments}`);

  // ─── 2) Thêm khóa B + thu ────────────────────────────────────────────────
  const addB = await mut('POST', `/api/students/${sid}/enrollments`, {
    courseName: 'QA PowerPoint Flow',
    price: PRICE_B,
    totalSessions: 12,
    paid: true,
    paymentMethod: 'cash',
  });
  st = await Student.findById(sid).lean();
  const enrB = (st.enrollments || []).find((e) => String(e.courseName).includes('PowerPoint'));
  pays = await LedgerEntry.find({ studentId: sid, type: 'payment', status: 'posted' }).lean();
  const paySum2 = pays.reduce((s, e) => s + Number(e.amount || 0), 0);

  ok('IN-06', 'Thêm khóa B + thu → 2 PAYMENT, tổng A+B',
    (addB.status === 200 || addB.status === 201) && !!enrB && paySum2 === PRICE_A + PRICE_B,
    `status=${addB.status} enrB=${!!enrB} paySum=${paySum2} expect=${PRICE_A + PRICE_B}`);

  card = await getStudentFinanceCard(sid);
  ok('IN-07', 'Card sau 2 khóa: registered=A+B, paid=A+B, net=A+B',
    card.registeredFee === PRICE_A + PRICE_B
      && card.paidCashIn === PRICE_A + PRICE_B
      && card.netCollected === PRICE_A + PRICE_B,
    `reg=${card.registeredFee} paid=${card.paidCashIn} net=${card.netCollected}`);

  const netAfterIn = (await sumFinancialRevenue({ studentId: sid })).net;
  ok('IN-08', 'Doanh thu thuần HV tăng đúng A+B',
    netAfterIn === PRICE_A + PRICE_B,
    `net=${netAfterIn}`);

  // ─── 3) Hủy khóa A + hoàn đủ (khi còn B active) → net TỤT đúng ───────────
  const enrA = (st.enrollments || []).find((e) => e.status !== 'cancelled' && String(e.courseName).includes('Excel'));
  const enrAId = String(enrA?._id || '');
  ok('OUT-05', 'Có enrollment A để hủy hoàn (còn B active)', !!enrAId && !!enrB, `enrAId=${enrAId}`);

  const cancelAFull = await mut('DELETE', `/api/students/${sid}/enrollments/${enrAId}`, {
    cancelReason: 'QA hủy hoàn đủ',
    refundAmount: PRICE_A,
  });
  st = await Student.findById(sid).lean();
  const enrAAfter = (st.enrollments || []).find((e) => String(e._id) === enrAId);
  refunds = await LedgerEntry.find({ studentId: sid, type: 'refund', status: 'posted' }).lean();
  const refundSum = refunds.reduce((s, e) => s + Number(e.amount || 0), 0);
  const netAfterRefund = (await sumFinancialRevenue({ studentId: sid })).net;
  card = await getStudentFinanceCard(sid);

  ok('OUT-06', 'Hủy A + hoàn đủ → REFUND ledger = PRICE_A',
    cancelAFull.status === 200 && refundSum === PRICE_A && Number(enrAAfter?.refundedAmount) === PRICE_A,
    `api=${cancelAFull.status} refundSum=${refundSum} enrRefunded=${enrAAfter?.refundedAmount} msg=${cancelAFull.json?.message}`);

  ok('OUT-07', 'Doanh thu thuần TỤT đúng số hoàn → còn PRICE_B',
    netAfterRefund === PRICE_B,
    `net=${netAfterRefund} expect=${PRICE_B} (= A+B − hoàn A)`);

  ok('OUT-08', 'Card: Đã TT = B, active=B, net=B',
    card.paidCashIn === PRICE_B
      && card.activeCourseValue === PRICE_B
      && card.netCollected === PRICE_B,
    `paidCashIn=${card.paidCashIn} active=${card.activeCourseValue} net=${card.netCollected}`);

  // ─── 4) Hủy khóa B, hoàn = 0 → net KHÔNG tụt thêm ─────────────────────────
  const enrBId = String(enrB._id);
  // Không thể hủy khóa active cuối → thêm khóa C placeholder rồi hủy B hoàn 0
  const addC = await mut('POST', `/api/students/${sid}/enrollments`, {
    courseName: 'QA Keep Active Flow',
    price: 100000,
    totalSessions: 4,
    paid: false,
  });
  st = await Student.findById(sid).lean();
  const enrC = (st.enrollments || []).find((e) => String(e.courseName).includes('Keep Active'));
  ok('OUT-08b', 'Thêm khóa C (chưa thu) để còn 1 khóa active khi hủy B',
    (addC.status === 200 || addC.status === 201) && !!enrC,
    `status=${addC.status} enrC=${!!enrC}`);

  const cancelB0 = await mut('DELETE', `/api/students/${sid}/enrollments/${enrBId}`, {
    cancelReason: 'QA hủy không hoàn',
    refundAmount: 0,
  });
  st = await Student.findById(sid).lean();
  const enrBAfter = (st.enrollments || []).find((e) => String(e._id) === enrBId);
  const refundsAfterB = await LedgerEntry.find({ studentId: sid, type: 'refund', status: 'posted' }).lean();
  const netAfterCancel0 = (await sumFinancialRevenue({ studentId: sid })).net;
  card = await getStudentFinanceCard(sid);

  ok('OUT-01', 'Hủy B hoàn 0 → cancelled, paid=false, refunded=0',
    cancelB0.status === 200
      && enrBAfter?.status === 'cancelled'
      && enrBAfter?.paid === false
      && Number(enrBAfter?.refundedAmount || 0) === 0,
    `api=${cancelB0.status} status=${enrBAfter?.status} paid=${enrBAfter?.paid} refunded=${enrBAfter?.refundedAmount}`);

  ok('OUT-02', 'Hủy không hoàn → không thêm REFUND (vẫn 1 dòng hoàn A)',
    refundsAfterB.length === 1,
    `refundCount=${refundsAfterB.length}`);

  ok('OUT-03', 'Doanh thu thuần KHÔNG tụt thêm khi hủy B hoàn 0',
    netAfterCancel0 === PRICE_B,
    `net=${netAfterCancel0} expect=${PRICE_B}`);

  ok('OUT-04', 'Card Đã TT = 0 (không còn khóa active đã thu), net ledger vẫn B',
    card.paidCashIn === 0 && card.netCollected === PRICE_B,
    `paidCashIn=${card.paidCashIn} netLedger=${card.netCollected} active=${card.activeCourseValue}`);

  // ─── 4b) Đăng ký lại khóa A (đã hủy) + thu → phải có PAYMENT mới, net = A+B ─
  const reAddA = await mut('POST', `/api/students/${sid}/enrollments`, {
    courseName: 'QA Excel Flow',
    price: PRICE_A,
    totalSessions: 12,
    paid: true,
    paymentMethod: 'cash',
  });
  st = await Student.findById(sid).lean();
  const enrA2 = (st.enrollments || []).find(
    (e) => e.status !== 'cancelled' && String(e.courseName).includes('Excel'),
  );
  pays = await LedgerEntry.find({ studentId: sid, type: 'payment', status: 'posted' }).lean();
  const paySumRe = pays.reduce((s, e) => s + Number(e.amount || 0), 0);
  const payForA2 = pays.filter((p) => String(p.enrollmentId || '') === String(enrA2?._id || ''));
  const netAfterRe = (await sumFinancialRevenue({ studentId: sid })).net;
  card = await getStudentFinanceCard(sid);

  ok('RE-01', 'Đăng ký lại Excel + thu → API OK + enrollment active',
    (reAddA.status === 200 || reAddA.status === 201) && !!enrA2 && enrA2.paid === true,
    `status=${reAddA.status} enrA2=${!!enrA2} paid=${enrA2?.paid}`);

  ok('RE-02', 'Có PAYMENT gắn đúng enrollmentId khóa mới (không nuốt vào payment cũ)',
    payForA2.length >= 1 && Number(payForA2[0].amount) === PRICE_A,
    `payForA2=${payForA2.length} amount=${payForA2[0]?.amount} paySum=${paySumRe}`);

  ok('RE-03', 'Net ledger = B (còn lại sau hoàn A) + A (đăng ký lại) = A+B',
    netAfterRe === PRICE_A + PRICE_B,
    `net=${netAfterRe} expect=${PRICE_A + PRICE_B}`);

  ok('RE-04', 'Card: Đã TT = A (khóa đăng ký lại); net = A+B; còn đóng = giá C chưa thu',
    card.paidCashIn === PRICE_A
      && card.netCollected === PRICE_A + PRICE_B
      && card.outstanding === 100000,
    `paidCashIn=${card.paidCashIn} net=${card.netCollected} outstanding=${card.outstanding} active=${card.activeCourseValue}`);

  // ─── 5) Double-cancel A ──────────────────────────────────────────────────
  const cancelAgain = await mut('DELETE', `/api/students/${sid}/enrollments/${enrAId}`, {
    cancelReason: 'double',
    refundAmount: PRICE_A,
  });
  const refunds2 = await LedgerEntry.find({ studentId: sid, type: 'refund', status: 'posted' }).lean();
  ok('OUT-09', 'Hủy lại khóa đã cancelled → fail, không double REFUND',
    cancelAgain.status >= 400 && refunds2.length === refundsAfterB.length,
    `status=${cancelAgain.status} refunds=${refunds2.length}`);

  // ─── 6) API finance card vs ledger ───────────────────────────────────────
  const apiCard = await get(`/api/finance/students/${sid}`);
  ok('API-01', 'GET /finance/students/:id khớp net PRICE_B',
    apiCard.status === 200 && Number(apiCard.json?.data?.netCollected) === PRICE_B,
    `status=${apiCard.status} net=${apiCard.json?.data?.netCollected}`);

  const ledgerApi = await get(`/api/finance/ledger?studentId=${sid}&limit=20`);
  const lines = ledgerApi.json?.data?.items || [];
  const apiPay = lines.filter((l) => l.type === 'payment').length;
  const apiRef = lines.filter((l) => l.type === 'refund').length;
  ok('API-02', 'GET /finance/ledger có đủ payment + refund',
    ledgerApi.status === 200 && apiPay >= 2 && apiRef >= 1,
    `status=${ledgerApi.status} payments=${apiPay} refunds=${apiRef}`);

  // cleanup
  try {
    await mut('DELETE', `/api/students/${sid}`);
  } catch { /* ignore */ }
  // hard cleanup leftover
  await Student.deleteOne({ _id: sid });
  await LedgerEntry.deleteMany({ studentId: sid });

  await mongoose.disconnect();

  const fail = results.filter((r) => !r.pass).length;
  const pass = results.length - fail;
  console.log(`\n=== KẾT QUẢ: PASS ${pass}/${results.length} · FAIL ${fail} ===\n`);
  if (fail) {
    console.log('Các case FAIL:');
    results.filter((r) => !r.pass).forEach((r) => console.log(` - ${r.id}: ${r.name} | ${r.actual}`));
  } else {
    console.log('Logic doanh thu vào/ra + hủy khóa: ĐÚNG trên local.');
  }
  process.exit(fail ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
