const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/dashboard_thangtinhoc').then(async () => {
  const Message = require('./models/Message');
  const Teacher = require('./models/Teacher');
  const Student = require('./models/Student');
  const ConversationVisibility = require('./models/ConversationVisibility');

  console.log('Fetching messages...');
  const messages = await Message.find({}).lean();
  console.log(`Found ${messages.length} total messages.`);
  
  const userIds = new Set();
  messages.forEach(m => {
    if (m.senderId && m.senderId !== 'admin') userIds.add(m.senderId.toString());
    if (m.receiverId && m.receiverId !== 'admin' && !m.receiverId.toString().startsWith('ALL_') && !m.receiverId.toString().startsWith('group_')) {
      userIds.add(m.receiverId.toString());
    }
  });
  
  console.log(`Found ${userIds.size} unique user IDs involved in chats.`);
  const idsArray = Array.from(userIds);
  
  const teachers = await Teacher.find({ _id: { $in: idsArray } }, '_id').lean();
  const students = await Student.find({ _id: { $in: idsArray } }, '_id').lean();
  
  const existingIds = new Set([
    ...teachers.map(t => t._id.toString()),
    ...students.map(s => s._id.toString())
  ]);
  
  let deletedCount = 0;
  for (const m of messages) {
    const sId = m.senderId ? m.senderId.toString() : null;
    const rId = m.receiverId ? m.receiverId.toString() : null;
    
    const senderMissing = sId && sId !== 'admin' && !existingIds.has(sId);
    
    const isSpecialReceiver = rId && (rId === 'admin' || rId.startsWith('ALL_') || rId.startsWith('group_'));
    const receiverMissing = rId && !isSpecialReceiver && !existingIds.has(rId);
    
    if (senderMissing || receiverMissing) {
      await Message.findByIdAndDelete(m._id);
      deletedCount++;
    }
  }
  
  console.log(`✅ Cleaned up ${deletedCount} orphaned messages (sender/receiver no longer exists).`);

  // Clean up ConversationVisibility as well
  const visibilities = await ConversationVisibility.find({}).lean();
  let deletedVisCount = 0;
  for (const v of visibilities) {
    if (v.hiddenByUsers && v.hiddenByUsers.length > 0) {
      const validUsers = v.hiddenByUsers.filter(uId => uId === 'admin' || existingIds.has(uId));
      if (validUsers.length !== v.hiddenByUsers.length) {
        if (validUsers.length === 0) {
          await ConversationVisibility.findByIdAndDelete(v._id);
          deletedVisCount++;
        } else {
          await ConversationVisibility.findByIdAndUpdate(v._id, { hiddenByUsers: validUsers });
        }
      }
    }
  }
  console.log(`✅ Cleaned up ${deletedVisCount} orphaned visibility records.`);

  process.exit(0);
}).catch(err => {
  console.error('Lỗi kết nối CSDL:', err.message);
  process.exit(1);
});
