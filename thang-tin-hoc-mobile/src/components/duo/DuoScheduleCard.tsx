import React from 'react';
import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Calendar, Clock, Video } from 'lucide-react-native';
import { DuoButton } from './DuoButton';

export type ScheduleItem = {
  id: string;
  title: string;
  time: string;
  dateLabel: string;
  teacher?: string;
  meetLink?: string;
  live?: boolean;
};

interface DuoScheduleCardProps {
  schedules?: ScheduleItem[];
  todayClasses?: Array<{
    id: string;
    title: string;
    time: string;
    dateLabel: string;
    meetLink?: string;
    live?: boolean;
    teacher?: string;
  }>;
  meetCards?: Array<{
    _id?: string;
    id?: string;
    slotKey?: string;
    slotLabel?: string;
    startTime?: string;
    endTime?: string;
    dayLabel?: string;
    live?: boolean;
    linkHoc?: string;
  }>;
  firstSchedule?: {
    title?: string;
    time?: string;
    dateLabel?: string;
  } | null;
  nextMeet?: {
    slotLabel?: string;
    startTime?: string;
    endTime?: string;
    dayLabel?: string;
  } | null;
  onPressAllSchedule?: () => void;
  onOpenSchedule?: () => void;
}

export function DuoScheduleCard({
  schedules,
  todayClasses = [],
  meetCards = [],
  firstSchedule,
  nextMeet,
  onPressAllSchedule,
  onOpenSchedule,
}: DuoScheduleCardProps) {
  const onAll = onOpenSchedule || onPressAllSchedule;

  let resolvedList: ScheduleItem[] = schedules || [];
  if (!schedules) {
    const list: ScheduleItem[] = [];
    if (meetCards.length > 0) {
      meetCards.forEach((m) => {
        list.push({
          id: m._id || m.id || m.slotKey || String(Math.random()),
          title: m.slotLabel || 'Ca học Meet',
          time: `${m.startTime || ''} – ${m.endTime || ''}`,
          dateLabel: m.dayLabel || 'Hôm nay',
          meetLink: m.linkHoc,
          live: m.live,
        });
      });
    }
    if (todayClasses.length > 0) {
      todayClasses.forEach((c) => {
        list.push({
          id: c.id,
          title: c.title,
          time: c.time,
          dateLabel: c.dateLabel,
          meetLink: c.meetLink,
          live: c.live,
          teacher: c.teacher,
        });
      });
    }
    resolvedList = list;
  }

  if (resolvedList.length === 0) {
    const upcomingText = firstSchedule
      ? `Lịch tới: ${firstSchedule.title || 'Buổi học'} · ${firstSchedule.time} (${firstSchedule.dateLabel})`
      : nextMeet
      ? `Lớp tới: ${nextMeet.slotLabel || 'Ca học'} · ${nextMeet.startTime}–${nextMeet.endTime} (${nextMeet.dayLabel})`
      : 'Thoải mái tự luyện tập và nâng cao chuỗi ngày 🔥';

    return (
      <View style={styles.emptyCard}>
        <View style={styles.emptyIconBox}>
          <Calendar size={18} color="#059669" />
        </View>
        <View style={styles.emptyTextCol}>
          <Text style={styles.emptyTitle}>Hôm nay không có lịch học Meet</Text>
          <Text style={styles.emptySub}>{upcomingText}</Text>
        </View>
        {onAll ? (
          <Pressable onPress={onAll} hitSlop={8}>
            <Text style={styles.viewAllText}>Xem lịch</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={styles.calendarIconBox}>
            <Calendar size={18} color="#2563EB" />
          </View>
          <Text style={styles.cardTitle}>Lịch học Meet</Text>
        </View>
        {onAll ? (
          <Pressable onPress={onAll} hitSlop={8}>
            <Text style={styles.viewAllText}>Xem lịch</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.schedulesList}>
        {resolvedList.map((item) => (
          <View key={item.id} style={[styles.itemCard, item.live && styles.itemCardLive]}>
            <View style={styles.itemInfoCol}>
              <View style={styles.itemTitleRow}>
                {item.live ? (
                  <View style={styles.livePulseBadge}>
                    <Text style={styles.livePulseText}>ĐANG DIỄN RA</Text>
                  </View>
                ) : null}
                <Text style={styles.itemTitle} numberOfLines={1}>
                  {item.title}
                </Text>
              </View>

              <View style={styles.itemMetaRow}>
                <Clock size={13} color="#64748B" />
                <Text style={styles.itemMetaText}>{item.time}</Text>
                <Text style={styles.metaDot}>·</Text>
                <Text style={styles.itemMetaText}>{item.dateLabel}</Text>
                {item.teacher ? (
                  <>
                    <Text style={styles.metaDot}>·</Text>
                    <Text style={styles.itemTeacherText}>GV: {item.teacher}</Text>
                  </>
                ) : null}
              </View>
            </View>

            {item.meetLink ? (
              <DuoButton
                variant={item.live ? 'primary' : 'blue'}
                size="sm"
                icon={<Video size={14} color="#FFFFFF" />}
                text="Vào Meet"
                onPress={() => {
                  if (item.meetLink) void Linking.openURL(item.meetLink);
                }}
              />
            ) : (
              <View style={styles.noLinkPill}>
                <Text style={styles.noLinkText}>Chưa có link</Text>
              </View>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderBottomWidth: 4,
    borderBottomColor: '#CBD5E1',
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  calendarIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563EB',
  },
  schedulesList: {
    gap: 10,
  },
  itemCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  itemCardLive: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  itemInfoCol: {
    flex: 1,
    gap: 4,
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  livePulseBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  livePulseText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
    flex: 1,
  },
  itemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  itemMetaText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  metaDot: {
    fontSize: 12,
    color: '#94A3B8',
  },
  itemTeacherText: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '700',
  },
  noLinkPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  noLinkText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  emptyCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: '#DCFCE7',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  emptyIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTextCol: {
    flex: 1,
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#065F46',
  },
  emptySub: {
    fontSize: 12,
    color: '#047857',
    fontWeight: '500',
    marginTop: 1,
  },
});
