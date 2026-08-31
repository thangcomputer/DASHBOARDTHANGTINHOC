'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeVNPhone,
  phoneLookupVariants,
  maskPhone,
} = require('../../utils/phoneIdentity');

test('phone identity normalizes supported Vietnamese formats', () => {
  assert.equal(normalizeVNPhone('0901 234 567'), '0901234567');
  assert.equal(normalizeVNPhone('0901.234.567'), '0901234567');
  assert.equal(normalizeVNPhone('0901-234-567'), '0901234567');
  assert.equal(normalizeVNPhone('+84 901 234 567'), '0901234567');
});

test('phone identity rejects malformed values without repairing letters', () => {
  for (const value of ['admin', 'a0901234567', 'user@example.com', '84901234567', '+1 901 234 567', '0123456789']) {
    assert.equal(normalizeVNPhone(value), '', value);
  }
});

test('phone identity provides bounded legacy variants and masked logging', () => {
  const variants = phoneLookupVariants('+84 901 234 567');
  assert.equal(variants.includes('0901234567'), true);
  assert.equal(variants.includes('+84901234567'), true);
  assert.equal(maskPhone('0901234567'), '090****567');
});
