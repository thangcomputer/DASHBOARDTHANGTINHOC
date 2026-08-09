const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { io } = require('socket.io-client');

const API_URL = 'http://localhost:5000';
let testData;
try {
  testData = JSON.parse(fs.readFileSync(path.join(__dirname, 'qa_gender_data.json'), 'utf8'));
} catch (err) {
  console.error('Không tìm thấy qa_gender_data.json');
  process.exit(1);
}

const credentials = {
  superAdmin: { identifier: 'admin', password: testData.admin.password },
  branchAdmin: { identifier: testData.branchAdmin.phone, password: testData.branchAdmin.password },
  employee: { identifier: testData.employee.phone, password: testData.employee.password },
  support: { identifier: testData.support.phone, password: testData.support.password },
  teacher: { identifier: testData.teacher.phone, password: testData.teacher.password },
  student: { identifier: testData.student.phone, password: testData.student.password }
};

const results = [];
function addResult(role, action, expected, actual, result, issue, severity = 'Low') {
  results.push({ role, action, expected, actual, result, issue, severity });
  console.log(`[${result}] ${role} - ${action}: ${expected} -> ${actual} | ${issue}`);
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
    return { token: res.data.data.accessToken, csrfToken, user: res.data.data };
  } catch (err) {
    console.error(`Login failed for ${identifier}:`, err.response ? err.response.data : err);
    return null;
  }
}

function connectSocket(auth, roleName) {
  return new Promise((resolve, reject) => {
    const socket = io(API_URL, {
      auth: { token: auth.token },
      extraHeaders: {
        Cookie: `csrf_token=${auth.csrfToken}`,
        'x-csrf-token': auth.csrfToken
      },
      transports: ['websocket'],
      reconnection: false
    });
    socket.on('connect', () => {
      // Emit register to join presence
      socket.emit('register', { branchId: null, branchCode: '' });
      resolve(socket);
    });
    socket.on('connect_error', (err) => {
      reject(err);
    });
  });
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function waitForEvent(socket, eventName, timeout = 5000) {
  return new Promise((resolve) => {
    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) resolve(null); // Timeout
    }, timeout);
    socket.once(eventName, (data) => {
      resolved = true;
      clearTimeout(timer);
      resolve(data);
    });
  });
}

async function runTests() {
  console.log('🚀 Bắt đầu Kiểm thử Presence (Online/Offline Status)...');
  const auths = {};
  for (const [role, creds] of Object.entries(credentials)) {
    const type = role === 'student' ? 'student' : (role === 'teacher' ? 'teacher' : 'admin');
    auths[role] = await login(creds.identifier, creds.password, type);
    if (!auths[role]) {
      console.error(`❌ Lỗi đăng nhập cho: ${role}`);
      return;
    }
  }
  
  console.log('✅ Đã đăng nhập 6 users.');
  
  // 1. Connect all sockets except Teacher
  const sockets = {};
  for (const role of ['superAdmin', 'branchAdmin', 'student']) {
    sockets[role] = await connectSocket(auths[role], role);
    addResult(role, 'Login (Connect Socket)', 'Status changes to Online', 'Socket connected', 'Passed', 'N/A');
  }

  // Set up listeners for Student to track online list
  let currentOnlineList = [];
  sockets.student.on('users:online', (list) => {
    currentOnlineList = list;
    console.log(`[Student Socket] Received users:online. Total: ${list.length}`);
  });

  // Wait a moment for initial sync
  await new Promise(r => setTimeout(r, 2000));
  
  // 2. Teacher connects (Logs in)
  console.log('\n--- Kiểm tra Real-time Login (Teacher) ---');
  let teacherOnlinePromise = waitForEvent(sockets.student, 'users:online');
  sockets.teacher = await connectSocket(auths.teacher, 'teacher');
  
  let newList = await teacherOnlinePromise;
  if (!newList) newList = currentOnlineList;
  
  const teacherId = auths.teacher.user.user._id || auths.teacher.user._id || auths.teacher.user.id;
  const isTeacherOnline = newList.some(u => String(u.userId) === String(teacherId));
  if (isTeacherOnline) {
    addResult('Teacher', 'Log in (Student view)', 'See Teacher Online immediately', 'Seen Online', 'Passed', 'N/A');
  } else {
    console.log('--- Teacher ID:', teacherId, auths.teacher.user);
    console.log('--- Online List:', newList.map(u => ({ userId: u.userId, role: u.role, name: u.name })));
    addResult('Teacher', 'Log in (Student view)', 'See Teacher Online immediately', 'Not Seen', 'Failed', 'Student did not receive real-time update', 'High');
  }

  // 3. Test Real-time Logout
  console.log('\n--- Kiểm tra Real-time Logout (Teacher) ---');
  sockets.teacher.disconnect();
  await delay(1000);
  
  let offlineList = currentOnlineList;
  
  const isTeacherStillOnline = offlineList.some(u => String(u.userId) === String(teacherId));
  if (!isTeacherStillOnline) {
    addResult('Teacher', 'Log out (Student view)', 'See Teacher Offline immediately', 'Seen Offline', 'Passed', 'N/A');
  } else {
    addResult('Teacher', 'Log out (Student view)', 'See Teacher Offline immediately', 'Still Online', 'Failed', 'Student did not receive offline update', 'High');
  }

  // 4. Multi-device test for Support
  console.log('\n--- Kiểm tra Multi-device (Support) ---');
  let supportOnlinePromise1 = waitForEvent(sockets.student, 'users:online');
  const supportSocket1 = await connectSocket(auths.support, 'support1');
  
  let listSupport1 = await supportOnlinePromise1 || currentOnlineList;
  const supportId = auths.support.user.user._id || auths.support.user._id || auths.support.user.id;
  const isSupportOnline1 = listSupport1.some(u => String(u.userId) === String(supportId));
  if (isSupportOnline1) {
    addResult('Support', 'Log in Device 1', 'See Support Online', 'Seen Online', 'Passed', 'N/A');
  } else {
    addResult('Support', 'Log in Device 1', 'See Support Online', 'Not Seen', 'Failed', 'Support not online', 'High');
  }

  // Connect Device B
  let supportOnlinePromise2 = waitForEvent(sockets.student, 'users:online');
  const supportSocket2 = await connectSocket(auths.support, 'support2');
  let listSupport2 = await supportOnlinePromise2 || currentOnlineList;
  
  // Disconnect Device A
  supportSocket1.disconnect();
  await delay(1000);
  let listSupportAfterDevice1 = currentOnlineList;
  const isSupportStillOnline = listSupportAfterDevice1.some(u => String(u.userId) === String(supportId));
  
  if (isSupportStillOnline) {
    addResult('Support', 'Logout Device 1 (Has Device 2)', 'Support still Online', 'Still Online', 'Passed', 'N/A');
  } else {
    addResult('Support', 'Logout Device 1 (Has Device 2)', 'Support still Online', 'Offline', 'Failed', 'Multi-device overwrite bug', 'Medium');
  }

  // Disconnect Device B
  supportSocket2.disconnect();
  await delay(1000);
  let listSupportAfterDevice2 = currentOnlineList;
  const isSupportFullyOffline = listSupportAfterDevice2.some(u => String(u.userId) === String(supportId)) === false;
  
  if (isSupportFullyOffline) {
    addResult('Support', 'Logout Device 2', 'Support Offline', 'Seen Offline', 'Passed', 'N/A');
  } else {
    addResult('Support', 'Logout Device 2', 'Support Offline', 'Still Online', 'Failed', 'Did not go offline', 'High');
  }

  // Clean up remaining
  for (const [key, sock] of Object.entries(sockets)) {
    if (sock && sock.connected) sock.disconnect();
  }

  console.log('\n--- KẾT QUẢ API TEST (Presence) ---');
  console.table(results);
}

runTests();
