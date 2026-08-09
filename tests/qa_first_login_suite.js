const axios = require('axios');
const fs = require('fs');
const path = require('path');

let testData;
try {
  testData = JSON.parse(fs.readFileSync(path.join(__dirname, 'qa_gender_data.json'), 'utf8'));
} catch (err) {
  console.error('Không tìm thấy qa_gender_data.json');
  process.exit(1);
}

const API_URL = 'http://localhost:5000';

const results = [];

function addResult(role, action, expected, actual, result, issue, severity = 'Low') {
  results.push({ role, action, expected, actual, result, issue, severity });
}

async function login(identifier, password, roleType) {
  try {
    const csrfRes = await axios.get(`${API_URL}/api/auth/csrf-token`);
    const csrfToken = csrfRes.data.csrfToken;
    let endpoint = '/api/auth/login';
    let payload = { identifier, password, role: roleType };
    if (roleType === 'admin') {
      endpoint = '/api/auth/login/internal';
      payload = { identifier, password };
    }
    const res = await axios.post(`${API_URL}${endpoint}`, payload, {
      headers: { 'Cookie': `csrf_token=${csrfToken}`, 'x-csrf-token': csrfToken }
    });
    if (!res.data.success) throw new Error(res.data.message || 'Login failed');
    return {
        token: res.data.data.accessToken,
        csrfToken: csrfToken,
        user: res.data.data,
        isFirstLogin: res.data.data.user?.isFirstLogin || false
      };
  } catch (err) {
    console.error(`Login failed for ${identifier}:`, err.response ? err.response.data : err);
    return null;
  }
}

async function runTests() {
  console.log('🚀 Bắt đầu Kiểm thử First Login Password Change...');

  // 1. Lấy thông tin admin
  const adminAuth = await login('admin', testData.admin.password, 'admin');
  if (!adminAuth) return;
  const adminToken = adminAuth.token;
  let adminCsrf = adminAuth.csrfToken;

  // 2. Tạo một Học viên mới (isFirstLogin mặc định là true)
  let studentTempPassword = 'QA_TempPassword123';
  let studentPhone = '09' + Math.floor(10000000 + Math.random() * 90000000).toString();
  let studentId;
  try {
    const createRes = await axios.post(`${API_URL}/api/students`, {
      name: 'QA First Login Student',
      phone: studentPhone,
      email: `qa_firstlogin_student_${studentPhone}@example.com`,
      zalo: studentPhone,
      courseName: 'Lập trình C cơ bản',
      course: 'Lập trình C cơ bản',
      price: 5000000,
      branchId: null,
      password: studentTempPassword
    }, {
      headers: { 
        Authorization: `Bearer ${adminToken}`,
        'Cookie': `csrf_token=${adminCsrf}`,
        'x-csrf-token': adminCsrf
      }
    });
    studentId = createRes.data.data._id;
    console.log(`✅ Đã tạo Học viên mới với mật khẩu tạm: ${studentTempPassword}`);
  } catch (err) {
    console.error('Không thể tạo học viên', err.response?.data || err.message);
    return;
  }

  // 3. Đăng nhập bằng Student
  let studentToken;
  let isFirstLoginFlag;
  let studentCsrf;
  try {
    const studentAuth = await login(studentPhone, studentTempPassword, 'student');
    console.log('Login response:', JSON.stringify(studentAuth, null, 2));
    if (!studentAuth) throw new Error('Login returns null');
    studentToken = studentAuth.token;
    studentCsrf = studentAuth.csrfToken;
    isFirstLoginFlag = studentAuth.isFirstLogin;
    
    if (isFirstLoginFlag) {
      addResult('Student', 'First Login with Temp Password', 'isFirstLogin = true', 'isFirstLogin = true', 'Passed', 'N/A');
    } else {
      addResult('Student', 'First Login with Temp Password', 'isFirstLogin = true', 'isFirstLogin = false', 'Failed', 'isFirstLogin flag not set', 'High');
    }
  } catch (err) {
    console.error('Login Teacher Failed', err.message);
    return;
  }

  // 4. Kiểm tra Bypass: Truy cập API được bảo vệ (VD: /api/auth/me hoặc /api/courses) MÀ CHƯA ĐỔI MẬT KHẨU
  try {
    const bypassRes = await axios.get(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    // Nếu gọi thành công, tức là Backend KHÔNG chặn API khi isFirstLogin = true
    addResult('Student', 'Bypass API without Password Change', 'Access Denied (403)', 'Access Granted (200)', 'Failed', 'Backend does not enforce isFirstLogin', 'Critical');
  } catch (err) {
    if (err.response?.status === 403 || err.response?.status === 401) {
      addResult('Student', 'Bypass API without Password Change', 'Access Denied (403)', `Access Denied (${err.response.status})`, 'Passed', 'N/A');
    } else {
      addResult('Student', 'Bypass API without Password Change', 'Access Denied (403)', 'Error', 'Failed', 'Unknown Error', 'Low');
    }
  }

  // 5. Kiểm tra Backend validation: Đổi mật khẩu thành công DÙ NHẬP SAI MẬT KHẨU CŨ
  try {
    const changeRes = await axios.post(`${API_URL}/api/auth/change-password`, {
      oldPassword: 'WRONG_PASSWORD_123!',
      newPassword: 'ValidNewPassword123'
    }, {
      headers: { 
        Authorization: `Bearer ${studentToken}`,
        'Cookie': `csrf_token=${studentCsrf}`,
        'x-csrf-token': studentCsrf
      }
    });
    
    // Nếu thành công dù sai pass cũ
    addResult('Student', 'Change Password (Wrong Old Password)', 'Rejected', 'Accepted', 'Failed', 'Backend skips old password check if isFirstLogin=true', 'High');
  } catch (err) {
    addResult('Student', 'Change Password (Wrong Old Password)', 'Rejected', 'Rejected', 'Passed', 'N/A');
  }

  // 5.5. Kiểm tra Backend validation: Đổi mật khẩu thành công với mật khẩu đúng
  try {
    const changeRes = await axios.post(`${API_URL}/api/auth/change-password`, {
      oldPassword: studentTempPassword,
      newPassword: 'ValidNewPassword123'
    }, {
      headers: { 
        Authorization: `Bearer ${studentToken}`,
        'Cookie': `csrf_token=${studentCsrf}`,
        'x-csrf-token': studentCsrf
      }
    });
    
    addResult('Student', 'Change Password (Correct Old Password)', 'Success', 'Success', 'Passed', 'N/A');
  } catch (err) {
    addResult('Student', 'Change Password (Correct Old Password)', 'Success', 'Failed', 'Failed', err.response?.data?.message || 'Error', 'High');
  }

  // 6. Kiểm tra lại Login với Mật khẩu cũ
  try {
    const oldLoginAuth = await login(studentPhone, studentTempPassword, 'student');
    if (oldLoginAuth) {
      addResult('Student', 'Login with Old Temp Password', 'Rejected', 'Accepted', 'Failed', 'Old password still works after change', 'Critical');
    } else {
      addResult('Student', 'Login with Old Temp Password', 'Rejected', 'Rejected', 'Passed', 'N/A');
    }
  } catch (err) {
    addResult('Student', 'Login with Old Temp Password', 'Rejected', 'Rejected', 'Passed', 'N/A');
  }

  // 7. Kiểm tra lại Login với Mật khẩu mới
  try {
    const newLoginAuth = await login(studentPhone, 'ValidNewPassword123', 'student');
    if (!newLoginAuth) throw new Error('Login failed');
    if (newLoginAuth.isFirstLogin === false) {
      addResult('Student', 'Login with New Password', 'isFirstLogin = false', 'isFirstLogin = false', 'Passed', 'N/A');
    } else {
      addResult('Student', 'Login with New Password', 'isFirstLogin = false', 'isFirstLogin = true', 'Failed', 'Flag not cleared', 'High');
    }
  } catch (err) {
    addResult('Student', 'Login with New Password', 'Success', 'Failed', 'Failed', 'Cannot login with new password', 'Critical');
  }

  // Xóa user test
  /*
  try {
    await axios.delete(`${API_URL}/api/students/${studentId}`, {
      headers: { 
        Authorization: `Bearer ${adminToken}`,
        'Cookie': `csrf_token=${adminCsrf}`,
        'x-csrf-token': adminCsrf
      }
    });
    console.log('✅ Đã dọn dẹp user test.');
  } catch(e) {}
  */

  console.log('\n--- KẾT QUẢ API TEST (First Login) ---');
  console.table(results);
}

runTests();
