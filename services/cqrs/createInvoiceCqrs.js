'use strict';

const Student = require('../../models/Student');
const Invoice = require('../../models/Invoice');
const OutboxEvent = require('../../shared/outbox/OutboxEvent');
const { withTransaction } = require('../../shared/cqrs/withTransaction');
const logger = require('../../config/logger');

/**
 * CQRS create invoice: Invoice + OutboxEvent (PDF via outbox).
 */
async function createInvoiceCqrs(req) {
  const { hocVienId, ghiChu } = req.body || {};

  const student = await Student.findById(hocVienId);
  if (!student) {
    const err = new Error('Không tìm thấy học viên');
    err.status = 404;
    throw err;
  }

  try {
    const invoice = await withTransaction(async (session) => {
      const count = await Invoice.countDocuments().session(session);
      const now = new Date();
      const maHD = `HD${now.getFullYear().toString().slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}-${String(count + 1).padStart(4, '0')}`;

      const [doc] = await Invoice.create([{
        maHoaDon: maHD,
        hocVien: student._id,
        hoTen: student.name,
        khoaHoc: student.course,
        hocPhi: student.price,
        ghiChu: ghiChu || '',
        status: 'issued',
        branchId: student.branchId || undefined,
      }], { session });

      await OutboxEvent.create([{
        eventType: 'InvoiceCreatedEvent',
        aggregateType: 'Invoice',
        aggregateId: doc._id,
        payload: {
          invoiceId: doc._id.toString(),
          maHoaDon: doc.maHoaDon,
          studentId: student._id.toString(),
        },
        status: 'PENDING',
        branchId: student.branchId || undefined,
        actorId: req.user?._id || undefined,
      }], { session });

      return doc;
    });

    return {
      status: 201,
      body: { success: true, data: invoice },
    };
  } catch (error) {
    if (error.code === 11000) {
      error.status = 409;
      error.message = 'Mã hóa đơn đã tồn tại';
    }
    logger.error({ err: error.message }, '[CQRS] createInvoice failed');
    throw error;
  }
}

module.exports = { createInvoiceCqrs };
