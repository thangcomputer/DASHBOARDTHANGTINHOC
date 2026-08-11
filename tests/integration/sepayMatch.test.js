const test = require('node:test');
const assert = require('node:assert/strict');
const {
  extractStudentCodeCandidates,
  amountsMatch,
  selectUnpaidStudentCandidates,
} = require('../../utils/sepayMatch');
const { formatCode, isCanonical, parseCanonicalSeq } = require('../../services/businessCodeService');

test('extractStudentCodeCandidates finds HV codes and case variants', () => {
  const v = extractStudentCodeCandidates('CK hoc phi HV46264900 Thang Tin Hoc');
  assert.ok(v.includes('hv46264900'));
  assert.ok(v.includes('HV46264900'));
});

test('extractStudentCodeCandidates finds TTH legacy tokens', () => {
  const v = extractStudentCodeCandidates('NguyenVan TTH12345 Nop hoc phi');
  assert.ok(v.some((x) => /^tth12345$/i.test(x)));
});

test('extractStudentCodeCandidates empty content → empty', () => {
  assert.deepEqual(extractStudentCodeCandidates(''), []);
  assert.deepEqual(extractStudentCodeCandidates(null), []);
});

test('amountsMatch allows 1đ tolerance and rejects non-positive expected', () => {
  assert.equal(amountsMatch(1500000, 1500000), true);
  assert.equal(amountsMatch(1500000, 1500001), true);
  assert.equal(amountsMatch(1500000, 1499998), false);
  assert.equal(amountsMatch(0, 999), false);
  assert.equal(amountsMatch(-1, 999), false);
});

test('selectUnpaidStudentCandidates: none / one / ambiguous fail-closed', () => {
  const amount = 1000000;
  const content = 'ck HV000001 nop hoc phi';

  assert.equal(
    selectUnpaidStudentCandidates([], content, amount).status,
    'none',
  );

  const one = selectUnpaidStudentCandidates(
    [{ _id: 'a', paid: false, studentCode: 'HV000001', price: amount }],
    content,
    amount,
  );
  assert.equal(one.status, 'one');
  assert.equal(one.candidates.length, 1);

  const amb = selectUnpaidStudentCandidates(
    [
      { _id: 'a', paid: false, studentCode: 'HV000001', price: amount },
      { _id: 'b', paid: false, legacyStudentCodes: ['HV000001'], price: amount },
    ],
    content,
    amount,
  );
  assert.equal(amb.status, 'ambiguous');
  assert.equal(amb.candidates.length, 2);
});

test('selectUnpaidStudentCandidates matches legacyStudentCodes', () => {
  const amount = 500000;
  const content = 'HV45836680 nop';
  const r = selectUnpaidStudentCandidates(
    [{
      _id: 'x',
      paid: false,
      studentCode: 'HV000001',
      legacyStudentCodes: ['HV45836680'],
      price: amount,
    }],
    content,
    amount,
  );
  assert.equal(r.status, 'one');
  assert.equal(r.candidates[0].matchedIdentity, 'hv45836680');
});

test('businessCode format helpers', () => {
  assert.equal(formatCode('student', 1), 'HV000001');
  assert.equal(formatCode('teacher', 12), 'GV000012');
  assert.equal(formatCode('employee', 3), 'NV000003');
  assert.equal(formatCode('course', 99), 'KH000099');
  assert.equal(isCanonical('student', 'HV000001'), true);
  assert.equal(isCanonical('student', 'HV45836680'), false);
  assert.equal(parseCanonicalSeq('student', 'HV000007'), 7);
  assert.throws(() => formatCode('student', 1000000));
});

test('HV000001 and GV000001 are independent labels (no assignment coupling)', () => {
  assert.equal(formatCode('student', 1), 'HV000001');
  assert.equal(formatCode('teacher', 1), 'GV000001');
  assert.notEqual(formatCode('student', 1), formatCode('teacher', 1));
});
