const mongoose = require('mongoose');

async function getAdmin() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27018/dashboardthangtinhoc?replicaSet=rs0');
    const db = mongoose.connection.db;
    
    // Check if there is any teacher with admin role
    const admin = await db.collection('teachers').findOne({ $or: [{ role: 'admin' }, { role: 'staff' }] });
    
    if (admin) {
      console.log('Found admin in teachers:', admin._id.toString(), admin.username, admin.role, admin.adminRole);
    } else {
      console.log('No admin found in teachers collection');
      // Just create one for testing
      const testId = new mongoose.Types.ObjectId();
      await db.collection('teachers').insertOne({
        _id: testId,
        username: 'super_admin_test',
        role: 'admin',
        adminRole: 'SUPER_ADMIN',
        status: 'active',
        permissions: ['manage_students', 'manage_teachers', 'manage_courses']
      });
      console.log('Created test admin:', testId.toString());
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
getAdmin();
