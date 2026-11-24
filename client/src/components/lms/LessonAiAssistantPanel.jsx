import { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Calculator, Check, CheckSquare, Copy, FileText, Loader2, MessageSquare, Send, Sparkles } from 'lucide-react';
import dailyPracticeApi from '../../services/dailyPracticeApi';
import { aiSupportAPI } from '../../services/api';
import AiUsageIndicator, { AI_QUOTA_UPDATED_EVENT, emitAiQuotaUpdated } from '../ui/AiUsageIndicator';

const DEFAULT_CHECKLIST_ITEMS = [
  'Không còn ô hiển thị lỗi #N/A, #VALUE!, #REF!, #NAME?',
  'Đã dùng tham chiếu tuyệt đối $A$1 trước khi kéo công thức xuống.',
  'Số tiền / ngày tháng đã định dạng chuẩn (không nhập chữ vào ô tính toán).',
  'Văn bản Word đã căn đều hai bên, không gõ phím Space liên tiếp để căn lề.',
];

const EXCEL_FORMULAS = [
  {
    name: 'VLOOKUP (Tra cứu theo cột)',
    syntax: '=VLOOKUP(gia_tri_tim, bang_du_lieu, cot_lay, 0)',
    note: 'Nhớ cố định bảng dữ liệu bằng F4 ($A$2:$D$20) và truyền số 0 để tìm chính xác.',
  },
  {
    name: 'IF lồng (Xếp loại điều kiện)',
    syntax: '=IF(D2>=8,"Giỏi",IF(D2>=6.5,"Khá","Trung bình"))',
    note: 'Thứ tự xét điều kiện từ cao xuống thấp (hoặc ngược lại) để tránh sai nhánh.',
  },
  {
    name: 'SUMIFS (Tính tổng nhiều điều kiện)',
    syntax: '=SUMIFS(C2:C50, A2:A50, "Excel", B2:B50, ">=100000")',
    note: 'Tham số đầu tiên là vùng cần cộng tổng; các cặp tiếp theo là (vùng ĐK, ĐK).',
  },
  {
    name: 'COUNTIFS (Đếm nhiều điều kiện)',
    syntax: '=COUNTIFS(B2:B50, "Đã nộp", D2:D50, ">=8")',
    note: 'Đếm nhanh số bài nộp đạt từ 8 điểm trở lên.',
  },
];

const SHORTCUT_TIPS = [
  'Ctrl + S: Lưu bài liên tục để tránh mất dữ liệu.',
  'F4 (Excel): Cố định địa chỉ tuyệt đối $A$1 · (Word/PPT): Lặp lại thao tác vừa làm.',
  'Alt + = (Excel): Tính SUM tự động cực nhanh cho cột/hàng số.',
  'Ctrl + Shift + L (Excel): Bật/tắt bộ lọc AutoFilter.',
  'Ctrl + H: Tìm kiếm và thay thế hàng loạt (Find & Replace).',
];

function buildContextualReply(query, { lessonTitle, unitTitle, courseTitle }) {
  const q = String(query || '').trim().toLowerCase();
  const contextLabel = lessonTitle || unitTitle || courseTitle || 'bài học hiện tại';

  if (!q) return null;
  if (q.includes('vlookup') || q.includes('#n/a') || q.includes('tra cứu')) {
    return {
      title: 'Gợi ý xử lý VLOOKUP & lỗi #N/A',
      body: '1) Kiểm tra giá trị tìm và cột đầu tiên của bảng dò có cùng kiểu chữ/số hay không (dễ dính khoảng trắng thừa — thử bọc TRIM()).\n2) Đảm bảo bảng tra cứu đã cố định F4 ($A$2:$E$100).\n3) Luôn đặt tham số cuối là 0 (FALSE) để dò chính xác.',
      formula: '=IFERROR(VLOOKUP(A2, $E$2:$G$50, 2, 0), "Không tìm thấy")',
    };
  }
  if (q.includes('if') || q.includes('điều kiện') || q.includes('xếp loại')) {
    return {
      title: 'Cấu trúc hàm IF / AND / OR chuẩn',
      body: 'Khi kết hợp nhiều điều kiện đồng thời dùng AND(...), một trong các điều kiện dùng OR(...). Chuỗi chữ trong công thức phải đặt trong dấu ngoặc kép "".',
      formula: '=IF(AND(B2>=5, C2>=5), "Đạt", "Cần ôn lại")',
    };
  }
  if (q.includes('sum') || q.includes('tổng') || q.includes('đếm') || q.includes('count')) {
    return {
      title: 'Tối ưu SUMIF / SUMIFS / COUNTIFS',
      body: 'Nếu có 1 điều kiện dùng SUMIF/COUNTIF; từ 2 điều kiện trở lên bắt buộc chuyển sang SUMIFS/COUNTIFS (lưu ý SUMIFS đưa vùng tính tổng lên ĐẦU TIÊN).',
      formula: '=SUMIFS($D$2:$D$100, $B$2:$B$100, "Word", $C$2:$C$100, ">0")',
    };
  }
  if (q.includes('word') || q.includes('căn lề') || q.includes('nghị định 30') || q.includes('mục lục')) {
    return {
      title: 'Checklist chuẩn thể thức Word',
      body: '• Cỡ chữ thường 13–14pt (Times New Roman), giãn dòng 1.15–1.3.\n• Lề Nghị định 30: Trên 20mm, Dưới 20mm, Trái 30mm, Phải 15mm.\n• Dùng Styles (Heading 1, 2) trước khi chèn References → Table of Contents.',
    };
  }
  if (q.includes('slide') || q.includes('powerpoint') || q.includes('ppt') || q.includes('thuyết trình')) {
    return {
      title: 'Mẹo thiết kế slide PowerPoint chuyên nghiệp',
      body: '• Thiết lập bố cục chung bằng View → Slide Master để đồng bộ font & logo.\n• Quy tắc 6x6: tối đa 6 gạch đầu dòng, mỗi dòng gọn ≤ 6-8 chữ.\n• Dùng Shift khi kéo hình/ảnh để giữ đúng tỷ lệ không bị méo.',
    };
  }
  return {
    title: `Trợ lý bài "${contextLabel}"`,
    body: `Với nội dung "${contextLabel}", bạn hãy chia nhỏ bài tập thành 3 bước: (1) Đọc kỹ yêu cầu định dạng/dữ liệu đầu vào, (2) Thực hiện từng hàm hoặc thao tác theo trình tự từ dễ đến khó, (3) Dùng phím tắt Ctrl + Z để thử nghiệm an toàn và rà lại kết quả trước khi nộp.`,
  };
}

function renderInlineMarkdown(text, keyPrefix = 'in') {
  const src = String(text || '');
  const nodes = [];
  const tokenRe = /(`[^`\n]+`|\*\*[^*\n]+?\*\*|\*[^*\n]+?\*)/g;
  let last = 0;
  let idx = 0;
  let match;
  while ((match = tokenRe.exec(src)) !== null) {
    if (match.index > last) {
      nodes.push(src.slice(last, match.index));
    }
    const token = match[0];
    if (token.startsWith('`') && token.endsWith('`')) {
      nodes.push(
        <code
          key={`${keyPrefix}-c-${idx++}`}
          className="rounded bg-black/45 px-1.5 py-0.5 font-mono text-[11px] text-amber-200 border border-white/10"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith('**') && token.endsWith('**')) {
      nodes.push(
        <strong key={`${keyPrefix}-b-${idx++}`} className="font-bold text-white">
          {renderInlineMarkdown(token.slice(2, -2), `${keyPrefix}-b-${idx}`)}
        </strong>,
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      nodes.push(
        <em key={`${keyPrefix}-i-${idx++}`} className="italic text-sky-200">
          {token.slice(1, -1)}
        </em>,
      );
    }
    last = tokenRe.lastIndex;
  }
  if (last < src.length) nodes.push(src.slice(last));
  return nodes;
}

function splitTableCells(line) {
  return String(line || '')
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function isTableSeparator(line) {
  const cells = splitTableCells(line);
  return cells.length >= 2 && cells.every((c) => /^:?-{2,}:?$/.test(c));
}

function AiMarkdownContent({ content }) {
  const lines = String(content || '').replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    // Fenced code block
    if (trimmed.startsWith('```')) {
      const codeLines = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1;
      blocks.push(
        <pre
          key={`code-${blocks.length}`}
          className="overflow-x-auto rounded-xl border border-white/10 bg-black/50 px-3 py-2 font-mono text-[11px] leading-relaxed text-amber-200"
        >
          <code>{codeLines.join('\n')}</code>
        </pre>,
      );
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push(<hr key={`hr-${blocks.length}`} className="my-2 border-white/10" />);
      i += 1;
      continue;
    }

    // Heading (# .. ####)
    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const cls = level <= 2
        ? 'mt-2.5 mb-1 text-[13px] font-black text-emerald-300 border-b border-emerald-400/20 pb-1'
        : level === 3
          ? 'mt-2 mb-1 text-[12.5px] font-extrabold text-emerald-300'
          : 'mt-1.5 mb-0.5 text-[12px] font-extrabold text-sky-300';
      blocks.push(
        <h4 key={`h-${blocks.length}`} className={cls}>
          {renderInlineMarkdown(text, `h-${blocks.length}`)}
        </h4>,
      );
      i += 1;
      continue;
    }

    // Table
    if (trimmed.includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const headers = splitTableCells(trimmed);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].trim().includes('|')) {
        rows.push(splitTableCells(lines[i]));
        i += 1;
      }
      blocks.push(
        <div key={`tbl-${blocks.length}`} className="my-2 overflow-x-auto rounded-xl border border-white/15 bg-black/25">
          <table className="w-full border-collapse text-left text-[11.5px]">
            <thead className="bg-emerald-500/15 text-emerald-200">
              <tr>
                {headers.map((h, hIdx) => (
                  <th key={hIdx} className="border-b border-white/15 px-2.5 py-1.5 font-extrabold">
                    {renderInlineMarkdown(h, `th-${blocks.length}-${hIdx}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 text-slate-200">
              {rows.map((row, rIdx) => (
                <tr key={rIdx} className={rIdx % 2 === 1 ? 'bg-white/[0.04]' : 'bg-transparent'}>
                  {headers.map((_, cIdx) => (
                    <td key={cIdx} className="px-2.5 py-1.5 align-top leading-relaxed">
                      {renderInlineMarkdown(row[cIdx] || '', `td-${blocks.length}-${rIdx}-${cIdx}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // Blockquote / Callout
    if (trimmed.startsWith('>')) {
      const quoteLines = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i += 1;
      }
      const joined = quoteLines.join('\n');
      const isTip = /💡|✅|Mẹo|Gợi ý/i.test(joined);
      blocks.push(
        <div
          key={`q-${blocks.length}`}
          className={`my-1.5 rounded-r-xl border-l-2 px-3 py-2 text-[11.5px] leading-relaxed ${
            isTip
              ? 'border-emerald-400 bg-emerald-500/10 text-emerald-100'
              : 'border-amber-400 bg-amber-500/10 text-amber-100'
          }`}
        >
          {quoteLines.map((ql, qIdx) => (
            <p key={qIdx} className={qIdx > 0 ? 'mt-1' : ''}>
              {renderInlineMarkdown(ql, `q-${blocks.length}-${qIdx}`)}
            </p>
          ))}
        </div>,
      );
      continue;
    }

    // Bullet list (* or -)
    if (/^[-*•]\s+/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) {
        items.push(lines[i].trim().replace(/^[-*•]\s+/, ''));
        i += 1;
      }
      blocks.push(
        <ul key={`ul-${blocks.length}`} className="my-1 space-y-1.5 pl-1">
          {items.map((item, liIdx) => (
            <li key={liIdx} className="flex items-start gap-2 text-[12px] leading-relaxed text-slate-200">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" aria-hidden="true" />
              <span className="min-w-0 flex-1">{renderInlineMarkdown(item, `ul-${blocks.length}-${liIdx}`)}</span>
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    // Numbered list (1. 2. ...)
    if (/^\d+[.)]\s+/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        const m = lines[i].trim().match(/^(\d+)[.)]\s+(.+)$/);
        if (m) items.push({ num: m[1], text: m[2] });
        i += 1;
      }
      blocks.push(
        <ol key={`ol-${blocks.length}`} className="my-1 space-y-1.5 pl-0.5">
          {items.map((item, liIdx) => (
            <li key={liIdx} className="flex items-start gap-2 text-[12px] leading-relaxed text-slate-200">
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[10px] font-black text-emerald-300">
                {item.num}
              </span>
              <span className="min-w-0 flex-1">{renderInlineMarkdown(item.text, `ol-${blocks.length}-${liIdx}`)}</span>
            </li>
          ))}
        </ol>,
      );
      continue;
    }

    // Normal paragraph
    const paraLines = [];
    while (
      i < lines.length
      && lines[i].trim()
      && !lines[i].trim().startsWith('```')
      && !/^(#{1,4}\s+|[-*•]\s+|\d+[.)]\s+|>\s?|---|\*\*\*)/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i].trim());
      i += 1;
    }
    blocks.push(
      <p key={`p-${blocks.length}`} className="text-[12px] leading-relaxed text-slate-200">
        {renderInlineMarkdown(paraLines.join(' '), `p-${blocks.length}`)}
      </p>,
    );
  }

  return <div className="space-y-1.5">{blocks}</div>;
}

export default function LessonAiAssistantPanel({ lessonTitle = '', unitTitle = '', courseTitle = '', guide = null }) {
  const isCustom = Boolean(guide?.customized);
  const formulasList = isCustom ? (guide?.formulas || []) : EXCEL_FORMULAS;
  const focusSummaryText = isCustom
    ? String(guide?.focusSummary || '').trim()
    : 'Hoàn thành video bài giảng (≥ 67% để mở bài tiếp, ≥ 90% để nhận tối đa XP), sau đó áp dụng đúng công thức/định dạng vào file thực hành.';
  const shortcutList = isCustom ? (guide?.shortcuts || []) : SHORTCUT_TIPS;
  const checklistItems = isCustom ? (guide?.checklist || []) : DEFAULT_CHECKLIST_ITEMS;

  const [tab, setTab] = useState(() => {
    if (isCustom && !formulasList.length) {
      if (focusSummaryText || shortcutList.length) return 'summary';
      if (checklistItems.length) return 'check';
      return 'chat';
    }
    return 'excel';
  });
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState(-1);
  const [aiDailyQuota, setAiDailyQuota] = useState(null);
  const chatScrollRef = useRef(null);
  const [messages, setMessages] = useState(() => ([
    {
      role: 'ai',
      title: `Xin chào! Mình là Trợ lý AI cho "${lessonTitle || unitTitle || 'bài học'}"`,
      body: 'Bạn cần gợi ý công thức Excel, tóm tắt trọng tâm bài hay kiểm lỗi trước khi nộp bài thực hành? Hãy chọn nút gợi ý nhanh hoặc nhập câu hỏi bên dưới nhé!',
    },
  ]));

  const contextSummary = useMemo(() => ({
    lessonTitle,
    unitTitle,
    courseTitle,
  }), [lessonTitle, unitTitle, courseTitle]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await aiSupportAPI.status();
        if (!cancelled && res?.success && res?.data?.dailyQuota) {
          setAiDailyQuota(res.data.dailyQuota);
        }
      } catch { /* quota display optional */ }
    })();
    const onQuotaUpdated = (event) => {
      const detail = event?.detail;
      if (!detail || typeof detail !== 'object') return;
      if (!detail.questionQuota && !detail.imageQuota) return;
      setAiDailyQuota((prev) => ({
        ...(prev || {}),
        ...(detail.questionQuota ? { questionQuota: detail.questionQuota } : {}),
        ...(detail.imageQuota ? { imageQuota: detail.imageQuota } : {}),
      }));
    };
    window.addEventListener(AI_QUOTA_UPDATED_EVENT, onQuotaUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener(AI_QUOTA_UPDATED_EVENT, onQuotaUpdated);
    };
  }, []);

  const questionQuotaApplies = Boolean(aiDailyQuota?.questionQuota?.applies ?? true);
  const rawPercentLeft = aiDailyQuota?.questionQuota?.percentLeft ?? aiDailyQuota?.questionQuota?.remaining;
  const questionQuotaLeft = rawPercentLeft != null
    ? Math.max(0, Math.min(100, Number(rawPercentLeft)))
    : 100;
  const questionQuotaBlocked = questionQuotaApplies && !(questionQuotaLeft > 0);
  const rawImageLimit = aiDailyQuota?.imageQuota?.limit;
  const imageDisallowed = Boolean(
    aiDailyQuota?.imageQuota
    && (aiDailyQuota.imageQuota.allowed === false
      || (rawImageLimit !== null && rawImageLimit !== undefined && rawImageLimit !== '' && Number(rawImageLimit) === 0)),
  );

  useEffect(() => {
    if (tab !== 'chat' || !chatScrollRef.current) return;
    chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [tab, messages, asking]);

  const copyFormula = async (text, idx) => {
    try {
      await navigator.clipboard?.writeText(text);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(-1), 1800);
    } catch {
      /* ignore */
    }
  };

  const ask = async (e) => {
    e.preventDefault();
    const cleaned = question.trim();
    if (!cleaned || asking || questionQuotaBlocked) return;

    const historySnapshot = messages.slice(1).slice(-6).map((m) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      body: m.body || '',
    }));

    setMessages((prev) => [...prev, { role: 'user', body: cleaned }]);
    setQuestion('');
    setTab('chat');
    setAsking(true);

    try {
      const res = await dailyPracticeApi.student.askLessonAssistant({
        question: cleaned,
        lessonTitle: contextSummary.lessonTitle,
        unitTitle: contextSummary.unitTitle,
        courseTitle: contextSummary.courseTitle,
        history: historySnapshot,
      });
      if (res?.questionQuota || res?.imageQuota) {
        setAiDailyQuota((prev) => ({
          ...(prev || {}),
          ...(res.questionQuota ? { questionQuota: res.questionQuota } : {}),
          ...(res.imageQuota ? { imageQuota: res.imageQuota } : {}),
        }));
      }
      const answer = String(res?.answer || '').trim();
      setMessages((prev) => [
        ...prev,
        {
          role: 'ai',
          title: `Trợ lý AI · ${contextSummary.lessonTitle || contextSummary.unitTitle || 'Bài học'}`,
          body: answer || 'Mình chưa nhận được phản hồi rõ ràng, bạn thử hỏi lại chi tiết hơn nhé.',
        },
      ]);
    } catch (err) {
      if (err?.code === 'AI_QUESTION_QUOTA' || err?.status === 403) {
        const exhaustedQuota = {
          ...(aiDailyQuota?.questionQuota || {}),
          ...(err?.questionQuota || {}),
          applies: true,
          mode: 'percent',
          limit: 100,
          remaining: 0,
          percentLeft: 0,
          used: 100,
          percentUsed: 100,
        };
        const nextDaily = {
          ...(aiDailyQuota || {}),
          questionQuota: exhaustedQuota,
          ...(err?.imageQuota ? { imageQuota: err.imageQuota } : {}),
        };
        setAiDailyQuota(nextDaily);
        emitAiQuotaUpdated(nextDaily);
        setMessages((prev) => [
          ...prev,
          {
            role: 'ai',
            title: 'Đã hết hạn mức AI hôm nay',
            body: err?.message || 'Bạn đã dùng hết 100% hạn mức AI hôm nay. Hạn mức sẽ tự động làm mới vào 00:00.',
          },
        ]);
        return;
      }
      const fallback = buildContextualReply(cleaned, contextSummary);
      const errMsg = err?.message || 'Không kết nối được máy chủ AI';
      setMessages((prev) => [
        ...prev,
        {
          role: 'ai',
          title: 'Trợ lý AI (tạm thời ngoại tuyến)',
          body: `${errMsg}\n\n${fallback?.body || ''}`.trim(),
          ...(fallback?.formula ? { formula: fallback.formula } : {}),
        },
      ]);
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className="space-y-3 text-slate-100">
      <div className="flex flex-wrap gap-1.5">
        {[
          { key: 'excel', icon: Calculator, label: 'Công thức Excel' },
          { key: 'summary', icon: FileText, label: 'Trọng tâm & Phím tắt' },
          { key: 'check', icon: CheckSquare, label: 'Tự chấm bài thực hành' },
          { key: 'chat', icon: MessageSquare, label: 'Hỏi đáp AI' },
        ].map((item) => {
          const TabIcon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[11px] font-bold transition !shadow-none ${
                tab === item.key
                  ? 'bg-emerald-500 text-white'
                  : 'bg-white/10 text-white/75 hover:bg-white/15'
              }`}
            >
              <TabIcon size={12} aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {tab === 'excel' && (
        <div className="space-y-2">
          {formulasList.length === 0 ? (
            <p className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-xs text-white/60">
              Bài học này chưa thêm công thức riêng. Bạn có thể hỏi đáp trực tiếp với Trợ lý AI bên dưới.
            </p>
          ) : (
            formulasList.map((item, idx) => (
              <div key={`${item.name}-${idx}`} className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-black text-emerald-300">{item.name}</p>
                  {item.syntax ? (
                    <button
                      type="button"
                      onClick={() => copyFormula(item.syntax, idx)}
                      className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 text-[10px] font-bold text-white hover:bg-white/20 !shadow-none"
                    >
                      {copiedIdx === idx ? <Check size={11} /> : <Copy size={11} />}
                      {copiedIdx === idx ? 'Đã chép' : 'Chép'}
                    </button>
                  ) : null}
                </div>
                {item.syntax ? (
                  <code className="mt-1.5 block overflow-x-auto rounded-lg bg-black/40 px-2.5 py-1.5 font-mono text-[11px] text-amber-200">
                    {item.syntax}
                  </code>
                ) : null}
                {item.note ? (
                  <p className="mt-1 text-[11px] text-white/65">{item.note}</p>
                ) : null}
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'summary' && (
        <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-xs">
          <p className="font-black text-emerald-300 flex items-center gap-1.5">
            <Sparkles size={13} /> Trọng tâm: {lessonTitle || unitTitle || courseTitle || 'Bài học'}
          </p>
          {focusSummaryText ? (
            <p className="whitespace-pre-line text-white/75 leading-relaxed">
              {focusSummaryText}
            </p>
          ) : null}
          {shortcutList.length > 0 ? (
            <div className={focusSummaryText ? 'border-t border-white/10 pt-2' : ''}>
              <p className="font-bold text-white/90 mb-1">Phím tắt nên nhớ:</p>
              <ul className="space-y-1 text-[11px] text-white/70 list-disc pl-4">
                {shortcutList.map((tip, i) => <li key={`${tip}-${i}`}>{tip}</li>)}
              </ul>
            </div>
          ) : (!focusSummaryText ? (
            <p className="text-[11px] text-white/60">Chưa có nội dung trọng tâm riêng cho bài học này.</p>
          ) : null)}
        </div>
      )}

      {tab === 'check' && (
        <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-xs">
          <p className="font-black text-emerald-300">Checklist rà lỗi trước khi nộp bài thực hành:</p>
          {checklistItems.length === 0 ? (
            <p className="text-[11px] text-white/60">Chưa có checklist riêng cho bài học này.</p>
          ) : (
            <ul className="space-y-1.5 text-[11px] text-white/80">
              {checklistItems.map((line, i) => (
                <li key={`${line}-${i}`} className="flex items-start gap-2">
                  <Check size={13} className="mt-0.5 shrink-0 text-emerald-400" aria-hidden="true" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'chat' && (
        <div ref={chatScrollRef} className="max-h-80 space-y-2.5 overflow-y-auto pr-1">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`rounded-2xl px-3.5 py-2.5 ${
                msg.role === 'user'
                  ? 'ml-8 bg-emerald-600/85 text-white text-[12px] font-medium shadow-xs'
                  : 'mr-2 border border-white/12 bg-white/[0.05] text-slate-200'
              }`}
            >
              {msg.title && (
                <p className="mb-1.5 flex items-center gap-1.5 border-b border-white/10 pb-1.5 text-xs font-black text-emerald-300">
                  <Bot size={14} className="shrink-0" /> {msg.title}
                </p>
              )}
              {msg.role === 'user' ? (
                <p className="whitespace-pre-line leading-relaxed">{msg.body}</p>
              ) : (
                <AiMarkdownContent content={msg.body} />
              )}
              {msg.formula && (
                <code className="mt-2 block overflow-x-auto rounded-lg border border-white/10 bg-black/45 px-2.5 py-1.5 font-mono text-[11px] text-amber-200">
                  {msg.formula}
                </code>
              )}
            </div>
          ))}
          {asking && (
            <div className="mr-4 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-[11px] font-semibold text-emerald-300">
              <Loader2 size={13} className="animate-spin" /> AI đang trả lời...
            </div>
          )}
        </div>
      )}

      <form onSubmit={ask} className="space-y-1.5">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={question}
            disabled={asking || questionQuotaBlocked}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={
              questionQuotaBlocked
                ? 'Đã hết hạn mức AI hôm nay — chờ reset để tiếp tục hỏi'
                : 'Hỏi AI (VD: lỗi #N/A vlookup, hàm IF, căn lề Word...)'
            }
            className="min-w-0 flex-1 rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-xs text-white placeholder:text-white/40 focus:border-emerald-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-55"
          />
          <button
            type="submit"
            disabled={!question.trim() || asking || questionQuotaBlocked}
            className="inline-flex items-center gap-1 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-black text-white hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40 !shadow-none"
          >
            {asking ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            {asking ? 'Đang hỏi' : 'Hỏi'}
          </button>
        </div>
        <AiUsageIndicator
          dark
          applies={questionQuotaApplies}
          percentLeft={questionQuotaLeft}
          resetInMs={aiDailyQuota?.questionQuota?.resetInMs}
          resetsAt={aiDailyQuota?.questionQuota?.resetsAt}
          imageDisallowed={imageDisallowed}
          isFreeTier={imageDisallowed}
          className="px-0.5"
        />
      </form>
    </div>
  );
}

