const mongoose = require('mongoose');
const Message = require('./models/Message');
const Teacher = require('./models/Teacher');
const Student = require('./models/Student');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  console.log('Connected to DB');
  
  // 1. Delete old hardcoded support messages
  const res1 = await Message.deleteMany({
    $or: [{ senderId: 'support' }, { receiverId: 'support' }]
  });
  console.log('Deleted hardcoded support messages:', res1.deletedCount);
  
  // 2. Delete messages where sender/receiver is NOT admin, NOT system, and NOT in Teacher/Student collections
  const senders = await Message.distinct('senderId');
  const receivers = await Message.distinct('receiverId');
  const allIds = [...new Set([...senders, ...receivers])];
  
  let deletedOrphanCount = 0;
  for (const id of allIds) {
    if (id === 'admin' || id === 'system' || id === 'ALL_USERS' || id === 'ALL_STUDENTS' || id === 'ALL_TEACHERS') continue;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      const del = await Message.deleteMany({
        $or: [{ senderId: id }, { receiverId: id }]
      });
      console.log('Deleted ' + del.deletedCount + ' messages for invalid ID: ' + id);
      deletedOrphanCount += del.deletedCount;
      continue;
    }
    
    const [t, s] = await Promise.all([
      Teacher.findById(id).lean(),
      Student.findById(id).lean()
    ]);
    
    if (!t && !s) {
      const del = await Message.deleteMany({
        $or: [{ senderId: id }, { receiverId: id }]
      });
      console.log('Deleted ' + del.deletedCount + ' messages for orphaned user ID: ' + id);
      deletedOrphanCount += del.deletedCount;
    }
  }
  console.log('Deleted total orphaned messages:', deletedOrphanCount);
  
  process.exit(0);
}).catch(console.error);
