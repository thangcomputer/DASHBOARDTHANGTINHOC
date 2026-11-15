import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

export const HOME_WIDGET_STORAGE_KEY = 'thangtinhoc.widget.v1';

export type HomeWidgetSnapshot = {
  userId: string;
  studentName: string;
  streak: number;
  playedToday: boolean;
  todayXp: number;
  xp: number;
  todayClassesCount: number;
  nextClassLabel: string;
  nextClassTime: string;
  nextClassLive: boolean;
  offlineVideosCount: number;
  updatedAt: string;
};

export async function saveHomeWidgetSnapshot(snapshot: Omit<HomeWidgetSnapshot, 'updatedAt'>): Promise<HomeWidgetSnapshot> {
  const full: HomeWidgetSnapshot = {
    ...snapshot,
    updatedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(HOME_WIDGET_STORAGE_KEY, JSON.stringify(full)).catch(() => undefined);
  if (Platform.OS !== 'web') {
    try {
      const file = new File(Paths.document, 'widget_snapshot.json');
      file.create({ overwrite: true });
      await file.write(JSON.stringify(full));
    } catch {
      // Bỏ qua nếu hệ điều hành chưa cho phép ghi file sandbox.
    }
  }
  return full;
}

export async function readHomeWidgetSnapshot(): Promise<HomeWidgetSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(HOME_WIDGET_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as HomeWidgetSnapshot;
  } catch {
    return null;
  }
}

