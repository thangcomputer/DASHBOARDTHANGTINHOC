import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import lessonPracticeApi from '../../../services/lessonPracticeApi';
import { resolveMediaUrl } from '../../../services/api';

function eventPercent(event, node) {
  const box = node.getBoundingClientRect();
  if (!box.width || !box.height) return null;
  return {
    x: Math.min(100, Math.max(0, ((event.clientX - box.left) / box.width) * 100)),
    y: Math.min(100, Math.max(0, ((event.clientY - box.top) / box.height) * 100)),
  };
}

function LessonFigure({ imageUrl, caption, region, point, onPick }) {
  const ref = useRef(null);
  if (!imageUrl) return null;
  return (
    <div className="space-y-2">
      <div
        ref={ref}
        className={`relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 ${onPick ? 'cursor-crosshair' : ''}`}
        onClick={(event) => {
          if (!onPick || !ref.current) return;
          const next = eventPercent(event, ref.current);
          if (next) onPick(next);
        }}
      >
        <img src={resolveMediaUrl(imageUrl)} alt="" className="block w-full max-h-[440px] object-contain pointer-events-none" />
        {region && (
          <span
            className="absolute border-2 border-emerald-500 bg-emerald-400/25 pointer-events-none"
            style={{ left: `${region.x}%`, top: `${region.y}%`, width: `${region.w}%`, height: `${region.h}%` }}
          />
        )}
        {point && (
          <span
            className="absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-red-600 pointer-events-none"
            style={{ left: `${point.x}%`, top: `${point.y}%` }}
          />
        )}
      </div>
      {caption && <p className="text-sm text-slate-500">{caption}</p>}
    </div>
  );
}

function Explanation({ item }) {
  if (!item.confirmed) return null;
  const tone = item.correct === true
    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
    : item.correct === false
      ? 'border-amber-200 bg-amber-50 text-amber-950'
      : 'border-sky-200 bg-sky-50 text-sky-950';
  const label = item.correct === true ? 'Đúng' : item.correct === false ? 'Chưa đúng' : 'Giải thích';
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${tone}`}>
      <p className="font-black uppercase tracking-wide text-xs">{label}</p>
      <p className="mt-1 whitespace-pre-wrap">{item.explanation || 'Đã ghi nhận câu trả lời.'}</p>
    </div>
  );
}

function QuestionCard({ item, busy, onConfirm }) {
  const [choiceId, setChoiceId] = useState(item.answer?.choiceId || '');
  const [text, setText] = useState(item.answer?.text || '');
  const [point, setPoint] = useState(item.answer?.x != null ? { x: item.answer.x, y: item.answer.y } : null);

  if (item.type === 'image_view') {
    return (
      <article className="rounded-2xl border border-slate-100 bg-white p-4 sm:p-5">
        <LessonFigure imageUrl={item.imageUrl} caption={item.caption || item.prompt} />
      </article>
    );
  }

  const locked = !!item.confirmed;
  return (
    <article className="rounded-2xl border border-slate-100 bg-white p-4 sm:p-5 space-y-4">
      {item.prompt && <h2 className="text-base font-bold text-slate-900">{item.prompt}</h2>}
      {item.type === 'hotspot' && (
        <LessonFigure
          imageUrl={item.imageUrl}
          caption={locked ? '' : 'Bấm đúng vùng trên ảnh, rồi xác nhận.'}
          region={locked ? item.region : null}
          point={point}
          onPick={locked ? null : setPoint}
        />
      )}
      {item.type !== 'hotspot' && item.imageUrl && (
        <LessonFigure imageUrl={item.imageUrl} caption={item.caption} />
      )}
      {item.type === 'mcq' && (
        <div className="space-y-2">
          {(item.options || []).map((opt) => {
            const selected = (locked ? item.answer?.choiceId : choiceId) === opt.id;
            const isKey = locked && item.correctOptionId === opt.id;
            return (
              <label key={opt.id} className={`flex items-start gap-3 rounded-xl border px-3 py-3 text-sm ${isKey ? 'border-emerald-300 bg-emerald-50' : selected ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}>
                <input
                  type="radio"
                  name={`q-${item.id}`}
                  className="mt-1"
                  disabled={locked}
                  checked={selected}
                  onChange={() => setChoiceId(opt.id)}
                />
                <span>{opt.text}</span>
              </label>
            );
          })}
        </div>
      )}
      {item.type === 'written' && (
        <textarea
          value={locked ? (item.answer?.text || '') : text}
          disabled={locked}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder="Ghi câu trả lời của bạn"
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-red-400 disabled:bg-slate-50"
        />
      )}
      <Explanation item={item} />
      {!locked && (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (item.type === 'mcq') onConfirm({ choiceId });
            else if (item.type === 'hotspot') onConfirm(point || {});
            else onConfirm({ text });
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
        >
          {busy && <Loader2 size={14} className="animate-spin" />}
          Xác nhận
        </button>
      )}
    </article>
  );
}

export default function LessonPracticePlayerPage() {
  const { unitId } = useParams();
  const navigate = useNavigate();
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [unitStatus, setUnitStatus] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    lessonPracticeApi.student.unit(unitId)
      .then((res) => {
        if (!alive) return;
        setPayload(res.data);
        setUnitStatus(res.data?.unit?.status || '');
      })
      .catch((err) => { if (alive) setError(err.message || 'Không mở được buổi học'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [unitId]);

  async function confirm(item, body) {
    setBusyId(item.id);
    setError('');
    try {
      const res = await lessonPracticeApi.student.confirm(item.id, body);
      setPayload((prev) => ({
        ...prev,
        items: (prev?.items || []).map((row) => (row.id === item.id ? res.data.item : row)),
      }));
      if (res.data.unitStatus) setUnitStatus(res.data.unitStatus);
    } catch (err) {
      setError(err.message || 'Không xác nhận được câu này');
    } finally {
      setBusyId('');
    }
  }

  const subjectId = payload?.subject?.id;

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="max-w-3xl mx-auto space-y-4">
        <button
          type="button"
          onClick={() => navigate(subjectId ? `/student/lesson-practice/subjects/${subjectId}` : '/student/lesson-practice')}
          className="inline-flex items-center gap-1 text-sm font-bold text-red-600"
        >
          <ArrowLeft size={16} /> Danh sách buổi
        </button>
        {loading && <div className="flex items-center gap-2 text-slate-400"><Loader2 className="animate-spin" size={18} /> Đang mở buổi học...</div>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {payload?.unit && (
          <>
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">{payload.subject?.name}</p>
              <h1 className="text-2xl font-black text-slate-900">{payload.unit.title}</h1>
            </div>
            {unitStatus === 'completed' && (
              <p className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-sm font-bold text-emerald-800">Bạn đã xong buổi này.</p>
            )}
            {(payload.items || []).map((item) => (
              <QuestionCard key={item.id} item={item} busy={busyId === item.id} onConfirm={(body) => confirm(item, body)} />
            ))}
            {(payload.items || []).length === 0 && <p className="text-sm text-slate-500">Buổi này chưa có nội dung.</p>}
          </>
        )}
      </div>
    </div>
  );
}
