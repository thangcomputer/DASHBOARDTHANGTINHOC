'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { verifySepayRequest } = require('../../services/sepayWebhookAuth');

const secret = 'local-test-secret-only';
const rawBody = Buffer.from('{"id":123,"transferAmount":10000}', 'utf8');
const nowSeconds = 1_792_735_184;

function timestampedSignature(timestamp, body = rawBody) {
  const digest = crypto.createHmac('sha256', secret)
    .update(String(timestamp))
    .update('.')
    .update(body)
    .digest('hex');
  return `sha256=${digest}`;
}

describe('SePay webhook authentication', () => {
  it('accepts the current timestamped SePay HMAC format', () => {
    const timestamp = String(nowSeconds);
    const result = verifySepayRequest({
      headers: {
        'x-sepay-signature': timestampedSignature(timestamp),
        'x-sepay-timestamp': timestamp,
      },
      rawBody,
      hmacSecret: secret,
      nowSeconds,
    });

    assert.deepEqual(result, { valid: true, mechanism: 'hmac_timestamped' });
  });

  it('rejects a changed body and stale timestamps', () => {
    const timestamp = String(nowSeconds);
    const headers = {
      'x-sepay-signature': timestampedSignature(timestamp),
      'x-sepay-timestamp': timestamp,
    };
    assert.equal(verifySepayRequest({
      headers,
      rawBody: Buffer.from('{"id":123,"transferAmount":10001}', 'utf8'),
      hmacSecret: secret,
      nowSeconds,
    }).reason, 'invalid_signature');
    assert.equal(verifySepayRequest({
      headers: {
        ...headers,
        'x-sepay-timestamp': String(nowSeconds - 301),
      },
      rawBody,
      hmacSecret: secret,
      nowSeconds,
    }).reason, 'expired_timestamp');
  });

  it('keeps API Key and legacy HMAC verification working', () => {
    assert.deepEqual(verifySepayRequest({
      headers: { authorization: 'Apikey local-api-key' },
      rawBody,
      apiKey: 'local-api-key',
    }), { valid: true, mechanism: 'api_key' });

    const legacySignature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    assert.deepEqual(verifySepayRequest({
      headers: { 'x-sepay-token': legacySignature },
      rawBody,
      hmacSecret: secret,
    }), { valid: true, mechanism: 'hmac_legacy' });
  });

  it('rejects missing raw body and absent authentication configuration', () => {
    assert.equal(verifySepayRequest({
      headers: {},
      hmacSecret: secret,
    }).reason, 'missing_raw_body');
    assert.equal(verifySepayRequest({ headers: {} }).reason, 'not_configured');
  });
});
