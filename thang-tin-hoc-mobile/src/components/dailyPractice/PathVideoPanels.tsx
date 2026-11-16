import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  type TextStyle,
  TextInput,
  View,
} from 'react-native';
import {
  Bot,
  Calculator,
  Check,
  CheckSquare,
  Clock3,
  Copy,
  FileText,
  MessageSquare,
  Plus,
  Search,
  Send,
  Share2,
  Sparkles,
  Square,
  Trash2,
} from 'lucide-react-native';
import {
  dailyPracticeApi,
  type DpVideoGuide,
} from '../../services/dailyPracticeApi';

const NOTE_QUICK_TAGS = [
  '📌 Quan trọng',
  '💡 Mẹo hay',
  '❓ Cần ôn lại',
  '⌨️ Phím tắt',
] as const;

type TimelineNote = {
  id: string;
  lessonId: string;
  lessonTitle: string;
  timeSec: number;
  atSec: number;
  text: string;
  createdAt: string;
};

type FormulaItem = {
  id: string;
  title: string;
  syntax: string;
  note: string;
};

type ChecklistItem = {
  id: string;
  text: string;
};

type AiChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  title?: string;
  body: string;
  formula?: string;
};

const DEFAULT_EXCEL_FORMULAS: FormulaItem[] = [
  {
    id: 'vlookup',
    title: 'VLOOKUP (Tra cứu theo cột)',
    syntax: '=VLOOKUP(gia_tri_tim, bang_du_lieu, cot_lay, 0)',
    note: 'Nhớ cố định bảng dữ liệu bằng F4 ($A$2:$D$20) và truyền số 0 để tìm chính xác.',
  },
  {
    id: 'if-nested',
    title: 'IF lồng (Xếp loại điều kiện)',
    syntax: '=IF(D2>=8,"Giỏi",IF(D2>=6.5,"Khá","Trung bình"))',
    note: 'Thứ tự xét điều kiện từ cao xuống thấp (hoặc ngược lại) để tránh sai nhánh.',
  },
  {
    id: 'sumifs',
    title: 'SUMIFS (Tính tổng nhiều điều kiện)',
    syntax: '=SUMIFS(C2:C50, A2:A50, "Excel", B2:B50, ">=100000")',
    note: 'Tham số đầu tiên là vùng cần cộng tổng; các cặp tiếp theo là (vùng ĐK, ĐK).',
  },
  {
    id: 'countifs',
    title: 'COUNTIFS (Đếm nhiều điều kiện)',
    syntax: '=COUNTIFS(B2:B50, "Đã nộp", D2:D50, ">=8")',
    note: 'Đếm nhanh số bài nộp đạt từ 8 điểm trở lên.',
  },
];

const DEFAULT_SHORTCUT_TIPS = [
  'Ctrl + S: Lưu bài liên tục để tránh mất dữ liệu.',
  'F4 (Excel): Cố định địa chỉ tuyệt đối $A$1 · (Word/PPT): Lặp lại thao tác vừa làm.',
  'Alt + = (Excel): Tính SUM tự động cực nhanh cho cột/hàng số.',
  'Ctrl + Shift + L (Excel): Bật/tắt bộ lọc AutoFilter.',
  'Ctrl + H: Tìm kiếm và thay thế hàng loạt (Find & Replace).',
];

const DEFAULT_CHECKLIST_ITEMS: ChecklistItem[] = [
  { id: 'chk-1', text: 'Không còn ô hiển thị lỗi #N/A, #VALUE!, #REF!, #NAME?' },
  { id: 'chk-2', text: 'Đã dùng tham chiếu tuyệt đối $A$1 trước khi kéo công thức xuống.' },
  { id: 'chk-3', text: 'Số tiền / ngày tháng đã định dạng chuẩn (không nhập chữ vào ô tính toán).' },
  { id: 'chk-4', text: 'Văn bản Word đã căn đều hai bên, không gõ phím Space liên tiếp để căn lề.' },
];

const QUICK_AI_PROMPTS = [
  'Lỗi #N/A trong VLOOKUP sửa thế nào?',
  'Cách viết hàm IF lồng xếp loại?',
  'Các bước căn lề văn bản chuẩn trong Word?',
];

export function formatVideoTimestamp(rawSec: number): string {
  const safe = Math.max(0, Math.floor(Number(rawSec) || 0));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function normalizeNoteList(raw: unknown, fallbackLessonId: string, fallbackLessonTitle: string): TimelineNote[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, idx): TimelineNote | null => {
      if (!item || typeof item !== 'object') return null;
      const obj = item as Record<string, unknown>;
      const text = String(obj.text ?? obj.body ?? obj.content ?? '').trim();
      if (!text) return null;
      const secRaw = Number(obj.timeSec ?? obj.atSec ?? obj.sec ?? obj.time ?? 0);
      const sec = Number.isFinite(secRaw) && secRaw >= 0 ? Math.floor(secRaw) : 0;
      const createdAt = String(obj.createdAt || new Date().toISOString());
      return {
        id: String(obj.id || `note_${createdAt}_${idx}`),
        lessonId: String(obj.lessonId || fallbackLessonId || ''),
        lessonTitle: String(obj.lessonTitle || fallbackLessonTitle || ''),
        timeSec: sec,
        atSec: sec,
        text,
        createdAt,
      };
    })
    .filter((n): n is TimelineNote => Boolean(n));
}

async function copyTextCrossPlatform(text: string): Promise<boolean> {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }
  try {
    await Share.share({ message: text });
    return true;
  } catch {
    return false;
  }
}

function buildNotesMarkdown(notes: TimelineNote[], unitTitle?: string): string {
  const heading = unitTitle ? `# Ghi chú bài học: ${unitTitle}\n\n` : '# Ghi chú video bài học\n\n';
  const lines = notes.map((note) => {
    const label = note.lessonTitle ? ` (${note.lessonTitle})` : '';
    return `- [${formatVideoTimestamp(note.atSec)}]${label}: ${note.text}`;
  });
  return `${heading}${lines.join('\n')}\n`;
}

function buildContextualFallbackReply(
  question: string,
  lessonTitle?: string,
  unitTitle?: string,
  courseTitle?: string,
): { title: string; body: string; formula?: string } {
  const q = question.toLocaleLowerCase('vi');
  const contextLabel = lessonTitle || unitTitle || courseTitle || 'bài học hiện tại';
  if (q.includes('vlookup') || q.includes('#n/a') || q.includes('tra cứu')) {
    return {
      title: 'Gợi ý xử lý VLOOKUP & lỗi #N/A',
      body: '1) Kiểm tra giá trị tìm và cột đầu tiên của bảng dò có cùng kiểu chữ/số hay không (dễ dính khoảng trắng thừa — thử bọc `TRIM()`).\n2) Đảm bảo bảng tra cứu đã cố định `F4` (`$A$2:$E$100`).\n3) Luôn đặt tham số cuối là `0` (`FALSE`) để dò chính xác.',
      formula: '=IFERROR(VLOOKUP(A2, $E$2:$G$50, 2, 0), "Không tìm thấy")',
    };
  }
  if (q.includes('if') || q.includes('điều kiện') || q.includes('xếp loại')) {
    return {
      title: 'Cấu trúc hàm IF / AND / OR chuẩn',
      body: 'Khi kết hợp nhiều điều kiện đồng thời dùng `AND(...)`, một trong các điều kiện dùng `OR(...)`. Chuỗi chữ trong công thức phải đặt trong dấu ngoặc kép `""`.',
      formula: '=IF(AND(B2>=5, C2>=5), "Đạt", "Cần ôn lại")',
    };
  }
  if (q.includes('sum') || q.includes('tổng') || q.includes('đếm') || q.includes('count')) {
    return {
      title: 'Tối ưu SUMIF / SUMIFS / COUNTIFS',
      body: 'Nếu có 1 điều kiện dùng `SUMIF`/`COUNTIF`; từ 2 điều kiện trở lên bắt buộc chuyển sang `SUMIFS`/`COUNTIFS` (lưu ý `SUMIFS` đưa vùng tính tổng lên **đầu tiên**).',
      formula: '=SUMIFS($D$2:$D$100, $B$2:$B$100, "Word", $C$2:$C$100, ">0")',
    };
  }
  if (q.includes('word') || q.includes('căn lề') || q.includes('nghị định 30') || q.includes('mục lục')) {
    return {
      title: 'Checklist chuẩn thể thức Word',
      body: '- Cỡ chữ thường `13–14pt` (*Times New Roman*), giãn dòng `1.15–1.3`.\n- Lề Nghị định 30: Trên `20mm`, Dưới `20mm`, Trái `30mm`, Phải `15mm`.\n- Dùng **Styles** (*Heading 1, 2*) trước khi chèn **References → Table of Contents**.',
    };
  }
  if (q.includes('slide') || q.includes('powerpoint') || q.includes('ppt') || q.includes('thuyết trình')) {
    return {
      title: 'Mẹo thiết kế slide PowerPoint chuyên nghiệp',
      body: '- Thiết lập bố cục chung bằng **View → Slide Master** để đồng bộ font & logo.\n- Quy tắc 6x6: tối đa 6 gạch đầu dòng, mỗi dòng gọn ≤ 6–8 chữ.\n- Giữ phím `Shift` khi kéo hình/ảnh để giữ đúng tỷ lệ không bị méo.',
    };
  }
  return {
    title: `Trợ lý bài "${contextLabel}"`,
    body: `Với nội dung **${contextLabel}**, bạn hãy chia nhỏ bài tập thành 3 bước:\n1) Đọc kỹ yêu cầu định dạng / dữ liệu đầu vào.\n2) Thực hiện từng hàm hoặc thao tác theo trình tự từ dễ đến khó.\n3) Dùng phím tắt \`Ctrl + Z\` để thử nghiệm an toàn và rà lại kết quả trước khi nộp.`,
  };
}

function renderFormattedInline(text: string, keyPrefix = 'in', baseStyle?: TextStyle): React.ReactNode[] {
  const src = String(text || '');
  const nodes: React.ReactNode[] = [];
  const tokenRe = /(`[^`\n]+`|\*\*[^*\n]+?\*\*|\*[^*\n]+?\*)/g;
  let last = 0;
  let idx = 0;
  let match: RegExpExecArray | null;
  while ((match = tokenRe.exec(src)) !== null) {
    if (match.index > last) {
      nodes.push(src.slice(last, match.index));
    }
    const token = match[0];
    if (token.startsWith('`') && token.endsWith('`')) {
      nodes.push(
        <Text key={`${keyPrefix}-c-${idx++}`} style={styles.mdInlineCode}>
          {` ${token.slice(1, -1)} `}
        </Text>,
      );
    } else if (token.startsWith('**') && token.endsWith('**')) {
      const inner = token.slice(2, -2);
      nodes.push(
        <Text key={`${keyPrefix}-b-${idx++}`} style={[baseStyle, styles.mdBold]}>
          {renderFormattedInline(inner, `${keyPrefix}-b-${idx}`, [baseStyle, styles.mdBold] as never)}
        </Text>,
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      const inner = token.slice(1, -1);
      nodes.push(
        <Text key={`${keyPrefix}-i-${idx++}`} style={[baseStyle, styles.mdItalic]}>
          {renderFormattedInline(inner, `${keyPrefix}-i-${idx}`, [baseStyle, styles.mdItalic] as never)}
        </Text>,
      );
    }
    last = tokenRe.lastIndex;
  }
  if (last < src.length) {
    nodes.push(src.slice(last));
  }
  return nodes;
}

function splitTableCells(line: string): string[] {
  return String(line || '')
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function isTableSeparator(line: string): boolean {
  const cells = splitTableCells(line);
  return cells.length >= 2 && cells.every((c) => /^:?-{2,}:?$/.test(c));
}

function isStartingTable(lines: string[], idx: number): boolean {
  if (idx + 1 >= lines.length) return false;
  const line = lines[idx]?.trim() || '';
  return line.includes('|') && isTableSeparator(lines[idx + 1]);
}

function StructuredAiMessage({ body }: { body: string }) {
  const lines = String(body || '').replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (!trimmed) {
      i += 1;
      continue;
    }

    // Fenced code block
    if (trimmed.startsWith('```')) {
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1;
      blocks.push(
        <ScrollView
          key={`code-${blocks.length}`}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.mdFencedCodeBox}
        >
          <Text selectable style={styles.mdFencedCodeText}>
            {codeLines.join('\n')}
          </Text>
        </ScrollView>,
      );
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push(<View key={`hr-${blocks.length}`} style={styles.mdHr} />);
      i += 1;
      continue;
    }

    // Headings (# .. ####)
    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const headingStyle = level <= 2
        ? styles.mdHeadingMajor
        : level === 3
          ? styles.mdHeading3
          : styles.mdHeading4;
      const blockIdx = blocks.length;
      blocks.push(
        <View key={`h-${blockIdx}`} style={level <= 2 ? styles.mdHeadingMajorWrap : styles.mdHeadingWrap}>
          <Text style={headingStyle}>
            {renderFormattedInline(text, `h-${blockIdx}`, headingStyle)}
          </Text>
        </View>,
      );
      i += 1;
      continue;
    }

    // Markdown table
    if (isStartingTable(lines, i)) {
      const blockIdx = blocks.length;
      const headers = splitTableCells(trimmed);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().includes('|')) {
        rows.push(splitTableCells(lines[i]));
        i += 1;
      }
      const wideCols = headers.length >= 3;
      const tableNode = (
        <View style={wideCols ? styles.mdTableInnerWide : styles.mdTableInner}>
          <View style={styles.mdTableHeaderRow}>
            {headers.map((h, hIdx) => (
              <View
                key={`th-${hIdx}`}
                style={[
                  styles.mdTableCell,
                  wideCols ? { width: 140 } : { flex: hIdx === 0 && headers.length === 2 ? 1 : 1.5 },
                  hIdx > 0 && styles.mdTableCellBorderLeft,
                ]}
              >
                <Text style={styles.mdTableHeaderText}>
                  {renderFormattedInline(h, `th-${blockIdx}-${hIdx}`, styles.mdTableHeaderText)}
                </Text>
              </View>
            ))}
          </View>
          {rows.map((row, rIdx) => (
            <View
              key={`tr-${rIdx}`}
              style={[styles.mdTableRow, rIdx % 2 === 1 && styles.mdTableRowStriped]}
            >
              {headers.map((_, cIdx) => (
                <View
                  key={`td-${cIdx}`}
                  style={[
                    styles.mdTableCell,
                    wideCols ? { width: 140 } : { flex: cIdx === 0 && headers.length === 2 ? 1 : 1.5 },
                    cIdx > 0 && styles.mdTableCellBorderLeft,
                  ]}
                >
                  <Text style={styles.mdTableCellText}>
                    {renderFormattedInline(row[cIdx] || '', `td-${blockIdx}-${rIdx}-${cIdx}`, styles.mdTableCellText)}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      );
      blocks.push(
        <View key={`tbl-${blockIdx}`} style={styles.mdTableCard}>
          {wideCols ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {tableNode}
            </ScrollView>
          ) : (
            tableNode
          )}
        </View>,
      );
      continue;
    }

    // Blockquote / Callout
    if (trimmed.startsWith('>')) {
      const blockIdx = blocks.length;
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i += 1;
      }
      const joined = quoteLines.join('\n');
      const isTip = /💡|✅|Mẹo|Gợi ý/i.test(joined);
      const quoteTextStyle = isTip ? styles.mdCalloutTextTip : styles.mdCalloutTextWarn;
      blocks.push(
        <View
          key={`q-${blockIdx}`}
          style={[styles.mdCallout, isTip ? styles.mdCalloutTip : styles.mdCalloutWarn]}
        >
          {quoteLines.map((ql, qIdx) => (
            <Text key={qIdx} style={[quoteTextStyle, qIdx > 0 && { marginTop: 4 }]}>
              {renderFormattedInline(ql, `q-${blockIdx}-${qIdx}`, quoteTextStyle)}
            </Text>
          ))}
        </View>,
      );
      continue;
    }

    // Bullet list (*, -, •)
    if (/^[-*•]\s+/.test(trimmed)) {
      const blockIdx = blocks.length;
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) {
        items.push(lines[i].trim().replace(/^[-*•]\s+/, ''));
        i += 1;
      }
      blocks.push(
        <View key={`ul-${blockIdx}`} style={styles.mdListWrap}>
          {items.map((item, liIdx) => (
            <View key={liIdx} style={styles.mdBulletRow}>
              <View style={styles.mdBulletDotCircle} />
              <Text style={styles.mdText}>
                {renderFormattedInline(item, `ul-${blockIdx}-${liIdx}`, styles.mdText)}
              </Text>
            </View>
          ))}
        </View>,
      );
      continue;
    }

    // Numbered list (1. 2. or 1) 2))
    if (/^\d+[.)]\s+/.test(trimmed)) {
      const blockIdx = blocks.length;
      const items: Array<{ num: string; text: string }> = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        const m = lines[i].trim().match(/^(\d+)[.)]\s+(.+)$/);
        if (m) items.push({ num: m[1], text: m[2] });
        i += 1;
      }
      blocks.push(
        <View key={`ol-${blockIdx}`} style={styles.mdListWrap}>
          {items.map((item, liIdx) => (
            <View key={liIdx} style={styles.mdBulletRow}>
              <View style={styles.mdNumBadge}>
                <Text style={styles.mdNumBadgeText}>{item.num}</Text>
              </View>
              <Text style={styles.mdText}>
                {renderFormattedInline(item.text, `ol-${blockIdx}-${liIdx}`, styles.mdText)}
              </Text>
            </View>
          ))}
        </View>,
      );
      continue;
    }

    // Normal paragraph
    const blockIdx = blocks.length;
    const paraLines: string[] = [];
    while (
      i < lines.length
      && lines[i].trim()
      && !lines[i].trim().startsWith('```')
      && !/^(#{1,4}\s+|[-*•]\s+|\d+[.)]\s+|>\s?|-{3,}|\*{3,}|_{3,})/.test(lines[i].trim())
      && !isStartingTable(lines, i)
    ) {
      paraLines.push(lines[i].trim());
      i += 1;
    }
    blocks.push(
      <Text key={`p-${blockIdx}`} style={styles.mdText}>
        {renderFormattedInline(paraLines.join(' '), `p-${blockIdx}`, styles.mdText)}
      </Text>,
    );
  }

  return <View style={styles.mdWrap}>{blocks}</View>;
}

export function VideoTimelineNotesPanel({
  unitId,
  unitTitle,
  userId,
  lessonId,
  lessonTitle,
  getCurrentTime,
  onSeekTo,
}: {
  unitId: string;
  unitTitle?: string;
  userId?: string | null;
  lessonId: string;
  lessonTitle: string;
  getCurrentTime: () => number;
  onSeekTo?: (sec: number) => void;
}) {
  const storageKey = useMemo(
    () => `lms_notes_${userId || 'anon'}_dp_${unitId}`,
    [userId, unitId],
  );
  const [notes, setNotes] = useState<TimelineNote[]>([]);
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'current' | 'all'>('current');
  const [currentSec, setCurrentSec] = useState(0);
  const [exported, setExported] = useState(false);
  const lessonIdRef = useRef(lessonId);
  const lessonTitleRef = useRef(lessonTitle);
  lessonIdRef.current = lessonId;
  lessonTitleRef.current = lessonTitle;

  const readStoredNotes = useCallback(async () => {
    try {
      let raw: string | null = null;
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
        raw = window.localStorage.getItem(storageKey);
      } else {
        raw = await AsyncStorage.getItem(storageKey);
      }
      if (!raw) {
        setNotes([]);
        return;
      }
      const parsed = JSON.parse(raw);
      setNotes(normalizeNoteList(parsed, lessonIdRef.current, lessonTitleRef.current));
    } catch {
      setNotes([]);
    }
  }, [storageKey]);

  const persistNotes = useCallback(
    async (next: TimelineNote[]) => {
      setNotes(next);
      try {
        const serialized = JSON.stringify(next);
        if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(storageKey, serialized);
        } else {
          await AsyncStorage.setItem(storageKey, serialized);
        }
      } catch {
        // Ignore storage quota errors cleanly.
      }
    },
    [storageKey],
  );

  useEffect(() => {
    void readStoredNotes();
  }, [readStoredNotes]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
    const onStorage = (event: StorageEvent) => {
      if (event.key === storageKey) {
        void readStoredNotes();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [storageKey, readStoredNotes]);

  useEffect(() => {
    const syncClock = () => {
      const next = Math.max(0, Math.floor(Number(getCurrentTime()) || 0));
      setCurrentSec((prev) => (prev === next ? prev : next));
    };
    syncClock();
    const timer = setInterval(syncClock, 500);
    return () => clearInterval(timer);
  }, [getCurrentTime, lessonId]);

  const handleAddNote = useCallback(
    (overrideText?: string) => {
      const cleanText = String(overrideText ?? draft).trim();
      if (!cleanText) return;
      const capturedSec = Math.max(0, Math.floor(Number(getCurrentTime()) || currentSec || 0));
      const nowIso = new Date().toISOString();
      const newNote: TimelineNote = {
        id: `dpn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        lessonId,
        lessonTitle,
        timeSec: capturedSec,
        atSec: capturedSec,
        text: cleanText,
        createdAt: nowIso,
      };
      const next = [newNote, ...notes].sort((a, b) => a.atSec - b.atSec);
      void persistNotes(next);
      if (overrideText === undefined) {
        setDraft('');
      }
    },
    [currentSec, draft, getCurrentTime, lessonId, lessonTitle, notes, persistNotes],
  );

  const handleQuickTag = useCallback(
    (tag: string) => {
      const trimmed = draft.trim();
      if (trimmed) {
        const composed = trimmed.startsWith(tag) ? trimmed : `${tag}: ${trimmed}`;
        handleAddNote(composed);
        setDraft('');
        return;
      }
      handleAddNote(tag);
    },
    [draft, handleAddNote],
  );

  const handleDeleteNote = useCallback(
    (noteId: string) => {
      void persistNotes(notes.filter((n) => n.id !== noteId));
    },
    [notes, persistNotes],
  );

  const visibleNotes = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('vi');
    return notes.filter((n) => {
      if (filter === 'current' && n.lessonId !== lessonId) return false;
      if (!needle) return true;
      return (
        n.text.toLocaleLowerCase('vi').includes(needle)
        || n.lessonTitle.toLocaleLowerCase('vi').includes(needle)
      );
    });
  }, [filter, lessonId, notes, search]);

  const handleExport = useCallback(async () => {
    if (!visibleNotes.length) return;
    const md = buildNotesMarkdown(visibleNotes, unitTitle || lessonTitle);
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      try {
        const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `ghi-chu-${unitId || 'bai-hoc'}.md`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        setExported(true);
        setTimeout(() => setExported(false), 1800);
        return;
      } catch {
        // Fallback to clipboard/share below.
      }
    }
    const ok = await copyTextCrossPlatform(md);
    if (ok) {
      setExported(true);
      setTimeout(() => setExported(false), 1800);
    }
  }, [lessonTitle, unitId, unitTitle, visibleNotes]);

  return (
    <View style={styles.panelBody}>
      <View style={styles.noteInputShell}>
        <Pressable
          onPress={() => setCurrentSec(Math.max(0, Math.floor(Number(getCurrentTime()) || 0)))}
          style={styles.timePill}
          accessibilityRole="button"
          accessibilityLabel="Cập nhật mốc thời gian video hiện tại"
        >
          <Clock3 size={12} color="#34D399" />
          <Text style={styles.timePillText}>{formatVideoTimestamp(currentSec)}</Text>
        </Pressable>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={() => handleAddNote()}
          returnKeyType="done"
          placeholder={`Ghi chú nhanh tại mốc ${formatVideoTimestamp(currentSec)}...`}
          placeholderTextColor="#64748B"
          style={styles.noteInput}
        />
        <Pressable
          onPress={() => handleAddNote()}
          disabled={!draft.trim()}
          style={[styles.addCircleBtn, draft.trim() ? styles.addCircleBtnActive : null]}
          accessibilityRole="button"
          accessibilityLabel="Lưu ghi chú tại mốc thời gian hiện tại"
        >
          <Plus size={16} color={draft.trim() ? '#022C22' : '#94A3B8'} />
        </Pressable>
      </View>

      <View style={styles.chipRow}>
        {NOTE_QUICK_TAGS.map((tag) => (
          <Pressable
            key={tag}
            onPress={() => handleQuickTag(tag)}
            style={styles.quickTagChip}
            accessibilityRole="button"
          >
            <Text style={styles.quickTagText}>{tag}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.toolbarRow}>
        <View style={styles.filterGroup}>
          <Pressable
            onPress={() => setFilter('current')}
            style={[styles.filterPill, filter === 'current' && styles.filterPillActive]}
            accessibilityRole="button"
          >
            <Text style={[styles.filterPillText, filter === 'current' && styles.filterPillTextActive]}>
              Bài hiện tại
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setFilter('all')}
            style={[styles.filterPill, filter === 'all' && styles.filterPillActive]}
            accessibilityRole="button"
          >
            <Text style={[styles.filterPillText, filter === 'all' && styles.filterPillTextActive]}>
              Tất cả bài giảng{notes.length > 0 ? ` (${notes.length})` : ''}
            </Text>
          </Pressable>
        </View>

        {visibleNotes.length > 0 ? (
          <Pressable onPress={() => void handleExport()} style={styles.exportBtn} accessibilityRole="button">
            {exported ? (
              <Check size={13} color="#34D399" />
            ) : Platform.OS === 'web' ? (
              <Copy size={13} color="#CBD5E1" />
            ) : (
              <Share2 size={13} color="#CBD5E1" />
            )}
            <Text style={[styles.exportBtnText, exported && styles.exportBtnTextActive]}>
              {exported ? 'Đã lưu' : Platform.OS === 'web' ? 'Xuất .md' : 'Chia sẻ'}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {notes.length > 2 ? (
        <View style={styles.searchBox}>
          <Search size={14} color="#64748B" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Tìm trong ghi chú..."
            placeholderTextColor="#64748B"
            style={styles.searchInput}
          />
        </View>
      ) : null}

      {visibleNotes.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>
            Nhấp vào ô "Ghi chú nhanh" hoặc chọn nhãn gợi ý để lưu lại mốc thời gian quan trọng trong video.
          </Text>
        </View>
      ) : (
        <View style={styles.noteList}>
          {visibleNotes.map((note) => (
            <View key={note.id} style={styles.noteCard}>
              <View style={styles.noteCardHead}>
                <Pressable
                  onPress={() => onSeekTo?.(note.atSec)}
                  disabled={!onSeekTo}
                  style={styles.timePill}
                  accessibilityRole="button"
                >
                  <Clock3 size={11} color="#34D399" />
                  <Text style={styles.timePillText}>{formatVideoTimestamp(note.atSec)}</Text>
                </Pressable>
                {filter === 'all' && note.lessonTitle ? (
                  <Text numberOfLines={1} style={styles.noteLessonBadge}>
                    {note.lessonTitle}
                  </Text>
                ) : (
                  <View style={{ flex: 1 }} />
                )}
                <Pressable
                  onPress={() => handleDeleteNote(note.id)}
                  style={styles.deleteNoteBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Xóa ghi chú"
                >
                  <Trash2 size={14} color="#94A3B8" />
                </Pressable>
              </View>
              <Text style={styles.noteBodyText}>{note.text}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export function PathLessonAiAssistantPanel({
  lessonTitle,
  unitTitle,
  courseTitle,
  guide,
}: {
  lessonTitle?: string;
  unitTitle?: string;
  courseTitle?: string;
  guide?: DpVideoGuide | null;
}) {
  const isCustom = Boolean(guide?.customized);

  const formulas = useMemo<FormulaItem[]>(() => {
    if (!isCustom) return DEFAULT_EXCEL_FORMULAS;
    return Array.isArray(guide?.formulas)
      ? guide.formulas
          .map((f, idx) => ({
            id: String(f.id || `cf-${idx}`),
            title: String(f.name || f.title || `Công thức ${idx + 1}`).trim(),
            syntax: String(f.syntax || f.formula || f.code || '').trim(),
            note: String(f.note || f.desc || f.description || '').trim(),
          }))
          .filter((f) => f.title || f.syntax)
      : [];
  }, [guide, isCustom]);

  const focusSummaryText = isCustom
    ? String(guide?.focusSummary || '').trim()
    : 'Hoàn thành video bài giảng (≥ 67% để mở bài tiếp, ≥ 90% để nhận tối đa XP), sau đó áp dụng đúng công thức/định dạng vào file thực hành.';

  const shortcutTips = useMemo<string[]>(() => {
    if (!isCustom) return DEFAULT_SHORTCUT_TIPS;
    return Array.isArray(guide?.shortcuts)
      ? guide.shortcuts
          .map((item) => {
            if (typeof item === 'string') return item.trim();
            const keys = String(item.keys || item.key || item.shortcut || item.title || '').trim();
            const desc = String(item.desc || item.description || item.label || '').trim();
            return keys && desc ? `${keys}: ${desc}` : keys || desc;
          })
          .filter(Boolean)
      : [];
  }, [guide, isCustom]);

  const checklist = useMemo<ChecklistItem[]>(() => {
    if (!isCustom) return DEFAULT_CHECKLIST_ITEMS;
    return Array.isArray(guide?.checklist)
      ? guide.checklist
          .map((item, idx) => ({
            id: typeof item === 'object' && item?.id ? String(item.id) : `cchk-${idx}`,
            text:
              typeof item === 'string'
                ? item.trim()
                : String(item?.text || item?.label || item?.title || item?.desc || '').trim(),
          }))
          .filter((c) => c.text)
      : [];
  }, [guide, isCustom]);

  const [tab, setTab] = useState<'formulas' | 'tips' | 'checklist' | 'chat'>(() => {
    if (isCustom && !formulas.length) {
      if (focusSummaryText || shortcutTips.length) return 'tips';
      if (checklist.length) return 'checklist';
      return 'chat';
    }
    return 'formulas';
  });
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<Record<string, boolean>>({});
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const chatScrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const [messages, setMessages] = useState<AiChatMessage[]>(() => ([
    {
      id: 'welcome',
      role: 'assistant',
      title: `Xin chào! Mình là Trợ lý AI cho "${lessonTitle || unitTitle || 'bài học'}"`,
      body: 'Bạn cần gợi ý công thức Excel, tóm tắt trọng tâm bài hay kiểm lỗi trước khi nộp bài thực hành? Hãy chọn nút gợi ý nhanh hoặc nhập câu hỏi bên dưới nhé!',
    },
  ]));

  useEffect(() => {
    if (tab !== 'chat') return;
    const t = setTimeout(() => {
      chatScrollRef.current?.scrollToEnd({ animated: true });
    }, 60);
    return () => clearTimeout(t);
  }, [tab, messages, asking]);

  const handleCopyFormula = useCallback(async (id: string, syntax: string) => {
    if (!syntax) return;
    const ok = await copyTextCrossPlatform(syntax);
    if (ok) {
      setCopiedId(id);
      setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1800);
    }
  }, []);

  const toggleChecklist = useCallback((id: string) => {
    setCheckedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const submitQuestion = useCallback(
    async (rawPrompt?: string) => {
      const q = String(rawPrompt ?? question).trim();
      if (!q || asking) return;
      setTab('chat');
      if (rawPrompt === undefined) setQuestion('');
      const userMsg: AiChatMessage = { id: `u_${Date.now()}`, role: 'user', body: q };
      const historyPayload = messages
        .slice(1)
        .slice(-6)
        .map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', body: m.body }));
      setMessages((prev) => [...prev, userMsg]);
      setAsking(true);
      try {
        const res = await dailyPracticeApi.askLessonAssistant({
          question: q,
          lessonTitle,
          unitTitle,
          courseTitle,
          history: historyPayload,
        });
        const answer = String(res?.answer || res?.text || '').trim();
        setMessages((prev) => [
          ...prev,
          {
            id: `a_${Date.now()}`,
            role: 'assistant',
            title: `Trợ lý AI · ${lessonTitle || unitTitle || 'Bài học'}`,
            body: answer || 'Mình chưa nhận được phản hồi rõ ràng, bạn thử hỏi lại chi tiết hơn nhé.',
          },
        ]);
      } catch (err: unknown) {
        const fallback = buildContextualFallbackReply(q, lessonTitle, unitTitle, courseTitle);
        const errMsg = err instanceof Error && err.message ? err.message : 'Không kết nối được máy chủ AI';
        setMessages((prev) => [
          ...prev,
          {
            id: `a_${Date.now()}`,
            role: 'assistant',
            title: 'Trợ lý AI (tạm thời ngoại tuyến)',
            body: `${errMsg}\n\n${fallback.body}`.trim(),
            ...(fallback.formula ? { formula: fallback.formula } : {}),
          },
        ]);
      } finally {
        setAsking(false);
      }
    },
    [asking, courseTitle, lessonTitle, messages, question, unitTitle],
  );

  return (
    <View style={styles.panelBody}>
      <View style={styles.aiTabWrap}>
        <Pressable
          onPress={() => setTab('formulas')}
          style={[styles.aiTabBtn, tab === 'formulas' && styles.aiTabBtnActive]}
          accessibilityRole="button"
        >
          <Calculator size={13} color={tab === 'formulas' ? '#FFFFFF' : '#CBD5E1'} />
          <Text style={[styles.aiTabText, tab === 'formulas' && styles.aiTabTextActive]}>
            Công thức Excel
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setTab('tips')}
          style={[styles.aiTabBtn, tab === 'tips' && styles.aiTabBtnActive]}
          accessibilityRole="button"
        >
          <FileText size={13} color={tab === 'tips' ? '#FFFFFF' : '#CBD5E1'} />
          <Text style={[styles.aiTabText, tab === 'tips' && styles.aiTabTextActive]}>
            Trọng tâm & Phím tắt
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setTab('checklist')}
          style={[styles.aiTabBtn, tab === 'checklist' && styles.aiTabBtnActive]}
          accessibilityRole="button"
        >
          <CheckSquare size={13} color={tab === 'checklist' ? '#FFFFFF' : '#CBD5E1'} />
          <Text style={[styles.aiTabText, tab === 'checklist' && styles.aiTabTextActive]}>
            Tự chấm bài thực hành
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setTab('chat')}
          style={[styles.aiTabBtn, tab === 'chat' && styles.aiTabBtnActive]}
          accessibilityRole="button"
        >
          <MessageSquare size={13} color={tab === 'chat' ? '#FFFFFF' : '#CBD5E1'} />
          <Text style={[styles.aiTabText, tab === 'chat' && styles.aiTabTextActive]}>
            Hỏi đáp AI
          </Text>
        </Pressable>
      </View>

      {tab === 'formulas' ? (
        <View style={styles.cardList}>
          {formulas.length === 0 ? (
            <View style={styles.emptyGuideBox}>
              <Text style={styles.emptyGuideText}>
                Bài học này chưa thêm công thức riêng. Bạn có thể hỏi đáp trực tiếp với Trợ lý AI bên dưới.
              </Text>
            </View>
          ) : (
            formulas.map((f) => (
              <View key={f.id} style={styles.formulaCard}>
                <View style={styles.formulaHead}>
                  <Text style={styles.formulaTitle}>{f.title}</Text>
                  {f.syntax ? (
                    <Pressable
                      onPress={() => void handleCopyFormula(f.id, f.syntax)}
                      style={styles.copyChip}
                      accessibilityRole="button"
                    >
                      {copiedId === f.id ? (
                        <Check size={12} color="#34D399" />
                      ) : (
                        <Copy size={12} color="#CBD5E1" />
                      )}
                      <Text style={[styles.copyChipText, copiedId === f.id && styles.copyChipTextActive]}>
                        {copiedId === f.id ? 'Đã chép' : 'Chép'}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
                {f.syntax ? (
                  <View style={styles.codeBlock}>
                    <Text selectable style={styles.codeText}>{f.syntax}</Text>
                  </View>
                ) : null}
                {f.note ? <Text style={styles.formulaNote}>{f.note}</Text> : null}
              </View>
            ))
          )}
        </View>
      ) : null}

      {tab === 'tips' ? (
        <View style={styles.summaryBox}>
          <View style={styles.summaryTitleRow}>
            <Sparkles size={13} color="#6EE7B7" />
            <Text style={styles.summaryTitleText}>
              {`Trọng tâm: ${lessonTitle || unitTitle || courseTitle || 'Bài học'}`}
            </Text>
          </View>
          {focusSummaryText ? (
            <Text style={styles.summaryBody}>{focusSummaryText}</Text>
          ) : null}
          {shortcutTips.length > 0 ? (
            <View style={focusSummaryText ? styles.shortcutSectionDivider : undefined}>
              <Text style={styles.shortcutSectionLabel}>Phím tắt nên nhớ:</Text>
              <View style={styles.shortcutBulletList}>
                {shortcutTips.map((tip, i) => (
                  <View key={`${tip}-${i}`} style={styles.mdBulletRow}>
                    <Text style={styles.shortcutBulletChar}>•</Text>
                    <Text style={styles.shortcutBulletText}>{tip}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : !focusSummaryText ? (
            <Text style={styles.emptyGuideText}>Chưa có nội dung trọng tâm riêng cho bài học này.</Text>
          ) : null}
        </View>
      ) : null}

      {tab === 'checklist' ? (
        <View style={styles.summaryBox}>
          <Text style={styles.checklistHeading}>Checklist rà lỗi trước khi nộp bài thực hành:</Text>
          {checklist.length === 0 ? (
            <Text style={styles.emptyGuideText}>Chưa có checklist riêng cho bài học này.</Text>
          ) : (
            <View style={styles.cardList}>
              {checklist.map((item) => {
                const done = Boolean(checkedIds[item.id]);
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => toggleChecklist(item.id)}
                    style={[styles.checkRowCard, done && styles.checkRowCardDone]}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: done }}
                  >
                    {done ? (
                      <CheckSquare size={15} color="#34D399" />
                    ) : (
                      <Square size={15} color="#64748B" />
                    )}
                    <Text style={[styles.checkRowText, done && styles.checkRowTextDone]}>
                      {item.text}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      ) : null}

      {tab === 'chat' ? (
        <ScrollView
          ref={chatScrollRef}
          style={styles.chatScroll}
          nestedScrollEnabled
          contentContainerStyle={styles.chatMessagesList}
        >
            {messages.map((m) => (
              <View
                key={m.id}
                style={[
                  styles.chatBubble,
                  m.role === 'user' ? styles.chatBubbleUser : styles.chatBubbleAssistant,
                ]}
              >
                {m.role === 'assistant' && m.title ? (
                  <View style={styles.chatAiHeaderRow}>
                    <Bot size={14} color="#6EE7B7" />
                    <Text style={styles.chatAiHeaderTitle}>{m.title}</Text>
                  </View>
                ) : null}
                {m.role === 'user' ? (
                  <Text style={styles.chatUserText}>{m.body}</Text>
                ) : (
                  <StructuredAiMessage body={m.body} />
                )}
                {m.formula ? (
                  <View style={[styles.codeBlock, { marginTop: 8 }]}>
                    <Text selectable style={styles.codeText}>{m.formula}</Text>
                  </View>
                ) : null}
              </View>
            ))}
            {messages.length <= 1 && !asking ? (
              <View style={styles.chipRow}>
                {QUICK_AI_PROMPTS.map((sample) => (
                  <Pressable
                    key={sample}
                    onPress={() => void submitQuestion(sample)}
                    style={styles.quickTagChip}
                    accessibilityRole="button"
                  >
                    <Text style={styles.quickTagText}>{sample}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {asking ? (
              <View style={styles.chatLoadingPill}>
                <ActivityIndicator size="small" color="#6EE7B7" />
                <Text style={styles.chatLoadingText}>AI đang trả lời...</Text>
              </View>
            ) : null}
        </ScrollView>
      ) : null}

      <View style={styles.askRow}>
        <TextInput
          value={question}
          onChangeText={setQuestion}
          onSubmitEditing={() => void submitQuestion()}
          returnKeyType="send"
          placeholder="Hỏi AI (VD: lỗi #N/A vlookup, hàm IF, căn lề Word...)"
          placeholderTextColor="#64748B"
          style={styles.askInput}
        />
        <Pressable
          onPress={() => void submitQuestion()}
          disabled={!question.trim() || asking}
          style={[styles.askBtn, question.trim() && !asking ? styles.askBtnActive : null]}
          accessibilityRole="button"
        >
          {asking ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Send size={13} color={question.trim() ? '#FFFFFF' : '#94A3B8'} />
              <Text style={[styles.askBtnText, question.trim() ? styles.askBtnTextActive : null]}>
                Hỏi
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panelBody: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(16,185,129,0.22)',
    gap: 10,
  },
  noteInputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  timePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.45)',
    backgroundColor: 'rgba(16,185,129,0.12)',
  },
  timePillText: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '800',
  },
  noteInput: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 13,
    paddingVertical: 4,
    minWidth: 0,
  },
  addCircleBtn: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCircleBtnActive: {
    backgroundColor: '#10B981',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickTagChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  quickTagText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '700',
  },
  toolbarRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  filterGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
  },
  filterPillActive: {
    borderColor: 'rgba(16,185,129,0.55)',
    backgroundColor: 'rgba(16,185,129,0.14)',
  },
  filterPillText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
  },
  filterPillTextActive: {
    color: '#34D399',
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  exportBtnText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
  },
  exportBtnTextActive: {
    color: '#34D399',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  searchInput: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 12,
    minWidth: 0,
  },
  emptyBox: {
    paddingVertical: 18,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  noteList: {
    gap: 8,
  },
  noteCard: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    padding: 10,
    gap: 6,
  },
  noteCardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  noteLessonBadge: {
    flex: 1,
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  deleteNoteBtn: {
    padding: 4,
    borderRadius: 6,
  },
  noteBodyText: {
    color: '#F1F5F9',
    fontSize: 13,
    lineHeight: 18,
  },
  aiTabWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  aiTabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  aiTabBtnActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  aiTabText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '700',
  },
  aiTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  cardList: {
    gap: 8,
  },
  formulaCard: {
    backgroundColor: '#0B1220',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    padding: 11,
    gap: 8,
  },
  formulaHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  formulaTitle: {
    flex: 1,
    color: '#34D399',
    fontSize: 13,
    fontWeight: '800',
  },
  copyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  copyChipText: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '700',
  },
  copyChipTextActive: {
    color: '#34D399',
  },
  codeBlock: {
    backgroundColor: '#050811',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  codeText: {
    color: '#FBBF24',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  formulaNote: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 17,
  },
  emptyGuideBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 12,
  },
  emptyGuideText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    lineHeight: 17,
  },
  summaryBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 12,
    gap: 8,
  },
  summaryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  summaryTitleText: {
    flex: 1,
    color: '#6EE7B7',
    fontSize: 12,
    fontWeight: '900',
  },
  summaryBody: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    lineHeight: 18,
  },
  shortcutSectionDivider: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 8,
    gap: 6,
  },
  shortcutSectionLabel: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  shortcutBulletList: {
    gap: 4,
    paddingLeft: 4,
  },
  shortcutBulletChar: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    lineHeight: 17,
  },
  shortcutBulletText: {
    flex: 1,
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11.5,
    lineHeight: 17,
  },
  checklistHeading: {
    color: '#6EE7B7',
    fontSize: 12,
    fontWeight: '900',
  },
  checkRowCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    padding: 9,
  },
  checkRowCardDone: {
    borderColor: 'rgba(16,185,129,0.45)',
    backgroundColor: 'rgba(16,185,129,0.1)',
  },
  checkRowText: {
    flex: 1,
    color: 'rgba(255,255,255,0.82)',
    fontSize: 11.5,
    lineHeight: 17,
  },
  checkRowTextDone: {
    color: '#A7F3D0',
  },
  chatContainer: {
    gap: 8,
  },
  chatScroll: {
    maxHeight: 320,
  },
  chatMessagesList: {
    gap: 10,
    paddingRight: 2,
  },
  chatBubble: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
  },
  chatBubbleUser: {
    alignSelf: 'flex-end',
    marginLeft: 28,
    maxWidth: '88%',
    backgroundColor: 'rgba(5,150,105,0.88)',
    borderColor: 'rgba(16,185,129,0.45)',
  },
  chatBubbleAssistant: {
    alignSelf: 'stretch',
    marginRight: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.12)',
  },
  chatAiHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    paddingBottom: 6,
    marginBottom: 8,
  },
  chatAiHeaderTitle: {
    flex: 1,
    color: '#6EE7B7',
    fontSize: 12,
    fontWeight: '900',
  },
  chatUserText: {
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },
  chatLoadingPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  chatLoadingText: {
    color: '#6EE7B7',
    fontSize: 11.5,
    fontWeight: '600',
  },
  mdWrap: {
    gap: 6,
  },
  mdFencedCodeBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  mdFencedCodeText: {
    color: '#FDE68A',
    fontSize: 11.5,
    lineHeight: 17,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  mdHr: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginVertical: 6,
  },
  mdHeadingWrap: {
    marginTop: 4,
    marginBottom: 2,
  },
  mdHeadingMajorWrap: {
    marginTop: 6,
    marginBottom: 3,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(52,211,153,0.2)',
  },
  mdHeadingMajor: {
    color: '#6EE7B7',
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 19,
  },
  mdHeading3: {
    color: '#6EE7B7',
    fontSize: 12.5,
    fontWeight: '800',
    lineHeight: 18,
  },
  mdHeading4: {
    color: '#7DD3FC',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
  },
  mdTableCard: {
    marginVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(0,0,0,0.25)',
    overflow: 'hidden',
  },
  mdTableInner: {
    width: '100%',
  },
  mdTableInnerWide: {
    flexDirection: 'column',
  },
  mdTableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(16,185,129,0.15)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.15)',
  },
  mdTableRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  mdTableRowStriped: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  mdTableCell: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    justifyContent: 'flex-start',
  },
  mdTableCellBorderLeft: {
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.08)',
  },
  mdTableHeaderText: {
    color: '#A7F3D0',
    fontSize: 11.5,
    fontWeight: '800',
    lineHeight: 16,
  },
  mdTableCellText: {
    color: '#E2E8F0',
    fontSize: 11.5,
    lineHeight: 17,
  },
  mdCallout: {
    marginVertical: 4,
    borderLeftWidth: 2,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  mdCalloutTip: {
    borderLeftColor: '#34D399',
    backgroundColor: 'rgba(16,185,129,0.1)',
  },
  mdCalloutWarn: {
    borderLeftColor: '#FBBF24',
    backgroundColor: 'rgba(245,158,11,0.1)',
  },
  mdCalloutTextTip: {
    color: '#D1FAE5',
    fontSize: 11.5,
    lineHeight: 17,
  },
  mdCalloutTextWarn: {
    color: '#FEF3C7',
    fontSize: 11.5,
    lineHeight: 17,
  },
  mdListWrap: {
    gap: 6,
    paddingLeft: 2,
  },
  mdBulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  mdBulletDotCircle: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34D399',
    marginTop: 6,
  },
  mdNumBadge: {
    width: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: 'rgba(16,185,129,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  mdNumBadgeText: {
    color: '#6EE7B7',
    fontSize: 10,
    fontWeight: '900',
  },
  mdText: {
    flex: 1,
    color: '#E2E8F0',
    fontSize: 12,
    lineHeight: 18,
  },
  mdBold: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  mdItalic: {
    fontStyle: 'italic',
    color: '#BAE6FD',
  },
  mdInlineCode: {
    color: '#FDE68A',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  askRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  askInput: {
    flex: 1,
    minWidth: 0,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: '#F8FAFC',
    fontSize: 12,
  },
  askBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  askBtnActive: {
    backgroundColor: '#047857',
    borderColor: '#10B981',
  },
  askBtnText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '800',
  },
  askBtnTextActive: {
    color: '#FFFFFF',
  },
});

