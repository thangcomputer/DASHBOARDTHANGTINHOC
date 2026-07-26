/**
 * Job processors: OTP / password / invoice email+PDF.
 * Khong log OTP/password day du.
 */
const path = require('path');
const fs = require('fs');
const logger = require('../../config/logger');
const { sendZaloText } = require('../messaging/zaloOa');
const { sendEmail } = require('../messaging/email');
const { generateInvoicePDF } = require('../../modules/pdfInvoice');

const INVOICE_DIR = path.join(__dirname, '..', '..', 'uploads', 'invoices');

function ensureInvoiceDir() {
  if (!fs.existsSync(INVOICE_DIR)) fs.mkdirSync(INVOICE_DIR, { recursive: true });
}

function maskSecret(s) {
  const str = String(s || '');
  if (str.length <= 2) return '**';
  return str.slice(0, 1) + '****' + str.slice(-1);
}

async function processOtpJob(data) {
  const { phone, email, otp, userName } = data || {};
  const name = userName || 'ban';
  const text =
    '[THANG TIN HOC] Ma OTP dat lai mat khau: ' + otp + '\n' +
    'Hieu luc 2 phut. Khong chia se ma nay cho bat ky ai.';

  const results = {};
  if (phone) {
    results.zalo = await sendZaloText(phone, text);
  }
  if (email) {
    results.email = await sendEmail({
      to: email,
      subject: '[Thang Tin Hoc] Ma OTP dat lai mat khau',
      text,
      html:
        '<p>Xin chao <b>' + name + '</b>,</p>' +
        '<p>Ma OTP: <b style="font-size:20px;letter-spacing:4px">' + otp + '</b></p>' +
        '<p>Hieu luc 2 phut. Khong chia se ma nay.</p>',
    });
  }
  logger.info({ phone: phone ? maskSecret(phone) : null, email: email ? maskSecret(email) : null, results }, '[Queue] OTP job done');
  return results;
}

async function processPasswordJob(data) {
  const { phone, email, password, userName } = data || {};
  const name = userName || 'ban';
  const text =
    '[THANG TIN HOC] Mat khau moi cua ban: ' + password + '\n' +
    'Vui long dang nhap va doi mat khau ngay.';

  const results = {};
  if (phone) {
    results.zalo = await sendZaloText(phone, text);
  }
  if (email) {
    results.email = await sendEmail({
      to: email,
      subject: '[Thang Tin Hoc] Mat khau moi',
      text,
      html:
        '<p>Xin chao <b>' + name + '</b>,</p>' +
        '<p>Mat khau moi: <b>' + password + '</b></p>' +
        '<p>Vui long dang nhap va doi mat khau ngay.</p>',
    });
  }
  logger.info({ phone: phone ? maskSecret(phone) : null, email: email ? maskSecret(email) : null, results }, '[Queue] Password job done');
  return results;
}

async function processInvoicePdfJob(data) {
  const Invoice = require('../../models/Invoice');
  const invoice = await Invoice.findById(data.invoiceId).lean();
  if (!invoice) throw new Error('Invoice not found');

  const pdfBuffer = Buffer.from(generateInvoicePDF({
    maHoaDon: invoice.maHoaDon,
    hoTen: invoice.hoTen,
    khoaHoc: invoice.khoaHoc,
    hocPhi: invoice.hocPhi,
    ngayXuat: invoice.ngayXuat || invoice.createdAt,
    ghiChu: invoice.ghiChu,
  }));

  ensureInvoiceDir();
  const filename = 'hoadon-' + invoice.maHoaDon + '.pdf';
  const filePath = path.join(INVOICE_DIR, filename);
  fs.writeFileSync(filePath, pdfBuffer);

  try {
    const fileService = require('../fileService');
    await fileService.registerExistingFile({
      category: 'invoices',
      filename,
      originalName: filename,
      mimeType: 'application/pdf',
      size: pdfBuffer.length,
      uploadedBy: 'system',
      uploadedByRole: 'system',
      relatedType: 'invoice',
      relatedId: String(invoice._id),
    });
  } catch (regErr) {
    logger.warn({ err: regErr.message }, '[Queue] FileAsset invoice register failed');
  }

  const result = { filePath: '/uploads/invoices/' + filename, maHoaDon: invoice.maHoaDon };

  if (data.email) {
    const emailRes = await sendEmail({
      to: data.email,
      subject: '[Thang Tin Hoc] Hoa don ' + invoice.maHoaDon,
      text: 'Dinh kem hoa don ' + invoice.maHoaDon + ' cho ' + invoice.hoTen + '.',
      html:
        '<p>Xin chao,</p><p>Dinh kem hoa don <b>' + invoice.maHoaDon +
        '</b> cho <b>' + invoice.hoTen + '</b>.</p>',
      attachments: [{ filename, content: pdfBuffer, contentType: 'application/pdf' }],
    });
    result.email = emailRes;
  }

  logger.info({ invoiceId: data.invoiceId, maHoaDon: invoice.maHoaDon, emailed: Boolean(data.email) }, '[Queue] Invoice PDF job done');
  return result;
}

async function processBackupJob(data) {
  const backupService = require('../backupService');
  if (!data?.jobId) throw new Error('Missing backup jobId');
  return backupService.runBackupJob(data.jobId);
}

async function processNotifyJob(jobName, data) {
  switch (jobName) {
    case 'otp':
      return processOtpJob(data);
    case 'password':
      return processPasswordJob(data);
    case 'invoice-email':
      return processInvoicePdfJob(data);
    case 'backup':
      return processBackupJob(data);
    default:
      throw new Error('Unknown notify job: ' + jobName);
  }
}

async function processPdfJob(jobName, data) {
  switch (jobName) {
    case 'invoice':
      return processInvoicePdfJob(data);
    default:
      throw new Error('Unknown pdf job: ' + jobName);
  }
}

module.exports = {
  processNotifyJob,
  processPdfJob,
  processOtpJob,
  processPasswordJob,
  processInvoicePdfJob,
  processBackupJob,
};