const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

async function testAdminFeatures() {
  let adminToken = '';
  let csrf = '';
  let cookie = '';

  try {
    // 1. Get CSRF Token & Login
    const csrfRes = await axios.get(`${BASE_URL}/auth/csrf-token`);
    csrf = csrfRes.data.csrfToken;
    cookie = csrfRes.headers['set-cookie'].join('; ');

    const loginRes = await axios.post(`${BASE_URL}/auth/login/internal`, {
      identifier: 'admin2@test.com',
      password: 'password123'
    }, { headers: { 'X-CSRF-Token': csrf, Cookie: cookie } });
    
    adminToken = loginRes.data.data.accessToken;
    console.log('✅ Admin login success');

    const headers = { 
      Authorization: `Bearer ${adminToken}`, 
      'X-CSRF-Token': csrf, 
      Cookie: cookie 
    };

    // 2. Create Course (Tạo khóa học)
    try {
      const courseRes = await axios.post(`${BASE_URL}/courses`, {
        name: 'Khóa học Test 2 ' + Date.now(),
        code: 'TEST02' + Date.now(),
        description: 'Mô tả khóa học',
        price: 1500000,
        status: 'published',
        type: 'online'
      }, { headers });
      console.log('✅ Create course success:', courseRes.data.success);
    } catch (err) {
      console.error('❌ Create course failed:', err.response?.data || err.message);
    }

    // 3. Create Blog/Post (Tạo bài viết)
    try {
      const blogRes = await axios.post(`${BASE_URL}/blog/manage/posts`, {
        title: 'Bài viết Test 2 ' + Date.now(),
        content: 'Nội dung bài viết',
        status: 'published',
        tags: ['test']
      }, { headers });
      console.log('✅ Create blog success:', blogRes.data.success);
    } catch (err) {
      console.error('❌ Create blog failed:', err.response?.data || err.message);
    }

    // 4. Create Feed/News (Bảng tin)
    try {
      const feedRes = await axios.post(`${BASE_URL}/feed`, {
        content: 'Nội dung bảng tin test ' + Date.now(),
        type: 'announcement',
        target: 'all'
      }, { headers });
      console.log('✅ Create feed success:', feedRes.data.success);
    } catch (err) {
      console.error('❌ Create feed failed:', err.response?.data || err.message);
    }

    // 5. Create Message (Tin nhắn)
    try {
      // Find a student first to send message
      const studentLoginRes = await axios.post(`${BASE_URL}/auth/login/public`, {
        identifier: 'student2@test.com',
        password: 'password123'
      }, { headers: { 'X-CSRF-Token': csrf, Cookie: cookie } });
      const studentId = studentLoginRes.data.data.user._id || studentLoginRes.data.data.user.id;

      const messageRes = await axios.post(`${BASE_URL}/messages`, {
        receiverId: studentId,
        receiverRole: 'student',
        content: 'Chào em, đây là tin nhắn test từ hệ thống!'
      }, { headers });
      console.log('✅ Send message success:', messageRes.data.success);
    } catch (err) {
      console.error('❌ Send message failed:', err.response?.data || err.message);
    }

  } catch (err) {
    console.error('❌ Login or setup failed:', err.response?.data || err.message);
  }
}

testAdminFeatures();
