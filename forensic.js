const mongoose = require('mongoose');

async function run() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27018/dashboardthangtinhoc?replicaSet=rs0');
    const db = mongoose.connection.db;
    
    // Find any student with name containing 'Rollback'
    const student = await db.collection('students').findOne({ name: /Rollback/i });
    console.log('Orphan Student Exists:', !!student);
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
