'use strict';

const logger = require('../config/logger');
const Course = require('../models/Course');
const CertPrepCourse = require('../models/CertPrepCourse');
const CertPrepEnrollmentMapping = require('../models/CertPrepEnrollmentMapping');
const StudentCertPrepAccess = require('../models/StudentCertPrepAccess');
const Student = require('../models/Student');
const { CertPrepError, isOid, requireOid } = require('./certPrepService');

function isQualifyingEnrollment(enr) {
  if (!enr) return false;
  // Align with student learning gate SoT: status === 'active'
  return String(enr.status || '').toLowerCase() === 'active';
}

function enrollmentsOf(student) {
  if (Array.isArray(student?.enrollments) && student.enrollments.length) {
    return student.enrollments;
  }
  if (student?.course) {
    return [{
      courseName: student.course,
      courseId: student.courseId || null,
      status: student.paid ? 'active' : 'pending_payment',
      learningAccess: student.paid === true,
      paid: student.paid === true,
    }];
  }
  return [];
}

async function resolveCatalogCourseId(enr) {
  const raw = enr?.courseId;
  const id = raw && (raw._id || raw);
  if (id && isOid(id)) return String(id);
  const name = String(enr?.courseName || enr?.course || '').trim();
  if (!name) return null;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const course = await Course.findOne({
    name: new RegExp(`^${escaped}$`, 'i'),
    deletedAt: null,
  }).select('_id').lean();
  return course?._id ? String(course._id) : null;
}

function mergeExpiresAt(current, incoming) {
  if (!current && !incoming) return null;
  if (!incoming) return current || null;
  if (!current) return incoming;
  const a = new Date(current).getTime();
  const b = new Date(incoming).getTime();
  if (!Number.isFinite(a)) return incoming;
  if (!Number.isFinite(b)) return current;
  return new Date(Math.max(a, b));
}

function serializeMapping(doc, extra = {}) {
  const row = doc.toObject ? doc.toObject() : doc;
  const course = row.courseId && typeof row.courseId === 'object' ? row.courseId : null;
  const cert = row.certPrepCourseId && typeof row.certPrepCourseId === 'object' ? row.certPrepCourseId : null;
  return {
    id: String(row._id),
    courseId: String(course?._id || row.courseId || ''),
    courseName: course?.name || extra.courseName || '',
    certPrepCourseId: String(cert?._id || row.certPrepCourseId || ''),
    certPrepCourseName: cert?.name || extra.certPrepCourseName || '',
    isActive: row.isActive !== false,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function listMappings() {
  const rows = await CertPrepEnrollmentMapping.find({})
    .populate('courseId', 'name')
    .populate('certPrepCourseId', 'name')
    .sort({ updatedAt: -1 })
    .lean();
  return rows.map((row) => serializeMapping(row));
}

async function upsertMapping(body, actorId) {
  const courseId = requireOid(body.courseId, 'courseId');
  const certPrepCourseId = requireOid(body.certPrepCourseId, 'certPrepCourseId');
  const [course, cert] = await Promise.all([
    Course.findById(courseId).select('_id name deletedAt').lean(),
    CertPrepCourse.findById(certPrepCourseId).select('_id name').lean(),
  ]);
  if (!course || course.deletedAt) throw new CertPrepError(404, 'Không tìm thấy khóa học');
  if (!cert) throw new CertPrepError(404, 'Không tìm thấy khóa ôn thi CertPrep');
  const actor = String(actorId || '');
  const doc = await CertPrepEnrollmentMapping.findOneAndUpdate(
    { courseId, certPrepCourseId },
    {
      $set: {
        isActive: body.isActive !== false,
        updatedBy: actor,
      },
      $setOnInsert: { createdBy: actor },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  return serializeMapping(doc, { courseName: course.name, certPrepCourseName: cert.name });
}

async function setMappingActive(id, isActive, actorId) {
  const mappingId = requireOid(id, 'mappingId');
  const doc = await CertPrepEnrollmentMapping.findById(mappingId);
  if (!doc) throw new CertPrepError(404, 'Không tìm thấy liên kết khóa học');
  doc.isActive = isActive !== false;
  doc.updatedBy = String(actorId || '');
  await doc.save();
  return serializeMapping(doc);
}

async function upsertAccess({ studentId, certPrepCourseId, grantedBy, enrollmentExpiresAt }) {
  const existing = await StudentCertPrepAccess.findOne({
    studentId,
    courseId: certPrepCourseId,
  });
  const nextExpiry = mergeExpiresAt(existing?.expiresAt, enrollmentExpiresAt || null);
  if (!existing) {
    try {
      const created = await StudentCertPrepAccess.create({
        studentId,
        courseId: certPrepCourseId,
        isActive: true,
        expiresAt: nextExpiry,
        grantedBy: String(grantedBy || 'enrollment-bridge'),
        grantedAt: new Date(),
      });
      return created.toObject();
    } catch (err) {
      if (err?.code !== 11000) throw err;
      const raced = await StudentCertPrepAccess.findOne({ studentId, courseId: certPrepCourseId });
      if (!raced) throw err;
      raced.isActive = true;
      raced.expiresAt = mergeExpiresAt(raced.expiresAt, enrollmentExpiresAt || null);
      if (!raced.grantedBy) raced.grantedBy = String(grantedBy || 'enrollment-bridge');
      await raced.save();
      return raced.toObject();
    }
  }
  existing.isActive = true;
  existing.expiresAt = nextExpiry;
  if (!existing.grantedBy) existing.grantedBy = String(grantedBy || 'enrollment-bridge');
  await existing.save();
  return existing.toObject();
}

async function findActiveMappings(courseId) {
  if (!courseId || !isOid(courseId)) return [];
  return CertPrepEnrollmentMapping.find({
    courseId,
    isActive: true,
  }).lean();
}

async function findActiveMapping(courseId) {
  const rows = await findActiveMappings(courseId);
  return rows[0] || null;
}

async function syncEnrollmentToCertPrepAccess({
  studentId,
  courseId,
  enrollment,
  grantedBy,
} = {}) {
  const sid = requireOid(studentId, 'studentId');
  let catalogId = courseId ? String(courseId) : null;
  if (!catalogId && enrollment) catalogId = await resolveCatalogCourseId(enrollment);
  if (!catalogId) return { action: 'noop', reason: 'no-course' };
  if (!isQualifyingEnrollment(enrollment || { status: 'active' })) {
    return { action: 'noop', reason: 'not-qualifying' };
  }
  const mappings = await findActiveMappings(catalogId);
  if (!mappings.length) return { action: 'noop', reason: 'no-mapping' };
  const accesses = [];
  for (const mapping of mappings) {
    // eslint-disable-next-line no-await-in-loop
    const access = await upsertAccess({
      studentId: sid,
      certPrepCourseId: mapping.certPrepCourseId,
      grantedBy,
      enrollmentExpiresAt: null,
    });
    accesses.push(access);
  }
  return {
    action: 'upserted',
    access: accesses[0],
    accesses,
    certPrepCourseIds: mappings.map((m) => String(m.certPrepCourseId)),
  };
}

async function syncStudentEnrollments(student, { grantedBy } = {}) {
  const sid = student?._id || student?.id;
  if (!sid) return { granted: 0, skipped: 'no-student' };
  const mappings = await CertPrepEnrollmentMapping.find({ isActive: true }).lean();
  if (!mappings.length) return { granted: 0, skipped: 'no-mapping' };
  const byCourse = new Map();
  for (const m of mappings) {
    const key = String(m.courseId);
    if (!byCourse.has(key)) byCourse.set(key, []);
    byCourse.get(key).push(m);
  }
  const seen = new Set();
  let granted = 0;
  for (const enr of enrollmentsOf(student)) {
    if (!isQualifyingEnrollment(enr)) continue;
    // eslint-disable-next-line no-await-in-loop
    const catalogId = await resolveCatalogCourseId(enr);
    if (!catalogId) continue;
    const courseMaps = byCourse.get(String(catalogId)) || [];
    for (const mapping of courseMaps) {
      const key = String(mapping.certPrepCourseId);
      if (seen.has(key)) continue;
      seen.add(key);
      // eslint-disable-next-line no-await-in-loop
      await upsertAccess({
        studentId: sid,
        certPrepCourseId: mapping.certPrepCourseId,
        grantedBy,
        enrollmentExpiresAt: null,
      });
      granted += 1;
    }
  }
  return { granted };
}

async function safeSyncStudentEnrollments(student, opts = {}) {
  try {
    let doc = student;
    const hasEnrollmentShape = Array.isArray(student?.enrollments) || student?.course != null;
    if (!hasEnrollmentShape) {
      const id = typeof student === 'string' ? student : (student?._id || student?.id || student);
      doc = id ? await Student.findById(id) : null;
    }
    if (!doc) return { ok: true, skipped: 'no-student' };
    const result = await syncStudentEnrollments(doc, opts);
    return { ok: true, ...result };
  } catch (err) {
    logger.error('[CERT-PREP-ENROLL] sync failed: %s', err.message);
    return { ok: false, error: err.message };
  }
}

async function syncExistingEnrollments({ studentId, grantedBy } = {}) {
  const filter = studentId ? { _id: requireOid(studentId, 'studentId') } : {};
  const students = await Student.find(filter).select('_id course courseId paid enrollments').lean();
  let granted = 0;
  let scanned = 0;
  for (const row of students) {
    scanned += 1;
    const out = await syncStudentEnrollments(row, { grantedBy });
    granted += Number(out.granted) || 0;
  }
  return { scanned, granted };
}

async function softDeactivateAccess(studentId, certPrepCourseId) {
  const existing = await StudentCertPrepAccess.findOne({
    studentId,
    courseId: certPrepCourseId,
  });
  if (!existing || existing.isActive === false) {
    return { action: 'noop', reason: 'already-inactive' };
  }
  existing.isActive = false;
  await existing.save();
  return { action: 'deactivated', access: existing.toObject() };
}

/** Access gắn mapping LMS → chỉ giữ khi còn enrollment qualifying map tới CertPrep đó. */
async function studentStillQualifiesForCertPrep(student, certPrepCourseId) {
  const maps = await CertPrepEnrollmentMapping.find({
    certPrepCourseId,
  }).select('courseId').lean();
  if (!maps.length) return null; // null = không phải enrollment-linked
  const courseIds = new Set(maps.map((m) => String(m.courseId)));
  for (const enr of enrollmentsOf(student)) {
    if (!isQualifyingEnrollment(enr)) continue;
    const catalogId = await resolveCatalogCourseId(enr);
    if (catalogId && courseIds.has(String(catalogId))) return true;
  }
  return false;
}

async function revokeCertPrepAccessForEnrollment(student, enrollment) {
  const sid = student?._id || student?.id;
  if (!sid) return { action: 'noop', reason: 'no-student' };
  const catalogId = enrollment
    ? await resolveCatalogCourseId(enrollment)
    : null;
  if (!catalogId) return { action: 'noop', reason: 'no-course' };
  const mappings = await CertPrepEnrollmentMapping.find({ courseId: catalogId }).lean();
  if (!mappings.length) return { action: 'noop', reason: 'no-mapping' };
  let deactivated = 0;
  for (const mapping of mappings) {
    // eslint-disable-next-line no-await-in-loop
    const still = await studentStillQualifiesForCertPrep(student, mapping.certPrepCourseId);
    if (still !== false) continue;
    // eslint-disable-next-line no-await-in-loop
    const out = await softDeactivateAccess(sid, mapping.certPrepCourseId);
    if (out.action === 'deactivated') deactivated += 1;
  }
  if (!deactivated) return { action: 'noop', reason: 'still-qualifying-or-inactive' };
  return { action: 'deactivated', deactivated };
}

async function reconcileStudentCertPrepAccess(student) {
  const sid = student?._id || student?.id;
  if (!sid) return { deactivated: 0, skipped: 'no-student' };
  const accesses = await StudentCertPrepAccess.find({ studentId: sid, isActive: true }).lean();
  let deactivated = 0;
  for (const row of accesses) {
    const still = await studentStillQualifiesForCertPrep(student, row.courseId);
    if (still === false) {
      const out = await softDeactivateAccess(sid, row.courseId);
      if (out.action === 'deactivated') deactivated += 1;
    }
  }
  return { deactivated };
}

async function safeRevokeCertPrepAccessForEnrollment(student, enrollment) {
  try {
    const result = await revokeCertPrepAccessForEnrollment(student, enrollment);
    return { ok: true, ...result };
  } catch (err) {
    logger.error('[CERT-PREP-ENROLL] revoke failed: %s', err.message);
    return { ok: false, error: err.message };
  }
}

async function safeReconcileStudentCertPrepAccess(student) {
  try {
    let doc = student;
    const hasEnrollmentShape = Array.isArray(student?.enrollments) || student?.course != null;
    if (!hasEnrollmentShape) {
      const id = typeof student === 'string' ? student : (student?._id || student?.id || student);
      doc = id ? await Student.findById(id) : null;
    }
    if (!doc) return { ok: true, skipped: 'no-student' };
    const result = await reconcileStudentCertPrepAccess(doc);
    return { ok: true, ...result };
  } catch (err) {
    logger.error('[CERT-PREP-ENROLL] reconcile failed: %s', err.message);
    return { ok: false, error: err.message };
  }
}

module.exports = {
  isQualifyingEnrollment,
  enrollmentsOf,
  mergeExpiresAt,
  resolveCatalogCourseId,
  listMappings,
  upsertMapping,
  setMappingActive,
  upsertAccess,
  findActiveMapping,
  findActiveMappings,
  syncEnrollmentToCertPrepAccess,
  syncStudentEnrollments,
  safeSyncStudentEnrollments,
  syncExistingEnrollments,
  softDeactivateAccess,
  studentStillQualifiesForCertPrep,
  revokeCertPrepAccessForEnrollment,
  reconcileStudentCertPrepAccess,
  safeRevokeCertPrepAccessForEnrollment,
  safeReconcileStudentCertPrepAccess,
};
