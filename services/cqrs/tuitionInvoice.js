'use strict';

const Invoice = require('../../models/Invoice');
const logger = require('../../config/logger');

async function nextInvoiceCode(session = null) {
  const now = new Date();
  const yy = now.getFullYear().toString().slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = `HD${yy}${mm}-`;
  let q = Invoice.findOne({ maHoaDon: { $regex: `^${prefix}` } })
    .sort({ maHoaDon: -1 })
    .select('maHoaDon')
    .lean();
  if (session) q = q.session(session);
  const latest = await q;
  let seq = 1;
  if (latest?.maHoaDon) {
    const m = String(latest.maHoaDon).match(/-(\d+)$/);
    if (m) seq = Number(m[1]) + 1;
  }
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

async function createTuitionInvoice({ student, courseName, amount, note = '', session = null }) {
  const hocPhi = Number(amount) || 0;
  if (!student?._id || hocPhi <= 0) return null;
  try {
    let maHD = await nextInvoiceCode(session);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const payload = {
          maHoaDon: maHD,
          hocVien: student._id,
          hoTen: student.name,
          khoaHoc: courseName || student.course || 'Học phí',
          hocPhi,
          ghiChu: note || `Thanh toán khóa ${courseName || student.course || ''}`.trim(),
          branchId: student.branchId || undefined,
          status: 'issued',
        };
        if (session) {
          const [doc] = await Invoice.create([payload], { session });
          return doc;
        }
        return await Invoice.create(payload);
      } catch (err) {
        if (err?.code === 11000) {
          maHD = await nextInvoiceCode(session);
          continue;
        }
        throw err;
      }
    }
    return null;
  } catch (err) {
    logger.warn('[INVOICE] create skipped:', err.message);
    return null;
  }
}

module.exports = { nextInvoiceCode, createTuitionInvoice };
