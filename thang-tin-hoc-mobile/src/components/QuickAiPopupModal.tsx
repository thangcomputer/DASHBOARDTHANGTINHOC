import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  DeviceEventEmitter,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowUp,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  DollarSign,
  FileText,
  Gamepad2,
  Headphones,
  History,
  House,
  Lock,
  Maximize2,
  MessageCircle,
  Minimize2,
  Plus,
  Radio,
  RefreshCw,
  Sparkles,
  Target,
  ThumbsDown,
  ThumbsUp,
  UserRound,
  Users,
  Volume2,
  VolumeX,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';
import { useAuth } from '../app/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import type { AppStackParamList, MainTabsParamList } from '../navigation/types';
import { navigationRef } from '../navigation/navigationRef';
import {
  AI_QUOTA_UPDATED_EVENT,
  emitAiQuotaUpdated,
  fetchAiSupportStatus,
  quickAskAi,
  reportQuickAskClientError,
  submitQuickAskFeedback,
  type AiDailyQuota,
  type QuickAiAction,
  type QuickAiAttachment,
} from '../services/aiSupportApi';
import Svg, { Circle } from 'react-native-svg';
import { MobileApiError } from '../services/apiClient';
import { OPEN_LEARNING_GOAL_EVENT } from '../services/learningGoalApi';
import {
  getMobileSoundEnabled,
  setMobileSoundEnabled,
  subscribeToMobileSoundPreference,
} from '../services/soundPreferences';
import { colors } from '../theme/tokens';
import { setMobileFocusMode, useMobileFocusMode } from '../utils/focusMode';
import { isFreePortalLocked } from '../utils/freePortalHelper';
import { triggerMobileHaptic } from './dailyPractice/useGameSounds';
import {
  isLikelyQuestion,
  mapActionPathToMobileRoute,
  matchLocalOfficeMemory,
  normalizeQuickQuery,
} from '../../../shared/ai/quickSearchMemory.mjs';
import {
  SESSION_LIST_PREVIEW,
  activateQuickAskSession,
  beginNewQuickAskSession,
  formatSessionRelativeTime,
  getQuickAskRecentScopeId,
  listQuickAskSessions,
  loadQuickAskSessionArchive,
  rememberQuickAskQuestion,
  syncQuickAskSessions,
  type QuickAskSessionArchive,
  type QuickAskSessionEntry,
} from '../utils/quickAskRecentHistory';

const MOBILE_OPEN_FREE_LOCK_MODAL_EVENT = 'mobile:open-free-lock-modal';

type CommandEntry = {
  id: string;
  label: string;
  subtitle: string;
  keywords: string;
  icon: LucideIcon;
  active?: boolean;
  locked?: boolean;
  onSelect: () => void;
};

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  question?: string;
  model?: string;
  attachment?: QuickAiAttachment;
  source?: 'memory' | 'ai' | 'fallback';
  actions?: QuickAiAction[];
  retryQuestion?: string;
  retryAttachment?: QuickAiAttachment | null;
};

const MOBILE_TEXT_EXT_RE = /\.(txt|csv|tsv|json|md|markdown|xml|html|htm|css|js|jsx|ts|tsx|py|sql|log|yml|yaml|ini|conf)$/i;
const MOBILE_PDF_EXT_RE = /\.pdf$/i;
const MOBILE_IMAGE_EXT_RE = /\.(png|jpe?g|webp|gif|bmp)$/i;
const MOBILE_OFFICE_EXT_RE = /\.(docx?|xlsx?|xlsm|pptx?|odt|ods|odp)$/i;

function formatMobileFileSize(bytes?: number) {
  const size = Number(bytes || 0);
  if (!size) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function readWebBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Không đọc được tệp đã chọn'));
    reader.readAsDataURL(blob);
  });
}

function readWebBlobAsText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Không đọc được nội dung tệp'));
    reader.readAsText(blob, 'utf-8');
  });
}

function compressWebImageDataUrl(dataUrl: string, originalMime: string, originalSize: number): Promise<{ previewUrl: string; mimeType: string }> {
  if (typeof document === 'undefined' || typeof globalThis.Image === 'undefined') {
    return Promise.resolve({ previewUrl: dataUrl, mimeType: originalMime || 'image/png' });
  }
  return new Promise((resolve) => {
    const ImgCtor = globalThis.Image;
    const img = new ImgCtor();
    img.onload = () => {
      const maxDim = 2048;
      let { width, height } = img;
      if (width <= maxDim && height <= maxDim && originalSize <= 900 * 1024) {
        resolve({ previewUrl: dataUrl, mimeType: originalMime || 'image/png' });
        return;
      }
      if (width > maxDim || height > maxDim) {
        const scale = Math.min(maxDim / width, maxDim / height);
        width = Math.max(1, Math.round(width * scale));
        height = Math.max(1, Math.round(height * scale));
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve({ previewUrl: dataUrl, mimeType: originalMime || 'image/png' });
        return;
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      const outMime = originalMime === 'image/png' && originalSize <= 600 * 1024 ? 'image/png' : 'image/jpeg';
      resolve({ previewUrl: canvas.toDataURL(outMime, 0.90), mimeType: outMime });
    };
    img.onerror = () => resolve({ previewUrl: dataUrl, mimeType: originalMime || 'image/png' });
    img.src = dataUrl;
  });
}

async function processWebBlobToAttachment(blob: Blob, rawName = 'pasted-image.png', rawMime = ''): Promise<QuickAiAttachment> {
  const name = String(rawName || 'pasted-image.png').trim();
  const mime = String(rawMime || blob.type || '').toLowerCase();
  const size = Number(blob.size || 0);

  if (mime.startsWith('image/') || MOBILE_IMAGE_EXT_RE.test(name)) {
    const rawUrl = await readWebBlobAsDataUrl(blob);
    const { previewUrl, mimeType } = await compressWebImageDataUrl(rawUrl, mime || 'image/png', size);
    const dataBase64 = previewUrl.includes(',') ? previewUrl.split(',')[1] : previewUrl;
    return { name, mimeType, dataBase64, previewUrl, isImage: true, size };
  }
  if (mime === 'application/pdf' || MOBILE_PDF_EXT_RE.test(name)) {
    if (size > 4.5 * 1024 * 1024) throw new Error('Tệp PDF quá lớn (tối đa 4.5 MB).');
    const rawUrl = await readWebBlobAsDataUrl(blob);
    const dataBase64 = rawUrl.includes(',') ? rawUrl.split(',')[1] : rawUrl;
    return { name, mimeType: 'application/pdf', dataBase64, isImage: false, size };
  }
  if (mime.startsWith('text/') || mime === 'application/json' || mime === 'application/xml' || MOBILE_TEXT_EXT_RE.test(name)) {
    if (size > 2 * 1024 * 1024) throw new Error('Tệp văn bản quá lớn (tối đa 2 MB).');
    const textContent = (await readWebBlobAsText(blob)).slice(0, 30000);
    return { name, mimeType: mime || 'text/plain', textContent, isImage: false, size };
  }
  if (MOBILE_OFFICE_EXT_RE.test(name)) {
    if (size > 4.5 * 1024 * 1024) throw new Error('Tệp Office quá lớn (tối đa 4.5 MB).');
    const rawUrl = await readWebBlobAsDataUrl(blob);
    const dataBase64 = rawUrl.includes(',') ? rawUrl.split(',')[1] : rawUrl;
    return { name, mimeType: mime || 'application/octet-stream', dataBase64, isImage: false, size };
  }
  throw new Error('Hỗ trợ ảnh (PNG, JPG, WEBP), PDF, TXT, CSV, JSON, MD hoặc tệp Office.');
}

const STARTER_PROMPTS: Record<'student' | 'teacher', string[]> = {
  student: [
    'Hàm VLOOKUP dùng thế nào?',
    'Cách tạo mục lục tự động Word',
    'Bộ phím tắt Excel hay dùng nhất',
  ],
  teacher: [
    'Hướng dẫn tạo lịch dạy cho học viên',
    'Hàm SUMIFS khác gì SUMIF?',
    'Cách dùng Slide Master nhanh',
  ],
};

function DewSkillAiOrb({ size = 54 }: { size?: number }) {
  return (
    <Image
      source={require('../../assets/dewskill-ai-icon.webp')}
      style={{ width: size, height: size }}
      resizeMode="contain"
    />
  );
}

function renderCodeOrPlain(line: string, baseKey: string, textStyle?: object): React.ReactNode[] {
  return String(line || '')
    .split(/(`[^`]+`)/g)
    .map((seg, i) => {
      if (seg.startsWith('`') && seg.endsWith('`') && seg.length > 2) {
        return (
          <Text key={`${baseKey}-c-${i}`} style={styles.mdCode}>
            {` ${seg.slice(1, -1)} `}
          </Text>
        );
      }
      return seg ? <Text key={`${baseKey}-t-${i}`} style={textStyle}>{seg}</Text> : null;
    });
}

function renderInlineSegments(line: string, baseKey: string): React.ReactNode[] {
  const parts = String(line || '').split(/(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`]+`)/g);
  return parts.map((part, idx) => {
    const key = `${baseKey}-${idx}`;
    if (!part) return null;
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <Text key={key} style={styles.mdBold}>
          {renderCodeOrPlain(part.slice(2, -2), key, styles.mdBold)}
        </Text>
      );
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return (
        <Text key={key} style={styles.mdItalic}>
          {renderCodeOrPlain(part.slice(1, -1), key, styles.mdItalic)}
        </Text>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <Text key={key} style={styles.mdCode}>
          {` ${part.slice(1, -1)} `}
        </Text>
      );
    }
    return <Text key={key}>{part}</Text>;
  });
}

type MobileMdBlock =
  | { type: 'code'; content: string }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'line'; text: string };

function isMobileTableSeparator(line: string): boolean {
  return /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?$/.test(String(line || '').trim());
}

function parseMobileTableRow(line: string): string[] {
  return String(line || '')
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

function parseMobileMarkdownBlocks(rawText: string): MobileMdBlock[] {
  const lines = String(rawText || '').split('\n');
  const blocks: MobileMdBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed.startsWith('```')) {
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1;
      blocks.push({ type: 'code', content: codeLines.join('\n') });
      continue;
    }
    if (trimmed.includes('|') && i + 1 < lines.length && isMobileTableSeparator(lines[i + 1])) {
      const headers = parseMobileTableRow(trimmed);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length) {
        const rowTrim = lines[i].trim();
        if (!rowTrim || !rowTrim.includes('|')) break;
        rows.push(parseMobileTableRow(rowTrim));
        i += 1;
      }
      blocks.push({ type: 'table', headers, rows });
      continue;
    }
    blocks.push({ type: 'line', text: line });
    i += 1;
  }
  return blocks;
}

function AiMarkdownBlock({ text }: { text: string }) {
  const blocks = useMemo(() => parseMobileMarkdownBlocks(text), [text]);
  return (
    <View style={styles.mdWrap}>
      {blocks.map((block, idx) => {
        if (block.type === 'code') {
          return (
            <ScrollView
              key={`code-${idx}`}
              horizontal
              showsHorizontalScrollIndicator
              style={styles.mdCodeBlock}
            >
              <Text style={styles.mdCodeBlockText}>{block.content}</Text>
            </ScrollView>
          );
        }
        if (block.type === 'table') {
          return (
            <ScrollView
              key={`tbl-${idx}`}
              horizontal
              showsHorizontalScrollIndicator
              style={styles.mdTableScroll}
            >
              <View style={styles.mdTable}>
                <View style={styles.mdTableHeaderRow}>
                  {block.headers.map((h, hIdx) => (
                    <View key={`th-${hIdx}`} style={styles.mdTableCell}>
                      <Text style={styles.mdTableHeaderText}>{renderInlineSegments(h, `th-${idx}-${hIdx}`)}</Text>
                    </View>
                  ))}
                </View>
                {block.rows.map((row, rIdx) => (
                  <View key={`tr-${rIdx}`} style={[styles.mdTableRow, rIdx % 2 === 1 && styles.mdTableRowAlt]}>
                    {block.headers.map((_, cIdx) => (
                      <View key={`td-${cIdx}`} style={styles.mdTableCell}>
                        <Text style={styles.mdTableCellText}>
                          {renderInlineSegments(row[cIdx] || '', `td-${idx}-${rIdx}-${cIdx}`)}
                        </Text>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            </ScrollView>
          );
        }

        const trimmed = block.text.trim();
        if (!trimmed) {
          return <View key={`sp-${idx}`} style={styles.mdSpacer} />;
        }
        const headingMatch = /^#{1,4}\s+(.+)$/.exec(trimmed);
        if (headingMatch) {
          return (
            <Text key={`hd-${idx}`} style={styles.mdHeading}>
              {renderInlineSegments(headingMatch[1], `hd-${idx}`)}
            </Text>
          );
        }
        const bulletMatch = /^[-•*]\s+(.+)$/.exec(trimmed);
        if (bulletMatch) {
          return (
            <View key={`bl-${idx}`} style={styles.mdBulletRow}>
              <Text style={styles.mdBulletDot}>•</Text>
              <Text style={styles.mdParagraph}>{renderInlineSegments(bulletMatch[1], `bl-${idx}`)}</Text>
            </View>
          );
        }
        const numberedMatch = /^(\d+)\.\s+(.+)$/.exec(trimmed);
        if (numberedMatch) {
          return (
            <View key={`nm-${idx}`} style={styles.mdNumberRow}>
              <View style={styles.mdNumberBadge}>
                <Text style={styles.mdNumberBadgeText}>{numberedMatch[1]}</Text>
              </View>
              <Text style={styles.mdParagraph}>{renderInlineSegments(numberedMatch[2], `nm-${idx}`)}</Text>
            </View>
          );
        }
        return (
          <Text key={`p-${idx}`} style={styles.mdParagraph}>
            {renderInlineSegments(trimmed, `p-${idx}`)}
          </Text>
        );
      })}
    </View>
  );
}

function MobileQuickAiFeedbackBar({
  msg,
  language,
  onExpandReasonBox,
}: {
  msg: ChatMessage;
  language: string;
  onExpandReasonBox?: () => void;
}) {
  const [submittedRating, setSubmittedRating] = useState<'helpful' | 'inaccurate' | null>(null);
  const [showReasonBox, setShowReasonBox] = useState(false);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [errorText, setErrorText] = useState('');
  const [lastAttempt, setLastAttempt] = useState<{ rating: 'helpful' | 'inaccurate'; comment: string } | null>(null);
  const isEn = language === 'en';

  const sendFeedback = useCallback(async (rating: 'helpful' | 'inaccurate', commentText = '') => {
    if (submitting) return;
    if (submittedRating === rating && rating === 'helpful' && !errorText) return;
    triggerMobileHaptic('light');
    setSubmitting(true);
    setErrorText('');
    setLastAttempt({ rating, comment: commentText });
    try {
      const resp = await submitQuickAskFeedback({
        responseId: msg.id,
        rating,
        comment: commentText,
        question: msg.question || '',
        answer: msg.text || '',
        source: msg.source || 'ai',
        model: msg.model || '',
      });
      setSubmittedRating(rating);
      setShowReasonBox(false);
      if (resp?.deduplicated && !resp?.updated) {
        setStatusText(isEn ? 'Feedback already recorded.' : 'Bạn đã đánh giá câu trả lời này rồi.');
      } else if (rating === 'inaccurate') {
        setStatusText(isEn ? 'Sent for Admin review. Thank you!' : 'Đã gửi góp ý để Admin kiểm tra!');
      } else {
        setStatusText(isEn ? 'Thanks for your feedback!' : 'Cảm ơn bạn đã đánh giá hữu ích!');
      }
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : (isEn ? 'Failed to submit feedback.' : 'Chưa gửi được phản hồi.'));
    } finally {
      setSubmitting(false);
    }
  }, [errorText, isEn, msg.id, msg.model, msg.question, msg.source, msg.text, submittedRating, submitting]);

  return (
    <View style={styles.fbWrap}>
      <View style={styles.fbBtnRow}>
        <Pressable
          disabled={submitting || (submittedRating === 'helpful' && !errorText)}
          onPress={() => {
            setShowReasonBox(false);
            void sendFeedback('helpful', '');
          }}
          style={({ pressed }) => [
            styles.fbPillBtn,
            submittedRating === 'helpful' && styles.fbPillBtnHelpfulActive,
            pressed && styles.rowPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={isEn ? 'Helpful' : 'Hữu ích'}
        >
          <ThumbsUp size={11} color={submittedRating === 'helpful' ? '#047857' : '#475569'} />
          <Text style={[styles.fbPillText, submittedRating === 'helpful' && styles.fbPillTextHelpfulActive]}>
            {isEn ? 'Helpful' : 'Hữu ích'}
          </Text>
        </Pressable>

        <Pressable
          disabled={submitting}
          onPress={() => {
            setErrorText('');
            setShowReasonBox((prev) => {
              const next = !prev;
              if (next) onExpandReasonBox?.();
              return next;
            });
          }}
          style={({ pressed }) => [
            styles.fbPillBtn,
            (submittedRating === 'inaccurate' || showReasonBox) && styles.fbPillBtnInaccurateActive,
            pressed && styles.rowPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={isEn ? 'Inaccurate' : 'Chưa chính xác'}
        >
          <ThumbsDown size={11} color={(submittedRating === 'inaccurate' || showReasonBox) ? '#BE123C' : '#475569'} />
          <Text style={[styles.fbPillText, (submittedRating === 'inaccurate' || showReasonBox) && styles.fbPillTextInaccurateActive]}>
            {isEn ? 'Inaccurate' : 'Chưa chính xác'}
          </Text>
        </Pressable>

        {submitting ? <ActivityIndicator size="small" color="#059669" /> : null}
      </View>

      {!submitting && statusText && !errorText ? (
        <Text style={styles.fbStatusSuccess}>{statusText}</Text>
      ) : null}

      {showReasonBox ? (
        <View style={styles.fbReasonBox}>
          <TextInput
            value={reason}
            onChangeText={setReason}
            maxLength={300}
            placeholder={isEn ? 'Short reason (optional)…' : 'Lý do ngắn (tùy chọn, VD: sai phiên bản Office)…'}
            placeholderTextColor="#94A3B8"
            style={styles.fbReasonInput}
            returnKeyType="send"
            onSubmitEditing={() => void sendFeedback('inaccurate', reason.trim())}
          />
          <View style={styles.fbReasonActions}>
            <Pressable
              disabled={submitting}
              onPress={() => void sendFeedback('inaccurate', reason.trim())}
              style={({ pressed }) => [styles.fbSendBtn, pressed && styles.rowPressed]}
              accessibilityRole="button"
            >
              <Text style={styles.fbSendBtnText}>{isEn ? 'Send' : 'Gửi'}</Text>
            </Pressable>
            <Pressable
              disabled={submitting}
              onPress={() => setShowReasonBox(false)}
              style={({ pressed }) => [styles.fbCancelBtn, pressed && styles.rowPressed]}
              accessibilityRole="button"
            >
              <Text style={styles.fbCancelBtnText}>{isEn ? 'Cancel' : 'Hủy'}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {errorText ? (
        <View style={styles.fbErrorRow}>
          <Text style={styles.fbErrorText}>{errorText}</Text>
          {lastAttempt ? (
            <Pressable
              onPress={() => void sendFeedback(lastAttempt.rating, lastAttempt.comment)}
              style={({ pressed }) => [styles.fbRetryLink, pressed && styles.rowPressed]}
              accessibilityRole="button"
            >
              <RefreshCw size={10} color="#BE123C" />
              <Text style={styles.fbRetryText}>{isEn ? 'Retry' : 'Thử gửi lại'}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export function QuickAiPopupModal({
  onClose,
  role,
  freeMenu,
}: {
  onClose: () => void;
  role: 'student' | 'teacher';
  freeMenu: boolean;
}) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const isEn = language === 'en';
  const insets = useSafeAreaInsets();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const { focusMode } = useMobileFocusMode();

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [asking, setAsking] = useState(false);
  const [attachment, setAttachment] = useState<QuickAiAttachment | null>(null);
  const [attachError, setAttachError] = useState('');
  const [sessionArchive, setSessionArchive] = useState<QuickAskSessionArchive>({ activeSessionId: '', sessions: [] });
  const [activeSessionId, setActiveSessionId] = useState('');
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [aiDailyQuota, setAiDailyQuota] = useState<AiDailyQuota | null>(null);

  const inputRef = useRef<React.ComponentRef<typeof TextInput> | null>(null);
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView> | null>(null);
  const activeSessionIdRef = useRef('');

  const recentScopeId = useMemo(
    () => getQuickAskRecentScopeId(user, role),
    [user, role],
  );

  useEffect(() => {
    let active = true;
    void loadQuickAskSessionArchive(recentScopeId).then((archive) => {
      if (active) setSessionArchive(archive);
    });
    return () => { active = false; };
  }, [recentScopeId]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(
      AI_QUOTA_UPDATED_EVENT,
      (patch: (Partial<AiDailyQuota> & { _origin?: string }) | undefined) => {
        if (!patch || patch._origin === 'quick_modal') return;
        if (!patch.questionQuota && !patch.imageQuota) return;
        setAiDailyQuota((prev) => ({
          ...(prev || {}),
          ...(patch.questionQuota ? { questionQuota: patch.questionQuota } : {}),
          ...(patch.imageQuota ? { imageQuota: patch.imageQuota } : {}),
        }));
      },
    );
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (role !== 'student' && role !== 'teacher') return undefined;
    let active = true;
    void fetchAiSupportStatus()
      .then((res) => {
        if (active && res?.dailyQuota) {
          setAiDailyQuota(res.dailyQuota);
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, [role, recentScopeId]);

  const freeLocked = role === 'student' && isFreePortalLocked(user);
  const isFreeTierStudent = role === 'student' && freeLocked;
  const questionQuotaApplies = Boolean(
    aiDailyQuota?.questionQuota?.applies ?? (role === 'student' || role === 'teacher'),
  );
  const rawPercentLeft = aiDailyQuota?.questionQuota?.percentLeft ?? aiDailyQuota?.questionQuota?.remaining;
  const questionQuotaLeft = rawPercentLeft != null
    ? Math.max(0, Math.min(100, Number(rawPercentLeft)))
    : 100;
  const questionQuotaBlocked = questionQuotaApplies && !(questionQuotaLeft > 0);
  const rawImageLimit = aiDailyQuota?.imageQuota?.limit;
  const imageQuotaLimit = rawImageLimit !== null
    && rawImageLimit !== undefined
    && Number.isFinite(Number(rawImageLimit))
    ? Number(rawImageLimit)
    : (isFreeTierStudent ? 0 : 100);
  const imageUploadDisallowed = Boolean(
    role === 'student'
    && (aiDailyQuota?.imageQuota
      ? (aiDailyQuota.imageQuota.allowed === false || imageQuotaLimit === 0)
      : isFreeTierStudent),
  );
  const rawImgPercentLeft = aiDailyQuota?.imageQuota?.percentLeft ?? aiDailyQuota?.imageQuota?.remaining;
  const imageQuotaLeft = rawImgPercentLeft != null
    ? Math.max(0, Math.min(100, Number(rawImgPercentLeft)))
    : (imageUploadDisallowed ? 0 : questionQuotaLeft);
  const isVisionAttachment = Boolean(attachment?.isImage || attachment?.mimeType === 'application/pdf');
  const imageQuotaBlocked = Boolean(
    isVisionAttachment
    && (imageUploadDisallowed || (aiDailyQuota?.imageQuota && !(imageQuotaLeft > 0))),
  );
  const resetCountdownText = useMemo(() => {
    let ms = Number(aiDailyQuota?.questionQuota?.resetInMs);
    const resetsAt = aiDailyQuota?.questionQuota?.resetsAt;
    if (!Number.isFinite(ms) && resetsAt) {
      ms = new Date(resetsAt).getTime() - Date.now();
    }
    if (!Number.isFinite(ms)) {
      const vnNow = Date.now() + 7 * 60 * 60 * 1000;
      const dayMs = 24 * 60 * 60 * 1000;
      const elapsed = ((vnNow % dayMs) + dayMs) % dayMs;
      ms = Math.max(60 * 1000, dayMs - elapsed);
    }
    const totalMins = Math.max(1, Math.ceil(Math.max(60 * 1000, ms) / 60000));
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    if (isEn) {
      return h > 0 && m > 0 ? `${h}h ${m}m` : (h > 0 ? `${h}h` : `${m}m`);
    }
    return h > 0 && m > 0 ? `${h}h ${m}p` : (h > 0 ? `${h}h` : `${m}p`);
  }, [aiDailyQuota?.questionQuota?.resetInMs, aiDailyQuota?.questionQuota?.resetsAt, isEn]);
  const freeStudentImageBlockMsg = isEn
    ? 'Free accounts do not support sending images to DewSkill AI. Ask by text or upgrade your plan.'
    : 'Tài khoản miễn phí không hỗ trợ gửi hình ảnh cho DewSkill AI. Bạn có thể hỏi bằng chữ hoặc nâng cấp gói.';
  const isWideWeb = Platform.OS === 'web' && windowWidth >= 640;
  const sheetMaxHeight = Math.round(windowHeight * (isWideWeb ? 0.86 : 0.92));

  useEffect(() => {
    let active = true;
    getMobileSoundEnabled()
      .then((enabled) => { if (active) setSoundEnabled(enabled); })
      .catch(() => {});
    const unsub = subscribeToMobileSoundPreference((enabled) => setSoundEnabled(enabled));
    return () => {
      active = false;
      unsub();
    };
  }, []);

  useEffect(() => {
    if (messages.length || asking) {
      const timer = setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 60);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [messages.length, asking]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
    const onWindowPaste = (e: Event) => {
      const clip = (e as ClipboardEvent).clipboardData;
      if (!clip) return;
      let file: File | null = null;
      if (clip.items && clip.items.length) {
        for (let i = 0; i < clip.items.length; i += 1) {
          const item = clip.items[i];
          if (item.kind === 'file') {
            const candidate = item.getAsFile?.();
            if (candidate) {
              file = candidate;
              break;
            }
          }
        }
      }
      if (!file && clip.files && clip.files.length) {
        file = clip.files[0];
      }
      if (!file) return;
      e.preventDefault();
      setAttachError('');
      const pasteName = String(file.name || '').trim();
      const pasteMime = String(file.type || '').toLowerCase();
      const isPasteVision = pasteMime.startsWith('image/')
        || MOBILE_IMAGE_EXT_RE.test(pasteName)
        || pasteMime === 'application/pdf'
        || MOBILE_PDF_EXT_RE.test(pasteName);
      if (imageUploadDisallowed && isPasteVision) {
        setAttachError(freeStudentImageBlockMsg);
        return;
      }
      void processWebBlobToAttachment(file, file.name || 'pasted-image.png', file.type || 'image/png')
        .then((att) => {
          setAttachment(att);
          setTimeout(() => inputRef.current?.focus(), 30);
        })
        .catch((err) => {
          setAttachError(err instanceof Error ? err.message : 'Không đọc được ảnh/tệp đã dán');
        });
    };
    window.addEventListener('paste', onWindowPaste);
    return () => window.removeEventListener('paste', onWindowPaste);
  }, [freeStudentImageBlockMsg, imageUploadDisallowed]);

  const navigateTab = useCallback((screen: keyof MainTabsParamList, locked = false) => {
    triggerMobileHaptic('light');
    onClose();
    if (locked) {
      DeviceEventEmitter.emit(MOBILE_OPEN_FREE_LOCK_MODAL_EVENT);
      return;
    }
    navigationRef.navigate('MainTabs', { screen });
  }, [onClose]);

  const navigateActionPath = useCallback((actionPath: string) => {
    const mapped = mapActionPathToMobileRoute(actionPath, role);
    if (!mapped) return;
    triggerMobileHaptic('light');
    onClose();
    if (mapped.tab) {
      const targetTab = mapped.tab as keyof MainTabsParamList;
      if (freeLocked && (targetTab === 'Messages' || targetTab === 'Feed')) {
        DeviceEventEmitter.emit(MOBILE_OPEN_FREE_LOCK_MODAL_EVENT);
        return;
      }
      navigationRef.navigate('MainTabs', { screen: targetTab });
    } else if (mapped.stack) {
      const targetStack = mapped.stack as keyof AppStackParamList;
      if (freeLocked && (targetStack === 'Assignments' || targetStack === 'Materials' || targetStack === 'StudentExam' || targetStack === 'Support')) {
        DeviceEventEmitter.emit(MOBILE_OPEN_FREE_LOCK_MODAL_EVENT);
        return;
      }
      navigationRef.navigate(targetStack as never);
    }
  }, [freeLocked, onClose, role]);

  const quickActions: CommandEntry[] = useMemo(() => [
    {
      id: 'act-sound',
      label: soundEnabled ? 'Tắt âm thanh hiệu ứng' : 'Bật âm thanh hiệu ứng',
      subtitle: soundEnabled ? 'Đang bật âm thanh & rung phản hồi' : 'Đang tắt âm thanh & rung',
      keywords: 'am thanh sound mute loa rung haptic',
      icon: soundEnabled ? Volume2 : VolumeX,
      active: soundEnabled,
      onSelect: () => {
        const next = !soundEnabled;
        if (next) triggerMobileHaptic('light');
        void setMobileSoundEnabled(next).then(() => setSoundEnabled(next)).catch(() => {});
      },
    },
    {
      id: 'act-focus',
      label: focusMode ? 'Thoát chế độ tập trung' : 'Bật chế độ tập trung',
      subtitle: focusMode ? 'Hiện lại thanh điều hướng & hỗ trợ' : 'Ẩn thanh điều hướng & nút nổi khi học',
      keywords: 'che do tap trung focus mode an thanh dieu huong',
      icon: focusMode ? Minimize2 : Maximize2,
      active: focusMode,
      onSelect: () => {
        triggerMobileHaptic('light');
        setMobileFocusMode(!focusMode);
        onClose();
      },
    },
    ...(role === 'student' ? [{
      id: 'act-goal',
      label: 'Đặt mục tiêu học tập',
      subtitle: 'Cài đặt số giờ học mỗi ngày',
      keywords: 'muc tieu hoc tap goal streak gio hoc',
      icon: Target,
      onSelect: () => {
        triggerMobileHaptic('light');
        onClose();
        DeviceEventEmitter.emit(OPEN_LEARNING_GOAL_EVENT);
      },
    }] : []),
  ], [focusMode, onClose, role, soundEnabled]);

  const destinations: CommandEntry[] = useMemo(() => (
    role === 'teacher'
      ? [
        { id: 'nav-home', label: 'Tổng quan', subtitle: 'Bảng điều khiển giảng viên', keywords: 'tong quan home dashboard', icon: House, onSelect: () => navigateTab('Home') },
        { id: 'nav-schedule', label: 'Lịch dạy & điểm danh', subtitle: 'Xem ca dạy hôm nay', keywords: 'lich day diem danh schedule', icon: CalendarDays, onSelect: () => navigateTab('Schedule') },
        { id: 'nav-messages', label: 'Hộp thư', subtitle: 'Nhắn tin với học viên', keywords: 'hop thu tin nhan chat messages', icon: MessageCircle, onSelect: () => navigateTab('Messages') },
        { id: 'nav-feed', label: 'Bảng tin', subtitle: 'Thông báo & bài đăng trung tâm', keywords: 'bang tin feed', icon: Radio, onSelect: () => navigateTab('Feed') },
        { id: 'nav-finance', label: 'Tài chính', subtitle: 'Thu nhập & đối soát', keywords: 'tai chinh luong finance', icon: DollarSign, onSelect: () => navigateTab('Finance') },
        {
          id: 'nav-students',
          label: 'Quản lý học viên',
          subtitle: 'Danh sách lớp & học viên',
          keywords: 'hoc vien lop students',
          icon: Users,
          onSelect: () => {
            triggerMobileHaptic('light');
            onClose();
            navigationRef.navigate('Students');
          },
        },
        { id: 'nav-support', label: 'Hỗ trợ', subtitle: 'Trợ giúp & tài liệu giảng viên', keywords: 'ho tro support', icon: Headphones, onSelect: () => navigateTab('Support') },
        { id: 'nav-profile', label: 'Hồ sơ cá nhân', subtitle: 'Thông tin & cài đặt', keywords: 'ho so profile cai dat', icon: UserRound, onSelect: () => navigateTab('Profile') },
      ]
      : [
        { id: 'nav-home', label: 'Tổng quan', subtitle: 'Tiến độ & lịch học hôm nay', keywords: 'tong quan home dashboard', icon: House, onSelect: () => navigateTab('Home') },
        { id: 'nav-dp', label: 'Luyện tập hằng ngày', subtitle: 'Lộ trình XP & câu hỏi ngắn', keywords: 'luyen tap daily practice xp lo trinh', icon: Gamepad2, onSelect: () => navigateTab('DailyPractice') },
        ...(!freeMenu ? [
          { id: 'nav-videos', label: 'Bài giảng', subtitle: 'Video & thực hành bài học', keywords: 'bai giang video thuc hanh course', icon: BookOpen, onSelect: () => navigateTab('DailyPractice') },
          { id: 'nav-schedule', label: 'Lịch học', subtitle: 'Lịch học trực tuyến qua Meet', keywords: 'lich hoc meet schedule', icon: CalendarDays, onSelect: () => navigateTab('Schedule') },
        ] : []),
        { id: 'nav-messages', label: 'Hộp thư', subtitle: 'Trao đổi với giảng viên', keywords: 'hop thu tin nhan chat messages', icon: MessageCircle, locked: freeLocked, onSelect: () => navigateTab('Messages', freeLocked) },
        { id: 'nav-feed', label: 'Bảng tin', subtitle: 'Cộng đồng & thông báo mới', keywords: 'bang tin feed', icon: Radio, locked: freeLocked, onSelect: () => navigateTab('Feed', freeLocked) },
        {
          id: 'nav-support',
          label: 'Hỗ trợ',
          subtitle: 'Liên hệ & giải đáp thắc mắc',
          keywords: 'ho tro support',
          icon: Headphones,
          locked: freeLocked,
          onSelect: () => {
            triggerMobileHaptic('light');
            onClose();
            if (freeLocked) {
              DeviceEventEmitter.emit(MOBILE_OPEN_FREE_LOCK_MODAL_EVENT);
              return;
            }
            navigationRef.navigate('Support');
          },
        },
        { id: 'nav-profile', label: 'Hồ sơ cá nhân', subtitle: 'Tài khoản & khóa thiết bị', keywords: 'ho so profile cai dat', icon: UserRound, onSelect: () => navigateTab('Profile') },
      ]
  ), [freeLocked, freeMenu, navigateTab, onClose, role]);

  const normalizedQuery = normalizeQuickQuery(query);
  const matchesEntry = (entry: CommandEntry) => {
    if (!normalizedQuery) return true;
    return normalizeQuickQuery(`${entry.label} ${entry.subtitle} ${entry.keywords}`).includes(normalizedQuery);
  };
  const filteredActions = quickActions.filter(matchesEntry);
  const filteredDestinations = destinations.filter(matchesEntry);
  const firstMatch = filteredDestinations[0] || filteredActions[0] || null;
  const trimmedQuery = query.trim();
  const isChatMode = messages.length > 0 || asking;
  const canSend = Boolean(trimmedQuery || attachment) && !asking && !questionQuotaBlocked && !imageQuotaBlocked;
  const starterList = STARTER_PROMPTS[role === 'teacher' ? 'teacher' : 'student'];
  const sessionList = useMemo(
    () => listQuickAskSessions(sessionArchive, {
      includeAll: showAllHistory,
      previewLimit: SESSION_LIST_PREVIEW,
    }) as {
      items: QuickAskSessionEntry[];
      totalCount: number;
      hiddenCount: number;
      hasMore: boolean;
    },
    [sessionArchive, showAllHistory],
  );
  const visibleDestinations = useMemo(
    () => (trimmedQuery ? filteredDestinations : destinations.slice(0, 3)),
    [destinations, filteredDestinations, trimmedQuery],
  );

  const handlePickAttachment = useCallback(async () => {
    triggerMobileHaptic('light');
    setAttachError('');
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: imageUploadDisallowed
          ? ['text/*', 'application/json', 'application/xml']
          : ['image/*', 'application/pdf', 'text/*', '*/*'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      const fileName = String(asset.name || 'file').trim();
      const mime = String(asset.mimeType || '').toLowerCase();
      const isVisionPick = mime.startsWith('image/')
        || MOBILE_IMAGE_EXT_RE.test(fileName)
        || mime === 'application/pdf'
        || MOBILE_PDF_EXT_RE.test(fileName);
      if (imageUploadDisallowed && isVisionPick) {
        setAttachError(freeStudentImageBlockMsg);
        return;
      }

      if (Platform.OS === 'web') {
        const webFile = (asset as { file?: File }).file;
        const blob: Blob = webFile || await (await fetch(asset.uri)).blob();
        const att = await processWebBlobToAttachment(blob, fileName, mime || blob.type || '');
        setAttachment(att);
        setTimeout(() => inputRef.current?.focus(), 40);
        return;
      }

      const info = asset.size == null
        ? await FileSystem.getInfoAsync(asset.uri)
        : { exists: true, size: asset.size };
      const size = info.exists && 'size' in info && typeof info.size === 'number' ? info.size : Number(asset.size || 0);

      if (mime.startsWith('image/') || MOBILE_IMAGE_EXT_RE.test(fileName)) {
        if (size > 4.5 * 1024 * 1024) {
          throw new Error('Ảnh quá lớn (tối đa 4.5 MB).');
        }
        const dataBase64 = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        setAttachment({
          name: fileName,
          mimeType: mime || 'image/jpeg',
          dataBase64,
          previewUrl: asset.uri,
          isImage: true,
          size,
        });
        return;
      }

      if (mime === 'application/pdf' || MOBILE_PDF_EXT_RE.test(fileName)) {
        if (size > 4.5 * 1024 * 1024) {
          throw new Error('Tệp PDF quá lớn (tối đa 4.5 MB).');
        }
        const dataBase64 = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        setAttachment({
          name: fileName,
          mimeType: 'application/pdf',
          dataBase64,
          isImage: false,
          size,
        });
        return;
      }

      if (mime.startsWith('text/') || mime === 'application/json' || mime === 'application/xml' || MOBILE_TEXT_EXT_RE.test(fileName)) {
        if (size > 2 * 1024 * 1024) {
          throw new Error('Tệp văn bản quá lớn (tối đa 2 MB).');
        }
        const textContent = (await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.UTF8,
        })).slice(0, 30000);
        setAttachment({
          name: fileName,
          mimeType: mime || 'text/plain',
          textContent,
          isImage: false,
          size,
        });
        return;
      }

      if (MOBILE_OFFICE_EXT_RE.test(fileName)) {
        if (size > 4.5 * 1024 * 1024) {
          throw new Error('Tệp Office quá lớn (tối đa 4.5 MB).');
        }
        const dataBase64 = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        setAttachment({
          name: fileName,
          mimeType: mime || 'application/octet-stream',
          dataBase64,
          isImage: false,
          size,
        });
        return;
      }

      throw new Error('Hỗ trợ ảnh (PNG, JPG, WEBP), PDF, TXT, CSV, JSON, MD hoặc tệp Office.');
    } catch (err) {
      setAttachError(err instanceof Error ? err.message : 'Không đọc được tệp đã chọn');
    }
  }, [freeStudentImageBlockMsg, imageUploadDisallowed]);

  const askAiQuestion = useCallback(async (rawQuestion: string, rawAttachment: QuickAiAttachment | null = attachment) => {
    const question = String(rawQuestion || '').trim();
    const activeAttachment = rawAttachment || null;
    if ((!question && !activeAttachment) || asking) return;
    if (questionQuotaBlocked) {
      setAttachError(
        isEn
          ? 'You have used 100% of your daily AI quota (0% left) — resets at 00:00.'
          : 'Bạn đã dùng hết 100% hạn mức AI hôm nay (còn 0%) — tự động reset lúc 00:00.',
      );
      return;
    }
    const activeIsVision = Boolean(activeAttachment?.isImage || activeAttachment?.mimeType === 'application/pdf');
    if (activeIsVision && (imageUploadDisallowed || (aiDailyQuota?.imageQuota && !(imageQuotaLeft > 0)))) {
      setAttachError(
        imageUploadDisallowed
          ? freeStudentImageBlockMsg
          : (isEn
            ? 'You have used 100% of your daily AI quota (0% left) — resets at 00:00.'
            : 'Bạn đã dùng hết 100% hạn mức AI hôm nay (còn 0%) — tự động reset lúc 00:00.'),
      );
      return;
    }
    triggerMobileHaptic('light');

    const isNewThread = messages.length === 0;
    let targetSessionId = activeSessionIdRef.current || activeSessionId;
    if (!targetSessionId) {
      const rotated = await beginNewQuickAskSession(recentScopeId);
      targetSessionId = rotated.activeSessionId;
      activeSessionIdRef.current = targetSessionId;
      setActiveSessionId(targetSessionId);
      setSessionArchive(rotated);
    }

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      text: question,
      ...(activeAttachment ? { attachment: activeAttachment } : {}),
    };
    const prior = messages.slice(-8).map((m) => ({
      role: m.role,
      text: m.text || (m.attachment?.name ? `[Đính kèm: ${m.attachment.name}]` : ''),
    }));
    const nextWithUser = [...messages, userMsg];
    setMessages(nextWithUser);
    void syncQuickAskSessions(recentScopeId, nextWithUser, targetSessionId).then(setSessionArchive);
    setQuery('');
    setAttachment(null);
    setAttachError('');
    setAsking(true);

    const touchRecentQuestion = (q: string) => {
      if (!isNewThread) return;
      const text = String(q || '').trim();
      if (!text) return;
      void rememberQuickAskQuestion(recentScopeId, text);
    };

    let failedErrorType: 'timeout' | 'network' | 'other' | null = null;
    try {
      const result = await quickAskAi({
        question,
        history: prior,
        preferredLang: language,
        attachment: activeAttachment,
      });
      if (result.questionQuota || result.imageQuota) {
        setAiDailyQuota((prev) => {
          const next = {
            questionQuota: result.questionQuota ?? prev?.questionQuota,
            imageQuota: result.imageQuota ?? prev?.imageQuota,
          };
          emitAiQuotaUpdated({ ...next, _origin: 'quick_modal' });
          return next;
        });
      }
      if (result.answer) {
        touchRecentQuestion(question);
        const replyMsg: ChatMessage = {
          id: `a_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          role: 'assistant',
          text: result.answer,
          question,
          model: result.model || '',
          source: result.source,
          actions: result.actions,
        };
        const nextWithReply = [...nextWithUser, replyMsg];
        setMessages(nextWithReply);
        void syncQuickAskSessions(recentScopeId, nextWithReply, targetSessionId).then(setSessionArchive);
        return;
      }
    } catch (err) {
      if (err instanceof MobileApiError && (err.code === 'AI_QUESTION_QUOTA' || err.code === 'AI_IMAGE_QUOTA')) {
        setMessages(messages);
        if (messages.length > 0) {
          void syncQuickAskSessions(recentScopeId, messages, targetSessionId).then(setSessionArchive);
        } else {
          void loadQuickAskSessionArchive(recentScopeId).then(setSessionArchive);
        }
        setQuery(question);
        if (activeAttachment && err.code === 'AI_QUESTION_QUOTA') {
          setAttachment(activeAttachment);
        }
        setAttachError(err.message);
        const errCode = err.code;
        setAiDailyQuota((prev) => {
          const base = prev || {};
          const updated: AiDailyQuota = errCode === 'AI_QUESTION_QUOTA'
            ? {
              ...base,
              questionQuota: {
                ...(base.questionQuota || {}),
                applies: true,
                mode: 'percent' as const,
                limit: 100,
                remaining: 0,
                percentLeft: 0,
                used: 100,
                percentUsed: 100,
              },
            }
            : (() => {
              const rawLim = base.imageQuota?.limit;
              const imgLim = rawLim !== null && rawLim !== undefined && Number.isFinite(Number(rawLim))
                ? Number(rawLim)
                : (isFreeTierStudent ? 0 : 100);
              return {
                ...base,
                imageQuota: {
                  ...(base.imageQuota || {}),
                  applies: true,
                  mode: 'percent' as const,
                  allowed: base.imageQuota?.allowed !== undefined ? base.imageQuota.allowed : imgLim > 0,
                  limit: imgLim,
                  remaining: 0,
                  percentLeft: 0,
                  used: 100,
                  percentUsed: 100,
                },
              };
            })();
          emitAiQuotaUpdated({ ...updated, _origin: 'quick_modal' });
          return updated;
        });
        void fetchAiSupportStatus()
          .then((st) => {
            if (st?.dailyQuota) {
              setAiDailyQuota(st.dailyQuota);
              emitAiQuotaUpdated({ ...st.dailyQuota, _origin: 'quick_modal' });
            }
          })
          .catch(() => {});
        return;
      }
      const errMsg = err instanceof Error ? err.message.toLowerCase() : '';
      failedErrorType = /timeout|abort/.test(errMsg) ? 'timeout' : 'network';
      void reportQuickAskClientError(failedErrorType);
    } finally {
      setAsking(false);
    }

    const localHit = question ? matchLocalOfficeMemory(question, language) : null;
    if (localHit) touchRecentQuestion(question);
    const fallbackMsg: ChatMessage = localHit
      ? {
        id: `a_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        role: 'assistant',
        text: localHit.answer,
        question,
        model: '',
        source: 'memory',
        actions: [],
      }
      : {
        id: `a_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        role: 'assistant',
        text: failedErrorType === 'timeout'
          ? (language === 'en'
            ? 'Request to DewSkill AI timed out. Please try again.'
            : 'Yêu cầu tới DewSkill AI quá thời gian chờ. Bạn bấm thử lại nhé.')
          : (language === 'en'
            ? 'Unable to connect to DewSkill AI right now. Please check your connection and try again.'
            : 'Chưa kết nối được DewSkill AI lúc này. Bạn kiểm tra mạng rồi thử lại nhé.'),
        question,
        source: 'fallback',
        retryQuestion: question,
        retryAttachment: activeAttachment,
        actions: [],
      };
    const nextWithFallback = [...nextWithUser, fallbackMsg];
    setMessages(nextWithFallback);
    void syncQuickAskSessions(recentScopeId, nextWithFallback, targetSessionId).then(setSessionArchive);
  }, [
    activeSessionId,
    aiDailyQuota,
    asking,
    attachment,
    freeStudentImageBlockMsg,
    imageQuotaLeft,
    imageUploadDisallowed,
    isEn,
    isFreeTierStudent,
    language,
    messages,
    questionQuotaBlocked,
    recentScopeId,
  ]);

  const handleSubmit = () => {
    if (!trimmedQuery && !attachment) return;
    if (attachment || isChatMode || (!firstMatch && trimmedQuery) || isLikelyQuestion(trimmedQuery)) {
      void askAiQuestion(trimmedQuery, attachment);
    } else if (firstMatch) {
      firstMatch.onSelect();
    } else {
      void askAiQuestion(trimmedQuery, attachment);
    }
  };

  const openSavedSession = (session: QuickAskSessionEntry) => {
    triggerMobileHaptic('light');
    activeSessionIdRef.current = session.id;
    setActiveSessionId(session.id);
    setMessages((Array.isArray(session.messages) ? session.messages : []) as ChatMessage[]);
    setShowAllHistory(false);
    setQuery('');
    setAttachment(null);
    setAttachError('');
    setAsking(false);
    void activateQuickAskSession(recentScopeId, session.id).then(setSessionArchive);
  };

  const handleStartNewChat = () => {
    triggerMobileHaptic('light');
    activeSessionIdRef.current = '';
    setActiveSessionId('');
    setMessages([]);
    setShowAllHistory(false);
    setQuery('');
    setAttachment(null);
    setAttachError('');
    setAsking(false);
    void beginNewQuickAskSession(recentScopeId).then(setSessionArchive);
    setTimeout(() => inputRef.current?.focus(), 40);
  };

  const handleResetToExplore = () => {
    triggerMobileHaptic('light');
    activeSessionIdRef.current = '';
    setActiveSessionId('');
    setMessages([]);
    setShowAllHistory(false);
    setQuery('');
    setAttachment(null);
    setAttachError('');
    setAsking(false);
    void loadQuickAskSessionArchive(recentScopeId).then(setSessionArchive);
    setTimeout(() => inputRef.current?.focus(), 40);
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalRoot}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Đóng tìm kiếm"
        />

        <View
          style={[
            styles.sheet,
            isWideWeb && styles.sheetWideWeb,
            { maxHeight: sheetMaxHeight, paddingBottom: Math.max(insets.bottom, 10) },
          ]}
        >
          <View style={styles.grabberRow}>
            <View style={styles.grabber} />
          </View>

          <View style={styles.headerRow}>
            {isChatMode ? (
              <View style={styles.headerSideGroup}>
                <Pressable
                  onPress={handleResetToExplore}
                  style={styles.headerSideBtn}
                  accessibilityRole="button"
                  accessibilityLabel={isEn ? 'History' : 'Lịch sử'}
                >
                  <History size={16} color="#475569" />
                </Pressable>
                <Pressable
                  onPress={handleStartNewChat}
                  style={[styles.headerSideBtn, styles.headerNewBtn]}
                  accessibilityRole="button"
                  accessibilityLabel={isEn ? 'New chat' : 'Chat mới'}
                >
                  <Plus size={16} color="#047857" />
                </Pressable>
              </View>
            ) : (
              <View style={styles.headerSideSpacer} />
            )}

            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>DewSkill AI</Text>
              <View style={styles.verifiedBadge}>
                <Check size={10} color="#FFFFFF" strokeWidth={3} />
              </View>
            </View>

            <Pressable
              onPress={onClose}
              style={styles.headerSideBtn}
              accessibilityRole="button"
              accessibilityLabel="Đóng"
            >
              <X size={18} color="#475569" />
            </Pressable>
          </View>

          {isChatMode ? (
            <ScrollView
              ref={scrollRef}
              style={styles.scrollArea}
              contentContainerStyle={styles.chatContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {messages.map((msg) => (
                msg.role === 'user' ? (
                  <View key={msg.id} style={styles.userBubbleWrap}>
                    <View style={styles.userBubble}>
                      {msg.attachment ? (
                        msg.attachment.isImage && msg.attachment.previewUrl ? (
                          <Image
                            source={{ uri: msg.attachment.previewUrl }}
                            style={[styles.userBubbleImage, msg.text ? styles.userBubbleMediaMargin : null]}
                            resizeMode="contain"
                          />
                        ) : (
                          <View style={[styles.userBubbleFileChip, msg.text ? styles.userBubbleMediaMargin : null]}>
                            <FileText size={14} color="#FFFFFF" />
                            <Text style={styles.userBubbleFileName} numberOfLines={1}>
                              {msg.attachment.name || 'Tệp đính kèm'}
                            </Text>
                          </View>
                        )
                      ) : null}
                      {msg.text ? <Text style={styles.userBubbleText}>{msg.text}</Text> : null}
                    </View>
                  </View>
                ) : (
                  <View key={msg.id} style={styles.aiBubbleWrap}>
                    <View style={styles.aiBubble}>
                      <View style={[styles.sourceChip, msg.source === 'memory' ? styles.sourceChipMemory : styles.sourceChipAi]}>
                        {msg.source === 'memory' ? (
                          <Zap size={10} color="#047857" />
                        ) : (
                          <Sparkles size={10} color="#0369A1" />
                        )}
                        <Text style={[styles.sourceChipText, msg.source === 'memory' ? styles.sourceChipMemoryText : styles.sourceChipAiText]}>
                          {msg.source === 'memory' ? 'Bộ nhớ nhanh' : 'DewSkill AI'}
                        </Text>
                      </View>
                      <AiMarkdownBlock text={msg.text} />
                      {Array.isArray(msg.actions) && msg.actions.length > 0 ? (
                        <View style={styles.actionLinksRow}>
                          {msg.actions.map((act) => {
                            const actionTarget = (act as { path?: string; href?: string }).path
                              || (act as { path?: string; href?: string }).href
                              || '';
                            return (
                              <Pressable
                                key={`${actionTarget}-${act.label}`}
                                onPress={() => { if (actionTarget) navigateActionPath(actionTarget); }}
                                style={({ pressed }) => [styles.actionLinkBtn, pressed && styles.rowPressed]}
                                accessibilityRole="button"
                              >
                                <Text style={styles.actionLinkBtnText}>{act.label}</Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      ) : null}
                      {msg.source === 'fallback' && (msg.retryQuestion || msg.retryAttachment) ? (
                        <Pressable
                          disabled={asking}
                          onPress={() => void askAiQuestion(msg.retryQuestion || '', msg.retryAttachment || null)}
                          style={({ pressed }) => [styles.retryBtn, pressed && styles.rowPressed]}
                          accessibilityRole="button"
                          accessibilityLabel={language === 'en' ? 'Retry' : 'Thử lại'}
                        >
                          <RefreshCw size={12} color="#047857" />
                          <Text style={styles.retryBtnText}>{language === 'en' ? 'Retry' : 'Thử lại'}</Text>
                        </Pressable>
                      ) : null}
                      {msg.source !== 'fallback' ? (
                        <MobileQuickAiFeedbackBar
                          msg={msg}
                          language={language}
                          onExpandReasonBox={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 90)}
                        />
                      ) : null}
                    </View>
                  </View>
                )
              ))}

              {asking ? (
                <View style={styles.aiBubbleWrap}>
                  <View style={styles.thinkingPill}>
                    <ActivityIndicator size="small" color="#059669" />
                    <Text style={styles.thinkingText}>DewSkill AI đang suy nghĩ…</Text>
                  </View>
                </View>
              ) : null}
            </ScrollView>
          ) : (
            <ScrollView
              ref={scrollRef}
              style={styles.scrollArea}
              contentContainerStyle={styles.exploreContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {!trimmedQuery && !attachment ? (
                <View style={styles.heroWrap}>
                  <DewSkillAiOrb size={56} />
                  <Text style={styles.heroSubtext}>
                    {isEn ? 'Personal IT & LMS assistant · 30-day history' : 'Trợ lý cá nhân · lịch sử lưu 30 ngày'}
                  </Text>
                </View>
              ) : (
                <Pressable
                  onPress={() => void askAiQuestion(trimmedQuery, attachment)}
                  style={({ pressed }) => [styles.askDirectCard, pressed && styles.rowPressed]}
                  accessibilityRole="button"
                >
                  <View style={styles.askDirectIcon}>
                    <Sparkles size={16} color="#FFFFFF" />
                  </View>
                  <View style={styles.rowTextWrap}>
                    <Text style={styles.askDirectTitle} numberOfLines={2}>
                      {trimmedQuery
                        ? `Hỏi DewSkill AI: “${trimmedQuery}”`
                        : 'Phân tích ảnh/tệp đính kèm với DewSkill AI'}
                    </Text>
                    <Text style={styles.askDirectSub} numberOfLines={1}>
                      {attachment
                        ? (attachment.name || 'Ảnh đính kèm')
                        : 'Tìm trong bộ nhớ nhanh trước, nếu chưa có AI sẽ trả lời'}
                    </Text>
                  </View>
                </Pressable>
              )}

              {!trimmedQuery && !attachment && sessionList.totalCount > 0 ? (
                <View style={styles.sectionBlock}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionTitle}>
                      {isEn ? 'Recent chats' : 'Lịch sử gần đây'}
                    </Text>
                    {showAllHistory ? (
                      <Text style={styles.sectionBadgeText}>
                        {isEn ? `30 days (${sessionList.totalCount})` : `30 ngày (${sessionList.totalCount})`}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.groupedBox}>
                    {sessionList.items.map((session, idx) => (
                      <Pressable
                        key={session.id}
                        onPress={() => openSavedSession(session)}
                        style={({ pressed }) => [
                          styles.groupRow,
                          idx < sessionList.items.length - 1 && styles.groupRowDivider,
                          pressed && styles.rowPressed,
                        ]}
                        accessibilityRole="button"
                      >
                        <View style={styles.groupIconCircle}>
                          <History size={14} color="#64748B" />
                        </View>
                        <View style={styles.rowTextWrap}>
                          <Text style={styles.groupRowTitle} numberOfLines={1}>
                            {session.preview}
                          </Text>
                          <Text style={styles.groupRowSub} numberOfLines={1}>
                            {`${isEn ? `${session.messages.length} msgs` : `${session.messages.length} tin`} · ${formatSessionRelativeTime(session.updatedAt, language)}`}
                          </Text>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                  {sessionList.hasMore ? (
                    <Pressable
                      onPress={() => setShowAllHistory((prev) => !prev)}
                      style={({ pressed }) => [styles.historyToggleBtn, pressed && styles.rowPressed]}
                      accessibilityRole="button"
                    >
                      {showAllHistory ? (
                        <ChevronUp size={14} color="#475569" />
                      ) : (
                        <ChevronDown size={14} color="#475569" />
                      )}
                      <Text style={styles.historyToggleText}>
                        {showAllHistory
                          ? (isEn ? 'Show less' : 'Thu gọn')
                          : (isEn
                            ? `View more (${sessionList.hiddenCount} in 30 days)`
                            : `Xem thêm (${sessionList.hiddenCount} trong 30 ngày)`)}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}

              {!trimmedQuery && !attachment && sessionList.totalCount === 0 ? (
                <View style={styles.sectionBlock}>
                  <Text style={styles.sectionTitle}>{isEn ? 'Example prompts' : 'Gợi ý hỏi AI'}</Text>
                  <View style={styles.groupedBox}>
                    {starterList.map((promptText, idx) => (
                      <Pressable
                        key={promptText}
                        onPress={() => void askAiQuestion(promptText)}
                        style={({ pressed }) => [
                          styles.groupRow,
                          idx < starterList.length - 1 && styles.groupRowDivider,
                          pressed && styles.rowPressed,
                        ]}
                        accessibilityRole="button"
                      >
                        <View style={styles.groupIconCircle}>
                          <Sparkles size={14} color="#059669" />
                        </View>
                        <Text style={styles.groupRowTitle}>{promptText}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}

              {trimmedQuery && filteredActions.length > 0 ? (
                <View style={styles.sectionBlock}>
                  <Text style={styles.sectionTitle}>{isEn ? 'Quick actions' : 'Tác vụ nhanh'}</Text>
                  <View style={styles.groupedBox}>
                    {filteredActions.map((entry, idx) => {
                      const Icon = entry.icon;
                      return (
                        <Pressable
                          key={entry.id}
                          onPress={entry.onSelect}
                          style={({ pressed }) => [
                            styles.groupRow,
                            idx < filteredActions.length - 1 && styles.groupRowDivider,
                            entry.active && styles.groupRowActive,
                            pressed && styles.rowPressed,
                          ]}
                          accessibilityRole="button"
                        >
                          <View style={[styles.groupIconCircle, entry.active && styles.groupIconCircleActive]}>
                            <Icon size={15} color={entry.active ? '#FFFFFF' : '#059669'} />
                          </View>
                          <View style={styles.rowTextWrap}>
                            <Text style={styles.groupRowTitle} numberOfLines={1}>{entry.label}</Text>
                            <Text style={styles.groupRowSub} numberOfLines={1}>{entry.subtitle}</Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              {visibleDestinations.length > 0 ? (
                <View style={styles.sectionBlock}>
                  <Text style={styles.sectionTitle}>{isEn ? 'Quick navigation' : 'Đi tới nhanh'}</Text>
                  <View style={styles.groupedBox}>
                    {visibleDestinations.map((entry, idx) => {
                      const Icon = entry.icon;
                      return (
                        <Pressable
                          key={entry.id}
                          onPress={entry.onSelect}
                          style={({ pressed }) => [
                            styles.groupRow,
                            idx < visibleDestinations.length - 1 && styles.groupRowDivider,
                            pressed && styles.rowPressed,
                          ]}
                          accessibilityRole="button"
                        >
                          <View style={styles.groupIconCircle}>
                            <Icon size={15} color="#059669" />
                          </View>
                          <View style={styles.rowTextWrap}>
                            <Text style={styles.groupRowTitle} numberOfLines={1}>{entry.label}</Text>
                            <Text style={styles.groupRowSub} numberOfLines={1}>{entry.subtitle}</Text>
                          </View>
                          {entry.locked ? <Lock size={14} color="#D97706" /> : null}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}
            </ScrollView>
          )}

          <View style={styles.composerOuter}>
            {attachment ? (
              <View style={styles.attachPreviewBar}>
                <View style={styles.attachPreviewInfo}>
                  {attachment.isImage && attachment.previewUrl ? (
                    <Image source={{ uri: attachment.previewUrl }} style={styles.attachThumb} />
                  ) : (
                    <View style={styles.attachFileIconBox}>
                      <FileText size={16} color="#059669" />
                    </View>
                  )}
                  <View style={styles.rowTextWrap}>
                    <Text style={styles.attachNameText} numberOfLines={1}>
                      {attachment.name || 'Ảnh đính kèm'}
                    </Text>
                    <Text style={styles.attachMetaText} numberOfLines={1}>
                      {[attachment.isImage ? 'Hình ảnh' : 'Tệp đính kèm', formatMobileFileSize(attachment.size)]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </View>
                </View>
                <Pressable
                  onPress={() => {
                    setAttachment(null);
                    setAttachError('');
                  }}
                  style={styles.attachRemoveBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Gỡ tệp đính kèm"
                >
                  <X size={14} color="#64748B" />
                </Pressable>
              </View>
            ) : null}
            {attachError ? (
              <Text style={styles.attachErrorText}>{attachError}</Text>
            ) : null}
            <View style={styles.composerPill}>
              <Pressable
                onPress={() => void handlePickAttachment()}
                style={styles.composerPlusBtn}
                accessibilityRole="button"
                accessibilityLabel="Đính kèm ảnh hoặc tệp"
              >
                <Plus size={18} color="#334155" />
              </Pressable>
              <TextInput
                ref={inputRef}
                value={query}
                onChangeText={setQuery}
                placeholder={
                  attachment
                    ? (isEn
                      ? 'Describe the error or task in the image…'
                      : 'Mô tả lỗi/đề trên ảnh (VD: Excel #N/A)…')
                    : (isEn
                      ? 'E.g. Excel—SUMIFS; Word—TOC; LMS—schedule…'
                      : 'VD: Excel—SUMIFS; Word—mục lục; LMS—lịch học…')
                }
                placeholderTextColor="#94A3B8"
                style={styles.composerInput}
                returnKeyType="send"
                onSubmitEditing={handleSubmit}
                accessibilityLabel={isEn ? 'Ask DewSkill AI about Office or LMS' : 'Hỏi DewSkill AI về Office hoặc LMS'}
              />
              <Pressable
                disabled={!canSend}
                onPress={() => void askAiQuestion(trimmedQuery, attachment)}
                style={[
                  styles.composerSendBtn,
                  canSend ? styles.composerSendBtnActive : styles.composerSendBtnIdle,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Gửi câu hỏi cho AI"
              >
                {canSend || asking ? (
                  <ArrowUp size={16} color={asking ? '#059669' : '#FFFFFF'} strokeWidth={2.5} />
                ) : (
                  <Sparkles size={15} color="#059669" />
                )}
              </Pressable>
            </View>
            {(role === 'student' || role === 'teacher') && questionQuotaApplies ? (() => {
              const radius = 5;
              const circumference = 2 * Math.PI * radius;
              const clampedPct = Math.max(0, Math.min(100, Number(questionQuotaLeft) || 0));
              const strokeDashoffset = circumference * (1 - clampedPct / 100);
              const ringColor = questionQuotaBlocked ? '#EF4444' : (clampedPct <= 20 ? '#F59E0B' : '#10B981');
              const statusText = questionQuotaBlocked
                ? (isFreeTierStudent || imageUploadDisallowed
                  ? (isEn
                    ? `0% left · Resets in ${resetCountdownText} · Upgrade for more & images`
                    : `0% còn lại · Reset sau ${resetCountdownText} · Nâng cấp để dùng thêm & gửi ảnh`)
                  : (isEn
                    ? `0% left · Resets in ${resetCountdownText}`
                    : `0% còn lại · Reset sau ${resetCountdownText}`))
                : (isEn
                  ? `${clampedPct}% left · Resets in ${resetCountdownText}${imageUploadDisallowed ? ' · No images' : ''}`
                  : `${clampedPct}% còn lại · Reset sau ${resetCountdownText}${imageUploadDisallowed ? ' · Không gửi ảnh' : ''}`);
              return (
                <View style={styles.quotaBarRow}>
                  <View style={styles.quotaRingWrap}>
                    <Svg width={13} height={13} viewBox="0 0 14 14">
                      <Circle
                        cx={7}
                        cy={7}
                        r={radius}
                        fill="none"
                        stroke="#CBD5E1"
                        strokeWidth={2}
                      />
                      {clampedPct > 0 ? (
                        <Circle
                          cx={7}
                          cy={7}
                          r={radius}
                          fill="none"
                          stroke={ringColor}
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeDasharray={`${circumference} ${circumference}`}
                          strokeDashoffset={strokeDashoffset}
                          rotation={-90}
                          originX={7}
                          originY={7}
                        />
                      ) : null}
                    </Svg>
                  </View>
                  <Text style={[styles.quotaBarText, questionQuotaBlocked && styles.quotaBarTextWarn]}>
                    {statusText}
                  </Text>
                </View>
              );
            })() : null}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
  },
  sheet: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 },
    elevation: 18,
  },
  sheetWideWeb: {
    maxWidth: 540,
    marginBottom: 18,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  grabberRow: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
  },
  grabber: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerSideSpacer: {
    width: 34,
    height: 34,
  },
  headerSideGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerSideBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerNewBtn: {
    backgroundColor: '#ECFDF5',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.ink,
  },
  verifiedBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollArea: {
    flexShrink: 1,
    minHeight: 240,
  },
  exploreContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    gap: 16,
  },
  heroWrap: {
    alignItems: 'center',
    paddingVertical: 10,
    gap: 8,
  },
  heroSubtext: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  sectionBlock: {
    gap: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#94A3B8',
    paddingHorizontal: 4,
  },
  sectionBadgeText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#94A3B8',
  },
  historyToggleBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  historyToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  groupedBox: {
    backgroundColor: '#F3F4F6',
    borderRadius: 18,
    overflow: 'hidden',
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  groupRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  groupRowActive: {
    backgroundColor: '#ECFDF5',
  },
  rowPressed: {
    opacity: 0.78,
  },
  groupIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupIconCircleActive: {
    backgroundColor: '#059669',
  },
  rowTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  groupRowTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
  },
  groupRowSub: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 1,
  },
  askDirectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 18,
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
  },
  askDirectIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
  askDirectTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#065F46',
  },
  askDirectSub: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#047857',
    marginTop: 2,
  },
  chatContent: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  userBubbleWrap: {
    alignItems: 'flex-end',
  },
  userBubble: {
    maxWidth: '82%',
    backgroundColor: '#059669',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  userBubbleImage: {
    width: 190,
    height: 140,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  userBubbleMediaMargin: {
    marginBottom: 8,
  },
  userBubbleFileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  userBubbleFileName: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
    maxWidth: 180,
  },
  userBubbleText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  aiBubbleWrap: {
    alignItems: 'flex-start',
  },
  aiBubble: {
    maxWidth: '94%',
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  sourceChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  sourceChipMemory: {
    backgroundColor: '#D1FAE5',
  },
  sourceChipAi: {
    backgroundColor: '#E0F2FE',
  },
  sourceChipText: {
    fontSize: 11,
    fontWeight: '800',
  },
  sourceChipMemoryText: {
    color: '#047857',
  },
  sourceChipAiText: {
    color: '#0369A1',
  },
  mdWrap: {
    gap: 5,
  },
  mdSpacer: {
    height: 4,
  },
  mdBulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    paddingLeft: 2,
  },
  mdBulletDot: {
    color: '#059669',
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 20,
  },
  mdNumberRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
  },
  mdNumberBadge: {
    width: 19,
    height: 19,
    borderRadius: 10,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  mdNumberBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#047857',
  },
  mdParagraph: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
    color: '#0F172A',
  },
  mdBold: {
    fontWeight: '800',
    color: '#0F172A',
  },
  mdItalic: {
    fontStyle: 'italic',
    color: '#475569',
  },
  mdCode: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontSize: 12.5,
    fontWeight: '700',
    color: '#047857',
    backgroundColor: '#ECFDF5',
  },
  actionLinksRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  actionLinkBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  actionLinkBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#047857',
  },
  thinkingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  thinkingText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  composerOuter: {
    paddingHorizontal: 14,
    paddingTop: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 8,
  },
  attachPreviewBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  attachPreviewInfo: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  attachThumb: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  attachFileIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachNameText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  attachMetaText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#047857',
    marginTop: 1,
  },
  attachRemoveBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachErrorText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
    paddingHorizontal: 4,
  },
  quotaBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    marginTop: 5,
  },
  quotaRingWrap: {
    width: 13,
    height: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quotaBarText: {
    flexShrink: 1,
    fontSize: 10,
    fontWeight: '400',
    color: '#94A3B8',
    textAlign: 'left',
  },
  quotaBarTextWarn: {
    color: '#D97706',
  },
  composerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  composerPlusBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    fontWeight: '500',
    color: '#0F172A',
    paddingVertical: 6,
  },
  composerSendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerSendBtnActive: {
    backgroundColor: '#059669',
  },
  composerSendBtnIdle: {
    backgroundColor: '#D1FAE5',
  },
  mdHeading: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  mdCodeBlock: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginVertical: 4,
  },
  mdCodeBlockText: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontSize: 12,
    lineHeight: 18,
    color: '#A7F3D0',
  },
  mdTableScroll: {
    marginVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  mdTable: {
    minWidth: 260,
  },
  mdTableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#ECFDF5',
    borderBottomWidth: 1,
    borderBottomColor: '#CBD5E1',
  },
  mdTableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  mdTableRowAlt: {
    backgroundColor: '#F8FAFC',
  },
  mdTableCell: {
    minWidth: 96,
    maxWidth: 180,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  mdTableHeaderText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#065F46',
  },
  mdTableCellText: {
    fontSize: 12,
    lineHeight: 17,
    color: '#334155',
  },
  retryBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    backgroundColor: '#FFFFFF',
  },
  retryBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#047857',
  },
  fbWrap: {
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 6,
  },
  fbBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  fbPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  fbPillBtnHelpfulActive: {
    borderColor: '#6EE7B7',
    backgroundColor: '#D1FAE5',
  },
  fbPillBtnInaccurateActive: {
    borderColor: '#FDA4AF',
    backgroundColor: '#FFE4E6',
  },
  fbPillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569',
  },
  fbPillTextHelpfulActive: {
    color: '#047857',
  },
  fbPillTextInaccurateActive: {
    color: '#BE123C',
  },
  fbStatusSuccess: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#047857',
  },
  fbReasonBox: {
    gap: 6,
    marginTop: 2,
  },
  fbReasonInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 12.5,
    color: '#0F172A',
  },
  fbReasonActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fbSendBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#E11D48',
  },
  fbSendBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  fbCancelBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  fbCancelBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  fbErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  fbErrorText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#BE123C',
  },
  fbRetryLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  fbRetryText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#BE123C',
    textDecorationLine: 'underline',
  },
});
