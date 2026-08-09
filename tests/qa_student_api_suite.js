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
  console.log('🚀 Bắt đầu API Testing cho Student Portal...');
  
  let tokenStudentA = '';
  // 1. Đăng nhập Student A qua /api/auth/login/public
  try {
    // A. Lấy CSRF Token
    const csrfRes = await axios.get(`${API_URL}/api/auth/csrf-token`);
    const csrfToken = csrfRes.data.csrfToken;

    const res = await axios.post(`${API_URL}/api/auth/login/public`, {
      identifier: testData.studentA.phone,
      password: testData.studentA.password,
      role: 'student'
    }, {
      headers: {
        'Cookie': `csrf_token=${csrfToken}`,
        'x-csrf-token': csrfToken
      }
    });

    if (res.data.success) {
      tokenStudentA = res.data.data.accessToken || res.data.data.token;
      addResult('Auth', 'Login API', 'Passed', 'High', 'Student A đăng nhập API thành công');
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
    headers: { Authorization: `Bearer ${tokenStudentA}` }
  };

  // 2. Kiểm tra Security (Không thể vào API Admin/Staff)
  try {
    await axios.get(`${API_URL}/api/transactions/stats`, reqConfig);
    addResult('Security', 'Admin API Access', 'Failed', 'Critical', 'Student A truy cập được API tài chính (transactions/stats)');
  } catch (err) {
    if (err.response && (err.response.status === 403 || err.response.status === 401)) {
      addResult('Security', 'Admin API Access', 'Passed', 'High', 'Bị chặn quyền truy cập API tài chính (Admin) đúng như thiết kế');
    } else {
      addResult('Security', 'Admin API Access', 'Failed', 'High', `Lỗi không xác định: ${err.message}`);
    }
  }

  // 3. Kiểm tra Security (Không thể đọc danh sách toàn bộ học viên)
  try {
    await axios.get(`${API_URL}/api/students`, reqConfig);
    addResult('Security', 'List API Access', 'Failed', 'Critical', 'Student A truy cập được danh sách toàn bộ học viên');
  } catch (err) {
    if (err.response && (err.response.status === 403 || err.response.status === 401)) {
      addResult('Security', 'List API Access', 'Passed', 'High', 'Bị chặn quyền đọc danh sách học viên đúng như thiết kế');
    } else {
      addResult('Security', 'List API Access', 'Failed', 'High', `Lỗi không xác định: ${err.message}`);
    }
  }

  // 4. Kiểm tra Data Isolation (Đọc profile của chính mình thành công)
  try {
    const res = await axios.get(`${API_URL}/api/students/${testData.studentA.id}`, reqConfig);
    if (res.data.success) {
      addResult('Students', 'Read Self', 'Passed', 'High', 'Student lấy được thông tin của chính mình');
    } else {
      addResult('Students', 'Read Self', 'Failed', 'High', 'API không trả về success: true');
    }
  } catch (err) {
    const errorDetails = err.response ? JSON.stringify(err.response.data) : err.message;
    addResult('Students', 'Read Self', 'Failed', 'High', `Lỗi API: ${errorDetails}`);
  }

  // 5. Kiểm tra Data Isolation (Không thể đọc profile của học viên B)
  try {
    await axios.get(`${API_URL}/api/students/${testData.studentB.id}`, reqConfig);
    addResult('Students', 'Data Isolation', 'Failed', 'Critical', 'Student A lấy được thông tin của Student B (Data Leakage)');
  } catch (err) {
    if (err.response && (err.response.status === 403 || err.response.status === 401)) {
      addResult('Students', 'Data Isolation', 'Passed', 'Critical', 'Bị chặn truy cập hồ sơ của Student B (Data Isolation hoạt động)');
    } else {
      addResult('Students', 'Data Isolation', 'Failed', 'Critical', `Lỗi không xác định khi truy cập Student B: ${err.message}`);
    }
  }

  // Lưu kết quả
  console.log('\n--- KẾT QUẢ API TEST (Student Portal) ---');
  console.table(testResults);
  fs.writeFileSync(path.join(__dirname, 'qa_student_api_results.json'), JSON.stringify(testResults, null, 2));
}

runApiTests();
