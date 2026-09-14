import assert from 'node:assert/strict';
import test from 'node:test';
import { isRealAvatar, resolveAvatarUrl } from '../src/utils/defaultAvatars.js';

test('uses avatar aliases returned by contacts and messaging payloads', () => {
  assert.equal(resolveAvatarUrl({ avatarUrl: '/uploads/users/avatar.png', role: 'student' }), '/uploads/users/avatar.png');
  assert.equal(resolveAvatarUrl({ photo: 'https://cdn.example/avatar.jpg', role: 'teacher' }), 'https://cdn.example/avatar.jpg');
  assert.equal(isRealAvatar('https://cdn.example/avatar.jpg'), true);
});

test('keeps role and gender fallback consistent with the shared avatar system', () => {
  assert.equal(resolveAvatarUrl({ role: 'teacher', gender: 'female' }), '/avatars/teacher_female.png');
  assert.equal(resolveAvatarUrl({ role: 'staff', adminRole: 'SUPPORT' }), '/avatars/support_male.png');
});
