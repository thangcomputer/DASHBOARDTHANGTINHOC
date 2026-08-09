const fs = require('fs');
const axios = require('axios');
const path = require('path');

const API_URL = 'http://localhost:5000';
const dataPath = path.join(__dirname, 'qa_branch_data.json');
let testData;
try {
  testData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
} catch (err) {
  console.error('Không tìm thấy qa_branch_data.json, hãy chạy seed_branch_qa.js trước.');
  process.exit(1);
}

const testResults = [];

function addResult(module, func, result, severity, description) {
  testResults.push({ module, func, result, severity, description });
  console.log(`[${result === 'Passed' ? 'OK' : 'FAIL'}] ${module} - ${func}: ${description}`);
}

async function runApiTests() {
  console.log('🚀 Bắt đầu API Security & Isolation Testing...');
  
  let token = '';
  // 1. Đăng nhập qua cổng nội bộ (Admin/Staff)
  try {
    // A. Lấy CSRF Token
    const csrfRes = await axios.get(`${API_URL}/api/auth/csrf-token`);
    const csrfToken = csrfRes.data.csrfToken;
    const cookie = csrfRes.headers['set-cookie'] ? csrfRes.headers['set-cookie'][0] : `XSRF-TOKEN=${csrfToken}`;

    // B. Lấy CAPTCHA trước
    const captchaRes = await axios.get(`${API_URL}/api/auth/captcha`);
    const { captchaId, answer } = captchaRes.data;

    // C. Đăng nhập
    const res = await axios.post(`${API_URL}/api/auth/login/internal`, {
      identifier: testData.adminStaffA.phone,
      password: testData.adminStaffA.password,
      captchaId,
      captchaAnswer: answer
    }, {
      headers: {
        'Cookie': `csrf_token=${csrfToken}`,
        'x-csrf-token': csrfToken
      }
    });

    if (res.data.success) {
      token = res.data.data.accessToken;
      addResult('Auth', 'Login Internal', 'Passed', 'High', 'Đăng nhập thành công dưới quyền Admin Staff A');
    } else {
      throw new Error('Login failed: ' + res.data.message);
    }
  } catch (err) {
    if (err.response) {
      addResult('Auth', 'Login Internal', 'Failed', 'Critical', `Không thể đăng nhập: ${err.response.status} - ${JSON.stringify(err.response.data)}`);
    } else {
      addResult('Auth', 'Login Internal', 'Failed', 'Critical', `Không thể đăng nhập: ${err.message}`);
    }
    console.table(testResults);
    return;
  }

  const reqConfig = { headers: { Authorization: `Bearer ${token}` } };

  // 2. Thử lấy danh sách học viên
  try {
    const res = await axios.get(`${API_URL}/api/students`, reqConfig);
    const students = res.data.data;
    const hasBranchB = students.some(s => s.branchCode === testData.branchB.code);
    const hasBranchA = students.some(s => s.branchCode === testData.branchA.code);
    
    if (hasBranchB) {
      addResult('Students', 'Read List', 'Failed', 'Critical', 'Staff A có thể xem học viên của Branch B!');
    } else if (hasBranchA) {
      addResult('Students', 'Read List', 'Passed', 'High', 'Staff A CHỈ thấy học viên Branch A');
    } else {
      addResult('Students', 'Read List', 'Failed', 'Medium', 'Không tìm thấy học viên Branch A');
    }
  } catch (err) {
    addResult('Students', 'Read List', 'Failed', 'Critical', `Lỗi API lấy danh sách học viên: ${err.message}`);
  }

  // 3. Thử sửa học viên của Branch B (ID của studentB)
  try {
    const res = await axios.put(`${API_URL}/api/students/${testData.studentB.id}`, { name: 'Hacked Name' }, reqConfig);
    addResult('Students', 'Update Branch B', 'Failed', 'Critical', `Staff A có thể sửa học viên Branch B! Status: ${res.status}`);
  } catch (err) {
    if (err.response && (err.response.status === 403 || err.response.status === 404)) {
      addResult('Students', 'Update Branch B', 'Passed', 'High', `Bị chặn thành công khi cố sửa học viên Branch B (Status ${err.response.status})`);
    } else {
      addResult('Students', 'Update Branch B', 'Failed', 'High', `Lỗi không xác định: ${err.message}`);
    }
  }

  // 4. Thử lấy danh sách nhân viên (Employees)
  try {
    const res = await axios.get(`${API_URL}/api/employees`, reqConfig);
    const emps = res.data.data;
    const hasBranchB = emps.some(e => e.branchCode === testData.branchB.code);
    
    if (hasBranchB) {
      addResult('Employees', 'Read List', 'Failed', 'Critical', 'Staff A có thể xem nhân viên của Branch B!');
    } else {
      addResult('Employees', 'Read List', 'Passed', 'High', 'Staff A CHỈ thấy nhân viên Branch A');
    }
  } catch (err) {
    addResult('Employees', 'Read List', 'Failed', 'Critical', `Lỗi lấy danh sách nhân viên: ${err.message}`);
  }

  // 5. Thử truy cập thống kê hệ thống (ví dụ: endpoint Admin Dashboard chung nếu có, hoặc báo cáo tài chính)
  try {
    const res = await axios.get(`${API_URL}/api/transactions/stats`, reqConfig);
    addResult('Finance', 'Global Stats', 'Passed', 'Medium', 'Staff A xem được thống kê (cần chắc chắn đây chỉ là của Branch A)');
  } catch (err) {
    addResult('Finance', 'Global Stats', 'Failed', 'Low', `Lỗi hoặc bị chặn: ${err.message}`);
  }

  // 6. Thử tạo 1 giảng viên cho Branch B
  try {
    const res = await axios.post(`${API_URL}/api/teachers`, {
      name: 'Hacker Teacher', phone: '0999999888',
      branchId: testData.branchB.id // Cố tình gán branch B
    }, reqConfig);
    
    // Kiểm tra xem backend có ép lại thành Branch A hay báo 403 không
    if (res.data && res.data.data && res.data.data.branchId === testData.branchB.id) {
      addResult('Teachers', 'Create for Branch B', 'Failed', 'Critical', 'Staff A đã tạo được giảng viên cho Branch B!');
    } else if (res.data && res.data.data && String(res.data.data.branchId) === String(testData.branchA.id)) {
      addResult('Teachers', 'Create for Branch B', 'Passed', 'High', 'Hệ thống tự động ép (force) branchId về Branch A');
    } else {
      addResult('Teachers', 'Create for Branch B', 'Failed', 'Medium', 'Có tạo được nhưng không rõ chi nhánh');
    }
  } catch (err) {
    if (err.response && (err.response.status === 403 || err.response.status === 401)) {
       addResult('Teachers', 'Create for Branch B', 'Passed', 'High', `Bị từ chối vì thiếu quyền (RBAC chặn STAFF tạo teacher, chỉ có SuperAdmin) (Status ${err.response.status})`);
    } else {
       addResult('Teachers', 'Create for Branch B', 'Failed', 'Low', `Lỗi khác: ${err.message}`);
    }
  }

  // In kết quả
  console.log('\n--- KẾT QUẢ API TEST ---');
  console.table(testResults);
  fs.writeFileSync(path.join(__dirname, 'qa_branch_api_results.json'), JSON.stringify(testResults, null, 2));
}

runApiTests();
