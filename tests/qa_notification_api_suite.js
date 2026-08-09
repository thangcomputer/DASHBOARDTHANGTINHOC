const axios = require('axios');
const fs = require('fs');
const path = require('path');

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

function addResult(sender, receiver, moduleName, func, result, severity, description) {
  results.push({ sender, receiver, module: moduleName, func, result, severity, description });
  const icon = result === 'Passed' ? '✅' : '❌';
  console.log(`[${result}] ${sender} -> ${receiver} | ${moduleName} - ${func}: ${description}`);
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
    
    const res = await axios.post(`${API_URL}${endpoint}`, 
      payload,
      { headers: { 'Cookie': `csrf_token=${csrfToken}`, 'x-csrf-token': csrfToken } }
    );
    if (!res.data.success) throw new Error(res.data.message || 'Login failed');
    return { token: res.data.data.accessToken, csrfToken };
  } catch (err) {
    console.error(`Login failed for ${identifier} as ${roleType}:`, err.response?.data || err.message);
    return null;
  }
}

async function runTests() {
  console.log('🚀 Bắt đầu Notification Workflow API Testing...');

  const tokens = {};
  for (const [role, creds] of Object.entries(credentials)) {
    const type = role === 'student' ? 'student' : (role === 'teacher' ? 'teacher' : 'admin');
    tokens[role] = await login(creds.identifier, creds.password, type);
    if (tokens[role]) {
      console.log(`✅ Login thành công: ${role}`);
    } else {
      console.log(`❌ Login thất bại: ${role}`);
      return;
    }
  }

  // Helper to send notification
  const sendNotification = async (auth, payload) => {
    try {
      const res = await axios.post(`${API_URL}/api/notifications`, payload, {
        headers: { 
          Authorization: `Bearer ${auth.token}`,
          'Cookie': `csrf_token=${auth.csrfToken}`,
          'x-csrf-token': auth.csrfToken
        }
      });
      return { success: true, data: res.data };
    } catch (err) {
      return { success: false, status: err.response?.status, data: err.response?.data };
    }
  };

  // 1. Super Admin sending notifications
  console.log('\n--- 1. SUPER ADMIN FLOW ---');
  let res = await sendNotification(tokens.superAdmin, {
    title: 'Hello from Super Admin',
    content: 'Broadcast to all admins',
    type: 'SYSTEM',
    receivers: 'ALL_ADMIN'
  });
  if (res.success) {
    addResult('Super Admin', 'ALL_ADMIN', 'Send Notif', 'Broadcast', 'Passed', 'High', 'Gửi thông báo thành công');
  } else {
    addResult('Super Admin', 'ALL_ADMIN', 'Send Notif', 'Broadcast', 'Failed', 'High', 'Super Admin không gửi được thông báo');
  }

  // 2. Admin Staff sending notifications
  console.log('\n--- 2. ADMIN STAFF FLOW ---');
  res = await sendNotification(tokens.branchAdmin, {
    title: 'Hello from Admin Staff',
    content: 'Broadcast to all',
    type: 'SYSTEM',
    receivers: 'ALL_ADMIN'
  });
  if (res.success) {
    addResult('Admin Staff', 'ALL_ADMIN', 'Send Notif', 'Broadcast', 'Passed', 'High', 'Gửi thông báo thành công');
  } else {
    addResult('Admin Staff', 'ALL_ADMIN', 'Send Notif', 'Broadcast', 'Failed', 'High', `Gửi lỗi: ${res.status}`);
  }

  // 3. Support sending notifications (Should fail based on business rules or route middleware)
  console.log('\n--- 3. SUPPORT FLOW ---');
  res = await sendNotification(tokens.support, {
    title: 'Hello from Support',
    content: 'Broadcast to all',
    type: 'SYSTEM',
    receivers: 'ALL_ADMIN'
  });
  if (!res.success && res.status === 403) {
    addResult('Support', 'ALL_ADMIN', 'Send Notif', 'Broadcast', 'Passed', 'High', 'Bị từ chối quyền gửi (403)');
  } else {
    addResult('Support', 'ALL_ADMIN', 'Send Notif', 'Broadcast', 'Failed', 'High', `Support có thể gửi notification trái phép? Status: ${res.status}`);
  }

  // 4. Teacher sending notifications (Should fail based on API, wait, Teachers send via other modules, but direct broadcast should fail)
  console.log('\n--- 4. TEACHER FLOW ---');
  res = await sendNotification(tokens.teacher, {
    title: 'Hello from Teacher',
    content: 'Broadcast',
    type: 'SYSTEM',
    receivers: 'ALL_STUDENT'
  });
  if (!res.success && res.status === 403) {
    addResult('Teacher', 'ALL_STUDENT', 'Send Notif', 'Broadcast', 'Passed', 'High', 'Bị từ chối quyền gửi (403)');
  } else {
    addResult('Teacher', 'ALL_STUDENT', 'Send Notif', 'Broadcast', 'Failed', 'High', 'Teacher gửi broadcast trái phép');
  }

  // 5. Student sending notifications (Should fail)
  console.log('\n--- 5. STUDENT FLOW ---');
  res = await sendNotification(tokens.student, {
    title: 'Hello from Student',
    content: 'Broadcast',
    type: 'SYSTEM',
    receivers: 'GLOBAL'
  });
  if (!res.success && (res.status === 403 || res.status === 401 || res.status === 404)) {
    addResult('Student', 'GLOBAL', 'Send Notif', 'Broadcast', 'Passed', 'High', `Bị từ chối quyền gửi (${res.status})`);
  } else {
    addResult('Student', 'GLOBAL', 'Send Notif', 'Broadcast', 'Failed', 'High', 'Student gửi broadcast trái phép');
  }

  // 6. Fetching notifications
  console.log('\n--- 6. FETCH & READ FLOW ---');
  try {
    const authH = {
      Authorization: `Bearer ${tokens.branchAdmin.token}`,
      'Cookie': `csrf_token=${tokens.branchAdmin.csrfToken}`,
      'x-csrf-token': tokens.branchAdmin.csrfToken
    };
    const listRes = await axios.get(`${API_URL}/api/notifications?limit=10`, { headers: authH });
    
    if (listRes.data.success) {
      addResult('System', 'Admin Staff', 'Fetch Notif', 'List', 'Passed', 'High', 'Lấy danh sách thành công');
      
      if (listRes.data.data.length > 0) {
        const firstNotifId = listRes.data.data[0].id;
        
        // Mark Read
        const readRes = await axios.put(`${API_URL}/api/notifications/mark-read`, { notificationId: firstNotifId }, { headers: authH });
        if (readRes.data.success) {
          addResult('Admin Staff', 'System', 'Read Notif', 'Mark Read', 'Passed', 'High', 'Mark read thành công');
        } else {
          addResult('Admin Staff', 'System', 'Read Notif', 'Mark Read', 'Failed', 'High', 'Mark read lỗi');
        }
        
        // Check Badge Count
        const countRes = await axios.get(`${API_URL}/api/notifications/count`, { headers: authH });
        if (countRes.data.success) {
          addResult('Admin Staff', 'System', 'Count Notif', 'Badge Count', 'Passed', 'High', `Lấy count thành công (${countRes.data.count})`);
        } else {
          addResult('Admin Staff', 'System', 'Count Notif', 'Badge Count', 'Failed', 'High', 'Lấy count lỗi');
        }

      }
    } else {
      addResult('System', 'Admin Staff', 'Fetch Notif', 'List', 'Failed', 'High', 'Không fetch được list');
    }
  } catch (err) {
    addResult('System', 'Any', 'Fetch Notif', 'List', 'Failed', 'High', err.message);
  }

  console.log('\n--- KẾT QUẢ API TEST (Notification Portal) ---');
  console.table(results);
}

runTests();
