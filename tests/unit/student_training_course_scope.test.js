'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

describe('student training documents respect assigned course', async () => {
  const helperPath = path.join(__dirname, '../../client/src/utils/enrollments.js');
  const { filterStudentTrainingFiles, filterStudentTrainingVideos } = await import(pathToFileURL(helperPath).href);
  const catalog = {
    word: { id: 'word', label: 'Word', group: 'office' },
  };
  const files = [
    { id: 'word-a', title: 'Tài liệu khóa A', courseId: 'course-a', courseName: 'Khóa A', examSubjects: ['word'] },
    { id: 'word-b', title: 'Tài liệu khóa B', courseId: 'course-b', courseName: 'Khóa B', examSubjects: ['word'] },
    { id: 'word-general', title: 'Tài liệu chung', examSubjects: ['word'] },
  ];

  it('does not expose a course-assigned file to another course with the same subject', () => {
    const visible = filterStudentTrainingFiles(files, {
      enrollments: [{ courseId: 'course-b', courseName: 'Khóa B' }],
      activeCourseName: 'Khóa B',
      allowedSubjectIds: ['word'],
      catalog,
    });

    assert.deepEqual(visible.map((file) => file.id), ['word-b', 'word-general']);
  });

  it('shows an assigned file when both course and active enrollment match', () => {
    const visible = filterStudentTrainingFiles(files, {
      enrollments: [{ courseId: 'course-a', courseName: 'Khóa A' }],
      activeCourseName: 'Khóa A',
      allowedSubjectIds: ['word'],
      catalog,
    });

    assert.deepEqual(visible.map((file) => file.id), ['word-a', 'word-general']);
  });

  it('shows course videos linked to the student enrollment even without subject metadata', () => {
    const videos = [
      { id: 'video-a', title: 'Bài giảng A', courseId: 'course-a' },
      { id: 'video-b', title: 'Bài giảng B', courseId: 'course-b' },
    ];

    const visible = filterStudentTrainingVideos(videos, {
      enrollments: [{ courseId: 'course-a', courseName: 'Khóa A' }],
      allowedSubjectIds: [],
      catalog,
    });

    assert.deepEqual(visible.map((video) => video.id), ['video-a']);
  });

  it('keeps same-subject course videos visible as offerings while hiding unrelated assigned videos', () => {
    const videos = [
      { id: 'word-b', title: 'Video khóa B', courseId: 'course-b', examSubjects: ['word'] },
      { id: 'other-course', title: 'Video khóa khác', courseId: 'course-c' },
    ];

    const visible = filterStudentTrainingVideos(videos, {
      enrollments: [{ courseId: 'course-a', courseName: 'Khóa A' }],
      allowedSubjectIds: ['word'],
      catalog,
    });

    assert.deepEqual(visible.map((video) => video.id), ['word-b']);
  });
});
