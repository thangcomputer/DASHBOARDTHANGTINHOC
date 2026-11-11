import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  coalesceSavedPathTopicId,
  lastPathTopicStorageKey,
  pickActivePathTopic as pickActivePathTopicShared,
} from '../../../shared/dailyPractice/lastPathTopic.mjs';
import { dailyPracticeApi } from '../services/dailyPracticeApi';

export { lastPathTopicStorageKey, coalesceSavedPathTopicId };

export function pickActivePathTopic<T extends { topic: { id: string } }>(
  path: { topics?: T[]; activeTopicId?: string } | null | undefined,
  initialTopicId = '',
  savedTopicId = '',
): T | null {
  return pickActivePathTopicShared(path as never, initialTopicId, savedTopicId) as T | null;
}

const memCache = new Map<string, string>();

export async function readLastPathTopicId(userId?: string) {
  const key = lastPathTopicStorageKey(userId);
  if (memCache.has(key)) return memCache.get(key) || '';
  try {
    const value = (await AsyncStorage.getItem(key)) || '';
    memCache.set(key, value);
    return value;
  } catch {
    return '';
  }
}

export async function writeLastPathTopicId(topicId: string, userId?: string) {
  const id = String(topicId || '').trim();
  if (!id) return;
  const key = lastPathTopicStorageKey(userId);
  memCache.set(key, id);
  try {
    await AsyncStorage.setItem(key, id);
  } catch {
    /* ignore */
  }
}

export async function resolveSavedPathTopicId(userId?: string, serverTopicId = '') {
  const local = await readLastPathTopicId(userId);
  return coalesceSavedPathTopicId(local, serverTopicId);
}

export async function syncLastPathTopicFromServer(serverTopicId: string, userId?: string) {
  const id = String(serverTopicId || '').trim();
  if (!id) return;
  await writeLastPathTopicId(id, userId);
}

export async function persistLastPathTopicId(topicId: string, userId?: string) {
  await writeLastPathTopicId(topicId, userId);
  void dailyPracticeApi.setActivePathTopic(topicId).catch(() => {});
}
