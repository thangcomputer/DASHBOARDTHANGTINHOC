const fs = require('fs');
const path = require('path');

const fixReplace = (file, replacements) => {
  const filePath = path.join(__dirname, '../routes', file);
  let content = fs.readFileSync(filePath, 'utf8');
  replacements.forEach(r => {
    content = content.replace(r.from, r.to);
  });
  fs.writeFileSync(filePath, content);
};

// 1. financeRoutes.js
fixReplace('financeRoutes.js', [
  // Fix manageGuard definition which was used in POST endpoints
  {
    from: /const manageGuard = \[\s*authMiddleware,\s*authorizeAny\(\.\.\.legacyMapping\.resolve\(PERMISSIONS\.MANAGE_FINANCE\)\),\s*branchFilter,\s*\];/g,
    to: `const manageGuard = [authMiddleware, authorizeAny(...legacyMapping.resolve(PERMISSIONS.MANAGE_FINANCE)), branchFilter];
const voidGuard = [authMiddleware, authorize(NEW_PERMISSIONS.FINANCE_REFUND_APPROVE), branchFilter];
const paymentGuard = [authMiddleware, authorize(NEW_PERMISSIONS.FINANCE_PAYMENT_CREATE), branchFilter];`
  },
  {
    from: /router\.post\('\/ledger\/:id\/void', manageGuard,/g,
    to: `router.post('/ledger/:id/void', voidGuard,`
  },
  {
    from: /router\.post\('\/discount', manageGuard,/g,
    to: `router.post('/discount', paymentGuard,`
  }
]);

// 2. invoiceRoutes.js
fixReplace('invoiceRoutes.js', [
  {
    from: /router\.post\('\/', authMiddleware, authorizeAny\(\.\.\.legacyMapping\.resolve\(PERMISSIONS\.MANAGE_FINANCE\)\),/g,
    to: `router.post('/', authMiddleware, authorize(NEW_PERMISSIONS.FINANCE_PAYMENT_CREATE),`
  },
  {
    from: /router\.delete\('\/:id', authMiddleware, authorizeAny\(\.\.\.legacyMapping\.resolve\(PERMISSIONS\.MANAGE_FINANCE\)\),/g,
    to: `router.delete('/:id', authMiddleware, authorize(NEW_PERMISSIONS.FINANCE_REFUND_APPROVE),`
  }
]);

// 3. transactionRoutes.js
fixReplace('transactionRoutes.js', [
  {
    from: /router\.post\('\/', authMiddleware, authorizeAny\(\.\.\.legacyMapping\.resolve\(PERMISSIONS\.MANAGE_FINANCE\)\),/g,
    to: `router.post('/', authMiddleware, authorize(NEW_PERMISSIONS.FINANCE_PAYMENT_CREATE),`
  },
  {
    from: /router\.put\('\/:id\/confirm', authMiddleware, authorizeAny\(\.\.\.legacyMapping\.resolve\(PERMISSIONS\.MANAGE_FINANCE\)\),/g,
    to: `router.put('/:id/confirm', authMiddleware, authorize(NEW_PERMISSIONS.FINANCE_PAYMENT_CREATE),`
  },
  {
    from: /router\.put\('\/:id\/cancel', authMiddleware, authorizeAny\(\.\.\.legacyMapping\.resolve\(PERMISSIONS\.MANAGE_FINANCE\)\),/g,
    to: `router.put('/:id/cancel', authMiddleware, authorize(NEW_PERMISSIONS.FINANCE_REFUND_APPROVE),`
  },
  {
    from: /router\.delete\('\/:id', authMiddleware, authorizeAny\(\.\.\.legacyMapping\.resolve\(PERMISSIONS\.MANAGE_FINANCE\)\),/g,
    to: `router.delete('/:id', authMiddleware, authorize(NEW_PERMISSIONS.FINANCE_REFUND_APPROVE),`
  }
]);

console.log('Fixed privilege escalation in financial endpoints.');
