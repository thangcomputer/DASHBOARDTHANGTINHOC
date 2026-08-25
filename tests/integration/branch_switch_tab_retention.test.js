/**
 * Test: Tab Retention and Permission Verification When Switching Branches
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const ROOT = path.join(__dirname, '../..');

describe('Branch Switching and Tab Permission Retention Verification', () => {

  // Test hasPermission logic from permissions.js
  const permissionsCode = fs.readFileSync(path.join(ROOT, 'client/src/constants/permissions.js'), 'utf8');
  
  // Extract hasPermission function
  const fnCode = permissionsCode.substring(
    permissionsCode.indexOf('export function hasPermission')
  ).replace('export function hasPermission', 'function hasPermission');

  const hasPermission = new Function(`${fnCode}; return hasPermission;`)();

  it('1. hasPermission grants manage_finance for session with id="admin"', () => {
    const session = { id: 'admin', role: 'admin' };
    assert.equal(hasPermission(session, 'manage_finance'), true);
  });

  it('2. hasPermission grants manage_finance for session with adminRole="SUPER_ADMIN"', () => {
    const session = { id: '65a1234567890abcdef12345', role: 'admin', adminRole: 'SUPER_ADMIN' };
    assert.equal(hasPermission(session, 'manage_finance'), true);
  });

  it('3. hasPermission grants manage_finance for session with role="admin" without adminRole', () => {
    const session = { id: '65a1234567890abcdef12345', role: 'admin' };
    assert.equal(hasPermission(session, 'manage_finance'), true);
  });

  it('4. hasPermission grants manage_finance for HIGH_ADMIN with manage_finance in permissions', () => {
    const session = {
      id: '65a1234567890abcdef12345',
      role: 'staff',
      adminRole: 'HIGH_ADMIN',
      permissions: ['manage_students', 'manage_finance', 'view_teachers'],
    };
    assert.equal(hasPermission(session, 'manage_finance'), true);
  });

  it('5. hasPermission rejects manage_finance for STAFF without permission', () => {
    const session = {
      id: '65a1234567890abcdef12345',
      role: 'staff',
      adminRole: 'STAFF',
      permissions: ['manage_messages'],
    };
    assert.equal(hasPermission(session, 'manage_finance'), false);
  });

  it('6. useAdminDashboardState has proper isSuperAdmin check and finance fields', () => {
    const hookCode = fs.readFileSync(path.join(ROOT, 'client/src/components/admin/hooks/useAdminDashboardState.jsx'), 'utf8');
    assert.ok(hookCode.includes("isSuperAdmin = _sess?.id === 'admin'"));
    assert.ok(hookCode.includes("_sess?.role === 'admin'"));
    assert.ok(hookCode.includes('financeStudents'));
    assert.ok(hookCode.includes('financialData'));
  });

  it('7. App.jsx loadSession prioritizes admin over staff for /admin route', () => {
    const appCode = fs.readFileSync(path.join(ROOT, 'client/src/App.jsx'), 'utf8');
    assert.ok(appCode.includes("for (const r of ['admin', 'staff'])"));
  });

  it('8. BranchFilterDropdown parses hash cleanly without query string pollution', () => {
    const bfdCode = fs.readFileSync(path.join(ROOT, 'client/src/components/BranchFilterDropdown.jsx'), 'utf8');
    assert.ok(bfdCode.includes(".split(/[?#]/)[0]"));
    assert.ok(bfdCode.includes("'logs'"), 'Must show branch dropdown on #logs tab');
    assert.ok(!bfdCode.includes("'system-logs'"), 'Must not use obsolete system-logs hash');
  });

  it('9. BranchContext emits branch_id=all for elevated admins and does not navigate', () => {
    const ctx = fs.readFileSync(path.join(ROOT, 'client/src/context/BranchContext.jsx'), 'utf8');
    assert.ok(ctx.includes("branch_id=all"), 'Must emit branch_id=all when all branches selected');
    assert.ok(ctx.includes('isSuperAdmin || isHighAdmin'), 'Must gate all-branch query for Super/High');
    assert.equal(ctx.includes('navigate('), false, 'Branch switch must not navigate away from current tab');
  });

  it('10. useAdminStudents preserves location.hash when updating search params', () => {
    const src = fs.readFileSync(path.join(ROOT, 'client/src/components/admin/hooks/useAdminStudents.jsx'), 'utf8');
    assert.ok(src.includes('hash: location.hash'), 'Must preserve hash when navigating search params');
    assert.ok(src.includes("activeTab !== 'students'"), 'Must only reset page on students tab');
  });

  it('11. useAdminTeachers preserves location.hash when updating teacherSearch', () => {
    const src = fs.readFileSync(path.join(ROOT, 'client/src/components/admin/hooks/useAdminTeachers.jsx'), 'utf8');
    assert.ok(src.includes('hash: location.hash'), 'Must preserve hash when updating teacherSearch');
  });

  it('12. #staff tab needs Super or manage_staff (HIGH without grant redirected)', () => {
    const hookCode = fs.readFileSync(path.join(ROOT, 'client/src/components/admin/hooks/useAdminDashboardState.jsx'), 'utf8');
    assert.ok(
      hookCode.includes("activeTab === 'staff'"),
      'Must guard #staff tab',
    );
    assert.ok(
      hookCode.includes('PERMISSIONS.MANAGE_STAFF') && hookCode.includes('canStaffTab'),
      'HIGH/STAFF need manage_staff to keep #staff',
    );
    assert.ok(
      hookCode.includes('isSuperAdmin || perms.includes(PERMISSIONS.MANAGE_STAFF)'),
      'Super bypass + permission grant for #staff',
    );
    const sidebar = fs.readFileSync(path.join(ROOT, 'client/src/components/AppSidebar.jsx'), 'utf8');
    assert.ok(
      sidebar.includes("key: 'staff'") && sidebar.includes('PERMISSIONS.MANAGE_STAFF'),
      'Sidebar staff item gated by MANAGE_STAFF',
    );
    assert.equal(
      /key:\s*'staff'[^}]*superAdminOnly:\s*true/.test(sidebar),
      false,
      'staff menu must not be superAdminOnly (HIGH with grant should see it)',
    );
  });

  it('13. AdminLazyTabShell wraps tabs with ErrorBoundary inline', () => {
    const shell = fs.readFileSync(path.join(ROOT, 'client/src/components/admin/AdminLazyTabShell.jsx'), 'utf8');
    assert.ok(shell.includes("import ErrorBoundary from '../ErrorBoundary'"));
    assert.ok(shell.includes('<ErrorBoundary inline>'));
  });

  it('14. AdminModalManager EditTeacher uses editTeacher prop (not teacher=)', () => {
    const mgr = fs.readFileSync(path.join(ROOT, 'client/src/components/admin/shared/AdminModalManager.jsx'), 'utf8');
    assert.ok(mgr.includes('editTeacher={editTeacher}'));
    assert.ok(mgr.includes('setEditTeacher={setEditTeacher}'));
    assert.ok(mgr.includes('grantPending'));
    assert.equal(mgr.includes('teacher={editTeacher}'), false);
  });
});
