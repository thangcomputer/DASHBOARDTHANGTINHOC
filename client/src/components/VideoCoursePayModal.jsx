import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, Copy, QrCode, RefreshCw, Video, Sparkles } from 'lucide-react';
import { generateVietQRUrl } from './BankSelect';
import { useSocket } from '../context/SocketContext';
import { useToast } from '../utils/toast';
import api from '../services/api';

const POLL_MS = 3000;
const IS_DEV = import.meta.env.DEV;

export default function VideoCoursePayModal({
  courseTitle,
  sessionId,
  refCode,
  amount,
  onClose,
  onPaid,
  onSessionAlreadyPaid,
}) {
  const [centerBank, setCenterBank] = useState(null);
  const [loadingBank, setLoadingBank] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);
  const [polling, setPolling] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const pollRef = useRef(null);
  const timerRef = useRef(null);
  const onPaidRef = useRef(onPaid);
  const onSessionAlreadyPaidRef = useRef(onSessionAlreadyPaid);
  const firedRef = useRef(false);
  const { socket } = useSocket() || {};
  const toast = useToast();
  onPaidRef.current = onPaid;
  onSessionAlreadyPaidRef.current = onSessionAlreadyPaid;

  useEffect(() => {
    firedRef.current = false;
    setSessionReady(false);
    setSeconds(0);
    setPolling(false);
  }, [sessionId]);

  const markPaid = () => {
    if (firedRef.current) return;
    firedRef.current = true;
    setPolling(false);
    if (pollRef.current) clearInterval(pollRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    onPaidRef.current?.();
  };

  const markAlreadyPaid = () => {
    if (firedRef.current) return;
    firedRef.current = true;
    setPolling(false);
    if (pollRef.current) clearInterval(pollRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    onSessionAlreadyPaidRef.current?.();
  };

  const qrUrl = centerBank?.bankCode && centerBank?.accountNumber
    ? generateVietQRUrl(
      centerBank.bankCode,
      centerBank.accountNumber,
      amount,
      refCode,
      centerBank.accountName || '',
    )
    : null;

  useEffect(() => {
    let cancelled = false;
    setLoadingBank(true);
    api.settings.getPayment()
      .then((res) => {
        if (cancelled) return;
        if (res?.success && res.data?.bankCode && res.data?.accountNumber) {
          setCenterBank(res.data);
        } else setCenterBank(null);
      })
      .catch(() => { if (!cancelled) setCenterBank(null); })
      .finally(() => { if (!cancelled) setLoadingBank(false); });
    return () => { cancelled = true; };
  }, []);

  // Kiểm tra session trước khi hiện QR — tránh modal success khi reload session đã paid
  useEffect(() => {
    if (!sessionId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.trainingLms.getVideoPurchaseSession(sessionId);
        if (cancelled) return;
        if (res?.paid || res?.status === 'paid') {
          markAlreadyPaid();
          return;
        }
      } catch { /* ignore */ }
      if (!cancelled) setSessionReady(true);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ khi đổi sessionId
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || !sessionReady || firedRef.current) return undefined;
    setPolling(true);
    setSeconds(0);

    const tick = async () => {
      try {
        const res = await api.trainingLms.getVideoPurchaseSession(sessionId);
        if (res?.paid || res?.status === 'paid') markPaid();
      } catch { /* ignore */ }
    };
    pollRef.current = setInterval(tick, POLL_MS);
    tick();

    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [sessionId, sessionReady]);

  useEffect(() => {
    if (!socket || !sessionId || !sessionReady) return undefined;
    const onPaidEvt = (payload) => {
      if (payload?.sessionId && payload.sessionId !== sessionId) return;
      markPaid();
    };
    socket.on('videoCourse:paid', onPaidEvt);
    return () => socket.off('videoCourse:paid', onPaidEvt);
  }, [socket, sessionId, sessionReady]);

  const copyRef = async () => {
    try {
      await navigator.clipboard.writeText(refCode || '');
      toast.success('Đã sao chép nội dung CK');
    } catch {
      toast.error('Không sao chép được');
    }
  };

  const handleTestPaid = () => {
    toast.success('Test: giả lập thanh toán thành công');
    markPaid();
  };

  if (!sessionReady) return null;

  return createPortal(
    <div className="fixed inset-0 z-[140000] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200/80">
        <div className="relative px-4 py-3.5 bg-gradient-to-r from-red-600 via-rose-600 to-indigo-700 text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_55%)] pointer-events-none" aria-hidden="true" />
          <div className="relative flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                <Video size={18} aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h3 className="font-black text-sm tracking-tight">Thanh toán khóa video</h3>
                <p className="text-[10px] text-white/80 font-medium">VietQR · Tự động xác nhận</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-white/15 text-white/90 shrink-0" aria-label="Đóng">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-5">
          <div className="rounded-xl bg-gradient-to-br from-slate-50 to-indigo-50/60 border border-slate-100 p-3.5 mb-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Khóa học</p>
            <p className="text-sm font-bold text-slate-800 line-clamp-2">{courseTitle}</p>
            <p className="text-2xl font-black text-red-600 tabular-nums mt-2">
              {Number(amount || 0).toLocaleString('vi-VN')}đ
            </p>
          </div>

          {loadingBank ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400 gap-2">
              <Loader2 className="animate-spin" size={28} />
              <span className="text-xs font-medium">Đang tải thông tin thanh toán…</span>
            </div>
          ) : !qrUrl ? (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3.5">
              Chưa cấu hình tài khoản ngân hàng trung tâm (Admin → Cài đặt). Không tạo được QR.
            </p>
          ) : (
            <div className="flex flex-col items-center">
              <div className="p-2.5 rounded-2xl bg-gradient-to-br from-white to-slate-50 border-2 border-indigo-100 shadow-md shadow-indigo-100/50">
                <img src={qrUrl} alt="VietQR" className="w-52 h-52 sm:w-56 sm:h-56 rounded-xl bg-white object-contain" />
              </div>
              <p className="text-[11px] text-slate-500 mt-3 text-center leading-relaxed max-w-xs">
                Quét bằng app ngân hàng hoặc MoMo (VietQR). <strong className="text-slate-700">Nội dung CK phải khớp.</strong>
              </p>

              {centerBank ? (
                <div className="mt-3 w-full rounded-xl bg-slate-50 border border-slate-100 p-3 space-y-1.5 text-xs">
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500 shrink-0">Ngân hàng</span>
                    <span className="font-bold text-slate-800 text-right">{centerBank.bankName || centerBank.bankCode}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500 shrink-0">Số TK</span>
                    <span className="font-mono font-bold text-slate-800">{centerBank.accountNumber}</span>
                  </div>
                  {centerBank.accountName ? (
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500 shrink-0">Chủ TK</span>
                      <span className="font-bold text-slate-800 text-right uppercase">{centerBank.accountName}</span>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-3 w-full flex items-center gap-2 bg-indigo-50/80 border border-indigo-100 rounded-xl px-3 py-2.5">
                <QrCode size={14} className="text-indigo-500 shrink-0" />
                <code className="text-xs font-bold text-indigo-900 flex-1 break-all">{refCode}</code>
                <button type="button" onClick={copyRef} className="p-1.5 rounded-lg hover:bg-white text-indigo-600 shrink-0" title="Sao chép">
                  <Copy size={14} />
                </button>
              </div>
            </div>
          )}

          {qrUrl && !loadingBank ? (
            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-xl py-2.5 px-3">
              <RefreshCw size={12} className={polling ? 'animate-spin text-indigo-500 shrink-0' : 'shrink-0'} />
              {polling
                ? `Đang tự động kiểm tra thanh toán… (${seconds}s)`
                : 'Chờ xác nhận thanh toán'}
            </div>
          ) : null}

          <p className="mt-3 text-[11px] text-center text-slate-400 leading-relaxed flex items-start justify-center gap-1">
            <Sparkles size={12} className="text-amber-500 shrink-0 mt-0.5" aria-hidden="true" />
            <span>Sau khi chuyển khoản, hệ thống <strong className="text-slate-600">tự quét mỗi 3 giây</strong> và mở khóa khi nhận được tiền.</span>
          </p>

          {IS_DEV && qrUrl && !loadingBank ? (
            <button
              type="button"
              onClick={handleTestPaid}
              className="mt-4 w-full py-2.5 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 text-amber-900 text-xs font-bold hover:bg-amber-100 transition"
            >
              Đã thanh toán (test — chỉ dev)
            </button>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
