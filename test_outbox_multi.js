const mongoose = require('mongoose');
const OutboxEvent = require('./shared/outbox/OutboxEvent');
const { fork } = require('child_process');
const fs = require('fs');

async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27018/dashboardthangtinhoc?replicaSet=rs0');
  
  // 1. Clear outbox
  await OutboxEvent.deleteMany({});
  
  // 2. Insert 1 event
  const evt = new OutboxEvent({
    eventType: 'StudentCreatedEvent',
    aggregateType: 'Student',
    aggregateId: new mongoose.Types.ObjectId().toString(),
    payload: { test: true },
    status: 'PENDING'
  });
  await evt.save();
  console.log('Inserted 1 PENDING event:', evt._id.toString());
  
  // 3. Spawn 5 workers
  const workerCode = `
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
  `;
  fs.writeFileSync('temp_outbox_multi.js', workerCode);
  
  // Launch 5 workers at exactly the same time
  let promises = [];
  for (let i = 1; i <= 5; i++) {
    promises.push(new Promise((resolve) => {
      const p = fork('temp_outbox_multi.js', [i.toString()]);
      p.on('exit', resolve);
    }));
  }
  
  await Promise.all(promises);
  console.log('Multi-worker test finished.');

  const eventInDb = await OutboxEvent.findById(evt._id);
  console.log('Final Event Status:', eventInDb.status);
  console.log('Worker ID claimed:', eventInDb.workerId);
  
  process.exit(0);
}
run();
