import { useMemo, useState } from 'react';
import { Bot, Check, Copy, Send, Sparkles } from 'lucide-react';

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

export default function LessonAiAssistantPanel({ lessonTitle = '', unitTitle = '', courseTitle = '' }) {
  const [tab, setTab] = useState('excel');
  const [question, setQuestion] = useState('');
  const [copiedIdx, setCopiedIdx] = useState(-1);
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

  const copyFormula = async (text, idx) => {
    try {
      await navigator.clipboard?.writeText(text);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(-1), 1800);
    } catch {
      /* ignore */
    }
  };

  const ask = (e) => {
    e.preventDefault();
    const cleaned = question.trim();
    if (!cleaned) return;
    const reply = buildContextualReply(cleaned, contextSummary);
    setMessages((prev) => [
      ...prev,
      { role: 'user', body: cleaned },
      { role: 'ai', ...reply },
    ]);
    setQuestion('');
    setTab('chat');
  };

  return (
    <div className="space-y-3 text-slate-100">
      <div className="flex flex-wrap gap-1.5">
        {[
          { key: 'excel', label: '📊 Công thức Excel' },
          { key: 'summary', label: '📝 Trọng tâm & Phím tắt' },
          { key: 'check', label: '🛠️ Tự chấm bài thực hành' },
          { key: 'chat', label: '💬 Hỏi đáp AI' },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`rounded-xl px-2.5 py-1.5 text-[11px] font-bold transition !shadow-none ${
              tab === item.key
                ? 'bg-emerald-500 text-white'
                : 'bg-white/10 text-white/75 hover:bg-white/15'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'excel' && (
        <div className="space-y-2">
          {EXCEL_FORMULAS.map((item, idx) => (
            <div key={item.name} className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-black text-emerald-300">{item.name}</p>
                <button
                  type="button"
                  onClick={() => copyFormula(item.syntax, idx)}
                  className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 text-[10px] font-bold text-white hover:bg-white/20 !shadow-none"
                >
                  {copiedIdx === idx ? <Check size={11} /> : <Copy size={11} />}
                  {copiedIdx === idx ? 'Đã chép' : 'Chép'}
                </button>
              </div>
              <code className="mt-1.5 block overflow-x-auto rounded-lg bg-black/40 px-2.5 py-1.5 font-mono text-[11px] text-amber-200">
                {item.syntax}
              </code>
              <p className="mt-1 text-[11px] text-white/65">{item.note}</p>
            </div>
          ))}
        </div>
      )}

      {tab === 'summary' && (
        <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-xs">
          <p className="font-black text-emerald-300 flex items-center gap-1.5">
            <Sparkles size={13} /> Trọng tâm: {lessonTitle || unitTitle || courseTitle || 'Bài học'}
          </p>
          <p className="text-white/75 leading-relaxed">
            Hoàn thành video bài giảng (≥ 67% để mở bài tiếp, ≥ 90% để nhận tối đa XP), sau đó áp dụng đúng công thức/định dạng vào file thực hành.
          </p>
          <div className="border-t border-white/10 pt-2">
            <p className="font-bold text-white/90 mb-1">Phím tắt nên nhớ:</p>
            <ul className="space-y-1 text-[11px] text-white/70 list-disc pl-4">
              {SHORTCUT_TIPS.map((tip) => <li key={tip}>{tip}</li>)}
            </ul>
          </div>
        </div>
      )}

      {tab === 'check' && (
        <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-xs">
          <p className="font-black text-emerald-300">Checklist rà lỗi trước khi nộp bài thực hành:</p>
          <ul className="space-y-1.5 text-[11px] text-white/80">
            <li>✓ Không còn ô hiển thị lỗi <code className="text-rose-300">#N/A, #VALUE!, #REF!, #NAME?</code></li>
            <li>✓ Đã dùng tham chiếu tuyệt đối <code className="text-amber-200">$A$1</code> trước khi kéo công thức xuống.</li>
            <li>✓ Số tiền / ngày tháng đã định dạng chuẩn (không nhập chữ vào ô tính toán).</li>
            <li>✓ Văn bản Word đã căn đều hai bên, không gõ phím Space liên tiếp để căn lề.</li>
          </ul>
        </div>
      )}

      {tab === 'chat' && (
        <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`rounded-xl px-3 py-2 text-xs ${
                msg.role === 'user'
                  ? 'ml-6 bg-emerald-600/80 text-white'
                  : 'mr-4 border border-white/10 bg-white/[0.06] text-white/90'
              }`}
            >
              {msg.title && (
                <p className="font-black text-emerald-300 mb-1 flex items-center gap-1.5">
                  <Bot size={13} /> {msg.title}
                </p>
              )}
              <p className="whitespace-pre-line leading-relaxed text-[11px]">{msg.body}</p>
              {msg.formula && (
                <code className="mt-1.5 block overflow-x-auto rounded-lg bg-black/40 px-2 py-1 font-mono text-[11px] text-amber-200">
                  {msg.formula}
                </code>
              )}
            </div>
          ))}
        </div>
      )}

      <form onSubmit={ask} className="flex items-center gap-2">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Hỏi AI (VD: lỗi #N/A vlookup, hàm IF, căn lề Word...)"
          className="min-w-0 flex-1 rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-xs text-white placeholder:text-white/40 focus:border-emerald-400 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!question.trim()}
          className="inline-flex items-center gap-1 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-black text-white hover:bg-emerald-400 disabled:opacity-40 !shadow-none"
        >
          <Send size={13} /> Hỏi
        </button>
      </form>
    </div>
  );
}

