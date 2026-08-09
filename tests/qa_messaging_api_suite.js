const fs = require('fs');
const axios = require('axios');
const path = require('path');

const API_URL = 'http://localhost:5000';
const dataPath = path.join(__dirname, 'qa_messaging_data.json');
let testData;
try {
  testData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
} catch (err) {
  console.error('Không tìm thấy qa_messaging_data.json');
  process.exit(1);
}

const testResults = [];
function addResult(module, func, result, severity, description) {
  testResults.push({ module, func, result, severity, description });
  console.log(`[${result === 'Passed' ? 'OK' : 'FAIL'}] ${module} - ${func}: ${description}`);
}

async function loginUser(identifier, password, role) {
  try {
    const csrfRes = await axios.get(`${API_URL}/api/auth/csrf-token`);
    const csrfToken = csrfRes.data.csrfToken;
    const endpoint = (role === 'admin' || role === 'staff') ? '/api/auth/login/internal' : '/api/auth/login/public';
    const payload = { identifier, password, role };
    
    // Nếu là internal, có thể cần captcha rỗng trong môi trường dev
    if (role === 'admin' || role === 'staff') {
      payload.captchaId = 'dummy';
      payload.captchaAnswer = 'dummy';
    }

    const res = await axios.post(`${API_URL}${endpoint}`, payload, {
      headers: { 'Cookie': `csrf_token=${csrfToken}`, 'x-csrf-token': csrfToken }
    });
    if (res.data.success) return res.data.data.accessToken || res.data.data.token;
  } catch (err) {
    console.error(`Login failed for ${identifier}: ${err.message}`);
  }
  return null;
}

async function sendMessage(token, receiverId, receiverName, receiverRole, content) {
  try {
    const csrfRes = await axios.get(`${API_URL}/api/auth/csrf-token`);
    const csrfToken = csrfRes.data.csrfToken;
    const res = await axios.post(`${API_URL}/api/messages`, {
      receiverId, receiverName, receiverRole, content, messageType: 'text'
    }, {
      headers: { 
        Authorization: `Bearer ${token}`,
        'Cookie': `csrf_token=${csrfToken}`,
        'x-csrf-token': csrfToken
      }
    });
    return res.data;
  } catch (err) {
    return { success: false, message: err.response ? JSON.stringify(err.response.data) : err.message };
  }
}

async function readConversation(token, conversationId) {
  try {
    const res = await axios.get(`${API_URL}/api/messages/${conversationId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return res.data;
  } catch (err) {
    return { success: false, message: err.response ? err.response.status : err.message };
  }
}

async function runTests() {
  console.log('🚀 Bắt đầu Messaging API Testing...');
  
  // 1. Login all users
  const tokens = {};
  tokens.superAdmin = await loginUser(testData.superAdmin.phone, testData.superAdmin.password, 'admin');
  tokens.branchAdmin = await loginUser(testData.branchAdmin.phone, testData.branchAdmin.password, 'staff');
  tokens.support = await loginUser(testData.supportAgent.phone, testData.supportAgent.password, 'staff');
  tokens.teacher = await loginUser(testData.teacher.phone, testData.teacher.password, 'teacher');
  tokens.student = await loginUser(testData.student.phone, testData.student.password, 'student');

  for (const [user, token] of Object.entries(tokens)) {
    if (!token) {
      console.error(`❌ Lỗi: Không thể đăng nhập ${user}`);
      process.exit(1);
    }
  }
  addResult('Auth', 'Login All', 'Passed', 'High', 'Đăng nhập thành công 5 roles');

  // Helper for matrix test
  const users = {
    superAdmin: { id: testData.superAdmin.id, role: 'admin', name: 'Super Admin' },
    branchAdmin: { id: testData.branchAdmin.id, role: 'admin', name: 'Branch Admin' },
    support: { id: testData.supportAgent.id, role: 'admin', name: 'Support' },
    teacher: { id: testData.teacher.id, role: 'teacher', name: 'Teacher Msg' },
    student: { id: testData.student.id, role: 'student', name: 'Student Msg' }
  };

  // Kịch bản gửi tin nhắn chéo
  const flows = [
    { from: 'superAdmin', to: 'branchAdmin' },
    { from: 'branchAdmin', to: 'superAdmin' },
    { from: 'superAdmin', to: 'support' },
    { from: 'support', to: 'superAdmin' },
    { from: 'superAdmin', to: 'teacher' },
    { from: 'teacher', to: 'superAdmin' },
    { from: 'superAdmin', to: 'student' },
    { from: 'student', to: 'superAdmin' },
    
    { from: 'branchAdmin', to: 'support' },
    { from: 'support', to: 'branchAdmin' },
    { from: 'branchAdmin', to: 'teacher' },
    { from: 'teacher', to: 'branchAdmin' },
    { from: 'branchAdmin', to: 'student' },
    { from: 'student', to: 'branchAdmin' },
    
    { from: 'support', to: 'teacher' },
    { from: 'teacher', to: 'support' },
    { from: 'support', to: 'student' },
    { from: 'student', to: 'support' },
    
    { from: 'teacher', to: 'student' },
    { from: 'student', to: 'teacher' }
  ];

  let storedConvId = null;

  for (const flow of flows) {
    const sender = users[flow.from];
    const receiver = users[flow.to];
    
    const msgRes = await sendMessage(tokens[flow.from], receiver.id, receiver.name, receiver.role, `Hello ${receiver.name} from ${sender.name}`);
    if (msgRes.success) {
      addResult('Message Flow', `${sender.name} -> ${receiver.name}`, 'Passed', 'High', 'Gửi tin nhắn thành công');
      if (!storedConvId && msgRes.data && msgRes.data.conversationId) {
        storedConvId = msgRes.data.conversationId;
      }
    } else {
      addResult('Message Flow', `${sender.name} -> ${receiver.name}`, 'Failed', 'High', 'Gửi thất bại: ' + msgRes.message);
    }
  }

  // Security test: Teacher tries to read a conversation between Student and SuperAdmin
  // Wait, I can try reading storedConvId with an unrelated user if storedConvId belongs to superAdmin -> branchAdmin
  if (storedConvId) {
    const readRes = await readConversation(tokens.student, storedConvId);
    // Student should not be able to read superAdmin <-> branchAdmin conversation
    if (!readRes.success && (readRes.message === 403 || readRes.message === '403')) {
      addResult('Security', 'Unauthorized Read', 'Passed', 'Critical', 'Student bị chặn xem đoạn chat của Admin');
    } else {
      addResult('Security', 'Unauthorized Read', 'Failed', 'Critical', 'Student đọc được đoạn chat của Admin! Lỗi bảo mật.');
    }
  }

  console.log('\n--- KẾT QUẢ API TEST (Messaging Portal) ---');
  console.table(testResults);
  fs.writeFileSync(path.join(__dirname, 'qa_messaging_api_results.json'), JSON.stringify(testResults, null, 2));
}

runTests();
