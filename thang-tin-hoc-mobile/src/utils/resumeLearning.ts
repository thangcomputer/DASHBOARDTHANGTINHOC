import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter, Platform } from 'react-native';

export type LastStudySession = {
  kind: 'lesson_practice' | 'lms_video';
  studentId: string;
  courseId: string;
  courseTitle: string;
  subjectId: string;
  subjectName: string;
  unitId: string;
  unitTitle: string;
  sectionId: string;
  sectionLabel: string;
  atSec: number;
  durationSec: number;
  progressPct: number;
  updatedAt: number;
};

export const LAST_STUDY_UPDATED_EVENT = 'tth:last-study-updated';

const STORAGE_PREFIX = 'tth_last_study_v1:';
const LATEST_KEY = `${STORAGE_PREFIX}latest`;

const memoryCache = new Map<string, LastStudySession>();

function normalizeStudentId(studentId?: string) {
  return String(studentId || '').trim();
}

function storageKeyFor(studentId?: string) {
  const sid = normalizeStudentId(studentId);
  return sid ? `${STORAGE_PREFIX}${sid}` : LATEST_KEY;
}

async function readRaw(key: string): Promise<string | null> {
  if (Platform.OS === 'web' && typeof globalThis.localStorage !== 'undefined') {
    return globalThis.localStorage.getItem(key);
  }
  return AsyncStorage.getItem(key);
}

async function writeRaw(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web' && typeof globalThis.localStorage !== 'undefined') {
    globalThis.localStorage.setItem(key, value);
    return;
  }
  await AsyncStorage.setItem(key, value);
}

function normalizeSession(
  raw: Partial<LastStudySession> | null | undefined,
  fallbackStudentId = '',
): LastStudySession | null {
  if (!raw || typeof raw !== 'object') return null;
  const courseId = String(raw.courseId || '').trim();
  const subjectId = String(raw.subjectId || '').trim();
  const unitId = String(raw.unitId || '').trim();
  if (!courseId && !subjectId && !unitId) return null;

  const studentId = normalizeStudentId(raw.studentId) || normalizeStudentId(fallbackStudentId);
  const progressRaw = Number(raw.progressPct);
  return {
    kind: raw.kind === 'lms_video' ? 'lms_video' : 'lesson_practice',
    studentId,
    courseId,
    courseTitle: String(raw.courseTitle || '').trim(),
    subjectId,
    subjectName: String(raw.subjectName || '').trim(),
    unitId,
    unitTitle: String(raw.unitTitle || '').trim(),
    sectionId: String(raw.sectionId || '').trim(),
    sectionLabel: String(raw.sectionLabel || '').trim(),
    atSec: Math.max(0, Math.floor(Number(raw.atSec) || 0)),
    durationSec: Math.max(0, Math.floor(Number(raw.durationSec) || 0)),
    progressPct: Number.isFinite(progressRaw) ? Math.min(100, Math.max(0, Math.round(progressRaw))) : 0,
    updatedAt: Number(raw.updatedAt) > 0 ? Number(raw.updatedAt) : Date.now(),
  };
}

export async function saveLastStudySession(
  payload: Partial<LastStudySession>,
): Promise<LastStudySession | null> {
  const sid = normalizeStudentId(payload.studentId);
  const cached = memoryCache.get(storageKeyFor(sid)) || memoryCache.get(LATEST_KEY);
  const sameUnit =
    cached
    && (!payload.unitId || cached.unitId === String(payload.unitId).trim())
    && (!payload.sectionId || cached.sectionId === String(payload.sectionId).trim());

  const merged: Partial<LastStudySession> = sameUnit
    ? {
      ...cached,
      ...payload,
      atSec: payload.atSec != null ? payload.atSec : cached.atSec,
      durationSec: payload.durationSec || cached.durationSec,
      progressPct: payload.progressPct != null ? payload.progressPct : cached.progressPct,
      updatedAt: Date.now(),
    }
    : {
      ...payload,
      updatedAt: Date.now(),
    };

  const normalized = normalizeSession(merged, sid);
  if (!normalized) return null;

  const serialized = JSON.stringify(normalized);
  memoryCache.set(LATEST_KEY, normalized);
  if (normalized.studentId) {
    memoryCache.set(storageKeyFor(normalized.studentId), normalized);
  }

  try {
    await writeRaw(LATEST_KEY, serialized);
    if (normalized.studentId) {
      await writeRaw(storageKeyFor(normalized.studentId), serialized);
    }
  } catch {
    // ignore storage quota errors; in-memory cache still updates dashboard
  }

  DeviceEventEmitter.emit(LAST_STUDY_UPDATED_EVENT, normalized);
  return normalized;
}

export async function readLastStudySession(studentId = ''): Promise<LastStudySession | null> {
  const sid = normalizeStudentId(studentId);
  const primaryKey = storageKeyFor(sid);
  const cached = memoryCache.get(primaryKey);
  if (cached) return cached;

  const candidates = sid ? [primaryKey, LATEST_KEY] : [LATEST_KEY];
  for (const key of candidates) {
    try {
      const raw = await readRaw(key);
      if (!raw) continue;
      const parsed = normalizeSession(JSON.parse(raw) as Partial<LastStudySession>, sid);
      if (!parsed) continue;
      if (sid && parsed.studentId && parsed.studentId !== sid) continue;
      memoryCache.set(primaryKey, parsed);
      return parsed;
    } catch {
      // ignore corrupted storage entry
    }
  }
  return null;
}

export function formatResumeTimeAgo(updatedAt?: number): string {
  const ts = Number(updatedAt) || 0;
  if (!ts) return 'Gần đây';
  const diffMs = Math.max(0, Date.now() - ts);
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'Vừa mới học';
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Hôm qua';
  return `${days} ngày trước`;
}

export function formatLmsTimestamp(seconds?: number): string {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

