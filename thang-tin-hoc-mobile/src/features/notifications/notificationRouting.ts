import type { AppStackParamList, MainTabsParamList } from '../../navigation/types';
import type { UserRole } from '../../types';
import type { AppNotification } from '../../types';
import { notificationCategoryForType } from './notificationMapper';

type ScreenDestination = { kind: 'screen'; name: keyof AppStackParamList };
type TabDestination = { kind: 'tab'; name: keyof MainTabsParamList };
export type NotificationDestination =
  | ScreenDestination
  | TabDestination
  | { kind: 'unsupported'; reason: 'unknown' | 'web-only' };

export function resolveNotificationDestination(
  notification: AppNotification,
  role: UserRole,
): NotificationDestination {
  const path = String(notification.targetPath || '').toLowerCase();
  const type = String(notification.type || notification.payload?.type || '').toUpperCase();
  const rawCategory = String(notification.category || '').trim().toUpperCase();
  const category = notificationCategoryForType(rawCategory);

  if (
    path.includes('/exam')
    || path.includes('certification')
    || path.includes('onboard')
    || type === 'EXAM'
    || type === 'CERTIFICATION'
    || type === 'ONBOARDING'
    || rawCategory === 'THI'
    || rawCategory === 'BÀI KIỂM TRA'
  ) {
    return { kind: 'unsupported', reason: 'web-only' };
  }
  if (path.includes('inbox') || type === 'MESSAGE') return { kind: 'tab', name: 'Messages' };
  if (
    path.includes('schedule')
    || type === 'SCHEDULE'
    || category === 'Lịch dạy'
    || rawCategory === 'LỊCH HỌC'
  ) return { kind: 'tab', name: 'Schedule' };
  if (path.includes('assignment') || type === 'ASSIGNMENT' || rawCategory === 'BÀI TẬP') {
    return { kind: 'screen', name: 'Assignments' };
  }
  if (path.includes('finance') || type === 'FINANCE' || category === 'Tài chính') {
    return { kind: 'screen', name: role === 'teacher' ? 'TeacherFinance' : 'Tuition' };
  }
  if (path.includes('evaluation') || type === 'EVALUATION' || type === 'GRADE') {
    return { kind: 'screen', name: role === 'student' ? 'Evaluations' : 'Assignments' };
  }
  if (path.includes('news') || type === 'NEWS') return { kind: 'screen', name: 'News' };
  if (path.includes('training') || type === 'TRAINING') {
    return role === 'teacher'
      ? { kind: 'screen', name: 'TeacherTraining' }
      : { kind: 'unsupported', reason: 'unknown' };
  }
  if (
    path.includes('profile')
    || path.includes('center')
  ) return { kind: 'screen', name: 'CenterInfo' };
  if (type === 'COURSE' || type === 'STUDENT') {
    return { kind: 'screen', name: role === 'student' ? 'Materials' : 'TeacherTraining' };
  }
  return { kind: 'unsupported', reason: 'unknown' };
}
