require('dotenv').config();
const mongoose = require('mongoose');
const Student = require('./modules/student/models/Student');
const Invoice = require('./modules/invoice/models/Invoice');
const OutboxEvent = require('./shared/outbox/OutboxEvent');
const invoiceStrangler = require('./routes/invoiceRoutes'); // We need the CQRS path
// Actually it's better to just import the CQRS controller or trigger the HTTP request

// Let's test the controller directly to avoid full HTTP setup if possible
const invoiceController = require('./modules/invoice/controllers/InvoiceController');

async function runTest() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected.');

  // Mock mongoose transactions for standalone testing
  const realStartSession = mongoose.startSession.bind(mongoose);
  mongoose.startSession = async () => {
    const session = await realStartSession();
    session.startTransaction = () => {};
    session.commitTransaction = async () => {};
    session.abortTransaction = async () => {};
    return session;
  };

  try {
    // 1. Create a dummy student
    const student = await Student.create({
      name: 'Test CQRS Student',
      phone: '0987654321',
      zalo: '0987654321',
      course: 'Test Course',
      price: 500000,
      branchId: new mongoose.Types.ObjectId()
    });
    console.log(`Created test student: ${student._id}`);

    // 2. Prepare request object for InvoiceController
    const req = {
      body: {
        hocVienId: student._id.toString(),
        ghiChu: 'Test CQRS Integration'
      },
      currentUser: { id: 'admin', role: 'admin' },
      app: {}
    };

    const res = {
      status: function(code) {
        this.statusCode = code;
        return this;
      },
      json: function(data) {
        this.data = data;
        return this;
      },
      send: function(data) {
        this.data = data;
        return this;
      }
    };

    console.log('Dispatching POST /api/invoices via CQRS Controller...');
    await invoiceController.post_root(req, res);

    if (res.statusCode !== 201) {
      throw new Error(`Expected status 201, got ${res.statusCode}. Response: ${JSON.stringify(res.data)}`);
    }

    const createdInvoice = res.data.data;
    console.log(`Created invoice successfully: ${createdInvoice.maHoaDon}, ID: ${createdInvoice._id}`);

    // 3. Verify Outbox Record
    console.log('Checking Outbox for INVOICE_CREATED or INVOICE_PDF_QUEUED event...');
    const outboxRecords = await OutboxEvent.find({ aggregateId: createdInvoice._id.toString() }).sort({ createdAt: -1 });
    
    if (outboxRecords.length === 0) {
      console.warn('⚠️ No outbox records found for this invoice!');
    } else {
      console.log(`✅ Found ${outboxRecords.length} outbox record(s):`);
      outboxRecords.forEach(record => {
        console.log(`- Event: ${record.eventType}, Status: ${record.status}`);
      });
    }

    // 4. Run the OutboxWorker to verify event bus dispatch
    console.log('Running OutboxWorker to process pending events...');
    const OutboxWorker = require('./shared/outbox/OutboxWorker');
    
    // We need to ensure subscribers are registered before dispatching
    require('./modules/invoice/services/InvoiceApplicationService'); 
    require('./modules/invoice/events/index'); // Load the subscriber
    
    await OutboxWorker.processOutbox();
    
    // 5. Verify the Outbox Record is now PROCESSED
    const processedRecords = await OutboxEvent.find({ aggregateId: createdInvoice._id.toString() }).sort({ createdAt: -1 });
    processedRecords.forEach(record => {
      console.log(`- Event: ${record.eventType}, Status: ${record.status}`);
    });

  } catch (err) {
    console.error('Test Failed:', err);
  } finally {
    console.log('Cleaning up...');
    await Student.deleteMany({ name: 'Test CQRS Student' });
    await Invoice.deleteMany({ ghiChu: 'Test CQRS Integration' });
    const OutboxEvent = require('./shared/outbox/OutboxEvent');
    await OutboxEvent.deleteMany({ aggregateId: { $exists: true } }); // Clean all test outbox
    await mongoose.disconnect();
    console.log('Disconnected.');
  }
}

runTest();
