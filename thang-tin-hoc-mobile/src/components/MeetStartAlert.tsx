import React, { useEffect, useRef, useState } from 'react';
import { DeviceEventEmitter, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Calendar, Clock, User, Video, X } from 'lucide-react-native';
import { useAudioPlayer } from 'expo-audio';
import { mobileApiRequest } from '../services/apiClient';
import { isMeetLiveNow, isMeetJoinWindow, meetLessonName, vnScheduleClock } from '../utils/meetJoin';
import { getMobileSoundEnabled } from '../services/soundPreferences';
import { SOCKET_EVENTS } from '../services/socketService';
import { DuoButton } from './duo/DuoButton';
import { useAuth } from '../app/AuthContext';
import { isFreePortalMenu } from './FreePortalModals';
import type { DemoUser } from '../types';
import {
  MEET_ALERT_SNOOZE_MS,
  meetAlertDismissMs,
  meetAlertIds,
  meetAlertKicker,
  minutesUntilMeetStart,
  resolveMeetJoinLink,
  sameMeetAlert,
} from '../../../shared/meetStartAlert.mjs';

type AlertClassItem = {
  id: string;
  scheduleId?: string;
  course: string;
  title: string;
  day?: string;
  startTime: string;
  endTime: string;
  linkHoc: string;
  personInfo?: string;
  isLive: boolean;
};

const STORAGE_KEY = 'meet_start_alerted_map';

function dayLabel(day?: string) {
  if (!day) return 'Hôm nay';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(day))) return 'Hôm nay';
  try {
    const weekday = new Date(`${day}T12:00:00+07:00`).toLocaleDateString('vi-VN', {
      weekday: 'long',
      timeZone: 'Asia/Ho_Chi_Minh',
    });
    const [, month, date] = String(day).split('-');
    return `${weekday}, ${date}/${month}`;
  } catch {
    return day;
  }
}

function normalizeScheduleDay(raw?: unknown): string {
  const s = String(raw || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const values = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function MeetStartAlert({ user }: { user?: DemoUser | null }) {
  const auth = useAuth();
  const currentUser = user || auth?.user;
  const role = String(currentUser?.role || 'student').toLowerCase();
  const isTeacher = role === 'teacher';
  const isFreePortal = role === 'student' && (
    (currentUser as any)?.freePortal === true || isFreePortalMenu(currentUser)
  );

  const [item, setItem] = useState<AlertClassItem | null>(null);
  const [ready, setReady] = useState(false);
  const dismissedMapRef = useRef<Record<string, number>>({});
  const player = useAudioPlayer(require('../assets/audio/notification.wav'));

  const isDismissed = (itemOrId: AlertClassItem | string) => {
    const ids = typeof itemOrId === 'string' ? [itemOrId] : meetAlertIds(itemOrId);
    return ids.some((id) => {
      const until = dismissedMapRef.current[id];
      return Boolean(until && Date.now() < until);
    });
  };

  const rememberDismissed = (item: AlertClassItem, durationMs: number) => {
    const until = Date.now() + durationMs;
    meetAlertIds(item).forEach((id) => {
      dismissedMapRef.current[id] = until;
    });
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(dismissedMapRef.current)).catch(() => {});
  };

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const parsed: unknown = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          dismissedMapRef.current = parsed as Record<string, number>;
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  // Lắng nghe socket event 'class:reminder'
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(SOCKET_EVENTS.CLASS_REMINDER, (data: any) => {
      if (!data) return;
      const incoming: AlertClassItem = {
        id: String(data.scheduleId || data.id || `socket-${data.startTime || Date.now()}`),
        scheduleId: data.scheduleId ? String(data.scheduleId) : '',
        course: data.course || 'Khóa học',
        title: data.course || 'Ca học theo lịch',
        day: vnScheduleClock().day,
        startTime: data.startTime || '',
        endTime: data.endTime || '',
        linkHoc: resolveMeetJoinLink(
          data.linkHoc,
          data.meetingUrl,
          role === 'student' ? (currentUser as any)?.linkHoc : '',
        ),
        personInfo: isTeacher
          ? (data.studentName ? `Học viên: ${data.studentName}` : '')
          : (data.teacherName ? `Giảng viên: ${data.teacherName}` : ''),
        isLive: Boolean(data.isLive ?? true),
      };
      if (isDismissed(incoming)) return;
      setItem((current) => {
        if (current && sameMeetAlert(current, incoming)) {
          return {
            ...current,
            ...incoming,
            id: current.id,
            linkHoc: resolveMeetJoinLink(incoming.linkHoc, current.linkHoc),
          };
        }
        return current || incoming;
      });
    });
    return () => {
      sub.remove();
    };
  }, [isTeacher]);

  // Quét định kỳ lịch học mỗi 15 giây
  useEffect(() => {
    if (!ready) return undefined;
    let active = true;

    const tick = async () => {
      try {
        const clock = vnScheduleClock();
        const todayStr = clock.day;
        const candidates: AlertClassItem[] = [];

        // 1. Quét lịch học 1 kèm 1 / lịch theo khóa từ /schedules (chỉ dành cho GV hoặc học viên chính quy)
        if (!isFreePortal) {
          try {
            const schRes = await mobileApiRequest<{ data?: any[] }>('/schedules?limit=100');
            const schList = Array.isArray(schRes?.data) ? schRes.data : [];
            for (const s of schList) {
              const id = String(s._id || s.id || '');
              if (!id) continue;
              const sDay = normalizeScheduleDay(s.date);
              if (sDay !== todayStr) continue;
              const status = String(s.status || '').toLowerCase();
              if (status === 'cancelled' || status === 'completed' || status === 'no_show') continue;

              const inWindow = isMeetJoinWindow({
                day: sDay,
                startTime: s.startTime,
                endTime: s.endTime,
                nowDay: clock.day,
                nowMinutes: clock.minutes,
                earlyMinutes: 1,
              });

              if (inWindow) {
                const isLive = isMeetLiveNow({
                  day: sDay,
                  startTime: s.startTime,
                  endTime: s.endTime,
                  nowDay: clock.day,
                  nowMinutes: clock.minutes,
                });

                const person = isTeacher
                  ? `Học viên: ${s.studentName || s.studentId?.name || 'Học viên'}`
                  : `Giảng viên: ${s.teacherName || s.teacherId?.name || 'Giảng viên'}`;

                const link = resolveMeetJoinLink(
                  s.linkHoc,
                  s.meetingUrl,
                  role === 'student' ? (currentUser as any)?.linkHoc : '',
                );

                const row: AlertClassItem = {
                  id,
                  scheduleId: id,
                  course: s.course || s.courseName || 'Khóa học',
                  title: s.title || s.course || 'Ca học theo lịch',
                  day: sDay,
                  startTime: s.startTime || '',
                  endTime: s.endTime || '',
                  linkHoc: link,
                  personInfo: person,
                  isLive,
                };
                if (isDismissed(row)) continue;
                candidates.push(row);
              }
            }
          } catch {
            /* Bỏ qua lỗi fetch schedules */
          }
        }

        // 2. Quét thêm từ meet-classes (nếu có lớp meet nhóm)
        try {
          const meetRes = await mobileApiRequest<{ data?: any[] }>('/meet-classes/mine');
          const meetList = Array.isArray(meetRes?.data) ? meetRes.data : [];
          for (const m of meetList) {
            const id = String(m._id || m.id || '');
            if (!id || String(m.status) === 'cancelled') continue;
            const inWindow = isMeetJoinWindow({
              day: m.day,
              startTime: m.startTime,
              endTime: m.endTime,
              nowDay: clock.day,
              nowMinutes: clock.minutes,
              earlyMinutes: 1,
            });
            if (inWindow) {
              const isLive = isMeetLiveNow({
                day: m.day,
                startTime: m.startTime,
                endTime: m.endTime,
                nowDay: clock.day,
                nowMinutes: clock.minutes,
              });
              const row: AlertClassItem = {
                id,
                scheduleId: id,
                course: m.title || 'Lớp học trực tuyến',
                title: meetLessonName(m),
                day: m.day,
                startTime: m.startTime || '',
                endTime: m.endTime || '',
                linkHoc: resolveMeetJoinLink(m.linkHoc),
                personInfo: '',
                isLive,
              };
              if (isDismissed(row)) continue;
              candidates.push(row);
            }
          }
        } catch {
          /* Bỏ qua lỗi fetch meet-classes */
        }

        if (candidates.length > 0 && active) {
          candidates.sort((a, b) => (b.isLive ? 1 : 0) - (a.isLive ? 1 : 0));
          const target = candidates[0];
          setItem((current) => {
            if (current && sameMeetAlert(current, target)) {
              return {
                ...current,
                ...target,
                id: current.id,
                linkHoc: resolveMeetJoinLink(target.linkHoc, current.linkHoc),
              };
            }
            return current || target;
          });
        }
      } catch {
        /* Bỏ qua lỗi */
      }
    };

    tick();
    const timer = setInterval(tick, 45000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [ready, role, isTeacher, isFreePortal]);

  // Âm thanh chuông báo
  useEffect(() => {
    if (!item) {
      player.pause();
      void player.seekTo(0).catch(() => {});
      return undefined;
    }
    let stopped = false;
    player.loop = true;
    getMobileSoundEnabled()
      .then((enabled) => {
        if (stopped || !enabled) return;
        return player.seekTo(0).then(() => {
          if (!stopped) player.play();
        });
      })
      .catch(() => {});
    return () => {
      stopped = true;
      player.pause();
      void player.seekTo(0).catch(() => {});
    };
  }, [item?.id, player]);

  const handleClose = (durationMs: number) => {
    if (item) rememberDismissed(item, durationMs);
    player.pause();
    void player.seekTo(0).catch(() => {});
    setItem(null);
  };

  if (!item) return null;
  const link = resolveMeetJoinLink(item.linkHoc, role === 'student' ? (currentUser as any)?.linkHoc : '');
  const untilStart = minutesUntilMeetStart(item.startTime, vnScheduleClock().minutes);
  const kickerText = meetAlertKicker({
    isLive: item.isLive,
    isTeacher,
    minutesUntilStart: untilStart,
  });
  const quietMs = meetAlertDismissMs(item, vnScheduleClock().minutes);

  const actionText = item.isLive
    ? (isTeacher ? 'Vào lớp dạy ngay' : 'Vào lớp ngay')
    : 'Vào lớp chuẩn bị';

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => handleClose(quietMs)}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Pressable
            onPress={() => handleClose(quietMs)}
            style={styles.close}
            accessibilityRole="button"
            accessibilityLabel="Đóng"
          >
            <X size={18} color="#475569" />
          </Pressable>

          <Text style={styles.kicker}>{kickerText}</Text>
          <Text style={styles.title} numberOfLines={2}>{item.title}</Text>

          {item.personInfo ? (
            <View style={styles.personBadge}>
              <User size={14} color="#059669" />
              <Text style={styles.personText}>{item.personInfo}</Text>
            </View>
          ) : null}

          <View style={styles.metaRow}>
            <Clock size={15} color="#059669" />
            <Text style={styles.meta}>{item.startTime} – {item.endTime}</Text>
          </View>

          <View style={styles.metaRow}>
            <Calendar size={15} color="#059669" />
            <Text style={styles.meta}>{dayLabel(item.day)}</Text>
          </View>

          {link ? (
            <DuoButton
              variant="danger"
              text={actionText}
              icon={<Video size={16} color="#FFFFFF" />}
              onPress={() => {
                handleClose(quietMs);
                void Linking.openURL(link);
              }}
              style={styles.join}
            />
          ) : (
            <Text style={styles.nolink}>Buổi học trực tuyến chưa có link Meet</Text>
          )}

          <Pressable onPress={() => handleClose(MEET_ALERT_SNOOZE_MS)} accessibilityRole="button" style={styles.laterPress}>
            <Text style={styles.later}>Để sau (nhắc lại sau 5 phút)</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
  },
  card: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#A7F3D0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 20,
    shadowColor: '#059669',
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    elevation: 12,
  },
  close: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
  },
  kicker: {
    color: '#059669',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 6,
    marginBottom: 8,
    color: '#0F172A',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 28,
  },
  personBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  personText: {
    color: '#065F46',
    fontSize: 13,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  meta: {
    color: '#1E293B',
    fontSize: 14,
    fontWeight: '700',
  },
  join: {
    alignSelf: 'stretch',
    marginTop: 18,
  },
  nolink: {
    marginTop: 14,
    color: '#D97706',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  laterPress: {
    marginTop: 12,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  later: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '700',
  },
});
