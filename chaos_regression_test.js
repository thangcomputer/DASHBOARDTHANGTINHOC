const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

async function runTests() {
  const secret = 'thangTinHoc_secret_key_2026';
  const token = jwt.sign({
    id: '6a757fd8d792949f55834fc0',
    username: 'super_admin_test',
    role: 'admin',
    adminRole: 'SUPER_ADMIN',
    permissions: ['manage_students'],
    aud: 'internal'
  }, secret, { expiresIn: '1h' });
  const dummyToken = 'dummy_csrf_token_for_test';

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'x-csrf-token': dummyToken,
    'Cookie': `csrf_token=${dummyToken}`
  };

  const getStudentPayload = (suffix) => ({
    name: `Test CQRS User ${suffix}`,
    phone: `09${Math.floor(Math.random() * 100000000)}`,
    zalo: `09${Math.floor(Math.random() * 100000000)}`,
    email: `test${suffix}@example.com`,
    course: 'Khoa Hoc Test',
    price: 5000000,
    paid: true,
    paidAmount: 5000000,
    isPaidOnCreate: true, 
    paymentMethod: 'transfer',
    age: 20
  });

  // DB Connection
  await mongoose.connect('mongodb://127.0.0.1:27018/dashboardthangtinhoc?replicaSet=rs0');
  const Student = require('./models/Student');
  const Invoice = require('./models/Invoice');
  const LedgerEntry = require('./models/LedgerEntry');
  const OutboxEvent = require('./shared/outbox/OutboxEvent');

  console.log('--- PHASE 2 & 3: HAPPY PATH & ATOMICITY ---');
  let p = getStudentPayload('HappyPath');
  let res = await fetch('http://localhost:5000/api/students', {
    method: 'POST', headers, body: JSON.stringify(p)
  });
  let data = await res.json();
  console.log('HTTP Status:', res.status);
  console.log('Response Body:', data);
  if (data.success) {
    const sId = data.data._id;
    const s = await Student.findById(sId);
    const i = await Invoice.findOne({ hocVien: sId });
    const l = await LedgerEntry.findOne({ studentId: sId });
    const o = await OutboxEvent.findOne({ aggregateId: sId });
    console.log(`DB Verification -> Student: ${!!s}, Invoice: ${!!i}, Ledger: ${!!l}, Outbox: ${!!o}`);
  }

  console.log('\n--- PHASE 4: ROLLBACK ---');
  let p2 = getStudentPayload('Rollback');
  p2.price = "invalid_price_to_force_failure";
  let res2 = await fetch('http://localhost:5000/api/students', {
    method: 'POST', headers, body: JSON.stringify(p2)
  });
  console.log('HTTP Status:', res2.status);
  const s2 = await Student.findOne({ phone: p2.phone });
  const o2 = await OutboxEvent.findOne({ 'payload.phone': p2.phone });
  console.log(`DB Verification -> Student persisted: ${!!s2}, Outbox persisted: ${!!o2}`);

  console.log('\n--- PHASE 5: DUPLICATE ---');
  let p3 = getStudentPayload('Duplicate');
  let res3 = await fetch('http://localhost:5000/api/students', {
    method: 'POST', headers, body: JSON.stringify(p3)
  });
  console.log('First HTTP Status:', res3.status);
  let res4 = await fetch('http://localhost:5000/api/students', {
    method: 'POST', headers, body: JSON.stringify(p3) // Same payload
  });
  console.log('Second HTTP Status:', res4.status);
  const data4 = await res4.json();
  console.log('Second Response:', data4.message);

  console.log('\n--- PHASE 6: CONCURRENCY ---');
  let p4 = getStudentPayload('Concurrency');
  let promises = [];
  for (let i = 0; i < 10; i++) {
    promises.push(fetch('http://localhost:5000/api/students', {
      method: 'POST', headers, body: JSON.stringify(p4)
    }));
  }
  let results = await Promise.all(promises);
  let statuses = results.map(r => r.status);
  console.log('Concurrency Statuses:', statuses);

  console.log('\n--- PHASE 7: TENANT/BRANCH ISOLATION ---');
  // Creating a token for a STAFF member bound to a specific branch
  const staffToken = jwt.sign({
    id: 'staff123',
    username: 'staff_test',
    role: 'staff',
    branchId: '6a757fd8d792949f55834fcc', // Some branch
    permissions: ['manage_students'],
    aud: 'internal'
  }, secret, { expiresIn: '1h' });
  let p5 = getStudentPayload('StaffBranchTest');
  let res5 = await fetch('http://localhost:5000/api/students', {
    method: 'POST',
    headers: { ...headers, 'Authorization': `Bearer ${staffToken}` },
    body: JSON.stringify(p5)
  });
  let data5 = await res5.json();
  console.log('Staff HTTP Status:', res5.status);
  if (data5.success) {
    console.log('Assigned BranchId:', data5.data.branchId);
  }

  process.exit(0);
}
runTests();
