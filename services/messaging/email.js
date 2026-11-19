/**
 * SMTP email (nodemailer). Ho tro cau hinh SMTP_HOST/SMTP_FROM hoac GMAIL_USER + GMAIL_APP_PASSWORD.
 */
const nodemailer = require('nodemailer');
const logger = require('../../config/logger');

let transporter = null;
let transporterCacheKey = '';

function resolveEmailConfig() {
  const gmailUser = String(process.env.GMAIL_USER || '').trim();
  const gmailAppPassword = String(process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');
  if (gmailUser && gmailAppPassword) {
    const from = String(process.env.SMTP_FROM || '').trim() || `"Thang Tin Hoc" <${gmailUser}>`;
    return {
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: gmailUser, pass: gmailAppPassword },
      from,
      cacheKey: `gmail:${gmailUser}`,
    };
  }

  const host = String(process.env.SMTP_HOST || '').trim();
  const user = String(process.env.SMTP_USER || '').trim();
  const pass = String(process.env.SMTP_PASS || '');
  const from = String(process.env.SMTP_FROM || '').trim() || (user.includes('@') ? user : '');
  if (!host || !from) return null;

  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE === '1' || process.env.SMTP_SECURE === 'true' || port === 465;
  return {
    host,
    port,
    secure,
    auth: user ? { user, pass } : undefined,
    from,
    cacheKey: `smtp:${host}:${port}:${secure}:${user}:${from}`,
  };
}

function isEmailConfigured() {
  return Boolean(resolveEmailConfig());
}

function getTransporter() {
  const cfg = resolveEmailConfig();
  if (!cfg) return null;
  if (transporter && transporterCacheKey === cfg.cacheKey) {
    return { transporter, from: cfg.from };
  }
  transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.auth,
  });
  transporterCacheKey = cfg.cacheKey;
  return { transporter, from: cfg.from };
}

/**
 * @param {{ to: string, subject: string, text: string, html?: string, attachments?: any[] }} opts
 */
async function sendEmail(opts) {
  const ready = getTransporter();
  if (!ready) {
    logger.warn('[Email] Chua cau hinh SMTP_HOST/SMTP_FROM hoac GMAIL_USER/GMAIL_APP_PASSWORD');
    return { ok: false, reason: 'not_configured' };
  }
  if (!opts?.to) return { ok: false, reason: 'no_recipient' };

  try {
    await ready.transporter.sendMail({
      from: ready.from,
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
