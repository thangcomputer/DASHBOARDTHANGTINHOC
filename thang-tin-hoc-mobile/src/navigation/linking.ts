import type { LinkingOptions } from '@react-navigation/native';
import { Linking } from 'react-native';
import type { AppStackParamList } from './types';
import { navigationRef } from './navigationRef';

const APP_PREFIXES = [
  'thangtinhoc://',
  'https://thangtinhoc.vn',
  'https://www.thangtinhoc.vn',
  'https://thangtinhoc.edu.vn',
  'https://www.thangtinhoc.edu.vn',
];

/**
 * Chuẩn hóa các dạng link từ Zalo / Web về đường dẫn mà React Navigation map trực tiếp.
 * Ví dụ:
 * - thangtinhoc://lesson/course1/unit2/lesson3
 * - https://thangtinhoc.vn/student/courses?courseId=course1&unitId=unit2
 * - thangtinhoc://open?screen=DailyPractice&topicId=excel
 */
function normalizeIncomingUrl(rawUrl: string): string {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) return trimmed;
  try {
    const parsed = new URL(trimmed);
    const params = parsed.searchParams;
    const explicitScreen = params.get('screen');
    if (explicitScreen) {
      if (explicitScreen === 'CourseVideos') {
        return `thangtinhoc://courses?resumeCourseId=${encodeURIComponent(params.get('courseId') || params.get('resumeCourseId') || '')}&resumeSubjectId=${encodeURIComponent(params.get('subjectId') || params.get('resumeSubjectId') || '')}&resumeUnitId=${encodeURIComponent(params.get('unitId') || params.get('resumeUnitId') || '')}&resumeSectionId=${encodeURIComponent(params.get('sectionId') || params.get('resumeSectionId') || '')}`;
      }
      if (explicitScreen === 'DailyPractice') {
        return `thangtinhoc://daily-practice?topicId=${encodeURIComponent(params.get('topicId') || '')}&practice=${encodeURIComponent(params.get('practice') || '1')}`;
      }
      if (explicitScreen === 'Schedule') {
        return `thangtinhoc://schedule?focusScheduleId=${encodeURIComponent(params.get('scheduleId') || params.get('focusScheduleId') || '')}`;
      }
      if (explicitScreen === 'Conversation') {
        return `thangtinhoc://messages/${encodeURIComponent(params.get('conversationId') || '')}`;
      }
    }

    const cleanPath = parsed.pathname.replace(/^\/+/, '');
    if (cleanPath.startsWith('student/daily-practice') || cleanPath.startsWith('daily-practice')) {
      return `thangtinhoc://daily-practice${parsed.search}`;
    }
    if (cleanPath.startsWith('student/courses') || cleanPath.startsWith('courses')) {
      const courseId = params.get('courseId') || params.get('resumeCourseId') || '';
      const subjectId = params.get('subjectId') || params.get('resumeSubjectId') || '';
      const unitId = params.get('unitId') || params.get('resumeUnitId') || '';
      const sectionId = params.get('sectionId') || params.get('resumeSectionId') || '';
      if (courseId || subjectId || unitId || sectionId) {
        return `thangtinhoc://courses?resumeCourseId=${encodeURIComponent(courseId)}&resumeSubjectId=${encodeURIComponent(subjectId)}&resumeUnitId=${encodeURIComponent(unitId)}&resumeSectionId=${encodeURIComponent(sectionId)}`;
      }
      return 'thangtinhoc://courses';
    }
    if (cleanPath.startsWith('student/schedule') || cleanPath.startsWith('teacher/schedule') || cleanPath.startsWith('schedule')) {
      return `thangtinhoc://schedule${parsed.search}`;
    }
    if (cleanPath.startsWith('student/exam/')) {
      const quizId = cleanPath.replace('student/exam/', '').split('/')[0];
      if (quizId) return `thangtinhoc://exam/${encodeURIComponent(quizId)}`;
    }
    if (cleanPath.startsWith('messages/')) {
      const id = cleanPath.replace('messages/', '').split('/')[0];
      if (id) return `thangtinhoc://messages/${encodeURIComponent(id)}${parsed.search}`;
    }
  } catch {
    // Giữ nguyên chuỗi URL gốc nếu không parse được qua WHATWG URL.
  }
  return trimmed;
}

export const mobileLinkingConfig: LinkingOptions<AppStackParamList> = {
  prefixes: APP_PREFIXES,
  async getInitialURL() {
    const url = await Linking.getInitialURL();
    return url ? normalizeIncomingUrl(url) : null;
  },
  subscribe(listener) {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      listener(normalizeIncomingUrl(url));
    });
    return () => {
      subscription.remove();
    };
  },
  config: {
    screens: {
      MainTabs: {
        screens: {
          Home: 'home',
          Schedule: 'schedule',
          DailyPractice: 'daily-practice',
          CourseVideos: 'courses',
          Messages: 'messages',
          Feed: 'feed',
          Profile: 'profile',
          Support: 'support',
          Finance: 'finance',
        },
      },
      LearningLesson: 'lesson/:courseId/:unitId/:lessonId',
      CourseVideos: 'video-courses',
      DailyPractice: 'practice',
      StudentExam: 'exam/:quizId',
      Assignments: 'assignments/:assignmentId?',
      Conversation: 'messages/:conversationId',
      Feed: 'feed/:postId?',
      NewsDetail: 'news/:newsId',
      NotificationCenter: 'notifications',
      Tuition: 'tuition',
      CertPrepCatalog: 'cert-prep',
      Materials: 'materials',
      Grades: 'grades',
      LegalDocument: 'legal/:tab?',
    },
  },
};

export async function openDeepLinkInApp(rawUrl: string): Promise<boolean> {
  const url = normalizeIncomingUrl(rawUrl);
  if (!url) return false;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    const isInternalDomain = APP_PREFIXES.some((prefix) => url.startsWith(prefix));
    if (!isInternalDomain) {
      await Linking.openURL(url);
      return true;
    }
  }
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    const parts = parsed.pathname.split('/').filter(Boolean);
    const params = parsed.searchParams;
    if (!navigationRef.isReady()) return false;

    if (host === 'schedule' || parsed.pathname.includes('schedule')) {
      navigationRef.navigate('MainTabs', {
        screen: 'Schedule',
        params: params.get('focusScheduleId') ? { focusScheduleId: params.get('focusScheduleId') || undefined } : undefined,
      });
      return true;
    }
    if (host === 'daily-practice' || parsed.pathname.includes('daily-practice')) {
      navigationRef.navigate('MainTabs', {
        screen: 'DailyPractice',
        params: {
          topicId: params.get('topicId') || undefined,
          ...(params.get('practice') ? { practice: 'stage' as const } : {}),
        },
      });
      return true;
    }
    if (host === 'courses' || parsed.pathname.includes('courses')) {
      navigationRef.navigate('MainTabs', {
        screen: 'CourseVideos',
        params: {
          resumeKey: Date.now(),
          resumeCourseId: params.get('resumeCourseId') || undefined,
          resumeSubjectId: params.get('resumeSubjectId') || undefined,
          resumeUnitId: params.get('resumeUnitId') || undefined,
          resumeSectionId: params.get('resumeSectionId') || undefined,
        },
      });
      return true;
    }
    if (host === 'lesson' && parts.length >= 3) {
      navigationRef.navigate('LearningLesson', {
        courseId: parts[0],
        unitId: parts[1],
        lessonId: parts[2],
      });
      return true;
    }
    if (host === 'messages' && parts[0]) {
      navigationRef.navigate('Conversation', { conversationId: parts[0] });
      return true;
    }
    if (host === 'exam' && parts[0]) {
      navigationRef.navigate('StudentExam', { quizId: parts[0] });
      return true;
    }
    if (host === 'tuition') {
      navigationRef.navigate('Tuition');
      return true;
    }
    if (host === 'notifications') {
      navigationRef.navigate('NotificationCenter');
      return true;
    }
  } catch {
    return false;
  }
  return false;
}
