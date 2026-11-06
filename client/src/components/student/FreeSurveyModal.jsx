import { useState } from 'react';
import { Sparkles, UserRound, Users } from 'lucide-react';
import api from '../../services/api';

export const SURVEY_SOURCE_LABELS = {
  google: 'Google',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  referral: 'Người quen giới thiệu',
  other: 'Khác',
};

export const SURVEY_LEVEL_LABELS = {
  beginner: 'Mới bắt đầu',
  some: 'Đã biết một chút',
  advanced: 'Đã có kiến thức',
};

export const SURVEY_FEAR_LABELS = {
  scam: 'Sợ bị lừa đảo',
  no_guidance: 'Sợ đóng tiền rồi không được hướng dẫn',
  not_understand: 'Sợ học online mà không hiểu bài',
  no_support: 'Sợ bí thì không có ai kèm',
  none: 'Chưa lo gì, muốn học thử trước',
};

const FEAR_NOTES = {
  scam: 'Bạn đang học thử miễn phí, chưa cần đóng tiền.',
  no_guidance: 'Bài giảng và luyện tập mở sẵn. Giáo viên kèm khi bạn đăng ký khóa.',
  not_understand: 'Mỗi video có câu hỏi dừng lại. Làm chưa đúng thì được gợi ý.',
  no_support: 'Phần luyện mở sẵn. Khi cần người ngồi kèm thì đăng ký khóa 1 kèm 1.',
  none: 'Bạn cứ vào học thử. Muốn người kèm thì đăng ký khóa sau.',
};

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5c-.3 1.5-1.1 2.8-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7z" />
      <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1C3.4 21.3 7.4 24 12 24z" />
      <path fill="#FBBC05" d="M5.4 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.7.4-2.4V6.5H1.4C.5 8.3 0 10.1 0 12s.5 3.7 1.4 5.5l4-3.1z" />
      <path fill="#EA4335" d="M12 4.8c1.7 0 3.3.6 4.5 1.8l3.4-3.4C17.9 1.1 15.2 0 12 0 7.4 0 3.4 2.7 1.4 6.5l4 3.1C6.3 6.8 8.9 4.8 12 4.8z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path fill="#1877F2" d="M24 12.1C24 5.4 18.6 0 12 0S0 5.4 0 12.1C0 18.1 4.4 23.1 10.1 24v-8.4H7.1v-3.5h3V9.4c0-3 1.8-4.6 4.5-4.6 1.3 0 2.6.2 2.6.2v2.9h-1.5c-1.5 0-1.9.9-1.9 1.8v2.2h3.3l-.5 3.5h-2.8V24C19.6 23.1 24 18.1 24 12.1z" />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path fill="#25F4EE" d="M14.2 3.2c.5 2.5 1.9 4.2 4.2 4.6v2.4c-1.5 0-2.9-.5-4.1-1.3v6.6c0 3.4-2.6 6.1-6.1 6.1S2 18.9 2 15.5c0-3.3 2.5-6 5.8-6.1v2.5c-1.8.1-3.2 1.6-3.2 3.6 0 2 1.6 3.6 3.6 3.6s3.5-1.6 3.5-3.6V3.2h2.5z" />
      <path fill="#FE2C55" d="M15 3.2c.5 2.5 1.9 4.2 4.2 4.6v2.4c-1.5 0-2.9-.5-4.1-1.3v6.6c0 3.4-2.6 6.1-6.1 6.1-.6 0-1.1-.1-1.6-.2 1.7.8 3.5.4 4.8-.8 1.3-1.2 1.9-2.9 1.9-4.6V8.8c1.2.8 2.6 1.3 4.1 1.3V7.8c-2.3-.4-3.7-2.1-4.2-4.6H15z" />
      <path fill="#111" d="M14.4 3.6c.4 2.2 1.6 3.8 3.6 4.3v2c-1.3-.1-2.5-.5-3.6-1.2v6.2c0 3.1-2.3 5.6-5.4 5.6-1.1 0-2.2-.3-3.1-1 1 .9 2.3 1.4 3.7 1.4 3.1 0 5.5-2.5 5.5-5.6V6.6c1.1.7 2.4 1.1 3.7 1.2v-2c-1.8-.3-3.2-1.7-3.8-3.6h-.6z" />
    </svg>
  );
}

const SOURCES = [
  { id: 'google', label: 'Google', icon: <GoogleIcon /> },
  { id: 'tiktok', label: 'TikTok', icon: <TikTokIcon /> },
  { id: 'facebook', label: 'Facebook', icon: <FacebookIcon /> },
  { id: 'referral', label: 'Người quen giới thiệu', icon: <Users size={18} className="text-amber-600" aria-hidden="true" /> },
  { id: 'other', label: 'Khác', icon: <Sparkles size={18} className="text-slate-500" aria-hidden="true" /> },
];

const LEVELS = [
  { id: 'beginner', label: 'Mới bắt đầu, gần như chưa biết gì' },
  { id: 'some', label: 'Đã biết một chút, muốn học cho vững' },
  { id: 'advanced', label: 'Đã có kiến thức, muốn luyện nâng cao' },
];

const FEARS = [
  { id: 'scam', label: 'Sợ bị lừa đảo' },
  { id: 'no_guidance', label: 'Sợ đóng tiền rồi không được hướng dẫn' },
  { id: 'not_understand', label: 'Sợ học online mà không hiểu bài' },
  { id: 'no_support', label: 'Sợ bí thì không có ai kèm' },
  { id: 'none', label: 'Chưa lo gì, muốn học thử trước' },
];

function Choice({ selected, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[4.5rem] w-full items-center justify-center gap-2 rounded-2xl px-3 py-3 text-center text-sm font-semibold ring-1 transition ${
        selected
          ? 'bg-red-50 text-red-700 ring-red-300'
          : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  );
}

export default function FreeSurveyModal({ open, onDone }) {
  const [step, setStep] = useState(0);
  const [source, setSource] = useState('');
  const [sourceNote, setSourceNote] = useState('');
  const [level, setLevel] = useState('');
  const [fear, setFear] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const goNext = () => {
    if (step === 0) {
      if (!source) {
        setError('Hãy chọn một nguồn');
        return;
      }
      if (source === 'other' && sourceNote.trim().length < 2) {
        setError('Hãy ghi bạn biết trung tâm qua đâu');
        return;
      }
    }
    if (step === 1 && !level) {
      setError('Hãy chọn mức của bạn');
      return;
    }
    setError('');
    setStep((current) => Math.min(2, current + 1));
  };

  const submit = async () => {
    if (!source || !level || !fear) {
      setError('Hãy chọn đủ 3 câu');
      return;
    }
    if (source === 'other' && sourceNote.trim().length < 2) {
      setError('Hãy ghi bạn biết trung tâm qua đâu');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await api.auth.saveFreeSurvey({
        source,
        sourceNote: sourceNote.trim(),
        level,
        fear,
      });
      if (!res?.success) {
        setError(res?.message || 'Chưa lưu được. Hãy thử lại.');
        return;
      }
      onDone();
    } catch {
      setError('Chưa lưu được. Hãy thử lại.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10050] flex items-center justify-center bg-slate-950/70 p-4">
      <div className="w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-4 bg-gradient-to-r from-slate-950 via-slate-900 to-red-950 px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
              <UserRound size={22} aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-white/60">Làm quen 1 phút</p>
              <h2 className="text-lg font-black">Cho Thắng Tin Học biết bạn một chút</h2>
            </div>
          </div>
          <p className="text-sm font-black text-white/80">{step + 1}/3</p>
        </div>
        <div className="px-6 py-5">
          {step === 0 && (
            <section>
              <h3 className="text-base font-black text-slate-900">Bạn biết Thắng Tin Học qua đâu?</h3>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
                {SOURCES.map((item) => (
                  <Choice key={item.id} selected={source === item.id} onClick={() => setSource(item.id)}>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-50 ring-1 ring-slate-100">{item.icon}</span>
                    <span className="leading-tight">{item.label}</span>
                  </Choice>
                ))}
              </div>
              {source === 'other' && (
                <input
                  value={sourceNote}
                  maxLength={80}
                  onChange={(event) => setSourceNote(event.target.value)}
                  placeholder="Bạn biết trung tâm qua đâu?"
                  className="mt-3 w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-red-300"
                />
              )}
            </section>
          )}
          {step === 1 && (
            <section>
              <h3 className="text-base font-black text-slate-900">Bạn đang ở mức nào?</h3>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {LEVELS.map((item) => (
                  <Choice key={item.id} selected={level === item.id} onClick={() => setLevel(item.id)}>
                    <span className="leading-tight">{item.label}</span>
                  </Choice>
                ))}
              </div>
            </section>
          )}
          {step === 2 && (
            <section>
              <h3 className="text-base font-black text-slate-900">Học online tại Thắng Tin Học, bạn sợ...</h3>
              <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
                {FEARS.map((item) => (
                  <Choice key={item.id} selected={fear === item.id} onClick={() => setFear(item.id)}>
                    <span className="leading-tight">{item.label}</span>
                  </Choice>
                ))}
              </div>
              {fear && (
                <p className="mt-3 rounded-2xl bg-emerald-50 px-3 py-2 text-center text-sm font-medium text-emerald-800">{FEAR_NOTES[fear]}</p>
              )}
            </section>
          )}
          {error && <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>}
          <div className="mt-5 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                setError('');
                setStep((current) => Math.max(0, current - 1));
              }}
              className={`min-w-36 rounded-2xl border border-slate-300 bg-white px-6 py-3 text-sm font-black text-slate-800 shadow-sm hover:bg-slate-50 ${step === 0 ? 'invisible' : ''}`}
            >
              Quay lại
            </button>
            {step < 2 ? (
              <button
                type="button"
                onClick={goNext}
                className="min-w-36 rounded-2xl bg-gradient-to-b from-red-500 to-red-700 px-6 py-3 text-sm font-black text-white"
              >
                Tiếp
              </button>
            ) : (
              <button
                type="button"
                onClick={submit}
                disabled={saving}
                className="min-w-36 rounded-2xl bg-gradient-to-b from-red-500 to-red-700 px-6 py-3 text-sm font-black text-white disabled:opacity-60"
              >
                {saving ? 'Đang lưu...' : 'Vào học'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
