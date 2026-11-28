import { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Bot,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  FlaskConical,
  Loader2,
  Paperclip,
  Plus,
  Sparkles,
  Trash2,
  XCircle,
  Zap,
} from 'lucide-react';
import api, { buildMediaDownloadUrl, resolveMediaUrl } from '../../../services/api';
import dailyPracticeApi from '../../../services/dailyPracticeApi';
import { useToast } from '../../../utils/useToast';

const INPUT = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100';
const LABEL = 'mb-1 block text-xs font-bold text-slate-600';
const EXERCISE_FILE_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.png,.jpg,.jpeg,.webp,.gif';

const GRADING_MODES = [
  {
    value: 'auto',
    label: 'Tự khớp',
    desc: 'Khớp đáp án chuẩn tức thì (hỗ trợ công thức Excel, số, viết hoa/thường). Không tốn AI.',
    icon: Zap,
    badgeCls: 'bg-sky-100 text-sky-800 border-sky-200',
    activeCls: 'border-sky-500 bg-sky-50/80 ring-2 ring-sky-200',
  },
  {
    value: 'ai',
    label: 'AI chấm',
    desc: 'AI đọc hiểu bài làm của thí sinh và đối chiếu theo đáp án + tiêu chí.',
    icon: Bot,
    badgeCls: 'bg-violet-100 text-violet-800 border-violet-200',
    activeCls: 'border-violet-500 bg-violet-50/80 ring-2 ring-violet-200',
  },
  {
    value: 'hybrid',
    label: 'Tự khớp + AI chấm',
    desc: 'Khớp đáp án chuẩn sẽ đúng ngay; nếu viết cách khác sẽ tự chuyển AI chấm ý.',
    icon: Sparkles,
    badgeCls: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    activeCls: 'border-emerald-500 bg-emerald-50/80 ring-2 ring-emerald-200',
  },
];

export function emptyExercise(index = 0) {
  return {
    id: `temp-ex-${Date.now()}-${index}`,
    title: `Bài tập ${index + 1}`,
    prompt: '',
    attachmentUrl: '',
    attachmentName: '',
    expectedAnswers: [],
    gradingMode: 'hybrid',
    matchOptions: {
      ignoreCase: true,
      trimSpaces: true,
      ignoreAccents: false,
      numericTolerance: 0,
    },
    aiCriteria: '',
    hint: '',
    explanation: '',
    xpReward: 10,
  };
}

export function normalizeExercises(list) {
  return (Array.isArray(list) ? list : []).map((ex, idx) => ({
    id: String(ex?.id || ex?._id || `ex-${idx + 1}`),
    title: String(ex?.title || `Bài tập ${idx + 1}`),
    prompt: String(ex?.prompt || ''),
    attachmentUrl: String(ex?.attachmentUrl || ''),
    attachmentName: String(ex?.attachmentName || ''),
    expectedAnswers: Array.isArray(ex?.expectedAnswers)
      ? ex.expectedAnswers.map((a) => String(a || ''))
      : String(ex?.expectedAnswers || '').split('\n').filter(Boolean),
    gradingMode: ['auto', 'ai', 'hybrid'].includes(ex?.gradingMode) ? ex.gradingMode : 'hybrid',
    matchOptions: {
      ignoreCase: ex?.matchOptions?.ignoreCase !== false,
      trimSpaces: ex?.matchOptions?.trimSpaces !== false,
      ignoreAccents: Boolean(ex?.matchOptions?.ignoreAccents),
      numericTolerance: Math.max(0, Number(ex?.matchOptions?.numericTolerance) || 0),
    },
    aiCriteria: String(ex?.aiCriteria || ''),
    hint: String(ex?.hint || ''),
    explanation: String(ex?.explanation || ''),
    xpReward: Math.max(0, Math.min(50, Math.round(Number(ex?.xpReward) || 10))),
  }));
}

function parseAnswerPreview(expectedAnswers) {
  const out = [];
  for (const line of Array.isArray(expectedAnswers) ? expectedAnswers : []) {
    for (const part of String(line || '').split('|')) {
      const clean = part.trim();
      if (clean && !out.includes(clean)) out.push(clean);
    }
  }
  return out;
}

/** Trình soạn Đề bài tập tự nhập đáp án (Tự khớp / AI chấm) trong mỗi Hạt nước. */
export default function AdminDropletExerciseEditor({ exercises = [], onChange }) {
  const toast = useToast();
  const [uploadingIdx, setUploadingIdx] = useState(-1);
  const [testInputs, setTestInputs] = useState({});
  const [testingIdx, setTestingIdx] = useState(-1);
  const [testResults, setTestResults] = useState({});

  const list = Array.isArray(exercises) ? exercises : [];

  const patchAt = (index, updater) => {
    onChange(list.map((item, i) => {
      if (i !== index) return item;
      return typeof updater === 'function' ? updater(item) : { ...item, ...updater };
    }));
  };

  const moveAt = (index, delta) => {
    const target = index + delta;
    if (target < 0 || target >= list.length) return;
    const next = [...list];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const addExercise = () => {
    if (list.length >= 10) {
      toast.error('Mỗi hạt nước tối đa 10 đề bài tập');
      return;
    }
    onChange([...list, emptyExercise(list.length)]);
  };

  const handleUploadAttachment = async (index, e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      toast.error('File vượt quá 25MB');
      return;
    }
    setUploadingIdx(index);
    try {
      const data = await api.settings.uploadTrainingFile(file);
      if (!data?.success || !data.fileUrl) throw new Error(data?.message || 'Upload thất bại');
      patchAt(index, {
        attachmentUrl: data.fileUrl,
        attachmentName: data.fileOriginalName || file.name,
      });
      toast.success('Đã đính kèm file đề bài');
    } catch (err) {
      toast.error(err.message || 'Không tải được file');
    } finally {
      setUploadingIdx(-1);
    }
  };

  const runTestGrade = async (index, ex) => {
    const sample = String(testInputs[index] || '').trim();
    if (!sample) {
      toast.error('Nhập đáp án mẫu của thí sinh để thử chấm');
      return;
    }
    setTestingIdx(index);
    try {
      const res = await dailyPracticeApi.admin.testGradeExercise({ exercise: ex, answer: sample });
      setTestResults((prev) => ({ ...prev, [index]: res }));
    } catch (err) {
      toast.error(err.message || 'Chưa thử chấm được');
    } finally {
      setTestingIdx(-1);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-violet-200 bg-violet-50/60 p-4">
        <div>
          <h3 className="text-sm font-black text-slate-900">
            Đề bài tập tự nhập đáp án ({list.length}/10)
          </h3>
          <p className="mt-0.5 text-xs text-slate-600">
            Học viên đọc đề, tải file thực hành (nếu có) và tự nhập đáp án/công thức để hệ thống <b>Tự khớp</b> hoặc <b>AI chấm</b>.
          </p>
        </div>
        <button
          type="button"
          disabled={list.length >= 10}
          onClick={addExercise}
          className="cms-btn cms-btn-primary !py-2 text-xs disabled:opacity-50"
        >
          <Plus size={15} /> Thêm đề bài tập
        </button>
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-8 text-center">
          <p className="text-sm font-bold text-slate-700">Chưa có đề bài tập tự nhập nào trong hạt nước này.</p>
          <p className="mt-1 text-xs text-slate-500">
            Bấm <b>Thêm đề bài tập</b> để tạo bài tập có đáp án chuẩn cho thí sinh tự nhập (Tự khớp hoặc AI chấm).
          </p>
          <button
            type="button"
            onClick={addExercise}
            className="cms-btn cms-btn-outline mt-4 !py-2 text-xs"
          >
            <Plus size={14} /> Tạo đề bài tập đầu tiên
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {list.map((ex, index) => {
            const modeMeta = GRADING_MODES.find((m) => m.value === ex.gradingMode) || GRADING_MODES[2];
            const ModeIcon = modeMeta.icon;
            const acceptedChips = parseAnswerPreview(ex.expectedAnswers);
            const testResult = testResults[index];
            const showAutoOpts = ex.gradingMode === 'auto' || ex.gradingMode === 'hybrid';
            const showAiOpts = ex.gradingMode === 'ai' || ex.gradingMode === 'hybrid';

            return (
              <section
                key={ex.id || index}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs"
              >
                {/* Header card */}
                <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-600 text-xs font-black text-white">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-black text-slate-900">
                    {ex.title || `Bài tập ${index + 1}`}
                  </span>
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-extrabold ${modeMeta.badgeCls}`}>
                    <ModeIcon size={12} /> {modeMeta.label}
                  </span>
                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-extrabold text-amber-800">
                    +{ex.xpReward ?? 10} XP
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => moveAt(index, -1)}
                      title="Đưa lên"
                      className="rounded-lg p-1 text-slate-400 hover:bg-white hover:text-slate-700 disabled:opacity-30 !shadow-none"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      type="button"
                      disabled={index === list.length - 1}
                      onClick={() => moveAt(index, 1)}
                      title="Đưa xuống"
                      className="rounded-lg p-1 text-slate-400 hover:bg-white hover:text-slate-700 disabled:opacity-30 !shadow-none"
                    >
                      <ArrowDown size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onChange(list.filter((_, i) => i !== index))}
                      title="Xóa đề bài tập"
                      className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 !shadow-none"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Body */}
                <div className="space-y-4 p-4 sm:p-5">
                  <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
                    <label className="block">
                      <span className={LABEL}>Tiêu đề bài tập</span>
                      <input
                        className={INPUT}
                        maxLength={180}
                        value={ex.title}
                        onChange={(e) => patchAt(index, { title: e.target.value })}
                        placeholder={`Bài tập ${index + 1}: Tính tổng doanh thu bằng SUMIFS`}
                      />
                    </label>
                    <label className="block">
                      <span className={LABEL}>Thưởng XP</span>
                      <input
                        type="number"
                        min={0}
                        max={50}
                        className={INPUT}
                        value={ex.xpReward ?? 10}
                        onChange={(e) => patchAt(index, { xpReward: Math.max(0, Math.min(50, Number(e.target.value) || 0)) })}
                      />
                    </label>
                  </div>

                  <label className="block">
                    <span className={LABEL}>
                      Đề bài / Yêu cầu cho thí sinh <span className="text-rose-600">*</span>
                    </span>
                    <textarea
                      className={`${INPUT} !min-h-[96px]`}
                      maxLength={5000}
                      value={ex.prompt}
                      onChange={(e) => patchAt(index, { prompt: e.target.value })}
                      placeholder="Nhập đề bài chi tiết. VD: Cho bảng dữ liệu A2:D20. Viết công thức tại ô E2 để tính tổng thành tiền của mặt hàng 'Laptop'..."
                    />
                  </label>

                  {/* File đề đính kèm */}
                  <div className="rounded-xl border border-amber-200/80 bg-amber-50/50 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-xs font-black text-amber-950">
                        <Paperclip size={13} /> File dữ liệu thực hành đính kèm (tùy chọn)
                      </span>
                      <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-xs font-bold text-amber-900 hover:bg-amber-50 ${uploadingIdx === index ? 'pointer-events-none opacity-60' : ''}`}>
                        {uploadingIdx === index ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                        {uploadingIdx === index ? 'Đang tải...' : (ex.attachmentUrl ? 'Đổi file khác' : 'Tải file đề')}
                        <input
                          type="file"
                          className="hidden"
                          accept={EXERCISE_FILE_ACCEPT}
                          disabled={uploadingIdx === index}
                          onChange={(e) => handleUploadAttachment(index, e)}
                        />
                      </label>
                    </div>
                    {ex.attachmentUrl ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs">
                        <FileText size={15} className="shrink-0 text-amber-600" />
                        <span className="min-w-0 flex-1 truncate font-bold text-slate-800">
                          {ex.attachmentName || ex.attachmentUrl}
                        </span>
                        <a
                          href={resolveMediaUrl(ex.attachmentUrl)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-sky-700 hover:underline font-bold"
                        >
                          <ExternalLink size={12} /> Xem
                        </a>
                        <a
                          href={buildMediaDownloadUrl(ex.attachmentUrl, ex.attachmentName || 'bai-tap')}
                          download={ex.attachmentName || 'bai-tap'}
                          className="inline-flex items-center gap-1 text-amber-700 hover:underline font-bold"
                        >
                          <Download size={12} /> Tải
                        </a>
                        <button
                          type="button"
                          onClick={() => patchAt(index, { attachmentUrl: '', attachmentName: '' })}
                          className="text-rose-600 hover:underline font-bold !shadow-none"
                        >
                          Gỡ file
                        </button>
                      </div>
                    ) : null}
                  </div>

                  {/* Chế độ chấm điểm */}
                  <div>
                    <span className={LABEL}>Phương thức chấm đáp án thí sinh nhập vào</span>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {GRADING_MODES.map((m) => {
                        const Icon = m.icon;
                        const active = ex.gradingMode === m.value;
                        return (
                          <button
                            key={m.value}
                            type="button"
                            onClick={() => patchAt(index, { gradingMode: m.value })}
                            className={`rounded-xl border p-3 text-left transition !shadow-none ${
                              active ? m.activeCls : 'border-slate-200 bg-white hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 text-xs font-black text-slate-900">
                              <Icon size={14} /> {m.label}
                            </div>
                            <p className="mt-1 text-[11px] leading-snug text-slate-600">{m.desc}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Đáp án chuẩn */}
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3.5 space-y-2.5">
                    <label className="block">
                      <span className={LABEL}>
                        Đáp án chuẩn chấp nhận {ex.gradingMode === 'auto' ? <span className="text-rose-600">*</span> : '(mỗi dòng 1 đáp án hoặc ngăn bằng |)'}
                      </span>
                      <textarea
                        className={`${INPUT} font-mono text-xs`}
                        rows={3}
                        value={(ex.expectedAnswers || []).join('\n')}
                        onChange={(e) => patchAt(index, { expectedAnswers: e.target.value.split('\n') })}
                        placeholder={'=SUMIF(A2:A20,"Laptop",D2:D20)\n=SUMIFS(D2:D20,A2:A20,"Laptop")'}
                      />
                    </label>
                    {acceptedChips.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-bold text-emerald-800">Đáp án đang nhận ({acceptedChips.length}):</span>
                        {acceptedChips.map((chip, cIdx) => (
                          <span
                            key={cIdx}
                            className="rounded-md border border-emerald-200 bg-white px-2 py-0.5 font-mono text-[11px] font-bold text-emerald-900"
                          >
                            {chip}
                          </span>
                        ))}
                      </div>
                    )}

                    {showAutoOpts && (
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-emerald-200/70 pt-2.5 text-xs font-semibold text-slate-700">
                        <label className="inline-flex cursor-pointer items-center gap-1.5">
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5 accent-emerald-600"
                            checked={ex.matchOptions?.ignoreCase !== false}
                            onChange={(e) => patchAt(index, (cur) => ({
                              ...cur,
                              matchOptions: { ...cur.matchOptions, ignoreCase: e.target.checked },
                            }))}
                          />
                          Không phân biệt HOA/thường
                        </label>
                        <label className="inline-flex cursor-pointer items-center gap-1.5">
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5 accent-emerald-600"
                            checked={ex.matchOptions?.trimSpaces !== false}
                            onChange={(e) => patchAt(index, (cur) => ({
                              ...cur,
                              matchOptions: { ...cur.matchOptions, trimSpaces: e.target.checked },
                            }))}
                          />
                          Bỏ khoảng trắng thừa
                        </label>
                        <label className="inline-flex cursor-pointer items-center gap-1.5">
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5 accent-emerald-600"
                            checked={Boolean(ex.matchOptions?.ignoreAccents)}
                            onChange={(e) => patchAt(index, (cur) => ({
                              ...cur,
                              matchOptions: { ...cur.matchOptions, ignoreAccents: e.target.checked },
                            }))}
                          />
                          Bỏ dấu tiếng Việt
                        </label>
                        <label className="inline-flex items-center gap-1.5">
                          <span>Sai số số học:</span>
                          <input
                            type="number"
                            min={0}
                            step="any"
                            className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold outline-none focus:border-emerald-400"
                            value={ex.matchOptions?.numericTolerance ?? 0}
                            onChange={(e) => patchAt(index, (cur) => ({
                              ...cur,
                              matchOptions: { ...cur.matchOptions, numericTolerance: Math.max(0, Number(e.target.value) || 0) },
                            }))}
                          />
                        </label>
                      </div>
                    )}
                  </div>

                  {/* Tiêu chí AI chấm */}
                  {showAiOpts && (
                    <label className="block rounded-xl border border-violet-200 bg-violet-50/40 p-3">
                      <span className={LABEL}>
                        Tiêu chí để AI chấm (ẩn với thí sinh) {ex.gradingMode === 'ai' && !acceptedChips.length ? <span className="text-rose-600">*</span> : ''}
                      </span>
                      <textarea
                        className={`${INPUT} text-xs`}
                        rows={2}
                        maxLength={1000}
                        value={ex.aiCriteria}
                        onChange={(e) => patchAt(index, { aiCriteria: e.target.value })}
                        placeholder="VD: Chấp nhận cả dấu phẩy hoặc chấm phẩy trong hàm Excel; thí sinh giải thích đúng bản chất vẫn tính đạt."
                      />
                    </label>
                  )}

                  {/* Gợi ý & Lời giải */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className={LABEL}>Gợi ý khi thí sinh trả lời sai (không lộ đáp án)</span>
                      <input
                        className={INPUT}
                        maxLength={300}
                        value={ex.hint}
                        onChange={(e) => patchAt(index, { hint: e.target.value })}
                        placeholder="VD: Nhớ dùng hàm SUMIF có 3 tham số và dấu = ở đầu."
                      />
                    </label>
                    <label className="block">
                      <span className={LABEL}>Giải thích sau khi thí sinh làm đúng</span>
                      <input
                        className={INPUT}
                        maxLength={1000}
                        value={ex.explanation}
                        onChange={(e) => patchAt(index, { explanation: e.target.value })}
                        placeholder="VD: SUMIF(vùng ĐK, ĐK, vùng cộng) giúp cộng theo điều kiện..."
                      />
                    </label>
                  </div>

                  {/* Thử chấm đáp án mẫu */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                    <p className="flex items-center gap-1.5 text-xs font-black text-slate-800">
                      <FlaskConical size={14} className="text-emerald-600" /> Thử chấm đáp án thí sinh ngay
                    </p>
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                      <input
                        className={`${INPUT} flex-1 font-mono text-xs`}
                        value={testInputs[index] || ''}
                        onChange={(e) => setTestInputs((prev) => ({ ...prev, [index]: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === 'Enter') runTestGrade(index, ex); }}
                        placeholder="Nhập thử câu trả lời của thí sinh (VD: =sumif(A2:A20, &quot;laptop&quot;, D2:D20))"
                      />
                      <button
                        type="button"
                        disabled={testingIdx === index}
                        onClick={() => runTestGrade(index, ex)}
                        className="cms-btn cms-btn-outline shrink-0 !py-2 text-xs"
                      >
                        {testingIdx === index ? <Loader2 size={14} className="animate-spin" /> : <FlaskConical size={14} />}
                        Chấm thử
                      </button>
                    </div>
                    {testResult ? (
                      <div
                        className={`mt-2 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${
                          testResult.correct
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                            : 'border-rose-200 bg-rose-50 text-rose-800'
                        }`}
                      >
                        {testResult.correct
                          ? <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-600" />
                          : <XCircle size={15} className="mt-0.5 shrink-0 text-rose-600" />}
                        <div className="min-w-0 flex-1">
                          <span className="font-black">
                            {testResult.correct ? 'ĐẠT' : 'CHƯA ĐẠT'} ({testResult.score}%)
                          </span>
                          {' · '}
                          <span className="rounded bg-white/80 px-1.5 py-0.5 text-[10px] font-black uppercase">
                            {testResult.matchedBy === 'ai' ? 'AI chấm' : 'Tự khớp'}
                          </span>
                          <p className="mt-0.5">{testResult.feedback}</p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
