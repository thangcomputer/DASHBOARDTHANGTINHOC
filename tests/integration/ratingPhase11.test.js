/**
 * Phase 11 — Rating moderation (pending not public, ACL moderate).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  canTransitionRating,
  assertRatingTransition,
  isPublicRating,
  publicRatingFilter,
  aggregateStars,
  extractStars,
  RATING_STATUSES,
  TRANSITIONS,
} = require('../../services/ratingLifecycleService');
const { getTemplate } = require('../../constants/notificationTemplates');

test('RATING_STATUSES moderated-by-default', () => {
  assert.deepEqual([...RATING_STATUSES], ['pending', 'approved', 'rejected', 'hidden']);
  assert.ok(TRANSITIONS.pending.includes('approved'));
  assert.ok(TRANSITIONS.pending.includes('rejected'));
  assert.ok(TRANSITIONS.approved.includes('hidden'));
});

test('pending is not public; approved is', () => {
  assert.equal(isPublicRating({ type: 'teacher_rating', status: 'pending' }), false);
  assert.equal(isPublicRating({ type: 'teacher_rating', status: 'rejected' }), false);
  assert.equal(isPublicRating({ type: 'teacher_rating', status: 'hidden' }), false);
  assert.equal(isPublicRating({ type: 'teacher_rating', status: 'approved' }), true);
  // legacy không có status
  assert.equal(isPublicRating({ type: 'teacher_rating' }), true);
});

test('aggregateStars ignores pending', () => {
  const agg = aggregateStars([
    { type: 'teacher_rating', status: 'pending', stars: 5 },
    { type: 'teacher_rating', status: 'approved', stars: 4 },
    { type: 'teacher_rating', status: 'approved', criteria: { stars: 2 } },
  ]);
  assert.equal(agg.count, 2);
  assert.equal(agg.avg, 3);
});

test('assertRatingTransition blocks illegal jumps', () => {
  assert.throws(() => assertRatingTransition('pending', 'hidden'), /Không thể chuyển/);
  assert.doesNotThrow(() => assertRatingTransition('pending', 'approved'));
  assert.equal(canTransitionRating('rejected', 'pending'), true);
});

test('extractStars clamps 1–5', () => {
  assert.equal(extractStars({ stars: 4.2 }), 4.2);
  assert.equal(extractStars({}, 5), 5);
  assert.equal(extractStars({}, 9), 5);
});

test('publicRatingFilter only approved (+ legacy)', () => {
  const f = publicRatingFilter({ targetTeacherId: 'T1' });
  assert.equal(f.type, 'teacher_rating');
  assert.equal(f.targetTeacherId, 'T1');
  assert.ok(Array.isArray(f.$or));
  assert.ok(f.$or.some((x) => x.status === 'approved'));
});

test('Evaluation schema has moderation fields', () => {
  const Evaluation = require('../../models/Evaluation');
  assert.ok(Evaluation.schema.paths.status);
  assert.ok(Evaluation.schema.paths.moderatedBy);
  assert.ok(Evaluation.schema.paths.moderatedAt);
  assert.ok(Evaluation.schema.paths.stars);
  assert.ok(Evaluation.schema.path('status').enumValues.includes('pending'));
  assert.ok(Evaluation.schema.path('status').enumValues.includes('approved'));
});

test('routes: moderate ACL + public filter + no notify on pending submit', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../routes/evaluationRoutes.js'), 'utf8');
  assert.ok(src.includes('/:id/moderate'));
  assert.ok(src.includes('moderateRating'));
  assert.ok(src.includes('submitTeacherRating'));
  assert.ok(src.includes('publicRatingFilter'));
  assert.ok(src.includes('VIEW_EVALUATIONS'));
  assert.ok(src.includes("canModerateRatings"));

  const life = fs.readFileSync(path.join(__dirname, '../../services/ratingLifecycleService.js'), 'utf8');
  assert.ok(life.includes("doc.status === 'approved'"));
  assert.ok(life.includes('rating.submit'));
});

test('teacher list uses publicRatingFilter', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../routes/teacherRoutes.js'), 'utf8');
  assert.ok(src.includes('publicRatingFilter'));
});

test('RATING_APPROVED template exists', () => {
  const t = getTemplate('RATING_APPROVED');
  assert.ok(t);
  assert.equal(t.type, 'EVALUATION');
});
