'use strict';

/**
 * SMS gateway adapter cho OTP quen mat khau.
 * Ho tro: eSMS.vn, SpeedSMS.vn, Twilio, hoac SMS_WEBHOOK_URL tuy chinh.
 */
const axios = require('axios');
const logger = require('../../config/logger');
const { normalizeVNPhone, maskPhone } = require('../../utils/phoneIdentity');

function toE164VN(canonicalPhone) {
  const p = normalizeVNPhone(canonicalPhone);
  return p ? `+84${p.slice(1)}` : '';
}

function getSmsProvider() {
  if (process.env.ESMS_API_KEY && process.env.ESMS_SECRET_KEY) return 'esms';
  if (process.env.SPEEDSMS_ACCESS_TOKEN) return 'speedsms';
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER) {
    return 'twilio';
  }
  if (process.env.SMS_WEBHOOK_URL) return 'webhook';
  return '';
}

function isSmsConfigured() {
  return Boolean(getSmsProvider());
}

async function sendViaEsms(canonicalPhone, message) {
  const payload = {
    ApiKey: String(process.env.ESMS_API_KEY).trim(),
    SecretKey: String(process.env.ESMS_SECRET_KEY).trim(),
    Phone: canonicalPhone,
    Content: message,
    SmsType: String(process.env.ESMS_SMS_TYPE || '2'),
    ...(process.env.ESMS_BRANDNAME ? { Brandname: String(process.env.ESMS_BRANDNAME).trim() } : {}),
  };
  const resp = await axios.post(
    'https://rest.esms.vn/MainService.svc/json/SendMultipleMessage_V4_post_json/',
    payload,
    { timeout: 10000 },
  );
  const code = String(resp.data?.CodeResult ?? '');
  if (code !== '100') {
    return { ok: false, reason: 'provider_error', provider: 'esms', error: resp.data?.ErrorMessage || code };
  }
  return { ok: true, provider: 'esms' };
}

async function sendViaSpeedSms(canonicalPhone, message) {
  const token = String(process.env.SPEEDSMS_ACCESS_TOKEN).trim();
  const basicAuth = Buffer.from(`${token}:x`).toString('base64');
  const payload = {
    to: [canonicalPhone],
    content: message,
    sms_type: Number(process.env.SPEEDSMS_SMS_TYPE || 2),
    ...(process.env.SPEEDSMS_SENDER ? { sender: String(process.env.SPEEDSMS_SENDER).trim() } : {}),
  };
  const resp = await axios.post('https://api.speedsms.vn/index.php/sms/send', payload, {
    timeout: 10000,
    headers: { Authorization: `Basic ${basicAuth}` },
  });
  if (resp.data?.status !== 'success') {
    return { ok: false, reason: 'provider_error', provider: 'speedsms', error: resp.data?.message || 'failed' };
  }
  return { ok: true, provider: 'speedsms' };
}

async function sendViaTwilio(canonicalPhone, message) {
  const sid = String(process.env.TWILIO_ACCOUNT_SID).trim();
  const token = String(process.env.TWILIO_AUTH_TOKEN).trim();
  const from = String(process.env.TWILIO_FROM_NUMBER).trim();
  const to = toE164VN(canonicalPhone);
  const auth = Buffer.from(`${sid}:${token}`).toString('base64');
  const body = new URLSearchParams({ To: to, From: from, Body: message });
  await axios.post(
    `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`,
    body.toString(),
    {
      timeout: 10000,
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    },
  );
  return { ok: true, provider: 'twilio' };
}

async function sendViaWebhook(canonicalPhone, message, code) {
  const url = String(process.env.SMS_WEBHOOK_URL).trim();
  const secret = String(process.env.SMS_WEBHOOK_TOKEN || '').trim();
  await axios.post(
    url,
    {
      phone: canonicalPhone,
      e164Phone: toE164VN(canonicalPhone),
      message,
      code,
      brand: 'Thang Tin Hoc',
    },
    {
      timeout: 10000,
      headers: secret ? { Authorization: `Bearer ${secret}` } : undefined,
    },
  );
  return { ok: true, provider: 'webhook' };
}

async function sendSms({ phone, message, code = '' }) {
  const canonicalPhone = normalizeVNPhone(phone);
  if (!canonicalPhone) return { ok: false, reason: 'invalid_phone' };
  const provider = getSmsProvider();
  if (!provider) {
    logger.warn({ phone: maskPhone(canonicalPhone) }, '[SMS] Chua cau hinh cong SMS');
    return { ok: false, reason: 'not_configured' };
  }

  try {
    if (provider === 'esms') return await sendViaEsms(canonicalPhone, message);
    if (provider === 'speedsms') return await sendViaSpeedSms(canonicalPhone, message);
    if (provider === 'twilio') return await sendViaTwilio(canonicalPhone, message);
    return await sendViaWebhook(canonicalPhone, message, code);
  } catch (err) {
    logger.warn({ err: err.message, provider, phone: maskPhone(canonicalPhone) }, '[SMS] Send failed');
    return { ok: false, reason: 'send_failed', provider, error: err.message };
  }
}

module.exports = {
  getSmsProvider,
  isSmsConfigured,
  sendSms,
};
