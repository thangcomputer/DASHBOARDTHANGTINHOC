'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('mobile student profile password change', () => {
  it('exposes password change to students and opens the shared password form', () => {
    const profile = read('thang-tin-hoc-mobile/src/screens/FeatureScreens.tsx');
    const passwordService = read('thang-tin-hoc-mobile/src/services/mockService.ts');

    assert.ok(profile.includes('title="Thay đổi mật khẩu"'));
    assert.ok(profile.includes('onPress={() => setShowPasswordForm(true)}'));
    assert.ok(profile.includes('{showPasswordForm ? ('));
    assert.ok(profile.includes('await authService.changePassword(oldPassword, newPassword)'));
    assert.ok(passwordService.includes("mobileApiRequest('/auth/change-password'"));
  });
});
