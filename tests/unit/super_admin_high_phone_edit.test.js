/**
 * SUPER_ADMIN sửa SĐT mọi tài khoản nội bộ (HIGH/SUPPORT/STAFF/SUPER)
 * Static assertions on code paths to avoid DB writes.
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('SUPER_ADMIN staff phone edit (all account types)', { concurrency: false }, () => {
  it('FE: StaffManagementTab unlocks phone for Super/root on any edit', () => {
    const src = read('client/src/components/StaffManagementTab.jsx');
    assert.ok(
      src.includes('readOnly={isEdit && !(isSuperAdmin || isRootSuperAdmin)}'),
      'Expected Super/root to unlock phone on edit for all staff accounts',
    );
    assert.ok(
      src.includes('Super Admin có thể đổi SĐT đăng nhập cho mọi tài khoản nội bộ'),
      'Expected hint for Super phone edit scope',
    );
  });

  it('BE: staffRoutes PUT accepts phone for any staff target when actor is SUPER', () => {
    const src = read('routes/staffRoutes.js');
    assert.ok(
      src.includes('const { name, adminRole, permissions = [], status, password, branchId, gender, phone } = req.body;'),
      'Expected phone destructuring in PUT handler',
    );
    assert.ok(
      src.includes('if (actorIsSuperAdmin(req) && phone != null)'),
      'Expected super-only phone update gate',
    );
    assert.ok(
      src.includes('updates.phone = nextPhone'),
      'Expected updates.phone assignment',
    );
    assert.ok(
      src.includes('Teacher.findOne({') && src.includes('phone: nextPhone') && src.includes('_id: { $ne: req.params.id }'),
      'Expected unique check excluding self',
    );
  });
});

