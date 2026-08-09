'use strict';

const mongoose = require('mongoose');
const TransactionContext = require('../../../shared/transaction/TransactionContext');
const LedgerEntry = require('../../../models/LedgerEntry'); // Adjust path later if needed

class CreateInvoiceHandler {
  async execute(command) {
    const InvoiceModel = mongoose.models.Invoice || mongoose.model('Invoice');
    const tx = TransactionContext.current();
    const session = tx ? tx.session : null;

    const count = await InvoiceModel.countDocuments();
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const maHoaDon = `HD${year}${month}-${String(count + 1).padStart(4, '0')}`;

    const invoice = new InvoiceModel({
      maHoaDon,
      hocVien: command.studentId,
      hoTen: command.studentName || 'Chưa rõ',
      khoaHoc: command.course || 'Chưa rõ',
      hocPhi: command.amount,
      branchId: command.branchId,
      status: 'issued' // the schema enum only has 'issued', 'void'
    });

    await invoice.save({ session });

    // Ledger entry to preserve legacy business rules identically
    if (command.status === 'paid' && command.amount > 0) {
      const ledgerEntry = new LedgerEntry({
        idempotencyKey: `init_invoice_${invoice._id}`,
        type: 'payment', // 'income' is not in enum, use 'payment'
        amount: command.paidAmount || command.amount,
        status: 'posted',
        studentId: command.studentId,
        branchId: command.branchId,
        invoiceId: invoice._id,
        courseName: command.course || 'Chưa rõ',
        note: `Thu học phí học viên`,
        postedBy: command.createdBy
      });
      await ledgerEntry.save({ session });
    }

    return invoice.toObject();
  }
}

module.exports = new CreateInvoiceHandler();
