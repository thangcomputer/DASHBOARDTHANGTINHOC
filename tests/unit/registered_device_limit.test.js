'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  decideRegisteredDeviceAccess,
  claimInMemory,
} = require('../../services/registeredDeviceService');

test('device A and B register, C is rejected even after A and B log out of sessions', () => {
  const registered = [];
  const a = decideRegisteredDeviceAccess(registered, 'device-a', false);
  assert.equal(a.allow, true);
  assert.equal(a.action, 'register');
  registered.push({ deviceKey: 'device-a', slot: a.slot, status: 'active' });

  const b = decideRegisteredDeviceAccess(registered, 'device-b', false);
  assert.equal(b.allow, true);
  registered.push({ deviceKey: 'device-b', slot: b.slot, status: 'active' });

  const c = decideRegisteredDeviceAccess(registered, 'device-c', false);
  assert.equal(c.allow, false);
  assert.equal(c.code, 'DEVICE_NOT_REGISTERED_LIMIT_REACHED');

  const aAgain = decideRegisteredDeviceAccess(registered, 'device-a', true);
  assert.equal(aAgain.allow, true);
  assert.equal(aAgain.action, 'touch');

  const aBadProof = decideRegisteredDeviceAccess(registered, 'device-a', false);
  assert.equal(aBadProof.code, 'DEVICE_PROOF_INVALID');
});

test('logout does not drop a registered device from the decision set', () => {
  const registered = [
    { deviceKey: 'device-a', slot: 1, status: 'active' },
    { deviceKey: 'device-b', slot: 2, status: 'active' },
  ];
  const afterLogout = registered;
  const c = decideRegisteredDeviceAccess(afterLogout, 'device-c', false);
  assert.equal(c.code, 'DEVICE_NOT_REGISTERED_LIMIT_REACHED');
});

test('admin revoke frees a slot for a replacement device', () => {
  const registered = [
    { deviceKey: 'device-a', slot: 1, status: 'revoked' },
    { deviceKey: 'device-b', slot: 2, status: 'active' },
  ];
  const c = decideRegisteredDeviceAccess(registered, 'device-c', false);
  assert.equal(c.allow, true);
  assert.equal(c.slot, 1);
});

test('concurrent new devices cannot take more than two slots', async () => {
  const store = { slots: new Map(), keys: new Map() };
  const keys = ['a', 'b', 'c', 'd', 'e'];
  const results = await Promise.all(keys.map(async (key) => {
    try {
      return await claimInMemory(store, key);
    } catch (err) {
      return { error: err.code };
    }
  }));
  const registered = results.filter((row) => row.slot);
  const rejected = results.filter((row) => row.error === 'DEVICE_NOT_REGISTERED_LIMIT_REACHED');
  assert.equal(registered.length, 2);
  assert.equal(rejected.length, 3);
  assert.equal(store.slots.size, 2);
});

test('login routes keep registry separate from session logout', () => {
  const auth = fs.readFileSync(path.join(__dirname, '../../routes/authRoutes.js'), 'utf8');
  const model = fs.readFileSync(path.join(__dirname, '../../models/RegisteredDevice.js'), 'utf8');
  assert.match(auth, /gateFixedRegisteredDevice/);
  assert.match(auth, /confirmOrKickActiveSession/);
  assert.match(auth, /checkDeviceConflict\(Model, user\._id, fingerprint, false, req\)/);
  assert.match(auth, /DEVICE_NOT_REGISTERED_LIMIT_REACHED/);
  assert.match(auth, /registered-devices\/:id\/revoke/);
  assert.doesNotMatch(auth, /RegisteredDevice\.deleteMany/);
  assert.match(model, /partialFilterExpression: \{ status: 'active' \}/);
  assert.doesNotMatch(model, /expireAfterSeconds/);
});
