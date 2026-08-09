const crypto = require('crypto');
const config = require('../../config/appConfig');
const logger = require('../../shared/logger/logger');

/**
 * Infrastructure Payment Service.
 * Isolates payment gateway integrations (SePay, etc.).
 */
const paymentService = {
  /**
   * Verify signature of incoming SePay webhook payload.
   *
   * @param {Object} headers - Express req.headers
   * @param {Object} body - Express req.body
   * @returns {boolean} true if verified, false otherwise
   */
  verifySePaySignature: (headers, body) => {
    const apiKey = config.sepay.apiKey;
    const hmacSecret = config.sepay.secretKey;

    // Dev/Test mode: skip if not configured and not in production
    if (!apiKey && !hmacSecret) {
      if (config.isProduction) {
        logger.error('[SEPAY] Webhook rejected — SEPAY_API_KEY / SEPAY_SECRET_KEY not configured in production');
        return false;
      }
      logger.warn('[SEPAY] Dev mode — webhook verification skipped (no SEPAY keys)');
      return true;
    }

    // 1. Verify via API Key (Authorization header or x-api-key)
    if (apiKey) {
      const authHeader = headers['authorization'] || '';
      const incomingKey = authHeader.replace(/^Apikey\s+/i, '').trim();
      if (incomingKey === apiKey) {
        return true;
      }
      if (headers['x-api-key'] === apiKey) {
        return true;
      }
    }

    // 2. Verify via HMAC signature (x-sepay-token header)
    if (hmacSecret) {
      const signature = headers['x-sepay-token'];
      if (!signature) {
        return false;
      }
      const rawBody = JSON.stringify(body);
      const expected = crypto.createHmac('sha256', hmacSecret).update(rawBody).digest('hex');
      return signature === expected;
    }

    return false;
  },
};

module.exports = paymentService;
