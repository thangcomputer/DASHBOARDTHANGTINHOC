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
  useWindowDimensions,
} from 'react-native';
import { BookOpen, Check, ChevronRight, Sparkles, Star, X, Zap } from 'lucide-react-native';
import type { DpAnswerResult, DpQuestion } from '../../services/dailyPracticeApi';
import { Mascot } from './Mascot';
import type { GameSound } from './useGameSounds';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

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

export function MobileAnswerFeedback({
  question,
  result,
  confirmedXp = 0,
  feedbackTitle = '',
  busy = false,
  play,
  onNext,
}: {
  question?: DpQuestion | null;
  result: DpAnswerResult;
  confirmedXp?: number;
  feedbackTitle?: string;
  busy?: boolean;
  play: (sound: GameSound) => void;
  onNext: () => void;
}) {
  const { width } = useWindowDimensions();
  const isWide = width >= 640;
  const isCorrect = Boolean(result.correct);
  const [explainOpen, setExplainOpen] = useState(false);

  const slideAnim = useRef(new Animated.Value(0)).current;
  const checkPop = useRef(new Animated.Value(0.45)).current;
  const xpPop = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    setExplainOpen(false);
    slideAnim.setValue(0);
    checkPop.setValue(0.45);
    xpPop.setValue(0.6);

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
        tension: 150,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.spring(xpPop, {
        toValue: 1,
        friction: 5,
        tension: 130,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start();
  }, [result, slideAnim, checkPop, xpPop]);

  const bannerLabel = isCorrect ? 'Chính xác!' : 'Chưa chính xác, thử lại nhé!';
  const conciseLine = buildMobileConciseSummary(question, result);
  const detailExplanation = result.explanation
    || (result.correctAnswer?.text
      ? `Đáp án chính xác của câu hỏi này là: "${result.correctAnswer.text}". Hãy ghi nhớ khái niệm này để áp dụng nhanh trong các bài thực hành tiếp theo.`
      : 'Hãy đọc kỹ lại đề bài và các phương án để nắm vững kiến thức trọng tâm của bài học.');

  return (
    <Animated.View
      style={[
        styles.card,
        isCorrect ? styles.cardOk : styles.cardBad,
        {
          opacity: slideAnim,
          transform: [
            {
              translateY: slideAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [12, 0],
              }),
            },
          ],
        },
      ]}
    >
      <View style={[styles.mainLayout, isWide && styles.mainLayoutWide]}>
        {/* Khu vực Mascot DewSkill + ngôi sao & pháo giấy nhẹ */}
        <View style={styles.mascotStage}>
          {isCorrect ? (
            <>
              <View style={[styles.decorStar, { left: 4, top: 4 }]}>
                <Star size={14} color="#F59E0B" fill="#FBBF24" />
              </View>
              <View style={[styles.decorStar, { right: 4, top: 8 }]}>
                <Star size={12} color="#F59E0B" fill="#FDE68A" />
              </View>
              <View style={[styles.decorStar, { left: 2, bottom: 8 }]}>
                <Sparkles size={13} color="#F59E0B" />
              </View>
              <View style={[styles.confettiBit, { left: -2, top: 34, backgroundColor: '#38BDF8', transform: [{ rotate: '-18deg' }] }]} />
              <View style={[styles.confettiBit, { right: 0, top: 36, backgroundColor: '#F472B6', transform: [{ rotate: '16deg' }] }]} />
              <View style={[styles.confettiBit, { right: 8, bottom: 12, backgroundColor: '#34D399', transform: [{ rotate: '-12deg' }] }]} />
            </>
          ) : null}
          <Mascot mood={isCorrect ? 'happy' : 'thinking'} size={88} />
        </View>

        {/* Nội dung chính: Tiêu đề + giải thích ngắn + huy hiệu XP */}
        <View style={[styles.bodyCol, isWide && styles.bodyColWide]}>
          <View style={[styles.titleRow, isWide && styles.titleRowWide]}>
            <Animated.View
              style={[
                styles.statusCircle,
                { backgroundColor: isCorrect ? '#10B981' : '#EF4444', transform: [{ scale: checkPop }] },
              ]}
            >
              {isCorrect ? (
                <Check size={16} color="#FFFFFF" strokeWidth={3.4} />
              ) : (
                <X size={16} color="#FFFFFF" strokeWidth={3.2} />
              )}
            </Animated.View>
            <Text style={[styles.titleText, { color: isCorrect ? '#065F46' : '#B91C1C' }]}>
              {bannerLabel}
            </Text>
          </View>

          <Text style={[styles.conciseText, isWide && { textAlign: 'left' }]}>
            {conciseLine}
          </Text>

          {/* Huy hiệu XP xác nhận */}
          <Animated.View style={{ transform: [{ scale: xpPop }], marginTop: 4 }}>
            {isCorrect ? (
              <View style={styles.xpPillGold}>
                <Zap size={14} color="#F59E0B" fill="#FBBF24" />
                <Text style={styles.xpPillGoldText}>
                  {confirmedXp > 0 ? `+${confirmedXp} XP` : feedbackTitle || 'Ôn tập · 0 XP'}
                </Text>
              </View>
            ) : result.wrongPenaltyXp && result.wrongPenaltyXp > 0 ? (
              <View style={styles.xpPillPenalty}>
                <Zap size={13} color="#EF4444" fill="#FCA5A5" />
                <Text style={styles.xpPillPenaltyText}>{`−${result.wrongPenaltyXp} XP`}</Text>
              </View>
            ) : (
              <View style={styles.xpPillPenalty}>
                <Text style={styles.xpPillPenaltyText}>{feedbackTitle || 'Đừng nản, cố lên nhé!'}</Text>
              </View>
            )}
          </Animated.View>
        </View>

        {/* Cụm 2 nút: Giải thích & Tiếp tục > */}
        <View style={[styles.actionsWrap, isWide && styles.actionsWrapWide]}>
          <Pressable
            onPress={() => {
              play('tap');
              setExplainOpen((prev) => !prev);
            }}
            style={({ pressed }) => [
              styles.explainBtn,
              isCorrect ? styles.explainBtnOk : styles.explainBtnBad,
              pressed && { transform: [{ translateY: 2 }] },
            ]}
            accessibilityRole="button"
          >
            <Text style={styles.explainBtnText}>{explainOpen ? 'Ẩn giải thích' : 'Giải thích'}</Text>
          </Pressable>

          <Pressable
            disabled={busy}
            onPress={() => {
              play('tap');
              onNext();
            }}
            style={({ pressed }) => [
              styles.continueBtn,
              pressed && { transform: [{ translateY: 2 }], borderBottomWidth: 2 },
              busy && { opacity: 0.65 },
            ]}
            accessibilityRole="button"
          >
            {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : null}
            <Text style={styles.continueBtnText}>Tiếp tục</Text>
            <ChevronRight size={18} color="#FFFFFF" strokeWidth={3} />
          </Pressable>
        </View>
      </View>

      {/* Khung giải thích chi tiết mở ra khi bấm "Giải thích" */}
      {explainOpen ? (
        <View style={[styles.explainPanel, isCorrect ? styles.explainPanelOk : styles.explainPanelBad]}>
          <View style={[styles.explainIconBox, { backgroundColor: isCorrect ? '#D1FAE5' : '#FEE2E2' }]}>
            <BookOpen size={15} color={isCorrect ? '#047857' : '#B91C1C'} />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={styles.explainHeader}>GIẢI THÍCH CHI TIẾT</Text>
            {result.correctAnswer?.text ? (
              <Text style={styles.explainCorrectAns}>{`Đáp án đúng: ${result.correctAnswer.text}`}</Text>
            ) : null}
            <Text style={styles.explainBody}>{detailExplanation}</Text>
          </View>
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 24,
    borderWidth: 1.5,
  },
  cardOk: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  cardBad: {
    backgroundColor: '#FFF1F2',
    borderColor: '#FECACA',
  },
  mainLayout: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
  },
  mainLayoutWide: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  mascotStage: {
    width: 112,
    height: 94,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  decorStar: {
    position: 'absolute',
    zIndex: 2,
  },
  confettiBit: {
    position: 'absolute',
    width: 11,
    height: 6,
    borderRadius: 2,
    zIndex: 2,
  },
  bodyCol: {
    alignItems: 'center',
    gap: 4,
    width: '100%',
  },
  bodyColWide: {
    flex: 1,
    alignItems: 'flex-start',
    width: 'auto',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  titleRowWide: {
    justifyContent: 'flex-start',
  },
  statusCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleText: {
    fontSize: 20,
    fontWeight: '900',
  },
  conciseText: {
    color: '#1E293B',
    fontSize: 14.5,
    fontWeight: '700',
    lineHeight: 20,
    textAlign: 'center',
  },
  xpPillGold: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#FFF3C4',
    borderWidth: 1.5,
    borderColor: '#FCD34D',
  },
  xpPillGoldText: {
    color: '#92400E',
    fontSize: 13.5,
    fontWeight: '900',
  },
  xpPillPenalty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  xpPillPenaltyText: {
    color: '#B91C1C',
    fontSize: 12.5,
    fontWeight: '800',
  },
  actionsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    marginTop: 4,
  },
  actionsWrapWide: {
    flexDirection: 'column',
    width: 168,
    marginTop: 0,
  },
  explainBtn: {
    flex: 1,
    width: '100%',
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderBottomWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  explainBtnOk: {
    borderColor: '#A7F3D0',
    borderBottomColor: '#6EE7B7',
  },
  explainBtnBad: {
    borderColor: '#FECACA',
    borderBottomColor: '#FCA5A5',
  },
  explainBtnText: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '800',
  },
  continueBtn: {
    flex: 1.25,
    width: '100%',
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: '#059669',
    borderBottomWidth: 4,
    borderBottomColor: '#047857',
  },
  continueBtnText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '900',
  },
  explainPanel: {
    marginTop: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  explainPanelOk: {
    borderColor: '#A7F3D0',
  },
  explainPanelBad: {
    borderColor: '#FECACA',
  },
  explainIconBox: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  explainHeader: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '800',
  },
  explainCorrectAns: {
    color: '#065F46',
    fontSize: 13.5,
    fontWeight: '800',
  },
  explainBody: {
    color: '#334155',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },
});
