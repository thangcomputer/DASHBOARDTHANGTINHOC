require('dotenv').config();
const jwt = require('jsonwebtoken');
const axios = require('axios');

async function test() {
  const token = jwt.sign(
    { id: '6a71758a8871061f8d4aea05', role: 'student' },
    process.env.JWT_SECRET || 'secret',
    { expiresIn: '1h' }
  );
  console.log('Generated token:', token);
  
  try {
    const meRes = await axios.get('http://localhost:5000/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Me res:', meRes.data);
  } catch (err) {
    console.error('Error:', err.response ? err.response.data : err.message);
  }
}
test();
