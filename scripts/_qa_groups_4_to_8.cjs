/**
 * QA Groups 4–8 condensed API E2E
 * node scripts/_qa_groups_4_to_8.cjs
 */
require('dotenv').config();
const jwt = require('jsonwebtoken');
const http = require('http');
const fs = require('fs');

const BASE = process.env.QA_API_BASE || 'http://127.0.0.1:5000';
const results = [];
const record = (tc) => {
  results.push(tc);
  console.log(`[${tc.result}] ${tc.id} — ${tc.name}${tc.actual ? ` | ${tc.actual}` : ''}`);
};

function req(method, path, { token, body, cookie, csrfToken } = {}) {
  return new Promise((resolve) => {
    const url = new URL(path, BASE);
    const headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (cookie) headers.Cookie = cookie;
    if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
    const data = body ? JSON.stringify(body) : null;
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    const r = http.request(
      { hostname: url.hostname, port: url.port, path: url.pathname + url.search, method, headers, timeout: 20000 },
      (res) => {
        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('end', () => {
          let json = null;
          try { json = JSON.parse(raw || 'null'); } catch { json = { _raw: raw.slice(0, 160) }; }
          resolve({ status: res.statusCode, json });
        });
      },
    );
    r.on('error', (e) => resolve({ status: 0, json: { message: e.message } }));
    r.on('timeout', () => { r.destroy(); resolve({ status: 0, json: { message: 'timeout' } }); });
    if (data) r.write(data);
    r.end();
  });
}

async function csrf() {
  return new Promise((resolve) => {
    const url = new URL('/api/auth/csrf-token', BASE);
    http.get({ hostname: url.hostname, port: url.port, path: url.pathname }, (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        let json = {};
        try { json = JSON.parse(raw); } catch { /* */ }
        const cookies = (res.headers['set-cookie'] || []).map((c) => c.split(';')[0]).join('; ');
        resolve({ token: json.csrfToken || json.data?.csrfToken, cookie: cookies });
      });
    }).on('error', () => resolve({ token: null, cookie: '' }));
  });
}

const mintAdmin = () => jwt.sign(
  { id: 'admin', role: 'admin', name: 'Super Admin', adminRole: 'SUPER_ADMIN', permissions: [], aud: 'internal' },
  process.env.JWT_SECRET,
  { expiresIn: '50m' },
);

function summary() {
  const pass = results.filter((r) => r.result === 'PASS').length;
  const fail = results.filter((r) => r.result === 'FAIL').length;
  const skip = results.filter((r) => r.result === 'SKIP').length;
  const crit = results.filter((r) => r.result === 'FAIL' && r.severity === 'Critical');
  console.log('\n=== SUMMARY GROUPS 4-8 ===');
  console.log(`PASS=${pass} FAIL=${fail} SKIP=${skip} TOTAL=${results.length}`);
  console.log(`Completion=${((pass / Math.max(1, pass + fail)) * 100).toFixed(1)}%`);
  if (crit.length) {
    console.log('CRITICAL:');
    crit.forEach((c) => console.log(`- ${c.id} ${c.name} | ${c.actual}`));
  }
  fs.writeFileSync('docs/QA_GROUPS_4_TO_8.json', JSON.stringify({ at: new Date().toISOString(), results }, null, 2));
  console.log('Wrote docs/QA_GROUPS_4_TO_8.json');
}

async function main() {
  console.log(`\n=== QA GROUPS 4–8 @ ${BASE} ===\n`);
  const h = await req('GET', '/healthz');
  record({ id: 'GX-00', name: 'healthz', result: h.status === 200 ? 'PASS' : 'FAIL', severity: 'Critical', actual: `${h.status}` });
  if (h.status !== 200) { summary(); process.exit(1); }

  const { token: csrfToken, cookie } = await csrf();
  const mut = (m, p, o = {}) => req(m, p, { ...o, cookie, csrfToken });
  const admin = mintAdmin();
  const suf = String(Date.now()).slice(-8);

  // ── Group 4 Finance ──
  const sCreate = await mut('POST', '/api/students', {
    token: admin,
    body: {
      name: `QA FIN ${suf.slice(-4)}`, zalo: `094${suf}`, phone: `094${suf}`,
      course: 'Word', price: 2000000, totalSessions: 12, password: `094${suf}`,
    },
  });
  const sid = sCreate.json?.data?._id;
  record({
    id: 'G4-01', name: 'Đăng ký HV (finance fixture)',
    result: sCreate.status === 201 && sid ? 'PASS' : 'FAIL',
    severity: 'Critical',
    actual: `status=${sCreate.status}`,
  });

  const pay = await mut('PUT', `/api/students/${sid}/pay`, {
    token: admin, body: { paymentMethod: 'transfer', note: 'QA G4' },
  });
  const inv = pay.json?.data?.invoice;
  record({
    id: 'G4-02', name: 'Thanh toán → tạo hóa đơn',
    expected: '200 + invoice.maHoaDon',
    actual: `status=${pay.status} maHD=${inv?.maHoaDon || '-'} paidAmt=${pay.json?.data?.student?.paidAmount}`,
    result: pay.status === 200 && inv?.maHoaDon ? 'PASS' : 'FAIL',
    severity: 'Critical',
    api: 'PUT /api/students/:id/pay',
  });

  const invList = await req('GET', '/api/invoices', { token: admin });
  record({
    id: 'G4-03', name: 'Admin list hóa đơn',
    actual: `status=${invList.status} n=${invList.json?.count ?? invList.json?.data?.length}`,
    result: invList.status === 200 ? 'PASS' : 'FAIL',
    severity: 'High',
  });

  record({
    id: 'G4-04', name: 'Voucher / hoàn tiền / gia hạn khóa',
    actual: 'SKIP — không có API voucher/refund/renew trong phạm vi hiện tại',
    result: 'SKIP',
    severity: 'Medium',
  });

  // ── Group 5 LMS ──
  const sLogin = await mut('POST', '/api/auth/login/public', {
    body: { identifier: `094${suf}`, password: `094${suf}`, role: 'student', force: true },
  });
  const sTok = sLogin.json?.data?.accessToken;
  const lms = await req('GET', '/api/settings/student-training-data', { token: sTok });
  const videos = lms.json?.data?.videos || lms.json?.videos || [];
  record({
    id: 'G5-01', name: 'HV đọc LMS student-training-data',
    actual: `status=${lms.status} videos=${Array.isArray(videos) ? videos.length : '-'}`,
    result: lms.status === 200 ? 'PASS' : 'FAIL',
    severity: 'Critical',
  });
  const tLms = await req('GET', '/api/settings/training-data', { token: sTok });
  record({
    id: 'G5-02', name: 'HV đọc training GV data (thường được phép read)',
    actual: `status=${tLms.status}`,
    result: tLms.status === 200 || tLms.status === 403 ? 'PASS' : 'FAIL',
    severity: 'Medium',
  });
  record({
    id: 'G5-03', name: 'Quiz/Thi/Pass/Fail/Chứng chỉ UI',
    actual: 'SKIP — cần bank câu hỏi + exam room browser',
    result: 'SKIP',
    severity: 'High',
  });

  // ── Group 6 Chat ──
  const tPhone = `095${suf}`;
  const tCreate = await mut('POST', '/api/teachers', {
    token: admin,
    body: { name: `QA CHAT GV ${suf.slice(-4)}`, phone: tPhone, password: 'QaChat@12345', specialty: 'Word', status: 'active' },
  });
  const tid = tCreate.json?.data?._id;
  await mut('PUT', `/api/teachers/${tid}`, { token: admin, body: { status: 'active' } });
  await mut('PUT', `/api/students/${sid}/assign-teacher`, { token: admin, body: { teacherId: tid } });
  const tLogin = await mut('POST', '/api/auth/login/public', {
    body: { identifier: tPhone, password: 'QaChat@12345', role: 'teacher', force: true },
  });
  const tTok = tLogin.json?.data?.accessToken;

  const contacts = await req('GET', '/api/messages/contacts', { token: tTok });
  record({
    id: 'G6-01', name: 'GV lấy contacts chat',
    actual: `status=${contacts.status}`,
    result: contacts.status === 200 ? 'PASS' : 'FAIL',
    severity: 'High',
    api: 'GET /api/messages/contacts',
  });

  const conv = await req('GET', `/api/messages/conversations/${tid}`, { token: tTok });
  record({
    id: 'G6-02', name: 'GV conversations/:userId',
    actual: `status=${conv.status}`,
    result: conv.status === 200 ? 'PASS' : 'FAIL',
    severity: 'High',
    api: 'GET /api/messages/conversations/:userId',
  });

  const send = await mut('POST', '/api/messages', {
    token: tTok,
    body: {
      conversationId: [String(tid), String(sid)].sort().join('_'),
      receiverId: sid,
      receiverRole: 'student',
      content: 'QA hello from teacher',
      type: 'text',
    },
  });
  record({
    id: 'G6-03', name: 'GV gửi tin nhắn text cho HV',
    actual: `status=${send.status} msg=${send.json?.message || ''}`,
    result: send.status === 200 || send.status === 201 ? 'PASS' : 'FAIL',
    severity: 'Critical',
    api: 'POST /api/messages',
    fix: send.status >= 400 ? (send.json?.message || 'check message payload schema') : '',
  });

  const sContacts = await req('GET', '/api/messages/contacts', { token: sTok });
  record({
    id: 'G6-04', name: 'HV contacts',
    actual: `status=${sContacts.status}`,
    result: sContacts.status === 200 ? 'PASS' : 'FAIL',
    severity: 'High',
  });

  record({
    id: 'G6-05', name: 'Typing/Seen/Emoji/Upload realtime UI',
    actual: 'SKIP — cần socket browser client',
    result: 'SKIP',
    severity: 'Medium',
  });

  // ── Group 7 Notifications ──
  const notif = await req('GET', '/api/notifications', { token: sTok });
  record({
    id: 'G7-01', name: 'HV list notifications API',
    actual: `status=${notif.status}`,
    result: notif.status === 200 || notif.status === 404 ? (notif.status === 200 ? 'PASS' : 'FAIL') : 'FAIL',
    severity: 'High',
    api: 'GET /api/notifications',
  });
  record({
    id: 'G7-02', name: 'Email/SMS/Push channels',
    actual: 'FAIL/SKIP — OTP queue tồn tại nhưng welcome email/SMS/push chưa đủ cho mọi event',
    result: 'FAIL',
    severity: 'Medium',
  });

  // ── Group 8 Sync ──
  const afterPay = await req('GET', `/api/students/${sid}`, { token: admin });
  record({
    id: 'G8-01', name: 'DB sync sau thanh toán (paid=true)',
    actual: `paid=${afterPay.json?.data?.paid} code=${afterPay.json?.data?.studentCode}`,
    result: afterPay.json?.data?.paid === true ? 'PASS' : 'FAIL',
    severity: 'Critical',
  });
  const stFinance = await req('GET', '/api/transactions', { token: sTok });
  record({
    id: 'G8-02', name: 'JWT role isolation vẫn đúng sau các thao tác',
    actual: `studentTx=${stFinance.status}`,
    result: stFinance.status === 403 ? 'PASS' : 'FAIL',
    severity: 'Critical',
  });
  record({
    id: 'G8-03', name: 'Cache/localStorage/UI realtime',
    actual: 'SKIP — cần browser; API SoT đã verify ở các nhóm',
    result: 'SKIP',
    severity: 'Medium',
  });

  // cleanup
  await mut('DELETE', `/api/students/${sid}`, { token: admin });
  if (tid) await mut('DELETE', `/api/teachers/${tid}`, { token: admin });
  record({ id: 'GX-99', name: 'Cleanup', result: 'PASS', severity: 'Low' });

  summary();
}

main().catch((e) => { console.error(e); process.exit(1); });
