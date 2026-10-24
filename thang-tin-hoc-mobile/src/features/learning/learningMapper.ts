import type { LearningCourse, LearningLesson, LearningProgressMap, LearningUnit } from './learningTypes';

function asString(value: unknown, fallback = '—') {
  if (typeof value === 'string') return value.trim() || fallback;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
}

function asNumber(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function formatDuration(totalSeconds: number) {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '—';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  if (minutes > 0) return `${minutes}:${String(seconds).padStart(2, '0')}`;
  return `0:${String(seconds).padStart(2, '0')}`;
}

function parseDuration(raw: unknown) {
  if (typeof raw === 'number') return Math.max(0, raw);
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return 0;
    if (trimmed.includes(':')) {
      const parts = trimmed.split(':').map((part) => Number(part));
      if (parts.length === 2 && parts.every((part) => Number.isFinite(part))) {
        return parts[0] * 60 + parts[1];
      }
      if (parts.length === 3 && parts.every((part) => Number.isFinite(part))) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
      }
    }
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) return Math.max(0, numeric);
  }
  return 0;
}

function mapLesson(raw: any): LearningLesson {
  const id = String(raw?._id || raw?.id || raw?.lessonId || 'lesson');
  const title = asString(raw?.title || raw?.name || raw?.lessonTitle || 'Bài học');
  const durationSeconds = parseDuration(raw?.duration || raw?.videoDuration || raw?.requiredSeconds || raw?.requiredWatchSeconds || 0);
  const watchedSeconds = Math.max(0, asNumber(raw?.watchedSeconds || raw?.progressSeconds || raw?.currentProgress || 0, 0));
  const durationLabel = formatDuration(durationSeconds);
  const progress = durationSeconds > 0 ? Math.min(100, Math.round((watchedSeconds / durationSeconds) * 100)) : asNumber(raw?.progress || raw?.completedPercent || 0, 0);
  const completed = Boolean(raw?.completed || raw?.isCompleted || raw?.status === 'completed');
  const isUnlocked = raw?.isUnlocked ?? raw?.canAccess ?? raw?.isAccessible ?? true;
  const locked = raw?.locked === true || raw?.isLocked === true || raw?.canAccess === false || raw?.isAccessible === false || isUnlocked === false;
  return {
    _id: id,
    title,
    duration: durationLabel,
    progress,
    completed,
    locked,
    videoUrl: typeof raw?.videoUrl === 'string' ? raw.videoUrl : undefined,
    content: typeof raw?.content === 'string' ? raw.content : undefined,
    order: asNumber(raw?.order || raw?.position, 0),
    isUnlocked: Boolean(isUnlocked),
    canAccess: Boolean(isUnlocked),
  };
}

function mapUnit(raw: any, fallbackTitle: string): LearningUnit {
  const sectionsRaw = Array.isArray(raw?.sections) ? raw.sections : Array.isArray(raw?.lessons) ? raw.lessons : [];
  return {
    _id: String(raw?._id || raw?.id || `${fallbackTitle}-unit`),
    title: asString(raw?.title || raw?.name || fallbackTitle),
    sections: sectionsRaw.map((lesson: any) => mapLesson(lesson)),
  };
}

export function mapBackendCourse(raw: any): LearningCourse {
  const courseId = String(raw?._id || raw?.id || raw?.courseId || 'course');
  const rawUnits = Array.isArray(raw?.units) ? raw.units : Array.isArray(raw?.chapters) ? raw.chapters : [];
  const sections = Array.isArray(raw?.lessons) || Array.isArray(raw?.videos) ? [{ _id: `${courseId}-unit`, title: 'Nội dung khóa học', sections: (raw?.lessons || raw?.videos || []).map((lesson: any) => mapLesson(lesson)) }] : [];
  const mappedUnits = rawUnits.length > 0
    ? rawUnits.map((unit: any) => mapUnit(unit, unit?.title || 'Chương'))
    : sections;

  const defaultProgress = asNumber(raw?.progress || raw?.completedPercent || raw?.percent || raw?.watchProgress, 0);
  const course: LearningCourse = {
    _id: courseId,
    title: asString(raw?.title || raw?.name || 'Khóa học'),
    subject: asString(raw?.subject || raw?.category || 'Tin học'),
    description: asString(raw?.description || raw?.summary || 'Khóa học đang được cập nhật.'),
    software: asString(raw?.software || raw?.tooling || raw?.softwareName || '—'),
    progress: Math.min(100, Math.max(0, defaultProgress)),
    units: mappedUnits,
    enrolled: raw?.enrolled ?? raw?.isEnrolled ?? raw?.purchased ?? raw?.isPurchased ?? true,
    deliveryMode: raw?.deliveryMode === 'video' ? 'video' : 'instructor',
    totalSessions: asNumber(raw?.totalSessions || raw?.lessonCount || raw?.lessons?.length || raw?.videos?.length || 0, 0),
    price: asNumber(raw?.price || 0, 0),
  };

  if (!course.units.length && raw?.lessons?.length) {
    course.units = [{ _id: `${course._id}-overview`, title: 'Bài học', sections: (raw.lessons as any[]).map((lesson: any) => mapLesson(lesson)) }];
  }

  return course;
}

export function mapBackendLesson(raw: any): LearningLesson {
  return mapLesson(raw);
}

export function mapBackendProgress(raw: unknown): LearningProgressMap {
  if (!raw || typeof raw !== 'object') return {};
  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>).map(([key, value]) => [String(key), Math.min(100, Math.max(0, asNumber(value, 0)))])
  );
}
