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
  
  // 3. Worker A that crashes during processing
  const crashWorker = `
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
  `;
  fs.writeFileSync('temp_outbox_crash.js', crashWorker);
  
  // 4. Worker B that tries to process afterwards
  const safeWorker = `
    const mongoose = require('mongoose');
    const OutboxEvent = require('./shared/outbox/OutboxEvent');
    const OutboxWorker = require('./shared/outbox/OutboxWorker');
    const { eventBus } = require('./shared/cqrs');
    eventBus.publish = async (evt) => {
      console.log('SafeWorker claimed event! (THIS SHOULD NOT HAPPEN)');
    };

    async function work() {
      await mongoose.connect('mongodb://127.0.0.1:27018/dashboardthangtinhoc?replicaSet=rs0');
      await OutboxWorker.processOutbox();
      process.exit(0);
    }
    work();
  `;
  fs.writeFileSync('temp_outbox_safe.js', safeWorker);
  
  // Run Crash Worker
  await new Promise(resolve => {
    const p1 = fork('temp_outbox_crash.js');
    p1.on('exit', resolve);
  });
  
  const midEvent = await OutboxEvent.findById(evt._id);
  console.log('Status after crash:', midEvent.status);

  // Run Safe Worker
  await new Promise(resolve => {
    const p2 = fork('temp_outbox_safe.js');
    p2.on('exit', resolve);
  });

  const finalEvent = await OutboxEvent.findById(evt._id);
  console.log('Final Event Status:', finalEvent.status);
  
  process.exit(0);
}
run();
