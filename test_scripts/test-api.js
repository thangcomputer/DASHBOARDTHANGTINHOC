const axios = require('axios');
const jwt = require('jsonwebtoken');
require('dotenv').config();

async function test() {
  try {
    const res = await axios.post('http://localhost:5000/api/auth/login/public', {
      identifier: 'student@test.com',
      password: 'password123',
      role: 'student',
      force: true // Force login to bypass device conflict
    }, {
      headers: {
        'x-csrf-token': 'dummy' // Might fail CSRF, but if it passes...
      }
    });
    console.log('Login res:', res.data.success);
    
    const token = res.data.data.accessToken;
    const decoded = jwt.decode(token);
    console.log('Token version:', decoded.tokenVersion);

    const meRes = await axios.get('http://localhost:5000/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Me res:', meRes.data.success);

    const studRes = await axios.get('http://localhost:5000/api/students/6a71758a8871061f8d4aea05', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Student res:', studRes.data.success);
  } catch (err) {
    if (err.response && err.response.data.code === 'CSRF_INVALID') {
      console.log('CSRF failed. Just use token 5 manually...');
      const token = jwt.sign(
        { id: '6a71758a8871061f8d4aea05', role: 'student', tokenVersion: 5 },
        process.env.JWT_SECRET || 'secret',
        { expiresIn: '1h' }
      );
      try {
         const studRes = await axios.get('http://localhost:5000/api/students/6a71758a8871061f8d4aea05', {
            headers: { Authorization: `Bearer ${token}` }
         });
         console.log('Student res:', studRes.data.success);
      } catch (e) {
         console.error('API Error:', e.response ? e.response.data : e.message);
      }
    } else {
      console.error('Error:', err.response ? err.response.data : err.message);
    }
  }
}
test();
