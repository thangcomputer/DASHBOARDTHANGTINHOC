
    const mongoose = require('mongoose');
    const OutboxEvent = require('./shared/outbox/OutboxEvent');
    const OutboxWorker = require('./shared/outbox/OutboxWorker');
    // Disable real dispatch to isolate the test
    const { eventBus } = require('./shared/cqrs');
    eventBus.publish = async (evt) => {
      console.log('Worker ' + process.argv[2] + ' dispatched event ' + evt.eventName);
    };

    async function work() {
      await mongoose.connect('mongodb://127.0.0.1:27018/dashboardthangtinhoc?replicaSet=rs0');
      // trigger exactly one poll
      await OutboxWorker.processOutbox();
      process.exit(0);
    }
    work();
  