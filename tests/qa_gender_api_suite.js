const fs = require('fs');
const axios = require('axios');
const path = require('path');

const API_URL = 'http://localhost:5000';
const dataPath = path.join(__dirname, 'qa_gender_data.json');
let testData;
try {
  testData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
} catch (err) {
  console.error('Không tìm thấy qa_gender_data.json');
  process.exit(1);
}

const testResults = [];
function addResult(module, func, result, severity, description) {
  testResults.push({ module, func, result, severity, description });
  console.log(`[${result === 'Passed' ? 'OK' : 'FAIL'}] ${module} - ${func}: ${description}`);
}

async function runTests() {
  console.log('🚀 Bắt đầu Gender Workflow API Testing...');
  try {
    // 1. Đăng nhập Super Admin
    const csrfRes = await axios.get(`${API_URL}/api/auth/csrf-token`);
    const csrfToken = csrfRes.data.csrfToken;
    const adminLoginRes = await axios.post(`${API_URL}/api/auth/login/internal`, {
      identifier: 'admin', password: testData.admin.password
    }, {
      headers: { 'Cookie': `csrf_token=${csrfToken}`, 'x-csrf-token': csrfToken }
    });
    
    if (!adminLoginRes.data.success) throw new Error('Đăng nhập Admin thất bại');
    const adminToken = adminLoginRes.data.data.accessToken;
    addResult('Auth', 'Admin Login', 'Passed', 'High', 'Đăng nhập Super Admin thành công');

    const headers = { Authorization: `Bearer ${adminToken}`, 'Cookie': `csrf_token=${csrfToken}`, 'x-csrf-token': csrfToken };

    const rolesToTest = [
      { key: 'teacher', name: 'Teacher', endpoint: `/api/teachers/${testData.teacher.id}` },
      { key: 'branchAdmin', name: 'Branch Admin', endpoint: `/api/teachers/${testData.branchAdmin.id}` },
      { key: 'employee', name: 'Employee', endpoint: `/api/teachers/${testData.employee.id}` },
      { key: 'support', name: 'Support Agent', endpoint: `/api/teachers/${testData.support.id}` },
      { key: 'student', name: 'Student', endpoint: `/api/students/${testData.student.id}` },
    ];

    for (const role of rolesToTest) {
      console.log(`\n--- Test cho Role: ${role.name} ---`);
      
      // Update to Nam
      let updateNam = await axios.put(`${API_URL}${role.endpoint}`, { gender: 'Nam' }, { headers });
      if (updateNam.data.success && updateNam.data.data.gender === 'Nam') {
        addResult('Gender Update', `${role.name} (Nam)`, 'Passed', 'High', 'Cập nhật giới tính Nam thành công');
      } else {
        console.error('Lỗi Update Nam:', updateNam.data);
        addResult('Gender Update', `${role.name} (Nam)`, 'Failed', 'High', 'Lỗi cập nhật giới tính Nam');
      }

      // Check Get API for Nam
      let getRes = await axios.get(`${API_URL}${role.endpoint}`, { headers });
      if (getRes.data.success && getRes.data.data.gender === 'Nam') {
        addResult('Gender Fetch', `${role.name} (Nam)`, 'Passed', 'High', 'Lấy dữ liệu trả về Nam thành công');
      } else {
        addResult('Gender Fetch', `${role.name} (Nam)`, 'Failed', 'High', 'Lấy dữ liệu trả về sai');
      }

      // Update to Nữ
      let updateNu = await axios.put(`${API_URL}${role.endpoint}`, { gender: 'Nữ' }, { headers });
      if (updateNu.data.success && updateNu.data.data.gender === 'Nữ') {
        addResult('Gender Update', `${role.name} (Nữ)`, 'Passed', 'High', 'Cập nhật giới tính Nữ thành công');
      } else {
        addResult('Gender Update', `${role.name} (Nữ)`, 'Failed', 'High', 'Lỗi cập nhật giới tính Nữ');
      }

      // Check Get API for Nữ
      getRes = await axios.get(`${API_URL}${role.endpoint}`, { headers });
      if (getRes.data.success && getRes.data.data.gender === 'Nữ') {
        addResult('Gender Fetch', `${role.name} (Nữ)`, 'Passed', 'High', 'Lấy dữ liệu trả về Nữ thành công');
      } else {
        addResult('Gender Fetch', `${role.name} (Nữ)`, 'Failed', 'High', 'Lấy dữ liệu trả về sai');
      }
    }

    // Check List API to see if it synchronizes
    console.log(`\n--- Kiểm tra List Sync ---`);
    const teacherListRes = await axios.get(`${API_URL}/api/teachers?limit=100`, { headers });
    if (teacherListRes.data.success) {
      const docs = teacherListRes.data.data.docs || teacherListRes.data.data;
      const isOk = docs.find(t => t._id === testData.teacher.id)?.gender === 'Nữ';
      addResult('List Sync', 'Teacher List', isOk ? 'Passed' : 'Failed', 'High', 'Danh sách GV trả về Nữ');
    }

    const studentListRes = await axios.get(`${API_URL}/api/students?limit=100`, { headers });
    if (studentListRes.data.success) {
      const docs = studentListRes.data.data.docs || studentListRes.data.data;
      const isOk = docs.find(s => s._id === testData.student.id)?.gender === 'Nữ';
      addResult('List Sync', 'Student List', isOk ? 'Passed' : 'Failed', 'High', 'Danh sách HV trả về Nữ');
    }

  } catch (err) {
    console.error('Lỗi API:', err.response ? err.response.data : err.message);
    addResult('API', 'Exception', 'Failed', 'High', err.message);
  }

  console.log('\n--- KẾT QUẢ API TEST (Gender Portal) ---');
  console.table(testResults);
}

runTests();
