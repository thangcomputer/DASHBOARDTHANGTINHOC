const mongoose = require('mongoose');

async function run() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27018/?directConnection=true');
    console.log("Connected. Initiating replica set...");
    const adminDb = mongoose.connection.db.admin();
    const result = await adminDb.command({
      replSetInitiate: {
        _id: 'rs0',
        members: [{ _id: 0, host: '127.0.0.1:27018' }]
      }
    });
    console.log("Result:", result);
  } catch (err) {
    if (err.message.includes('already initialized')) {
      console.log("Already initialized.");
    } else {
      console.error(err);
    }
  } finally {
    await mongoose.disconnect();
  }
}

run();
