import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Compass,
  GraduationCap,
  Layers,
  Lightbulb,
  MessageCircleQuestion,
  Rocket,
  ShieldCheck,
  Sparkles,
  Sprout,
  Users,
} from 'lucide-react';
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
  scam: 'An tâm nhé: bạn đang trải nghiệm học thử miễn phí hoàn toàn, chưa cần đóng bất kỳ khoản phí nào.',
  no_guidance: 'Phần luyện tập luôn mở sẵn. Khi đăng ký khóa chính thức, giảng viên sẽ đồng hành hướng dẫn sát sao.',
  not_understand: 'Mỗi video đều có điểm dừng tương tác, bài tập thực hành và gợi ý từng bước khi bạn làm chưa đúng.',
  no_support: 'Bạn luôn có Trợ lý AI hỗ trợ trong bài học, và có thể đăng ký lớp 1 kèm 1 bất cứ lúc nào cần.',
  none: 'Tuyệt vời! Chúc bạn có những giờ học thật hứng khởi — khi nào cần người kèm riêng, tụi mình luôn sẵn sàng.',
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
  { id: 'google', label: 'Tìm kiếm Google', hint: 'Qua tìm kiếm trên mạng', icon: <GoogleIcon /> },
  { id: 'tiktok', label: 'TikTok', hint: 'Qua video ngắn & chia sẻ mẹo hay', icon: <TikTokIcon /> },
  { id: 'facebook', label: 'Facebook', hint: 'Qua fanpage, bài viết hoặc nhóm', icon: <FacebookIcon /> },
  { id: 'referral', label: 'Bạn bè / Người thân', hint: 'Được người quen giới thiệu', icon: <Users size={18} className="text-amber-600" aria-hidden="true" /> },
  { id: 'other', label: 'Nguồn khác', hint: 'YouTube, hội thảo, diễn đàn...', icon: <Sparkles size={18} className="text-emerald-600" aria-hidden="true" />, fullWidth: true },
];

const LEVELS = [
  {
    id: 'beginner',
    label: 'Mới bắt đầu từ con số 0',
    desc: 'Chưa quen thao tác máy tính, muốn được hướng dẫn bài bản từng bước.',
    icon: <Sprout size={20} className="text-emerald-600" aria-hidden="true" />,
    tone: 'bg-emerald-50 text-emerald-700',
  },
  {
    id: 'some',
    label: 'Đã biết cơ bản, muốn học cho vững',
    desc: 'Dùng được Word/Excel sơ sơ nhưng vẫn hay lúng túng khi áp dụng thực tế.',
    icon: <Layers size={20} className="text-sky-600" aria-hidden="true" />,
    tone: 'bg-sky-50 text-sky-700',
  },
  {
    id: 'advanced',
    label: 'Đã có nền tảng, muốn luyện nâng cao',
    desc: 'Muốn tăng tốc độ làm việc, nắm mẹo hay và chuẩn hóa kỹ năng văn phòng.',
    icon: <GraduationCap size={20} className="text-amber-600" aria-hidden="true" />,
    tone: 'bg-amber-50 text-amber-700',
  },
];

const FEARS = [
  {
    id: 'scam',
    label: 'Lo ngại về độ uy tín & chất lượng khóa học',
    icon: <ShieldCheck size={18} className="text-emerald-600" aria-hidden="true" />,
  },
  {
    id: 'no_guidance',
    label: 'Ngại đăng ký xong lại phải tự học một mình',
    icon: <Compass size={18} className="text-sky-600" aria-hidden="true" />,
  },
  {
    id: 'not_understand',
    label: 'Sợ học online xem video xong không hiểu bài',
    icon: <Lightbulb size={18} className="text-amber-600" aria-hidden="true" />,
  },
  {
    id: 'no_support',
    label: 'Sợ gặp chỗ khó không có người giải đáp ngay',
    icon: <MessageCircleQuestion size={18} className="text-violet-600" aria-hidden="true" />,
  },
  {
    id: 'none',
    label: 'Mình rất hào hứng, chỉ muốn học thử ngay!',
    icon: <Rocket size={18} className="text-rose-500" aria-hidden="true" />,
    fullWidth: true,
  },
];

function ChoiceCard({ selected, onClick, icon, label, hint, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full items-center justify-between gap-3 rounded-2xl border px-3.5 py-3 text-left transition-all cursor-pointer ${
        selected
          ? 'border-emerald-500 bg-emerald-50/75 shadow-sm ring-2 ring-emerald-500/20'
          : 'border-slate-200/90 bg-white hover:border-emerald-300 hover:bg-slate-50/70'
      } ${className}`}
    >
      <div className="flex min-w-0 items-center gap-3">
        {icon && (
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors ${
              selected
                ? 'border-emerald-200 bg-white shadow-xs'
                : 'border-slate-100 bg-slate-50 group-hover:bg-white'
            }`}
          >
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <p className={`text-sm font-bold leading-snug ${selected ? 'text-emerald-950' : 'text-slate-800'}`}>
            {label}
          </p>
          {hint && (
            <p className={`mt-0.5 text-xs leading-snug ${selected ? 'text-emerald-700/90' : 'text-slate-500'}`}>
              {hint}
            </p>
          )}
        </div>
      </div>
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all ${
          selected
            ? 'border-emerald-600 bg-emerald-600 text-white'
            : 'border-slate-300 bg-white group-hover:border-emerald-400'
        }`}
        aria-hidden="true"
      >
        {selected && <Check size={12} strokeWidth={3} />}
      </span>
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

  const progressPct = Math.round(((step + 1) / 3) * 100);

  const goNext = () => {
    if (step === 0) {
      if (!source) {
        setError('Vui lòng chọn một kênh bạn biết đến chúng tôi nhé.');
        return;
      }
      if (source === 'other' && sourceNote.trim().length < 2) {
        setError('Bạn ghi giúp tụi mình nguồn bạn biết đến nhé (ví dụ: YouTube...).');
        return;
      }
    }
    if (step === 1 && !level) {
      setError('Hãy chọn mức độ hiện tại để hệ thống gợi ý bài học phù hợp.');
      return;
    }
    setError('');
    setStep((current) => Math.min(2, current + 1));
  };

  const submit = async () => {
    if (!source || !level || !fear) {
      setError('Bạn chọn giúp mình đầy đủ cả 3 bước nhé.');
      return;
    }
    if (source === 'other' && sourceNote.trim().length < 2) {
      setError('Bạn ghi giúp tụi mình nguồn bạn biết đến nhé.');
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
        setError(res?.message || 'Chưa lưu được thông tin. Bạn thử lại giúp nhé.');
        return;
      }
      try {
        localStorage.setItem('dewskill_survey_level', level);
      } catch { /* ignore */ }
      onDone();
    } catch {
      setError('Chưa lưu được thông tin. Bạn thử lại giúp nhé.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10050] flex items-center justify-center overflow-y-auto bg-slate-950/75 p-3 sm:p-5 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Cá nhân hóa lộ trình học"
        className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-900/10 animate-in fade-in zoom-in-95 duration-200 my-auto"
      >
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-emerald-950 to-teal-950 px-5 sm:px-7 py-5 text-white">
          <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-emerald-500/20 blur-2xl" aria-hidden="true" />
          <div className="relative flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/30">
                <Sparkles size={20} aria-hidden="true" />
              </span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-300/90">
                  Cá nhân hóa lộ trình · 30 giây
                </p>
                <h2 className="mt-0.5 text-base sm:text-lg font-black tracking-tight text-white">
                  Cùng DewSkill thiết kế lộ trình dành riêng cho bạn
                </h2>
              </div>
            </div>
            <span className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-xs font-extrabold text-emerald-200 ring-1 ring-white/15">
              Bước {step + 1} / 3
            </span>
          </div>
          <div className="relative mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/15" aria-hidden="true">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-300 transition-all duration-300 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <div className="px-5 sm:px-7 py-5 sm:py-6">
          {step === 0 && (
            <section>
              <h3 className="text-base sm:text-lg font-black text-slate-900">
                Cơ duyên nào đưa bạn đến với Thắng Tin Học?
              </h3>
              <p className="mt-1 text-xs sm:text-sm font-medium text-slate-500">
                Chia sẻ nhanh để tụi mình biết kênh nào đang giúp được nhiều học viên nhất nhé.
              </p>
              <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {SOURCES.map((item) => (
                  <ChoiceCard
                    key={item.id}
                    selected={source === item.id}
                    onClick={() => {
                      setSource(item.id);
                      setError('');
                    }}
                    icon={item.icon}
                    label={item.label}
                    hint={item.hint}
                    className={item.fullWidth ? 'sm:col-span-2' : ''}
                  />
                ))}
              </div>
              {source === 'other' && (
                <input
                  value={sourceNote}
                  maxLength={80}
                  onChange={(event) => {
                    setSourceNote(event.target.value);
                    if (error) setError('');
                  }}
                  placeholder="Ví dụ: YouTube, nhóm học tập, hội thảo..."
                  className="mt-3 w-full rounded-2xl border border-emerald-200 bg-emerald-50/30 px-4 py-2.5 text-sm font-medium text-slate-800 placeholder:text-slate-400 outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 transition"
                />
              )}
            </section>
          )}

          {step === 1 && (
            <section>
              <h3 className="text-base sm:text-lg font-black text-slate-900">
                Hiện tại, kỹ năng Tin học của bạn đang ở mức nào?
              </h3>
              <p className="mt-1 text-xs sm:text-sm font-medium text-slate-500">
                Chọn mức gần nhất với bạn — hệ thống sẽ gợi ý bài tập vừa sức ngay từ đầu.
              </p>
              <div className="mt-4 flex flex-col gap-2.5">
                {LEVELS.map((item) => (
                  <ChoiceCard
                    key={item.id}
                    selected={level === item.id}
                    onClick={() => {
                      setLevel(item.id);
                      setError('');
                    }}
                    icon={item.icon}
                    label={item.label}
                    hint={item.desc}
                  />
                ))}
              </div>
            </section>
          )}

          {step === 2 && (
            <section>
              <h3 className="text-base sm:text-lg font-black text-slate-900">
                Điều gì khiến bạn còn băn khoăn nhất khi học online?
              </h3>
              <p className="mt-1 text-xs sm:text-sm font-medium text-slate-500">
                Cứ chia sẻ thật lòng — tụi mình muốn giải tỏa đúng nỗi lo của bạn ngay hôm nay.
              </p>
              <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {FEARS.map((item) => (
                  <ChoiceCard
                    key={item.id}
                    selected={fear === item.id}
                    onClick={() => {
                      setFear(item.id);
                      setError('');
                    }}
                    icon={item.icon}
                    label={item.label}
                    className={item.fullWidth ? 'sm:col-span-2' : ''}
                  />
                ))}
              </div>
              {fear && (
                <div className="mt-3.5 flex items-start gap-2.5 rounded-2xl border border-emerald-200/80 bg-emerald-50/80 px-4 py-3 text-xs sm:text-sm font-semibold text-emerald-900">
                  <ShieldCheck size={18} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" />
                  <p className="leading-relaxed">{FEAR_NOTES[fear]}</p>
                </div>
              )}
            </section>
          )}

          {error && (
            <p className="mt-3.5 rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2 text-xs sm:text-sm font-semibold text-rose-700">
              {error}
            </p>
          )}

          <div className="mt-6 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => {
                setError('');
                setStep((current) => Math.max(0, current - 1));
              }}
              className={`inline-flex items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer ${
                step === 0 ? 'invisible pointer-events-none' : ''
              }`}
            >
              <ArrowLeft size={16} /> Quay lại
            </button>

            {step < 2 ? (
              <button
                type="button"
                onClick={goNext}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 px-6 py-2.5 text-sm font-black text-white shadow-md shadow-emerald-600/20 transition cursor-pointer"
              >
                Tiếp tục <ArrowRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                onClick={submit}
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 px-6 py-2.5 text-sm font-black text-white shadow-md shadow-emerald-600/20 transition cursor-pointer disabled:opacity-60"
              >
                {saving ? 'Đang thiết lập...' : 'Bắt đầu học ngay'}
                {!saving && <Rocket size={16} />}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
