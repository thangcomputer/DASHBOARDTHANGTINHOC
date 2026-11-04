'use strict';

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../../.env') });

const { commandBus } = require('../../shared/cqrs');
const CQRSStudentController = require('../../modules/student/controllers/CQRSStudentController');
const Student = require('../../models/Student');
const Invoice = require('../../models/Invoice');
const LedgerEntry = require('../../models/LedgerEntry');
const OutboxEvent = require('../../shared/outbox/OutboxEvent');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);

  console.log('Connected to DB');

  // Initialize collections + indexes BEFORE any multi-doc transaction
  // (catalog/index builds inside a TX cause TransientTransactionError)
  await Student.createCollection().catch(() => {});
  await Invoice.createCollection().catch(() => {});
  await LedgerEntry.createCollection().catch(() => {});
  await OutboxEvent.createCollection().catch(() => {});
  await Student.syncIndexes().catch(() => {});
  await Invoice.syncIndexes().catch(() => {});
  await LedgerEntry.syncIndexes().catch(() => {});
  await OutboxEvent.syncIndexes().catch(() => {});
  // Cleanup prior test phone
  await Student.deleteMany({ phone: '0999999999' });
  await OutboxEvent.deleteMany({ 'payload.phone': '0999999999' });

  // Setup mock request and response
  const req = {
    user: { _id: new mongoose.Types.ObjectId(), tenantId: new mongoose.Types.ObjectId() },
    userBranchId: new mongoose.Types.ObjectId(),
    body: {
      name: 'Test CQRS Student',
      phone: '0999999999',
      zalo: '0999999999', // Added required field
      email: 'cqrs_test@example.com',
      password: 'password123',
      courseId: new mongoose.Types.ObjectId(), // Mock
      course: 'Test Course Name', // Added required field
      totalSessions: 12,
      price: 1500000,
      paidAmount: 1500000,
      isPaidOnCreate: true,
      paymentMethod: 'cash'
    }
  };

  const res = {
    status: function(code) {
      this.statusCode = code;
      return this;
    },
    json: function(data) {
      console.log('Response:', JSON.stringify(data, null, 2));
      return data;
    }
  };

  const next = function(err) {
    console.error('Next called with error:', err);
  };

  try {
    // Run controller manually
    await CQRSStudentController.create(req, res, next);
    
    // Verify DB
    const student = await Student.findOne({ phone: '0999999999' });
    console.log('Student created:', !!student);
    
    if (student) {
      const invoice = await Invoice.findOne({ hocVien: student._id });
      console.log('Invoice created:', !!invoice);
      
      let ledger = null;
      if (invoice) {
        ledger = await LedgerEntry.findOne({ invoiceId: invoice._id });
        console.log('Ledger created:', !!ledger);
      }

      const outbox = await OutboxEvent.findOne({ aggregateId: student._id });
      console.log('Outbox event created:', !!outbox);

      // Clean up
      await Student.deleteOne({ _id: student._id });
      if (invoice) await Invoice.deleteOne({ _id: invoice._id });
      if (ledger) await LedgerEntry.deleteOne({ _id: ledger._id });
      if (outbox) await OutboxEvent.deleteOne({ _id: outbox._id });
    }
    
  } catch (err) {
    console.error('Test failed:', err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
