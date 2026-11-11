import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, ShoppingBag, X, Zap } from 'lucide-react';
import dailyPracticeApi from '../../../services/dailyPracticeApi';
import api from '../../../services/api';
import { generateVietQRUrl } from '../../bankSelectUtils';
import TransferPaymentDetails from '../../shared/TransferPaymentDetails';
import { gameSounds } from '../../../utils/sound';

const POLL_MS = 3000;

/** Modal mua XP luyện tập - chuyển khoản VietQR, SePay tự cộng. */
export default function BuyXpModal({ packs = [], onClose, onPaid }) {
  const [packId, setPackId] = useState(packs[0]?.id || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [order, setOrder] = useState(null);
  const [bank, setBank] = useState(null);
  const [paid, setPaid] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const pollRef = useRef(null);
  const firedRef = useRef(false);
  const closeTimerRef = useRef(null);

  const selected = useMemo(
    () => (packs || []).find((pack) => pack.id === packId) || packs[0] || null,
    [packs, packId],
  );

  useEffect(() => {
    let cancelled = false;
    api.settings.getPayment()
      .then((res) => {
        if (cancelled) return;
        if (res?.success && res.data?.bankCode && res.data?.accountNumber) setBank(res.data);
        else setBank(null);
      })
      .catch(() => { if (!cancelled) setBank(null); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
  }, []);

  const qrUrl = bank?.bankCode && bank?.accountNumber && order
    ? generateVietQRUrl(bank.bankCode, bank.accountNumber, order.amount, order.ref, bank.accountName || '')
    : null;

  const startPoll = (sessionId) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const status = await dailyPracticeApi.student.xpPurchaseStatus(sessionId);
        if (status.paid && !firedRef.current) {
          firedRef.current = true;
          clearInterval(pollRef.current);
          celebrate(status);
        }
      } catch {
        /* ignore poll errors */
      }
    }, POLL_MS);
  };

  const markPaid = async () => {
    if (!order?.sessionId || simulating || paid) return;
    setSimulating(true);
    setError('');
    try {
      const status = await dailyPracticeApi.student.simulateXpPaid(order.sessionId);
      if (!firedRef.current) {
        firedRef.current = true;
        if (pollRef.current) clearInterval(pollRef.current);
        celebrate(status);
      }
    } catch (err) {
      setError(err.message || 'Không xác nhận được thanh toán');
    } finally {
      setSimulating(false);
    }
  };

  const celebrate = (status) => {
    setPaid(true);
    gameSounds.win();
    onPaid?.(status);
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => onClose?.(), 2800);
  };

  const checkout = async () => {
    if (!selected || busy) return;
    setBusy(true);
    setError('');
    try {
      const data = await dailyPracticeApi.student.buyXp(selected.id);
      setOrder(data);
      firedRef.current = false;
      startPoll(data.sessionId);
    } catch (err) {
      setError(err.message || 'Không tạo được đơn mua XP');
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9800] flex items-end justify-center bg-slate-950/50 p-3 sm:items-center" role="presentation" onClick={onClose}>
      <div
        className="cms-goal-in w-full max-w-md overflow-hidden rounded-[28px] bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dp-buy-xp-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <ShoppingBag size={18} aria-hidden="true" />
            </span>
            <div>
              <h3 id="dp-buy-xp-title" className="text-base font-black text-slate-900">Mua XP luyện tập</h3>
              <p className="text-[11px] font-semibold text-slate-500">Chuyển khoản là cộng XP, luyện tiếp được ngay</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng" className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 !shadow-none">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          {paid ? (
            <div className="px-2 py-3 text-center">
              <div className="relative mx-auto h-40 w-40">
                <span className="dp-pay-ring absolute inset-0 rounded-full bg-emerald-400/30" />
                <span className="dp-pay-ring dp-pay-ring-delay absolute inset-3 rounded-full bg-emerald-400/25" />
                <span className="dp-pay-circle absolute inset-4 overflow-hidden rounded-full bg-black shadow-lg ring-4 ring-emerald-500">
                  <img
                    src="/mascot/thanh-toan-thanh-cong.gif"
                    alt="Thanh toán thành công"
                    className="dp-pay-mascot h-full w-full object-cover"
                    draggable={false}
                  />
                </span>
                <span className="dp-pay-circle absolute bottom-3 right-3 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500 ring-4 ring-white shadow-md">
                  <svg viewBox="0 0 52 52" className="h-7 w-7" aria-hidden="true">
                    <path className="dp-pay-check" fill="none" stroke="white" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" d="M14 27 l8 8 l16-16" />
                  </svg>
                </span>
              </div>
              <p className="dp-pay-copy mt-2 text-lg font-black text-emerald-800">Bạn đã thanh toán thành công</p>
              <p className="dp-pay-copy text-sm font-semibold text-emerald-700">
                +{order?.xp || selected?.xp || 0} XP đã được cộng. Bạn có thể luyện tiếp ngay.
              </p>
            </div>
          ) : !order ? (
            <>
              <div className="grid gap-2">
                {(packs || []).map((pack) => {
                  const active = selected?.id === pack.id;
                  return (
                    <button
                      key={pack.id}
                      type="button"
                      onClick={() => setPackId(pack.id)}
                      className={`flex items-center justify-between gap-3 rounded-2xl border-2 px-4 py-3 text-left transition !shadow-none ${active ? 'border-amber-400 bg-amber-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${active ? 'bg-amber-400 text-amber-950' : 'bg-slate-100 text-slate-500'}`}>
                          <Zap size={18} className={active ? 'fill-amber-100' : ''} aria-hidden="true" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-black text-slate-900">+{pack.xp} XP</span>
                          <span className="block text-[11px] font-semibold text-slate-500">Đủ khoảng {Math.floor(pack.xp / 20)} lượt luyện</span>
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-black tabular-nums text-red-600">
                        {Number(pack.priceVnd || 0).toLocaleString('vi-VN')}đ
                      </span>
                    </button>
                  );
                })}
              </div>
              {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
              <button type="button" disabled={!selected || busy} onClick={checkout} className="cms-btn cms-btn-primary cms-btn-brand w-full !py-3">
                {busy ? <Loader2 size={17} className="animate-spin" /> : <ShoppingBag size={17} />}
                Mua {selected?.label || 'XP'}
              </button>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-slate-600">
                Chuyển khoản đúng nội dung <span className="font-black text-slate-900">{order.ref}</span> để hệ thống tự cộng {order.xp} XP.
              </p>
              <TransferPaymentDetails
                courseName={order.pack?.label || 'Gói XP'}
                amount={order.amount}
                qrUrl={qrUrl}
                loading={!bank}
                error={!bank ? 'Chưa cấu hình tài khoản nhận tiền.' : ''}
              />
              <p className="text-center text-[11px] font-semibold text-slate-400">Đang chờ thanh toán…</p>
              {import.meta.env.DEV && (
                <button
                  type="button"
                  onClick={markPaid}
                  disabled={simulating}
                  className="w-full rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 py-2.5 text-xs font-black text-amber-900 hover:bg-amber-100 disabled:opacity-60"
                >
                  {simulating ? 'Đang cộng XP…' : 'Đã thanh toán'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
