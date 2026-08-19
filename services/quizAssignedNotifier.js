'use strict';

const Student = require('../models/Student');
const logger = require('../config/logger');

/** Delay after teacher create before student sees invite (ms). */
const QUIZ_ASSIGN_DELAY_MS = 10_000;

function buildQuizAssignedPayload(quiz) {
  const q = quiz && typeof quiz.toObject === 'function' ? quiz.toObject() : quiz;
  return {
    quizId: String(q._id),
    title: q.title,
    courseName: q.courseName || '',
    teacherName: q.teacherName || '',
    timeLimitMinutes: q.timeLimitMinutes,
    questionsCount: Array.isArray(q.questions) ? q.questions.length : (q.questionsCount || 0),
    createdAt: q.createdAt || new Date(),
  };
}

async function resolveQuizRecipientIds(quiz) {
  const q = quiz && typeof quiz.toObject === 'function' ? quiz.toObject() : quiz;
  const targeted = (q.targetStudentIds || []).map(String).filter(Boolean);
  if (targeted.length) return [...new Set(targeted)];

  if (!q.courseName) return [];

  const students = await Student.find({
    $or: [
      { course: q.courseName },
      { 'enrollments.courseName': q.courseName },
    ],
  }).select('_id').lean();

  return students.map((s) => String(s._id));
}

/**
 * After QUIZ_ASSIGN_DELAY_MS, emit quiz:assigned to each target student.
 * Fire-and-forget; never throws to the create response path.
 */
function scheduleQuizAssignedNotify({ quiz, notifyUser, io }) {
  if (!quiz) return;

  const payload = buildQuizAssignedPayload(quiz);

  setTimeout(() => {
    resolveQuizRecipientIds(quiz)
      .then((ids) => {
        ids.forEach((id) => {
          try {
            if (typeof notifyUser === 'function') {
              notifyUser('student', id, 'quiz:assigned', payload);
            }
          } catch (err) {
            logger.warn({ err: err.message, studentId: id, quizId: payload.quizId }, '[QUIZ] quiz:assigned emit failed');
          }
        });
        
        // Tạo notification database để học viên có thể bấm vào trong tương lai
        if (ids.length && io) {
          try {
            const NotificationService = require('./NotificationService');
            NotificationService.send(io, {
              type: 'EXAM',
              title: '📝 Bài trắc nghiệm mới',
              content: `Giảng viên ${payload.teacherName} đã tạo bài trắc nghiệm: ${payload.title} (${payload.timeLimitMinutes} phút).`,
              receivers: ids,
              payload: { quizId: payload.quizId },
              link: '/student#materials',
            });
          } catch (err) {
            logger.warn({ err: err.message }, '[QUIZ] Failed to create persistent notification for quiz');
          }
        }

        if (ids.length) {
          logger.info(
            { quizId: payload.quizId, recipients: ids.length },
            '[QUIZ] quiz:assigned notified'
          );
        }
      })
      .catch((err) => {
        logger.warn({ err: err.message, quizId: payload.quizId }, '[QUIZ] resolve recipients failed');
      });
  }, QUIZ_ASSIGN_DELAY_MS);
}

module.exports = {
  QUIZ_ASSIGN_DELAY_MS,
  buildQuizAssignedPayload,
  resolveQuizRecipientIds,
  scheduleQuizAssignedNotify,
};
