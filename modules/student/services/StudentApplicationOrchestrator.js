'use strict';

const CommandBus = require('../../../shared/cqrs/CommandBus');
const CreateStudentCommand = require('../commands/CreateStudentCommand');
const CreateInvoiceCommand = require('../../finance/commands/CreateInvoiceCommand');
const TransactionManager = require('../../../shared/transaction/TransactionManager');
const TransactionFactory = require('../../../shared/transaction/TransactionFactory');
const txManager = new TransactionManager(new TransactionFactory());

// We must create a singleton or similar. In a real app we'd use DI, but here we manually wire it.
// Assuming we have access to the registry in the controller.
class StudentApplicationOrchestrator {
  constructor(commandBus) {
    this.commandBus = commandBus;
  }

  async createStudentWithInvoice(payload) {
    return await txManager.execute(async (tx) => {
      // 1. Dispatch CreateStudentCommand
      const studentCommand = new CreateStudentCommand({
        actorId: payload.actorId,
        tenantId: payload.tenantId,
        branchId: payload.branchId,
        studentData: payload.studentData
      });

      const studentResult = await this.commandBus.dispatch(studentCommand);

      let invoiceResult = null;
      // 2. Dispatch CreateInvoiceCommand if paid
      if (payload.studentData.isPaidOnCreate && payload.studentData.price > 0) {
        const invoiceCommand = new CreateInvoiceCommand({
          studentId: studentResult._id,
          branchId: payload.branchId,
          courseId: payload.studentData.courseId,
          amount: payload.studentData.price,
          paidAmount: payload.studentData.paidAmount,
          paymentMethod: payload.studentData.paymentMethod,
          createdBy: payload.actorId
        });
        
        invoiceResult = await this.commandBus.dispatch(invoiceCommand);
      }

      // 3. Populate Branch logic
      const Branch = require('../../branch/models/Branch') || require('../../../models/Branch');
      let branchDoc = null;
      if (studentResult.branchId) {
        branchDoc = await Branch.findById(studentResult.branchId).select('name code').lean();
      }

      // 4. Construct HTTP 201 DTO EXACTLY like legacy
      const studentObj = { ...studentResult };
      delete studentObj.password;
      delete studentObj.refreshToken;
      delete studentObj.deviceFingerprint;

      if (branchDoc) {
        studentObj.branchName = branchDoc.name || branchDoc.code || '';
        studentObj.branchCode = studentObj.branchCode || branchDoc.code || '';
      }

      studentObj.welcomeQueued = false; // Downstream side-effect, sync response shouldn't guarantee it anymore or we simulate
      studentObj.welcomeNotified = false;
      studentObj.tempPassword = payload.studentData.password; // from plain password

      if (invoiceResult) {
        studentObj.invoice = {
          _id: invoiceResult._id,
          maHoaDon: invoiceResult.maHoaDon,
          hocPhi: invoiceResult.hocPhi,
        };
      }

      return studentObj;
    });
  }
}

module.exports = StudentApplicationOrchestrator;
