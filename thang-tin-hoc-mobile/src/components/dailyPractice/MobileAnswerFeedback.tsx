import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BookOpen, Check, ChevronRight, RotateCcw, X, Zap } from 'lucide-react-native';
import type { DpAnswerResult, DpQuestion } from '../../services/dailyPracticeApi';
import { Mascot } from './Mascot';
import { XPRewardBurst } from './XPRewardBurst';
import type { GameSound } from './useGameSounds';
import { resolveWrongEncouragement } from '../../../../shared/dailyPractice/quizWrongEncouragement.mjs';
import { PLAY_QUESTION_CHROME } from '../../../../shared/dailyPractice/playQuestionChrome.mjs';

const FEEDBACK_STATUS = PLAY_QUESTION_CHROME.feedbackStatus;

const USE_NATIVE_DRIVER = Platform.OS !== 'web';
const DEW_GREEN = '#059669';
const DEW_GREEN_DARK = '#047857';

export function buildMobileConciseSummary(question: DpQuestion | null | undefined, result: DpAnswerResult): string {
  const answerText = String(result?.correctAnswer?.text || '').trim();
  const promptText = String(question?.prompt || '').trim();
  const explanationText = String(result?.explanation || '').trim();

  if (result?.correct) {
    if (promptText && answerText) {
      const cleanedPrompt = promptText
        .replace(/\s*(nghĩa là gì|là gì|dùng để làm gì|có tác dụng gì|viết tắt của từ gì)\s*\??$/i, '')
        .replace(/\?+$/, '')
        .trim();
      if (cleanedPrompt && cleanedPrompt.length <= 42 && cleanedPrompt.toLowerCase() !== promptText.toLowerCase()) {
        const cleanAns = answerText.replace(/\.+$/, '');
        return `${cleanedPrompt} = ${cleanAns}.`;
      }
      if (answerText.length <= 80) {
        const cleanAns = answerText.replace(/\.+$/, '');
        return `${cleanAns}.`;
      }
    }
    if (explanationText) return explanationText;
    return 'Bạn đã nắm vững kiến thức câu hỏi này.';
  }

  if (answerText) {
    return `Đáp án đúng: ${answerText}`;
  }
  if (explanationText) {
    return explanationText;
  }
  return 'Hãy xem phần giải thích để nhớ kỹ kiến thức nhé!';
}

function normalizeExplanationBody(explanation: string | undefined, answerText: string) {
  const raw = String(explanation || '').trim();
  const ans = String(answerText || '').trim();
  if (!raw) return '';

  let body = raw;
  if (ans) {
    const exactPrefix = new RegExp(`^đáp án đúng\\s*[:：]\\s*${ans.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\.?`, 'i');
    body = body.replace(exactPrefix, '').trim();
  }
  if (/^đáp án đúng/i.test(body)) {
    const inner = body.replace(/^đáp án đúng\s*[:：]\s*/i, '').replace(/\.+\s*$/, '').trim();
    if (ans && inner.toLowerCase() === ans.toLowerCase()) return '';
    body = inner;
  }
  return body;
}

export function MobileAnswerFeedback({
  question,
  result,
  confirmedXp = 0,
  feedbackTitle = '',
  busy = false,
  play,
  onNext,
  onRetry,
  canRetry = false,
  wrongTryCount = 0,
  rewardKey = '',
  explainOpen: explainOpenProp,
  onExplainOpenChange,
}: {
  question?: DpQuestion | null;
  result: DpAnswerResult;
  confirmedXp?: number;
  feedbackTitle?: string;
  busy?: boolean;
  play: (sound: GameSound) => void;
  onNext: () => void;
  onRetry?: () => void;
  canRetry?: boolean;
  wrongTryCount?: number;
  rewardKey?: string;
  explainOpen?: boolean;
  onExplainOpenChange?: (open: boolean) => void;
}) {
  const isCorrect = Boolean(result.correct);
  const [explainLocal, setExplainLocal] = useState(false);
  const explainControlled = typeof onExplainOpenChange === 'function';
  const explainOpen = explainControlled ? Boolean(explainOpenProp) : explainLocal;
  const setExplainOpen = (next: boolean | ((prev: boolean) => boolean)) => {
    const value = typeof next === 'function' ? next(explainOpen) : next;
    if (explainControlled) onExplainOpenChange(value);
    else setExplainLocal(value);
  };

  const slideAnim = useRef(new Animated.Value(0)).current;
  const checkPop = useRef(new Animated.Value(0.5)).current;
  const xpPop = useRef(new Animated.Value(0.65)).current;

  useEffect(() => {
    setExplainOpen(false);
    slideAnim.setValue(0);
    checkPop.setValue(0.5);
    xpPop.setValue(0.65);

    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.spring(checkPop, {
        toValue: 1,
        friction: 5,
        tension: 160,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.spring(xpPop, {
        toValue: 1,
        friction: 6,
        tension: 140,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start();
  }, [result, slideAnim, checkPop, xpPop]);

  const bannerLabel = isCorrect ? 'Chính xác!' : 'Chưa chính xác';
  const conciseLine = isCorrect
    ? buildMobileConciseSummary(question, result)
    : resolveWrongEncouragement(wrongTryCount);
  const answerText = String(result.correctAnswer?.text || '').trim();
  const detailExplanation = normalizeExplanationBody(result.explanation, answerText);

  return (
    <Animated.View
      style={[
        styles.card,
        isCorrect ? styles.cardOk : styles.cardBad,
        !isCorrect ? styles.cardBadCompact : null,
        {
          opacity: slideAnim,
          transform: [
            {
              translateY: slideAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [14, 0],
              }),
            },
          ],
        },
      ]}
    >
      {!isCorrect ? (
        <View style={styles.wrongBannerRow}>
          <View style={styles.mascotColCompact}>
            <Mascot mood="thinking" size={40} />
          </View>
          <View style={styles.wrongBodyCol}>
            <View style={styles.titleRowCompact}>
              <Animated.View
                style={[
                  styles.statusCircleSmall,
                  {
                    backgroundColor: FEEDBACK_STATUS.wrong.backgroundColor,
                    borderColor: FEEDBACK_STATUS.wrong.borderColor,
                    transform: [{ scale: checkPop }],
                  },
                ]}
              >
                <X
                  size={FEEDBACK_STATUS.wrong.size}
                  color={FEEDBACK_STATUS.wrong.color}
                  strokeWidth={FEEDBACK_STATUS.strokeWidth}
                />
              </Animated.View>
              <Text
                style={[styles.titleTextCompact, { color: '#B91C1C' }]}
                maxFontSizeMultiplier={1.3}
                numberOfLines={1}
              >
                {bannerLabel}
              </Text>
              {result.wrongPenaltyXp && result.wrongPenaltyXp > 0 ? (
                <View style={styles.xpPillMutedInline}>
                  <Zap size={11} color="#EF4444" fill="#FCA5A5" />
                  <Text style={styles.xpPillMutedText} maxFontSizeMultiplier={1.25}>{`-${result.wrongPenaltyXp} XP`}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.conciseTextCompact} maxFontSizeMultiplier={1.35}>
              {conciseLine}
            </Text>
          </View>
          <Pressable
            disabled={busy || !canRetry}
            onPress={() => {
              play('tap');
              onRetry?.();
            }}
            style={({ pressed }) => [
              styles.retryBannerBtn,
              pressed && canRetry && styles.btnPressed,
              !canRetry && !busy && { opacity: 0.38 },
              busy && { opacity: 0.5 },
            ]}
            accessibilityRole="button"
          >
            <RotateCcw size={15} color="#FFFFFF" />
            <Text style={styles.retryBannerBtnText} maxFontSizeMultiplier={1.2}>
              {wrongTryCount > 0 ? 'Thử lại' : 'Kiểm tra'}
            </Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.bannerRow}>
          <View style={styles.mascotCol}>
            <Mascot mood="happy" size={64} />
          </View>
          <View style={styles.bodyCol}>
            <View style={styles.titleRow}>
              <Animated.View
                style={[
                  styles.statusCircle,
                  {
                    backgroundColor: FEEDBACK_STATUS.correct.backgroundColor,
                    borderColor: FEEDBACK_STATUS.correct.borderColor,
                    transform: [{ scale: checkPop }],
                  },
                ]}
              >
                <Check
                  size={FEEDBACK_STATUS.correct.size}
                  color={FEEDBACK_STATUS.correct.color}
                  strokeWidth={FEEDBACK_STATUS.strokeWidth}
                />
              </Animated.View>
              <Text
                style={[styles.titleText, { color: DEW_GREEN_DARK }]}
                maxFontSizeMultiplier={1.3}
              >
                {bannerLabel}
              </Text>
            </View>
            <Text style={styles.conciseText} maxFontSizeMultiplier={1.35}>
              {conciseLine}
            </Text>
            <Animated.View style={[styles.xpRow, { transform: [{ scale: xpPop }] }]}>
              {confirmedXp > 0 ? (
                <XPRewardBurst xpAmount={confirmedXp} burstKey={rewardKey} />
              ) : (
                <View style={styles.xpPillGold}>
                  <Zap size={13} color="#F59E0B" fill="#FBBF24" />
                  <Text style={styles.xpPillGoldText} maxFontSizeMultiplier={1.25}>
                    {feedbackTitle || 'Xuất sắc!'}
                  </Text>
                </View>
              )}
            </Animated.View>
          </View>
        </View>
      )}

      {isCorrect ? (
        <View style={styles.actionsRow}>
          <Pressable
            onPress={() => {
              play('tap');
              setExplainOpen((prev) => !prev);
            }}
            style={({ pressed }) => [styles.explainBtn, pressed && styles.btnPressed]}
            accessibilityRole="button"
            accessibilityState={{ expanded: explainOpen }}
          >
            <BookOpen size={15} color={DEW_GREEN_DARK} />
            <Text style={styles.explainBtnText} maxFontSizeMultiplier={1.25}>
              {explainOpen ? 'Ẩn giải thích' : 'Giải thích'}
            </Text>
          </Pressable>
          <Pressable
            disabled={busy}
            onPress={() => {
              play('tap');
              onNext();
            }}
            style={({ pressed }) => [
              styles.continueBtn,
              pressed && styles.btnPressed,
              busy && { opacity: 0.65 },
            ]}
            accessibilityRole="button"
          >
            {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : null}
            <Text style={styles.continueBtnText} maxFontSizeMultiplier={1.25}>Tiếp tục</Text>
            <ChevronRight size={17} color="#FFFFFF" strokeWidth={3} />
          </Pressable>
        </View>
      ) : null}

      {explainOpen ? (
        <View style={[styles.explainPanel, isCorrect ? styles.explainPanelOk : styles.explainPanelBad]}>
          {answerText ? (
            <Text style={styles.explainCorrectAns} maxFontSizeMultiplier={1.3}>{`✓ Đáp án đúng: ${answerText}`}</Text>
          ) : null}
          {detailExplanation ? (
            <Text style={styles.explainBody} maxFontSizeMultiplier={1.35}>{detailExplanation}</Text>
          ) : (
            <Text style={styles.explainMissing} maxFontSizeMultiplier={1.3}>
              Giáo viên chưa bổ sung giải thích chi tiết. Bạn có thể xem đáp án đúng phía trên.
            </Text>
          )}
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 10,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    borderRadius: 18,
    borderWidth: 1.5,
    gap: 10,
    width: '100%',
  },
  cardOk: {
    backgroundColor: '#ECFDF5',
    borderColor: '#6EE7B7',
  },
  cardBad: {
    backgroundColor: '#FFF1F2',
    borderColor: '#FECACA',
  },
  cardBadCompact: {
    marginTop: 8,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 6,
    borderRadius: 14,
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    width: '100%',
  },
  mascotCol: {
    width: 68,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  wrongBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
  mascotColCompact: {
    width: 40,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wrongBodyCol: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    gap: 4,
    paddingRight: 2,
  },
  titleRowCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    rowGap: 4,
  },
  bodyCol: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flexWrap: 'wrap',
  },
  statusCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  statusCircleSmall: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  titleText: {
    fontSize: 18,
    fontWeight: '900',
    flexShrink: 1,
    flex: 1,
    minWidth: 0,
  },
  titleTextCompact: {
    fontSize: 14,
    fontWeight: '800',
    flexShrink: 0,
  },
  conciseText: {
    color: '#1E293B',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  conciseTextCompact: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  xpRow: {
    marginTop: 2,
  },
  xpPillGold: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#FEF9C3',
    borderWidth: 1,
    borderColor: '#FDE047',
  },
  xpPillGoldText: {
    color: '#92400E',
    fontSize: 12.5,
    fontWeight: '900',
  },
  xpPillMuted: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  xpPillMutedInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  xpPillMutedText: {
    color: '#B91C1C',
    fontSize: 12,
    fontWeight: '800',
  },
  encourageText: {
    color: '#9F1239',
    fontSize: 12.5,
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
    width: '100%',
  },
  explainBtn: {
    flex: 1,
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
    borderBottomWidth: 3,
    borderBottomColor: '#6EE7B7',
  },
  explainBtnText: {
    color: '#334155',
    fontSize: 13.5,
    fontWeight: '800',
  },
  explainBtnCompact: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#FECACA',
    borderBottomWidth: 2,
    borderBottomColor: '#FDA4AF',
  },
  explainBtnCompactText: {
    color: '#B91C1C',
    fontSize: 12,
    fontWeight: '800',
  },
  retryBannerBtn: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    minHeight: 38,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: DEW_GREEN,
    borderBottomWidth: 3,
    borderBottomColor: DEW_GREEN_DARK,
    alignSelf: 'center',
  },
  retryBannerBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '900',
  },
  continueBtn: {
    flex: 1.15,
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: DEW_GREEN,
    borderBottomWidth: 4,
    borderBottomColor: DEW_GREEN_DARK,
  },
  continueBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  btnPressed: {
    transform: [{ translateY: 1 }],
    opacity: 0.92,
  },
  explainPanel: {
    marginTop: 2,
    padding: 11,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    gap: 6,
    width: '100%',
  },
  explainPanelOk: {
    borderColor: '#A7F3D0',
  },
  explainPanelBad: {
    borderColor: '#FECACA',
  },
  explainCorrectAns: {
    color: DEW_GREEN_DARK,
    fontSize: 13,
    fontWeight: '800',
  },
  explainBody: {
    color: '#334155',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  explainMissing: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    fontStyle: 'italic',
  },
});
