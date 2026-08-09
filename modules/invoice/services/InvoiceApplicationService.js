'use strict';
const { invoiceRepository } = require('./../repositories');
const Invoice = require('./../models/Invoice'); // Temp for new Invoice
const Student = require('./../../student/models/Student');
const { generateInvoicePDF } = require('./../../pdfInvoice');
const { enqueueInvoicePdf, enqueueInvoiceEmail } = require('./../../../services/queue/jobQueue');
const logger = require('./../../../config/logger');
const { sanitizeRegex } = require('../../../middleware/sanitizeRegex');

// ─── GET /api/invoices ─────────────────────────────────────────────────────
// Admin/Staff: Lấy hóa đơn (STAFF bị giới hạn theo chi nhánh)

class InvoiceApplicationService {
  async get_root(data) {
    try {
      const { studentId, search, branchId: queryBranch, paymentMethod, from, to } = data.query;
      const filter = { ...data.branchFilter }; // {} for admin, {branchId:...} for staff

      // Admin có thể lọc thêm theo chi nhánh cụ thể qua query param
      if (queryBranch && queryBranch !== 'all' && !data.branchFilter?.branchId) {
        filter.branchId = queryBranch;
      }
      if (studentId) filter.hocVien = studentId;
      if (paymentMethod) filter.paymentMethod = paymentMethod;
      if (from || to) {
        filter.createdAt = {};
        if (from) filter.createdAt.$gte = new Date(from);
        if (to)   filter.createdAt.$lte = new Date(to);
      }
      if (search) {
        const safeSearch = sanitizeRegex(search);
        filter.$or = [
          { hoTen:    { $regex: safeSearch, $options: 'i' } },
          { khoaHoc:  { $regex: safeSearch, $options: 'i' } },
          { maHoaDon: { $regex: safeSearch, $options: 'i' } },
        ];
      }

      const invoices = await invoiceRepository.findMany(filter)
        .populate('hocVien', 'name course phone zalo paid paidAt branchId branchCode')
        .sort({ createdAt: -1 });

      return { _status: 200, _body: { success: true, count: invoices.length, data: invoices } };
    } catch (error) {
      return { _status: 500, _body: { success: false, message: error.message } };
    }
  }

  async get_stats(data) {
    try {
      // ⭐ Fix: branch-aware filter
      const bf = { ...data.branchFilter };
      // Admin có thể override bằng query param
      if (data.branch_id && data.branch_id !== 'all' && !data.userBranchId) {
        bf.branchId = data.branch_id;
      }

      const total = await invoiceRepository.count(bf);
      const revenueResult = await Invoice.aggregate([
        { $match: bf },
        { $group: { _id: null, total: { $sum: '$hocPhi' } } },
      ]);
      const totalRevenue = revenueResult[0]?.total || 0;

      // ⭐ Fix timezone: dùng UTC+7 cho "tháng hiện tại"
      const nowVN = new Date(new Date().getTime() + 7 * 60 * 60 * 1000);
      const startOfMonth = new Date(Date.UTC(nowVN.getUTCFullYear(), nowVN.getUTCMonth(), 1) - 7 * 60 * 60 * 1000);
      const thisMonthResult = await Invoice.aggregate([
        { $match: { ...bf, createdAt: { $gte: startOfMonth } } },
        { $group: { _id: null, total: { $sum: '$hocPhi' } } },
      ]);
      const thisMonthRevenue = thisMonthResult[0]?.total || 0;

      return { _status: 200, _body: { success: true, data: { total, totalRevenue, thisMonthRevenue } } };
    } catch (error) {
      return { _status: 500, _body: { success: false, message: error.message } };
    }
  }

  async get_id(data) {
    try {
      const invoice = await invoiceRepository.findById(data.id)
        .populate('hocVien', 'name course phone zalo address');
      
      if (!invoice) {
        return { _status: 404, _body: { success: false, message: 'Không tìm thấy hóa đơn' } };
      }

      // Bảo vệ: Chỉ Admin hoặc chính Student sở hữu hóa đơn mới được xem
      if (data.currentUser.role !== 'admin' && data.currentUser.id !== invoice.hocVien?._id?.toString()) {
        return { _status: 403, _body: { success: false, message: 'Bạn không có quyền xem hóa đơn này' } };
      }
      return { _status: 200, _body: { success: true, data: invoice } };
    } catch (error) {
      return { _status: 500, _body: { success: false, message: error.message } };
    }
  }

  async post_root(data) {
    try {
      const { hocVienId, ghiChu } = data.body;

      const student = await Student.findById(hocVienId);
      if (!student) {
        return { _status: 404, _body: { success: false, message: 'Không tìm thấy học viên' } };
      }

      // Tạo mã hóa đơn
      const count = await invoiceRepository.count();
      const now   = new Date();
      const maHD  = `HD${now.getFullYear().toString().slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}-${String(count + 1).padStart(4, '0')}`;

      const invoice = await invoiceRepository.create({
        maHoaDon: maHD,
        hocVien:  student._id,
        hoTen:    student.name,     // Student schema: name (không phải hoTen)
        khoaHoc:  student.course,   // Student schema: course (không phải khoaHoc)
        hocPhi:   student.price,    // Student schema: price (không phải hocPhi)
        ghiChu:   ghiChu || '',
        status:   'issued',
      });

      // C4: Tạo HĐ thủ công ≠ thu tiền. Không set student.paid — dùng PUT /students/:id/pay.

      // Sinh PDF nền (uploads/invoices) — không chặn response
      // skipSideEffects=true khi gọi từ CQRS handler (outbox đảm nhận PDF async)
      if (!data.skipSideEffects) {
        enqueueInvoicePdf({ invoiceId: invoice._id.toString() }).catch((err) => {
          logger.warn('[INVOICE] enqueue pdf on create:', err.message);
        });
      }

      return { _status: 201, _body: { success: true, data: invoice } };
    } catch (error) {
      if (error.code === 11000) {
        return { _status: 409, _body: { success: false, message: 'Mã hóa đơn đã tồn tại' } };
      }
      return { _status: 400, _body: { success: false, message: error.message } };
    }
  }

  async get_id_pdf(data) {
    try {
      const { res } = data;
      const invoice = await invoiceRepository.findById(data.id)
        .populate('hocVien', 'name course phone address');

      if (!invoice) {
        return { _status: 404, _body: { success: false, message: 'Không tìm thấy hóa đơn' } };
      }

      if (data.currentUser.role !== 'admin' && data.currentUser.id !== invoice.hocVien?._id?.toString()) {
        return { _status: 403, _body: { success: false, message: 'Bạn không có quyền xuất hóa đơn này' } };
      }

      const pdfBuffer = generateInvoicePDF({
        maHoaDon: invoice.maHoaDon,
        hoTen:    invoice.hoTen,
        khoaHoc:  invoice.khoaHoc,
        hocPhi:   invoice.hocPhi,
        ngayXuat: invoice.ngayXuat || invoice.createdAt,
        ghiChu:   invoice.ghiChu,
      });

      if (res) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=hoadon-${invoice.maHoaDon}.pdf`);
        res.send(Buffer.from(pdfBuffer));
        return;
      }
      return { _status: 200, _isSend: true, _body: Buffer.from(pdfBuffer) };
    } catch (error) {
      return { _status: 500, _body: { success: false, message: error.message } };
    }
  }

  async post_id_pdf_queue(data) {
    try {
      const invoice = await invoiceRepository.findById(data.id).select('_id maHoaDon');
      if (!invoice) {
        return { _status: 404, _body: { success: false, message: 'Không tìm thấy hóa đơn' } };
      }
      const job = await enqueueInvoicePdf({ invoiceId: invoice._id.toString() });
      return { _status: 200, _body: {
        success: true,
        message: 'Đã xếp hàng sinh PDF hóa đơn',
        data: { jobId: job.id, mode: job.mode, maHoaDon: invoice.maHoaDon },
      } };
    } catch (error) {
      logger.error('[INVOICE] pdf/queue:', error);
      return { _status: 500, _body: { success: false, message: error.message } };
    }
  }

  async post_id_email(data) {
    try {
      const invoice = await invoiceRepository.findById(data.id)
        .populate('hocVien', 'email name');
      if (!invoice) {
        return { _status: 404, _body: { success: false, message: 'Không tìm thấy hóa đơn' } };
      }

      const email = (data.body?.email || invoice.hocVien?.email || '').trim();
      if (!email) {
        return { _status: 400, _body: {
          success: false,
          message: 'Học viên chưa có email. Truyền body.email hoặc cập nhật hồ sơ học viên.',
        } };
      }

      const job = await enqueueInvoiceEmail({
        invoiceId: invoice._id.toString(),
        email,
      });

      return { _status: 200, _body: {
        success: true,
        message: `Đã xếp hàng gửi hóa đơn tới ${email}`,
        data: { jobId: job.id, mode: job.mode, email },
      } };
    } catch (error) {
      logger.error('[INVOICE] email:', error);
      return { _status: 500, _body: { success: false, message: error.message } };
    }
  }

  async delete_id(data) {
    try {
      const { allowHardDeleteFinance } = require('../../../utils/financeFlags');
      const invoice = await invoiceRepository.findById(data.id);
      if (!invoice) {
        return { _status: 404, _body: { success: false, message: 'Không tìm thấy hóa đơn' } };
      }
      if (!allowHardDeleteFinance()) {
        invoice.status = 'void';
        await invoice.save();
        return { _status: 200, _body: {
          success: true,
          message: `Đã void hóa đơn ${invoice.maHoaDon} (không xóa chứng từ)`,
          data: invoice,
        } };
      }
      await invoiceRepository.deleteById(data.id);
      return { _status: 200, _body: { success: true, message: `Đã xóa hóa đơn ${invoice.maHoaDon}` } };
    } catch (error) {
      return { _status: 500, _body: { success: false, message: error.message } };
    }
  }
}

module.exports = new InvoiceApplicationService();
