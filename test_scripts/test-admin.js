const axios = require('axios');

async function test() {
  try {
    const csrfRes = await axios.get('http://localhost:5000/api/auth/csrf-token');
    const csrfToken = csrfRes.data.csrfToken;
    const cookies = csrfRes.headers['set-cookie'];

    const loginRes = await axios.post('http://localhost:5000/api/auth/login/internal', {
      identifier: 'student@test.com',
      password: 'password123',
    }, {
      headers: {
        'x-csrf-token': csrfToken,
        'Cookie': cookies ? cookies.join('; ') : ''
      }
    });
    console.log('Login res:', loginRes.data);
  } catch (err) {
    console.error('Error:', err.response ? err.response.data : err.message);
  }
}
test();
