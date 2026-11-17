import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FastForward,
  Image as ImageIcon,
  Lightbulb,
  Play,
  Sparkles,
  X,
  Zap,
} from 'lucide-react-native';
import { Mascot } from './Mascot';
import { DuoButton } from '../duo/DuoButton';

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export type VideoCheckpointQuizCardProps = {
  atSec: number;
  prompt: string;
  kind?: string;
  choices: string[];
  picked: number | null;
  onSelectChoice: (index: number) => void;
  answerText: string;
  onChangeText: (text: string) => void;
  onSubmitText?: () => void;
  isReview?: boolean;
  xpReward?: number;
  walletXp?: number | null;
  hintCostXp?: number;
  missed?: boolean;
  missedText?: string;
  checkHint?: string;
  paidHint?: string;
  checkError?: string;
  checkBusy?: boolean;
  grading?: boolean;
  uploadPct?: number | null;
  cheer?: boolean;
  cheerTitle?: string;
  cheerSubtitle?: string;
  onSubmit: () => void;
  onBuyHint?: () => void;
  skipCostXp?: number;
  onSkip?: () => void;
  onPickScreenshot?: () => void;
  onDismiss?: () => void;
  onBuyXp?: () => void;
  xpShortage?: boolean;
  footNote?: string;
  /** Khi hiển thị dạng popup trong fullscreen thay vì card dưới video frame */
  compactOverlay?: boolean;
};

/**
 * Thẻ câu hỏi mốc tương tác trong video theo Phương án B (sinh động, rõ ràng, tactile push depth).
 */
export function VideoCheckpointQuizCard({
  atSec,
  prompt,
  kind,
  choices,
  picked,
  onSelectChoice,
  answerText,
  onChangeText,
  onSubmitText,
  isReview = false,
  xpReward = 5,
  walletXp = null,
  hintCostXp = 0,
  missed = false,
  missedText = '',
  checkHint = '',
  paidHint = '',
  checkError = '',
  checkBusy = false,
  grading = false,
  uploadPct = null,
  cheer = false,
  cheerTitle,
  cheerSubtitle = 'Đang tiếp tục video…',
  onSubmit,
  onBuyHint,
  skipCostXp = 15,
  onSkip,
  onPickScreenshot,
  onDismiss,
  onBuyXp,
  xpShortage = false,
  footNote = '',
  compactOverlay = false,
}: VideoCheckpointQuizCardProps) {
  const [confirmingSkip, setConfirmingSkip] = useState(false);

  useEffect(() => {
    setConfirmingSkip(false);
  }, [atSec, prompt, cheer]);

  if (cheer) {
    return (
      <View style={[styles.card, styles.cheerCard, compactOverlay && styles.compactOverlayCard]}>
        <View style={styles.cheerBody}>
          <Mascot mood="celebrate" size={56} />
          <View style={styles.cheerCopy}>
            <View style={styles.cheerBadge}>
              <CheckCircle2 size={14} color="#047857" />
              <Text style={styles.cheerBadgeText}>TRẢ LỜI CHÍNH XÁC</Text>
            </View>
            <Text style={styles.cheerTitleText}>
              {cheerTitle || (isReview ? 'Chính xác! Tiếp tục nào' : `Chính xác! +${xpReward} XP`)}
            </Text>
            <Text style={styles.cheerSubtitleText}>{cheerSubtitle}</Text>
          </View>
        </View>
      </View>
    );
  }

  const isScreen = kind === 'screen';
  const hasChoices = !isScreen && choices.length > 0 && (kind === 'choice' || !kind);
  const submitDisabled = checkBusy || (hasChoices ? picked === null : !answerText.trim());
  const hintUnlocked = Boolean(paidHint);

  return (
    <View style={[styles.card, compactOverlay && styles.compactOverlayCard]}>
      <View style={styles.headerRow}>
        <View style={styles.badgeGroup}>
          <View style={styles.clockPill}>
            <Clock3 size={12} color="#92400E" />
            <Text style={styles.clockPillText}>{`Câu hỏi mốc ${Math.max(0, Math.floor(atSec || 0))}s`}</Text>
          </View>
          {isReview ? (
            <View style={styles.reviewPill}>
              <Text style={styles.reviewPillText}>Ôn lại · Miễn phí XP</Text>
            </View>
          ) : (
            <View style={styles.xpPill}>
              <Zap size={11} color="#047857" fill="#10B981" />
              <Text style={styles.xpPillText}>{`+${xpReward} XP`}</Text>
            </View>
          )}
          {typeof walletXp === 'number' ? (
            <View style={styles.walletPill}>
              <Text style={styles.walletPillText}>{`Ví: ${walletXp} XP`}</Text>
            </View>
          ) : null}
        </View>
        {onDismiss ? (
          <Pressable
            onPress={onDismiss}
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel="Đóng câu hỏi mốc video"
          >
            <X size={16} color="#64748B" />
          </Pressable>
        ) : null}
      </View>

      {missed && missedText ? (
        <View style={styles.missedAlert}>
          <Mascot mood="sad" size={30} />
          <Text style={styles.missedAlertText}>{missedText}</Text>
        </View>
      ) : null}

      <Text style={styles.prompt}>{prompt}</Text>

      {isScreen ? (
        uploadPct !== null ? (
          <View style={styles.uploadBox}>
            <View style={styles.uploadTrack}>
              <View style={[styles.uploadFill, { width: `${grading ? 100 : uploadPct}%` }]} />
            </View>
            <Text style={styles.uploadLabel}>
              {grading ? 'AI đang chấm bài…' : `Đang tải ảnh lên ${uploadPct}%`}
            </Text>
          </View>
        ) : (
          <Pressable
            onPress={onPickScreenshot}
            disabled={grading || checkBusy}
            style={[styles.screenPickBtn, (grading || checkBusy) && { opacity: 0.6 }]}
            accessibilityRole="button"
          >
            <ImageIcon size={18} color="#047857" />
            <Text style={styles.screenPickText}>
              {grading ? 'AI đang chấm…' : missed ? 'Chọn ảnh bài làm mới' : 'Tải ảnh chụp bài làm'}
            </Text>
          </Pressable>
        )
      ) : hasChoices ? (
        <View style={styles.choicesList}>
          {choices.map((choice, index) => {
            const active = picked === index;
            const letter = OPTION_LETTERS[index] || String(index + 1);
            return (
              <Pressable
                key={`${choice}-${index}`}
                onPress={() => onSelectChoice(index)}
                style={[
                  styles.choiceCard,
                  active && styles.choiceCardActive,
                  Platform.OS === 'web' && ({ cursor: 'pointer' } as never),
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <View style={[styles.choiceLetterBadge, active && styles.choiceLetterBadgeActive]}>
                  <Text style={[styles.choiceLetterText, active && styles.choiceLetterTextActive]}>
                    {letter}
                  </Text>
                </View>
                <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{choice}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <TextInput
          value={answerText}
          onChangeText={onChangeText}
          onSubmitEditing={() => {
            if (!submitDisabled) onSubmitText?.();
          }}
          placeholder="Nhập đáp án của bạn…"
          placeholderTextColor="#94A3B8"
          style={styles.textInput}
        />
      )}

      {checkHint ? (
        <View style={styles.hintBanner}>
          <Lightbulb size={15} color="#B45309" />
          <Text style={styles.hintBannerText}>{checkHint}</Text>
        </View>
      ) : null}

      {paidHint ? (
        <View style={styles.paidHintBanner}>
          <Sparkles size={15} color="#0369A1" />
          <Text style={styles.paidHintText}>{paidHint}</Text>
        </View>
      ) : null}

      {checkError ? <Text style={styles.errorText}>{checkError}</Text> : null}

      {xpShortage && onBuyXp ? (
        <DuoButton variant="gold" size="sm" fullWidth text="Mua thêm XP" onPress={onBuyXp} />
      ) : null}

      <View style={styles.actionsRow}>
        {Number(hintCostXp) > 0 && onBuyHint ? (
          <Pressable
            onPress={onBuyHint}
            disabled={checkBusy || hintUnlocked}
            style={[
              styles.hintActionBtn,
              (checkBusy || hintUnlocked) && { opacity: 0.55 },
              Platform.OS === 'web' && ({ cursor: checkBusy || hintUnlocked ? 'default' : 'pointer' } as never),
            ]}
            accessibilityRole="button"
          >
            <Lightbulb size={15} color="#92400E" />
            <Text style={styles.hintActionText}>
              {hintUnlocked
                ? 'Đã mở gợi ý'
                : isReview
                  ? 'Gợi ý · Miễn phí'
                  : `Gợi ý · ${hintCostXp} XP`}
            </Text>
          </Pressable>
        ) : null}

        {onSkip ? (
          <Pressable
            onPress={() => setConfirmingSkip(true)}
            disabled={checkBusy || grading || confirmingSkip}
            style={[
              styles.skipActionBtn,
              (checkBusy || grading || confirmingSkip) && { opacity: 0.55 },
              Platform.OS === 'web' && ({ cursor: checkBusy || grading || confirmingSkip ? 'default' : 'pointer' } as never),
            ]}
            accessibilityRole="button"
            accessibilityLabel={isReview || skipCostXp <= 0 ? 'Khó quá bỏ qua' : `Khó quá bỏ qua (mất ${skipCostXp} XP)`}
          >
            <FastForward size={14} color="#B91C1C" />
            <Text style={styles.skipActionText}>Khó quá bỏ qua</Text>
          </Pressable>
        ) : null}

        {!isScreen ? (
          <Pressable
            onPress={onSubmit}
            disabled={submitDisabled}
            style={[
              styles.submitBtn,
              submitDisabled && styles.submitBtnDisabled,
              Platform.OS === 'web' && ({ cursor: submitDisabled ? 'not-allowed' : 'pointer' } as never),
            ]}
            accessibilityRole="button"
          >
            {checkBusy ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Text numberOfLines={1} style={styles.submitBtnText}>Xác nhận & Tiếp</Text>
                <Play size={13} color="#FFFFFF" fill="#FFFFFF" />
              </>
            )}
          </Pressable>
        ) : null}
      </View>

      {confirmingSkip && onSkip ? (
        <View style={styles.skipConfirmBox} accessibilityRole="alert">
          <View style={styles.skipConfirmHead}>
            <AlertTriangle size={16} color="#B91C1C" />
            <Text style={styles.skipConfirmTitle}>
              {isReview || skipCostXp <= 0 ? 'Xác nhận bỏ qua' : `Cảnh báo mất ${skipCostXp} XP`}
            </Text>
          </View>
          <Text style={styles.skipConfirmBody}>
            {isReview || skipCostXp <= 0
              ? 'Đang ở chế độ ôn lại (không mất XP). Bạn muốn bỏ qua câu hỏi này để xem tiếp video?'
              : `Bỏ qua câu hỏi mốc video này sẽ bị trừ ${skipCostXp} XP để tiếp tục xem. Bạn có chắc muốn bỏ qua?`}
          </Text>
          <View style={styles.skipConfirmBtns}>
            <Pressable
              onPress={() => setConfirmingSkip(false)}
              disabled={checkBusy}
              style={styles.skipCancelBtn}
              accessibilityRole="button"
            >
              <Text style={styles.skipCancelText}>Hủy</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setConfirmingSkip(false);
                onSkip();
              }}
              disabled={checkBusy}
              style={[styles.skipApproveBtn, checkBusy && { opacity: 0.6 }]}
              accessibilityRole="button"
            >
              <Text style={styles.skipApproveText}>
                {isReview || skipCostXp <= 0 ? 'Đồng ý bỏ qua' : `Bỏ qua (−${skipCostXp} XP)`}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {footNote ? <Text style={styles.footNote}>{footNote}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#6EE7B7',
    borderBottomWidth: 5,
    borderBottomColor: '#34D399',
    backgroundColor: '#FFFFFF',
    padding: 15,
    gap: 11,
  },
  compactOverlayCard: {
    maxWidth: 460,
    alignSelf: 'center',
    shadowColor: '#0F172A',
    shadowOpacity: 0.24,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  cheerCard: {
    backgroundColor: '#ECFDF5',
    borderColor: '#6EE7B7',
    borderBottomColor: '#10B981',
  },
  cheerBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cheerCopy: {
    flex: 1,
    gap: 3,
  },
  cheerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#D1FAE5',
  },
  cheerBadgeText: {
    color: '#047857',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  cheerTitleText: {
    color: '#065F46',
    fontSize: 17,
    fontWeight: '900',
  },
  cheerSubtitleText: {
    color: '#047857',
    fontSize: 12,
    fontWeight: '700',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  badgeGroup: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  clockPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    backgroundColor: '#FEF3C7',
  },
  clockPillText: {
    color: '#92400E',
    fontSize: 11,
    fontWeight: '900',
  },
  reviewPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
    backgroundColor: '#E0F2FE',
  },
  reviewPillText: {
    color: '#0369A1',
    fontSize: 11,
    fontWeight: '800',
  },
  xpPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
    backgroundColor: '#D1FAE5',
  },
  xpPillText: {
    color: '#047857',
    fontSize: 11,
    fontWeight: '900',
  },
  walletPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  walletPillText: {
    color: '#78350F',
    fontSize: 11,
    fontWeight: '800',
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  missedAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEE2E2',
  },
  missedAlertText: {
    flex: 1,
    color: '#B91C1C',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  prompt: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 22,
  },
  choicesList: {
    gap: 8,
  },
  choiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderBottomWidth: 4,
    borderBottomColor: '#CBD5E1',
    backgroundColor: '#FFFDF5',
  },
  choiceCardActive: {
    borderColor: '#10B981',
    borderBottomColor: '#059669',
    backgroundColor: '#ECFDF5',
  },
  choiceLetterBadge: {
    width: 28,
    height: 28,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceLetterBadgeActive: {
    borderColor: '#059669',
    backgroundColor: '#10B981',
  },
  choiceLetterText: {
    color: '#92400E',
    fontSize: 12,
    fontWeight: '900',
  },
  choiceLetterTextActive: {
    color: '#FFFFFF',
  },
  choiceText: {
    flex: 1,
    color: '#1E293B',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
  },
  choiceTextActive: {
    color: '#065F46',
    fontWeight: '900',
  },
  textInput: {
    borderWidth: 2,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    backgroundColor: '#FFFDF5',
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  screenPickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#34D399',
    backgroundColor: '#ECFDF5',
  },
  screenPickText: {
    color: '#047857',
    fontSize: 14,
    fontWeight: '800',
  },
  uploadBox: {
    gap: 6,
    paddingVertical: 6,
  },
  uploadTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  uploadFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#10B981',
  },
  uploadLabel: {
    color: '#047857',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  hintBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    backgroundColor: '#FFFBEB',
  },
  hintBannerText: {
    flex: 1,
    color: '#92400E',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  paidHintBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
    backgroundColor: '#F0F9FF',
  },
  paidHintText: {
    flex: 1,
    color: '#0C4A6E',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 13,
    fontWeight: '800',
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  hintActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    minHeight: 44,
    paddingHorizontal: 11,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#FDE68A',
    borderBottomWidth: 4,
    borderBottomColor: '#F59E0B',
    backgroundColor: '#FEF3C7',
  },
  hintActionText: {
    color: '#92400E',
    fontSize: 12,
    fontWeight: '900',
  },
  skipActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#FECACA',
    borderBottomWidth: 4,
    borderBottomColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  skipActionText: {
    color: '#B91C1C',
    fontSize: 12,
    fontWeight: '900',
  },
  skipConfirmBox: {
    gap: 8,
    padding: 12,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },
  skipConfirmHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  skipConfirmTitle: {
    color: '#991B1B',
    fontSize: 13,
    fontWeight: '900',
  },
  skipConfirmBody: {
    color: '#7F1D1D',
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 18,
  },
  skipConfirmBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  skipCancelBtn: {
    flex: 1,
    minHeight: 38,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderBottomWidth: 3,
    borderBottomColor: '#94A3B8',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  skipCancelText: {
    color: '#334155',
    fontSize: 12.5,
    fontWeight: '800',
  },
  skipApproveBtn: {
    flex: 1.4,
    minHeight: 38,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#EF4444',
    borderBottomWidth: 3,
    borderBottomColor: '#B91C1C',
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  skipApproveText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '900',
  },
  submitBtn: {
    flex: 1,
    minWidth: 140,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: '#10B981',
    borderBottomWidth: 4,
    borderBottomColor: '#047857',
    backgroundColor: '#10B981',
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  footNote: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 2,
  },
});
