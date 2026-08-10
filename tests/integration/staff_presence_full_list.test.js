/**
 * Staff/Support/Admin must keep the FULL users:online list.
 * Regression: joining presence_<branch> caused a second emit that overwrote FE
 * state and hid branchless teachers from Staff.
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '../..');
const serverSrc = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');

describe('Staff presence full list (no presence_* overwrite)', () => {
  it('register uses getsFullPresence gate before joining presence rooms', () => {
    assert.ok(serverSrc.includes('getsFullPresence'));
    assert.ok(serverSrc.includes('if (!getsFullPresence)'));
    assert.ok(serverSrc.includes("socket.join(`presence_${bid}`)"));
    assert.ok(serverSrc.includes("socket.join('presence_none')"));
  });

  it('STAFF / SUPPORT / SUPER / HIGH are treated as full-presence roles', () => {
    assert.ok(serverSrc.includes("adminRole === 'STAFF'"));
    assert.ok(serverSrc.includes("adminRole === 'SUPPORT'"));
    assert.ok(serverSrc.includes("adminRole === 'SUPER_ADMIN'"));
    assert.ok(serverSrc.includes("adminRole === 'HIGH_ADMIN'"));
  });

  it('broadcast still emits full list to ALL_STAFF before branch rooms', () => {
    const fullIdx = serverSrc.indexOf("io.to('ALL_ADMIN').to('ALL_STAFF').to('ALL_SUPPORT').emit('users:online'");
    const branchIdx = serverSrc.indexOf("io.to(room).emit('users:online', payload)");
    assert.ok(fullIdx > 0);
    assert.ok(branchIdx > fullIdx);
  });
});
