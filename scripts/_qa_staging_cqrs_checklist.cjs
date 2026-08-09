'use strict';
require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  const u = process.env.MONGODB_URI || '';
  const safe = u.replace(/:\/\/([^@]+)@/, '://***@');
  const hasReplica = /replicaSet=/i.test(u) || /^mongodb\+srv:/i.test(u);
  console.log('=== Phase A/B staging checklist ===');
  console.log('URI_SAFE=', safe || '(empty)');
  console.log('HAS_REPLICA_IN_URI=', hasReplica);
  console.log('ENABLE_CQRS_STUDENT_CREATE=', process.env.ENABLE_CQRS_STUDENT_CREATE || '(unset)');
  console.log('ENABLE_CQRS_INVOICE=', process.env.ENABLE_CQRS_INVOICE || '(unset)');
  console.log('ENABLE_CQRS_TEACHER=', process.env.ENABLE_CQRS_TEACHER || '(unset)');
  console.log('RUN_OUTBOX_WORKER=', process.env.RUN_OUTBOX_WORKER || '(unset → default 1)');

  if (!u) {
    console.log('RESULT=FAIL missing MONGODB_URI');
    process.exit(1);
  }

  try {
    await mongoose.connect(u, { serverSelectionTimeoutMS: 8000 });
    const admin = mongoose.connection.db.admin();
    let rsOk = false;
    let rsState = 'unknown';
    try {
      const status = await admin.command({ replSetGetStatus: 1 });
      rsOk = status.ok === 1;
      rsState = status.myState;
      console.log('RS_OK=', rsOk, 'myState=', rsState, '(1=PRIMARY)');
      console.log('RS_SET=', status.set);
    } catch (e) {
      console.log('RS_STATUS_ERROR=', e.codeName || e.message);
      // hello might still show setName
      try {
        const hello = await admin.command({ hello: 1 });
        console.log('HELLO_setName=', hello.setName || null, 'isWritablePrimary=', hello.isWritablePrimary);
        rsOk = Boolean(hello.setName);
      } catch (e2) {
        console.log('HELLO_ERROR=', e2.message);
      }
    }

    // Probe transactions
    let txOk = false;
    try {
      const session = await mongoose.startSession();
      await session.withTransaction(async () => {
        await mongoose.connection.db.collection('_cqrs_tx_probe').insertOne({ t: Date.now() }, { session });
      });
      session.endSession();
      await mongoose.connection.db.collection('_cqrs_tx_probe').deleteMany({});
      txOk = true;
      console.log('TRANSACTION_PROBE=OK');
    } catch (e) {
      console.log('TRANSACTION_PROBE=FAIL', e.codeName || e.message);
    }

    console.log('RESULT=', rsOk && txOk ? 'PASS_REPLICA_TX' : (txOk ? 'PASS_TX_ONLY' : 'FAIL'));
    await mongoose.disconnect();
    process.exit(rsOk && txOk ? 0 : 2);
  } catch (e) {
    console.log('CONNECT_FAIL=', e.message);
    console.log('RESULT=FAIL');
    process.exit(1);
  }
}

main();
