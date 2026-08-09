const fs = require('fs');
const axios = require('axios');
const path = require('path');

const API_URL = 'http://localhost:5000';
const dataPath = path.join(__dirname, 'qa_teacher_data.json');
let testData;
try {
  testData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
} catch (err) {
  console.error('Không tìm thấy qa_teacher_data.json, hãy chạy seed_teacher_qa.js trước.');
  process.exit(1);
}

const testResults = [];

function addResult(module, func, result, severity, description) {
  testResults.push({ module, func, result, severity, description });
  console.log(`[${result === 'Passed' ? 'OK' : 'FAIL'}] ${module} - ${func}: ${description}`);
}

async function runApiTests() {
  console.log('🚀 Bắt đầu API Testing cho Teacher Portal...');
  
  let tokenTeacherA = '';
  // 1. Đăng nhập Teacher A qua /api/auth/login/public
  try {
    // A. Lấy CSRF Token
    const csrfRes = await axios.get(`${API_URL}/api/auth/csrf-token`);
    const csrfToken = csrfRes.data.csrfToken;
    const cookie = csrfRes.headers['set-cookie'] ? csrfRes.headers['set-cookie'][0] : `XSRF-TOKEN=${csrfToken}`;

    const res = await axios.post(`${API_URL}/api/auth/login/public`, {
      identifier: testData.teacherA.phone,
      password: testData.teacherA.password,
      role: 'teacher'
    }, {
      headers: {
        'Cookie': `csrf_token=${csrfToken}`,
        'x-csrf-token': csrfToken
      }
    });

    if (res.data.success) {
      tokenTeacherA = res.data.data.accessToken || res.data.data.token;
      addResult('Auth', 'Login API', 'Passed', 'High', 'Teacher A đăng nhập API thành công');
    } else {
      addResult('Auth', 'Login API', 'Failed', 'High', 'Lỗi đăng nhập: ' + res.data.message);
      process.exit(1);
    }
  } catch (err) {
    const errorDetails = err.response ? JSON.stringify(err.response.data) : err.message;
    addResult('Auth', 'Login API', 'Failed', 'High', 'Lỗi API khi đăng nhập: ' + errorDetails);
    process.exit(1);
  }

  const reqConfig = {
    headers: { Authorization: `Bearer ${tokenTeacherA}` }
  };

  // 2. Kiểm tra Security (Không thể vào API Admin/Staff)
  try {
    await axios.get(`${API_URL}/api/transactions/stats`, reqConfig);
    addResult('Security', 'Admin API Access', 'Failed', 'Critical', 'Teacher A truy cập được API tài chính (transactions/stats)');
  } catch (err) {
    if (err.response && (err.response.status === 403 || err.response.status === 401)) {
      addResult('Security', 'Admin API Access', 'Passed', 'High', 'Bị chặn quyền truy cập API tài chính đúng như thiết kế');
    } else {
      addResult('Security', 'Admin API Access', 'Failed', 'High', `Lỗi không xác định: ${err.message}`);
    }
  }

  // 3. Kiểm tra API Student Management (Chỉ thấy học sinh của mình)
  try {
    const res = await axios.get(`${API_URL}/api/students`, reqConfig);
    if (res.data.success) {
      const students = res.data.data || [];
      const hasStudentA = students.some(s => s._id === testData.studentA.id || s.phone === testData.studentA.phone);
      const hasStudentB = students.some(s => s._id === testData.studentB.id || s.phone === testData.studentB.phone);
      
      if (hasStudentA && !hasStudentB) {
        addResult('Students', 'Read API', 'Passed', 'Critical', 'Teacher chỉ lấy được học viên của mình');
      } else if (!hasStudentA) {
        addResult('Students', 'Read API', 'Failed', 'Critical', `Teacher không lấy được học viên của mình.`);
      } else {
        addResult('Students', 'Read API', 'Failed', 'Critical', `Teacher lấy được học viên của người khác (Leakage).`);
      }
    } else {
      addResult('Students', 'Read API', 'Failed', 'High', 'API trả về success: false');
    }
  } catch (err) {
    addResult('Students', 'Read API', 'Failed', 'High', `Lỗi API lấy danh sách học viên: ${err.message}`);
  }

  // 4. Lưu kết quả
  console.log('\n--- KẾT QUẢ API TEST (Teacher Portal) ---');
  console.table(testResults);
  fs.writeFileSync(path.join(__dirname, 'qa_teacher_api_results.json'), JSON.stringify(testResults, null, 2));
}

runApiTests();
