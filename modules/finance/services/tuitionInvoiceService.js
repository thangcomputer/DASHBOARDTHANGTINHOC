'use strict';

const Invoice = require('../../../models/Invoice');
const logger = require('../../../config/logger');

async function nextInvoiceCode() {
  const now = new Date();
  const yy = now.getFullYear().toString().slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = `HD${yy}${mm}-`;
  const latest = await Invoice.findOne({ maHoaDon: { $regex: `^${prefix}` } })
    .sort({ maHoaDon: -1 })
    .select('maHoaDon')
    .lean();
  let seq = 1;
  if (latest?.maHoaDon) {
    const match = String(latest.maHoaDon).match(/-(\d+)$/);
    if (match) seq = Number(match[1]) + 1;
  }
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

async function createTuitionInvoice({ student, courseName, amount, note = '' }) {
  const hocPhi = Number(amount) || 0;
  if (!student?._id || hocPhi <= 0) return null;

  try {
    let maHD = await nextInvoiceCode();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        return await Invoice.create({
          maHoaDon: maHD,
          hocVien: student._id,
          hoTen: student.name,
          khoaHoc: courseName || student.course || 'Học phí',
          hocPhi,
          ghiChu: note || `Thanh toán khóa ${courseName || student.course || ''}`.trim(),
        });
      } catch (err) {
        if (err?.code !== 11000) throw err;
        maHD = await nextInvoiceCode();
      }
    }
    return null;
  } catch (err) {
    logger.warn('[INVOICE] create skipped:', err.message);
    return null;
  }
}

module.exports = { createTuitionInvoice };
