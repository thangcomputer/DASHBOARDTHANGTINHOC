const mongoose = require('mongoose');
const OutboxEvent = require('./shared/outbox/OutboxEvent');
const OutboxWorker1 = require('./shared/outbox/OutboxWorker');
// We need a separate instance or just mock it, but wait, OutboxWorker is a singleton.
// To run two workers, we can spawn two child processes.
const { fork } = require('child_process');
const path = require('path');

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
  
  // 3. Spawn 2 workers that run exactly the same code to process
  // We'll write a temporary script for the child process
  const fs = require('fs');
  const workerCode = `
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
  `;
  fs.writeFileSync('temp_worker.js', workerCode);
  
  // Launch both at the exact same time
  const p1 = fork('temp_worker.js', ['A']);
  const p2 = fork('temp_worker.js', ['B']);
  
  let p1Done = false, p2Done = false;
  p1.on('exit', () => { p1Done = true; checkDone(); });
  p2.on('exit', () => { p2Done = true; checkDone(); });
  
  function checkDone() {
    if (p1Done && p2Done) {
      console.log('Race test finished.');
      process.exit(0);
    }
  }
}
run();
