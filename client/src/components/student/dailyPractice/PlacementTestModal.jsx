import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, CheckCircle2, Clock, Compass, FileText, Loader2, RotateCcw, Sparkles, Target } from 'lucide-react';
import dailyPracticeApi from '../../../services/dailyPracticeApi';
import ShareAchievementModal, { ShareTriggerButton } from '../ShareAchievementModal';
import { buildPlacementShareData } from '../../../../../shared/dailyPractice/shareAchievement.mjs';
import { getDewSkillThemeAttr } from '../../../utils/dewskillTheme';

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

export default function PlacementTestModal({ open, onClose, studentId, topics = [], onApplied, surveyLevel = '', intro = false }) {
  const existing = useMemo(() => readPlacementResult(studentId), [studentId, open]);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [showIntro, setShowIntro] = useState(Boolean(intro));
  const [shareOpen, setShareOpen] = useState(false);

  const effectiveSurveyLevel = surveyLevel || (() => {
    try { return localStorage.getItem('dewskill_survey_level') || ''; } catch { return ''; }
  })();

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

  const requestAiAdvice = async (computed, answerMap) => {
    setAiLoading(true);
    setAiError('');
    try {
      const answersToUse = (answerMap && Object.keys(answerMap).length > 0)
        ? answerMap
        : (computed?.savedAnswers || answers || {});
      const wrongTopics = QUESTIONS
        .filter((q) => answersToUse[q.id] !== undefined && answersToUse[q.id] !== q.answer)
        .map((q) => `[${q.skill}] ${q.question}`);
      const advice = await dailyPracticeApi.student.placementAdvice({
        score: computed.score,
        total: computed.total,
        bySkill: computed.bySkill.map(({ skill, correct, total }) => ({ skill, correct, total })),
        wrongTopics,
        surveyLevel: effectiveSurveyLevel,
        topics: (topics || []).map((t) => t?.name || t?.topic?.name || '').filter(Boolean),
      });
      if (!advice?.summary) throw new Error('empty');
      let next = { ...computed, ai: advice };
      const aiTopic = String(advice.recommendedTopic || '').toLowerCase();
      if (aiTopic) {
        const matched = (topics || []).find((t) => {
          const name = String(t?.name || t?.topic?.name || '').toLowerCase();
          return name && (name.includes(aiTopic) || aiTopic.includes(name));
        });
        if (matched) {
          next = {
            ...next,
            matchedTopicId: String(matched.id || matched.topic?.id || ''),
            matchedTopicName: matched.name || matched.topic?.name || next.matchedTopicName,
          };
        } else if (advice.recommendedTopic) {
          next = {
            ...next,
            matchedTopicName: advice.recommendedTopic,
          };
        }
      }
      savePlacementResult(studentId, next);
      setResult(next);
    } catch (err) {
      setAiError(err?.message && err.message !== 'empty'
        ? err.message
        : 'Chưa phân tích chi tiết được lúc này. Kết quả cơ bản vẫn được lưu.');
    } finally {
      setAiLoading(false);
    }
  };

  const finish = () => {
    const computed = {
      ...computePlacementRecommendation(answers, topics),
      savedAnswers: answers,
    };
    savePlacementResult(studentId, computed);
    setResult(computed);
    requestAiAdvice(computed, answers);
  };

  const resetTest = () => {
    setAnswers({});
    setStep(0);
    setAiError('');
    setResult({ __retaking: true });
  };

  const showResultScreen = activeResult && !activeResult.__retaking;
  const ai = showResultScreen ? activeResult.ai : null;

  return createPortal(
    <div data-theme={getDewSkillThemeAttr()} className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/65 p-2 sm:p-5 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Kiểm tra đầu vào"
        className="dew-modal relative flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
      >
        {aiLoading && (
          <div
            role="status"
            aria-live="polite"
            className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-white/85 p-6 text-center backdrop-blur-xs select-none"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200 shadow-sm">
              <Loader2 size={28} className="animate-spin" />
            </span>
            <p className="mt-4 text-base font-black text-slate-900">Đang phân tích...</p>
            <p className="mt-1 max-w-xs text-xs font-medium text-slate-500">
              Đang tổng hợp bài làm và thiết kế lộ trình phù hợp nhất cho bạn.
            </p>
          </div>
        )}
        <div className="flex shrink-0 items-center justify-between gap-2.5 border-b border-slate-100 bg-gradient-to-r from-emerald-50 via-white to-teal-50 px-4 py-3 sm:px-5 sm:py-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm">
              <Compass size={19} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="line-clamp-2 text-sm font-black leading-snug text-slate-900 sm:truncate sm:text-base">
                Kiểm tra đầu vào · Gợi ý lộ trình cá nhân hóa
              </h2>
              <p className="text-[11px] font-medium text-slate-500 sm:text-xs">
                10 câu đánh giá nhanh Windows, Word, Excel, PowerPoint
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={aiLoading}
            onClick={onClose}
            aria-label="Đóng"
            className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer !shadow-none"
          >
            Đóng
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          {showIntro && !showResultScreen ? (
            <div className="space-y-3 py-1 text-center sm:space-y-4 sm:py-2">
              <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md sm:h-14 sm:w-14">
                <Compass size={24} className="sm:hidden" />
                <Compass size={28} className="hidden sm:block" />
              </span>
              <div>
                <h3 className="text-base font-black leading-snug text-slate-900 sm:text-lg">Cùng tìm điểm xuất phát phù hợp nhất cho bạn</h3>
                <p className="mx-auto mt-1 max-w-md text-xs font-medium leading-relaxed text-slate-500 sm:mt-1.5 sm:text-sm">
                  10 câu trắc nghiệm nhanh (khoảng 3 phút) về Windows, Word, Excel và PowerPoint.
                  Hệ thống sẽ phân tích bài làm và gợi ý lộ trình học riêng cho bạn.
                </p>
              </div>
              <div className="mx-auto grid max-w-md grid-cols-3 gap-1.5 text-[11px] font-bold text-slate-700 sm:gap-2 sm:text-xs">
                <div className="flex flex-col items-center justify-center gap-1 rounded-xl bg-emerald-50 px-1.5 py-2 text-emerald-800 sm:flex-row sm:gap-1.5 sm:px-2 sm:py-2.5">
                  <Clock size={14} className="shrink-0" aria-hidden="true" /> ~3 phút
                </div>
                <div className="flex flex-col items-center justify-center gap-1 rounded-xl bg-sky-50 px-1.5 py-2 text-sky-800 sm:flex-row sm:gap-1.5 sm:px-2 sm:py-2.5">
                  <FileText size={14} className="shrink-0" aria-hidden="true" /> 10 câu
                </div>
                <div className="flex flex-col items-center justify-center gap-1 rounded-xl bg-violet-50 px-1.5 py-2 text-violet-800 sm:flex-row sm:gap-1.5 sm:px-2 sm:py-2.5">
                  <Target size={14} className="shrink-0" aria-hidden="true" /> Gợi ý lộ trình
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Để sau
                </button>
                <button
                  type="button"
                  onClick={() => setShowIntro(false)}
                  className="cms-btn cms-btn-primary inline-flex items-center gap-1.5 !py-2.5 text-xs"
                >
                  <Sparkles size={14} /> Bắt đầu kiểm tra
                </button>
              </div>
            </div>
          ) : showResultScreen ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-emerald-700">Kết quả đánh giá năng lực</p>
                    <p className="mt-1 text-2xl font-black text-slate-900">
                      {activeResult.score}/{activeResult.total} câu đúng
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-black text-white">
                    {activeResult.recommendedLevel}
                  </span>
                </div>
                <p className="mt-2 flex flex-wrap items-center gap-1 text-sm text-slate-700">
                  <Target size={15} className="shrink-0 text-emerald-600" aria-hidden="true" />
                  <span>Đề xuất ưu tiên luyện ngay:</span>
                  <strong className="text-emerald-700">{activeResult.matchedTopicName}</strong>
                  <span>(Kỹ năng cần củng cố nhất: <strong>{activeResult.recommendedSkill}</strong>).</span>
                </p>
              </div>

              {aiLoading ? (
                <div className="flex items-center gap-2.5 rounded-2xl border border-violet-200 bg-violet-50/70 px-4 py-3 text-sm font-semibold text-violet-800">
                  <Loader2 size={16} className="animate-spin shrink-0" />
                  Đang phân tích bài làm và thiết kế lộ trình riêng cho bạn...
                </div>
              ) : ai ? (
                <div className="space-y-3 rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-emerald-50 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-violet-700">
                      <Sparkles size={14} /> Nhận xét &amp; định hướng học tập
                    </p>
                    {ai.levelLabel ? (
                      <span className="rounded-full bg-violet-600 px-2.5 py-0.5 text-[11px] font-black text-white">{ai.levelLabel}</span>
                    ) : null}
                  </div>
                  <p className="text-sm font-medium leading-relaxed text-slate-700">{ai.summary}</p>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {ai.strengths?.length ? (
                      <div className="rounded-xl border border-emerald-100 bg-white/80 p-3">
                        <p className="text-[11px] font-black uppercase tracking-wider text-emerald-700">Điểm mạnh</p>
                        <ul className="mt-1.5 space-y-1 text-xs font-medium text-slate-700">
                          {ai.strengths.map((s) => (
                            <li key={s} className="flex items-start gap-1.5">
                              <Check size={13} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" />
                              <span>{s}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {ai.focus?.length ? (
                      <div className="rounded-xl border border-amber-100 bg-white/80 p-3">
                        <p className="text-[11px] font-black uppercase tracking-wider text-amber-700">Cần tập trung</p>
                        <ul className="mt-1.5 space-y-1 text-xs font-medium text-slate-700">
                          {ai.focus.map((s) => (
                            <li key={s} className="flex items-start gap-1.5">
                              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden="true" />
                              <span>{s}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                  {ai.plan?.length ? (
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">Lộ trình gợi ý</p>
                      {ai.plan.map((p, i) => (
                        <div key={`${p.title}-${i}`} className="flex gap-2.5 rounded-xl bg-white/80 px-3 py-2 ring-1 ring-slate-100">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-black text-white">{i + 1}</span>
                          <div className="min-w-0">
                            <p className="text-xs font-black text-slate-800">{p.title}</p>
                            {p.detail ? <p className="text-xs text-slate-600">{p.detail}</p> : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-600">
                  <span>{aiError || 'Nhận phân tích chi tiết & lộ trình học dành riêng cho bạn.'}</span>
                  <button
                    type="button"
                    onClick={() => requestAiAdvice(activeResult, answers)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-violet-700"
                  >
                    <Sparkles size={13} /> {aiError ? 'Thử lại' : 'Phân tích lộ trình'}
                  </button>
                </div>
              )}

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

              <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2.5 pt-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={aiLoading}
                    onClick={resetTest}
                    className="inline-flex flex-1 sm:flex-initial items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RotateCcw size={14} /> Làm lại bài 10 câu
                  </button>
                  <ShareTriggerButton
                    onClick={() => setShareOpen(true)}
                    label="SHARE"
                    className="!rounded-xl !py-2.5"
                  />
                </div>
                <button
                  type="button"
                  disabled={aiLoading}
                  onClick={() => {
                    onApplied?.(activeResult);
                    onClose();
                  }}
                  className="cms-btn cms-btn-primary inline-flex w-full sm:w-auto items-center justify-center gap-1.5 whitespace-nowrap !py-2.5 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Target size={15} /> {aiLoading ? 'Đang phân tích...' : 'Áp dụng lộ trình gợi ý'}
                </button>
              </div>
              <ShareAchievementModal
                open={shareOpen}
                onClose={() => setShareOpen(false)}
                data={buildPlacementShareData(activeResult)}
              />
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
                      Xem kết quả đánh giá ({answeredCount}/{QUESTIONS.length})
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

