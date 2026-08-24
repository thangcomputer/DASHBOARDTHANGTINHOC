/**
 * Test: Safe Null Guards in SocketContext Notification Handlers
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('SocketContext Notification Safe Null-Guards Verification', () => {

  it('1. SocketContext notification handlers have safe guards against undefined payload', () => {
    const code = read('client/src/context/SocketContext.jsx');
    assert.ok(code.includes('if (!data || typeof data !== \'object\') return;'));
    assert.ok(code.includes('if (notif && typeof notif === \'object\''));
    assert.ok(code.includes('Array.isArray(data.data)'));
  });

  it('2. onReceiveNotification logic handles null/undefined data safely', () => {
    let notifications = [];
    const setNotifications = (updater) => {
      notifications = typeof updater === 'function' ? updater(notifications) : updater;
    };

    const handleReceive = (data) => {
      if (!data || typeof data !== 'object') return;
      setNotifications((prev) => {
        const list = Array.isArray(prev) ? prev.filter(Boolean) : [];
        const id = data._id || data.id || Date.now();
        if (list.some((n) => n && (n.id === id || n._id === id))) {
          return list.map((n) => (n && (n.id === id || n._id === id) ? { ...n, ...data, id, read: false } : n));
        }
        return [{
          ...data,
          id,
          read: Boolean(data.read),
          message: data.content || data.message || '',
          time: data.createdAt || data.time || new Date(),
        }, ...list];
      });
    };

    // Test with undefined
    assert.doesNotThrow(() => handleReceive(undefined));
    // Test with null
    assert.doesNotThrow(() => handleReceive(null));
    // Test with empty object
    assert.doesNotThrow(() => handleReceive({}));
    // Test with valid notification
    assert.doesNotThrow(() => handleReceive({ _id: 'notif_1', content: 'Phân công GV' }));
    assert.equal(notifications.length, 2); // empty obj + valid notif
    assert.equal(notifications[0].id, 'notif_1');
  });

  it('3. onNewNotification handles empty / undefined signal safely', () => {
    let notifications = [null, undefined, { id: 'existing_1', message: 'Hello' }];
    const setNotifications = (updater) => {
      notifications = typeof updater === 'function' ? updater(notifications) : updater;
    };

    const handleNew = (notif) => {
      if (notif && typeof notif === 'object' && (notif._id || notif.id || notif.message || notif.content)) {
        setNotifications((prev) => {
          const list = Array.isArray(prev) ? prev.filter(Boolean) : [];
          const id = notif._id || notif.id || Date.now();
          if (list.some((n) => n && (n.id === id || n._id === id))) {
            return list.map((n) => (n && (n.id === id || n._id === id) ? { ...n, ...notif, id, read: false } : n));
          }
          return [{
            ...notif,
            id,
            read: false,
            message: notif.content || notif.message || '',
            time: notif.createdAt || notif.time || new Date(),
          }, ...list];
        });
      }
    };

    // Trigger signal without payload (new-notification emit with no args)
    assert.doesNotThrow(() => handleNew(undefined));
    assert.doesNotThrow(() => handleNew(null));
    // Trigger with valid notif object
    assert.doesNotThrow(() => handleNew({ _id: 'n_2', content: 'Gán GV mới' }));
    assert.equal(notifications[0].id, 'n_2');
  });
});
