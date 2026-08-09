const mongoose = require('mongoose');
const Redis = require('ioredis');

async function run() {
  console.log('--- ENVIRONMENT CHECK ---');
  console.log('Node:', process.version);
  
  try {
    await mongoose.connect('mongodb://127.0.0.1:27018/dashboardthangtinhoc?replicaSet=rs0', { serverSelectionTimeoutMS: 5000 });
    const admin = mongoose.connection.db.admin();
    const rsStatus = await admin.command({ replSetGetStatus: 1 });
    console.log('MongoDB Replica Set: PASS (', rsStatus.set, ')');
    const primary = rsStatus.members.find(m => m.stateStr === 'PRIMARY');
    console.log('Primary Node:', primary ? primary.name : 'NONE');
  } catch (err) {
    console.log('MongoDB Replica Set: FAIL', err.message);
  }

  try {
    const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
    const redis = new Redis(redisUrl, { maxRetriesPerRequest: 1, connectTimeout: 2000 });
    
    redis.on('error', (err) => {
      console.log('Redis Connection: FAIL', err.message);
      process.exit(0);
    });

    await redis.ping();
    console.log('Redis Connection: PASS');
    process.exit(0);
  } catch (err) {
    console.log('Redis Connection: FAIL', err.message);
    process.exit(0);
  }
}
run();
