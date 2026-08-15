import React from 'react';
import { ArrowLeft } from 'lucide-react';

/** Fullscreen exam surface (không sidebar) — Quay lại luôn bên trái */
export default function StudentExamFullscreenShell({ title, onBack, children }) {
  return (
    <div className="min-h-[100dvh] w-full bg-slate-900 flex flex-col text-white">
      <div className="shrink-0 px-4 sm:px-6 py-3 border-b border-slate-700/80 bg-slate-900/95 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 min-h-10 px-3 rounded-xl bg-slate-800 text-slate-200 hover:text-white hover:bg-slate-700 text-sm font-bold border border-slate-600"
            >
              <ArrowLeft size={16} aria-hidden="true" />
              Quay lại
            </button>
          ) : null}
          {title ? (
            <h1 className="text-sm sm:text-base font-black text-slate-100 truncate">{title}</h1>
          ) : null}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        {children}
      </div>
    </div>
  );
}
