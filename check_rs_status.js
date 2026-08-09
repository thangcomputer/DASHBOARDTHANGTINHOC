const mongoose = require('mongoose');

async function run() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27018/?directConnection=true');
    const adminDb = mongoose.connection.db.admin();
    const result = await adminDb.command({ replSetGetStatus: 1 });
    const me = result.members.find(m => m.name === '127.0.0.1:27018' || m.self);
    console.log("State:", me.stateStr);
    if (me.stateStr === 'PRIMARY') {
      console.log("[SUCCESS] Node is PRIMARY");
    } else {
      console.log("[FAIL] Node is not PRIMARY");
    }
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
