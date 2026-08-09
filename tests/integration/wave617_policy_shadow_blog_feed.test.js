/**
 * Wave 6.17 — Policy SHADOW for LIVE /api/blog + /api/feed.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { PERMISSIONS } = require('../../constants/permissions');
const {
  buildSubject: buildBlogSubject,
  evaluateLegacyBlog,
  evaluatePolicyBlog,
  compareDecisions: compareBlog,
  MANAGE_BLOG_LIVE,
} = require('../../services/policyShadow/blogPolicy');
const {
  buildSubject: buildFeedSubject,
  evaluateLegacyFeed,
  evaluatePolicyFeed,
  compareDecisions: compareFeed,
} = require('../../services/policyShadow/feedPolicy');
const { toPolicyPermission } = require('../../services/policyShadow/livePermissionAdapter');

const BRANCH_A = '507f1f77bcf86cd7994390aa';
const AUTHOR = '507f1f77bcf86cd7994390a1';
const OTHER = '507f1f77bcf86cd7994390a2';
const ROOT = path.join(__dirname, '../..');

function blogSub(opts = {}) {
  const role = opts.role ?? 'staff';
  const defaultAdmin = role === 'teacher' || role === 'student' ? null : 'STAFF';
  return buildBlogSubject({
    user: { id: opts.id ?? AUTHOR, role },
    actorDoc: role === 'student'
      ? null
      : {
          adminRole: opts.adminRole !== undefined ? opts.adminRole : defaultAdmin,
          permissions: opts.permissions ?? [],
          role,
        },
    userBranchId: opts.userBranchId === undefined ? BRANCH_A : opts.userBranchId,
  });
}

function feedSub(opts = {}) {
  return buildFeedSubject({
    user: { id: opts.id ?? AUTHOR, role: opts.role ?? 'student' },
    actorDoc: opts.role === 'student'
      ? null
      : {
          adminRole: opts.adminRole ?? null,
          permissions: opts.permissions ?? [],
          role: opts.role ?? 'student',
        },
    userBranchId: opts.userBranchId === undefined ? BRANCH_A : opts.userBranchId,
  });
}

function assertBlog(label, subject, action, ctx = {}, untrusted = {}) {
  const legacy = evaluateLegacyBlog(subject, action, ctx);
  const policy = evaluatePolicyBlog(subject, action, ctx, untrusted);
  const result = compareBlog(legacy, policy);
  assert.equal(result, 'MATCH', `${label}: ${result} L=${legacy.decision}/${legacy.reason} P=${policy.decision}/${policy.reason}`);
  return { legacy, policy };
}

function assertFeed(label, subject, action, ctx = {}, untrusted = {}) {
  const legacy = evaluateLegacyFeed(subject, action, ctx);
  const policy = evaluatePolicyFeed(subject, action, ctx, untrusted);
  const result = compareFeed(legacy, policy);
  assert.equal(result, 'MATCH', `${label}: ${result} L=${legacy.decision}/${legacy.reason} P=${policy.decision}/${policy.reason}`);
  return { legacy, policy };
}

// ── Blog ─────────────────────────────────────────────────────────────────────

test('Wave6.17 BLOG: list auth-only ALLOW; manage needs MANAGE_BLOG', () => {
  const student = blogSub({ id: 's1', role: 'student' });
  const staffNo = blogSub({ permissions: [] });
  const staffOk = blogSub({ permissions: [PERMISSIONS.MANAGE_BLOG] });
  const teacher = blogSub({ id: 't1', role: 'teacher', adminRole: null, permissions: [PERMISSIONS.MANAGE_BLOG] });
  assert.equal(assertBlog('list-s', student, 'list').legacy.decision, 'ALLOW');
  assert.equal(assertBlog('mgr-', staffNo, 'manage_create').legacy.decision, 'DENY');
  assert.equal(assertBlog('mgr+', staffOk, 'manage_create').legacy.decision, 'ALLOW');
  assert.equal(assertBlog('mgr-t', teacher, 'manage_list').legacy.decision, 'DENY');
});

test('Wave6.17 BLOG: get audience HTTP deny; admin-side bypass; manage draft gate', () => {
  const teacher = blogSub({ id: 't1', role: 'teacher', adminRole: null });
  const student = blogSub({ id: 's1', role: 'student' });
  const staff = blogSub({ role: 'staff', permissions: [] });
  const manager = blogSub({ permissions: [PERMISSIONS.MANAGE_BLOG] });
  assert.equal(
    assertBlog('t-stud', teacher, 'get', {
      post: { status: 'published', targetAudience: 'student' },
      manageQuery: false,
    }).legacy.decision,
    'DENY',
  );
  assert.equal(
    assertBlog('s-teach', student, 'get', {
      post: { status: 'published', targetAudience: 'teacher' },
      manageQuery: false,
    }).legacy.decision,
    'DENY',
  );
  assert.equal(
    assertBlog('staff-aud', staff, 'get', {
      post: { status: 'published', targetAudience: 'student' },
      manageQuery: false,
    }).legacy.decision,
    'ALLOW',
  );
  assert.equal(
    assertBlog('draft-', staff, 'get', {
      post: { status: 'draft', targetAudience: 'all' },
      manageQuery: true,
    }).legacy.decision,
    'DENY',
  );
  assert.equal(
    assertBlog('draft+', manager, 'get', {
      post: { status: 'draft', targetAudience: 'all' },
      manageQuery: true,
    }).legacy.decision,
    'ALLOW',
  );
  assert.equal(
    assertBlog('pub-m', staff, 'get', {
      post: { status: 'published', targetAudience: 'all' },
      manageQuery: true,
    }).legacy.decision,
    'ALLOW',
  );
  assert.equal(assertBlog('miss', teacher, 'get', { post: null }).legacy.decision, 'ALLOW');
});

test('Wave6.17 BLOG: manage update any manager (no author ownership); spoof cannot widen', () => {
  const manager = blogSub({ id: OTHER, permissions: [PERMISSIONS.MANAGE_BLOG] });
  const teacher = blogSub({ id: 't1', role: 'teacher', adminRole: null, permissions: [] });
  assert.equal(
    assertBlog('upd', manager, 'manage_update', {
      post: { authorId: AUTHOR, status: 'draft' },
    }).legacy.decision,
    'ALLOW',
  );
  assert.equal(
    assertBlog('spoof', teacher, 'manage_create', {}, {
      bodyRole: 'admin',
      clientPermissions: [PERMISSIONS.MANAGE_BLOG],
      bodyAuthorId: AUTHOR,
      bodyBranchId: BRANCH_A,
    }).legacy.decision,
    'DENY',
  );
});

// ── Feed ─────────────────────────────────────────────────────────────────────

test('Wave6.17 FEED: list/create/react auth-only; delete owner/admin', () => {
  const student = feedSub({ id: AUTHOR, role: 'student' });
  const other = feedSub({ id: OTHER, role: 'student' });
  const staff = feedSub({ id: 'st1', role: 'staff', adminRole: 'STAFF' });
  const teacher = feedSub({ id: 't1', role: 'teacher', adminRole: null });
  assert.equal(assertFeed('list', student, 'list').legacy.decision, 'ALLOW');
  assert.equal(assertFeed('create', student, 'create').legacy.decision, 'ALLOW');
  assert.equal(assertFeed('like', student, 'like').legacy.decision, 'ALLOW');
  assert.equal(
    assertFeed('del-own', student, 'delete_post', { post: { authorId: AUTHOR } }).legacy.decision,
    'ALLOW',
  );
  assert.equal(
    assertFeed('del-oth', other, 'delete_post', { post: { authorId: AUTHOR } }).legacy.decision,
    'DENY',
  );
  assert.equal(
    assertFeed('del-st', staff, 'delete_post', { post: { authorId: AUTHOR } }).legacy.decision,
    'ALLOW',
  );
  assert.equal(
    assertFeed('del-t', teacher, 'delete_post', { post: { authorId: AUTHOR } }).legacy.decision,
    'DENY',
  );
  assert.equal(assertFeed('miss', student, 'delete_post', { post: null }).legacy.decision, 'ALLOW');
});

test('Wave6.17 FEED: delete_comment author / post author / admin', () => {
  const student = feedSub({ id: AUTHOR, role: 'student' });
  const commenter = feedSub({ id: OTHER, role: 'student' });
  const stranger = feedSub({ id: 'x1', role: 'student' });
  const post = { authorId: AUTHOR };
  assert.equal(
    assertFeed('c-own', commenter, 'delete_comment', {
      post,
      comment: { authorId: OTHER },
    }).legacy.decision,
    'ALLOW',
  );
  assert.equal(
    assertFeed('c-post', student, 'delete_comment', {
      post,
      comment: { authorId: OTHER },
    }).legacy.decision,
    'ALLOW',
  );
  assert.equal(
    assertFeed('c-str', stranger, 'delete_comment', {
      post,
      comment: { authorId: OTHER },
    }).legacy.decision,
    'DENY',
  );
});

test('Wave6.17 FEED: spoof authorId/role cannot widen delete', () => {
  const other = feedSub({ id: OTHER, role: 'student' });
  assert.equal(
    assertFeed('spoof', other, 'delete_post', { post: { authorId: AUTHOR } }, {
      bodyAuthorId: AUTHOR,
      bodyRole: 'admin',
      clientAdminRole: 'SUPER_ADMIN',
      bodyBranchId: BRANCH_A,
    }).legacy.decision,
    'DENY',
  );
});

// ── Fail-closed ──────────────────────────────────────────────────────────────

test('Wave6.17 fail-closed: blog Policy throw → ERROR; next()', async () => {
  const policyPath = require.resolve('../../services/policyShadow/blogPolicy');
  const mwPath = require.resolve('../../middleware/policyShadowBlog');
  const teacherPath = require.resolve('../../models/Teacher');
  delete require.cache[policyPath];
  delete require.cache[mwPath];
  delete require.cache[teacherPath];
  const policyMod = require('../../services/policyShadow/blogPolicy');
  policyMod.evaluatePolicyBlog = () => { throw new Error('forced blog policy failure'); };
  const Teacher = require('../../models/Teacher');
  const orig = Teacher.findById;
  Teacher.findById = () => ({
    select() {
      return { lean: async () => ({ adminRole: 'STAFF', permissions: [PERMISSIONS.MANAGE_BLOG], role: 'staff' }) };
    },
  });
  try {
    const { policyShadowBlog } = require('../../middleware/policyShadowBlog');
    const mw = policyShadowBlog('list');
    let nextCount = 0;
    const req = {
      user: { id: AUTHOR, role: 'staff' },
      params: {},
      body: {},
      query: {},
      method: 'GET',
      originalUrl: '/api/blog/posts',
      requestId: 'req-wave617',
      correlationId: 'corr-wave617',
    };
    const res = { statusCode: null, status(c) { this.statusCode = c; return this; }, json() { return this; } };
    await mw(req, res, () => { nextCount += 1; });
    assert.equal(nextCount, 1);
    assert.equal(res.statusCode, null);
    assert.equal(req.policyShadow.comparison, 'ERROR');
  } finally {
    Teacher.findById = orig;
    delete require.cache[policyPath];
    delete require.cache[mwPath];
    delete require.cache[teacherPath];
    require('../../services/policyShadow/blogPolicy');
    require('../../middleware/policyShadowBlog');
  }
});

test('Wave6.17 fail-closed: feed Policy throw → ERROR; next()', async () => {
  const policyPath = require.resolve('../../services/policyShadow/feedPolicy');
  const mwPath = require.resolve('../../middleware/policyShadowFeed');
  delete require.cache[policyPath];
  delete require.cache[mwPath];
  const policyMod = require('../../services/policyShadow/feedPolicy');
  policyMod.evaluatePolicyFeed = () => { throw new Error('forced feed policy failure'); };
  try {
    const { policyShadowFeed } = require('../../middleware/policyShadowFeed');
    const mw = policyShadowFeed('list');
    let nextCount = 0;
    const req = {
      user: { id: AUTHOR, role: 'student' },
      params: {},
      body: {},
      query: {},
      method: 'GET',
      originalUrl: '/api/feed',
      requestId: 'req-wave617-f',
      correlationId: 'corr-wave617-f',
    };
    const res = { statusCode: null, status(c) { this.statusCode = c; return this; }, json() { return this; } };
    await mw(req, res, () => { nextCount += 1; });
    assert.equal(nextCount, 1);
    assert.equal(res.statusCode, null);
    assert.equal(req.policyShadow.comparison, 'ERROR');
  } finally {
    delete require.cache[policyPath];
    delete require.cache[mwPath];
    require('../../services/policyShadow/feedPolicy');
    require('../../middleware/policyShadowFeed');
  }
});

// ── Static ───────────────────────────────────────────────────────────────────

test('Wave6.17 static: Legacy gates remain; Policy shadow-only; CQRS OFF; realtime preserved', () => {
  const blog = fs.readFileSync(path.join(ROOT, 'routes/blogRoutes.js'), 'utf8');
  const feed = fs.readFileSync(path.join(ROOT, 'routes/feedRoutes.js'), 'utf8');
  const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');

  assert.ok(blog.includes("policyShadowBlog('list')"));
  assert.ok(blog.includes("policyShadowBlog('get')") || blog.includes("blogCutoverGate('get')"));
  assert.ok(blog.includes("manageGuard('manage_create')") || blog.includes("policyShadowBlog('manage_create')"));
  assert.ok(blog.includes('blogCutoverGate'));
  assert.ok(blog.includes('router.use(authMiddleware)'));
  assert.ok(blog.includes("io.emit('blog:published'"));
  const blogGate = fs.readFileSync(path.join(ROOT, 'middleware/blogCutoverGate.js'), 'utf8');
  assert.ok(blogGate.includes('checkPermission'));
  assert.ok(blogGate.includes('MANAGE_BLOG'));
  assert.ok(blogGate.includes("getAuthorizationAuthority('blog')"));

  assert.ok(feed.includes("feedGuard('list')") || feed.includes("policyShadowFeed('list')"));
  assert.ok(feed.includes("feedGuard('delete_post')") || feed.includes("policyShadowFeed('delete_post')"));
  assert.ok(feed.includes("feedGuard('delete_comment')") || feed.includes("policyShadowFeed('delete_comment')"));
  assert.ok(feed.includes('feedCutoverGate') || feed.includes('feedGuard'));
  assert.ok(feed.includes('canDeletePost'));
  assert.ok(feed.includes("io.to('feed_room').emit"));
  assert.ok(!feed.includes('checkPermission'));
  assert.ok(!feed.includes('MANAGE_FEED'));
  const feedGate = fs.readFileSync(path.join(ROOT, 'middleware/feedCutoverGate.js'), 'utf8');
  assert.ok(feedGate.includes("getAuthorizationAuthority('feed')"));
  assert.ok(feedGate.includes('legacyFeedGate'));
  assert.ok(!feedGate.includes('.emit('));

  assert.ok(server.includes("app.use('/api/blog'"));
  assert.ok(server.includes("app.use('/api/feed'"));
  assert.ok(!server.includes("require('./modules/blog"));
  assert.ok(!server.includes("require('./modules/feed"));
  assert.ok(!/app\.use\(\s*['"]\/api\/.*policy/i.test(server));

  assert.ok(/ENABLE_CQRS_TEACHER\s*=\s*false/.test(env));
  assert.ok(/ENABLE_CQRS_STUDENT_CREATE\s*=\s*false/.test(env));
  assert.ok(/ENABLE_CQRS_INVOICE\s*=\s*false/.test(env));
  assert.equal(toPolicyPermission(PERMISSIONS.MANAGE_BLOG), MANAGE_BLOG_LIVE);
});

test('Wave6.17 static: shadow always next(); modules unmounted', () => {
  for (const rel of ['middleware/policyShadowBlog.js', 'middleware/policyShadowFeed.js']) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.ok(src.includes('return next()'));
    assert.ok(!/res\.status\(403\)/.test(src));
  }
  assert.ok(fs.existsSync(path.join(ROOT, 'modules/blog/routes/blogRoutes.js')));
  assert.ok(fs.existsSync(path.join(ROOT, 'modules/feed/routes/feedRoutes.js')));
});
