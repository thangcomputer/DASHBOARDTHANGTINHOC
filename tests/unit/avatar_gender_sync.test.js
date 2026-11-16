'use strict';

/**
 * PHASE AVATAR-GENDER-SYNC-1 - normalizeGender + resolveAvatarUrl + auth payload.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

const avatarsPath = path.join(__dirname, '../../client/src/utils/defaultAvatars.js');
const authPath = path.join(__dirname, '../../routes/authRoutes.js');
const editablePath = path.join(__dirname, '../../client/src/components/EditableAvatar.jsx');
const sidebarPath = path.join(__dirname, '../../client/src/components/AppSidebar.jsx');
const avatarCompPath = path.join(__dirname, '../../client/src/components/admin/shared/Avatar.jsx');

describe('avatar gender sync - normalizeGender + resolveAvatarUrl', async () => {
  const mod = await import(pathToFileURL(avatarsPath).href);
  const {
    normalizeGender,
    resolveAvatarUrl,
    buildInitialAvatarDataUrl,
    isRealAvatar,
    isAvatarUrl,
    DEFAULT_AVATARS,
  } = mod;

  it('normalizeGender: Nam/Nữ/nu/Male/Female → male|female|unknown', () => {
    assert.equal(normalizeGender('Nam'), 'male');
    assert.equal(normalizeGender('nam'), 'male');
    assert.equal(normalizeGender('male'), 'male');
    assert.equal(normalizeGender('MALE'), 'male');
    assert.equal(normalizeGender('Nữ'), 'female');
    assert.equal(normalizeGender('nữ'), 'female');
    assert.equal(normalizeGender('nu'), 'female');
    assert.equal(normalizeGender('female'), 'female');
    assert.equal(normalizeGender(''), 'unknown');
    assert.equal(normalizeGender(null), 'unknown');
    assert.equal(normalizeGender('other'), 'unknown');
  });

  it('fallback without uploaded avatar renders blank SVG or name initial (no cartoon assets)', () => {
    const male = resolveAvatarUrl({ role: 'student', gender: 'male' });
    const female = resolveAvatarUrl({ role: 'student', gender: 'female' });
    const unknown = resolveAvatarUrl({ role: 'student', gender: '' });
    assert.equal(male, DEFAULT_AVATARS.student_unknown);
    assert.equal(female, DEFAULT_AVATARS.student_unknown);
    assert.equal(unknown, DEFAULT_AVATARS.student_unknown);
    assert.ok(unknown.startsWith('data:image/svg+xml;utf8,'));
  });

  it('resolveAvatarUrl renders uppercase initial letter when name is present', () => {
    const withName = resolveAvatarUrl({ role: 'student', name: 'Bùi Thị Ngân' });
    const blank = buildInitialAvatarDataUrl('');
    assert.ok(withName.startsWith('data:image/svg+xml;utf8,'));
    assert.notEqual(withName, blank);
    assert.ok(decodeURIComponent(withName).includes('>B<'));
  });

  it('H/I uploaded avatar wins over default fallback', () => {
    const up = '/uploads/avatars/x.jpg';
    assert.equal(
      resolveAvatarUrl({ avatar: up, role: 'student', gender: 'female' }),
      up,
    );
    assert.equal(
      resolveAvatarUrl({ avatar: 'https://cdn.example/a.png', role: 'teacher', gender: 'male' }),
      'https://cdn.example/a.png',
    );
  });

  it('initials are NOT real avatars', () => {
    assert.equal(isRealAvatar('TH'), false);
    assert.equal(isAvatarUrl('TH'), false);
    assert.equal(isRealAvatar('/uploads/a.png'), true);
    const url = resolveAvatarUrl({ avatar: 'TH', role: 'student', gender: 'female' });
    assert.ok(url.startsWith('data:image/svg+xml;utf8,'));
  });

  it('default entries use neutral SVG data URIs without gender bias', () => {
    assert.equal(DEFAULT_AVATARS.staff_male, DEFAULT_AVATARS.staff_female);
    assert.ok(DEFAULT_AVATARS.student.startsWith('data:image/svg+xml;utf8,'));
  });
});

describe('avatar gender sync - static UI/API wiring', () => {
  const auth = fs.readFileSync(authPath, 'utf8');
  const editable = fs.readFileSync(editablePath, 'utf8');
  const sidebar = fs.readFileSync(sidebarPath, 'utf8');
  const avatarComp = fs.readFileSync(avatarCompPath, 'utf8');

  it('login userData includes avatar + gender at top level', () => {
    assert.ok(/avatar:\s*user\.avatar\s*\|\|\s*''/.test(auth));
    assert.ok(/gender:\s*user\.gender\s*\|\|\s*''/.test(auth));
  });

  it('/me includes gender for DB users and root admin', () => {
    assert.ok(auth.includes("router.get('/me'"));
    assert.ok(/gender:\s*user\.gender\s*\|\|\s*''/.test(auth));
    assert.ok(/gender:\s*''/.test(auth)); // root admin unknown
  });

  it('EditableAvatar + AppSidebar pass gender', () => {
    assert.ok(editable.includes('gender'));
    assert.ok(editable.includes('gender,'));
    assert.ok(sidebar.includes('gender={effectiveGender}') || sidebar.includes('gender={session?.gender}'));
    assert.ok(sidebar.includes('effectiveGender'));
  });

  it('EditableAvatar prevents upload click recursion and renders crop dialog outside the avatar', () => {
    assert.ok(editable.includes('onClick={(event) => event.stopPropagation()}'));
    assert.ok(editable.includes('createPortal('));
    assert.ok(editable.includes('document.body'));
  });

  it('Avatar onError falls back to initial / blank background without cartoon image', () => {
    assert.ok(avatarComp.includes('setImgFailed(true)'));
    assert.ok(avatarComp.includes('getNameInitial'));
  });
});
