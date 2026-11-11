import React, { useState } from 'react';
import { Bot, ChevronRight, Headphones, Users, X } from 'lucide-react';

const SUPPORT_CHOICES = [
  {
    mode: 'ai',
    title: 'Trợ lý AI Thắng Tin Học',
    description: 'Hỏi nhanh về tin học, Office, MOS và cách sử dụng LMS.',
    icon: Bot,
  },
  {
    mode: 'staff',
    title: 'Nhân viên hỗ trợ trực tiếp',
    description: 'Trò chuyện trực tiếp với chuyên viên hỗ trợ của trung tâm.',
    icon: Users,
  },
];

export default function SupportEntryPage() {
  const [choiceOpen, setChoiceOpen] = useState(false);

  const isTeacher = (() => {
    try {
      if (typeof window !== 'undefined' && (window.location.pathname.startsWith('/teacher') || localStorage.getItem('teacher_token') || localStorage.getItem('teacher_user'))) return true;
    } catch {
      /* ignore */
    }
    return false;
  })();

  const chooseSupport = (mode) => {
    setChoiceOpen(false);
    window.dispatchEvent(new CustomEvent('cms:open-support-choice', { detail: { mode } }));
  };

  return (
    <section className="mx-auto w-full max-w-5xl pt-4">
      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-8 text-center shadow-sm sm:px-8 sm:py-10">
        <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${isTeacher ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
          <Headphones size={27} aria-hidden="true" />
        </div>
        <h2 className="mt-3 text-lg font-extrabold text-slate-900 sm:text-xl">Hỗ trợ Thắng Tin Học</h2>
        <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          Hỏi trợ lý AI về tin học và LMS, hoặc trò chuyện trực tiếp với nhân viên hỗ trợ.
        </p>
        <button
          type="button"
          onClick={() => setChoiceOpen(true)}
          className={`mt-5 inline-flex min-h-[46px] items-center justify-center rounded-2xl px-6 py-2.5 text-sm sm:text-base font-extrabold text-white transition-all cursor-pointer shadow-xs active:translate-y-[2px] active:border-b-2 ${
            isTeacher
              ? 'bg-[#10B981] border border-[#34D399] border-b-4 border-b-[#059669] hover:brightness-105'
              : 'bg-[#DC2626] border border-[#F87171] border-b-4 border-b-[#B91C1C] hover:brightness-105'
          }`}
        >
          Trò chuyện với hỗ trợ
        </button>
      </div>

      {choiceOpen ? (
        <div
          className="fixed inset-0 z-[10060] flex items-center justify-center bg-slate-950/45 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setChoiceOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="support-choice-title"
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:p-5"
          >
            <header className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 id="support-choice-title" className="text-base font-extrabold text-slate-900">
                  Bạn muốn trò chuyện với ai?
                </h3>
                <p className="mt-1 text-sm text-slate-500">Chọn kênh hỗ trợ phù hợp.</p>
              </div>
              <button
                type="button"
                onClick={() => setChoiceOpen(false)}
                aria-label="Đóng lựa chọn hỗ trợ"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </header>
            <div className="space-y-2">
              {SUPPORT_CHOICES.map((choice) => (
                <button
                  key={choice.mode}
                  type="button"
                  onClick={() => chooseSupport(choice.mode)}
                  className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-3 text-left transition hover:border-red-200 hover:bg-red-50/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
                    {React.createElement(choice.icon, { size: 21, 'aria-hidden': true })}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-slate-800">{choice.title}</span>
                    <span className="mt-0.5 block text-xs leading-5 text-slate-500">{choice.description}</span>
                  </span>
                  <ChevronRight size={18} className="shrink-0 text-slate-400" aria-hidden="true" />
                </button>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
