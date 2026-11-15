import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import { DeviceEventEmitter, Platform } from 'react-native';

export const OFFLINE_VIDEOS_UPDATED_EVENT = 'mobile:offline-videos-updated';

const OFFLINE_INDEX_KEY = 'thangtinhoc.offlineVideoIndex.v1';
const OFFLINE_CRYPTO_KEY = 'thangtinhoc.offlineVideoKey.v1';
const OFFLINE_DIR_NAME = 'offline_videos';
const TEMP_CACHE_PREFIX = 'tth_play_';
const MAGIC_HEADER = [84, 84, 72, 69, 78, 67, 48, 49]; // "TTHENC01"

export type OfflineVideoRecord = {
  lessonKey: string;
  title: string;
  courseTitle: string;
  subjectName: string;
  sizeBytes: number;
  ext: string;
  encryptedFileName: string;
  downloadedAt: string;
  antiSeekEnabled: boolean;
  sourceUrl: string;
};

function sanitizeKeySegment(raw: string) {
  return String(raw || 'lesson')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 72) || 'lesson';
}

function getOfflineDirectory(): Directory {
  const dir = new Directory(Paths.document, OFFLINE_DIR_NAME);
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
  return dir;
}

async function getOrCreateEncryptionKey(): Promise<Uint8Array> {
  if (Platform.OS === 'web') {
    throw new Error('Lưu video mã hóa offline chỉ khả dụng trên ứng dụng di động.');
  }
  let hex = await SecureStore.getItemAsync(OFFLINE_CRYPTO_KEY);
  if (!hex || hex.length !== 64) {
    const bytes = new Uint8Array(32);
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor((Math.random() * 256 + (Date.now() % 256) + i * 31) % 256);
    }
    hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    await SecureStore.setItemAsync(OFFLINE_CRYPTO_KEY, hex);
  }
  const key = new Uint8Array(32);
  for (let i = 0; i < 32; i += 1) {
    key[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16) || 0;
  }
  return key;
}

function transformWithKey(input: Uint8Array, key: Uint8Array, skipHeader = false): Uint8Array {
  const out = new Uint8Array(input.length);
  const start = skipHeader ? MAGIC_HEADER.length : 0;
  for (let i = 0; i < start; i += 1) out[i] = input[i];
  for (let i = start; i < input.length; i += 1) {
    const k = key[i % key.length] ^ ((i * 13 + 7) & 0xff);
    out[i] = input[i] ^ k;
  }
  return out;
}

async function readIndex(): Promise<Record<string, OfflineVideoRecord>> {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_INDEX_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, OfflineVideoRecord>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function writeIndex(index: Record<string, OfflineVideoRecord>) {
  await AsyncStorage.setItem(OFFLINE_INDEX_KEY, JSON.stringify(index));
}

function detectExtension(url: string): string {
  const match = String(url || '').match(/\.(mp4|webm|ogg|m4v|mov)(?:$|[?#])/i);
  return match ? match[1].toLowerCase() : 'mp4';
}

export async function listOfflineVideos(): Promise<OfflineVideoRecord[]> {
  if (Platform.OS === 'web') return [];
  const index = await readIndex();
  const dir = getOfflineDirectory();
  const nextIndex: Record<string, OfflineVideoRecord> = {};
  const list: OfflineVideoRecord[] = [];
  for (const [key, item] of Object.entries(index)) {
    if (!item?.encryptedFileName) continue;
    const file = new File(dir, item.encryptedFileName);
    if (file.exists) {
      nextIndex[key] = item;
      list.push(item);
    }
  }
  if (Object.keys(nextIndex).length !== Object.keys(index).length) {
    await writeIndex(nextIndex);
  }
  return list.sort((a, b) => (b.downloadedAt || '').localeCompare(a.downloadedAt || ''));
}

export async function getOfflineVideoRecord(lessonKey: string): Promise<OfflineVideoRecord | null> {
  if (Platform.OS === 'web' || !lessonKey) return null;
  const list = await listOfflineVideos();
  return list.find((item) => item.lessonKey === lessonKey) || null;
}

export async function downloadEncryptedOfflineVideo(params: {
  lessonKey: string;
  url: string;
  title: string;
  courseTitle: string;
  subjectName: string;
  antiSeekEnabled: boolean;
  onProgress?: (pct: number) => void;
}): Promise<OfflineVideoRecord> {
  if (Platform.OS === 'web') {
    throw new Error('Tính năng tải video offline chỉ hoạt động trên ứng dụng di động.');
  }
  const { lessonKey, url, title, courseTitle, subjectName, antiSeekEnabled, onProgress } = params;
  const safeId = sanitizeKeySegment(lessonKey);
  const ext = detectExtension(url);
  const tempFile = new File(Paths.cache, `tth_dl_${safeId}_${Date.now()}.${ext}`);
  const encFileName = `${safeId}.tthbin`;
  const dir = getOfflineDirectory();
  const encFile = new File(dir, encFileName);

  try {
    if (tempFile.exists) tempFile.delete();
    const task = File.createDownloadTask(url, tempFile, {
      onProgress: ({ bytesWritten, totalBytes }) => {
        if (totalBytes > 0 && onProgress) {
          onProgress(Math.min(95, Math.max(1, Math.round((bytesWritten / totalBytes) * 95))));
        }
      },
    });
    const downloaded = await task.downloadAsync();
    if (!downloaded) {
      throw new Error('Không thể tải tệp video ngoại tuyến.');
    }
    const rawBytes = await downloaded.bytes();
    if (!rawBytes.length) {
      throw new Error('Tệp video tải về bị rỗng.');
    }

    const key = await getOrCreateEncryptionKey();
    const cipherPayload = transformWithKey(rawBytes, key, false);
    const wrapped = new Uint8Array(MAGIC_HEADER.length + cipherPayload.length);
    wrapped.set(MAGIC_HEADER, 0);
    wrapped.set(cipherPayload, MAGIC_HEADER.length);

    if (encFile.exists) encFile.delete();
    encFile.create({ overwrite: true });
    await encFile.write(wrapped);
    onProgress?.(100);

    const record: OfflineVideoRecord = {
      lessonKey,
      title: title || 'Video bài giảng',
      courseTitle: courseTitle || 'Khóa học',
      subjectName: subjectName || '',
      sizeBytes: wrapped.length,
      ext,
      encryptedFileName: encFileName,
      downloadedAt: new Date().toISOString(),
      antiSeekEnabled,
      sourceUrl: url,
    };
    const index = await readIndex();
    index[lessonKey] = record;
    await writeIndex(index);
    DeviceEventEmitter.emit(OFFLINE_VIDEOS_UPDATED_EVENT);
    return record;
  } finally {
    try {
      if (tempFile.exists) tempFile.delete();
    } catch {
      // Bỏ qua lỗi dọn tệp tạm.
    }
  }
}

export async function prepareOfflinePlaybackUri(lessonKey: string): Promise<string | null> {
  if (Platform.OS === 'web' || !lessonKey) return null;
  const record = await getOfflineVideoRecord(lessonKey);
  if (!record) return null;
  const dir = getOfflineDirectory();
  const encFile = new File(dir, record.encryptedFileName);
  if (!encFile.exists) return null;

  const encryptedBytes = await encFile.bytes();
  if (encryptedBytes.length <= MAGIC_HEADER.length) {
    throw new Error('Tệp video ngoại tuyến không hợp lệ.');
  }
  for (let i = 0; i < MAGIC_HEADER.length; i += 1) {
    if (encryptedBytes[i] !== MAGIC_HEADER[i]) {
      throw new Error('Không thể giải mã video do sai khóa bảo mật thiết bị.');
    }
  }
  const key = await getOrCreateEncryptionKey();
  const cipherSlice = encryptedBytes.subarray(MAGIC_HEADER.length);
  const plainBytes = transformWithKey(cipherSlice, key, false);

  const safeId = sanitizeKeySegment(lessonKey);
  const playbackFile = new File(Paths.cache, `${TEMP_CACHE_PREFIX}${safeId}_${Date.now()}.${record.ext || 'mp4'}`);
  playbackFile.create({ overwrite: true });
  await playbackFile.write(plainBytes);
  return playbackFile.uri;
}

export async function releaseOfflinePlaybackUri(uri: string | null | undefined): Promise<void> {
  if (Platform.OS === 'web' || !uri) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Bỏ qua khi đã xóa trước đó.
  }
}

export async function deleteOfflineVideo(lessonKey: string): Promise<void> {
  if (Platform.OS === 'web') return;
  const index = await readIndex();
  const existing = index[lessonKey];
  if (existing?.encryptedFileName) {
    try {
      const file = new File(getOfflineDirectory(), existing.encryptedFileName);
      if (file.exists) file.delete();
    } catch {
      // Bỏ qua nếu đã xóa vật lý.
    }
  }
  delete index[lessonKey];
  await writeIndex(index);
  DeviceEventEmitter.emit(OFFLINE_VIDEOS_UPDATED_EVENT);
}

export async function cleanupTempDecryptedVideos(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const entries = Paths.cache.list();
    for (const item of entries) {
      if (item instanceof File && item.name.startsWith(TEMP_CACHE_PREFIX)) {
        try {
          item.delete();
        } catch {
          // Bỏ qua nếu đang được giải phóng.
        }
      }
    }
  } catch {
    // Bỏ qua nếu thư mục cache chưa sẵn sàng.
  }
}

export function formatOfflineBytes(bytes: number): string {
  const n = Number(bytes || 0);
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
