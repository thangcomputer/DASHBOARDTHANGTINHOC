import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo, ActivityIndicator, Alert, Animated, AppState, DeviceEventEmitter, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CalendarCheck, CalendarDays, Check, Clock3, Flame, PlayCircle, Sparkles, Sprout, Target, Trophy, X } from 'lucide-react-native';
import { PIN_LOCK_STATE_EVENT, isPinLockedNow } from '../services/pinLock';
import { getStudyResumePoint, type StudyResumePoint } from '../services/courseVideoApi';
import { navigationRef } from '../navigation/navigationRef';
import { isActivelyStudying, isStudyMediaPlaying } from '../services/studyActivity';
import { DailyPracticeReminder } from './dailyPractice/DailyPracticeReminder';
import { DuoButton } from './duo/DuoButton';
import { useAuth } from '../app/AuthContext';
import { isFreePortalMenu } from '../utils/freePortalHelper';
import {
  LEARNING_GOAL_CHANGED_EVENT,
  LEARNING_GOAL_HOURS,
  LEARNING_GOAL_LEVELS,
  LEARNING_GOAL_PERIODS,
  OPEN_LEARNING_GOAL_EVENT,
  STUDY_MINUTE_EVENT,
  getLearningGoal,
  goalEndDateLabel,
  goalMotivation,
  saveLearningGoal,
  sendStudyHeartbeat,
  type LearningGoalData,
  type LearningGoalPeriod,
} from '../services/learningGoalApi';
import { colors, radius, spacing } from '../theme/tokens';
import type { DemoUser } from '../types';

const BEAT_MS = 60 * 1000;
const CELEBRATE_MS = 3000;
/** Màn hình được tính là "đang học". */
const STUDY_ROUTES = new Set([
  'CourseVideos', 'StudentLearning', 'Materials', 'Assignments', 'StudentExam',
  'CertPrepCatalog', 'CertPrepLevel', 'CertPrepPlayer', 'CertPrepResult', 'DailyPractice',
]);
const PERIOD_ICONS = { week: Sprout, month: Flame, quarter: Trophy } as const;
const CONFETTI_COLORS = ['#10B981', '#F59E0B', '#10B981', '#0EA5E9', '#A855F7', '#F97316'];
const CONFETTI = Array.from({ length: 18 }, (_, i) => {
  const angle = (i / 18) * Math.PI * 2;
  const distance = 95 + (i % 3) * 28;
  return {
    dx: Math.round(Math.cos(angle) * distance),
    dy: Math.round(Math.sin(angle) * distance),
    rot: `${(i % 2 ? 1 : -1) * (180 + i * 25)}deg`,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  };
});
const DROPLETS = [
  { left: 20, top: 24, size: 28, amber: false, phase: 1 },
  { left: 56, top: 64, size: 14, amber: true, phase: -1 },
  { right: 56, top: 48, size: 16, amber: false, phase: -1 },
  { right: -12, bottom: 12, size: 48, amber: true, phase: 1 },
  { left: -16, bottom: 0, size: 40, amber: false, phase: -1 },
];

/**
 * Popup đặt mục tiêu học (giữa màn hình) + bộ đếm phút học cho học viên.
 * CHỈ tự động hiển thị khi HẾT THỜI GIAN MỤC TIÊU (goal?.expired === true).
 * Khi chưa từng đặt mục tiêu hoặc mục tiêu còn hạn: KHÔNG tự bật (muốn đổi thì tự vào đổi).
 */
export function LearningGoalHost({ user }: { user: DemoUser }) {
  const enabled = user.role === 'student' && !user.previewMode;
  const [data, setData] = useState<LearningGoalData | null>(null);
  const [open, setOpen] = useState(false);
  const [pinLocked, setPinLocked] = useState(isPinLockedNow());
  const dismissedRef = useRef(false);

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(PIN_LOCK_STATE_EVENT, (locked: boolean) => setPinLocked(Boolean(locked)));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (pinLocked && dismissedRef.current) setOpen(false);
  }, [pinLocked]);

  const load = useCallback(() => {
    getLearningGoal().then(setData).catch(() => { });
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    load();
    const openSub = DeviceEventEmitter.addListener(OPEN_LEARNING_GOAL_EVENT, () => setOpen(true));
    const changedSub = DeviceEventEmitter.addListener(LEARNING_GOAL_CHANGED_EVENT, (next: LearningGoalData) => {
      if (next) setData(next);
    });
    return () => {
      openSub.remove();
      changedSub.remove();
    };
  }, [enabled, load]);

  useEffect(() => {
    if (!enabled || !data || open || dismissedRef.current) return;
    const goal = data.goal;
    // CHỈ HIỂN THỊ KHI HẾT THỜI GIAN MỤC TIÊU:
    if (!goal || !goal.expired) return;

    const dismissKey = `@cms_goal_expired_dismissed_${user.id}_${goal.endsAt || ''}`;
    AsyncStorage.getItem(dismissKey)
      .then((val) => {
        if (val === '1') return;
        setOpen(true);
      })
      .catch(() => {
        setOpen(true);
      });
  }, [data, enabled, open, user.id]);

  useEffect(() => {
    if (!enabled) return undefined;
    const timer = setInterval(() => {
      if (AppState.currentState !== 'active' || isPinLockedNow()) return;
      const routeName = navigationRef.isReady() ? navigationRef.getCurrentRoute()?.name : '';
      if (!routeName || !STUDY_ROUTES.has(routeName)) return;
      if (routeName === 'DailyPractice') {
        if (!isStudyMediaPlaying()) return;
      } else if (!isActivelyStudying()) return;
      sendStudyHeartbeat()
        .then((result) => DeviceEventEmitter.emit(STUDY_MINUTE_EVENT, result))
        .catch(() => { });
    }, BEAT_MS);
    return () => clearInterval(timer);
  }, [enabled]);

  if (!enabled) return null;
  const goalSettled = Boolean(data) && !open;
  return (
    <>
      <DailyPracticeReminder userId={user.id} ready={goalSettled && !pinLocked} />
      {open && !pinLocked ? (
        <LearningGoalModal
          currentGoal={data?.goal || null}
          onClose={() => {
            dismissedRef.current = true;
            setOpen(false);
            const goal = data?.goal;
            if (goal?.expired) {
              const dismissKey = `@cms_goal_expired_dismissed_${user.id}_${goal.endsAt || ''}`;
              AsyncStorage.setItem(dismissKey, '1').catch(() => undefined);
            }
          }}
          onSaved={(next) => {
            dismissedRef.current = true;
            setData(next);
            DeviceEventEmitter.emit(LEARNING_GOAL_CHANGED_EVENT, next);
          }}
          onDone={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function useLoop(duration: number, enabled: boolean, delay = 0) {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!enabled) return undefined;
    const animation = Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(value, { toValue: 1, duration, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(value, { toValue: 0, duration: 0, useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [delay, duration, enabled, value]);
  return value;
}

function LearningGoalModal({
  currentGoal,
  onClose,
  onSaved,
  onDone,
}: {
  currentGoal: LearningGoalData['goal'];
  onClose: () => void;
  onSaved: (data: LearningGoalData) => void;
  onDone: () => void;
}) {
  const { user } = useAuth();
  const isBrandStudent = Boolean(user && user.role === 'student' && !isFreePortalMenu(user));
  const editing = Boolean(currentGoal && !currentGoal.expired);
  const [period, setPeriod] = useState<LearningGoalPeriod>(editing && currentGoal ? currentGoal.period : 'month');
  const [hours, setHours] = useState(editing && currentGoal ? currentGoal.hoursPerDay : 2);
  const [saving, setSaving] = useState(false);
  const [celebrate, setCelebrate] = useState<{ label: string; endDate: string } | null>(null);
  /** undefined = đang tải; null = chưa có bài học dở. */
  const [resume, setResume] = useState<StudyResumePoint | null | undefined>(undefined);
  const [motion, setMotion] = useState(true);
  const selected = LEARNING_GOAL_PERIODS.find((option) => option.id === period) || LEARNING_GOAL_PERIODS[1];
  const level = LEARNING_GOAL_LEVELS[hours] || LEARNING_GOAL_LEVELS[2];
  const endDate = goalEndDateLabel(selected.days);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const enter = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;
  const ring = useLoop(2400, motion && !celebrate);
  const ringLate = useLoop(2400, motion && !celebrate, 1200);
  const float = useLoop(6000, motion);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => setMotion(!reduce)).catch(() => { });
    Animated.spring(enter, { toValue: 1, friction: 7, tension: 90, useNativeDriver: true }).start();
  }, [enter]);

  useEffect(() => {
    if (!celebrate) return undefined;
    pop.setValue(0);
    burst.setValue(0);
    Animated.spring(pop, { toValue: 1, friction: 5, tension: 110, useNativeDriver: true }).start();
    Animated.timing(burst, { toValue: 1, duration: 1150, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    let alive = true;
    getStudyResumePoint()
      .then((point) => { if (alive) setResume(point); })
      .catch(() => { if (alive) setResume(null); });
    return () => { alive = false; };
  }, [burst, celebrate, pop]);

  // Có bài học dở thì giữ popup để HV bấm học tiếp; không có thì tự đóng sau vài giây.
  useEffect(() => {
    if (!celebrate || resume !== null) return undefined;
    const timer = setTimeout(() => onDoneRef.current(), CELEBRATE_MS);
    return () => clearTimeout(timer);
  }, [celebrate, resume]);

  const continueLearning = () => {
    if (!resume) return;
    onDone();
    if (!navigationRef.isReady()) return;
    navigationRef.navigate('MainTabs', {
      screen: 'CourseVideos',
      params: {
        resumeKey: Date.now(),
        resumeSubjectId: resume.subjectId,
        resumeCourseId: resume.courseId,
        resumeUnitId: resume.unitId,
        resumeSectionId: resume.sectionId,
      },
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      onSaved(await saveLearningGoal(period, hours));
      setCelebrate({ label: `${hours} giờ / ngày · ${selected.label} `, endDate });
    } catch (error) {
      Alert.alert('Không lưu được mục tiêu', error instanceof Error ? error.message : 'Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  };

  const floatY = float.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -7, 0] });
  const ringStyle = (value: Animated.Value) => ({
    opacity: value.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
    transform: [{ scale: value.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] }) }],
  });

  return (
    <Modal visible transparent animationType="fade" onRequestClose={celebrate ? onDone : onClose}>
      <View style={styles.backdrop}>
        <Animated.View
          style={[styles.card, {
            opacity: enter,
            transform: [
              { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
              { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
            ],
          }]}
          accessibilityViewIsModal
        >
          <View style={styles.hero}>
            {DROPLETS.map((drop, index) => (
              <Animated.View
                key={index}
                pointerEvents="none"
                style={[
                  styles.droplet,
                  drop.amber && styles.dropletAmber,
                  {
                    left: drop.left, right: drop.right, top: drop.top, bottom: drop.bottom,
                    width: drop.size, height: drop.size, borderRadius: drop.size / 2,
                    transform: [{ translateY: drop.phase > 0 ? floatY : Animated.multiply(floatY, -1) }],
                  },
                ]}
              />
            ))}
            {!celebrate ? (
              <Pressable onPress={onClose} style={styles.close} accessibilityRole="button" accessibilityLabel="Để sau">
                <X size={18} color={colors.muted} />
              </Pressable>
            ) : null}
            <View style={styles.badgeWrap}>
              {!celebrate && motion ? (
                <>
                  <Animated.View pointerEvents="none" style={[styles.ring, ringStyle(ring), isBrandStudent && styles.ringBrand]} />
                  <Animated.View pointerEvents="none" style={[styles.ring, ringStyle(ringLate), isBrandStudent && styles.ringBrand]} />
                </>
              ) : null}
              {celebrate ? (
                <Animated.View style={[styles.badge, styles.badgeSuccess, { transform: [{ scale: pop }] }]}>
                  <Check size={32} strokeWidth={3} color="#FFFFFF" />
                </Animated.View>
              ) : (
                <View style={[styles.badge, isBrandStudent && styles.badgeBrand]}><Target size={30} color="#FFFFFF" /></View>
              )}
            </View>
            <Text style={styles.title}>{celebrate ? 'Đã đặt mục tiêu!' : editing ? 'Đổi mục tiêu học' : 'Đặt mục tiêu học'}</Text>
            <Text style={styles.subtitle}>
              {celebrate
                ? 'Hệ thống sẽ theo dõi tiến độ mỗi ngày giúp bạn. Cố lên nhé!'
                : currentGoal?.expired
                  ? 'Mục tiêu trước đã kết thúc - đặt mục tiêu mới để tiếp tục nhé!'
                  : 'Chọn thời gian và số giờ học mỗi ngày, hệ thống sẽ theo dõi tiến độ giúp bạn.'}
            </Text>
          </View>

          {celebrate ? (
            <View style={styles.successBody} accessibilityLiveRegion="polite">
              {motion ? CONFETTI.map((piece, index) => (
                <Animated.View
                  key={index}
                  pointerEvents="none"
                  style={[styles.confetti, {
                    backgroundColor: piece.color,
                    opacity: burst.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 0.8, 0] }),
                    transform: [
                      { translateX: burst.interpolate({ inputRange: [0, 1], outputRange: [0, piece.dx] }) },
                      { translateY: burst.interpolate({ inputRange: [0, 1], outputRange: [0, piece.dy] }) },
                      { rotate: burst.interpolate({ inputRange: [0, 1], outputRange: ['0deg', piece.rot] }) },
                    ],
                  }]}
                />
              )) : null}
              <Animated.View style={[styles.successPill, { transform: [{ scale: pop }] }]}>
                <Target size={16} color="#047857" />
                <Text style={styles.successPillText}>{celebrate.label}</Text>
              </Animated.View>
              <View style={styles.inlineRow}>
                <CalendarCheck size={15} color="#059669" />
                <Text style={styles.successText}>
                  Hoàn thành dự kiến <Text style={styles.strong}>{celebrate.endDate}</Text>
                </Text>
              </View>
              {resume ? (
                <>
                  <View style={styles.resumeCard}>
                    <View style={styles.resumeIcon}><PlayCircle size={22} color="#FFFFFF" /></View>
                    <View style={styles.resumeCopy}>
                      <Text numberOfLines={1} style={styles.resumeEyebrow}>Đang học dở · {resume.subjectName}</Text>
                      <Text numberOfLines={1} style={styles.resumeTitle}>{resume.unitTitle}</Text>
                      {resume.itemTitle ? <Text numberOfLines={1} style={styles.resumeSub}>{resume.itemTitle}</Text> : null}
                    </View>
                  </View>
                  <DuoButton
                    variant="primary"
                    size="md"
                    fullWidth
                    icon={<PlayCircle size={18} color="#FFFFFF" />}
                    text={resume.kind === 'video' ? 'Tiếp tục xem video' : 'Tiếp tục bài học'}
                    onPress={continueLearning}
                  />
                  <DuoButton
                    variant="secondary"
                    size="md"
                    fullWidth
                    text="Để sau"
                    onPress={onDone}
                    style={{ marginTop: 8 }}
                  />
                </>
              ) : (
                <DuoButton
                  variant="primary"
                  size="md"
                  fullWidth
                  loading={resume === undefined}
                  text="Tuyệt vời!"
                  onPress={onDone}
                />
              )}
            </View>
          ) : (
            <>
              <ScrollView style={styles.bodyScroll} contentContainerStyle={styles.body} bounces={false}>
                <View style={styles.sectionLabel}>
                  <CalendarDays size={14} color={colors.muted} />
                  <Text style={styles.sectionLabelText}>Thời gian mục tiêu</Text>
                </View>
                <View style={[styles.row, styles.periodRow]} accessibilityRole="radiogroup">
                  {LEARNING_GOAL_PERIODS.map((option) => {
                    const active = option.id === period;
                    const Icon = PERIOD_ICONS[option.id];
                    return (
                      <Pressable
                        key={option.id}
                        onPress={() => setPeriod(option.id)}
                        style={[styles.option, active && (isBrandStudent ? styles.optionActiveBrand : styles.optionActive)]}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: active }}
                      >
                        {option.popular ? (
                          <View style={[styles.popular, isBrandStudent && styles.popularBrand]}><Text style={styles.popularText}>PHỔ BIẾN</Text></View>
                        ) : null}
                        <Icon size={18} color={active ? (isBrandStudent ? '#059669' : colors.brand) : '#94A3B8'} />
                        <Text style={[styles.optionTitle, active && (isBrandStudent ? styles.optionTitleActiveBrand : styles.optionTitleActive)]}>{option.label}</Text>
                        <Text style={styles.optionHint}>{`${option.days} ngày`}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={styles.hoursHead}>
                  <View style={styles.sectionLabel}>
                    <Clock3 size={14} color={colors.muted} />
                    <Text style={styles.sectionLabelText}>Mỗi ngày học</Text>
                  </View>
                  <View style={[styles.levelPill, { backgroundColor: level.soft }]}>
                    <View style={[styles.levelDot, { backgroundColor: level.color }]} />
                    <Text style={[styles.levelText, { color: level.color }]}>{level.label}</Text>
                  </View>
                </View>
                <View style={styles.row} accessibilityRole="radiogroup">
                  {LEARNING_GOAL_HOURS.map((value) => {
                    const active = value === hours;
                    const tone = LEARNING_GOAL_LEVELS[value];
                    return (
                      <Pressable
                        key={value}
                        onPress={() => setHours(value)}
                        style={[styles.option, styles.hourOption, active && { borderColor: tone.color, backgroundColor: tone.soft }]}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: active }}
                        accessibilityLabel={`${value} giờ mỗi ngày - ${tone.label} `}
                      >
                        <Text style={[styles.hourValue, active && { color: tone.color }]}>{value}</Text>
                        <Text style={styles.optionHint}>giờ</Text>
                        <View style={styles.bars}>
                          {LEARNING_GOAL_HOURS.map((bar) => (
                            <View
                              key={bar}
                              style={[styles.bar, {
                                height: 3 + bar,
                                backgroundColor: bar <= value ? tone.color : '#E2E8F0',
                                opacity: bar <= value && !active ? 0.55 : 1,
                              }]}
                            />
                          ))}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={[styles.summary, isBrandStudent && styles.summaryBrand]}>
                  <Text style={[styles.summaryText, isBrandStudent && styles.summaryTextBrand]}>
                    Tổng cộng <Text style={styles.strong}>{`${hours * selected.days} giờ`}</Text> trong{' '}
                    <Text style={styles.strong}>{`${selected.days} ngày`}</Text>
                  </Text>
                  <View style={styles.inlineRow}>
                    <CalendarCheck size={13} color={isBrandStudent ? '#059669' : '#047857'} />
                    <Text style={[styles.summaryDate, isBrandStudent && styles.summaryDateBrand]}>{`Hoàn thành dự kiến ${endDate} `}</Text>
                  </View>
                  <View style={styles.inlineRow}>
                    <Sparkles size={12} color="#F59E0B" />
                    <Text style={styles.motivation}>{goalMotivation(hours)}</Text>
                  </View>
                </View>
              </ScrollView>

              <View style={styles.actions}>
                <DuoButton
                  variant="secondary"
                  size="md"
                  text="Để sau"
                  onPress={onClose}
                  style={{ width: 105 }}
                />
                <DuoButton
                  variant={isBrandStudent ? 'danger' : 'accent'}
                  size="md"
                  loading={saving}
                  icon={<Target size={16} color="#FFFFFF" />}
                  text={editing ? 'Lưu mục tiêu' : 'Bắt đầu'}
                  onPress={() => { void save(); }}
                  style={styles.flex}
                />
              </View>
            </>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(2, 6, 23, 0.55)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  card: {
    width: '100%', maxWidth: 420, maxHeight: '94%', borderRadius: 28, backgroundColor: colors.surface, overflow: 'hidden',
    boxShadow: '0px 24px 48px rgba(15, 23, 42, 0.25)',
  },
  hero: {
    alignItems: 'center',
    overflow: 'hidden',
    paddingHorizontal: spacing.xl,
    paddingTop: 28,
    paddingBottom: spacing.lg,
    backgroundColor: '#ECFDF5',
    backgroundImage: 'linear-gradient(135deg, #ECFDF5 0%, #FFFFFF 50%, #FFFBEB 100%)',
  } as never,
  droplet: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.75)',
    backgroundColor: 'rgba(236, 253, 245, 0.6)',
    backgroundImage: 'radial-gradient(circle at 32% 28%, rgba(255, 255, 255, 0.95) 0%, rgba(236, 253, 245, 0.7) 38%, rgba(52, 211, 153, 0.22) 78%, rgba(52, 211, 153, 0.08) 100%)',
    boxShadow: '0px 6px 14px rgba(5, 150, 105, 0.12), inset 0px -3px 6px rgba(5, 150, 105, 0.12)',
  } as never,
  dropletAmber: {
    backgroundColor: 'rgba(254, 243, 199, 0.65)',
    backgroundImage: 'radial-gradient(circle at 32% 28%, rgba(255, 255, 255, 0.95) 0%, rgba(254, 243, 199, 0.75) 38%, rgba(251, 191, 36, 0.24) 78%, rgba(251, 191, 36, 0.08) 100%)',
    boxShadow: '0px 6px 14px rgba(217, 119, 6, 0.12), inset 0px -3px 6px rgba(217, 119, 6, 0.12)',
  } as never,
  close: {
    position: 'absolute', top: 12, right: 12, width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255, 255, 255, 0.85)', zIndex: 2,
  },
  badgeWrap: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: 'rgba(16, 185, 129, 0.55)' },
  ringBrand: { borderColor: 'rgba(16, 185, 129, 0.55)' },
  badge: {
    width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand,
    backgroundImage: 'linear-gradient(180deg, #10B981 0%, #059669 100%)',
    boxShadow: '0px 10px 22px rgba(4, 120, 87, 0.35), inset 0px 2px 3px rgba(255, 255, 255, 0.4), inset 0px -4px 6px rgba(4, 120, 87, 0.5)',
  } as never,
  badgeBrand: {
    backgroundColor: '#10B981',
    backgroundImage: 'linear-gradient(180deg, #10B981 0%, #059669 100%)',
    boxShadow: '0px 10px 22px rgba(185, 28, 28, 0.35), inset 0px 2px 3px rgba(255, 255, 255, 0.4), inset 0px -4px 6px rgba(153, 27, 27, 0.5)',
  } as never,
  badgeSuccess: {
    backgroundColor: '#059669',
    backgroundImage: 'linear-gradient(180deg, #34D399 0%, #059669 100%)',
    boxShadow: '0px 10px 22px rgba(5, 150, 105, 0.35), inset 0px 2px 3px rgba(255, 255, 255, 0.45), inset 0px -4px 6px rgba(6, 78, 59, 0.45)',
  } as never,
  title: { marginTop: spacing.md, color: colors.ink, fontSize: 20, fontWeight: '900' },
  subtitle: { marginTop: 6, color: colors.muted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  bodyScroll: { flexGrow: 0 },
  body: { paddingHorizontal: spacing.xl, paddingVertical: spacing.lg, gap: spacing.sm },
  sectionLabel: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.xs },
  sectionLabelText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  row: { flexDirection: 'row', gap: spacing.sm },
  periodRow: { paddingTop: 6 },
  option: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingTop: spacing.md,
    paddingBottom: 10,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: colors.surface,
  },
  hourOption: { paddingTop: 10, paddingBottom: 8, gap: 0, borderRadius: 14 },
  optionActive: { borderColor: '#10B981', backgroundColor: '#ECFDF5' },
  optionActiveBrand: { borderColor: '#10B981', backgroundColor: '#ECFDF5' },
  optionTitle: { color: colors.ink, fontSize: 15, fontWeight: '900' },
  optionTitleActive: { color: '#047857' },
  optionTitleActiveBrand: { color: '#059669' },
  optionHint: { color: '#94A3B8', fontSize: 11, fontWeight: '600' },
  popular: {
    position: 'absolute', top: -10, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, backgroundColor: colors.brand,
    backgroundImage: 'linear-gradient(180deg, #10B981 0%, #059669 100%)',
  } as never,
  popularBrand: {
    backgroundColor: '#059669',
    backgroundImage: 'linear-gradient(180deg, #10B981 0%, #059669 100%)',
  } as never,
  popularText: { color: '#FFFFFF', fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
  hoursHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  levelPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, marginTop: spacing.xs },
  levelDot: { width: 6, height: 6, borderRadius: 3 },
  levelText: { fontSize: 11, fontWeight: '900' },
  hourValue: { color: colors.ink, fontSize: 18, fontWeight: '900' },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 8, marginTop: 4 },
  bar: { width: 3, borderRadius: 2 },
  summary: {
    marginTop: spacing.sm, padding: spacing.md, gap: 4, borderRadius: 16, borderWidth: 1, borderColor: '#D1FAE5', backgroundColor: '#ECFDF5',
    alignItems: 'center',
  },
  summaryBrand: {
    borderColor: '#A7F3D0',
    backgroundColor: '#ECFDF5',
  },
  summaryText: { color: '#065F46', fontSize: 14, textAlign: 'center' },
  summaryTextBrand: { color: '#065F46' },
  summaryDate: { color: '#047857', fontSize: 12, fontWeight: '700' },
  summaryDateBrand: { color: '#059669' },
  motivation: { color: colors.muted, fontSize: 12, fontStyle: 'italic', flexShrink: 1 },
  strong: { fontWeight: '900', color: colors.ink },
  inlineRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  successBody: { alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.xl, gap: spacing.md },
  confetti: { position: 'absolute', top: 28, left: '50%', width: 8, height: 12, marginLeft: -4, borderRadius: 2 },
  successPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, backgroundColor: '#ECFDF5' },
  successPillText: { color: '#047857', fontSize: 14, fontWeight: '900' },
  successText: { color: '#475569', fontSize: 14 },
  successButton: { alignSelf: 'stretch', marginTop: spacing.xs },
  resumeCard: {
    alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm,
    borderRadius: 16, borderWidth: 1, borderColor: '#A7F3D0', backgroundColor: '#ECFDF5',
  },
  resumeIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand },
  resumeCopy: { flex: 1, minWidth: 0 },
  resumeEyebrow: { color: colors.brand, fontSize: 11, fontWeight: '800' },
  resumeTitle: { color: colors.ink, fontSize: 14, fontWeight: '900' },
  resumeSub: { color: colors.muted, fontSize: 12 },
  laterButton: { alignSelf: 'stretch', alignItems: 'center', paddingVertical: 6 },
  laterText: { color: colors.muted, fontSize: 14, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: spacing.sm, padding: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  secondary: {
    flex: 1, minHeight: 46, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface,
  },
  secondaryText: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  primary: {
    minHeight: 46, borderRadius: radius.md, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.brand,
    backgroundImage: 'linear-gradient(180deg, #10B981 0%, #059669 55%, #047857 100%)',
    boxShadow: '0px 8px 18px rgba(4, 120, 87, 0.3), inset 0px 2px 3px rgba(255, 255, 255, 0.35), inset 0px -3px 6px rgba(4, 120, 87, 0.45)',
  } as never,
  primaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
});
