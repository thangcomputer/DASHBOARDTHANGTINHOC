import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Sparkles, Bot, Clock, AlertTriangle, CheckCircle2, XCircle,
  Lock, Loader2, Info, Settings,
} from 'lucide-react';
import { aiAutoReplyAPI } from '../services/aiAutoReplyApi';
import { useToast } from '../utils/useToast';

export const AI_AUTO_REPLY_DELAY_OPTIONS = [1, 3, 5, 10, 15, 30];
export const AI_AUTO_REPLY_CAPTION = 'AI tự động phản hồi vì giảng viên chưa trả lời trong thời gian chờ.';

export function isAiAutoReplyMessage(msg) {
  if (!msg) return false;
  return Boolean(
    msg.senderType === 'ai'
    || msg.aiMetadata?.source === 'ai_auto_reply'
    || msg.payload?.aiAutoReply?.source === 'ai_auto_reply'
  );
}

export function formatCountdownMmSs(dueAt) {
  if (!dueAt) return '';
  const diffMs = new Date(dueAt).getTime() - Date.now();
  if (!Number.isFinite(diffMs) || diffMs <= 0) return '00:00';
  const totalSec = Math.ceil(diffMs / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function AiAutoReplyMessageHeader({ isMine = false }) {
  return (
    <div className={`mb-1.5 flex flex-wrap items-center gap-1.5 ${isMine ? 'justify-end' : 'justify-start'}`}>
      <span className="inline-flex items-center gap-1 text-[11px] font-bold tracking-[-0.01em] text-emerald-800">
        <span className="inline-flex h-4 w-4 items-center justify-center rounded-md bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm">
          <Sparkles size={9.5} aria-hidden="true" />
        </span>
        DewSkill AI
      </span>
      <span className="inline-flex items-center rounded-full border border-emerald-200/80 bg-emerald-50 px-2 py-0.5 text-[9.5px] font-semibold text-emerald-700">
        Trợ lý AI
      </span>
    </div>
  );
}

export function AiAutoReplyMessageFooter({ msg }) {
  const caption = msg?.aiMetadata?.caption || msg?.payload?.aiAutoReply?.caption || AI_AUTO_REPLY_CAPTION;
  return (
    <p className="mt-2 border-t border-emerald-100/90 pt-1.5 text-[10.5px] font-normal italic leading-snug text-emerald-700/85">
      {caption}
    </p>
  );
}

export function AiAutoReplyStatusBanner({ state, visible = false, compact = false }) {
  const [tick, setTick] = useState(0);

  const isPending = state?.status === 'pending' && Boolean(state?.dueAt);

  useEffect(() => {
    if (!visible || !isPending) return undefined;
    const timer = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(timer);
  }, [visible, isPending]);

  const countdown = useMemo(() => {
    void tick;
    if (!isPending) return '';
    return formatCountdownMmSs(state?.dueAt);
  }, [isPending, state?.dueAt, tick]);

  if (!visible || !state) return null;

  const status = String(state.status || '');
  if (!['pending', 'processing', 'cancelled_human', 'sent', 'needs_human', 'rate_limited'].includes(status)) {
    return null;
  }

  let toneClass = 'border-slate-200/90 bg-slate-50/90 text-slate-600';
  let IconComp = Bot;
  let label = state.statusLabel || '';

  if (status === 'pending') {
    toneClass = 'border-emerald-200/90 bg-gradient-to-r from-emerald-50 to-teal-50/60 text-emerald-900';
    IconComp = Clock;
    label = countdown === '00:00'
      ? 'DewSkill AI chuẩn bị phản hồi...'
      : 'DewSkill AI đang chờ phản hồi thay giảng viên';
  } else if (status === 'processing') {
    toneClass = 'border-emerald-200/90 bg-gradient-to-r from-emerald-50 to-teal-50/60 text-emerald-900';
    IconComp = Loader2;
    label = 'DewSkill AI đang soạn phản hồi...';
  } else if (status === 'cancelled_human') {
    toneClass = 'border-slate-200/90 bg-slate-50 text-slate-600';
    IconComp = XCircle;
    label = state.statusLabel || 'Đã hủy vì giảng viên trả lời';
  } else if (status === 'sent') {
    toneClass = 'border-teal-200/80 bg-teal-50/75 text-teal-800';
    IconComp = CheckCircle2;
    label = 'AI đã tự động trả lời';
  } else if (status === 'needs_human') {
    toneClass = 'border-amber-200/90 bg-amber-50/90 text-amber-900';
    IconComp = AlertTriangle;
    label = 'AI không thể trả lời, cần giảng viên hỗ trợ';
  } else if (status === 'rate_limited') {
    toneClass = 'border-amber-200/90 bg-amber-50/90 text-amber-900';
    IconComp = AlertTriangle;
    label = state.statusLabel || 'AI tạm dừng tự động trả lời';
  }

  return (
    <div
      className={`flex items-center justify-between gap-2 rounded-2xl border shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${
        compact ? 'mx-2 mb-1.5 px-2.5 py-1.5 text-[10.5px]' : 'mx-auto mb-2 max-w-4xl px-3.5 py-2 text-[11.5px]'
      } font-medium ${toneClass}`}
      role="status"
      aria-live="polite"
    >
      <span className="flex min-w-0 items-center gap-2">
        <IconComp size={compact ? 12.5 : 14} className={`shrink-0 ${status === 'processing' ? 'animate-spin' : ''}`} aria-hidden="true" />
        <span className="truncate">{label}</span>
      </span>
      {status === 'pending' && countdown && countdown !== '00:00' ? (
        <span className="shrink-0 whitespace-nowrap rounded-full bg-white/95 px-2 py-0.5 font-mono text-[10.5px] font-bold tabular-nums text-emerald-700 ring-1 ring-emerald-200/80">
          {countdown}
        </span>
      ) : state.enabled && status !== 'processing' ? (
        <span className="shrink-0 whitespace-nowrap rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200/70">
          Chờ {state.delayMinutes || 5}p
        </span>
      ) : null}
    </div>
  );
}

export default function AiAutoReplyComposerControl({
  conversationId,
  visible = false,
  eligible = true,
  ineligibleReason = '',
  isAdminViewer = false,
  state = null,
  onStateChange,
  compact = false,
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    setOpen(false);
  }, [conversationId]);

  useEffect(() => {
    if (!visible || !eligible || !conversationId) return undefined;
    let active = true;
    setLoading(true);
    aiAutoReplyAPI.getConversation(conversationId)
      .then((res) => {
        if (!active) return;
        if (res?.success && res?.data) {
          onStateChange?.(res.data);
        }
      })
      .catch(() => { /* ignore transient error; next open retries */ })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [conversationId, eligible, visible]);

  useEffect(() => {
    if (!open) return undefined;
    const onOutside = (event) => {
      if (!wrapRef.current?.contains(event.target)) setOpen(false);
    };
    const onEscape = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onOutside);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('pointerdown', onOutside);
      document.removeEventListener('keydown', onEscape);
    };
  }, [open]);

  if (!visible || !conversationId) return null;

  const isEnabled = eligible && Boolean(state?.enabled);
  const delayMinutes = Number(state?.delayMinutes) || 5;
  const canToggle = eligible && (state ? state.canToggle !== false : true);
  const globalEnabled = state ? state.globalEnabled !== false : true;
  const defaultIneligibleMsg = 'DewSkill AI tự động trả lời chỉ áp dụng cho hộp thư trực tiếp với học viên.';
  const buttonTitle = !eligible
    ? (ineligibleReason || defaultIneligibleMsg)
    : isEnabled
      ? `DewSkill AI tự động trả lời đang bật (chờ ${delayMinutes} phút) — Nhấn để cài đặt`
      : 'DewSkill AI tự động trả lời đang tắt — Nhấn để cài đặt';

  const applyUpdate = async (patch) => {
    if (!eligible || saving || !canToggle) return;
    setSaving(true);
    try {
      const res = await aiAutoReplyAPI.updateConversation(conversationId, patch);
      if (!res?.success) {
        throw new Error(res?.message || 'Không lưu được cài đặt AI tự động trả lời');
      }
      if (res.data) {
        onStateChange?.(res.data);
      }
      if (typeof patch.enabled === 'boolean') {
        toast?.success(patch.enabled ? 'Đã bật DewSkill AI tự động trả lời' : 'Đã tắt DewSkill AI tự động trả lời');
      }
    } catch (err) {
      toast?.error(err?.message || 'Không lưu được cài đặt AI');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={eligible && loading && !state}
        title={buttonTitle}
        aria-label="Cài đặt AI tự động trả lời"
        aria-expanded={open}
        aria-pressed={eligible ? isEnabled : false}
        className={`inline-flex select-none items-center justify-center gap-1.5 rounded-full border font-semibold transition-all duration-150 ${
          compact
            ? 'h-8 px-2.5 text-[11px]'
            : 'h-10 px-3 text-xs'
        } ${
          open ? 'ring-2 ring-emerald-500/20' : ''
        } ${
          !eligible
            ? 'border-slate-200/80 bg-slate-50/85 text-slate-400 hover:border-slate-300 hover:bg-slate-100/80 hover:text-slate-600'
            : isEnabled
              ? 'border-emerald-300/90 bg-gradient-to-r from-emerald-50 to-teal-50/90 text-emerald-800 shadow-[0_2px_10px_-3px_rgba(16,185,129,0.35)] hover:from-emerald-100/85 hover:to-teal-100/85'
              : 'border-slate-200/90 bg-white text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.05)] hover:border-emerald-300 hover:bg-emerald-50/40 hover:text-emerald-700'
        }`}
      >
        <Sparkles
          size={compact ? 13 : 14.5}
          className={`shrink-0 ${
            !eligible ? 'text-slate-400' : isEnabled ? 'text-emerald-600' : 'text-emerald-600/80'
          }`}
          aria-hidden="true"
        />
        <span className={compact ? 'hidden sm:inline' : 'inline'}>AI</span>
        {eligible && isEnabled ? (
          <span className="inline-flex items-center rounded-full bg-emerald-600 px-1.5 py-0.5 text-[9.5px] font-bold leading-none text-white">
            Bật
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Cài đặt AI tự động trả lời"
          className="absolute bottom-full right-0 z-[220] mb-2.5 w-[min(23rem,calc(100vw-1.5rem))] overflow-hidden rounded-[22px] border border-slate-200/90 bg-white shadow-[0_22px_52px_-14px_rgba(15,23,42,0.22),0_4px_14px_-4px_rgba(15,23,42,0.06)] animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header Strip */}
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-emerald-50/90 via-teal-50/40 to-white px-4 py-3.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm shadow-emerald-600/25">
                <Sparkles size={15} aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h4 className="truncate text-[13.5px] font-bold leading-tight tracking-[-0.01em] text-slate-900">
                  AI tự động trả lời
                </h4>
                <p className="mt-0.5 truncate text-[11px] font-medium leading-tight text-slate-500">
                  Trợ lý DewSkill AI
                </p>
              </div>
            </div>
            <span
              className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[10.5px] font-bold ring-1 ${
                !eligible
                  ? 'bg-slate-100 text-slate-500 ring-slate-200/80'
                  : isEnabled
                    ? 'bg-emerald-100/90 text-emerald-700 ring-emerald-200/80'
                    : 'bg-slate-100 text-slate-500 ring-slate-200/80'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                  !eligible
                    ? 'bg-slate-400'
                    : isEnabled
                      ? 'bg-emerald-500 animate-pulse'
                      : 'bg-slate-400'
                }`}
                aria-hidden="true"
              />
              {!eligible ? 'Chưa áp dụng' : isEnabled ? 'Đang bật' : 'Đang tắt'}
            </span>
          </div>

          {!eligible ? (
            <div className="space-y-3 p-4">
              <div className="flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/75 p-3.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-200/80 bg-white text-slate-500 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                  <Info size={15} aria-hidden="true" />
                </span>
                <p className="text-[12px] font-normal leading-relaxed text-slate-600">
                  {ineligibleReason || defaultIneligibleMsg}
                </p>
              </div>
              {isAdminViewer ? (
                <div className="flex items-start gap-2.5 rounded-2xl border border-emerald-200/75 bg-gradient-to-r from-emerald-50/85 to-teal-50/45 p-3 text-[11.5px] font-normal leading-relaxed text-emerald-900">
                  <Settings size={14} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" />
                  <p>
                    Quản trị toàn hệ thống (bật/tắt khẩn cấp, thời gian mặc định, lịch sử AI) tại{' '}
                    <span className="font-semibold text-emerald-800">Cài đặt → AI Tự động trả lời</span>.
                  </p>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-4 p-4">
              {/* Switch Row */}
              <div
                className={`flex items-center justify-between gap-3 rounded-2xl border p-3.5 transition-all ${
                  isEnabled
                    ? 'border-emerald-200/90 bg-emerald-50/45'
                    : 'border-slate-200/80 bg-slate-50/65 hover:border-slate-300/75'
                }`}
              >
                <div className="min-w-0">
                  <p className="text-[12.5px] font-semibold leading-snug text-slate-800">
                    Tự động trả lời khi chưa có phản hồi
                  </p>
                  <p className="mt-0.5 text-[11px] font-normal leading-snug text-slate-500">
                    DewSkill AI hỗ trợ học viên khi bạn chưa kịp trả lời
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isEnabled}
                  aria-label="Tự động trả lời khi chưa có phản hồi"
                  disabled={saving || !canToggle}
                  onClick={() => applyUpdate({ enabled: !isEnabled, delayMinutes })}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 disabled:opacity-50 ${
                    isEnabled ? 'bg-emerald-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
                      isEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Delay 3x2 Symmetric Grid */}
              <div>
                <div className="mb-2.5 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-700">
                    <Clock size={13} className="shrink-0 text-emerald-600" aria-hidden="true" />
                    Thời gian chờ giảng viên/Admin
                  </span>
                  <span className="whitespace-nowrap rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold tabular-nums text-emerald-700 ring-1 ring-emerald-200/60">
                    {delayMinutes} phút
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {AI_AUTO_REPLY_DELAY_OPTIONS.map((mins) => {
                    const selected = delayMinutes === mins;
                    return (
                      <button
                        key={mins}
                        type="button"
                        disabled={saving || !canToggle}
                        onClick={() => applyUpdate({ delayMinutes: mins })}
                        className={`flex h-9 items-center justify-center rounded-xl text-[12px] font-semibold transition-all disabled:opacity-50 ${
                          selected
                            ? 'bg-gradient-to-b from-emerald-500 to-emerald-600 text-white shadow-sm shadow-emerald-600/25 ring-1 ring-emerald-600/20'
                            : 'border border-slate-200/90 bg-white text-slate-600 hover:border-emerald-300 hover:bg-emerald-50/40 hover:text-emerald-700'
                        }`}
                      >
                        {mins} phút
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Footer Description */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/85 px-3 py-2.5 text-[11px] font-normal leading-relaxed text-slate-500">
                Nếu giảng viên hoặc Admin chưa phản hồi trong{' '}
                <span className="font-semibold text-slate-700">{delayMinutes} phút</span>, DewSkill AI sẽ tự động trả lời học viên.
              </div>

              {!canToggle || !globalEnabled ? (
                <div className="flex items-start gap-2 rounded-xl border border-amber-200/80 bg-amber-50/90 px-3 py-2.5 text-[11px] font-medium leading-relaxed text-amber-900">
                  <Lock size={13} className="mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
                  <span>{state?.lockedReason || 'Admin đang khóa cài đặt AI tự động trả lời.'}</span>
                </div>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
