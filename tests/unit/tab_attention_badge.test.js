'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function loadTabAttention() {
  const modUrl = pathToFileURL(path.resolve(__dirname, '../../client/src/utils/tabAttention.js')).href;
  return import(modUrl);
}

describe('tabAttention browser favicon/title & PWA badge helpers', () => {
  it('formatBadgeCount formats counts cleanly and caps above 99', async () => {
    const { formatBadgeCount } = await loadTabAttention();
    assert.equal(formatBadgeCount(0), '');
    assert.equal(formatBadgeCount(-5), '');
    assert.equal(formatBadgeCount(null), '');
    assert.equal(formatBadgeCount(1), '1');
    assert.equal(formatBadgeCount(9), '9');
    assert.equal(formatBadgeCount(99), '99');
    assert.equal(formatBadgeCount(100), '99+');
    assert.equal(formatBadgeCount(250), '99+');
  });

  it('buildAttentionTitle alternates blink phases cleanly and restores baseTitle at 0', async () => {
    const { buildAttentionTitle } = await loadTabAttention();

    assert.equal(
      buildAttentionTitle({ baseTitle: 'Bảng điều khiển', unreadMessages: 0, unreadNotifications: 0, phase: 1 }),
      'Bảng điều khiển',
    );

    assert.equal(
      buildAttentionTitle({ baseTitle: 'Hộp thư', unreadMessages: 3, unreadNotifications: 0, phase: 0, lang: 'vi' }),
      '(3) Hộp thư',
    );
    assert.equal(
      buildAttentionTitle({ baseTitle: 'Hộp thư', unreadMessages: 3, unreadNotifications: 0, phase: 1, lang: 'vi' }),
      '💬 (3) Tin nhắn mới!',
    );

    assert.equal(
      buildAttentionTitle({ baseTitle: 'Dashboard', unreadMessages: 0, unreadNotifications: 2, phase: 1, lang: 'en' }),
      '🔔 (2) New notification!',
    );

    assert.equal(
      buildAttentionTitle({ baseTitle: 'Bảng điều khiển', unreadMessages: 2, unreadNotifications: 4, phase: 1, lang: 'vi' }),
      '🔴 (6) Tin nhắn & thông báo mới!',
    );
  });

  it('syncNavigatorAppBadge calls setAppBadge when > 0 and clearAppBadge when 0 without throwing on unsupported objects', async () => {
    const { syncNavigatorAppBadge } = await loadTabAttention();
    const calls = [];
    const mockNav = {
      setAppBadge(n) {
        calls.push(['set', n]);
        return Promise.resolve();
      },
      clearAppBadge() {
        calls.push(['clear']);
        return Promise.resolve();
      },
    };

    syncNavigatorAppBadge(mockNav, 5);
    syncNavigatorAppBadge(mockNav, 0);
    syncNavigatorAppBadge({}, 3);
    syncNavigatorAppBadge(null, 0);

    assert.deepEqual(calls, [['set', 5], ['clear']]);
  });
});
