'use strict';

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../../.env') });

const studentController = require('../../modules/student/controllers/StudentController');
const Student = require('../../models/Student');
const Invoice = require('../../models/Invoice');
const LedgerEntry = require('../../models/LedgerEntry');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const req = {
    user: { _id: new mongoose.Types.ObjectId(), tenantId: new mongoose.Types.ObjectId() },
    userBranchId: new mongoose.Types.ObjectId(),
    body: {
      name: 'Test Legacy Student',
      phone: '0777777777',
      zalo: '0777777777',
      email: 'legacy@example.com',
      password: 'password123',
      courseId: new mongoose.Types.ObjectId(),
      course: 'Legacy Course Name',
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
    process.env.ENABLE_CQRS_STUDENT_CREATE = 'false';
    await studentController.createStudent(req, res, next);
    
    // Verify DB
    const student = await Student.findOne({ phone: '0777777777' });
    console.log('Student created (legacy):', !!student);
    
    if (student) {
      const invoice = await Invoice.findOne({ hocVien: student._id });
      console.log('Invoice created (legacy):', !!invoice);
      
      let ledger = null;
      if (invoice) {
        ledger = await LedgerEntry.findOne({ referenceId: invoice._id }); // legacy uses referenceId
        console.log('Ledger created (legacy):', !!ledger);
      }

      // Clean up
      await Student.deleteOne({ _id: student._id });
      if (invoice) await Invoice.deleteOne({ _id: invoice._id });
      if (ledger) await LedgerEntry.deleteOne({ _id: ledger._id });
    }
    
  } catch (err) {
    console.error('Test failed:', err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
