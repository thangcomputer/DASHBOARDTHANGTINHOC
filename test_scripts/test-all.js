const axios = require('axios');
const mongoose = require('mongoose');

async function runTests() {
  let adminToken = '';
  let studentToken = '';

  try {
    // 1. Get CSRF Token
    const csrfRes = await axios.get('http://localhost:5000/api/auth/csrf-token');
    const csrf = csrfRes.data.csrfToken;
    const cookie = csrfRes.headers['set-cookie'].join('; ');

    // 2. Login as Admin
    const adminLogin = await axios.post('http://localhost:5000/api/auth/login/internal', {
      identifier: 'admin2@test.com',
      password: 'password123'
    }, { headers: { 'X-CSRF-Token': csrf, Cookie: cookie } });
    adminToken = adminLogin.data.data.accessToken;
    console.log('✅ Admin login success');

    // 3. Login as Student (public login)
    const studentLogin = await axios.post('http://localhost:5000/api/auth/login/public', {
      identifier: 'student2@test.com',
      password: 'password123'
    }, { headers: { 'X-CSRF-Token': csrf, Cookie: cookie } });
    studentToken = studentLogin.data.data.accessToken;
    console.log('✅ Student login success');

    // 4. Test "thêm học viên" (create student)
    const newStudentRes = await axios.post('http://localhost:5000/api/students', {
      name: 'Test Create Student',
      email: 'testcreate@test.com',
      phone: '0987654321',
      zalo: '0987654321',
      price: 1500000,
      course: 'Test Course 2',
      branchCode: 'CN01'
    }, { headers: { Authorization: `Bearer ${adminToken}`, 'X-CSRF-Token': csrf, Cookie: cookie } });
    console.log('✅ Create student success:', newStudentRes.data.data.name);

    // 5. Test "thêm giảng viên" (create teacher via register-teacher?)
    try {
      const newTeacherRes = await axios.post('http://localhost:5000/api/teachers', {
        name: 'Test Create Teacher',
        email: 'testcreateteacher@test.com',
        phone: '0999888777'
      }, { headers: { Authorization: `Bearer ${adminToken}`, 'X-CSRF-Token': csrf, Cookie: cookie } });
      console.log('✅ Create teacher success');
    } catch (err) {
      console.error('❌ Create teacher failed:', err.response?.data || err.message);
    }

    // 6. Test "tài chính, doanh thu" (finance)
    const financeRes = await axios.get('http://localhost:5000/api/finance/revenue/summary', {
      headers: { Authorization: `Bearer ${adminToken}` } // GET doesn't strictly need CSRF but we can pass it
    });
    console.log('✅ Finance summary success:', financeRes.data.data ? 'ok' : 'empty');

    // 7. Test "tin nhắn" (messages)
    const messagesRes = await axios.get('http://localhost:5000/api/messages/groups/user/' + adminLogin.data.data.user._id, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    console.log('✅ Messages success:', messagesRes.data.data.length, 'groups');

  } catch (err) {
    console.error('Test failed at some step:', err.response?.data || err.message);
  }
}

runTests();
