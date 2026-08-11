'use strict';

/**
 * UI helpers: learningMode label + branch display (mode-like name → code fallback).
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const fs = require('node:fs');

const helperPath = path.join(
  __dirname,
  '../../client/src/utils/learningModeBranchDisplay.js',
);
const tabPath = path.join(
  __dirname,
  '../../client/src/components/admin/tabs/AdminStudentsTab.jsx',
);

describe('learningModeBranchDisplay helpers', async () => {
  const mod = await import(pathToFileURL(helperPath).href);
  const {
    resolveLearningModeLabel,
    isModeLikeBranchName,
    resolveBranchDisplayName,
  } = mod;

  it('OFFLINE → Trực tiếp, ONLINE → Online', () => {
    assert.equal(resolveLearningModeLabel('OFFLINE'), 'Trực tiếp');
    assert.equal(resolveLearningModeLabel('ONLINE'), 'Online');
    assert.equal(resolveLearningModeLabel(''), 'Trực tiếp');
  });

  it('detects mode-like branch names', () => {
    assert.equal(isModeLikeBranchName('online'), true);
    assert.equal(isModeLikeBranchName('ONLINE'), true);
    assert.equal(isModeLikeBranchName('TRỰC TIẾP'), true);
    assert.equal(isModeLikeBranchName('trực tiếp'), true);
    assert.equal(isModeLikeBranchName('Chi nhánh Online'), true);
    assert.equal(isModeLikeBranchName('Tại cơ sở'), true);
    assert.equal(isModeLikeBranchName('Chi nhánh 1'), false);
    assert.equal(isModeLikeBranchName('CS Quận 1'), false);
    assert.equal(isModeLikeBranchName('CS2'), false);
  });

  it('Case A: normal offline branch name', () => {
    assert.equal(
      resolveBranchDisplayName({ name: 'Chi nhánh 1', code: 'CS1' }, 'OFFLINE'),
      'Chi nhánh 1',
    );
  });

  it('Case B: online + mode-like name → code', () => {
    assert.equal(
      resolveBranchDisplayName({ name: 'online', code: 'CS-ONL' }, 'ONLINE'),
      'CS-ONL',
    );
  });

  it('Case C: TRỰC TIẾP + CS1 → CS1', () => {
    assert.equal(
      resolveBranchDisplayName({ name: 'TRỰC TIẾP', code: 'CS1' }, 'OFFLINE'),
      'CS1',
    );
  });

  it('Case D: Chi nhánh Online → code', () => {
    assert.equal(
      resolveBranchDisplayName({ name: 'Chi nhánh Online', code: 'CS-ONL' }, 'ONLINE'),
      'CS-ONL',
    );
  });

  it('Case E/F: missing branch', () => {
    assert.equal(resolveBranchDisplayName(null, 'OFFLINE'), 'Chưa phân chi nhánh');
    assert.equal(resolveBranchDisplayName(undefined, 'ONLINE'), 'Chưa phân chi nhánh');
  });

  it('Case G: CS Quận 1 kept as name', () => {
    assert.equal(
      resolveBranchDisplayName({ name: 'CS Quận 1' }, 'OFFLINE'),
      'CS Quận 1',
    );
  });

  it('Case H: CS2 kept as name', () => {
    assert.equal(
      resolveBranchDisplayName({ name: 'CS2' }, 'ONLINE'),
      'CS2',
    );
  });

  it('mode-like name without code → Chưa phân chi nhánh', () => {
    assert.equal(
      resolveBranchDisplayName({ name: 'online' }, 'ONLINE'),
      'Chưa phân chi nhánh',
    );
  });
});

describe('ModeBranchBadges wiring (static)', () => {
  it('AdminStudentsTab uses shared helpers and Trực tiếp label path', () => {
    const src = fs.readFileSync(tabPath, 'utf8');
    assert.match(src, /resolveLearningModeLabel/);
    assert.match(src, /resolveBranchDisplayName/);
    assert.match(src, /learningModeBranchDisplay/);
    assert.doesNotMatch(src, /> Offline</);
    assert.doesNotMatch(src, /Chưa phân cơ sở/);
  });
});
