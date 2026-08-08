'use strict';

const { eventBus } = require('../events/EventBus');
const { sendAccountWelcome } = require('../../services/accountWelcome');
const logger = require('../../config/logger');

let registered = false;

/**
 * Side-effect handlers for outbox events (at-least-once).
 * Welcome/PDF must tolerate duplicates.
 */
function registerOutboxHandlers() {
  if (registered) return;
  registered = true;

  eventBus.subscribe('TeacherCreatedEvent', {
    async handle(event) {
      const p = event.payload || {};
      const io = global.io || null;
      if (p.plainPassword) {
        await sendAccountWelcome(io, {
          role: 'teacher',
          userId: p.teacherId,
          name: p.name,
          phone: p.phone,
          email: p.email,
          password: p.plainPassword,
        });
      }
      if (io && p.teacherId) {
        io.emit('teacher:new', {
          teacherId: p.teacherId,
          name: p.name,
          branchCode: p.branchCode,
          message: `Giảng viên mới: ${p.name} — Chi nhánh: ${p.branchCode || 'Chưa phân'}`,
        });
      }
      logger.info({ teacherId: p.teacherId }, '[Outbox] TeacherCreatedEvent handled');
    },
  });

  eventBus.subscribe('StudentCreatedEvent', {
    async handle(event) {
      const p = event.payload || {};
      const io = global.io || null;
      if (p.plainPassword) {
        await sendAccountWelcome(io, {
          role: 'student',
          userId: p.studentId,
          name: p.name,
          phone: p.phone,
          zalo: p.zalo,
          email: p.email,
          password: p.plainPassword,
        });
      }
      logger.info({ studentId: p.studentId }, '[Outbox] StudentCreatedEvent handled');
    },
  });

  eventBus.subscribe('InvoiceCreatedEvent', {
    async handle(event) {
      const p = event.payload || {};
      if (!p.invoiceId) return;
      try {
        const { enqueueInvoicePdf } = require('../../services/queue/jobQueue');
        await enqueueInvoicePdf({ invoiceId: String(p.invoiceId) });
      } catch (err) {
        logger.warn({ err: err.message, invoiceId: p.invoiceId }, '[Outbox] Invoice PDF enqueue failed');
        throw err;
      }
    },
  });
}

module.exports = { registerOutboxHandlers };
