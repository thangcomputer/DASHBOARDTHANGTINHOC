'use strict';

function claimStudentAttempt(StudentModel, {
  studentId,
  subjectId,
  attemptId,
  setFields,
}) {
  return StudentModel.findOneAndUpdate(
    {
      _id: studentId,
      examProgress: {
        $elemMatch: {
          id: subjectId,
          attemptId,
          attemptStatus: 'active',
        },
      },
    },
    { $set: setFields },
    { returnDocument: 'after', runValidators: true },
  );
}

function claimTeacherAttempt(TeacherModel, {
  teacherId,
  attemptId,
  setFields,
}) {
  return TeacherModel.findOneAndUpdate(
    {
      _id: teacherId,
      examAttemptId: attemptId,
      examAttemptStatus: 'active',
    },
    { $set: setFields },
    { returnDocument: 'after', runValidators: true },
  );
}

module.exports = {
  claimStudentAttempt,
  claimTeacherAttempt,
};
