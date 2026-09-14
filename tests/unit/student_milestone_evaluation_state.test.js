const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

function normalizeCourseName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function isMilestoneDone({ evaluations, submittedKeys, studentId, courseName, milestone }) {
  const normalizedCourse = normalizeCourseName(courseName);
  const studentKey = String(studentId);
  const matches = (evaluation) => {
    if (String(evaluation?.studentId || '') !== studentKey) return false;
    if (evaluation?.milestone !== milestone) return false;
    const savedCourse = normalizeCourseName(evaluation?.courseName);
    return !normalizedCourse || !savedCourse || savedCourse === normalizedCourse;
  };
  return evaluations.some(matches)
    || submittedKeys.has(`${studentKey}::${normalizedCourse}::${milestone}`);
}

describe('student milestone evaluation state', () => {
  it('recognizes a submitted lesson-one evaluation despite course formatting differences', () => {
    assert.equal(isMilestoneDone({
      evaluations: [{
        studentId: 'student-1',
        courseName: '  Tin   học văn phòng ',
        milestone: 'lesson_1',
      }],
      submittedKeys: new Set(),
      studentId: 'student-1',
      courseName: 'Tin học văn phòng',
      milestone: 'lesson_1',
    }), true);
  });

  it('keeps a successful local submission done before the server refresh returns', () => {
    assert.equal(isMilestoneDone({
      evaluations: [],
      submittedKeys: new Set(['student-1::tin học văn phòng::lesson_1']),
      studentId: 'student-1',
      courseName: 'Tin học văn phòng',
      milestone: 'lesson_1',
    }), true);
  });
});
