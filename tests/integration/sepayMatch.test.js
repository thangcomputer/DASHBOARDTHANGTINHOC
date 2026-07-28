const test = require('node:test');
const assert = require('node:assert/strict');
const { extractStudentCodeCandidates, amountsMatch } = require('../../utils/sepayMatch');

test('extractStudentCodeCandidates finds HV codes and case variants', () => {
  const v = extractStudentCodeCandidates('CK hoc phi HV46264900 Thang Tin Hoc');
  assert.ok(v.includes('hv46264900'));
  assert.ok(v.includes('HV46264900'));
});

test('extractStudentCodeCandidates empty content → empty', () => {
  assert.deepEqual(extractStudentCodeCandidates(''), []);
  assert.deepEqual(extractStudentCodeCandidates(null), []);
});

test('amountsMatch allows 1đ tolerance and free when price 0', () => {
  assert.equal(amountsMatch(1500000, 1500000), true);
  assert.equal(amountsMatch(1500000, 1500001), true);
  assert.equal(amountsMatch(1500000, 1499998), false);
  assert.equal(amountsMatch(0, 999), true);
});
