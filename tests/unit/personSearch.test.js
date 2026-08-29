'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { buildStudentSearchAndConditions, splitSearchTokens } = require('../../utils/personSearchQuery');

describe('personSearchQuery (admin student list)', () => {
  it('splits họ / tên đệm / tên into tokens', () => {
    assert.deepEqual(splitSearchTokens('Nguyễn Văn Lan'), ['Nguyễn', 'Văn', 'Lan']);
    assert.deepEqual(splitSearchTokens('  LAN   090  '), ['LAN', '090']);
  });

  it('empty / punctuation-only search yields no extra filters', () => {
    assert.equal(buildStudentSearchAndConditions('').length, 0);
    assert.equal(buildStudentSearchAndConditions('   ').length, 0);
  });

  it('AND tokens so LAN NGUYỄN still matches regardless of order', () => {
    const conds = buildStudentSearchAndConditions('LAN NGUYỄN');
    assert.equal(conds.length, 2);
    assert.ok(conds[0].$or.some((c) => c.name));
    assert.ok(conds[0].$or.some((c) => c.phone));
  });

  it('nguyen (no accent) regex matches Nguyễn-class vowels', () => {
    const [cond] = buildStudentSearchAndConditions('nguyen');
    const nameReg = cond.$or.find((c) => c.name)?.name.$regex;
    assert.ok(typeof nameReg === 'string');
    assert.match(nameReg, /\[u/);
    assert.match(nameReg, /\[e/);
    const re = new RegExp(nameReg, 'i');
    assert.equal(re.test('NGUYỄN VĂN LAN'), true);
    assert.equal(re.test('Nguyen Van Lan'), true);
  });
});

describe('matchesPersonSearch (inbox / client)', async () => {
  const helperPath = path.join(__dirname, '../../client/src/utils/personSearch.js');
  const { matchesPersonSearch } = await import(pathToFileURL(helperPath).href);
  const person = { name: 'NGUYỄN VĂN LAN', phone: '090 289 5444', zalo: '0912345678' };

  it('matches họ, tên đệm, tên, and unordered tokens', () => {
    assert.equal(matchesPersonSearch('LAN', person), true);
    assert.equal(matchesPersonSearch('Văn', person), true);
    assert.equal(matchesPersonSearch('nguyen', person), true);
    assert.equal(matchesPersonSearch('LAN NGUYEN', person), true);
    assert.equal(matchesPersonSearch('xyz', person), false);
  });

  it('matches phone digits ignoring spaces', () => {
    assert.equal(matchesPersonSearch('090289', person), true);
    assert.equal(matchesPersonSearch('091234', person), true);
    assert.equal(matchesPersonSearch('000000', person), false);
  });
});
