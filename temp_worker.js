
    const mongoose = require('mongoose');
    const OutboxEvent = require('./shared/outbox/OutboxEvent');
    async function work() {
      await mongoose.connect('mongodb://127.0.0.1:27018/dashboardthangtinhoc?replicaSet=rs0');
      const pendingEvents = await OutboxEvent.find({ status: 'PENDING' }).sort({ createdAt: 1 }).limit(50);
      for (const record of pendingEvents) {
        console.log('Worker ' + process.argv[2] + ' claimed event ' + record._id);
        record.status = 'PROCESSED';
        await record.save();
      }
      process.exit(0);
    }
    work();
  