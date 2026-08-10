/**
 * Phase 6 — Contacts discovery orchestration.
 * Policy authority: MessagingPolicy.canDiscoverContacts (pure).
 * This module: load candidates + map + filter. No second matrix.
 */
'use strict';

const Teacher = require('../models/Teacher');
const Student = require('../models/Student');
const Branch = require('../models/Branch');
const {
  canDiscoverContacts,
  resolveAuthoritativeTenantId,
  resolveProductRole,
  getMessagingRole,
  PRODUCT_ROLES,
} = require('./messagingPolicy');

const CONTACT_SELECT = 'name adminRole gender phone branchId branchCode avatar role status';

function staffDisplayName(rawName) {
  return (rawName && String(rawName).trim()) ? String(rawName).trim() : 'Nhân viên';
}

async function buildBranchTenantMap(branchIds = []) {
  const ids = [...new Set(
    branchIds
      .filter(Boolean)
      .map((id) => String(id))
      .filter((id) => id.length === 24),
  )];
  const map = new Map();
  if (!ids.length) return map;
  const rows = await Branch.find({ _id: { $in: ids } }).select('tenantId').lean();
  for (const r of rows) {
    if (r?.tenantId != null && r.tenantId !== '') {
      map.set(String(r._id), String(r.tenantId));
    }
  }
  return map;
}

function tenantForDoc(doc, branchTenantMap) {
  if (doc?.tenantId != null && doc.tenantId !== '') return String(doc.tenantId);
  const bid = doc?.branchId != null ? String(doc.branchId) : null;
  if (bid && branchTenantMap.has(bid)) return branchTenantMap.get(bid);
  // Align with messagingPolicy.resolveAuthoritativeTenantId when Branch.tenantId is unset
  if (bid) return `branch:${bid}`;
  return null;
}

function mapContactFromDoc(doc, transportRoleHint, branchTenantMap) {
  const id = String(doc._id || doc.id);
  const role = transportRoleHint
    || getMessagingRole({ id, role: doc.role, adminRole: doc.adminRole });
  const productRole = resolveProductRole({
    id,
    role: doc.role,
    adminRole: doc.adminRole,
  }) || (role === 'teacher' ? PRODUCT_ROLES.TEACHER
    : role === 'student' ? PRODUCT_ROLES.STUDENT : null);
  const transportRole = getMessagingRole({
    id,
    role: doc.role || role,
    adminRole: doc.adminRole,
  });
  return {
    id,
    name: doc.name || 'Không rõ tên',
    role: transportRole,
    transportRole,
    adminRole: doc.adminRole || null,
    productRole,
    gender: doc.gender || '',
    phone: doc.phone || '',
    avatar: doc.avatar || String(doc.name || 'U').substring(0, 2).toUpperCase(),
    branchId: doc.branchId ? String(doc.branchId) : null,
    branchCode: doc.branchCode || '',
    tenantId: tenantForDoc(doc, branchTenantMap),
  };
}

function mapElevated(doc, forceProduct, branchTenantMap) {
  const ar = forceProduct || (doc.adminRole === 'HIGH_ADMIN' ? 'HIGH_ADMIN' : 'SUPER_ADMIN');
  const adminId = (String(doc._id) === 'admin' || doc.phone === 'admin') ? 'admin' : String(doc._id);
  return {
    id: adminId,
    name: (doc.name && String(doc.name).trim())
      ? String(doc.name).trim()
      : (ar === 'HIGH_ADMIN' ? 'Admin cấp cao' : 'Super Admin'),
    role: 'admin',
    transportRole: 'admin',
    adminRole: ar,
    productRole: ar,
    phone: doc.phone || '',
    avatar: doc.avatar || String(doc.name || 'AD').substring(0, 2).toUpperCase(),
    branchId: doc.branchId ? String(doc.branchId) : null,
    branchCode: doc.branchCode || '',
    tenantId: tenantForDoc(doc, branchTenantMap),
    gender: doc.gender || '',
  };
}

async function loadHighAdminDocs() {
  return Teacher.find({ adminRole: 'HIGH_ADMIN' }, CONTACT_SELECT).lean();
}

async function loadSuperAdminDocs() {
  return Teacher.find(
    {
      $or: [
        { adminRole: 'SUPER_ADMIN' },
        { phone: 'admin', adminRole: { $nin: ['STAFF', 'SUPPORT', 'HIGH_ADMIN'] } },
      ],
    },
    CONTACT_SELECT,
  ).lean();
}

async function loadCandidateDocs(actorUser, { queryBranchId } = {}) {
  const userId = String(actorUser.id || actorUser._id || '');
  const userRole = String(actorUser.role || '').toLowerCase();
  const adminRole = actorUser.adminRole || null;
  const candidates = [];

  const pushTeachers = (docs, meta = {}) => {
    for (const d of docs || []) candidates.push({ doc: d, kind: 'teacher', ...meta });
  };
  const pushStudents = (docs, meta = {}) => {
    for (const d of docs || []) candidates.push({ doc: d, kind: 'student', ...meta });
  };

  if (adminRole === 'SUPER_ADMIN' || userId === 'admin') {
    pushTeachers(await loadHighAdminDocs(), { elevated: 'HIGH_ADMIN' });
  } else if (adminRole === 'HIGH_ADMIN') {
    const branchFilter = queryBranchId && queryBranchId !== 'all'
      ? { branchId: queryBranchId }
      : {};
    const [supers, staffDocs, teacherDocs, studentDocs, highs] = await Promise.all([
      loadSuperAdminDocs(),
      Teacher.find({ adminRole: { $in: ['STAFF', 'SUPPORT'] }, ...branchFilter }, CONTACT_SELECT).lean(),
      Teacher.find({ role: 'teacher', status: { $in: ['Active', 'active'] }, ...branchFilter }, CONTACT_SELECT).lean(),
      Student.find({ ...branchFilter }, CONTACT_SELECT).lean(),
      loadHighAdminDocs(),
    ]);
    pushTeachers(supers, { elevated: 'SUPER_ADMIN' });
    pushTeachers(highs.filter((h) => String(h._id) !== userId), { elevated: 'HIGH_ADMIN' });
    pushTeachers(staffDocs);
    pushTeachers(teacherDocs);
    pushStudents(studentDocs);
  } else if (adminRole === 'SUPPORT') {
    const [highs, staffDocs, teacherDocs, studentDocs] = await Promise.all([
      loadHighAdminDocs(),
      Teacher.find({ adminRole: 'STAFF' }, CONTACT_SELECT).lean(),
      Teacher.find({ role: 'teacher', status: { $in: ['Active', 'active'] } }, CONTACT_SELECT).lean(),
      Student.find({}, CONTACT_SELECT).lean(),
    ]);
    pushTeachers(highs, { elevated: 'HIGH_ADMIN' });
    pushTeachers(staffDocs);
    pushTeachers(teacherDocs);
    pushStudents(studentDocs);
  } else if (adminRole === 'STAFF') {
    const staffUser = await Teacher.findById(userId).select('branchId').lean();
    const staffBranchId = staffUser?.branchId ? String(staffUser.branchId) : null;
    const teacherQ = staffBranchId
      ? { role: 'teacher', status: { $in: ['Active', 'active'] }, branchId: staffBranchId }
      : { role: 'teacher', status: { $in: ['Active', 'active'] } };
    const studentQ = staffBranchId ? { branchId: staffBranchId } : {};
    const supportQ = staffBranchId
      ? { adminRole: 'SUPPORT', $or: [{ branchId: staffBranchId }, { branchId: null }, { branchId: { $exists: false } }] }
      : { adminRole: 'SUPPORT' };
    const [highs, supportDocs, teacherDocs, studentDocs] = await Promise.all([
      loadHighAdminDocs(),
      Teacher.find(supportQ, CONTACT_SELECT).lean(),
      Teacher.find(teacherQ, CONTACT_SELECT).lean(),
      Student.find(studentQ, CONTACT_SELECT).lean(),
    ]);
    pushTeachers(highs, { elevated: 'HIGH_ADMIN' });
    pushTeachers(supportDocs);
    pushTeachers(teacherDocs);
    pushStudents(studentDocs);
  } else if (userRole === 'teacher') {
    const teacher = await Teacher.findById(userId).select('branchId assignedStudents').lean();
    const teacherBranchId = teacher?.branchId ? String(teacher.branchId) : null;
    const assignedIds = (teacher?.assignedStudents || []).filter(Boolean);
    const studentQuery = {
      $or: [
        { teacherId: userId },
        { 'enrollments.teacherId': userId },
        ...(assignedIds.length ? [{ _id: { $in: assignedIds } }] : []),
      ],
    };
    const staffQuery = teacherBranchId
      ? {
        adminRole: { $in: ['STAFF', 'SUPPORT'] },
        $or: [{ branchId: teacherBranchId }, { branchId: null }, { branchId: { $exists: false } }],
      }
      : { adminRole: { $in: ['STAFF', 'SUPPORT'] } };
    const [highs, staffDocs, studentDocs] = await Promise.all([
      loadHighAdminDocs(),
      Teacher.find(staffQuery, CONTACT_SELECT).lean(),
      Student.find(studentQuery, CONTACT_SELECT).lean(),
    ]);
    pushTeachers(highs, { elevated: 'HIGH_ADMIN' });
    pushTeachers(staffDocs);
    pushStudents(studentDocs, { assigned: true });
  } else if (userRole === 'student') {
    const student = await Student.findById(userId)
      .select('branchId teacherId enrollments.teacherId')
      .lean();
    const studentBranchId = student?.branchId ? String(student.branchId) : null;
    const myTeacherIds = new Set();
    if (student?.teacherId) myTeacherIds.add(String(student.teacherId));
    (student?.enrollments || []).forEach((e) => {
      if (e?.teacherId) myTeacherIds.add(String(e.teacherId));
    });
    const teacherIdList = [...myTeacherIds].filter(Boolean);
    const staffOnlyQuery = studentBranchId
      ? { adminRole: 'STAFF', branchId: studentBranchId }
      : { adminRole: 'STAFF' };
    const supportQuery = studentBranchId
      ? {
        adminRole: 'SUPPORT',
        $or: [{ branchId: studentBranchId }, { branchId: null }, { branchId: { $exists: false } }],
      }
      : { adminRole: 'SUPPORT' };
    const [staffDocs, supportDocs, teacherDocs] = await Promise.all([
      Teacher.find(staffOnlyQuery, CONTACT_SELECT).lean(),
      Teacher.find(supportQuery, CONTACT_SELECT).lean(),
      teacherIdList.length
        ? Teacher.find({ _id: { $in: teacherIdList }, role: 'teacher' }, CONTACT_SELECT).lean()
        : Promise.resolve([]),
    ]);
    pushTeachers(staffDocs);
    pushTeachers(supportDocs);
    pushTeachers(teacherDocs, { assigned: true });
  }

  return candidates;
}

async function listDiscoverableContacts(actorUser, options = {}) {
  const actorId = String(actorUser.id || actorUser._id || '');
  const actorTenantId = await resolveAuthoritativeTenantId({
    tenantId: actorUser.tenantId,
    branchId: actorUser.branchId,
  });
  const actor = {
    id: actorId,
    role: actorUser.role,
    adminRole: actorUser.adminRole,
    branchId: actorUser.branchId ? String(actorUser.branchId) : null,
    branchCode: actorUser.branchCode || '',
    tenantId: actorTenantId,
  };

  const candidates = await loadCandidateDocs(actorUser, options);
  const branchIds = [
    actor.branchId,
    ...candidates.map((c) => (c.doc?.branchId != null ? String(c.doc.branchId) : null)),
  ];
  const branchTenantMap = await buildBranchTenantMap(branchIds);

  if (!actor.tenantId && actor.branchId && branchTenantMap.has(actor.branchId)) {
    actor.tenantId = branchTenantMap.get(actor.branchId);
  }

  const out = [];
  const seen = new Set();

  for (const cand of candidates) {
    const doc = cand.doc;
    if (!doc) continue;
    const mapped = cand.elevated
      ? mapElevated(doc, cand.elevated, branchTenantMap)
      : mapContactFromDoc(
        doc,
        cand.kind === 'student' ? 'student' : undefined,
        branchTenantMap,
      );

    if (cand.kind === 'teacher' && doc.adminRole === 'SUPPORT') {
      mapped.name = staffDisplayName(doc.name);
      mapped.productRole = PRODUCT_ROLES.SUPPORT;
      mapped.adminRole = 'SUPPORT';
      mapped.role = 'staff';
      mapped.transportRole = 'staff';
    } else if (cand.kind === 'teacher' && (doc.adminRole === 'STAFF' || mapped.productRole === PRODUCT_ROLES.STAFF)) {
      mapped.name = staffDisplayName(doc.name);
    }

    if (!mapped.id || mapped.id === actorId) continue;
    if (seen.has(mapped.id)) continue;

    const sameBranch = Boolean(
      actor.branchId
      && mapped.branchId
      && String(actor.branchId) === String(mapped.branchId),
    );

    const targetRoleForPolicy = mapped.productRole === PRODUCT_ROLES.TEACHER
      ? 'teacher'
      : mapped.productRole === PRODUCT_ROLES.STUDENT
        ? 'student'
        : (mapped.adminRole ? 'admin' : mapped.role);

    const decision = canDiscoverContacts(actor, {
      id: mapped.id,
      role: targetRoleForPolicy,
      adminRole: mapped.adminRole,
      branchId: mapped.branchId,
      branchCode: mapped.branchCode,
      tenantId: mapped.tenantId,
    }, {
      sameBranch: actor.branchId && mapped.branchId ? sameBranch : undefined,
      assigned: cand.assigned === true,
      allowUnknownBranch: !actor.branchId || !mapped.branchId,
    });

    if (!decision.allowed) continue;
    seen.add(mapped.id);
    out.push(mapped);
  }

  return out;
}

module.exports = {
  listDiscoverableContacts,
  /** WRAPPER — re-export of MessagingPolicy.canDiscoverContacts (no second matrix). */
  canDiscoverContacts,
};
