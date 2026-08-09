
    const mongoose = require('mongoose');
    const OutboxEvent = require('./shared/outbox/OutboxEvent');
    const OutboxWorker = require('./shared/outbox/OutboxWorker');
    const { eventBus } = require('./shared/cqrs');
    eventBus.publish = async (evt) => {
      console.log('CrashWorker claimed event, now crashing...');
      process.exit(1); // Simulate hard crash
    };

    async function work() {
      await mongoose.connect('mongodb://127.0.0.1:27018/dashboardthangtinhoc?replicaSet=rs0');
      await OutboxWorker.processOutbox();
    }
    work();
  