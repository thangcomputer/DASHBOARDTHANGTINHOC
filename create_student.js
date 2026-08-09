const jwt = require('jsonwebtoken');

async function run() {
  try {
    const secret = 'thangTinHoc_secret_key_2026';
    const payload = {
      id: '6a757fd8d792949f55834fc0',
      username: 'super_admin_test',
      role: 'admin',
      adminRole: 'SUPER_ADMIN',
      permissions: ['manage_students'],
      aud: 'internal'
    };
    const token = jwt.sign(payload, secret, { expiresIn: '1h' });
    const dummyToken = 'dummy_csrf_token_for_test';

    const rand = Math.floor(Math.random() * 1000000);
    const phone = '09' + String(rand).padStart(8, '0');
    
    const studentData = {
      name: 'Local Runtime CQRS Student Rollback',
      phone: phone,
      zalo: phone,
      course: 'Khoa Hoc Test',
      price: 'invalid_price', // This will fail Mongoose number cast!
      paid: true,
      paidAmount: 5000000,
      isPaidOnCreate: true, 
      paymentMethod: 'transfer',
      password: 'password123',
      age: 20
    };

    const res = await fetch('http://localhost:5000/api/students', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'x-csrf-token': dummyToken,
        'Cookie': `csrf_token=${dummyToken}`
      },
      body: JSON.stringify(studentData)
    });

    const data = await res.json();
    console.log(`Status: ${res.status}`);
    console.log('Response:', JSON.stringify(data, null, 2));

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
