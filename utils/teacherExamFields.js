'use strict';

const TEACHER_EXAM_CONTROLLED_FIELDS = new Set([
  'testScore',
  'testStatus',
  'testDate',
  'testNotes',
  'testMcCorrect',
  'testMcWrong',
  'testMcTotal',
  'passed',
  'faceViolationCount',
  'lockReason',
  'practicalFile',
  'practicalFileUrl',
  'practicalStatus',
  'approvedAt',
  'status',
]);

function attemptedTeacherExamFields(body) {
  return Object.keys(body || {}).filter((key) => TEACHER_EXAM_CONTROLLED_FIELDS.has(key));
}

module.exports = {
  TEACHER_EXAM_CONTROLLED_FIELDS,
  attemptedTeacherExamFields,
};
