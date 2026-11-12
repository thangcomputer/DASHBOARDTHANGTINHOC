'use strict';

const Student = require('../models/Student');

const FREE_COURSE_NAME = 'Tài khoản miễn phí';

function hasRealCourseEnrollment(student) {
  const list = Array.isArray(student?.enrollments) ? student.enrollments : [];
  const freeName = FREE_COURSE_NAME.toLowerCase();
  return list.some((enrollment) => {
    if (enrollment?.learningAccess === false) return false;
    const status = String(enrollment?.status || 'active').toLowerCase();
    if (status === 'cancelled' || status === 'refunded' || status === 'pending_payment') return false;
    if (status === 'completed' || status === 'hoàn thành' || status === 'hoan thanh') return false;
    if (status !== 'active' && status !== 'paused') return false;
    const total = Number(enrollment?.totalSessions) || 0;
    const done = Number(enrollment?.completedSessions) || 0;
    if (total > 0 && done >= total) return false;
    const label = String(enrollment?.courseName || '').trim().toLowerCase();
    return Boolean(label) && label !== freeName;
  });
}

function isFreePortalLocked(student) {
  return student?.freePortal === true && student?.freeUnlocked !== true;
}

const SURVEY_SOURCES = new Set(['google', 'tiktok', 'facebook', 'referral', 'other']);
const SURVEY_LEVELS = new Set(['beginner', 'some', 'advanced']);
const SURVEY_FEARS = new Set(['scam', 'no_guidance', 'not_understand', 'no_support', 'none']);

function freePortalFlags(student) {
  if (!student || student.freePortal !== true) {
    return { freePortal: false, freeUnlocked: false, needsFreeSurvey: false };
  }
  const hasSurvey = Boolean(student.freeSurvey?.answeredAt || student.freeSurvey?.done);
  return {
    freePortal: true,
    freeUnlocked: student.freeUnlocked === true,
    needsFreeSurvey: !hasSurvey,
  };
}

async function saveFreeSurvey(studentId, body = {}) {
  const isMobileFormat = Boolean(body.fromWhere || body.birthYear || body.occupation);
  let survey = {};
  if (isMobileFormat) {
    const fromWhere = String(body.fromWhere || '').trim().slice(0, 100);
    const birthYear = Number(body.birthYear) || null;
    const occupation = String(body.occupation || '').trim().slice(0, 100);
    survey = {
      fromWhere,
      birthYear,
      occupation,
      done: true,
      answeredAt: new Date(),
    };
  } else {
    const source = String(body.source || '');
    const level = String(body.level || '');
    const fear = String(body.fear || '');
    const sourceNote = String(body.sourceNote || '').trim().slice(0, 80);
    if (!SURVEY_SOURCES.has(source) || !SURVEY_LEVELS.has(level) || !SURVEY_FEARS.has(fear)) {
      const error = new Error('Hãy chọn đủ 3 câu');
      error.status = 400;
      throw error;
    }
    if (source === 'other' && sourceNote.length < 2) {
      const error = new Error('Hãy ghi bạn biết trung tâm qua đâu');
      error.status = 400;
      throw error;
    }
    survey = {
      source,
      sourceNote: source === 'other' ? sourceNote : '',
      level,
      fear,
      done: true,
      answeredAt: new Date(),
    };
  }
  const student = await Student.findById(studentId).select('freePortal freeSurvey').lean();
  if (!student?.freePortal) {
    const error = new Error('Chỉ tài khoản miễn phí làm khảo sát');
    error.status = 403;
    throw error;
  }
  if (student.freeSurvey?.answeredAt) return student.freeSurvey;
  await Student.updateOne(
    { _id: studentId, freePortal: true },
    { $set: { freeSurvey: survey } },
  );
  return survey;
}

async function unlockFreePortal(studentId) {
  if (!studentId) return;
  await Student.updateOne(
    { _id: studentId, freePortal: true, freeUnlocked: { $ne: true } },
    { $set: { freeUnlocked: true } },
  );
}

module.exports = {
  FREE_COURSE_NAME,
  isFreePortalLocked,
  hasRealCourseEnrollment,
  freePortalFlags,
  saveFreeSurvey,
  unlockFreePortal,
};
