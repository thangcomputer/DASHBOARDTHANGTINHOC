import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Compass, RotateCcw, Sparkles, Target, X } from 'lucide-react';

const STORAGE_PREFIX = 'dewskill_placement_v1';

const QUESTIONS = [
  {
    id: 'win1',
    skill: 'Windows & Cơ bản',
    keywords: ['windows', 'cơ bản', 'tin học'],
    question: 'Phím tắt nào dùng để sao chép tệp tin hoặc đoạn văn bản đã chọn trong Windows?',
    options: ['Ctrl + X', 'Ctrl + C', 'Ctrl + V', 'Ctrl + Z'],
    answer: 1,
    tip: 'Ctrl + C sao chép, Ctrl + X cắt, Ctrl + V dán và Ctrl + Z hoàn tác.',
  },
  {
    id: 'win2',
    skill: 'Windows & Cơ bản',
    keywords: ['windows', 'cơ bản', 'tin học'],
    question: 'Đuôi tệp mặc định của tài liệu Microsoft Word phiên bản mới (2007 trở đi) là gì?',
    options: ['.xlsx', '.pptx', '.docx', '.pdf'],
    answer: 2,
    tip: '.docx là Word, .xlsx là Excel, .pptx là PowerPoint.',
  },
  {
    id: 'word1',
    skill: 'Microsoft Word',
    keywords: ['word', 'soạn thảo'],
    question: 'Theo Nghị định 30/2020/NĐ-CP về thể thức văn bản hành chính trong Word, lề trái chuẩn là bao nhiêu?',
    options: ['15 - 20 mm', '20 - 25 mm', '30 - 35 mm', '40 - 45 mm'],
    answer: 2,
    tip: 'Lề chuẩn Nghị định 30: Trên 20-25mm, Dưới 20-25mm, Trái 30-35mm, Phải 15-20mm.',
  },
  {
    id: 'word2',
    skill: 'Microsoft Word',
    keywords: ['word', 'soạn thảo'],
    question: 'Để tạo mục lục tự động trong Word, trước tiên ta cần gán thành phần nào cho các đề mục?',
    options: ['Heading (Heading 1, 2, 3...)', 'Watermark', 'Drop Cap', 'Header & Footer'],
    answer: 0,
    tip: 'Dùng Styles Heading 1/2/3 sau đó chọn References → Table of Contents.',
  },
  {
    id: 'word3',
    skill: 'Microsoft Word',
    keywords: ['word', 'soạn thảo'],
    question: 'Chức năng Mail Merge (Trộn thư) trong Microsoft Word dùng để làm gì?',
    options: [
      'Nén dung lượng ảnh trong văn bản',
      'Tạo hàng loạt thư mời/giấy chứng nhận từ danh sách Excel có sẵn',
      'Kiểm tra lỗi chính tả tiếng Việt',
      'Chuyển Word sang PowerPoint',
    ],
    answer: 1,
    tip: 'Mailings → Select Recipients giúp ghép nguồn dữ liệu Excel vào mẫu Word hàng loạt.',
  },
  {
    id: 'excel1',
    skill: 'Microsoft Excel',
    keywords: ['excel', 'bảng tính'],
    question: 'Ký hiệu nào dùng để cố định địa chỉ ô/vùng (tham chiếu tuyệt đối) trong công thức Excel?',
    options: ['# (ví dụ #A#1)', '$ (ví dụ $A$1)', '& (ví dụ &A&1)', '% (ví dụ %A%1)'],
    answer: 1,
    tip: 'Nhấn F4 khi chọn địa chỉ ô để chuyển đổi nhanh $A$1.',
  },
  {
    id: 'excel2',
    skill: 'Microsoft Excel',
    keywords: ['excel', 'bảng tính'],
    question: 'Trong hàm VLOOKUP(lookup_value, table_array, col_index_num, [range_lookup]), tham số thứ 4 để tìm kiếm CHÍNH XÁC là?',
    options: ['0 hoặc FALSE', '1 hoặc TRUE', '2', '"EXACT"'],
    answer: 0,
    tip: 'Luôn dùng 0 (hoặc FALSE) khi tra cứu mã NV, mã SP để tránh trả nhầm giá trị gần đúng.',
  },
  {
    id: 'excel3',
    skill: 'Microsoft Excel',
    keywords: ['excel', 'bảng tính'],
    question: 'Hàm nào dùng để tính tổng theo NHIỀU điều kiện cùng lúc trong Excel?',
    options: ['SUM', 'SUMIF', 'SUMIFS', 'COUNTIFS'],
    answer: 2,
    tip: 'SUMIFS(vùng_tính_tổng, vùng_đk1, đk1, vùng_đk2, đk2...) hỗ trợ nhiều điều kiện.',
  },
  {
    id: 'ppt1',
    skill: 'Microsoft PowerPoint',
    keywords: ['powerpoint', 'ppt', 'trình chiếu'],
    question: 'Để chèn logo hoặc khung tiêu đề thống nhất cho TẤT CẢ các slide trong PowerPoint, bạn chỉnh sửa ở đâu?',
    options: ['Slide Sorter', 'Slide Master', 'Notes Page', 'Reading View'],
    answer: 1,
    tip: 'Vào View → Slide Master để thiết kế layout dùng chung cho toàn bài thuyết trình.',
  },
  {
    id: 'ppt2',
    skill: 'Microsoft PowerPoint',
    keywords: ['powerpoint', 'ppt', 'trình chiếu'],
    question: 'Nhóm hiệu ứng Transition trong PowerPoint khác Animation ở điểm nào?',
    options: [
      'Transition là hiệu ứng chuyển trang giữa các Slide; Animation là hiệu ứng cho từng đối tượng trên Slide',
      'Transition chỉ áp dụng cho chữ; Animation chỉ áp dụng cho hình ảnh',
      'Hai tính năng hoàn toàn giống nhau',
      'Transition dùng để chèn âm thanh nền',
    ],
    answer: 0,
    tip: 'Transition điều khiển cách sang trang slide, Animation tạo chuyển động cho từng vật thể.',
  },
];

export function readPlacementResult(studentId) {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}:${studentId || 'guest'}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function savePlacementResult(studentId, result) {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}:${studentId || 'guest'}`, JSON.stringify(result));
  } catch {
    /* ignore */
  }
}

export function computePlacementRecommendation(answers, topics = []) {
  const buckets = {};
  let totalCorrect = 0;
  for (const q of QUESTIONS) {
    if (!buckets[q.skill]) {
      buckets[q.skill] = { skill: q.skill, keywords: q.keywords, correct: 0, total: 0 };
    }
    buckets[q.skill].total += 1;
    if (answers[q.id] === q.answer) {
      buckets[q.skill].correct += 1;
      totalCorrect += 1;
    }
  }
  const bySkill = Object.values(buckets).map((b) => ({
    ...b,
    percent: Math.round((b.correct / Math.max(1, b.total)) * 100),
  }));
  const sortedWeakest = [...bySkill].sort((a, b) => a.percent - b.percent || a.correct - b.correct);
  const recommended = sortedWeakest[0] || bySkill[0];

  let recommendedLevel = 'Cơ bản (Lấy lại nền tảng)';
  if (totalCorrect >= 8) recommendedLevel = 'Nâng cao (Thực chiến & Luyện đề)';
  else if (totalCorrect >= 5) recommendedLevel = 'Trung cấp (Tăng tốc kỹ năng văn phòng)';

  const matchedTopic = (topics || []).find((t) => {
    const name = String(t?.name || t?.topic?.name || '').toLowerCase();
    return recommended.keywords.some((kw) => name.includes(kw));
  });

  return {
    score: totalCorrect,
    total: QUESTIONS.length,
    bySkill,
    recommendedSkill: recommended.skill,
    recommendedLevel,
    matchedTopicId: matchedTopic ? String(matchedTopic.id || matchedTopic.topic?.id || '') : '',
    matchedTopicName: matchedTopic ? (matchedTopic.name || matchedTopic.topic?.name || '') : recommended.skill,
    completedAt: new Date().toISOString(),
  };
}

export default function PlacementTestModal({ open, onClose, studentId, topics = [], onApplied }) {
  const existing = useMemo(() => readPlacementResult(studentId), [studentId, open]);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);

  if (!open) return null;

  const activeResult = result || (Object.keys(answers).length === 0 ? existing : null);
  const current = QUESTIONS[step];
  const answeredCount = Object.keys(answers).length;

  const choose = (optIndex) => {
    const next = { ...answers, [current.id]: optIndex };
    setAnswers(next);
    if (step < QUESTIONS.length - 1) {
      setTimeout(() => setStep((s) => Math.min(QUESTIONS.length - 1, s + 1)), 180);
    }
  };

  const finish = () => {
    const computed = computePlacementRecommendation(answers, topics);
    savePlacementResult(studentId, computed);
    setResult(computed);
  };

  const resetTest = () => {
    setAnswers({});
    setStep(0);
    setResult({ __retaking: true });
  };

  const showResultScreen = activeResult && !activeResult.__retaking;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/65 p-3 sm:p-5 backdrop-blur-xs">
      <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-emerald-50 via-white to-teal-50 px-5 py-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm">
              <Compass size={19} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-base font-black text-slate-900">
                Kiểm tra đầu vào · Gợi ý lộ trình cá nhân hóa
              </h2>
              <p className="text-xs font-medium text-slate-500">
                10 câu đánh giá nhanh Windows, Word, Excel, PowerPoint
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {showResultScreen ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-emerald-700">Kết quả đánh giá AI</p>
                    <p className="mt-1 text-2xl font-black text-slate-900">
                      {activeResult.score}/{activeResult.total} câu đúng
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-black text-white">
                    {activeResult.recommendedLevel}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-700">
                  🤖 Đề xuất ưu tiên luyện ngay: <strong className="text-emerald-700">{activeResult.matchedTopicName}</strong>{' '}
                  (Kỹ năng cần củng cố nhất: <strong>{activeResult.recommendedSkill}</strong>).
                </p>
              </div>

              <div className="space-y-2.5">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
                  Mức độ thành thạo theo kỹ năng
                </h3>
                {(activeResult.bySkill || []).map((row) => (
                  <div key={row.skill} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                      <span>{row.skill}</span>
                      <span className="tabular-nums text-emerald-700">
                        {row.correct}/{row.total} ({row.percent}%)
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all"
                        style={{ width: `${Math.max(8, row.percent)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                <button
                  type="button"
                  onClick={resetTest}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  <RotateCcw size={14} /> Làm lại bài 10 câu
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onApplied?.(activeResult);
                    onClose();
                  }}
                  className="cms-btn cms-btn-primary inline-flex items-center gap-1.5 !py-2.5 text-xs"
                >
                  <Target size={15} /> Áp dụng lộ trình gợi ý
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">
                  <Sparkles size={13} /> {current.skill}
                </span>
                <span className="tabular-nums">Câu {step + 1} / {QUESTIONS.length}</span>
              </div>

              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${Math.round(((step + 1) / QUESTIONS.length) * 100)}%` }}
                />
              </div>

              <h3 className="text-base font-black leading-snug text-slate-900">
                {current.question}
              </h3>

              <div className="space-y-2.5">
                {current.options.map((opt, idx) => {
                  const picked = answers[current.id] === idx;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => choose(idx)}
                      className={`flex w-full items-center justify-between gap-3 rounded-2xl border-2 px-4 py-3 text-left text-sm font-semibold transition ${
                        picked
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-slate-50'
                      }`}
                    >
                      <span>{String.fromCharCode(65 + idx)}. {opt}</span>
                      {picked && <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={step === 0}
                  onClick={() => setStep((s) => Math.max(0, s - 1))}
                  className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-600 disabled:opacity-40"
                >
                  Câu trước
                </button>
                <div className="flex items-center gap-2">
                  {step < QUESTIONS.length - 1 ? (
                    <button
                      type="button"
                      onClick={() => setStep((s) => Math.min(QUESTIONS.length - 1, s + 1))}
                      className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white"
                    >
                      Câu tiếp
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={answeredCount < QUESTIONS.length}
                      onClick={finish}
                      className="cms-btn cms-btn-primary !py-2 text-xs disabled:opacity-50"
                    >
                      Xem kết quả AI ({answeredCount}/{QUESTIONS.length})
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

