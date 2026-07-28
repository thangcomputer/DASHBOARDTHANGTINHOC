import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X, HelpCircle, ChevronLeft, ChevronRight, CheckCircle2, BookOpen,
} from 'lucide-react';
import {
  getGuideSteps,
  hasSeenLmsGuide,
  markLmsGuideSeen,
  detectGuideTopic,
} from '../utils/lmsGuideContent';

const PAD = 8;

function findGuideTarget(key) {
  if (!key) return null;
  const nodes = Array.from(document.querySelectorAll(`[data-guide-key="${key}"]`));
  return nodes.find((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 2 && r.height > 2;
  }) || null;
}

function openNavForGuide() {
  try {
    window.dispatchEvent(new CustomEvent('lms-guide-open-nav'));
  } catch { /* ignore */ }
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

export default function LmsGuideTour({
  open,
  onClose,
  role = 'student',
  userId = '',
  mode = 'tour',
  startKey = null,
  pathname = '',
  hash = '',
}) {
  const steps = useMemo(() => getGuideSteps(role), [role]);
  const topicKey = startKey || detectGuideTopic(role, pathname, hash);
  const [view, setView] = useState(mode);
  const [index, setIndex] = useState(0);
  const [topic, setTopic] = useState(null);
  const [spot, setSpot] = useState(null);

  useEffect(() => {
    if (!open) return;
    setView(mode);
    openNavForGuide();
    try {
      window.dispatchEvent(new CustomEvent('lms-guide-visibility', { detail: { open: true } }));
    } catch { /* ignore */ }
    if (mode === 'tour') {
      const i = startKey ? Math.max(0, steps.findIndex((s) => s.key === startKey)) : 0;
      setIndex(i >= 0 ? i : 0);
    } else if (mode === 'menu') {
      const hit = steps.find((s) => s.key === topicKey && s.key !== 'welcome');
      if (hit) {
        setTopic(hit);
        setView('topic');
      } else {
        setTopic(null);
        setView('menu');
      }
    }
  }, [open, mode, startKey, steps, topicKey]);

  useEffect(() => {
    if (open) return undefined;
    try {
      window.dispatchEvent(new CustomEvent('lms-guide-visibility', { detail: { open: false } }));
    } catch { /* ignore */ }
    return undefined;
  }, [open]);

  const activeStep = view === 'topic' && topic
    ? topic
    : view === 'tour'
      ? (steps[index] || steps[0])
      : null;

  const measure = useCallback(() => {
    if (!open || !activeStep) {
      setSpot(null);
      return;
    }
    const el = findGuideTarget(activeStep.key);
    if (!el) {
      setSpot(null);
      return;
    }
    el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    const r = el.getBoundingClientRect();
    setSpot({
      top: r.top - PAD,
      left: r.left - PAD,
      width: r.width + PAD * 2,
      height: r.height + PAD * 2,
      right: r.right + PAD,
      bottom: r.bottom + PAD,
      midY: r.top + r.height / 2,
    });
  }, [open, activeStep]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    openNavForGuide();
    const t1 = setTimeout(measure, 80);
    const t2 = setTimeout(measure, 320);
    const t3 = setTimeout(measure, 500);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [open, measure, view, index, topic]);

  if (!open) return null;

  const finish = () => {
    markLmsGuideSeen(role, userId);
    try {
      window.dispatchEvent(new CustomEvent('lms-guide-visibility', { detail: { open: false } }));
    } catch { /* ignore */ }
    onClose?.();
  };

  const isLast = index >= steps.length - 1;
  const accent = role === 'teacher' ? 'bg-red-600' : 'bg-red-600';
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 768;
  const isMobile = vw < 1024;
  const cardW = Math.min(320, vw - 24);

  let cardStyle = {
    position: 'fixed',
    width: cardW,
    zIndex: 110002,
  };

  if (spot && view !== 'menu') {
    if (isMobile) {
      const below = spot.bottom + 12;
      const top = below + 180 > vh ? Math.max(12, spot.top - 190) : below;
      cardStyle.top = top;
      cardStyle.left = clamp((vw - cardW) / 2, 12, vw - cardW - 12);
    } else {
      cardStyle.top = clamp(spot.midY - 90, 12, vh - 220);
      cardStyle.left = clamp(spot.right + 14, 12, vw - cardW - 12);
    }
  } else {
    cardStyle.top = isMobile ? 72 : 96;
    cardStyle.left = isMobile ? 12 : 280;
  }

  const panel = (
    <div className="fixed inset-0 z-[110000]" role="dialog" aria-modal="true" aria-label="Hướng dẫn menu LMS">
      {/* Dim + spotlight hole */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 110000 }}>
        <defs>
          <mask id="lms-guide-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {spot && view !== 'menu' && (
              <rect
                x={spot.left}
                y={spot.top}
                width={spot.width}
                height={spot.height}
                rx="14"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(15,23,42,0.62)"
          mask="url(#lms-guide-mask)"
          style={{ pointerEvents: 'auto' }}
          onClick={finish}
        />
      </svg>

      {spot && view !== 'menu' && (
        <div
          className="pointer-events-none absolute rounded-2xl ring-2 ring-white shadow-[0_0_0_4px_rgba(99,102,241,0.45)] transition-all duration-200"
          style={{
            zIndex: 110001,
            top: spot.top,
            left: spot.left,
            width: spot.width,
            height: spot.height,
          }}
        />
      )}

      {/* Tooltip card gan nav */}
      <div
        style={cardStyle}
        className="bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`${accent} px-3.5 py-2.5 text-white flex items-center justify-between gap-2`}>
          <div className="flex items-center gap-2 min-w-0">
            <HelpCircle size={15} className="flex-shrink-0" />
            <p className="font-black text-xs truncate">
              {view === 'menu' ? 'Trợ giúp nhanh' : 'Hướng dẫn menu'}
            </p>
          </div>
          <button
            type="button"
            onClick={finish}
            className="w-7 h-7 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center"
            aria-label="Đóng"
          >
            <X size={14} />
          </button>
        </div>

        {view === 'tour' && activeStep && (
          <div className="p-3.5 space-y-3">
            <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              <span>Bước {index + 1}/{steps.length}</span>
              <span className="text-indigo-600">{activeStep.title}</span>
            </div>
            <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${accent}`}
                style={{ width: `${((index + 1) / steps.length) * 100}%` }}
              />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 mb-1">{activeStep.title}</h3>
              <p className="text-[13px] text-slate-600 leading-relaxed font-medium">{activeStep.body}</p>
              {!spot && (
                <p className="text-[11px] text-amber-600 mt-2 font-bold">
                  Mở menu trái để xem đúng mục được nói.
                </p>
              )}
            </div>
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <button type="button" onClick={finish} className="text-[11px] font-bold text-slate-400 hover:text-slate-600 px-1 py-1.5">
                Bỏ qua
              </button>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => { openNavForGuide(); setIndex((i) => Math.max(0, i - 1)); }}
                  className="inline-flex items-center gap-0.5 px-2.5 py-2 rounded-xl border border-slate-200 text-[11px] font-black text-slate-600 disabled:opacity-40"
                >
                  <ChevronLeft size={13} /> Trước
                </button>
                {isLast ? (
                  <button
                    type="button"
                    onClick={finish}
                    className={`inline-flex items-center gap-1 px-3 py-2 rounded-xl text-[11px] font-black text-white ${accent}`}
                  >
                    <CheckCircle2 size={13} /> Xong
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => { openNavForGuide(); setIndex((i) => Math.min(steps.length - 1, i + 1)); }}
                    className={`inline-flex items-center gap-0.5 px-3 py-2 rounded-xl text-[11px] font-black text-white ${accent}`}
                  >
                    Tiếp <ChevronRight size={13} />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {view === 'menu' && !topic && (
          <div className="p-3.5 space-y-2.5">
            <p className="text-[12px] text-slate-600 font-medium">Chọn mục trên menu để xem giải thích:</p>
            <div className="grid grid-cols-1 gap-1.5 max-h-[45vh] overflow-y-auto pr-0.5">
              {steps.filter((s) => s.key !== 'welcome').map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => {
                    openNavForGuide();
                    setTopic(s);
                    setView('topic');
                  }}
                  className="w-full text-left px-3 py-2.5 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/60 transition"
                >
                  <p className="text-[13px] font-black text-slate-800">{s.title}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{s.body}</p>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => { openNavForGuide(); setView('tour'); setIndex(0); }}
              className="w-full mt-0.5 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-slate-900 text-white text-[11px] font-black"
            >
              <BookOpen size={13} /> Xem toàn bộ theo menu
            </button>
          </div>
        )}

        {view === 'topic' && topic && (
          <div className="p-3.5 space-y-3">
            <h3 className="text-sm font-black text-slate-900">{topic.title}</h3>
            <p className="text-[13px] text-slate-600 leading-relaxed font-medium">{topic.body}</p>
            {!spot && (
              <p className="text-[11px] text-amber-600 font-bold">
                Mở menu trái — mục này đang được nổi sáng.
              </p>
            )}
            <div className="flex gap-1.5 pt-0.5">
              <button
                type="button"
                onClick={() => { setTopic(null); setView('menu'); setSpot(null); }}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-[11px] font-black text-slate-600"
              >
                Mục khác
              </button>
              <button
                type="button"
                onClick={finish}
                className={`flex-1 py-2.5 rounded-xl text-[11px] font-black text-white ${accent}`}
              >
                Đã hiểu
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}

export function LmsGuideHost({ role, userId, pathname, hash, hideButton = false, isFirstLogin = false }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('tour');
  const enabled = role === 'student' || role === 'teacher';
  const pendingPasswordRef = useRef(false);

  const openPasswordIfNeeded = useCallback(() => {
    if (!isFirstLogin && !pendingPasswordRef.current) return;
    pendingPasswordRef.current = false;
    try {
      window.dispatchEvent(new CustomEvent('open-change-password-modal'));
    } catch { /* ignore */ }
  }, [isFirstLogin]);

  useEffect(() => {
    if (!enabled || !userId) return;
    // Chỉ tự mở trợ giúp với tài khoản mới (lần đăng nhập đầu).
    // Lần 2 trở đi: không auto — vẫn mở được bằng nút Trợ giúp.
    if (!isFirstLogin) return undefined;

    const seen = hasSeenLmsGuide(role, userId);
    if (!seen) {
      pendingPasswordRef.current = true;
      const t = setTimeout(() => {
        setMode('tour');
        setOpen(true);
      }, 600);
      return () => clearTimeout(t);
    }
    // Đã xem hướng dẫn nhưng vẫn chưa đổi MK lần đầu
    const t = setTimeout(() => {
      window.dispatchEvent(new CustomEvent('open-change-password-modal'));
    }, 400);
    return () => clearTimeout(t);
  }, [enabled, role, userId, isFirstLogin]);

  useEffect(() => {
    if (!enabled) return undefined;
    const onOpen = (e) => {
      setMode(e?.detail?.mode || 'menu');
      setOpen(true);
    };
    window.addEventListener('lms-guide-open', onOpen);
    return () => window.removeEventListener('lms-guide-open', onOpen);
  }, [enabled]);

  if (!enabled) return null;

  const handleClose = () => {
    setOpen(false);
    // Sau khi người dùng đóng/hoàn thành hướng dẫn → mở đổi mật khẩu
    setTimeout(openPasswordIfNeeded, 200);
  };

  return (
    <>
      {!hideButton && (
        <button
          type="button"
          onClick={() => { setMode('menu'); setOpen(true); }}
          aria-label="Trợ giúp sử dụng LMS"
          title="Trợ giúp"
          className="inline-flex items-center gap-1.5 h-9 sm:h-10 px-2.5 sm:px-3 rounded-xl transition-colors bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-100 font-bold text-xs sm:text-sm"
        >
          <HelpCircle size={16} aria-hidden="true" />
          <span>Trợ giúp</span>
        </button>
      )}
      <LmsGuideTour
        open={open}
        onClose={handleClose}
        role={role}
        userId={userId}
        mode={mode}
        pathname={pathname}
        hash={hash}
      />
    </>
  );
}
