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

  // Override CreateInvoiceHandler to simulate a forced failure
  const CreateInvoiceHandler = require('../../modules/finance/commands/CreateInvoiceHandler');
  const originalExecute = CreateInvoiceHandler.execute.bind(CreateInvoiceHandler);
  CreateInvoiceHandler.execute = async (command) => {
    throw new Error('INTENTIONAL_INVOICE_FAILURE');
  };

  const req = {
    user: { _id: new mongoose.Types.ObjectId(), tenantId: new mongoose.Types.ObjectId() },
    userBranchId: new mongoose.Types.ObjectId(),
    body: {
      name: 'Rollback Student',
      phone: '0888888888',
      zalo: '0888888888',
      email: 'rollback@example.com',
      password: 'password123',
      courseId: new mongoose.Types.ObjectId(),
      course: 'Rollback Course',
      totalSessions: 12,
      price: 1500000,
      paidAmount: 1500000,
      isPaidOnCreate: true,
      paymentMethod: 'cash'
    }
  };

  const res = {
    status: (code) => res,
    json: (data) => data
  };
  const next = (err) => console.log('Expected error caught in Next:', err.message);

  try {
    await CQRSStudentController.create(req, res, next);
    
    // VERIFY ROLLBACK
    const student = await Student.findOne({ phone: '0888888888' });
    const outbox = await OutboxEvent.findOne({ 'payload.phone': '0888888888' });
    
    console.log('Student persisted after rollback:', !!student);
    console.log('Outbox persisted after rollback:', !!outbox);

    if (!student && !outbox) {
      console.log('ROLLBACK TEST SUCCESSFUL');
    } else {
      console.log('ROLLBACK TEST FAILED');
    }
  } finally {
    // Restore
    CreateInvoiceHandler.execute = originalExecute;
    await mongoose.disconnect();
  }
}

run();
