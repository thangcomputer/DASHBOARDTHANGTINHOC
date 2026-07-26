/**
 * SMTP email (nodemailer). Chi gui khi SMTP_HOST + SMTP_FROM duoc cau hinh.
 */
const nodemailer = require('nodemailer');
const logger = require('../../config/logger');

let transporter = null;

function isEmailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
}

function getTransporter() {
  if (!isEmailConfigured()) return null;
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === '1' || process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || '' }
      : undefined,
  });
  return transporter;
}

/**
 * @param {{ to: string, subject: string, text: string, html?: string, attachments?: any[] }} opts
 */
async function sendEmail(opts) {
  const t = getTransporter();
  if (!t) {
    logger.warn('[Email] Chua cau hinh SMTP_HOST / SMTP_FROM');
    return { ok: false, reason: 'not_configured' };
  }
  if (!opts?.to) return { ok: false, reason: 'no_recipient' };

  try {
    await t.sendMail({
      from: process.env.SMTP_FROM,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
      attachments: opts.attachments,
    });
    return { ok: true };
  } catch (e) {
    logger.warn({ err: e.message }, '[Email] Send failed');
    return { ok: false, reason: 'send_failed', error: e.message };
  }
}

module.exports = { isEmailConfigured, sendEmail };