import {
  coalesceSavedPathTopicId,
  lastPathTopicStorageKey,
  pickActivePathTopic as pickActivePathTopicShared,
} from '../../../shared/dailyPractice/lastPathTopic.mjs';
import dailyPracticeApi from '../services/dailyPracticeApi';

export { lastPathTopicStorageKey, coalesceSavedPathTopicId, pickActivePathTopicShared as pickActivePathTopic };

export function readStudentUserId() {
  try {
    const user = JSON.parse(localStorage.getItem('student_user') || '{}');
    return String(user.id || user._id || '').trim();
  } catch {
    return '';
  }
}

export function readLastPathTopicId(userId = readStudentUserId()) {
  try {
    return localStorage.getItem(lastPathTopicStorageKey(userId)) || '';
  } catch {
    return '';
  }
}

export function writeLastPathTopicId(topicId, userId = readStudentUserId()) {
  const id = String(topicId || '').trim();
  if (!id) return;
  try {
    localStorage.setItem(lastPathTopicStorageKey(userId), id);
  } catch {
    /* ignore */
  }
}

export function resolveSavedPathTopicId(userId = readStudentUserId(), serverTopicId = '') {
  return coalesceSavedPathTopicId(readLastPathTopicId(userId), serverTopicId);
}

export function syncLastPathTopicFromServer(serverTopicId, userId = readStudentUserId()) {
  const id = String(serverTopicId || '').trim();
  if (!id) return;
  writeLastPathTopicId(id, userId);
}

export function persistLastPathTopicId(topicId, userId = readStudentUserId()) {
  writeLastPathTopicId(topicId, userId);
  void dailyPracticeApi.student.setActivePathTopic(topicId).catch(() => {});
}
