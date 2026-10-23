'use strict';

const crypto = require('crypto');

function timingSafeEqualString(a, b) {
  const left = Buffer.from(String(a || ''), 'utf8');
  const right = Buffer.from(String(b || ''), 'utf8');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function verifySepayRequest({
  headers = {},
  rawBody,
  apiKey = '',
  hmacSecret = '',
  nowSeconds = Math.floor(Date.now() / 1000),
}) {
  const configuredApiKey = String(apiKey || '').trim();
  const configuredHmacSecret = String(hmacSecret || '').trim();
  const authHeader = String(headers.authorization || '');
  const authorizationKey = authHeader.replace(/^Apikey\s+/i, '').trim();
  const headerKey = String(headers['x-api-key'] || '').trim();

  if (
    configuredApiKey
    && (timingSafeEqualString(authorizationKey, configuredApiKey)
      || timingSafeEqualString(headerKey, configuredApiKey))
  ) {
    return { valid: true, mechanism: 'api_key' };
  }

  if (configuredHmacSecret) {
    const body = Buffer.isBuffer(rawBody) ? rawBody : null;
    if (!body) return { valid: false, reason: 'missing_raw_body' };

    const signature = String(headers['x-sepay-signature'] || '').trim();
    const timestamp = String(headers['x-sepay-timestamp'] || '').trim();
    if (signature || timestamp) {
      if (!/^\d{1,12}$/.test(timestamp)) {
        return { valid: false, reason: 'invalid_timestamp' };
      }
      const timestampSeconds = Number(timestamp);
      if (Math.abs(nowSeconds - timestampSeconds) > 300) {
        return { valid: false, reason: 'expired_timestamp' };
      }
      const digest = crypto.createHmac('sha256', configuredHmacSecret)
        .update(timestamp)
        .update('.')
        .update(body)
        .digest('hex');
      if (!timingSafeEqualString(signature, `sha256=${digest}`)) {
        return { valid: false, reason: 'invalid_signature' };
      }
      return { valid: true, mechanism: 'hmac_timestamped' };
    }

    const legacySignature = String(headers['x-sepay-token'] || '').trim();
    const legacyDigest = crypto.createHmac('sha256', configuredHmacSecret)
      .update(body)
      .digest('hex');
    if (timingSafeEqualString(legacySignature, legacyDigest)) {
      return { valid: true, mechanism: 'hmac_legacy' };
    }
    return { valid: false, reason: 'invalid_signature' };
  }

  if (configuredApiKey) return { valid: false, reason: 'invalid_api_key' };
  return { valid: false, reason: 'not_configured' };
}

module.exports = { verifySepayRequest };
