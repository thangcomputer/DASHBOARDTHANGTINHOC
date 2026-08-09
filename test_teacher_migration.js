require('dotenv').config();
const mongoose = require('mongoose');
const teacherStrangler = require('./modules/teacher/routes/teacherStrangler');
const Teacher = require('./modules/teacher/models/Teacher');
const OutboxEvent = require('./shared/outbox/OutboxEvent');
require('./modules/teacher/commands'); // Register command handlers
const EventEmitter = require('events');

function createMockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    send(data) {
      this.body = data;
      return this;
    }
  };
  return res;
}

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');

    const testBranchId = new mongoose.Types.ObjectId().toString();
    const currentUser = { id: new mongoose.Types.ObjectId().toString(), role: 'admin' };
    const app = { get: (key) => (key === 'io' ? new EventEmitter() : null) };

    // CLEANUP
    await Teacher.deleteMany({ phone: '0999999999' });
    await OutboxEvent.deleteMany({ 'payload.phone': '0999999999' });
    await Teacher.deleteMany({ phone: 'INVALID_PHONE_ERROR' });

    console.log('\n--- 1. REAL RUNTIME AUDIT (LEGACY) ---');
    process.env.ENABLE_CQRS_TEACHER = 'false';
    
    let req = {
      body: { name: 'Legacy Teacher', phone: '0999999999', branchId: testBranchId },
      currentUser,
      app,
      ip: '127.0.0.1',
      headers: {}
    };
    let res = createMockRes();
    
    await teacherStrangler.post_root(req, res, (err) => console.log('Next called:', err));
    
    console.log('Legacy POST HTTP Status:', res.statusCode);
    console.log('Legacy POST Success:', res.body?.success);
    console.log('Legacy POST Body:', res.body);
    
    let teacher = await Teacher.findOne({ phone: '0999999999' });
    console.log('Legacy Teacher Created:', !!teacher);
    let outbox = await OutboxEvent.findOne({ aggregateId: teacher?._id });
    console.log('Legacy Outbox Event Exists:', !!outbox);

    // CLEANUP
    await Teacher.deleteMany({ phone: '0999999999' });

    console.log('\n--- 2. REAL RUNTIME AUDIT (CQRS) ---');
    process.env.ENABLE_CQRS_TEACHER = 'true';
    
    req = {
      body: { name: 'CQRS Teacher', phone: '0999999999', branchId: testBranchId },
      currentUser,
      app,
      ip: '127.0.0.1',
      headers: {}
    };
    res = createMockRes();
    
    await teacherStrangler.post_root(req, res, (err) => console.log('Next called:', err));
    
    console.log('CQRS POST HTTP Status:', res.statusCode);
    console.log('CQRS POST Success:', res.body?.success);
    console.log('CQRS POST Body:', res.body);
    
    teacher = await Teacher.findOne({ phone: '0999999999' });
    console.log('CQRS Teacher Created:', !!teacher);
    outbox = await OutboxEvent.findOne({ aggregateId: teacher?._id });
    console.log('CQRS Outbox Event Exists:', !!outbox);
    if (outbox) {
      console.log('CQRS Outbox Event Type:', outbox.eventType);
      console.log('CQRS Outbox Payload PlainPassword:', !!outbox.payload.plainPassword);
    }

    // CLEANUP
    await Teacher.deleteMany({ phone: '0999999999' });
    await OutboxEvent.deleteMany({ 'payload.phone': '0999999999' });

    console.log('\n--- 3. ROLLBACK AUDIT ---');
    req = {
      // Missing phone or invalid data should trigger a validation error, 
      // but wait, to test transactional rollback of OutboxEvent, the failure MUST occur inside the handler
      // Let's monkeypatch TeacherApplicationService to throw error
      body: { name: 'Rollback Teacher', phone: '0999999999' },
      currentUser,
      app,
      ip: '127.0.0.1',
      headers: {}
    };
    res = createMockRes();

    const CommandBus = require('./shared/cqrs/CommandBus');
    const teacherApplicationService = require('./modules/teacher/services/TeacherApplicationService');
    const originalPostRoot = teacherApplicationService.post_root;
    
    teacherApplicationService.post_root = async function(data) {
      // Manually create the OutboxEvent first to simulate a mid-flight state that needs rollback
      const TransactionContext = require('./shared/transaction/TransactionContext');
      const tx = TransactionContext.current();
      await OutboxEvent.create([{
        eventType: 'TeacherCreatedEvent',
        aggregateId: new mongoose.Types.ObjectId(),
        aggregateType: 'Teacher',
        payload: { phone: '0999999999' },
        status: 'PENDING'
      }], { session: tx.session });

      throw new Error('INTENTIONAL_ROLLBACK');
    };

    try {
      await teacherStrangler.post_root(req, res, (err) => console.log('Next called:', err));
    } catch(e) {
      console.log('CQRS Threw Error:', e.message);
    }
    
    console.log('Rollback POST HTTP Status:', res.statusCode);
    teacher = await Teacher.findOne({ phone: '0999999999' });
    console.log('Teacher after rollback exists:', !!teacher);
    outbox = await OutboxEvent.findOne({ 'payload.phone': '0999999999' });
    console.log('Outbox after rollback exists:', !!outbox);

  } catch (err) {
    console.error('Test failed:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
