import assert from 'node:assert/strict';
import test from 'node:test';

function shouldShowLoginMessagePopup({ unread, ackedUnread = null, lmsOpen = false }) {
  return !lmsOpen && unread > 0 && (ackedUnread == null || unread > ackedUnread);
}

test('shows unread messages during login-time check', () => {
  assert.equal(shouldShowLoginMessagePopup({ unread: 2 }), true);
  assert.equal(shouldShowLoginMessagePopup({ unread: 2, ackedUnread: 1 }), true);
});

test('does not show the login popup for messages arriving during active LMS use', () => {
  assert.equal(shouldShowLoginMessagePopup({ unread: 2, lmsOpen: true }), false);
});

test('does not repeatedly show an already acknowledged unread count', () => {
  assert.equal(shouldShowLoginMessagePopup({ unread: 2, ackedUnread: 2 }), false);
});
