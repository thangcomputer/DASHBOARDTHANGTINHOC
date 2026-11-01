import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  DeviceEventEmitter,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  CalendarDays, Camera, CheckCircle2, ChevronLeft, Clock, Copy, Download, FileText, ImagePlus, Info, MessageCircle,
  MoreHorizontal, Paperclip, Phone, Pin, PinOff, Plus, Reply, RotateCcw, Search, Send, Smile, ThumbsUp, Trash2, Video, X,
} from 'lucide-react-native';
import { AppHeader, AppScreen, Avatar, Card, EmptyState, ErrorState, LoadingSkeleton, PrimaryButton, SearchField } from '../components/ui';
import { useAuth } from '../app/AuthContext';
import { messageService, scheduleService } from '../services/mockService';
import { getMobileImageSource } from '../services/apiClient';
import { downloadChatAttachment, openChatAttachment } from '../services/chatFileAccess';
import {
  getChatReactionEmoji,
  getChatReactionType,
  mapLiveChatMessage,
  mapLiveReaction,
} from '../services/messageApi';
import {
  emitTypingStart,
  emitTypingStop,
  getLastSeenUsersSnapshot,
  getOnlineUsersSnapshot,
  SOCKET_EVENTS,
  joinChatGroup,
} from '../services/socketService';
import { getCallHistory, type CallHistoryEntry } from '../services/callHistoryApi';
import { CommunicationPreferencesCard } from '../components/CommunicationPreferencesCard';
import { getTeacherPublicCard } from '../services/teacherApi';
import { getStudentChatCard, getStudentDetail } from '../services/studentApi';
import { getContactAvatarSource, getRoleBadgeConfig } from '../utils/contactAvatars';
import { useMockResource } from '../hooks/useMockResource';
import { colors, radius, spacing, typography } from '../theme/tokens';
import type { AppStackParamList } from '../navigation/types';
import type { ChatMessage, Conversation, ScheduleItem } from '../types';
import {
  type ChatSticker,
  buildChatStickerToken,
  CHAT_STICKERS,
  getChatStickerImage,
  matchesChatStickerSearch,
  STICKER_CATEGORIES,
} from '../utils/chatStickers';

type Navigation = NativeStackNavigationProp<AppStackParamList>;
type PickerTab = 'emoji' | 'sticker' | 'gif' | 'attachment';
const conversationDrafts = new Map<string, string>();

function getScheduleMeetState(
  schedule: { date?: string; startTime?: string; endTime?: string; status: string; meetingUrl?: string },
  now: Date,
  fallbackMeetingUrl = '',
) {
  if (schedule.status !== 'upcoming' || !schedule.date || !schedule.startTime) return null;
  const date = schedule.date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const startTime = schedule.startTime.match(/^(\d{1,2}):(\d{2})/);
  const endTime = schedule.endTime?.match(/^(\d{1,2}):(\d{2})/);
  if (!date || !startTime) return null;
  const [, year, month, day] = date;
  const startHour = Number(startTime[1]);
  const startMinute = Number(startTime[2]);
  if ([startHour, startMinute].some((value) => !Number.isFinite(value) || value < 0)) return null;
  if (startHour > 23 || startMinute > 59) return null;
  const startAt = Date.UTC(Number(year), Number(month) - 1, Number(day), startHour - 7, startMinute);
  let endAt = startAt + 90 * 60 * 1000;
  if (endTime) {
    const endHour = Number(endTime[1]);
    const endMinute = Number(endTime[2]);
    if (![endHour, endMinute].every(Number.isFinite) || endHour > 23 || endMinute > 59) return null;
    endAt = Date.UTC(Number(year), Number(month) - 1, Number(day), endHour - 7, endMinute);
  }
  if (now.getTime() > endAt) return null;
  return {
    isLive: now.getTime() >= startAt,
    meetingUrl: normalizeMeetingUrl(schedule.meetingUrl) || normalizeMeetingUrl(fallbackMeetingUrl),
    startAt: startAt,
  };
}

function getAttendanceConfirmUnlockAt(schedule: ScheduleItem) {
  const date = String(schedule.date || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const time = String(schedule.startTime || '').match(/^(\d{1,2}):(\d{2})/);
  if (!date || !time) return null;
  const [, year, month, day] = date;
  const hour = Number(time[1]);
  const minute = Number(time[2]);
  if (hour > 23 || minute > 59) return null;
  return Date.UTC(Number(year), Number(month) - 1, Number(day), hour - 7, minute)
    + 15 * 60 * 1000;
}

function getVietnamDateKey(value: string | Date | undefined) {
  const raw = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const date = value instanceof Date ? value : new Date(raw);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function canTeacherMarkAttendance(schedule: ScheduleItem, now: Date) {
  if (!['upcoming', 'completed'].includes(schedule.status) || !schedule.id) return false;
  const date = String(schedule.date || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const startTime = String(schedule.startTime || '').match(/^(\d{1,2}):(\d{2})/);
  if (!date || !startTime) return false;
  const [, year, month, day] = date;
  const startHour = Number(startTime[1]);
  const startMinute = Number(startTime[2]);
  if (startHour > 23 || startMinute > 59) return false;
  const startAt = Date.UTC(Number(year), Number(month) - 1, Number(day), startHour - 7, startMinute);
  const endTime = String(schedule.endTime || '').match(/^(\d{1,2}):(\d{2})/);
  const endAt = endTime
    ? Date.UTC(Number(year), Number(month) - 1, Number(day), Number(endTime[1]) - 7, Number(endTime[2]))
    : startAt + 90 * 60 * 1000;
  const attendanceUnlockAt = startAt + 15 * 60 * 1000;
  const attendanceDeadline = endAt + 60 * 60 * 1000;
  return now.getTime() >= attendanceUnlockAt && now.getTime() <= attendanceDeadline;
}

function isTeacherAttendanceMarked(schedule: ScheduleItem) {
  return schedule.confirmedByStudent
    || schedule.status === 'completed'
    || ['accepted', 'admin_approved']
      .includes(String(schedule.attendanceConfirmStatus || ''));
}

function isTeacherAttendanceAwaitingConfirm(schedule: ScheduleItem) {
  return schedule.attendanceConfirmPending
    || String(schedule.attendanceConfirmStatus || '') === 'pending';
}

function isTeacherAttendanceUnderReview(schedule: ScheduleItem) {
  return String(schedule.attendanceConfirmStatus || '') === 'disputed';
}

function getPresenceUserIds(users: unknown[]) {
  return users.map((item) => {
    if (!item || typeof item !== 'object') return '';
    const user = item as { userId?: string; id?: string };
    return String(user.userId || user.id || '');
  }).filter(Boolean);
}

function formatLastSeenStatus(timestamp?: string) {
  if (!timestamp) return 'Chưa có dữ liệu truy cập';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'Chưa có dữ liệu truy cập';
  const now = new Date();
  const dateLabel = date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  });
  const timeLabel = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  return `Truy cập lần cuối: ${dateLabel}, ${timeLabel}`;
}

function normalizeMeetingUrl(value: unknown) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return '';
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

function scheduleDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function getWeekDays(offset: number) {
  const nowParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const nowValues = Object.fromEntries(nowParts.map((part) => [part.type, part.value]));
  const monday = new Date(Date.UTC(Number(nowValues.year), Number(nowValues.month) - 1, Number(nowValues.day), 12));
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7) + offset * 7);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setUTCDate(monday.getUTCDate() + index);
    return {
      dateKey: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`,
      weekday: index === 6 ? 'Chủ nhật' : `Thứ ${index + 2}`,
      label: new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit' }).format(date),
    };
  });
}

function getVietnamMinute(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return Number(values.hour) * 60 + Number(values.minute);
}

function timeToMinutes(value?: string) {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function normalizeCourseName(value?: string) {
  return String(value || '').trim().toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function getScheduleEndTime(startTime: string) {
  const start = timeToMinutes(startTime);
  if (start == null) return '';
  const end = start + 90;
  if (end >= 24 * 60) return '23:59';
  return `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
}

const WEEKLY_SCHEDULE_TIMES = Array.from({ length: 32 }, (_, index) => {
  const minutes = 7 * 60 + index * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}).filter((time) => (timeToMinutes(time) || 0) + 90 <= 24 * 60);

const CHAT_EMOJIS = [
  '😀', '😃', '😄', '😁', '😆', '😂', '😊', '😍',
  '🥰', '😘', '😎', '🤩', '🥳', '😢', '😭', '😡',
  '🤔', '👍', '❤️', '🔥', '🎉', '🙏', '👌', '💯',
  '😅', '😲', '😇', '😱', '👏', '🤝', '💪', '✨',
  '✅', '📚', '💡', '💕', '💖', '💔', '🙄', '🤗',
  '😴', '😣', '🤧', '😒', '😚', '😳', '🙁', '😤',
];

const SEARCH_TOKEN_SPLIT = /[\s,;+/\\|_-]+/;

function getChatAttachmentType(name: string) {
  const extension = name.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() || '';
  const types: Record<string, { label: string; color: string }> = {
    doc: { label: 'Tài liệu Word', color: '#1D4ED8' },
    docx: { label: 'Tài liệu Word', color: '#1D4ED8' },
    xls: { label: 'Bảng tính Excel', color: '#047857' },
    xlsx: { label: 'Bảng tính Excel', color: '#047857' },
    ppt: { label: 'Bài thuyết trình PowerPoint', color: '#EA580C' },
    pptx: { label: 'Bài thuyết trình PowerPoint', color: '#EA580C' },
    pdf: { label: 'Tài liệu PDF', color: '#DC2626' },
    txt: { label: 'Tệp văn bản', color: '#475569' },
    zip: { label: 'Tệp ZIP', color: '#D97706' },
    rar: { label: 'Tệp RAR', color: '#B45309' },
    '7z': { label: 'Tệp 7Z', color: '#B45309' },
  };
  return {
    extension: extension ? extension.toUpperCase() : 'FILE',
    ...(types[extension] || { label: 'Tệp đính kèm', color: '#475569' }),
  };
}

function unaccent(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase();
}

function matchesContactSearch(query: string, conversation: Conversation) {
  const tokens = query.trim().split(SEARCH_TOKEN_SPLIT).filter(Boolean).slice(0, 8);
  if (!tokens.length) return true;
  const name = unaccent(conversation.name);
  const extra = unaccent(conversation.zalo || '');
  const phoneDigits = String(conversation.phone || '').replace(/\D/g, '');
  const zaloDigits = String(conversation.zalo || '').replace(/\D/g, '');
  return tokens.every((token) => {
    const normalized = unaccent(token);
    if (name.includes(normalized) || extra.includes(normalized)) return true;
    const digits = token.replace(/\D/g, '');
    return digits.length >= 2 && (phoneDigits.includes(digits) || zaloDigits.includes(digits));
  });
}

export function MessagesScreen() {
  const navigation = useNavigation<Navigation>();
  const { user } = useAuth();
  const isTeacher = user?.role === 'teacher';
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'all' | 'student' | 'teacher' | 'recruitment' | 'admin' | 'support' | 'group'>('all');
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>(() => getPresenceUserIds(getOnlineUsersSnapshot()));
  const [socketStatus, setSocketStatus] = useState('');
  const categoryFilters = user?.role === 'teacher'
    ? [
        { id: 'all' as const, label: 'Tất cả' },
        { id: 'student' as const, label: 'Học viên' },
        { id: 'admin' as const, label: 'Admin' },
        { id: 'recruitment' as const, label: 'Tuyển sinh' },
        { id: 'support' as const, label: 'Hỗ trợ' },
        { id: 'group' as const, label: 'Nhóm' },
      ]
    : [
        { id: 'all' as const, label: 'Tất cả' },
        { id: 'teacher' as const, label: 'Giảng viên' },
        { id: 'recruitment' as const, label: 'Tuyển sinh' },
        { id: 'support' as const, label: 'Hỗ trợ' },
        { id: 'group' as const, label: 'Nhóm' },
      ];
  const loader = useCallback(() => messageService.conversations(isTeacher ? 'teacher' : 'student', user), [isTeacher, user]);
  const resource = useMockResource(loader);
  useFocusEffect(useCallback(() => {
    resource.reload();
  }, [resource.reload]));
  useEffect(() => {
    const subscriptions = [
      DeviceEventEmitter.addListener(SOCKET_EVENTS.MESSAGE_RECEIVED, () => { void resource.reload(); }),
      DeviceEventEmitter.addListener(SOCKET_EVENTS.MESSAGE_SENT_ACK, () => { void resource.reload(); }),
      DeviceEventEmitter.addListener(SOCKET_EVENTS.GROUP_NEW, (group: { _id?: string; id?: string }) => {
        const groupId = String(group?._id || group?.id || '');
        if (groupId) joinChatGroup(groupId);
        void resource.reload();
      }),
      DeviceEventEmitter.addListener(SOCKET_EVENTS.GROUP_DELETE, () => { void resource.reload(); }),
      DeviceEventEmitter.addListener(SOCKET_EVENTS.CONTACT_UPDATED, () => { void resource.reload(); }),
      DeviceEventEmitter.addListener(SOCKET_EVENTS.CONNECTED, () => setSocketStatus('')),
      DeviceEventEmitter.addListener(SOCKET_EVENTS.DISCONNECTED, () => setSocketStatus('Đang kết nối lại để đồng bộ tin nhắn…')),
      DeviceEventEmitter.addListener(SOCKET_EVENTS.ERROR, (error: { message?: string }) => {
        setSocketStatus(error?.message || 'Kết nối thời gian thực đang gặp sự cố.');
      }),
      DeviceEventEmitter.addListener(SOCKET_EVENTS.ONLINE_USERS, (users: unknown) => {
        if (Array.isArray(users)) {
          setOnlineUserIds(getPresenceUserIds(users));
        }
      }),
    ];
    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, [resource.reload]);
  useEffect(() => {
    const interval = setInterval(() => {
      resource.reload();
    }, 30000);
    return () => clearInterval(interval);
  }, [resource.reload]);
  const availableMembers = (resource.data || []).filter((item) => item.category !== 'group');
  const groupCandidates = availableMembers.filter((item) => matchesContactSearch(memberSearch, item));
  const conversations = (resource.data || []).filter((item) => (
    (category === 'all' || item.category === category)
    && matchesContactSearch(query, item)
  ));
  const sortedConversations = conversations
    .map((conversation, index) => ({
      conversation,
      index,
      online: conversation.category !== 'group' && onlineUserIds.includes(String(conversation.participantId || '')) ? 1 : 0,
    }))
    .sort((a, b) => {
      if (a.online !== b.online) return b.online - a.online;
      const aActivity = a.conversation.lastActivityAt || 0;
      const bActivity = b.conversation.lastActivityAt || 0;
      if (aActivity !== bActivity) return bActivity - aActivity;
      return a.index - b.index;
    })
    .map(({ conversation }) => conversation);
  const createGroup = async () => {
    const groupTitle = groupName.trim();
    const participants = availableMembers.filter((member) => selectedMembers.includes(member.id));
    if (!groupTitle || participants.length === 0) {
      Alert.alert('Thiếu thông tin', 'Nhập tên nhóm và chọn ít nhất một thành viên khác.');
      return;
    }
    setIsCreatingGroup(true);
    try {
      await messageService.createGroup(groupTitle, participants, user);
      await resource.reload();
      setCategory('group');
      setGroupName('');
      setMemberSearch('');
      setSelectedMembers([]);
      setShowCreateGroup(false);
    } catch (error) {
      Alert.alert('Không tạo được nhóm', error instanceof Error ? error.message : 'Vui lòng thử lại.');
    } finally {
      setIsCreatingGroup(false);
    }
  };

  return (
    <AppScreen contentStyle={styles.inboxScreen}>
      <AppHeader title="Hộp thư" icon={MessageCircle} />
      <SearchField value={query} onChangeText={setQuery} placeholder="Tìm họ, tên, tên đệm, SĐT..." />
      {socketStatus ? <Text style={styles.socketStatus}>{socketStatus}</Text> : null}
      {isTeacher ? (
        <Pressable onPress={() => setShowCreateGroup(true)} style={styles.createGroupButton} accessibilityRole="button" accessibilityLabel="Tạo nhóm chat">
          <Plus size={17} color={colors.brand} />
          <Text style={styles.createGroupText}>Tạo nhóm chat</Text>
        </Pressable>
      ) : null}
      <View style={styles.filtersWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersScroll}
        >
          {categoryFilters.map((filter) => {
            const active = category === filter.id;
            return (
              <Pressable
                key={filter.id}
                onPress={() => setCategory(filter.id)}
                style={[styles.filterChip, active && styles.filterChipActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.filterText, active && styles.filterTextActive]}>{filter.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      {resource.loading ? <LoadingSkeleton /> : null}
      {resource.error ? <ErrorState onRetry={resource.reload} /> : null}
      {!resource.loading && !resource.error && !sortedConversations.length ? (
        <EmptyState title="Chưa có liên hệ" message="Danh bạ được tải trực tiếp từ tài khoản trên máy chủ." />
      ) : null}
      {!resource.loading && !resource.error && sortedConversations.length > 0 ? (
        <View style={styles.contactListCard}>
          {sortedConversations.map((conversation, index) => {
            const badge = getRoleBadgeConfig(
              conversation.participantRole || conversation.role,
              conversation.adminRole,
            );
            const avatarSource = getContactAvatarSource(
              conversation.participantRole || conversation.role,
              conversation.adminRole,
              conversation.avatarUri,
            );
            const isLast = index === conversations.length - 1;
            const isOnline = conversation.category !== 'group'
              && Boolean(conversation.participantId && onlineUserIds.includes(conversation.participantId));
            return (
              <Pressable
                key={conversation.id}
                onPress={() => navigation.navigate('Conversation', {
                  conversationId: conversation.id,
                  conversationName: conversation.name,
                  participantId: conversation.participantId,
                  participantRole: conversation.participantRole || conversation.category,
                  participantOnline: isOnline,
                  participantAvatarUri: conversation.avatarUri,
                })}
                style={({ pressed }) => [
                  styles.contactRow,
                  pressed && styles.contactRowPressed,
                  !isLast && styles.contactRowDivider,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Mở cuộc trò chuyện với ${conversation.name}`}
              >
                {/* Avatar with Ring, Role Badge, and Online Dot */}
                <View style={styles.avatarContainer}>
                  <View style={[styles.avatarRing, { borderColor: badge.ring }]}>
                    <Image source={avatarSource} style={styles.avatarImg} />
                  </View>
                  <View style={[styles.roleBadgePill, { backgroundColor: badge.bg }]}>
                    <Text style={styles.roleBadgePillText}>
                      {conversation.roleBadge || badge.label}
                    </Text>
                  </View>
                  {isOnline ? <View style={styles.onlineDot} /> : null}
                </View>

                {/* Contact Information */}
                <View style={styles.contactInfoCol}>
                  <View style={styles.contactHeaderRow}>
                    <View style={styles.contactNameStatusRow}>
                      <Text numberOfLines={1} style={styles.contactNameText}>
                        {conversation.name}
                      </Text>
                      {isOnline ? (
                        <View style={styles.statusPillOnline}>
                          <Text style={styles.statusPillOnlineText}>online</Text>
                        </View>
                      ) : (
                        <View style={styles.statusPillOffline}>
                          <Text style={styles.statusPillOfflineText}>offline</Text>
                        </View>
                      )}
                    </View>
                    {conversation.time ? (
                      <Text style={styles.contactTimeText}>{conversation.time}</Text>
                    ) : null}
                  </View>

                  <View style={styles.contactMessageRow}>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.contactMessageText,
                        conversation.unread > 0 && styles.contactMessageTextUnread,
                      ]}
                    >
                      {conversation.lastMessage || 'Bắt đầu cuộc trò chuyện'}
                    </Text>
                    {conversation.unread > 0 ? (
                      <View style={styles.unreadCountBadge}>
                        <Text style={styles.unreadCountText}>
                          {conversation.unread > 99 ? '99+' : conversation.unread}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      <Modal visible={isTeacher && showCreateGroup} transparent animationType="slide" onRequestClose={() => setShowCreateGroup(false)}>
        <View style={styles.groupModalBackdrop}>
          <View style={styles.groupModal}>
            <View style={styles.rowBetween}>
              <Text style={styles.title}>Tạo nhóm chat mới</Text>
              <Pressable onPress={() => setShowCreateGroup(false)} style={styles.closeButton} accessibilityRole="button" accessibilityLabel="Đóng tạo nhóm"><Text style={styles.createGroupText}>Đóng</Text></Pressable>
            </View>
            <Text style={styles.role}>Tên nhóm</Text>
            <TextInput value={groupName} onChangeText={setGroupName} placeholder="Ví dụ: Nhóm học tập" style={styles.messageInput} />
            <Text style={styles.role}>Chọn thành viên ({selectedMembers.length})</Text>
            <SearchField value={memberSearch} onChangeText={setMemberSearch} placeholder="Tìm họ, tên, SĐT..." />
            <ScrollView style={styles.memberList}>
              {groupCandidates.map((member) => {
                const selected = selectedMembers.includes(member.id);
                return (
                  <Pressable key={member.id} onPress={() => setSelectedMembers((current) => selected ? current.filter((id) => id !== member.id) : [...current, member.id])} style={styles.memberRow} accessibilityRole="checkbox" accessibilityState={{ checked: selected }}>
                    <Avatar name={member.name} color={member.color} size={34} />
                    <View style={styles.conversationCopy}>
                      <Text style={styles.title}>{member.name}</Text>
                      <Text style={styles.role}>{member.role}</Text>
                    </View>
                    <Text style={[styles.memberCheck, selected && styles.memberCheckSelected]}>{selected ? '✓' : ''}</Text>
                  </Pressable>
                );
              })}
              {!groupCandidates.length ? <EmptyState title="Không có thành viên" message="Không tìm thấy liên hệ phù hợp để thêm vào nhóm." /> : null}
            </ScrollView>
            {user?.previewMode ? <Text style={styles.note}>Bản xem trước chỉ lưu nhóm trên thiết bị.</Text> : null}
            <PrimaryButton title={isCreatingGroup ? 'Đang tạo nhóm…' : 'Tạo nhóm chat'} disabled={isCreatingGroup || !groupName.trim() || selectedMembers.length < 1} onPress={() => { void createGroup(); }} />
            <PrimaryButton title="Hủy bỏ" variant="quiet" onPress={() => setShowCreateGroup(false)} />
          </View>
        </View>
      </Modal>
    </AppScreen>
  );
}

export function ConversationScreen() {
  const route = useRoute<NativeStackScreenProps<AppStackParamList, 'Conversation'>['route']>();
  const navigation = useNavigation<Navigation>();
  const { user } = useAuth();
  const isTeacher = user?.role === 'teacher';
  const isPreview = Boolean(user?.previewMode);
  const [showInfo, setShowInfo] = useState(false);
  const [showWeekSchedule, setShowWeekSchedule] = useState(false);
  const [scheduleWeekOffset, setScheduleWeekOffset] = useState(0);
  const [scheduleDate, setScheduleDate] = useState<string | null>(null);
  const [scheduleEditId, setScheduleEditId] = useState<string | null>(null);
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduleCourse, setScheduleCourse] = useState('');
  const [scheduleBusy, setScheduleBusy] = useState(false);
  const [teacherAttendanceModalVisible, setTeacherAttendanceModalVisible] = useState(false);
  const [teacherAttendanceGrade, setTeacherAttendanceGrade] = useState('0');
  const [teacherAttendanceNote, setTeacherAttendanceNote] = useState('');
  const [teacherAttendancePending, setTeacherAttendancePending] = useState<{ scheduleId: string; endsAt: number; grade: number; note: string } | null>(null);
  const [teacherAttendanceRemaining, setTeacherAttendanceRemaining] = useState(0);
  const [teacherAttendanceBusy, setTeacherAttendanceBusy] = useState(false);
  const [teacherAttendanceSavedScheduleId, setTeacherAttendanceSavedScheduleId] = useState('');
  const teacherAttendanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const threadLoader = useCallback(
    () => messageService.thread(route.params.conversationId, user?.role === 'teacher' ? 'teacher' : 'student', user),
    [route.params.conversationId, user?.role, user],
  );
  const resource = useMockResource(threadLoader);
  const scheduleLoader = useCallback(
    () => user?.role === 'teacher' || user?.role === 'student'
      ? scheduleService.list(user.role)
      : Promise.resolve([]),
    [user?.role],
  );
  const scheduleResource = useMockResource(scheduleLoader);
  const pendingAttendanceLoader = useCallback(
    () => user?.role === 'student' ? scheduleService.pendingAttendanceConfirm(user) : Promise.resolve([]),
    [user],
  );
  const pendingAttendanceResource = useMockResource(pendingAttendanceLoader);
  const [scheduleNow, setScheduleNow] = useState(() => new Date());
  const [attendancePromptSchedule, setAttendancePromptSchedule] = useState<ScheduleItem | null>(null);
  const [attendancePromptBusy, setAttendancePromptBusy] = useState(false);
  const [handledAttendancePromptIds, setHandledAttendancePromptIds] = useState<string[]>([]);
  useEffect(() => {
    const interval = setInterval(() => setScheduleNow(new Date()), 15000);
    return () => clearInterval(interval);
  }, []);
  useEffect(() => {
    const interval = setInterval(scheduleResource.reload, 20000);
    return () => clearInterval(interval);
  }, [scheduleResource.reload]);
  useEffect(() => {
    const interval = setInterval(pendingAttendanceResource.reload, 20000);
    return () => clearInterval(interval);
  }, [pendingAttendanceResource.reload]);
  useEffect(() => {
    if (!user) return undefined;
    const eventNames = [
      SOCKET_EVENTS.ATTENDANCE_AWAITING_CONFIRM,
      SOCKET_EVENTS.ATTENDANCE_DISPUTED,
      SOCKET_EVENTS.ATTENDANCE_CONFIRMED,
      SOCKET_EVENTS.ATTENDANCE_REJECTED,
      SOCKET_EVENTS.ATTENDANCE_ADMIN_MAKEUP_COMPLETED,
    ];
    const subscriptions = eventNames.map((eventName) => DeviceEventEmitter.addListener(eventName, (payload: {
      scheduleId?: string;
      studentId?: string;
      teacherId?: string;
      studentConfirmStatus?: string;
      kind?: string;
      course?: string;
    }) => {
      if (payload?.studentId && user.role === 'student' && String(payload.studentId) !== user.id) return;
      if (payload?.teacherId && user.role === 'teacher' && String(payload.teacherId) !== user.id) return;
      scheduleResource.reload();
      pendingAttendanceResource.reload();
      if (eventName === SOCKET_EVENTS.ATTENDANCE_AWAITING_CONFIRM) return;

      const currentParticipantId = String(route.params.participantId || '');
      const belongsToConversation = user.role === 'teacher'
        ? Boolean(payload.studentId && String(payload.studentId) === currentParticipantId)
        : Boolean(payload.teacherId && String(payload.teacherId) === currentParticipantId);
      if (!belongsToConversation) return;

      if (eventName === SOCKET_EVENTS.ATTENDANCE_DISPUTED && user.role === 'teacher') {
        Alert.alert('Học viên không đồng ý', 'Buổi học đang chờ Admin xử lý và chưa được tính.');
      } else if (eventName === SOCKET_EVENTS.ATTENDANCE_CONFIRMED) {
        if (user.role === 'teacher') {
          Alert.alert('Đã xác nhận điểm danh', 'Học viên đã đồng ý; buổi học được tính vào tiến độ.');
        } else if (payload.studentConfirmStatus === 'admin_approved') {
          Alert.alert('Admin đã chấp thuận', 'Buổi học đã được ghi nhận vào tiến độ.');
        }
      } else if (eventName === SOCKET_EVENTS.ATTENDANCE_REJECTED) {
        Alert.alert(
          'Buổi học không được tính',
          payload.kind === 'admin_makeup_rejected'
            ? 'Admin không tính buổi điểm danh bù. Buổi này không cộng tiến độ hoặc lương.'
            : 'Admin không chấp thuận tranh chấp. Buổi này không cộng tiến độ hoặc lương.',
        );
      } else if (eventName === SOCKET_EVENTS.ATTENDANCE_ADMIN_MAKEUP_COMPLETED) {
        Alert.alert('Admin đã điểm danh bù', 'Buổi học đã được ghi nhận vào tiến độ.');
      }
    }));
    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, [pendingAttendanceResource.reload, route.params.participantId, scheduleResource.reload, user]);
  const teacherCardLoader = useCallback(async () => {
    const teacherId = route.params.participantId;
    if (!showInfo || route.params.participantRole !== 'teacher' || !teacherId || isPreview) return null;
    return getTeacherPublicCard(teacherId);
  }, [showInfo, route.params.participantId, route.params.participantRole, isPreview]);
  const teacherCard = useMockResource(teacherCardLoader);
  const studentCardLoader = useCallback(async () => {
    const studentId = route.params.participantId;
    if (user?.role !== 'teacher' || route.params.participantRole !== 'student' || !studentId || isPreview) return null;
    return getStudentChatCard(studentId);
  }, [user?.role, route.params.participantId, route.params.participantRole, isPreview]);
  const studentCard = useMockResource(studentCardLoader);
  const ownStudentProfileLoader = useCallback(
    () => user?.role === 'student' && !isPreview ? getStudentDetail(user) : Promise.resolve(null),
    [isPreview, user],
  );
  const ownStudentProfile = useMockResource(ownStudentProfileLoader);
  useEffect(() => {
    if (!user) return undefined;
    const eventNames = [
      SOCKET_EVENTS.ATTENDANCE_CONFIRMED,
      SOCKET_EVENTS.ATTENDANCE_REJECTED,
      SOCKET_EVENTS.ATTENDANCE_ADMIN_MAKEUP_COMPLETED,
    ];
    const subscriptions = eventNames.map((eventName) => DeviceEventEmitter.addListener(eventName, (payload: {
      studentId?: string;
      teacherId?: string;
    }) => {
      if (user.role === 'student' && String(payload?.studentId || '') === user.id) {
        ownStudentProfile.reload();
      }
      if (user.role === 'teacher'
        && String(payload?.teacherId || '') === user.id
        && String(payload?.studentId || '') === String(route.params.participantId || '')) {
        studentCard.reload();
      }
    }));
    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, [ownStudentProfile.reload, route.params.participantId, studentCard.reload, user]);
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [callHistory, setCallHistory] = useState<CallHistoryEntry[]>([]);
  const [presenceOnlineUsers, setPresenceOnlineUsers] = useState<unknown[]>(getOnlineUsersSnapshot);
  const [presenceLastSeen, setPresenceLastSeen] = useState<Record<string, string>>(getLastSeenUsersSnapshot);
  const [peerTyping, setPeerTyping] = useState(false);
  const typingActiveRef = useRef(false);
  const typingStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const peerTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const subscriptions = [
      DeviceEventEmitter.addListener(SOCKET_EVENTS.ONLINE_USERS, (users: unknown) => {
        setPresenceOnlineUsers(Array.isArray(users) ? users : []);
      }),
      DeviceEventEmitter.addListener(SOCKET_EVENTS.LAST_SEEN_USERS, (lastSeen: unknown) => {
        if (lastSeen && typeof lastSeen === 'object' && !Array.isArray(lastSeen)) {
          setPresenceLastSeen(lastSeen as Record<string, string>);
        }
      }),
    ];
    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, []);

  useEffect(() => {
    if (isPreview) return;
    const interval = setInterval(() => {
      threadLoader().then((latest) => {
        if (latest && Array.isArray(latest)) {
          setMessages(latest);
        }
      }).catch((error: unknown) => {
        console.warn('Không thể đồng bộ dự phòng cuộc trò chuyện:', error);
      });
    }, 20000);
    return () => clearInterval(interval);
  }, [isPreview, threadLoader]);

  const draftKey = `${user?.id || 'anonymous'}:${route.params.conversationId}`;
  const [draftState, setDraftState] = useState(() => ({
    key: draftKey,
    text: conversationDrafts.get(draftKey) || '',
  }));
  const draft = draftState.key === draftKey
    ? draftState.text
    : conversationDrafts.get(draftKey) || '';
  const updateDraft = useCallback((text: string) => {
    if (text) conversationDrafts.set(draftKey, text);
    else conversationDrafts.delete(draftKey);
    setDraftState({ key: draftKey, text });
  }, [draftKey]);
  const clearDraft = (key: string) => {
    conversationDrafts.delete(key);
    setDraftState((current) => current.key === key ? { key, text: '' } : current);
  };
  const stopTyping = useCallback(() => {
    if (typingStopTimerRef.current) {
      clearTimeout(typingStopTimerRef.current);
      typingStopTimerRef.current = null;
    }
    if (!typingActiveRef.current) return;
    typingActiveRef.current = false;
    emitTypingStop(route.params.conversationId);
  }, [route.params.conversationId]);
  const handleDraftChange = useCallback((text: string) => {
    updateDraft(text);
    if (isPreview || !text.trim() || route.params.conversationId.startsWith('group_')) {
      stopTyping();
      return;
    }
    if (!typingActiveRef.current) {
      typingActiveRef.current = true;
      emitTypingStart(route.params.conversationId, user?.name || 'Người dùng');
    }
    if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
    typingStopTimerRef.current = setTimeout(stopTyping, 1600);
  }, [isPreview, route.params.conversationId, stopTyping, user?.name]);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [picker, setPicker] = useState<PickerTab | null>(null);
  const [stickerCategory, setStickerCategory] = useState('all');
  const [stickerSearch, setStickerSearch] = useState('');
  const [recentStickerIds, setRecentStickerIds] = useState<string[]>([]);
  const [selectedAttachment, setSelectedAttachment] = useState<{
    name: string;
    type: 'image' | 'file';
    uri?: string;
    mimeType?: string;
    size?: number;
    file?: Blob;
  } | null>(null);
  const [sending, setSending] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<ChatMessage[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const searchRequestRef = useRef(0);
  const [reactionPopupMsgId, setReactionPopupMsgId] = useState<string | null>(null);
  const [optionsMenuMsgId, setOptionsMenuMsgId] = useState<string | null>(null);
  useEffect(() => {
    if (!optionsMenuMsgId || Platform.OS !== 'web' || typeof document === 'undefined') return undefined;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest('#chat-options-menu')) return;
      setOptionsMenuMsgId(null);
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer, true);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer, true);
  }, [optionsMenuMsgId]);
  const reactionHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const EMOJI_REACTIONS = ['❤️', '😂', '😲', '😭', '😡'];
  const ALL_REACTIONS = ['👍', ...EMOJI_REACTIONS];
  const [hoverMsgId, setHoverMsgId] = useState<string | null>(null);
  const bubbleWidthsRef = useRef<Record<string, number>>({});
  const threadRef = useRef<React.ElementRef<typeof ScrollView>>(null);
  const thread = useMemo(() => {
    const callMessages: ChatMessage[] = callHistory.map((call) => {
      const callDate = new Date(call.startedAt);
      const time = Number.isNaN(callDate.getTime())
        ? ''
        : callDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      const statusText = call.status === 'missed'
        ? call.direction === 'incoming' ? 'Cuộc gọi nhỡ' : 'Không có người trả lời'
        : call.status === 'rejected'
          ? call.direction === 'incoming' ? 'Bạn đã từ chối cuộc gọi' : 'Cuộc gọi bị từ chối'
          : call.status === 'busy'
            ? 'Máy bận'
            : call.status === 'cancelled'
              ? call.direction === 'incoming' ? 'Cuộc gọi nhỡ' : 'Đã hủy cuộc gọi'
              : call.status === 'completed'
                ? 'Cuộc gọi đã kết thúc'
                : call.status === 'failed'
                  ? 'Cuộc gọi không kết nối được'
                  : call.status === 'active' ? 'Cuộc gọi thoại' : 'Đang gọi';
      return {
        id: `call-${call.callId}`,
        text: statusText,
        time,
        timestampMs: callDate.getTime(),
        mine: call.direction === 'outgoing',
        callEvent: {
          direction: call.direction,
          status: call.status,
          durationSeconds: call.durationSeconds,
          participantName: call.participantName,
        },
      };
    });
    return [...(messages || resource.data || []), ...callMessages]
      .sort((left, right) => (left.timestampMs || 0) - (right.timestampMs || 0));
  }, [callHistory, messages, resource.data]);
  const conversationName = route.params.conversationName || 'Cuộc trò chuyện';
  const canShowMeetButton = Boolean(
    user
    && user.role !== route.params.participantRole
    && (route.params.participantRole === 'student' || route.params.participantRole === 'teacher'),
  );
  const meetingSchedule = useMemo(() => {
    if (
      !user
      || !route.params.participantId
      || route.params.participantRole === user.role
      || !['student', 'teacher'].includes(route.params.participantRole || '')
    ) return null;
    const participantId = String(route.params.participantId);
    const scheduleList = scheduleResource.data || [];
    const profileMeetingUrl = user.role === 'teacher'
      ? normalizeMeetingUrl(studentCard.data?.meetingUrl)
      : normalizeMeetingUrl(
        ownStudentProfile.data?.joinClassUrl
        || ownStudentProfile.data?.linkHoc
        || ownStudentProfile.data?.online_meeting_url
        || '',
      );
    return scheduleList
      .filter((schedule) => user.role === 'teacher'
        ? schedule.studentId === participantId
        : schedule.teacherId === participantId)
      .map((schedule) => getScheduleMeetState(
        schedule,
        scheduleNow,
        profileMeetingUrl,
      ))
      .filter((schedule): schedule is NonNullable<typeof schedule> => Boolean(schedule))
      .sort((left, right) => (
        Number(right.isLive) - Number(left.isLive)
        || Number(Boolean(right.meetingUrl)) - Number(Boolean(left.meetingUrl))
        || left.startAt - right.startAt
      ))[0] || null;
  }, [
    route.params.participantId,
    route.params.participantRole,
    scheduleNow,
    scheduleResource.data,
    studentCard.data?.meetingUrl,
    ownStudentProfile.data,
    user,
  ]);
  const canScheduleStudent = Boolean(
    isTeacher
    && route.params.participantRole === 'student'
    && route.params.participantId
    && !isPreview,
  );
  const weeklyScheduleDays = getWeekDays(scheduleWeekOffset);
  const activeScheduleEnrollments = (studentCard.data?.enrollments || [])
    .filter((enrollment) => enrollment.status === 'Đang học');
  const scheduleCourses = activeScheduleEnrollments.length
    ? activeScheduleEnrollments.map((enrollment) => enrollment.courseName)
    : studentCard.data?.course && studentCard.data.course !== 'Chưa cập nhật'
      ? [studentCard.data.course]
      : [];
  const selectedScheduleEnrollment = activeScheduleEnrollments.find(
    (enrollment) => enrollment.courseName === scheduleCourse,
  );
  const studentWeeklySchedules = (scheduleResource.data || []).filter(
    (schedule) => schedule.studentId === String(route.params.participantId || ''),
  );
  const todayScheduleKey = scheduleDateKey(new Date());
  const selectedCourseSchedules = studentWeeklySchedules.filter((schedule) => (
    schedule.status !== 'cancelled'
    && normalizeCourseName(schedule.courseName || schedule.subject) === normalizeCourseName(scheduleCourse)
  ));
  const selectedCourseCompletedOnCalendar = selectedCourseSchedules.filter(
    (schedule) => schedule.status === 'completed',
  ).length;
  const selectedCoursePriorCredit = Math.max(
    0,
    (selectedScheduleEnrollment?.completedSessions || 0) - selectedCourseCompletedOnCalendar,
  );
  const selectedCourseRemaining = selectedScheduleEnrollment?.totalSessions
    ? Math.max(0, selectedScheduleEnrollment.totalSessions - selectedCourseSchedules.length - selectedCoursePriorCredit)
    : null;
  const currentMinute = getVietnamMinute();
  const getSlotConflict = (startTime: string) => {
    if (!scheduleDate || !user?.id) return '';
    const start = timeToMinutes(startTime);
    if (start == null) return 'Khung giờ không hợp lệ.';
    const end = start + 90;
    if (scheduleDate === todayScheduleKey && end <= currentMinute) return 'Ca học đã kết thúc, không thể xếp vào giờ này.';
    for (const schedule of scheduleResource.data || []) {
      if (schedule.id === scheduleEditId || schedule.date !== scheduleDate || schedule.status === 'cancelled') continue;
      if (schedule.studentId === String(route.params.participantId || '')) {
        return 'Học viên đã có lịch khác trong ngày này.';
      }
      if (schedule.teacherId !== user.id) continue;
      const otherStart = timeToMinutes(schedule.startTime);
      if (otherStart == null) continue;
      const otherEnd = timeToMinutes(schedule.endTime) ?? otherStart + 90;
      if (start < otherEnd && otherStart < end) return 'Khung giờ trùng với lịch dạy khác.';
    }
    return '';
  };
  const openWeeklySchedule = () => {
    if (!canScheduleStudent || !studentCard.data) return;
    const firstCourse = activeScheduleEnrollments[0]?.courseName || studentCard.data.course;
    setScheduleWeekOffset(0);
    setScheduleDate(null);
    setScheduleEditId(null);
    setScheduleTime('');
    setScheduleCourse(firstCourse);
    setShowInfo(false);
    setShowWeekSchedule(true);
    if (scheduleResource.error) scheduleResource.reload();
  };
  const selectScheduleDay = (date: string, schedule?: ScheduleItem) => {
    setScheduleDate(date);
    setScheduleEditId(schedule?.id || null);
    setScheduleTime(schedule?.startTime || '');
    if (schedule?.courseName) setScheduleCourse(schedule.courseName);
  };
  const saveWeeklySchedule = async () => {
    if (!user || !route.params.participantId || !scheduleDate || !scheduleTime || !scheduleCourse) {
      Alert.alert('Thiếu thông tin', 'Vui lòng chọn khóa học, ngày và khung giờ.');
      return;
    }
    if (scheduleDate < todayScheduleKey) {
      Alert.alert('Không thể xếp lịch', 'Không thể tạo hoặc đổi lịch cho ngày đã qua.');
      return;
    }
    const conflict = getSlotConflict(scheduleTime);
    if (conflict) {
      Alert.alert('Khung giờ không khả dụng', conflict);
      return;
    }
    if (!scheduleEditId && selectedCourseRemaining != null) {
      if (selectedCourseRemaining <= 0) {
        Alert.alert('Đã đủ số buổi', 'Khóa học này không còn buổi để xếp lịch.');
        return;
      }
    }
    setScheduleBusy(true);
    try {
      const endTime = getScheduleEndTime(scheduleTime);
      if (scheduleEditId) {
        await scheduleService.update(scheduleEditId, { date: scheduleDate, startTime: scheduleTime, endTime }, user);
      } else {
        await scheduleService.create({
          teacherId: user.id,
          studentId: route.params.participantId,
          date: scheduleDate,
          startTime: scheduleTime,
          endTime,
          course: scheduleCourse,
          ...(selectedScheduleEnrollment?.id ? { enrollmentId: selectedScheduleEnrollment.id } : {}),
        }, user);
      }
      scheduleResource.reload();
      setScheduleDate(null);
      setScheduleEditId(null);
      setScheduleTime('');
      Alert.alert('Đã lưu lịch', scheduleEditId ? 'Lịch học đã được cập nhật.' : 'Lịch học mới đã được tạo.');
    } catch (error) {
      Alert.alert('Không thể lưu lịch', error instanceof Error ? error.message : 'Vui lòng thử lại.');
    } finally {
      setScheduleBusy(false);
    }
  };
  const confirmCancelWeeklySchedule = (schedule: ScheduleItem) => {
    Alert.alert('Hủy buổi học', 'Bạn có chắc muốn hủy lịch này không?', [
      { text: 'Giữ lịch', style: 'cancel' },
      {
        text: 'Hủy lịch',
        style: 'destructive',
        onPress: () => {
          setScheduleBusy(true);
          scheduleService.cancel(schedule.id, 'Giảng viên hủy lịch', user)
            .then(() => {
              scheduleResource.reload();
              if (scheduleEditId === schedule.id) {
                setScheduleDate(null);
                setScheduleEditId(null);
                setScheduleTime('');
              }
            })
            .catch((error: unknown) => {
              Alert.alert('Không thể hủy lịch', error instanceof Error ? error.message : 'Vui lòng thử lại.');
            })
            .finally(() => setScheduleBusy(false));
        },
      },
    ]);
  };
  const pendingAttendanceSchedule = useMemo(() => {
    if (user?.role !== 'student' || route.params.participantRole !== 'teacher' || !route.params.participantId) return null;
    return (pendingAttendanceResource.data || [])
      .filter((schedule) => (
        schedule.teacherId === String(route.params.participantId)
        && schedule.attendanceConfirmPending
        && schedule.attendanceConfirmStatus === 'pending'
        && (getAttendanceConfirmUnlockAt(schedule) || Infinity) <= scheduleNow.getTime()
        && !handledAttendancePromptIds.includes(schedule.id)
      ))
      .sort((left, right) => (
        (getAttendanceConfirmUnlockAt(left) || 0) - (getAttendanceConfirmUnlockAt(right) || 0)
      ))[0] || null;
  }, [
    route.params.participantId,
    route.params.participantRole,
    scheduleNow,
    pendingAttendanceResource.data,
    handledAttendancePromptIds,
    user?.role,
  ]);
  useEffect(() => {
    if (!pendingAttendanceSchedule || attendancePromptBusy) return;
    if (attendancePromptSchedule?.id === pendingAttendanceSchedule.id) return;
    setAttendancePromptSchedule(pendingAttendanceSchedule);
  }, [attendancePromptBusy, attendancePromptSchedule?.id, pendingAttendanceSchedule]);
  const teacherAttendanceSchedule = useMemo(() => {
    if (user?.role !== 'teacher' || route.params.participantRole !== 'student' || !route.params.participantId) return null;
    return (scheduleResource.data || [])
      .filter((schedule) => (
        schedule.studentId === String(route.params.participantId)
        && schedule.teacherId === String(user.id)
        && getVietnamDateKey(schedule.date) === getVietnamDateKey(scheduleNow)
        && !['cancelled', 'no_show'].includes(schedule.status)
        && (
          canTeacherMarkAttendance(schedule, scheduleNow)
          || isTeacherAttendanceMarked(schedule)
          || isTeacherAttendanceAwaitingConfirm(schedule)
          || isTeacherAttendanceUnderReview(schedule)
        )
      ))
      .sort((left, right) => {
        const attendanceRank = (schedule: ScheduleItem) => (
          isTeacherAttendanceAwaitingConfirm(schedule) || isTeacherAttendanceUnderReview(schedule)
            ? 0
            : !isTeacherAttendanceMarked(schedule) && canTeacherMarkAttendance(schedule, scheduleNow)
              ? 1
              : 2
        );
        return attendanceRank(left) - attendanceRank(right)
          || (left.date || '').localeCompare(right.date || '')
          || (left.startTime || '').localeCompare(right.startTime || '');
      })[0] || null;
  }, [
    route.params.participantId,
    route.params.participantRole,
    scheduleNow,
    scheduleResource.data,
    user,
  ]);
  const teacherAttendanceEnrollment = useMemo(() => {
    if (!teacherAttendanceSchedule || !studentCard.data?.enrollments) return null;
    const courseName = String(teacherAttendanceSchedule.courseName || teacherAttendanceSchedule.title || '').trim().toLocaleLowerCase('vi');
    return studentCard.data.enrollments.find((enrollment) => (
      enrollment.courseName.trim().toLocaleLowerCase('vi') === courseName
    )) || null;
  }, [studentCard.data?.enrollments, teacherAttendanceSchedule]);
  const teacherAttendanceCompleted = teacherAttendanceEnrollment?.completedSessions || 0;
  const teacherAttendanceTotal = teacherAttendanceEnrollment?.totalSessions || 0;
  const teacherAttendanceMarked = Boolean(
    teacherAttendanceSchedule
    && isTeacherAttendanceMarked(teacherAttendanceSchedule),
  );
  const teacherAttendanceAwaitingConfirm = Boolean(
    teacherAttendanceSchedule
    && !teacherAttendanceMarked
    && (teacherAttendanceSavedScheduleId === teacherAttendanceSchedule.id
      || isTeacherAttendanceAwaitingConfirm(teacherAttendanceSchedule)),
  );
  const teacherAttendanceUnderReview = Boolean(
    teacherAttendanceSchedule
    && isTeacherAttendanceUnderReview(teacherAttendanceSchedule),
  );
  const teacherAttendanceLocked = teacherAttendanceMarked
    || teacherAttendanceAwaitingConfirm
    || teacherAttendanceUnderReview;
  const localSearchResults = searchText.trim()
    ? thread.filter((message) => (
      `${message.text} ${message.attachmentName || ''} ${message.senderName || ''}`
        .toLocaleLowerCase('vi-VN')
        .includes(searchText.trim().toLocaleLowerCase('vi-VN'))
    ))
    : thread;
  const visibleMessages = searchText.trim() ? searchResults ?? localSearchResults : thread;

  useEffect(() => {
    if (!teacherAttendancePending) return undefined;
    const updateRemaining = () => {
      setTeacherAttendanceRemaining(Math.max(0, Math.ceil((teacherAttendancePending.endsAt - Date.now()) / 1000)));
    };
    updateRemaining();
    const interval = setInterval(updateRemaining, 250);
    return () => clearInterval(interval);
  }, [teacherAttendancePending]);

  useEffect(() => () => {
    if (teacherAttendanceTimerRef.current) clearTimeout(teacherAttendanceTimerRef.current);
  }, []);

  const openTeacherAttendanceModal = () => {
    if (!teacherAttendanceSchedule || teacherAttendancePending || isTeacherAttendanceMarked(teacherAttendanceSchedule)) return;
    setTeacherAttendanceGrade(String(teacherAttendanceEnrollment?.avgGrade || 0));
    setTeacherAttendanceNote(
      `Buổi ${Math.min(teacherAttendanceCompleted + 1, teacherAttendanceTotal || teacherAttendanceCompleted + 1)}: Đã điểm danh hoàn thành buổi học`,
    );
    setTeacherAttendanceModalVisible(true);
  };

  const confirmTeacherAttendance = () => {
    if (!teacherAttendanceSchedule || !user || teacherAttendanceBusy || teacherAttendancePending) return;
    const parsedGrade = Number(teacherAttendanceGrade.replace(',', '.'));
    if (!Number.isFinite(parsedGrade) || parsedGrade < 0 || parsedGrade > 10) {
      Alert.alert('Điểm không hợp lệ', 'Vui lòng nhập điểm từ 0 đến 10.');
      return;
    }
    const selectedSchedule = teacherAttendanceSchedule;
    const payload = {
      scheduleId: selectedSchedule.id,
      endsAt: Date.now() + 10_000,
      grade: parsedGrade,
      note: teacherAttendanceNote.trim(),
    };
    setTeacherAttendanceModalVisible(false);
    setTeacherAttendancePending(payload);
    setTeacherAttendanceRemaining(10);
    teacherAttendanceTimerRef.current = setTimeout(async () => {
      teacherAttendanceTimerRef.current = null;
      setTeacherAttendanceBusy(true);
      try {
        await scheduleService.markAttendance(
          selectedSchedule.id,
          { grade: payload.grade, note: payload.note },
          user,
        );
        setTeacherAttendancePending(null);
        setTeacherAttendanceSavedScheduleId(selectedSchedule.id);
        scheduleResource.reload();
      } catch (error) {
        setTeacherAttendancePending(null);
        Alert.alert('Không thể ghi nhận điểm danh', error instanceof Error ? error.message : 'Vui lòng thử lại.');
      } finally {
        setTeacherAttendanceBusy(false);
      }
    }, 10_000);
  };

  const cancelTeacherAttendance = () => {
    if (!teacherAttendancePending || teacherAttendanceBusy) return;
    if (teacherAttendanceTimerRef.current) clearTimeout(teacherAttendanceTimerRef.current);
    teacherAttendanceTimerRef.current = null;
    setTeacherAttendancePending(null);
    Alert.alert('Đã hủy điểm danh', 'Buổi học chưa được ghi nhận.');
  };

  const respondToChatAttendance = async (decision: 'accept' | 'dispute') => {
    if (!attendancePromptSchedule || attendancePromptBusy) return;
    setAttendancePromptBusy(true);
    try {
      const result = await scheduleService.confirmAttendance(attendancePromptSchedule.id, decision, user);
      setHandledAttendancePromptIds((current) => [...new Set([...current, attendancePromptSchedule.id])]);
      setAttendancePromptSchedule(null);
      scheduleResource.reload();
      pendingAttendanceResource.reload();
      Alert.alert(
        decision === 'accept' ? 'Đã xác nhận điểm danh' : 'Đã gửi phản hồi',
        result.disputed
          ? 'Buổi học đang chờ trung tâm xử lý và chưa được tính vào tiến độ.'
          : 'Buổi học đã được ghi nhận vào tiến độ.',
      );
    } catch (error) {
      Alert.alert('Không thể xác nhận điểm danh', error instanceof Error ? error.message : 'Vui lòng thử lại.');
    } finally {
      setAttendancePromptBusy(false);
    }
  };

  useEffect(() => {
    if (isPreview || !user || route.params.conversationId.startsWith('group_')) {
      setCallHistory([]);
      return undefined;
    }

    let active = true;
    const loadCallHistory = () => {
      void getCallHistory(route.params.conversationId)
        .then((calls) => {
          if (active) setCallHistory(calls);
        })
        .catch((error: unknown) => {
          if (active) console.error('Không thể tải lịch sử cuộc gọi trong cuộc trò chuyện.', error);
        });
    };
    loadCallHistory();
    const subscription = DeviceEventEmitter.addListener(SOCKET_EVENTS.CALL_HISTORY_UPDATED, (event: { conversationId?: string }) => {
      if (!event?.conversationId || event.conversationId === route.params.conversationId) loadCallHistory();
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, [isPreview, route.params.conversationId, user]);
  const pinnedMessage = useMemo(() => {
    if (!pinnedId) return null;
    return thread.find((item) => item.id === pinnedId) || null;
  }, [pinnedId, thread]);
  const peerId = String(route.params.participantId || '');
  const isPeerOnline = peerId && getPresenceUserIds(presenceOnlineUsers).includes(peerId);
  const contactStatus = isPeerOnline
    ? 'Trực tuyến'
    : formatLastSeenStatus(presenceLastSeen[peerId]);
  const contactRole = ({
    admin: 'Admin',
    group: 'Nhóm',
    recruitment: 'Tuyển sinh',
    student: 'Học viên',
    support: 'Hỗ trợ',
    teacher: 'Giảng viên',
  } as Record<string, string>)[route.params.participantRole || ''] || 'Liên hệ';
  const infoDisplayName = teacherCard.data?.name || studentCard.data?.name || conversationName;
  const messageConversation: Conversation = {
    id: route.params.conversationId,
    name: conversationName,
    role: route.params.participantRole || '',
    participantId: route.params.participantId,
    participantRole: route.params.participantRole,
    lastMessage: '',
    time: '',
    unread: 0,
    color: colors.blueSoft,
  };
  const recentStickers = recentStickerIds
    .map((id) => CHAT_STICKERS.find((sticker) => sticker.id === id))
    .filter((sticker): sticker is ChatSticker => {
      if (!sticker) return false;
      return (stickerCategory === 'all' || sticker.category === stickerCategory)
        && matchesChatStickerSearch(sticker, stickerSearch);
    });
  const visibleStickers = CHAT_STICKERS.filter((sticker) =>
    (stickerCategory === 'all' || sticker.category === stickerCategory)
    && matchesChatStickerSearch(sticker, stickerSearch));

  const appendMessage = useCallback((message: ChatMessage) => {
    setMessages((current) => {
      const currentMessages = current || resource.data || [];
      const index = currentMessages.findIndex((item) => item.id === message.id);
      if (index < 0) return [...currentMessages, message];
      return currentMessages.map((item, itemIndex) => itemIndex === index ? message : item);
    });
  }, [resource.data]);

  useEffect(() => () => {
    if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
    if (typingActiveRef.current) {
      typingActiveRef.current = false;
      emitTypingStop(route.params.conversationId);
    }
    if (peerTypingTimerRef.current) clearTimeout(peerTypingTimerRef.current);
  }, [route.params.conversationId]);

  useEffect(() => {
    if (isPreview || !user) return undefined;
    const subscription = DeviceEventEmitter.addListener(
      SOCKET_EVENTS.TYPING_CHANGE,
      (event: { conversationId?: string; userId?: string; isTyping?: boolean }) => {
        if (String(event?.conversationId || '') !== route.params.conversationId) return;
        if (String(event?.userId || '') === user.id) return;
        setPeerTyping(event?.isTyping === true);
        if (peerTypingTimerRef.current) clearTimeout(peerTypingTimerRef.current);
        if (event?.isTyping) {
          peerTypingTimerRef.current = setTimeout(() => setPeerTyping(false), 5000);
        }
      },
    );
    return () => subscription.remove();
  }, [isPreview, route.params.conversationId, user]);

  useEffect(() => {
    const query = searchText.trim();
    if (!isSearching || !query || isPreview || !user) {
      searchRequestRef.current += 1;
      setSearchResults(null);
      setSearchLoading(false);
      setSearchError('');
      return undefined;
    }

    const requestId = ++searchRequestRef.current;
    let active = true;
    setSearchResults(null);
    setSearchLoading(true);
    setSearchError('');
    const timer = setTimeout(() => {
      messageService.search(route.params.conversationId, query, user)
        .then((results) => {
          if (active && searchRequestRef.current === requestId) setSearchResults(results);
        })
        .catch((error: unknown) => {
          if (active && searchRequestRef.current === requestId) {
            setSearchError(error instanceof Error ? error.message : 'Không thể tìm kiếm tin nhắn.');
          }
        })
        .finally(() => {
          if (active && searchRequestRef.current === requestId) setSearchLoading(false);
        });
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [isSearching, searchText, isPreview, route.params.conversationId, user]);

  useEffect(() => {
    if (!route.params.conversationId.startsWith('group_')) return;
    joinChatGroup(route.params.conversationId.slice('group_'.length));
  }, [route.params.conversationId]);

  useEffect(() => {
    const pinned = thread.find((message) => message.pinned);
    setPinnedId(pinned?.id || null);
  }, [thread]);

  useEffect(() => {
    if (isPreview || !user) return;
    const handleLiveMessage = (payload: unknown) => {
      if (!payload || typeof payload !== 'object') return;
      const raw = payload as Record<string, unknown>;
      if (String(raw.conversationId || '') !== route.params.conversationId) return;
      appendMessage(mapLiveChatMessage(raw, user));
    };
    const subscriptions = [
      DeviceEventEmitter.addListener(SOCKET_EVENTS.MESSAGE_RECEIVED, handleLiveMessage),
      DeviceEventEmitter.addListener(SOCKET_EVENTS.MESSAGE_SENT_ACK, handleLiveMessage),
      DeviceEventEmitter.addListener(SOCKET_EVENTS.MESSAGE_SEND_ERROR, (event: { conversationId?: string; message?: string }) => {
        if (event?.conversationId && event.conversationId !== route.params.conversationId) return;
        Alert.alert('Không gửi được tin nhắn', event?.message || 'Người nhận từ chối tin nhắn.');
      }),
    ];
    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, [appendMessage, isPreview, route.params.conversationId, user]);

  useEffect(() => {
    if (isPreview || !user) return;
    const isCurrentConversation = (payload: unknown) => {
      if (!payload || typeof payload !== 'object') return false;
      const eventConversationId = String((payload as Record<string, unknown>).conversationId || '');
      return !eventConversationId || eventConversationId === route.params.conversationId;
    };
    const reactionSubscription = DeviceEventEmitter.addListener(SOCKET_EVENTS.MESSAGE_REACTION, (payload: unknown) => {
      if (!isCurrentConversation(payload) || !payload || typeof payload !== 'object') return;
      const event = payload as Record<string, unknown>;
      const mapped = mapLiveReaction(event.reactions, user.id);
      setMessages((current) => (current || resource.data || []).map((message) =>
        message.id === String(event.messageId) ? { ...message, ...mapped } : message
      ));
      setSearchResults((current) => current?.map((message) =>
        message.id === String(event.messageId) ? { ...message, ...mapped } : message
      ) || null);
    });
    const recallSubscription = DeviceEventEmitter.addListener(SOCKET_EVENTS.MESSAGE_RECALLED, (payload: unknown) => {
      if (!isCurrentConversation(payload) || !payload || typeof payload !== 'object') return;
      const messageId = String((payload as Record<string, unknown>).messageId || '');
      setMessages((current) => (current || resource.data || []).map((message) =>
        message.id === messageId ? { ...message, recalled: true } : message
      ));
      setSearchResults((current) => current?.map((message) =>
        message.id === messageId ? { ...message, recalled: true } : message
      ) || null);
    });
    const deleteSubscription = DeviceEventEmitter.addListener(SOCKET_EVENTS.MESSAGE_DELETED, (payload: unknown) => {
      if (!isCurrentConversation(payload) || !payload || typeof payload !== 'object') return;
      const messageId = String((payload as Record<string, unknown>).messageId || '');
      setMessages((current) => (current || resource.data || []).filter((message) => message.id !== messageId));
      setSearchResults((current) => current?.filter((message) => message.id !== messageId) || null);
    });
    const pinnedSubscription = DeviceEventEmitter.addListener(SOCKET_EVENTS.MESSAGE_PINNED, (payload: unknown) => {
      if (!isCurrentConversation(payload) || !payload || typeof payload !== 'object') return;
      const event = payload as Record<string, unknown>;
      const messageId = String(event.messageId || '');
      const isPinned = event.isPinned === true;
      setPinnedId(isPinned ? messageId : null);
      setMessages((current) => (current || resource.data || []).map((message) => ({
        ...message,
        pinned: isPinned ? message.id === messageId : message.id === messageId ? false : message.pinned,
      })));
      setSearchResults((current) => current?.map((message) => ({
        ...message,
        pinned: isPinned ? message.id === messageId : message.id === messageId ? false : message.pinned,
      })) || null);
    });
    return () => {
      reactionSubscription.remove();
      recallSubscription.remove();
      deleteSubscription.remove();
      pinnedSubscription.remove();
    };
  }, [isPreview, resource.data, route.params.conversationId, user]);

  const send = async () => {
    stopTyping();
    const sendingDraftKey = draftKey;
    const text = draft.trim();
    const attachment = selectedAttachment;
    const messageText = attachment
      ? text || (attachment.type === 'image' ? '[Hình ảnh]' : `Đã gửi tệp: ${attachment.name}`)
      : text;
    const attachmentUpload = attachment?.uri ? {
      uri: attachment.uri,
      name: attachment.name,
      mimeType: attachment.mimeType || (attachment.type === 'image' ? 'image/jpeg' : 'application/octet-stream'),
      size: attachment.size,
      file: attachment.file,
    } : undefined;
    if (!messageText && !attachment) return;
    if (!isPreview) {
      if (attachment && !attachmentUpload) {
        Alert.alert('Không thể gửi tệp', 'Vui lòng chọn lại tệp từ thiết bị.');
        return;
      }
      setSending(true);
      try {
        const sentMessage = await messageService.send(
          messageConversation,
          messageText,
          user,
          attachmentUpload,
          replyingTo || undefined,
        );
        appendMessage(sentMessage);
        clearDraft(sendingDraftKey);
        setReplyingTo(null);
        setSelectedAttachment(null);
      } catch (error) {
        Alert.alert('Không gửi được tin nhắn', error instanceof Error ? error.message : 'Vui lòng thử lại.');
      } finally {
        setSending(false);
      }
      return;
    }
    setMessages((current) => [
      ...(current || resource.data || []),
      {
        id: `local-${Date.now()}`,
        text: messageText,
        time: 'Vừa xong',
        mine: true,
        ...(isTeacher ? { state: 'sent' as const } : {}),
        replyToText: replyingTo?.text,
        ...(replyingTo?.id ? { replyTo: { id: replyingTo.id, content: replyingTo.text } } : {}),
        ...(selectedAttachment ? { attachmentName: selectedAttachment.name, attachmentType: selectedAttachment.type } : {}),
      },
    ]);
    clearDraft(sendingDraftKey);
    setReplyingTo(null);
    setSelectedAttachment(null);
  };

  const setAttachmentFromDevice = (attachment: { name: string; uri: string; mimeType: string; size?: number; file?: Blob }) => {
    const maxSize = 50 * 1024 * 1024;
    if (attachment.size != null && attachment.size > maxSize) {
      Alert.alert('Tệp quá lớn', 'Kích thước tệp tối đa là 50 MB.');
      return;
    }
    const extension = attachment.name.split('.').pop()?.toLowerCase() || '';
    const allowedExtensions = new Set([
      'jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'doc', 'docx', 'xls', 'xlsx',
      'ppt', 'pptx', 'zip', 'rar', '7z', 'txt', 'mp4', 'webm', 'mp3', 'wav',
    ]);
    if (!allowedExtensions.has(extension)) {
      Alert.alert('Định dạng chưa hỗ trợ', 'Có thể gửi ảnh, PDF, Office, ZIP/RAR, video hoặc âm thanh được hỗ trợ.');
      return;
    }
    setSelectedAttachment({
      ...attachment,
      type: attachment.mimeType.startsWith('image/') ? 'image' : 'file',
    });
    setPicker(null);
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      setAttachmentFromDevice({
        name: file.name,
        uri: file.uri,
        mimeType: file.mimeType || 'application/octet-stream',
        size: file.size,
        file: file.file,
      });
    } catch (error) {
      Alert.alert('Không mở được danh sách tệp', error instanceof Error ? error.message : 'Vui lòng thử lại.');
    }
  };

  const pickImage = async (useCamera = false) => {
    try {
      const permission = useCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Cần quyền truy cập', useCamera
          ? 'Cho phép camera để chụp ảnh gửi trong tin nhắn.'
          : 'Cho phép truy cập ảnh để chọn hình gửi trong tin nhắn.');
        return;
      }
      const result = useCamera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.85,
            preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
          });
      if (result.canceled) return;
      const image = result.assets[0];
      const mimeType = image.mimeType || 'image/jpeg';
      const knownImageExtensions: Record<string, string> = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/webp': 'webp',
      };
      const extension = knownImageExtensions[mimeType.toLowerCase()]
        || image.fileName?.split('.').pop()?.toLowerCase()
        || 'jpg';
      setAttachmentFromDevice({
        name: `image-${Date.now()}.${extension}`,
        uri: image.uri,
        mimeType,
        size: image.fileSize,
        file: image.file,
      });
    } catch (error) {
      Alert.alert('Không thể chọn ảnh', error instanceof Error ? error.message : 'Vui lòng thử lại.');
    }
  };

  const sendSticker = async (stickerId: string) => {
    const token = buildChatStickerToken(stickerId);
    if (!token || sending) return;
    if (isPreview) {
      setMessages((current) => [
        ...(current || resource.data || []),
        {
          id: `local-${Date.now()}`,
          text: '',
          stickerId,
          time: 'Vừa xong',
          mine: true,
          replyToText: replyingTo?.text || replyingTo?.attachmentName,
          ...(replyingTo?.id ? { replyTo: { id: replyingTo.id, content: replyingTo.text || replyingTo.attachmentName || '' } } : {}),
        },
      ]);
    } else {
      setSending(true);
      try {
        const sentMessage = await messageService.send(messageConversation, token, user, undefined, replyingTo || undefined);
        appendMessage(sentMessage);
        setReplyingTo(null);
      } catch (error) {
        Alert.alert('Không gửi được sticker', error instanceof Error ? error.message : 'Vui lòng thử lại.');
        return;
      } finally {
        setSending(false);
      }
    }
    setReplyingTo(null);
    setRecentStickerIds((current) => [stickerId, ...current.filter((id) => id !== stickerId)].slice(0, 16));
    setPicker(null);
  };

  const openAttachment = async (url?: string) => {
    if (!url) {
      Alert.alert('Không có tệp', 'Tin nhắn này không có liên kết tệp.');
      return;
    }
    try {
      await openChatAttachment(url);
    } catch (error) {
      Alert.alert('Không thể mở tệp', error instanceof Error ? error.message : 'Vui lòng thử lại.');
    }
  };

  const downloadAttachment = async (message: ChatMessage) => {
    if (!message.attachmentUrl || !message.attachmentName) {
      Alert.alert('Không thể tải tệp', 'Tin nhắn này không có liên kết tệp.');
      return;
    }
    try {
      await downloadChatAttachment(message.attachmentUrl, message.attachmentName);
    } catch (error) {
      Alert.alert('Không thể tải tệp', error instanceof Error ? error.message : 'Vui lòng thử lại.');
    }
  };

  const insertEmoji = (emoji: string) => {
    updateDraft(`${draft}${emoji}`);
    setPicker(null);
  };

  const toggleMessageReaction = async (msgId: string, emoji: string) => {
    const type = getChatReactionType(emoji);
    if (!type) {
      Alert.alert('Không thể thả cảm xúc', 'Cảm xúc này chưa được hỗ trợ.');
      return;
    }
    if (isPreview) {
      const userId = user?.id || 'preview';
      const updateReaction = (item: ChatMessage) => {
        if (item.id !== msgId) return item;
        const reactions = item.reactions || [];
        const alreadyReacted = reactions.some((reaction) => reaction.userId === userId && reaction.type === type);
        const nextReactions = reactions.filter((reaction) => reaction.userId !== userId);
        if (!alreadyReacted) nextReactions.push({ type, userId });
        return {
          ...item,
          reactions: nextReactions,
          reaction: alreadyReacted ? undefined : emoji,
        };
      };
      setMessages((current) => (current || resource.data || []).map(updateReaction));
      setSearchResults((current) => current?.map(updateReaction) || null);
      return;
    }
    try {
      const result = await messageService.react(msgId, emoji, user);
      const updateReaction = (item: ChatMessage) => item.id === msgId ? { ...item, ...result } : item;
      setMessages((current) => (current || resource.data || []).map(updateReaction));
      setSearchResults((current) => current?.map(updateReaction) || null);
    } catch (error) {
      Alert.alert('Không thể thả cảm xúc', error instanceof Error ? error.message : 'Vui lòng thử lại.');
    }
  };

  const handleLikeHoverIn = (msgId: string) => {
    if (reactionHoverTimerRef.current) {
      clearTimeout(reactionHoverTimerRef.current);
      reactionHoverTimerRef.current = null;
    }
    setReactionPopupMsgId(msgId);
  };

  const handleLikeHoverOut = () => {
    if (reactionHoverTimerRef.current) clearTimeout(reactionHoverTimerRef.current);
    reactionHoverTimerRef.current = setTimeout(() => {
      setReactionPopupMsgId(null);
    }, 380);
  };

  const handleReactionPopupHoverIn = () => {
    if (reactionHoverTimerRef.current) {
      clearTimeout(reactionHoverTimerRef.current);
      reactionHoverTimerRef.current = null;
    }
  };

  const handleCopyMessage = (text: string) => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
    setOptionsMenuMsgId(null);
    Alert.alert('Đã copy', 'Nội dung tin nhắn đã được sao chép vào bộ nhớ tạm.');
  };

  const handleTogglePin = async (msgId: string) => {
    const nextPinnedId = pinnedId === msgId ? null : msgId;
    if (!isPreview) {
      try {
        await messageService.togglePin(route.params.conversationId, msgId, user);
      } catch (error) {
        Alert.alert('Không thể ghim tin nhắn', error instanceof Error ? error.message : 'Vui lòng thử lại.');
        return;
      }
    }
    setPinnedId(nextPinnedId);
    const updatePin = (message: ChatMessage) => ({
      ...message,
      pinned: nextPinnedId ? message.id === nextPinnedId : message.id === msgId ? false : message.pinned,
    });
    setMessages((current) => (current || resource.data || []).map(updatePin));
    setSearchResults((current) => current?.map(updatePin) || null);
    setOptionsMenuMsgId(null);
  };

  const handleRecallMessage = async (msgId: string) => {
    if (!isPreview) {
      try {
        await messageService.recall(msgId, user);
      } catch (error) {
        Alert.alert('Không thể thu hồi tin nhắn', error instanceof Error ? error.message : 'Vui lòng thử lại.');
        return;
      }
    }
    const markRecalled = (item: ChatMessage) => item.id === msgId ? { ...item, recalled: true } : item;
    setMessages((current) => (current || resource.data || []).map(markRecalled));
    setSearchResults((current) => current?.map(markRecalled) || null);
    setOptionsMenuMsgId(null);
  };

  const handleDeleteForMe = async (msgId: string) => {
    if (!isPreview) {
      try {
        await messageService.deleteForMe(msgId, user);
      } catch (error) {
        Alert.alert('Không thể xóa tin nhắn', error instanceof Error ? error.message : 'Vui lòng thử lại.');
        return;
      }
    }
    setMessages((current) => (current || resource.data || []).filter((item) => item.id !== msgId));
    setSearchResults((current) => current?.filter((item) => item.id !== msgId) || null);
    setOptionsMenuMsgId(null);
  };

  const handleMessageMenu = (message: ChatMessage) => {
    setOptionsMenuMsgId((cur) => cur === message.id ? null : message.id);
  };

  useEffect(() => {
    if (!resource.loading) threadRef.current?.scrollToEnd({ animated: true });
  }, [resource.loading, thread.length]);

  useEffect(() => {
    if (isPreview || resource.loading || resource.error) return;
    messageService.markRead(route.params.conversationId, user).catch((error: unknown) => {
      Alert.alert('Không cập nhật được hộp thư', error instanceof Error ? error.message : 'Vui lòng thử lại.');
    });
  }, [isPreview, resource.error, resource.loading, route.params.conversationId, user]);

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 4 : 0}>
      <AppScreen scroll={false} contentStyle={styles.chatScreen}>
        <View style={styles.chatHeader}>
          <Pressable onPress={() => navigation.goBack()} style={styles.chatHeaderBack} accessibilityRole="button" accessibilityLabel="Quay lại danh sách">
            <ChevronLeft size={21} color={colors.ink} />
          </Pressable>
          <View style={styles.chatHeaderAvatarWrap}>
            <Image
              source={getContactAvatarSource(
                route.params.participantRole,
                undefined,
                route.params.participantAvatarUri,
              )}
              style={styles.chatHeaderAvatarImg}
            />
          </View>
          <View style={styles.chatHeaderCopy}>
            <Text numberOfLines={1} style={styles.chatHeaderName}>{conversationName}</Text>
            <Text numberOfLines={1} style={[styles.chatHeaderStatus, isPeerOnline && styles.online]}>
              {contactStatus}
            </Text>
          </View>
          {teacherAttendanceSchedule ? (
            <Pressable
              onPress={() => {
                if (teacherAttendancePending?.scheduleId === teacherAttendanceSchedule.id) {
                  cancelTeacherAttendance();
                } else if (!teacherAttendanceBusy && !teacherAttendanceLocked) {
                  openTeacherAttendanceModal();
                }
              }}
              disabled={
                teacherAttendanceBusy
                || (teacherAttendanceLocked && teacherAttendancePending?.scheduleId !== teacherAttendanceSchedule.id)
              }
              style={[
                styles.chatHeaderAction,
                styles.teacherAttendanceHeaderAction,
                teacherAttendancePending?.scheduleId === teacherAttendanceSchedule.id
                  ? styles.teacherAttendanceHeaderActionCancel
                  : teacherAttendanceAwaitingConfirm || teacherAttendanceUnderReview
                    ? styles.teacherAttendanceHeaderActionWaiting
                    : teacherAttendanceMarked || teacherAttendanceBusy
                  ? styles.teacherAttendanceHeaderActionDone
                  : styles.teacherAttendanceHeaderActionPending,
              ]}
              accessibilityRole="button"
              accessibilityLabel={teacherAttendancePending?.scheduleId === teacherAttendanceSchedule.id
                ? `Hủy điểm danh, còn ${teacherAttendanceRemaining} giây`
                : teacherAttendanceBusy
                  ? 'Đang ghi nhận điểm danh'
                  : teacherAttendanceAwaitingConfirm
                    ? 'Chờ xác nhận'
                    : teacherAttendanceUnderReview
                      ? 'Đang xử lý xác nhận'
                      : teacherAttendanceMarked ? 'Đã điểm danh' : 'Điểm danh học viên'}
            >
              <CheckCircle2
                size={16}
                color={teacherAttendancePending?.scheduleId === teacherAttendanceSchedule.id
                  ? '#FFFFFF'
                  : teacherAttendanceAwaitingConfirm || teacherAttendanceUnderReview
                    ? '#1D4ED8'
                    : teacherAttendanceMarked || teacherAttendanceBusy ? '#047857' : '#A16207'}
              />
              <Text style={[
                styles.teacherAttendanceHeaderText,
                teacherAttendancePending?.scheduleId === teacherAttendanceSchedule.id
                  ? styles.teacherAttendanceHeaderTextCancel
                  : teacherAttendanceAwaitingConfirm || teacherAttendanceUnderReview
                    ? styles.teacherAttendanceHeaderTextWaiting
                    : teacherAttendanceMarked || teacherAttendanceBusy
                  ? styles.teacherAttendanceHeaderTextDone
                  : styles.teacherAttendanceHeaderTextPending,
              ]}>
                {teacherAttendancePending?.scheduleId === teacherAttendanceSchedule.id
                  ? `Hủy điểm danh (${teacherAttendanceRemaining}s)`
                  : teacherAttendanceBusy
                    ? 'Đang ghi nhận'
                    : teacherAttendanceAwaitingConfirm
                      ? 'Chờ xác nhận'
                      : teacherAttendanceUnderReview
                        ? 'Đang xử lý'
                        : teacherAttendanceMarked ? 'Đã điểm danh' : 'Điểm danh'}
              </Text>
            </Pressable>
          ) : null}
          {canShowMeetButton ? (
            <Pressable
              onPress={() => {
                if (!meetingSchedule?.isLive || !meetingSchedule.meetingUrl) return;
                void Linking.openURL(meetingSchedule.meetingUrl).catch((error: unknown) => {
                  Alert.alert('Không mở được lớp học', error instanceof Error ? error.message : 'Vui lòng thử lại.');
                });
              }}
              disabled={!meetingSchedule?.isLive || !meetingSchedule.meetingUrl}
              style={[
                styles.chatHeaderAction,
                styles.meetHeaderAction,
                meetingSchedule?.isLive ? styles.meetHeaderActionLive : styles.meetHeaderActionUpcoming,
              ]}
              accessibilityRole="button"
              accessibilityLabel={meetingSchedule?.isLive
                ? meetingSchedule.meetingUrl ? 'Vào lớp học đang diễn ra' : 'Lớp học đang diễn ra nhưng chưa có liên kết'
                : 'Meet chưa đến giờ học, nút đang tắt'}
              accessibilityHint={meetingSchedule?.isLive && meetingSchedule.meetingUrl ? 'Mở liên kết Meet' : undefined}
            >
              <Video size={19} color={meetingSchedule?.isLive ? '#FFFFFF' : '#94A3B8'} />
            </Pressable>
          ) : null}
          {pendingAttendanceSchedule ? (
            <Pressable
              onPress={() => setAttendancePromptSchedule(pendingAttendanceSchedule)}
              style={[styles.chatHeaderAction, styles.attendanceHeaderAction]}
              accessibilityRole="button"
              accessibilityLabel="Xác nhận điểm danh buổi học"
            >
              <CheckCircle2 size={19} color="#059669" />
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => {
              setIsSearching((current) => !current);
              setSearchText('');
            }}
            style={styles.chatHeaderAction}
            accessibilityRole="button"
            accessibilityLabel="Tìm kiếm tin nhắn cũ"
          >
            <Search size={19} color={colors.muted} />
          </Pressable>
          {user && user.role !== route.params.participantRole
            && (route.params.participantRole === 'student' || route.params.participantRole === 'teacher')
            && route.params.participantId ? (
              <Pressable
                onPress={() => {
                  const callId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
                  navigation.navigate('Call', {
                    callId,
                    conversationId: route.params.conversationId,
                    conversationName,
                    participantId: route.params.participantId!,
                    participantRole: route.params.participantRole!,
                    participantName: conversationName,
                    direction: 'outgoing',
                  });
                }}
                style={styles.chatHeaderAction}
                accessibilityRole="button"
                accessibilityLabel="Gọi thoại"
              >
                <Phone size={19} color={colors.muted} />
              </Pressable>
            ) : null}
          <Pressable onPress={() => setShowInfo(true)} style={styles.chatHeaderAction} accessibilityRole="button" accessibilityLabel="Thông tin liên hệ">
            <Info size={19} color={colors.muted} />
          </Pressable>
        </View>
        {isSearching ? (
          <View>
            <View style={styles.inlineSearch}>
              <Search size={17} color={colors.muted} />
              <TextInput value={searchText} onChangeText={setSearchText} placeholder="Tìm kiếm tin nhắn cũ" style={styles.inlineSearchInput} autoFocus />
              <Pressable onPress={() => { setSearchText(''); setIsSearching(false); }} accessibilityRole="button" accessibilityLabel="Đóng tìm kiếm">
                <X size={18} color={colors.muted} />
              </Pressable>
            </View>
            {searchText.trim() ? (
              <Text style={styles.searchStatus}>
                {searchLoading ? 'Đang tìm trong cuộc trò chuyện…' : searchError || `${visibleMessages.length} kết quả`}
              </Text>
            ) : null}
          </View>
        ) : null}
        {pinnedMessage ? (
          <View style={styles.pinnedBannerCard}>
            <View style={styles.pinnedBannerAccent} />
            <View style={styles.pinnedBannerBody}>
              <View style={styles.pinnedBannerIconWrap}>
                <Pin size={13} color="#2563EB" style={{ transform: [{ rotate: '45deg' }] }} />
              </View>
              <View style={styles.pinnedBannerContent}>
                <Text style={styles.pinnedBannerTitle}>TIN NHẮN ĐÃ GHIM</Text>
                <Text numberOfLines={1} style={styles.pinnedBannerText}>
                  {pinnedMessage.recalled
                    ? 'Tin nhắn đã được thu hồi'
                    : pinnedMessage.text || pinnedMessage.attachmentName || (pinnedMessage.stickerId ? '[Sticker]' : 'Tin nhắn')}
                </Text>
              </View>
            </View>
            <Pressable
              onPress={() => setPinnedId(null)}
              style={styles.pinnedBannerUnpinBtn}
              accessibilityRole="button"
              accessibilityLabel="Bỏ ghim tin nhắn"
            >
              <PinOff size={15} color="#94A3B8" />
            </Pressable>
          </View>
        ) : null}
        <ScrollView
          ref={threadRef}
          contentContainerStyle={styles.thread}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => threadRef.current?.scrollToEnd({ animated: true })}
        >
          {resource.loading ? <LoadingSkeleton rows={2} /> : null}
          {resource.error ? <ErrorState onRetry={resource.reload} /> : null}
          {!resource.loading && !resource.error && !thread.length ? <EmptyState title="Bắt đầu cuộc trò chuyện" message="Gửi lời chào đầu tiên nhé." /> : null}
          {!resource.loading && !resource.error && isSearching && !visibleMessages.length ? (
            <EmptyState title="Không tìm thấy tin nhắn" message="Thử từ khóa khác." />
          ) : null}
          {visibleMessages.length > 0 ? (
            <View style={styles.dateDividerWrap}>
              <View style={styles.dateDividerPill}>
                <Text style={styles.dateDividerText}>
                  {/^\d{1,2}:\d{2}$/.test(visibleMessages[visibleMessages.length - 1].time)
                    ? `${visibleMessages[visibleMessages.length - 1].time} · `
                    : ''}Hôm nay
                </Text>
              </View>
            </View>
          ) : null}
          {!resource.loading && !resource.error && visibleMessages.map((message, index) => {
            if (message.callEvent) {
              const call = message.callEvent;
              const callColor = ['missed', 'rejected', 'busy', 'failed'].includes(call.status) ? '#DC2626' : '#16A34A';
              const duration = call.durationSeconds > 0
                ? ` · ${Math.floor(call.durationSeconds / 60)}:${String(call.durationSeconds % 60).padStart(2, '0')}`
                : '';
              return (
                <View key={message.id} style={styles.callEventRow}>
                  <View style={styles.callEventCard}>
                    <Phone size={15} color={callColor} />
                    <View style={styles.callEventCopy}>
                      <Text style={[styles.callEventTitle, { color: callColor }]}>{message.text}{duration}</Text>
                      <Text style={styles.callEventSubtitle}>
                        {call.direction === 'outgoing' ? `Cuộc gọi đi${call.participantName ? ` · ${call.participantName}` : ''}` : `Cuộc gọi đến${call.participantName ? ` · ${call.participantName}` : ''}`}
                        {message.time ? ` · ${message.time}` : ''}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            }
            const isMine = message.mine;
            const previousMessage = visibleMessages[index - 1];
            const nextMessage = visibleMessages[index + 1];
            const continuesPreviousGroup = Boolean(
              previousMessage
              && previousMessage.mine === message.mine
              && (message.mine || !previousMessage.senderName || !message.senderName || previousMessage.senderName === message.senderName),
            );
            const endsSenderGroup = !nextMessage
              || nextMessage.mine !== message.mine
              || (!message.mine && message.senderName && nextMessage.senderName && message.senderName !== nextMessage.senderName);
            const isGroupedMessage = continuesPreviousGroup || !endsSenderGroup;
            const reactionCounts = Array.from(new Set((message.reactions || []).map((reaction) => reaction.type)))
              .map((type) => ({
                type,
                emoji: getChatReactionEmoji(type),
                count: message.reactions?.filter((reaction) => reaction.type === type).length || 0,
              }))
              .filter((reaction) => reaction.emoji);
            const isActive = optionsMenuMsgId === message.id || reactionPopupMsgId === message.id;
            const showReactionControls = hoverMsgId === message.id
              || reactionPopupMsgId === message.id;
            const showActions = optionsMenuMsgId === message.id
              || (hoverMsgId === message.id && reactionPopupMsgId !== message.id);
            const rowHoverProps: any = {
              onMouseEnter: () => setHoverMsgId(message.id),
              onMouseLeave: () => setHoverMsgId((cur) => (cur === message.id ? null : cur)),
            };

            const bubble = (
              <View
                style={[styles.bubbleWrap, !isMine && styles.bubbleWrapOther]}
                onLayout={(event) => { bubbleWidthsRef.current[message.id] = event.nativeEvent.layout.width; }}
              >
                <Pressable
                  onPress={() => setHoverMsgId((cur) => (cur === message.id ? null : message.id))}
                  onLongPress={isPreview ? () => handleMessageMenu(message) : undefined}
                  delayLongPress={350}
                  style={[
                    styles.bubble,
                    isMine ? styles.bubbleMine : styles.bubbleOther,
                    message.attachmentType === 'image' && styles.imageMessageBubble,
                    message.recalled && styles.recalledMessageBubble,
                    message.stickerId && !message.text && !message.attachmentName && !message.gifLabel ? styles.stickerBubble : null,
                    pinnedId === message.id && styles.pinnedBubble,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={isMine ? 'Tin nhắn của tôi' : 'Tin nhắn'}
                >
                  {message.replyToText ? (
                    <View style={isMine ? styles.replyPreviewMine : styles.replyPreviewOther}>
                      <Text numberOfLines={1} style={isMine ? styles.replyPreviewTextMine : styles.replyPreviewTextOther}>↪ {message.replyToText}</Text>
                    </View>
                  ) : null}
                  {message.recalled ? (
                    <View style={styles.recalledMessageContent}>
                      <RotateCcw size={12} color="#9CA3AF" />
                      <Text style={styles.recalledMessageText}>Tin nhắn đã được thu hồi</Text>
                    </View>
                  ) : message.stickerId ? (
                    <Image
                      source={getChatStickerImage(message.stickerId)}
                      style={styles.chatSticker}
                      resizeMode="contain"
                      accessibilityLabel={CHAT_STICKERS.find((sticker) => sticker.id === message.stickerId)?.name || 'Sticker'}
                    />
                  ) : message.sticker ? (
                    <Text style={styles.sticker}>{message.sticker}</Text>
                  ) : null}
                  {message.gifLabel ? (
                    <View style={styles.chatGif}>
                      <Text style={styles.chatGifText}>GIF</Text>
                      <Text style={isMine ? styles.messageTextMine : styles.messageTextOther}>{message.gifLabel}</Text>
                    </View>
                  ) : null}
                  {message.text && !message.recalled && message.attachmentType !== 'file' ? (
                    message.attachmentType === 'image' ? (
                      <View style={[styles.imageCaption, isMine ? styles.imageCaptionMine : styles.imageCaptionOther]}>
                        <Text style={isMine ? styles.messageTextMine : styles.messageTextOther}>{message.text}</Text>
                      </View>
                    ) : (
                      <Text style={isMine ? styles.messageTextMine : styles.messageTextOther}>{message.text}</Text>
                    )
                  ) : null}
                  {message.attachmentName && !message.recalled ? (
                    <Pressable
                      onPress={() => { void openAttachment(message.attachmentUrl); }}
                      accessibilityRole="button"
                      accessibilityLabel={message.attachmentType === 'image' ? `Xem ảnh ${message.attachmentName}` : `Mở tệp ${message.attachmentName}`}
                    >
                      {message.attachmentType === 'image' && message.attachmentUrl ? (
                        <Image source={getMobileImageSource(message.attachmentUrl)} style={styles.messageImageAttachment} resizeMode="contain" />
                      ) : message.attachmentType !== 'image' ? (
                        <View style={[styles.fileAttachmentCard, isMine ? styles.fileAttachmentCardMine : styles.fileAttachmentCardOther]}>
                          <View style={[styles.fileTypeBadge, { backgroundColor: getChatAttachmentType(message.attachmentName).color }]}>
                            <Text style={styles.fileTypeBadgeText}>{getChatAttachmentType(message.attachmentName).extension}</Text>
                          </View>
                          <View style={styles.fileAttachmentInfo}>
                            <Text numberOfLines={1} style={styles.fileAttachmentName}>{message.attachmentName}</Text>
                            <Text numberOfLines={1} style={styles.fileAttachmentType}>{getChatAttachmentType(message.attachmentName).label}</Text>
                          </View>
                        </View>
                      ) : null}
                    </Pressable>
                  ) : null}
                  {message.text && message.attachmentType === 'file' && !message.recalled ? (
                    <Text style={[styles.fileAttachmentCaption, isMine ? styles.messageTextMine : styles.messageTextOther]}>{message.text}</Text>
                  ) : null}
                </Pressable>

                {/* Bottom-right Corner: Reactions Badge + Like Button */}
                {!message.recalled && (reactionCounts.length > 0 || showReactionControls) ? (
                  <View style={styles.bubbleBottomRight}>
                    {reactionCounts.map(({ type, emoji, count }) => (
                      <Pressable
                        key={type}
                        onPress={() => { void toggleMessageReaction(message.id, emoji!); }}
                        style={styles.reactionBadge}
                        accessibilityRole="button"
                        accessibilityLabel={`Cảm xúc ${type}, ${count}`}
                      >
                        <Text style={styles.reactionBadgeEmoji}>{emoji}</Text>
                        {count > 1 ? <Text style={styles.reactionBadgeCount}>{count}</Text> : null}
                      </Pressable>
                    ))}

                    {showReactionControls ? (
                      <View
                        style={styles.likeCornerContainer}
                        // @ts-ignore web-only hover events
                        onMouseEnter={() => handleLikeHoverIn(message.id)}
                        onMouseLeave={handleLikeHoverOut}
                      >
                        {reactionPopupMsgId === message.id ? (
                          <View style={[
                            styles.reactionPopupBridge,
                            !isMine && styles.reactionPopupBridgeOther,
                          ]}>
                            <View style={styles.reactionPopupBar}>
                              {ALL_REACTIONS.map((emoji) => (
                                <Pressable
                                  key={emoji}
                                  onPress={() => {
                                    void toggleMessageReaction(message.id, emoji);
                                    setReactionPopupMsgId(null);
                                  }}
                                  style={({ hovered, pressed }: any) => [
                                    styles.reactionPopupEmojiBtn,
                                    message.reaction === emoji && styles.reactionPopupEmojiBtnSelected,
                                    (hovered || pressed) && styles.reactionPopupEmojiBtnHover,
                                  ]}
                                  accessibilityRole="button"
                                  accessibilityLabel={`Cảm xúc ${emoji}`}
                                >
                                  <Text style={styles.reactionPopupEmojiText}>{emoji}</Text>
                                </Pressable>
                              ))}
                            </View>
                          </View>
                        ) : null}
                        <Pressable
                          onPress={() => {
                            void toggleMessageReaction(message.id, message.reaction ? message.reaction : '👍');
                            setReactionPopupMsgId(null);
                          }}
                          onLongPress={() => setReactionPopupMsgId(message.id)}
                          delayLongPress={280}
                          style={[styles.likeCornerBtn, message.reaction ? styles.likeCornerBtnActive : null]}
                          accessibilityRole="button"
                          accessibilityLabel={message.reaction ? `Đã thả ${message.reaction}` : 'Thích'}
                        >
                          {message.reaction ? (
                            <Text style={styles.likeCornerEmojiText}>{message.reaction}</Text>
                          ) : (
                            <ThumbsUp size={12} color="#64748B" />
                          )}
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </View>
            );

            const actions = (
              <View
                style={[
                  isMine ? styles.msgActionsMine : styles.msgActionsOther,
                  !showActions && styles.msgActionsHidden,
                  isActive && { zIndex: 999999 },
                ]}
                pointerEvents={showActions ? 'auto' : 'none'}
              >
                <View style={styles.actionBtnsPill}>
                  <Pressable
                    onPress={() => {
                      setReplyingTo(message);
                      setOptionsMenuMsgId(null);
                    }}
                    style={({ hovered }: any) => [styles.msgActionBtn, hovered && styles.msgActionBtnHover]}
                    accessibilityRole="button"
                    accessibilityLabel="Trả lời"
                  >
                    <Reply size={13} color="#64748B" />
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setOptionsMenuMsgId((cur) => (cur === message.id ? null : message.id));
                      setReactionPopupMsgId(null);
                    }}
                    style={({ hovered }: any) => [
                      styles.msgActionBtn,
                      (hovered || optionsMenuMsgId === message.id) && styles.msgActionBtnHover,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Tùy chọn"
                  >
                    <MoreHorizontal size={13} color={optionsMenuMsgId === message.id ? '#1E293B' : '#64748B'} />
                  </Pressable>
                </View>

                {optionsMenuMsgId === message.id ? (
                  <View nativeID="chat-options-menu" style={isMine ? styles.optionsMenuCardMine : styles.optionsMenuCardOther}>
                    {message.attachmentUrl && message.attachmentName && !message.recalled ? (
                      <Pressable
                        onPress={() => {
                          setOptionsMenuMsgId(null);
                          void downloadAttachment(message);
                        }}
                        style={({ pressed, hovered }: any) => [
                          styles.optionsMenuItem,
                          (pressed || hovered) && styles.optionsMenuItemPressed,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel="Tải tệp"
                      >
                        <Download size={15} color="#475569" />
                        <Text style={styles.optionsMenuItemText}>Tải {message.attachmentType === 'image' ? 'ảnh' : 'tệp'}</Text>
                      </Pressable>
                    ) : null}
                    {!message.recalled ? (
                      <Pressable
                        onPress={() => handleTogglePin(message.id)}
                        style={({ pressed, hovered }: any) => [
                          styles.optionsMenuItem,
                          (pressed || hovered) && styles.optionsMenuItemPressed,
                        ]}
                        accessibilityRole="button"
                      >
                        {pinnedId === message.id ? <PinOff size={15} color="#475569" /> : <Pin size={15} color="#475569" />}
                        <Text style={styles.optionsMenuItemText}>
                          {pinnedId === message.id ? 'Bỏ ghim tin nhắn' : 'Ghim tin nhắn'}
                        </Text>
                      </Pressable>
                    ) : null}
                    {!message.recalled && message.text ? (
                      <Pressable
                        onPress={() => handleCopyMessage(message.text)}
                        style={({ pressed, hovered }: any) => [
                          styles.optionsMenuItem,
                          (pressed || hovered) && styles.optionsMenuItemPressed,
                        ]}
                        accessibilityRole="button"
                      >
                        <Copy size={15} color="#475569" />
                        <Text style={styles.optionsMenuItemText}>Copy tin nhắn</Text>
                      </Pressable>
                    ) : null}
                    {isMine && !message.recalled ? (
                      <Pressable
                        onPress={() => handleRecallMessage(message.id)}
                        style={({ pressed, hovered }: any) => [
                          styles.optionsMenuItem,
                          (pressed || hovered) && styles.optionsMenuItemPressed,
                        ]}
                        accessibilityRole="button"
                      >
                        <RotateCcw size={15} color="#D97706" />
                        <Text style={[styles.optionsMenuItemText, styles.optionsMenuItemAmber]}>Thu hồi</Text>
                      </Pressable>
                    ) : null}
                    <Pressable
                      onPress={() => handleDeleteForMe(message.id)}
                      style={({ pressed, hovered }: any) => [
                        styles.optionsMenuItem,
                        styles.optionsMenuItemBorderTop,
                        (pressed || hovered) && styles.optionsMenuItemPressed,
                      ]}
                      accessibilityRole="button"
                    >
                      <Trash2 size={15} color="#DC2626" />
                      <Text style={[styles.optionsMenuItemText, styles.optionsMenuItemRed]}>Xóa chỉ ở phía tôi</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            );

            if (isMine) {
              return (
                <View
                  key={message.id}
                  style={[styles.messageRowMine, isGroupedMessage && styles.messageRowGrouped, isActive && styles.messageRowActive]}
                  {...rowHoverProps}
                >
                  <View style={[styles.messageMineContainer, isActive && { zIndex: 999999 }]}>
                    <View style={[styles.bubbleAndActionsRowMine, isActive && { zIndex: 999999 }]}>
                      {actions}
                      {bubble}
                    </View>
                    {endsSenderGroup ? (
                      <View style={styles.msgFooterMine}>
                        <Text style={styles.msgFooterTime}>{message.time}</Text>
                        {!message.recipientRejected ? (
                          <View style={styles.readStatusWrap}>
                            <Clock size={11} color="#94A3B8" />
                            <Text style={styles.readStatusText}>
                              {message.state === 'read' ? 'Đã xem' : 'Chưa đọc'}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    ) : null}
                    {message.recipientRejected && !message.recalled ? (
                      <Text style={styles.messageRejectedNotice}>Người nhận từ chối tin nhắn.</Text>
                    ) : null}
                  </View>
                </View>
              );
            }

            return (
              <View
                key={message.id}
                style={[styles.messageRowOther, isGroupedMessage && styles.messageRowGrouped, isActive && styles.messageRowActive]}
                {...rowHoverProps}
              >
                <View style={styles.otherAvatarWrap}>
                  <Image
                    source={getContactAvatarSource(
                      route.params.participantRole,
                      undefined,
                      route.params.participantAvatarUri,
                    )}
                    style={styles.otherAvatarImg}
                  />
                </View>
                <View style={[styles.messageOtherContainer, isActive && { zIndex: 999999 }]}>
                  <View style={[styles.bubbleAndActionsRowOther, isActive && { zIndex: 999999 }]}>
                    {bubble}
                    {actions}
                  </View>
                  {endsSenderGroup ? (
                    <View style={styles.msgFooterOther}>
                      <Text style={styles.msgFooterTime}>{message.time}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            );
          })}
          {peerTyping ? (
            <View style={styles.typingIndicator}>
              <Text style={styles.typingIndicatorText}>{route.params.conversationName || 'Đối phương'} đang nhập...</Text>
            </View>
          ) : null}
        </ScrollView>
        {replyingTo ? (
          <View style={styles.replyBar}>
            <Text numberOfLines={1} style={styles.replyBarText}>
              Trả lời: {replyingTo.recalled ? 'Tin nhắn đã được thu hồi' : replyingTo.text || replyingTo.attachmentName || (replyingTo.stickerId ? '[Sticker]' : 'Tin nhắn')}
            </Text>
            <Pressable onPress={() => setReplyingTo(null)} accessibilityRole="button" accessibilityLabel="Hủy trả lời"><Text style={styles.cancelReply}>×</Text></Pressable>
          </View>
        ) : null}
        {selectedAttachment ? (
          <View style={styles.replyBar}>
            <Text numberOfLines={1} style={styles.replyBarText}>Tệp đã chọn: {selectedAttachment.name}</Text>
            <Pressable onPress={() => setSelectedAttachment(null)} accessibilityRole="button" accessibilityLabel="Bỏ tệp đã chọn"><Text style={styles.cancelReply}>×</Text></Pressable>
          </View>
        ) : null}
        <View style={styles.composerBar}>
          <View style={styles.composerTools}>
            <Pressable
              onPress={() => setPicker('attachment')}
              style={styles.composerIcon}
              accessibilityRole="button"
              accessibilityLabel="Gửi ảnh"
            >
              <ImagePlus size={19} color="#64748B" />
            </Pressable>
            <Pressable
              onPress={() => isPreview ? setPicker('attachment') : void pickImage(true)}
              style={styles.composerIcon}
              accessibilityRole="button"
              accessibilityLabel="Chụp ảnh"
            >
              <Camera size={19} color="#64748B" />
            </Pressable>
            <Pressable
              onPress={() => isPreview ? setPicker('attachment') : void pickDocument()}
              style={styles.composerIcon}
              accessibilityRole="button"
              accessibilityLabel="Đính kèm tệp"
            >
              <Paperclip size={19} color="#64748B" />
            </Pressable>
          </View>
          <View style={styles.composerInputPill}>
            <TextInput
              value={draft}
              onChangeText={handleDraftChange}
              placeholder="Nhập tin nhắn..."
              placeholderTextColor="#94A3B8"
              style={styles.composerTextInput}
              multiline
              textAlignVertical="center"
              maxLength={500}
              returnKeyType="send"
              submitBehavior="submit"
              onSubmitEditing={() => { void send(); }}
              onBlur={stopTyping}
              accessibilityLabel="Nhập tin nhắn"
            />
            <Pressable onPress={() => setPicker('sticker')} style={styles.composerEmoji} accessibilityRole="button" accessibilityLabel="Mở bảng emoji, sticker và GIF">
              <Smile size={19} color="#94A3B8" />
            </Pressable>
          </View>
          <Pressable
            onPress={send}
            disabled={sending || (!draft.trim() && !selectedAttachment)}
            style={[styles.composerSendBtn, (sending || (!draft.trim() && !selectedAttachment)) && styles.composerSendBtnDisabled]}
            accessibilityRole="button"
            accessibilityLabel="Gửi tin nhắn"
            accessibilityState={{ disabled: sending || (!draft.trim() && !selectedAttachment) }}
          >
            <Send size={18} color="#FFFFFF" />
          </Pressable>
        </View>
        <Modal visible={picker !== null} transparent animationType="slide" onRequestClose={() => setPicker(null)}>
          <View style={styles.pickerBackdrop}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setPicker(null)}
              accessibilityRole="button"
              accessibilityLabel="Đóng bảng emoji, sticker và GIF"
            />
            <View style={[styles.pickerCard, picker === 'attachment' && styles.attachmentPickerCard]}>
              {picker === 'attachment' ? (
                <View style={styles.rowBetween}><Text style={styles.title}>Ảnh và tệp đính kèm</Text><Pressable onPress={() => setPicker(null)} accessibilityRole="button"><Text style={styles.createGroupText}>Đóng</Text></Pressable></View>
              ) : (
                <View style={styles.pickerBody}>
                  <View style={styles.pickerTabs}>
                    {(['emoji', 'sticker', 'gif'] as const).map((tab) => (
                      <Pressable
                        key={tab}
                        onPress={() => setPicker(tab)}
                        style={[styles.pickerTab, picker === tab && styles.pickerTabActive]}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: picker === tab }}
                      >
                        <Text style={[styles.pickerTabText, picker === tab && styles.pickerTabTextActive]}>
                          {tab === 'emoji' ? 'Emoji' : tab === 'sticker' ? 'Sticker' : 'GIF'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <View style={[styles.pickerPanel, picker === 'sticker' && styles.stickerPickerPanel]}>
                    {picker === 'sticker' ? (
                      <>
                      <TextInput
                        value={stickerSearch}
                        onChangeText={setStickerSearch}
                        placeholder="Tìm sticker..."
                        placeholderTextColor={colors.muted}
                        style={styles.stickerSearch}
                        accessibilityLabel="Tìm sticker"
                      />
                      <ScrollView horizontal style={styles.stickerCategoryScroller} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stickerCategories}>
                        {STICKER_CATEGORIES.map((item) => (
                          <Pressable
                            key={item.id}
                            onPress={() => setStickerCategory(item.id)}
                            style={[styles.stickerCategory, stickerCategory === item.id && styles.stickerCategoryActive]}
                            accessibilityRole="button"
                            accessibilityState={{ selected: stickerCategory === item.id }}
                          >
                            <Text style={[styles.stickerCategoryText, stickerCategory === item.id && styles.stickerCategoryTextActive]}>{item.label}</Text>
                          </Pressable>
                        ))}
                      </ScrollView>
                      <ScrollView style={styles.pickerContent} contentContainerStyle={styles.stickerSections} keyboardShouldPersistTaps="handled">
                        {recentStickers.length > 0 ? (
                          <View style={styles.stickerSection}>
                            <Text style={styles.stickerSectionTitle}>GẦN ĐÂY</Text>
                            <View style={styles.stickerGrid}>
                              {recentStickers.map((sticker) => (
                                <Pressable key={`recent-${sticker.id}`} onPress={() => void sendSticker(sticker.id)} disabled={sending} style={styles.stickerTile} accessibilityRole="button" accessibilityLabel={`Gửi sticker: ${sticker.name}`}>
                                  <Image source={getChatStickerImage(sticker.id)} style={styles.stickerImage} resizeMode="contain" />
                                </Pressable>
                              ))}
                            </View>
                          </View>
                        ) : null}
                        {STICKER_CATEGORIES.slice(1)
                          .filter((item) => stickerCategory === 'all' || item.id === stickerCategory)
                          .map((item) => {
                            const stickers = visibleStickers.filter((sticker) => sticker.category === item.id);
                            if (!stickers.length) return null;
                            return (
                              <View key={item.id} style={styles.stickerSection}>
                                <Text style={styles.stickerSectionTitle}>{item.label.toLocaleUpperCase('vi-VN')}</Text>
                                <View style={styles.stickerGrid}>
                                  {stickers.map((sticker) => (
                                    <Pressable key={sticker.id} onPress={() => void sendSticker(sticker.id)} disabled={sending} style={styles.stickerTile} accessibilityRole="button" accessibilityLabel={`Gửi sticker: ${sticker.name}`}>
                                      <Image source={getChatStickerImage(sticker.id)} style={styles.stickerImage} resizeMode="contain" />
                                    </Pressable>
                                  ))}
                                </View>
                              </View>
                            );
                          })}
                        {!visibleStickers.length ? <Text style={styles.pickerEmpty}>{stickerSearch.trim() ? 'Không tìm thấy sticker phù hợp.' : 'Danh mục này chưa có sticker.'}</Text> : null}
                      </ScrollView>
                      </>
                    ) : null}
                    {picker === 'emoji' ? (
                      <ScrollView style={[styles.pickerContent, styles.emojiPickerContent]} contentContainerStyle={styles.emojiGrid} keyboardShouldPersistTaps="handled">
                        {CHAT_EMOJIS.map((emoji, index) => (
                          <Pressable key={`${emoji}-${index}`} onPress={() => insertEmoji(emoji)} style={styles.emojiTile} accessibilityRole="button" accessibilityLabel={`Chèn emoji ${emoji}`}>
                            <Text style={styles.sticker}>{emoji}</Text>
                          </Pressable>
                        ))}
                      </ScrollView>
                    ) : null}
                    {picker === 'gif' ? (
                      <View style={[styles.gifEmpty, styles.gifPickerContent]}>
                        <Text style={styles.gifBadge}>GIF</Text>
                        <Text style={styles.gifTitle}>Thư viện GIF đang trống</Text>
                        <Text style={styles.gifDescription}>Có thể thêm GIF vào thư mục public/gifs khi bộ ảnh được cung cấp.</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              )}
              {picker === 'attachment' ? (
                <>
                  <Pressable style={styles.pickerOption} onPress={() => {
                    if (isPreview) {
                      setSelectedAttachment({ name: 'Anh-minh-hoa-demo.jpg', type: 'image' });
                      setPicker(null);
                    } else {
                      void pickImage();
                    }
                  }}><ImagePlus size={18} color={colors.brand} /><Text style={styles.role}>{isPreview ? 'Chọn ảnh mẫu' : 'Chọn ảnh từ thiết bị'}</Text></Pressable>
                  <Pressable style={styles.pickerOption} onPress={() => {
                    if (isPreview) {
                      setSelectedAttachment({ name: 'Tai-lieu-demo.pdf', type: 'file' });
                      setPicker(null);
                    } else {
                      void pickDocument();
                    }
                  }}><FileText size={18} color={colors.brand} /><Text style={styles.role}>{isPreview ? 'Chọn tệp mẫu' : 'Chọn tệp từ thiết bị'}</Text></Pressable>
                  {selectedAttachment ? <Pressable style={styles.pickerOption} onPress={() => setSelectedAttachment(null)}><Text style={styles.role}>Bỏ tệp đang chọn</Text></Pressable> : null}
                  <Text style={styles.note}>{isPreview ? 'Bản xem trước không tải hoặc truyền dữ liệu thật.' : 'Tối đa 50 MB; ảnh, PDF, Office, ZIP/RAR, video và âm thanh được hỗ trợ.'}</Text>
                </>
              ) : null}
            </View>
          </View>
        </Modal>
        {teacherAttendanceModalVisible ? (
          <Modal
            visible
            transparent
            animationType="fade"
            onRequestClose={() => setTeacherAttendanceModalVisible(false)}
          >
            <View style={styles.infoBackdrop}>
              <View style={styles.teacherAttendanceModal}>
                <View style={styles.teacherAttendanceModalHeader}>
                  <View style={styles.teacherAttendanceModalIcon}><CheckCircle2 size={21} color="#FFFFFF" /></View>
                  <View style={styles.teacherAttendanceModalHeading}>
                    <Text style={styles.teacherAttendanceModalTitle}>ĐIỂM DANH &amp; CHẤM ĐIỂM</Text>
                    <Text numberOfLines={2} style={styles.teacherAttendanceModalSubtitle}>
                      {teacherAttendanceSchedule?.courseName || teacherAttendanceSchedule?.title}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => setTeacherAttendanceModalVisible(false)}
                    accessibilityRole="button"
                    accessibilityLabel="Đóng popup điểm danh"
                    style={styles.teacherAttendanceModalClose}
                  >
                    <X size={20} color="#FFFFFF" />
                  </Pressable>
                </View>
                <ScrollView contentContainerStyle={styles.teacherAttendanceModalBody} keyboardShouldPersistTaps="handled">
                  <View style={styles.teacherAttendanceStudentBox}>
                    <Text style={styles.teacherAttendanceFieldCaption}>HỌC VIÊN</Text>
                    <Text style={styles.teacherAttendanceStudentName}>{conversationName}</Text>
                    <Text style={styles.teacherAttendanceProgress}>
                      Tiến độ hiện tại: {teacherAttendanceCompleted}/{teacherAttendanceTotal} buổi
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.teacherAttendanceFieldLabel}>ĐÁNH GIÁ BUỔI HỌC (0-10)</Text>
                    <View style={styles.teacherAttendanceGradeRow}>
                      <View style={styles.teacherAttendanceGradeStepper}>
                        <Pressable
                          onPress={() => setTeacherAttendanceGrade(String(Math.min(10, (Number(teacherAttendanceGrade.replace(',', '.')) || 0) + 1)))}
                          style={styles.teacherAttendanceGradeStep}
                          accessibilityRole="button"
                          accessibilityLabel="Tăng điểm"
                        >
                          <Text style={styles.teacherAttendanceStepText}>⌃</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => setTeacherAttendanceGrade(String(Math.max(0, (Number(teacherAttendanceGrade.replace(',', '.')) || 0) - 1)))}
                          style={styles.teacherAttendanceGradeStep}
                          accessibilityRole="button"
                          accessibilityLabel="Giảm điểm"
                        >
                          <Text style={styles.teacherAttendanceStepText}>⌄</Text>
                        </Pressable>
                      </View>
                      <TextInput
                        value={teacherAttendanceGrade}
                        onChangeText={setTeacherAttendanceGrade}
                        keyboardType="decimal-pad"
                        accessibilityLabel="Điểm buổi học từ 0 đến 10"
                        style={styles.teacherAttendanceGradeValue}
                      />
                      <Text style={styles.teacherAttendanceGradeMaximum}>/ 10</Text>
                    </View>
                  </View>
                  <View>
                    <Text style={styles.teacherAttendanceFieldLabel}>GHI CHÚ NHANH</Text>
                    <TextInput
                      value={teacherAttendanceNote}
                      onChangeText={setTeacherAttendanceNote}
                      placeholder="Ví dụ: Học tốt, nộp bài đầy đủ..."
                      multiline
                      textAlignVertical="top"
                      style={styles.teacherAttendanceNoteInput}
                    />
                  </View>
                  <View style={styles.teacherAttendanceModalActions}>
                    <Pressable
                      onPress={() => setTeacherAttendanceModalVisible(false)}
                      style={styles.teacherAttendanceCancelButton}
                      accessibilityRole="button"
                    >
                      <Text style={styles.teacherAttendanceCancelText}>HỦY</Text>
                    </Pressable>
                    <Pressable
                      onPress={confirmTeacherAttendance}
                      style={styles.teacherAttendanceConfirmButton}
                      accessibilityRole="button"
                    >
                      <Text style={styles.teacherAttendanceConfirmText}>XÁC NHẬN ĐIỂM DANH</Text>
                    </Pressable>
                  </View>
                </ScrollView>
              </View>
            </View>
          </Modal>
        ) : null}
        <Modal
          visible={Boolean(attendancePromptSchedule)}
          transparent
          animationType="fade"
          onRequestClose={() => {
            if (!attendancePromptBusy) return;
          }}
        >
          <View style={styles.infoBackdrop}>
            <View style={styles.attendancePromptCard}>
              <View style={styles.attendancePromptHeader}>
                <Text style={styles.attendancePromptEyebrow}>XÁC NHẬN ĐIỂM DANH</Text>
                <Text style={styles.attendancePromptSessionLabel}>Buổi học</Text>
                <Text style={styles.attendancePromptSessionNumber}>
                  {attendancePromptSchedule?.attendanceSessionNumber || '?'}
                  <Text style={styles.attendancePromptSessionTotal}>/{attendancePromptSchedule?.attendanceTotalSessions || '?'}</Text>
                </Text>
                <Text style={styles.attendancePromptCourse}>
                  {attendancePromptSchedule?.courseName || attendancePromptSchedule?.title || 'Buổi học'}
                </Text>
              </View>
              <View style={styles.attendancePromptDetails}>
                <Text style={styles.attendancePromptDetailLabel}>GIẢNG VIÊN HƯỚNG DẪN</Text>
                <Text style={styles.attendancePromptTeacher}>
                  {attendancePromptSchedule?.teacherName || 'Giảng viên'}
                </Text>
                <Text style={styles.attendancePromptDate}>
                  {[attendancePromptSchedule?.weekday, attendancePromptSchedule?.dateLabel].filter(Boolean).join(' · ')}
                </Text>
                <Text style={styles.attendancePromptTime}>
                  Ca {attendancePromptSchedule?.startTime || '—'}{attendancePromptSchedule?.endTime ? ` - ${attendancePromptSchedule.endTime}` : ''} · Giờ Việt Nam (UTC+7)
                </Text>
              </View>
              <Text style={styles.attendancePromptMessage}>
                Vui lòng xác nhận buổi học này. Bạn cần chọn một trong hai nút bên dưới để tiếp tục sử dụng hệ thống.
              </Text>
              <View style={styles.attendancePromptActions}>
                <Pressable
                  onPress={() => { void respondToChatAttendance('accept'); }}
                  disabled={attendancePromptBusy}
                  style={[styles.attendancePromptButton, styles.attendancePromptAccept, attendancePromptBusy && styles.attendancePromptDisabled]}
                  accessibilityRole="button"
                >
                  <CheckCircle2 size={16} color="#FFFFFF" />
                  <Text style={styles.attendancePromptAcceptText}>
                    {attendancePromptBusy ? 'Đang gửi…' : 'Đồng ý'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => { void respondToChatAttendance('dispute'); }}
                  disabled={attendancePromptBusy}
                  style={[styles.attendancePromptButton, styles.attendancePromptDispute, attendancePromptBusy && styles.attendancePromptDisabled]}
                  accessibilityRole="button"
                >
                  <X size={16} color="#FFFFFF" />
                  <Text style={styles.attendancePromptDisputeText}>Không đồng ý</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
        <Modal visible={showInfo} transparent animationType="fade" onRequestClose={() => setShowInfo(false)}>
          <View style={styles.infoBackdrop}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setShowInfo(false)}
              accessibilityRole="button"
              accessibilityLabel="Đóng thông tin liên hệ"
            />
            <View style={styles.infoCard}>
              <Avatar name={infoDisplayName} color="#F6E9D9" size={56} imageUri={route.params.participantAvatarUri} />
              <Text style={styles.infoName}>{infoDisplayName}</Text>
              <Text style={styles.infoRole}>{contactRole}</Text>
              <Text style={styles.infoStatus}>{contactStatus}</Text>
              {route.params.participantRole === 'teacher' ? (
                <View style={styles.teacherDetails}>
                  {teacherCard.loading ? (
                    <Text style={styles.teacherDetailsMessage}>Đang tải thông tin giảng viên...</Text>
                  ) : teacherCard.error ? (
                    <View style={styles.teacherDetailsError}>
                      <Text style={styles.teacherDetailsMessage}>Không thể tải thông tin giảng viên.</Text>
                      <Pressable onPress={teacherCard.reload} accessibilityRole="button">
                        <Text style={styles.teacherDetailsRetry}>Thử lại</Text>
                      </Pressable>
                    </View>
                  ) : teacherCard.data ? (
                    <>
                      <View style={styles.teacherDetailRow}>
                        <View style={[styles.teacherDetail, styles.teacherDetailSlate]}>
                          <Text style={styles.teacherDetailLabel}>Tuổi</Text>
                          <Text style={styles.teacherDetailValue}>{teacherCard.data.age ? `${teacherCard.data.age} tuổi` : 'Chưa cập nhật'}</Text>
                        </View>
                        <View style={[styles.teacherDetail, styles.teacherDetailAmber]}>
                          <Text style={styles.teacherDetailLabelAmber}>Kinh nghiệm</Text>
                          <Text style={styles.teacherDetailValueAmber}>{teacherCard.data.experience || 'Chưa cập nhật'}</Text>
                        </View>
                      </View>
                      <View style={[styles.teacherDetail, styles.teacherDetailBlue]}>
                        <Text style={styles.teacherDetailLabelBlue}>Chuyên môn</Text>
                        <Text style={styles.teacherDetailValueBlue}>{teacherCard.data.specialty || 'Chưa cập nhật'}</Text>
                      </View>
                      <View style={styles.teacherDetailRow}>
                        <View style={[styles.teacherDetail, styles.teacherDetailYellow]}>
                          <Text style={styles.teacherDetailLabelYellow}>Đánh giá</Text>
                          <Text style={styles.teacherDetailValueYellow}>
                            {teacherCard.data.ratingCount > 0
                              ? `${teacherCard.data.averageRating.toFixed(1)} / 5 sao`
                              : 'Chưa có đánh giá'}
                          </Text>
                        </View>
                        <View style={[styles.teacherDetail, styles.teacherDetailViolet]}>
                          <Text style={styles.teacherDetailLabelViolet}>Giọng</Text>
                          <Text style={styles.teacherDetailValue}>{({
                            bac: 'Miền Bắc',
                            trung: 'Miền Trung',
                            nam: 'Miền Nam',
                            tay: 'Miền Tây',
                          } as Record<string, string>)[teacherCard.data.voiceRegion] || teacherCard.data.voiceRegion || 'Chưa cập nhật'}</Text>
                        </View>
                      </View>
                    </>
                  ) : (
                    <Text style={styles.teacherDetailsMessage}>Chưa có thông tin giảng viên.</Text>
                  )}
                </View>
              ) : null}
              {route.params.participantRole === 'student' ? (
                <View style={styles.teacherDetails}>
                  {studentCard.loading ? (
                    <Text style={styles.teacherDetailsMessage}>Đang tải thông tin học viên...</Text>
                  ) : studentCard.error ? (
                    <View style={styles.teacherDetailsError}>
                      <Text style={styles.teacherDetailsMessage}>Không thể tải thông tin học viên.</Text>
                      <Pressable onPress={studentCard.reload} accessibilityRole="button">
                        <Text style={styles.teacherDetailsRetry}>Thử lại</Text>
                      </Pressable>
                    </View>
                  ) : studentCard.data ? (
                    <>
                      <View style={styles.teacherDetailRow}>
                        <View style={[styles.teacherDetail, styles.teacherDetailSlate]}>
                          <Text style={styles.teacherDetailLabel}>Khóa học</Text>
                          <Text numberOfLines={2} style={styles.teacherDetailValue}>{studentCard.data.course}</Text>
                        </View>
                        <View style={[styles.teacherDetail, styles.teacherDetailSlate]}>
                          <Text style={styles.teacherDetailLabel}>Tuổi</Text>
                          <Text style={styles.teacherDetailValue}>{studentCard.data.age ? `${studentCard.data.age} tuổi` : 'Chưa cập nhật'}</Text>
                        </View>
                      </View>
                      <View style={[styles.teacherDetail, styles.teacherDetailBlue]}>
                        <Text style={styles.teacherDetailLabelBlue}>Còn lại</Text>
                        <Text style={styles.teacherDetailValueBlue}>
                          {studentCard.data.remainingSessions == null ? 'Chưa cập nhật' : `${studentCard.data.remainingSessions} buổi`}
                        </Text>
                      </View>
                      <View style={[styles.teacherDetail, styles.teacherDetailYellow]}>
                        <Text style={styles.teacherDetailLabelYellow}>Ghi chú Admin</Text>
                        <Text style={styles.teacherDetailValueAmber}>{studentCard.data.notes || 'Chưa có ghi chú'}</Text>
                      </View>
                    </>
                  ) : (
                    <Text style={styles.teacherDetailsMessage}>Chưa có thông tin học viên.</Text>
                  )}
                </View>
              ) : null}
              {isTeacher && route.params.participantRole === 'student' && route.params.participantId ? (
                <Pressable
                  onPress={openWeeklySchedule}
                  disabled={!canScheduleStudent || studentCard.loading || !studentCard.data}
                  style={[
                    styles.weekScheduleButton,
                    (!canScheduleStudent || studentCard.loading || !studentCard.data) && styles.weekScheduleButtonDisabled,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Xếp lịch tuần cho học viên"
                >
                  <CalendarDays size={17} color="#6D28D9" />
                  <Text style={styles.weekScheduleButtonText}>Xếp lịch tuần</Text>
                </Pressable>
              ) : null}
              {!isPreview && user
                && ['student', 'teacher'].includes(user.role)
                && ['student', 'teacher'].includes(route.params.participantRole || '')
                && user.role !== route.params.participantRole ? (
                  <View style={{ width: '100%', marginTop: spacing.sm }}>
                    <CommunicationPreferencesCard role={user.role} />
                  </View>
                ) : null}
              <Pressable onPress={() => setShowInfo(false)} style={styles.infoClose} accessibilityRole="button">
                <Text style={styles.infoCloseText}>Đóng</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
        <Modal visible={showWeekSchedule} transparent animationType="slide" onRequestClose={() => setShowWeekSchedule(false)}>
          <View style={styles.weekScheduleBackdrop}>
            <View style={styles.weekScheduleSheet}>
              <View style={styles.weekScheduleHeader}>
                <View style={styles.weekScheduleHeading}>
                  <Text style={styles.weekScheduleTitle}>Xếp lịch tuần</Text>
                  <Text numberOfLines={1} style={styles.weekScheduleSubtitle}>{studentCard.data?.name || conversationName}</Text>
                </View>
                <Pressable
                  onPress={() => setShowWeekSchedule(false)}
                  style={styles.weekScheduleClose}
                  accessibilityRole="button"
                  accessibilityLabel="Đóng xếp lịch tuần"
                >
                  <X size={20} color={colors.muted} />
                </Pressable>
              </View>
              <View style={styles.weekScheduleNavigator}>
                <Pressable
                  onPress={() => { setScheduleWeekOffset((offset) => offset - 1); setScheduleDate(null); }}
                  style={styles.weekScheduleArrow}
                  accessibilityRole="button"
                  accessibilityLabel="Tuần trước"
                >
                  <Text style={styles.weekScheduleArrowText}>‹</Text>
                </Pressable>
                <Pressable
                  onPress={() => { setScheduleWeekOffset(0); setScheduleDate(null); }}
                  accessibilityRole="button"
                  accessibilityLabel="Về tuần hiện tại"
                >
                  <Text style={styles.weekScheduleRange}>
                    {weeklyScheduleDays[0]?.label} – {weeklyScheduleDays[6]?.label}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => { setScheduleWeekOffset((offset) => offset + 1); setScheduleDate(null); }}
                  style={styles.weekScheduleArrow}
                  accessibilityRole="button"
                  accessibilityLabel="Tuần sau"
                >
                  <Text style={styles.weekScheduleArrowText}>›</Text>
                </Pressable>
              </View>
              {scheduleResource.loading ? <Text style={styles.weekScheduleHint}>Đang tải lịch học…</Text> : null}
              {scheduleResource.error ? (
                <Pressable onPress={scheduleResource.reload} style={styles.weekScheduleError} accessibilityRole="button">
                  <Text style={styles.weekScheduleErrorText}>Không tải được lịch. Chạm để thử lại.</Text>
                </Pressable>
              ) : null}
              <ScrollView
                style={styles.weekScheduleDays}
                contentContainerStyle={styles.weekScheduleDaysContent}
                showsVerticalScrollIndicator
                keyboardShouldPersistTaps="handled"
              >
                {weeklyScheduleDays.map((day) => {
                  const scheduled = studentWeeklySchedules.find(
                    (item) => item.date === day.dateKey && item.status !== 'cancelled',
                  );
                  const isPast = day.dateKey < todayScheduleKey;
                  const scheduledStart = timeToMinutes(scheduled?.startTime);
                  const scheduledEnd = timeToMinutes(scheduled?.endTime) ?? (scheduledStart == null ? null : scheduledStart + 90);
                  const isElapsed = day.dateKey === todayScheduleKey && scheduledEnd != null && scheduledEnd <= currentMinute;
                  const isLocked = isPast || scheduled?.status === 'completed' || isElapsed || scheduleResource.loading || scheduleResource.error;
                  return (
                    <View key={day.dateKey} style={styles.weekScheduleDayRow}>
                      <View style={styles.weekScheduleDayCopy}>
                        <Text style={styles.weekScheduleDayName}>{day.weekday}</Text>
                        <Text style={styles.weekScheduleDayDate}>{day.label}</Text>
                        <Text numberOfLines={1} style={scheduled ? styles.weekScheduleBooked : styles.weekScheduleEmpty}>
                          {scheduled
                            ? `${scheduled.startTime || scheduled.time}${scheduled.endTime ? ` – ${scheduled.endTime}` : ''} · ${scheduled.status === 'completed' ? 'Đã dạy' : 'Đã xếp'}`
                            : isPast ? 'Ngày đã qua' : 'Chưa xếp ca'}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => selectScheduleDay(day.dateKey, scheduled)}
                        disabled={isLocked}
                        style={[styles.weekScheduleDayAction, isLocked && styles.weekScheduleDayActionDisabled]}
                        accessibilityRole="button"
                        accessibilityLabel={`${scheduled ? 'Đổi giờ' : 'Xếp ca'} ${day.weekday} ${day.label}`}
                      >
                        <Text style={styles.weekScheduleDayActionText}>{scheduled ? 'Đổi giờ' : 'Xếp ca'}</Text>
                      </Pressable>
                      {scheduled && scheduled.status !== 'completed' ? (
                        <Pressable
                          onPress={() => confirmCancelWeeklySchedule(scheduled)}
                          disabled={scheduleBusy}
                          style={styles.weekScheduleCancel}
                          accessibilityRole="button"
                          accessibilityLabel={`Hủy lịch ${day.weekday} ${day.label}`}
                        >
                          <Text style={styles.weekScheduleCancelText}>Hủy</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  );
                })}
                {scheduleDate ? (
                  <View style={styles.weekScheduleEditor}>
                    <Text style={styles.weekScheduleEditorTitle}>
                      {scheduleEditId ? 'Đổi khung giờ' : 'Chọn khóa học và giờ học'}
                    </Text>
                    {!scheduleEditId ? (
                      <>
                        <Text style={styles.weekScheduleFieldLabel}>Khóa học</Text>
                        {scheduleCourses.length ? (
                          <View style={styles.weekScheduleCourseChoices}>
                            {scheduleCourses.map((course) => (
                              <Pressable
                                key={course}
                                onPress={() => setScheduleCourse(course)}
                                style={[styles.weekScheduleCourse, scheduleCourse === course && styles.weekScheduleCourseSelected]}
                                accessibilityRole="button"
                                accessibilityState={{ selected: scheduleCourse === course }}
                              >
                                <Text style={[styles.weekScheduleCourseText, scheduleCourse === course && styles.weekScheduleCourseTextSelected]}>{course}</Text>
                              </Pressable>
                            ))}
                          </View>
                        ) : (
                          <Text style={styles.weekScheduleErrorText}>Học viên chưa có khóa học đang học để xếp lịch.</Text>
                        )}
                        {selectedCourseRemaining != null ? (
                          <Text style={styles.weekScheduleHint}>
                            Còn {selectedCourseRemaining} buổi
                          </Text>
                        ) : null}
                      </>
                    ) : null}
                    <Text style={styles.weekScheduleFieldLabel}>Ca học (90 phút)</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.weekScheduleTimeChoices}>
                      {WEEKLY_SCHEDULE_TIMES.map((time) => {
                        const conflict = getSlotConflict(time);
                        return (
                          <Pressable
                            key={time}
                            onPress={() => setScheduleTime(time)}
                            disabled={Boolean(conflict) || scheduleBusy}
                            style={[
                              styles.weekScheduleTime,
                              scheduleTime === time && styles.weekScheduleTimeSelected,
                              Boolean(conflict) && styles.weekScheduleTimeDisabled,
                            ]}
                            accessibilityRole="button"
                            accessibilityState={{ selected: scheduleTime === time, disabled: Boolean(conflict) || scheduleBusy }}
                            accessibilityLabel={`${time}${conflict ? `, ${conflict}` : ''}`}
                          >
                            <Text style={[
                              styles.weekScheduleTimeText,
                              scheduleTime === time && styles.weekScheduleTimeTextSelected,
                              Boolean(conflict) && styles.weekScheduleTimeTextDisabled,
                            ]}>{time}</Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                    {scheduleTime ? <Text style={styles.weekScheduleHint}>Kết thúc lúc {getScheduleEndTime(scheduleTime)}</Text> : null}
                    <PrimaryButton
                      title={scheduleBusy ? 'Đang lưu…' : scheduleEditId ? 'Lưu thay đổi' : 'Tạo lịch học'}
                      disabled={scheduleBusy || !scheduleTime || !scheduleCourse || scheduleResource.loading || scheduleResource.error}
                      loading={scheduleBusy}
                      onPress={() => { void saveWeeklySchedule(); }}
                    />
                    <Pressable
                      onPress={() => { setScheduleDate(null); setScheduleEditId(null); setScheduleTime(''); }}
                      style={styles.weekScheduleEditorClose}
                      accessibilityRole="button"
                    >
                      <Text style={styles.weekScheduleEditorCloseText}>Đóng phần chọn ca</Text>
                    </Pressable>
                  </View>
                ) : null}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </AppScreen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.canvas },
  chatScreen: { flex: 1, paddingBottom: spacing.xs, gap: spacing.xs, backgroundColor: '#FFFFFF' },
  conversation: { flexDirection: 'row', alignItems: 'center' },
  inboxScreen: { paddingBottom: spacing.xl },
  chatHeader: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  chatHeaderBack: { width: 28, height: 40, alignItems: 'center', justifyContent: 'center' },
  chatHeaderCopy: { flex: 1, minWidth: 0, gap: 2 },
  chatHeaderName: { color: '#1E293B', fontSize: 15, fontWeight: '700' },
  chatHeaderStatus: { color: '#94A3B8', fontSize: 12, fontWeight: '500' },
  chatHeaderAction: { width: 28, height: 40, alignItems: 'center', justifyContent: 'center' },
  meetHeaderAction: { width: 34, height: 34, borderRadius: 10 },
  meetHeaderActionLive: { backgroundColor: '#DC2626' },
  meetHeaderActionUpcoming: { backgroundColor: '#F1F5F9', opacity: 0.55 },
  attendanceHeaderAction: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0' },
  teacherAttendanceHeaderAction: { width: 'auto', minWidth: 90, maxWidth: 142, height: 34, flexDirection: 'row', gap: 5, paddingHorizontal: 8, borderRadius: 10, borderWidth: 1 },
  teacherAttendanceHeaderActionPending: { backgroundColor: '#FEF3C7', borderColor: '#FCD34D' },
  teacherAttendanceHeaderActionWaiting: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  teacherAttendanceHeaderActionDone: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  teacherAttendanceHeaderActionCancel: { backgroundColor: '#DC2626', borderColor: '#DC2626' },
  teacherAttendanceHeaderText: { fontSize: 11, fontWeight: '800' },
  teacherAttendanceHeaderTextPending: { color: '#A16207' },
  teacherAttendanceHeaderTextWaiting: { color: '#1D4ED8' },
  teacherAttendanceHeaderTextDone: { color: '#047857' },
  teacherAttendanceHeaderTextCancel: { color: '#FFFFFF', fontSize: 10 },
  teacherAttendanceModal: { width: '100%', maxWidth: 440, maxHeight: '90%', overflow: 'hidden', borderRadius: 28, backgroundColor: '#FFFFFF' },
  teacherAttendanceModalHeader: { minHeight: 92, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.md, backgroundColor: '#0DA76B' },
  teacherAttendanceModalIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)' },
  teacherAttendanceModalHeading: { flex: 1, minWidth: 0, gap: 3 },
  teacherAttendanceModalTitle: { color: '#FFFFFF', fontSize: typography.body, fontWeight: '900' },
  teacherAttendanceModalSubtitle: { color: '#D1FAE5', fontSize: typography.micro, fontWeight: '800', textTransform: 'uppercase' },
  teacherAttendanceModalClose: { width: 34, height: 38, alignItems: 'center', justifyContent: 'center' },
  teacherAttendanceModalBody: { gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.lg },
  teacherAttendanceStudentBox: { gap: 3, padding: spacing.md, borderWidth: 1, borderColor: '#C9F5E0', borderRadius: 22, backgroundColor: '#ECFDF5' },
  teacherAttendanceFieldCaption: { color: '#065F46', fontSize: typography.micro, fontWeight: '900', letterSpacing: 0.6 },
  teacherAttendanceStudentName: { color: '#059669', fontSize: typography.heading, fontWeight: '900' },
  teacherAttendanceProgress: { color: '#10B981', fontSize: typography.caption, fontWeight: '700' },
  teacherAttendanceFieldLabel: { marginBottom: spacing.xs, color: '#94A3B8', fontSize: typography.micro, fontWeight: '900', letterSpacing: 0.5 },
  teacherAttendanceGradeRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: '#E5EDF5', borderRadius: 18, backgroundColor: '#F8FAFC' },
  teacherAttendanceGradeStepper: { gap: 2 },
  teacherAttendanceGradeStep: { width: 35, height: 27, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#DBE4EF', borderRadius: 8, backgroundColor: '#FFFFFF' },
  teacherAttendanceStepText: { color: '#64748B', fontSize: 17, lineHeight: 19, fontWeight: '800' },
  teacherAttendanceGradeValue: { flex: 1, color: '#334155', fontSize: typography.body, fontWeight: '800', paddingVertical: spacing.xs },
  teacherAttendanceGradeMaximum: { color: '#CBD5E1', fontSize: typography.body, fontWeight: '900' },
  teacherAttendanceNoteInput: { minHeight: 82, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 1, borderColor: '#E5EDF5', borderRadius: 18, backgroundColor: '#F8FAFC', color: colors.ink, fontSize: typography.caption, fontWeight: '600' },
  teacherAttendanceModalActions: { flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.xs },
  teacherAttendanceCancelButton: { minHeight: 48, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: '#F8FAFC' },
  teacherAttendanceCancelText: { color: '#94A3B8', fontSize: typography.caption, fontWeight: '900' },
  teacherAttendanceConfirmButton: { minHeight: 48, flex: 2, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xs, borderRadius: radius.md, backgroundColor: '#0DA76B' },
  teacherAttendanceConfirmText: { color: '#FFFFFF', fontSize: typography.caption, fontWeight: '900', textAlign: 'center' },
  attendancePromptCard: { width: '100%', maxWidth: 400, overflow: 'hidden', borderRadius: 24, backgroundColor: colors.surface },
  attendancePromptHeader: { minHeight: 184, alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: spacing.md, paddingVertical: spacing.lg, backgroundColor: '#D7192D' },
  attendancePromptEyebrow: { color: '#FEE2E2', fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  attendancePromptSessionLabel: { color: '#FFFFFF', fontSize: typography.caption, fontWeight: '800' },
  attendancePromptSessionNumber: { color: '#FFFFFF', fontSize: 48, lineHeight: 54, fontWeight: '900' },
  attendancePromptSessionTotal: { color: '#FECACA', fontSize: 24, fontWeight: '800' },
  attendancePromptCourse: { color: '#FFFFFF', fontSize: typography.caption, lineHeight: 18, fontWeight: '800', textAlign: 'center' },
  attendancePromptDetails: { marginHorizontal: spacing.md, marginTop: spacing.md, padding: spacing.md, gap: 5, borderWidth: 1, borderColor: '#E8EEF5', borderRadius: 16, backgroundColor: '#F8FAFC' },
  attendancePromptDetailLabel: { color: '#94A3B8', fontSize: 10, fontWeight: '900' },
  attendancePromptTeacher: { color: '#172033', fontSize: typography.body, fontWeight: '900' },
  attendancePromptDate: { color: '#64748B', fontSize: typography.caption },
  attendancePromptTime: { color: '#334155', fontSize: typography.caption, fontWeight: '600' },
  attendancePromptMessage: { marginHorizontal: spacing.md, marginTop: spacing.md, color: colors.muted, fontSize: typography.caption, lineHeight: 20, textAlign: 'center' },
  attendancePromptActions: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.md },
  attendancePromptButton: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: radius.md, borderWidth: 1 },
  attendancePromptAccept: { backgroundColor: '#059669', borderColor: '#059669' },
  attendancePromptDispute: { backgroundColor: '#1E293B', borderColor: '#1E293B' },
  attendancePromptAcceptText: { color: '#FFFFFF', fontSize: typography.caption, fontWeight: '800' },
  attendancePromptDisputeText: { color: '#FFFFFF', fontSize: typography.caption, fontWeight: '800' },
  attendancePromptDisabled: { opacity: 0.6 },
  attendancePromptClose: { color: colors.muted, fontSize: typography.small, fontWeight: '600', paddingVertical: spacing.xs },
  inlineSearch: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md },
  inlineSearchInput: { flex: 1, minWidth: 0, color: colors.ink, fontSize: typography.small },
  searchStatus: { color: colors.muted, fontSize: typography.caption, paddingHorizontal: spacing.md, paddingTop: spacing.xs },
  callEventRow: { width: '100%', alignItems: 'center', paddingVertical: spacing.xs },
  callEventCard: { maxWidth: '90%', flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
  callEventCopy: { flexShrink: 1, gap: 2 },
  callEventTitle: { fontSize: 12, fontWeight: '700' },
  callEventSubtitle: { color: '#64748B', fontSize: 11 },
  createGroupButton: { minHeight: 44, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.brandSoft },
  createGroupText: { color: colors.brand, fontSize: typography.small, fontWeight: '700' },
  groupModalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  groupModal: { maxHeight: '88%', gap: spacing.md, padding: spacing.lg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, backgroundColor: colors.surface },
  closeButton: { minHeight: 42, justifyContent: 'center', paddingHorizontal: spacing.sm },
  memberList: { maxHeight: 260, borderTopWidth: 1, borderTopColor: colors.line, borderBottomWidth: 1, borderBottomColor: colors.line },
  memberRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.line },
  memberCheck: { width: 24, height: 24, textAlign: 'center', textAlignVertical: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: 6, color: colors.muted, overflow: 'hidden' },
  memberCheckSelected: { color: '#FFFFFF', backgroundColor: colors.brand, borderColor: colors.brand },
  filtersWrapper: { marginVertical: spacing.xs },
  filtersScroll: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 },
  filterChip: { minHeight: 34, borderRadius: 9999, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF', paddingHorizontal: 14, paddingVertical: 6, justifyContent: 'center', alignItems: 'center' },
  filterChipActive: { backgroundColor: '#DC2626', borderColor: '#DC2626' },
  filterText: { color: '#475569', fontSize: 13, fontWeight: '600' },
  filterTextActive: { color: '#FFFFFF', fontWeight: '700' },
  contactListCard: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden', marginTop: spacing.xs },
  contactRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, gap: 12, backgroundColor: '#FFFFFF' },
  contactRowPressed: { backgroundColor: '#F8FAFC' },
  contactRowDivider: { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  avatarContainer: { width: 48, height: 48, position: 'relative', alignItems: 'center', justifyContent: 'center' },
  avatarRing: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, overflow: 'hidden', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: 44, height: 44, borderRadius: 22 },
  roleBadgePill: { position: 'absolute', bottom: -2, right: -2, minWidth: 18, height: 16, paddingHorizontal: 3, borderRadius: 4, borderWidth: 1, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  roleBadgePillText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900', lineHeight: 12 },
  onlineDot: { position: 'absolute', top: -1, right: -1, width: 12, height: 12, borderRadius: 6, backgroundColor: '#10B981', borderWidth: 2, borderColor: '#FFFFFF', zIndex: 10 },
  contactInfoCol: { flex: 1, minWidth: 0, justifyContent: 'center', gap: 4 },
  contactHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  contactNameStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 },
  contactNameText: { fontSize: 15, fontWeight: '700', color: '#1E293B', flexShrink: 1 },
  statusPillOnline: { backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  statusPillOnlineText: { fontSize: 9, fontWeight: '600', color: '#059669' },
  statusPillOffline: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  statusPillOfflineText: { fontSize: 9, fontWeight: '600', color: '#94A3B8' },
  contactTimeText: { fontSize: 12, fontWeight: '500', color: '#94A3B8' },
  contactMessageRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  contactMessageText: { fontSize: 13, color: '#64748B', flex: 1 },
  contactMessageTextUnread: { color: '#1E293B', fontWeight: '600' },
  unreadCountBadge: { minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: '#DC2626', alignItems: 'center', justifyContent: 'center' },
  unreadCountText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  chatHeaderAvatarWrap: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  chatHeaderAvatarImg: { width: 38, height: 38, borderRadius: 19 },
  conversationCopy: { flex: 1, gap: 3 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  title: { color: colors.ink, fontSize: typography.body, fontWeight: '700', flexShrink: 1 },
  time: { color: colors.muted, fontSize: typography.caption },
  role: { color: colors.brand, fontSize: typography.caption, fontWeight: '600' },
  onlineStatus: { fontSize: typography.micro, fontWeight: '700' },
  online: { color: colors.green },
  offline: { color: colors.muted },
  preview: { color: colors.muted, fontSize: typography.small, flex: 1 },
  unread: { minWidth: 20, height: 20, borderRadius: radius.pill, paddingHorizontal: 5, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  unreadText: { color: '#FFFFFF', fontSize: typography.micro, fontWeight: '800' },
  note: { color: colors.muted, fontSize: typography.caption, textAlign: 'center', lineHeight: 18, marginTop: spacing.sm },
  socketStatus: { color: colors.red, fontSize: typography.caption, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  dateDividerWrap: { alignItems: 'center', marginVertical: 10, paddingHorizontal: spacing.sm },
  dateDividerPill: { backgroundColor: '#BFC1C5', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  dateDividerText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  thread: { paddingTop: spacing.sm, paddingHorizontal: spacing.xs, paddingBottom: 120, flexGrow: 1, backgroundColor: '#EAEBEE' },
  messageRowMine: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 14, position: 'relative', zIndex: 1 },
  messageRowGrouped: { marginBottom: 8 },
  messageMineContainer: { maxWidth: '85%', alignItems: 'flex-end', position: 'relative' },
  bubbleAndActionsRowMine: { width: '100%', minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', position: 'relative', zIndex: 100 },
  msgActionsMine: { position: 'relative', marginRight: 6, zIndex: 200 },
  actionBtnsPill: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  reactionBtnContainer: { position: 'relative', alignItems: 'center', justifyContent: 'center', zIndex: 300 },
  msgActionBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center', shadowColor: '#0F172A', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2, elevation: 1 },
  msgActionBtnActive: { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' },
  msgActionBtnHover: { backgroundColor: '#F1F5F9', borderColor: '#CBD5E1' },
  msgActionsHidden: { opacity: 0 },
  messageRowActive: { zIndex: 999999, elevation: 999999, position: 'relative' },
  bubbleWrap: { position: 'relative', maxWidth: '100%', minWidth: 0, flexShrink: 1 },
  bubbleWrapOther: { flexShrink: 1 },
  bubbleBottomRight: { position: 'absolute', bottom: -11, right: 4, flexDirection: 'row', alignItems: 'center', gap: 4, zIndex: 200 },
  reactionBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 9999, paddingHorizontal: 6, paddingVertical: 1.5, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 3 },
  reactionBadgeEmoji: { fontSize: 12 },
  reactionBadgeCount: { fontSize: 11, fontWeight: '700', color: '#475569' },
  reactionBadgeText: { fontSize: 11, color: '#475569', fontWeight: '600' },
  likeCornerContainer: { position: 'relative', zIndex: 300 },
  likeCornerBtn: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center', shadowColor: '#0F172A', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 3 },
  likeCornerBtnActive: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  likeCornerEmojiText: { fontSize: 12, lineHeight: 14 },
  reactionPopupBridge: { position: 'absolute', bottom: 24, right: -10, paddingBottom: 8, backgroundColor: 'transparent', zIndex: 999999, elevation: 999999 },
  reactionPopupBridgeOther: { right: undefined, left: -10, width: 230 },
  reactionPopupBar: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFFFFF', borderRadius: 9999, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#0F172A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 14, elevation: 999999 },
  reactionPopupEmojiBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  reactionPopupEmojiBtnHover: { backgroundColor: '#F1F5F9', transform: [{ scale: 1.25 }] },
  reactionPopupEmojiBtnSelected: { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE' },
  reactionPopupEmojiText: { fontSize: 18 },
  optionsMenuCardMine: { position: 'absolute', top: 32, right: 0, minWidth: 185, backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden', paddingVertical: 4, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.22, shadowRadius: 24, elevation: 999999, zIndex: 999999 },
  optionsMenuCardOther: { position: 'absolute', top: 32, right: 0, minWidth: 185, backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden', paddingVertical: 4, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.22, shadowRadius: 24, elevation: 999999, zIndex: 999999 },
  optionsMenuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#FFFFFF' },
  optionsMenuItemPressed: { backgroundColor: '#F8FAFC' },
  optionsMenuItemBorderTop: { borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  optionsMenuItemText: { fontSize: 14, fontWeight: '500', color: '#334155' },
  optionsMenuItemAmber: { color: '#D97706' },
  optionsMenuItemRed: { color: '#DC2626' },
  bubble: { borderRadius: 9, paddingHorizontal: 14, paddingVertical: 12, position: 'relative', maxWidth: '100%', minWidth: 0, flexShrink: 1 },
  bubbleMine: { backgroundColor: '#E4F0FF', borderWidth: 1, borderColor: '#D1E1F2' },
  bubbleOther: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' },
  imageMessageBubble: { paddingHorizontal: 0, paddingVertical: 0, backgroundColor: 'transparent', borderWidth: 0 },
  recalledMessageBubble: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#E4F0FF', borderWidth: 1, borderColor: '#D1E1F2', borderRadius: 9 },
  recalledMessageContent: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  recalledMessageText: { color: '#9CA3AF', fontSize: 12, fontStyle: 'italic' },
  imageCaption: { maxWidth: 220, marginTop: spacing.xs, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9 },
  imageCaptionMine: { backgroundColor: '#E4F0FF', borderWidth: 1, borderColor: '#D1E1F2' },
  imageCaptionOther: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' },
  fileAttachmentCard: { width: 220, maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: 9, padding: 8, borderRadius: 10 },
  fileAttachmentCardMine: { backgroundColor: '#F2F7FF' },
  fileAttachmentCardOther: { backgroundColor: '#F1F5F9' },
  fileTypeBadge: { width: 36, height: 36, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  fileTypeBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
  fileAttachmentInfo: { flex: 1, minWidth: 0, gap: 2 },
  fileAttachmentName: { color: '#1E293B', fontSize: 11, fontWeight: '600' },
  fileAttachmentType: { color: '#64748B', fontSize: 9 },
  fileAttachmentCaption: { marginTop: 4, paddingHorizontal: 2, fontSize: 13, lineHeight: 18 },
  stickerBubble: { padding: 0, backgroundColor: 'transparent', borderWidth: 0 },
  chatSticker: { width: 120, height: 120 },
  pinnedBubble: { borderWidth: 1.5, borderColor: '#93C5FD' },
  pinnedBannerCard: { marginHorizontal: 12, marginTop: 8, marginBottom: 4, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 14, backgroundColor: '#F0F9FF', borderWidth: 1, borderColor: '#BAE6FD', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', position: 'relative', overflow: 'hidden', shadowColor: '#0F172A', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  pinnedBannerAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: '#3B82F6' },
  pinnedBannerBody: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, paddingLeft: 4 },
  pinnedBannerIconWrap: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' },
  pinnedBannerContent: { flex: 1, minWidth: 0 },
  pinnedBannerTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, color: '#1D4ED8', textTransform: 'uppercase', marginBottom: 1 },
  pinnedBannerText: { fontSize: 13, fontWeight: '500', color: '#334155' },
  pinnedBannerUnpinBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 6, marginLeft: 8 },
  messageTextMine: { color: '#1E293B', fontSize: 14, lineHeight: 20 },
  messageTextOther: { color: '#1E293B', fontSize: 14, lineHeight: 20 },
  attachmentNameMine: { color: '#1E293B', fontSize: 13, fontWeight: '600' },
  attachmentNameOther: { color: '#1E293B', fontSize: 13, fontWeight: '600' },
  replyPreviewMine: { borderLeftWidth: 2, borderLeftColor: '#3B82F6', paddingLeft: 6, marginBottom: 4 },
  replyPreviewTextMine: { color: '#64748B', fontSize: 12, fontStyle: 'italic' },
  replyPreviewOther: { borderLeftWidth: 2, borderLeftColor: '#94A3B8', paddingLeft: 6, marginBottom: 4 },
  replyPreviewTextOther: { color: '#64748B', fontSize: 12, fontStyle: 'italic' },
  msgFooterMine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginTop: 4, paddingRight: 4, zIndex: 1 },
  msgFooterTime: { color: '#64748B', fontSize: 11, fontWeight: '500' },
  messageRejectedNotice: { marginTop: 2, paddingRight: 4, color: '#DC2626', fontSize: 11, fontWeight: '700', textAlign: 'right' },
  readStatusWrap: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#BFC1C5', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  readStatusText: { color: '#FFFFFF', fontSize: 11, fontWeight: '600' },
  messageRowOther: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 14 },
  otherAvatarWrap: { width: 34, height: 34, borderRadius: 17, overflow: 'hidden', borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  otherAvatarImg: { width: 32, height: 32, borderRadius: 16 },
  messageOtherContainer: { flex: 1, minWidth: 0, alignItems: 'flex-start' },
  bubbleAndActionsRowOther: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', zIndex: 100 },
  msgActionsOther: { position: 'relative', marginLeft: 6, zIndex: 200, flexShrink: 0 },
  msgFooterOther: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 6, marginTop: 4, paddingLeft: 4 },
  typingIndicator: { alignSelf: 'flex-start', marginTop: spacing.xs, marginLeft: 42, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  typingIndicatorText: { color: '#64748B', fontSize: 12, fontStyle: 'italic' },
  sticker: { fontSize: 38, lineHeight: 46 },
  composerBar: { alignSelf: 'stretch', marginHorizontal: -spacing.xl, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  composerTools: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  composerIcon: { width: 32, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  composerInputPill: { flex: 1, height: 42, minHeight: 42, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 21, paddingHorizontal: 12 },
  composerTextInput: { flex: 1, height: 40, color: '#1E293B', fontSize: 14, lineHeight: 20, paddingTop: Platform.OS === 'web' ? 10 : 0, paddingBottom: 0, paddingHorizontal: 0, textAlignVertical: 'center' },
  composerEmoji: { width: 28, height: 38, alignItems: 'center', justifyContent: 'center' },
  composerSendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#F87171', alignItems: 'center', justifyContent: 'center', shadowColor: '#F87171', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 2 },
  messageInput: { minHeight: 42, paddingHorizontal: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.canvas, color: colors.ink, fontSize: typography.small },
  composerSendBtnDisabled: { opacity: 0.45, shadowOpacity: 0 },
  replyBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.brandSoft, borderTopLeftRadius: radius.md, borderTopRightRadius: radius.md },
  replyBarText: { flex: 1, color: colors.brandDark, fontSize: typography.caption, fontWeight: '600' },
  cancelReply: { color: colors.brandDark, fontSize: 24, paddingHorizontal: spacing.sm },
  pickerBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  pickerCard: { height: '48%', maxHeight: 400, minHeight: 280, gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xl, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, backgroundColor: colors.surface },
  attachmentPickerCard: { height: 'auto', maxHeight: '45%', minHeight: 0, paddingBottom: spacing.lg },
  pickerBody: { flex: 1, minHeight: 0, gap: spacing.sm },
  pickerTabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.line },
  pickerTab: { flex: 1, height: 42, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  pickerTabActive: { borderBottomColor: colors.brand },
  pickerTabText: { color: colors.muted, fontSize: typography.caption, fontWeight: '700' },
  pickerTabTextActive: { color: colors.brand },
  stickerSearch: { height: 40, flexShrink: 0, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.canvas, color: colors.ink, fontSize: typography.small },
  stickerCategories: { alignItems: 'center', gap: spacing.xs, paddingBottom: 2 },
  stickerCategory: { paddingHorizontal: spacing.sm, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.canvas },
  stickerCategoryActive: { backgroundColor: colors.brand },
  stickerCategoryText: { color: colors.muted, fontSize: typography.caption, fontWeight: '700' },
  stickerCategoryTextActive: { color: '#FFFFFF' },
  pickerPanel: { flex: 1, minHeight: 0 },
  stickerPickerPanel: { gap: spacing.xs },
  stickerCategoryScroller: { flexGrow: 0, flexShrink: 0, minHeight: 34 },
  pickerContent: { flex: 1, minHeight: 0 },
  stickerSections: { paddingBottom: spacing.sm },
  stickerSection: { marginBottom: spacing.sm },
  stickerSectionTitle: { marginBottom: spacing.xs, color: colors.muted, fontSize: typography.micro, fontWeight: '800', letterSpacing: 1 },
  stickerGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start' },
  stickerTile: { width: '32%', aspectRatio: 1, margin: '0.66%', alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },
  stickerImage: { width: 76, height: 76, maxWidth: '100%' },
  pickerEmpty: { paddingVertical: spacing.xl, color: colors.muted, textAlign: 'center', fontSize: typography.small },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', paddingBottom: spacing.sm },
  emojiTile: { width: '16.66%', height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  emojiPickerContent: { paddingTop: spacing.sm },
  gifEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingHorizontal: spacing.xl },
  gifPickerContent: { minHeight: 0 },
  gifBadge: { padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.canvas, color: colors.ink, fontSize: 22, fontWeight: '800' },
  gifTitle: { color: colors.ink, fontSize: typography.small, fontWeight: '700' },
  gifDescription: { maxWidth: 280, color: colors.muted, textAlign: 'center', fontSize: typography.caption, lineHeight: 18 },
  pickerOption: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.canvas },
  chatGif: { minWidth: 112, minHeight: 64, alignItems: 'center', justifyContent: 'center', gap: spacing.xs, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.goldSoft },
  chatGifText: { color: colors.brand, fontSize: typography.caption, fontWeight: '900', letterSpacing: 1 },
  messageImageAttachment: { width: 180, height: 150, borderRadius: radius.md },
  chatAttachment: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  infoBackdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl, backgroundColor: colors.overlay },
  infoCard: { width: '100%', maxWidth: 360, alignItems: 'center', gap: spacing.sm, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surface },
  infoName: { color: colors.ink, fontSize: typography.heading, fontWeight: '800', textAlign: 'center' },
  infoRole: { color: colors.brand, fontSize: typography.small, fontWeight: '700', textTransform: 'capitalize' },
  infoStatus: { color: colors.muted, fontSize: typography.caption },
  teacherDetails: { width: '100%', gap: spacing.xs, marginTop: spacing.xs },
  teacherDetailRow: { flexDirection: 'row', gap: spacing.xs },
  teacherDetail: { flex: 1, minHeight: 58, justifyContent: 'center', gap: 3, padding: spacing.sm },
  teacherDetailSlate: { backgroundColor: '#F8FAFC' },
  teacherDetailAmber: { backgroundColor: '#FFFBEB' },
  teacherDetailBlue: { backgroundColor: '#EFF6FF' },
  teacherDetailYellow: { backgroundColor: '#FEFCE8' },
  teacherDetailViolet: { backgroundColor: '#F5F3FF' },
  teacherDetailLabel: { color: '#94A3B8', fontSize: typography.caption },
  teacherDetailLabelAmber: { color: '#D97706', fontSize: typography.caption },
  teacherDetailLabelBlue: { color: '#2563EB', fontSize: typography.caption },
  teacherDetailLabelYellow: { color: '#CA8A04', fontSize: typography.caption },
  teacherDetailLabelViolet: { color: '#7C3AED', fontSize: typography.caption },
  teacherDetailValue: { color: '#334155', fontSize: typography.caption, fontWeight: '700' },
  teacherDetailValueAmber: { color: '#B45309', fontSize: typography.caption, fontWeight: '700' },
  teacherDetailValueBlue: { color: '#1D4ED8', fontSize: typography.caption, fontWeight: '700' },
  teacherDetailValueYellow: { color: '#A16207', fontSize: typography.caption, fontWeight: '700' },
  teacherDetailsMessage: { color: colors.muted, fontSize: typography.caption, textAlign: 'center' },
  teacherDetailsError: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.sm },
  teacherDetailsRetry: { color: colors.brand, fontSize: typography.caption, fontWeight: '700' },
  weekScheduleButton: { width: '100%', minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.xs, borderRadius: radius.md, borderWidth: 1, borderColor: '#DDD6FE', backgroundColor: '#F5F3FF' },
  weekScheduleButtonDisabled: { opacity: 0.5 },
  weekScheduleButtonText: { color: '#6D28D9', fontSize: typography.small, fontWeight: '800' },
  weekScheduleBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  weekScheduleSheet: { maxHeight: '92%', paddingTop: spacing.lg, paddingHorizontal: spacing.md, paddingBottom: spacing.xl, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, backgroundColor: colors.surface },
  weekScheduleHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  weekScheduleHeading: { flex: 1, gap: 2 },
  weekScheduleTitle: { color: colors.ink, fontSize: typography.heading, fontWeight: '800' },
  weekScheduleSubtitle: { color: colors.muted, fontSize: typography.caption },
  weekScheduleClose: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: colors.canvas },
  weekScheduleNavigator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm, paddingVertical: spacing.xs, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#E2E8F0' },
  weekScheduleArrow: { width: 40, height: 38, alignItems: 'center', justifyContent: 'center' },
  weekScheduleArrowText: { color: colors.brand, fontSize: 28, lineHeight: 30, fontWeight: '700' },
  weekScheduleRange: { color: colors.ink, fontSize: typography.small, fontWeight: '800' },
  weekScheduleHint: { marginTop: 4, color: colors.muted, fontSize: typography.caption },
  weekScheduleError: { marginVertical: spacing.xs, padding: spacing.sm, borderRadius: radius.sm, backgroundColor: '#FEF2F2' },
  weekScheduleErrorText: { color: '#B91C1C', fontSize: typography.caption, fontWeight: '600' },
  weekScheduleDays: { flexShrink: 1, marginTop: spacing.xs },
  weekScheduleDaysContent: { gap: spacing.xs, paddingBottom: spacing.md },
  weekScheduleDayRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, padding: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: colors.surface },
  weekScheduleDayCopy: { flex: 1, minWidth: 0, gap: 2 },
  weekScheduleDayName: { color: colors.ink, fontSize: typography.caption, fontWeight: '800' },
  weekScheduleDayDate: { color: colors.muted, fontSize: 11 },
  weekScheduleBooked: { color: '#6D28D9', fontSize: 11, fontWeight: '700' },
  weekScheduleEmpty: { color: colors.muted, fontSize: 11 },
  weekScheduleDayAction: { minHeight: 34, justifyContent: 'center', paddingHorizontal: spacing.sm, borderRadius: radius.sm, backgroundColor: '#EDE9FE' },
  weekScheduleDayActionDisabled: { opacity: 0.45 },
  weekScheduleDayActionText: { color: '#6D28D9', fontSize: 11, fontWeight: '800' },
  weekScheduleCancel: { minHeight: 34, justifyContent: 'center', paddingHorizontal: spacing.sm, borderRadius: radius.sm, backgroundColor: '#FEF2F2' },
  weekScheduleCancelText: { color: '#B91C1C', fontSize: 11, fontWeight: '800' },
  weekScheduleEditor: { gap: spacing.xs, marginTop: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: '#F8FAFC' },
  weekScheduleEditorTitle: { color: colors.ink, fontSize: typography.small, fontWeight: '800' },
  weekScheduleFieldLabel: { marginTop: spacing.xs, color: colors.muted, fontSize: typography.caption, fontWeight: '700' },
  weekScheduleCourseChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  weekScheduleCourse: { maxWidth: '100%', paddingHorizontal: spacing.sm, paddingVertical: 7, borderRadius: radius.sm, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: colors.surface },
  weekScheduleCourseSelected: { borderColor: '#7C3AED', backgroundColor: '#EDE9FE' },
  weekScheduleCourseText: { color: colors.ink, fontSize: 11, fontWeight: '600' },
  weekScheduleCourseTextSelected: { color: '#6D28D9', fontWeight: '800' },
  weekScheduleTimeChoices: { gap: spacing.xs, paddingVertical: 2 },
  weekScheduleTime: { minWidth: 58, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xs, paddingVertical: spacing.sm, borderRadius: radius.sm, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: colors.surface },
  weekScheduleTimeSelected: { borderColor: '#7C3AED', backgroundColor: '#EDE9FE' },
  weekScheduleTimeDisabled: { borderColor: '#E2E8F0', backgroundColor: '#F1F5F9' },
  weekScheduleTimeText: { color: colors.ink, fontSize: 11, fontWeight: '700' },
  weekScheduleTimeTextSelected: { color: '#6D28D9', fontWeight: '900' },
  weekScheduleTimeTextDisabled: { color: '#94A3B8' },
  weekScheduleEditorClose: { minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  weekScheduleEditorCloseText: { color: colors.muted, fontSize: typography.caption, fontWeight: '700' },
  infoClose: { minHeight: 42, minWidth: 100, marginTop: spacing.sm, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: colors.brandSoft },
  infoCloseText: { color: colors.brandDark, fontSize: typography.small, fontWeight: '800' },
});
