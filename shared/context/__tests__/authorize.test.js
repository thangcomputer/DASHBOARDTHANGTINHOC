const { authorize, authorizeAny, authorizeAll } = require('../../../shared/middleware/authorize');

// Helpers to create minimal Express mocks
const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};
const makeNext = () => jest.fn();

// Base users
const SUPER_ADMIN = { id: 'sa-1', roleCode: 'SUPER_ADMIN', tenantId: 'T1', assignedBranches: ['B1'] };
const ADMIN_STAFF = { id: 'as-1', roleCode: 'ADMIN_STAFF', tenantId: 'T1', assignedBranches: ['B1'] };
const STUDENT = { id: 'stu-1', roleCode: 'STUDENT', tenantId: 'T1', branchId: 'B1' };

describe('authorize() middleware', () => {
  test('allows Super Admin without policy check', async () => {
    const req = { currentUser: SUPER_ADMIN };
    const res = makeRes(); const next = makeNext();
    await authorize('course:view')(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('allows ADMIN_STAFF with a valid permission from role mapping', async () => {
    const req = { currentUser: ADMIN_STAFF };
    const res = makeRes(); const next = makeNext();
    // ADMIN_STAFF has finance:view in rolePermissions
    await authorize('finance:view')(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('denies STUDENT for admin-only permission (finance:view)', async () => {
    const req = { currentUser: STUDENT };
    const res = makeRes(); const next = makeNext();
    await authorize('finance:view')(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('returns 401 when no currentUser', async () => {
    const req = {};
    const res = makeRes(); const next = makeNext();
    await authorize('student:view')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('grants via legacy permissions array fallback', async () => {
    const req = { currentUser: { id: 'leg-1', permissions: ['finance:view'] } };
    const res = makeRes(); const next = makeNext();
    await authorize('finance:view')(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

describe('authorizeAny() middleware', () => {
  test('allows user with at least one matching permission', async () => {
    const req = { currentUser: ADMIN_STAFF };
    const res = makeRes(); const next = makeNext();
    await authorizeAny('student:create', 'finance:view')(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('denies user without any matching permission', async () => {
    const req = { currentUser: STUDENT };
    const res = makeRes(); const next = makeNext();
    await authorizeAny('finance:view', 'branch:manage')(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('allows Super Admin for any permission list', async () => {
    const req = { currentUser: SUPER_ADMIN };
    const res = makeRes(); const next = makeNext();
    await authorizeAny('permission:manage', 'settings:update')(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('returns 401 for missing user', async () => {
    const req = {};
    const res = makeRes(); const next = makeNext();
    await authorizeAny('student:view')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('authorizeAll() middleware', () => {
  test('allows user who has all specified permissions', async () => {
    const req = { currentUser: ADMIN_STAFF };
    const res = makeRes(); const next = makeNext();
    // ADMIN_STAFF has student:create and finance:view
    await authorizeAll('student:create', 'finance:view')(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('denies user who is missing at least one permission', async () => {
    const req = { currentUser: STUDENT };
    const res = makeRes(); const next = makeNext();
    await authorizeAll('student:view', 'finance:view')(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('allows Super Admin for all permission combinations', async () => {
    const req = { currentUser: SUPER_ADMIN };
    const res = makeRes(); const next = makeNext();
    await authorizeAll('role:manage', 'permission:manage')(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('returns 401 for missing user', async () => {
    const req = {};
    const res = makeRes(); const next = makeNext();
    await authorizeAll('student:view')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
