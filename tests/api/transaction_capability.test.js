'use strict';

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function run() {
  let session = null;
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('[Test] Connected to MongoDB at', process.env.MONGODB_URI);

    session = await mongoose.startSession();
    console.log('[Test] Session started successfully');

    session.startTransaction();
    console.log('[Test] Transaction started (in-memory state)');

    // Attempt a write operation within the transaction to force MongoDB to assign a transaction number
    const TestModel = mongoose.models.TestTx || mongoose.model('TestTx', new mongoose.Schema({ name: String }));
    await TestModel.create([{ name: 'Test' }], { session });
    
    await session.commitTransaction();
    console.log('[Test] SUCCESS: MongoDB transaction committed successfully.');
  } catch (err) {
    console.error('[Test] FAILED: MongoDB transaction capability test failed.');
    console.error(err);
  } finally {
    if (session) session.endSession();
    await mongoose.disconnect();
    console.log('[Test] Disconnected');
  }
}

run();
