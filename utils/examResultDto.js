/**
 * ExamResult writable DTOs — explicit allowlist (no req.body spread).
 */
const CREATE_FIELDS = [
  'type',
  'studentId',
  'studentName',
  'teacherId',
  'teacherName',
  'subject',
  'multipleChoiceCorrect',
  'multipleChoiceTotal',
  'essayScore',
  'essayNote',
  'passed',
  'date',
];

/** Identity fields locked after create */
const UPDATE_FIELDS = [
  'studentName',
  'teacherName',
  'subject',
  'multipleChoiceCorrect',
  'multipleChoiceTotal',
  'essayScore',
  'essayNote',
  'passed',
  'date',
];

function pickExamResultCreate(body = {}) {
  const out = {};
  for (const key of CREATE_FIELDS) {
    if (body[key] !== undefined) out[key] = body[key];
  }
  if (!out.type) out.type = 'student';
  return out;
}

function pickExamResultUpdate(body = {}) {
  const out = {};
  for (const key of UPDATE_FIELDS) {
    if (body[key] !== undefined) out[key] = body[key];
  }
  return out;
}

module.exports = {
  CREATE_FIELDS,
  UPDATE_FIELDS,
  pickExamResultCreate,
  pickExamResultUpdate,
};
