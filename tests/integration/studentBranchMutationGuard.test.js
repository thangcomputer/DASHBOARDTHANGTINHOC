/**
 * Checklist — mọi mutation student/finance liên quan HV phải có branch guard.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const studentsSrc = fs.readFileSync(path.join(__dirname, '../../routes/studentRoutes.js'), 'utf8');
const invoiceSrc = fs.readFileSync(path.join(__dirname, '../../routes/invoiceRoutes.js'), 'utf8');
const financeSrc = fs.readFileSync(path.join(__dirname, '../../routes/financeRoutes.js'), 'utf8');

/** Extract middleware list for a route registration line / block start. */
function middlewareFor(src, routeSnippet) {
  const idx = src.indexOf(routeSnippet);
  assert.ok(idx >= 0, `missing route: ${routeSnippet}`);
  const slice = src.slice(idx, idx + 280);
  return slice;
}

const STUDENT_MUTATIONS = [
  "router.put('/:id'",
  "router.put('/:id/exam-progress'",
  "router.patch('/:id/price'",
  "router.put('/:id/pay'",
  "router.put('/:id/refund'",
  "router.put('/:id/unlock-exam'",
  "router.put('/:id/lock-exam'",
  "router.post('/:id/enrollments'",
  "router.put('/:id/enrollments/:enrollmentId/settings'",
  "router.put('/:id/enrollments/:enrollmentId/pay'",
  "router.delete('/:id/enrollments/:enrollmentId'",
  "router.put('/:id/assign-teacher'",
  "router.delete('/:id'",
  "router.post('/:id/reset-today-attendance'",
  "router.post('/:id/reset-history'",
  "router.put('/:id/pay-teacher'",
];

test('all student :id mutations use assertStudentBranchAccess', () => {
  for (const snip of STUDENT_MUTATIONS) {
    const slice = middlewareFor(studentsSrc, snip);
    assert.ok(
      slice.includes('assertStudentBranchAccess'),
      `${snip} missing assertStudentBranchAccess — saw: ${slice.split('\n')[0]}`,
    );
    assert.ok(
      slice.includes('branchFilter'),
      `${snip} missing branchFilter`,
    );
  }
});

test('finance ledger routes require MANAGE_FINANCE + branchFilter', () => {
  assert.ok(financeSrc.includes('branchFilter'));
  assert.ok(financeSrc.includes('MANAGE_FINANCE'));
  assert.ok(financeSrc.includes('/ledger/summary') || financeSrc.includes("'/ledger"));
});

test('invoice create guards cross-branch student', () => {
  assert.ok(invoiceSrc.includes("router.post('/', [authMiddleware, checkPermission(PERMISSIONS.MANAGE_FINANCE), branchFilter]"));
  assert.ok(invoiceSrc.includes('Không có quyền thao tác học viên chi nhánh khác'));
});
