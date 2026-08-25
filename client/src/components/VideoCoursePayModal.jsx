import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, CheckCircle2, Copy, QrCode } from 'lucide-react';
import { generateVietQRUrl } from './BankSelect';
import { useSocket } from '../context/SocketContext';
import { useToast } from '../utils/toast';
import api from '../services/api';

const POLL_MS = 3000;

export default function VideoCoursePayModal({ courseTitle, sessionId, refCode, amount, onClose, onPaid }) {
  const [centerBank, setCenterBank] = useState(null);
  const [loadingBank, setLoadingBank] = useState(true);
  const [paid, setPaid] = useState(false);
  const pollRef = useRef(null);
  const onPaidRef = useRef(onPaid);
  const firedRef = useRef(false);
  const { socket } = useSocket() || {};
  const toast = useToast();
  onPaidRef.current = onPaid;

  useEffect(() => {
    firedRef.current = false;
    setPaid(false);
  }, [sessionId]);

  const markPaid = () => {
    if (firedRef.current) return;
    firedRef.current = true;
    setPaid(true);
    onPaidRef.current?.();
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

  useEffect(() => {
    if (!sessionId || paid) return undefined;
    const tick = async () => {
      try {
        const res = await api.trainingLms.getVideoPurchaseSession(sessionId);
        if (res?.paid || res?.status === 'paid') markPaid();
      } catch { /* ignore */ }
    };
    pollRef.current = setInterval(tick, POLL_MS);
    tick();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [sessionId, paid]);

  useEffect(() => {
    if (!socket || !sessionId) return undefined;
    const onPaidEvt = (payload) => {
      if (payload?.sessionId && payload.sessionId !== sessionId) return;
      markPaid();
    };
    socket.on('videoCourse:paid', onPaidEvt);
    return () => socket.off('videoCourse:paid', onPaidEvt);
  }, [socket, sessionId]);

  const copyRef = async () => {
    try {
      await navigator.clipboard.writeText(refCode || '');
      toast.success('Đã sao chép nội dung CK');
    } catch {
      toast.error('Không sao chép được');
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[140000] flex items-center justify-center p-4 bg-black/60" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 text-sm">Thanh toán khóa video</h3>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500" aria-label="Đóng">
            <X size={18} />
          </button>
        </div>
        <div className="p-5">
          {paid ? (
            <div className="text-center py-6">
              <CheckCircle2 className="mx-auto text-emerald-500 mb-2" size={40} />
              <p className="font-bold text-slate-800">Thanh toán thành công</p>
              <p className="text-sm text-slate-500 mt-1">Bạn có thể vào học khóa này ngay.</p>
              <button type="button" onClick={onClose} className="mt-4 px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-bold">
                Vào học
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm font-semibold text-slate-700 mb-1 line-clamp-2">{courseTitle}</p>
              <p className="text-2xl font-black text-red-600 tabular-nums mb-4">
                {Number(amount || 0).toLocaleString('vi-VN')}đ
              </p>
              {loadingBank ? (
                <div className="flex justify-center py-8 text-slate-400"><Loader2 className="animate-spin" /></div>
              ) : !qrUrl ? (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
                  Chưa cấu hình tài khoản ngân hàng trung tâm (Admin → Cài đặt). Không tạo được QR.
                </p>
              ) : (
                <div className="flex flex-col items-center">
                  <img src={qrUrl} alt="VietQR" className="w-56 h-56 rounded-xl border border-slate-200 bg-white" />
                  <p className="text-[11px] text-slate-500 mt-2 text-center">
                    Quét bằng app ngân hàng hoặc MoMo (quét VietQR). Nội dung CK phải khớp.
                  </p>
                  <div className="mt-3 w-full flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                    <QrCode size={14} className="text-slate-400 shrink-0" />
                    <code className="text-xs font-bold text-slate-700 flex-1 break-all">{refCode}</code>
                    <button type="button" onClick={copyRef} className="p-1.5 rounded-lg hover:bg-white text-slate-500" title="Sao chép">
                      <Copy size={14} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
