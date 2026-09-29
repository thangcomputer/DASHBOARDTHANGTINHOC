'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { getTodayAgeReferenceDate } = require('../../utils/studentAge');

test('age reference date uses the Vietnam calendar day', () => {
  assert.equal(
    getTodayAgeReferenceDate(new Date('2026-09-29T17:30:00.000Z')),
    '2026-09-30',
  );
});
