import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Clock, Loader2, XCircle } from 'lucide-react';
import { generateVietQRUrl } from './BankSelect';
import TransferPaymentDetails from './shared/TransferPaymentDetails';
import TransferPaymentHeader from './shared/TransferPaymentHeader';

const PublicPaymentPage = () => {
  const { sessionId } = useParams();
  const API = import.meta.env.VITE_API_URL || "";

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [bankInfo, setBankInfo] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [status, setStatus] = useState('pending'); // 'pending' | 'paid' | 'expired' | 'not_found'

  const timerRef = useRef(null);
  const pollRef = useRef(null);

  // 1. Fetch Initial Data
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch session info
        const sRes = await fetch(`${API}/api/webhooks/payment-status?sessionId=${sessionId}`).then(r => r.json());
        if (sRes.success && sRes.status !== 'not_found') {
          setSession(sRes);
          setTimeLeft(sRes.remaining || 0);
          setStatus(sRes.status);

          // Fetch bank info
          const bRes = await fetch(`${API}/api/settings/bank`).then(r => r.json());
          if (bRes.success) setBankInfo(bRes.data);
        } else {
          setStatus('not_found');
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [sessionId, API]);

  // 2. Timer & Polling
  useEffect(() => {
    if (status !== 'pending') return;

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setStatus('expired');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch(`${API}/api/webhooks/payment-status?sessionId=${sessionId}`).then(x => x.json());
        if (r.paid || r.status === 'paid') {
          clearInterval(timerRef.current);
          clearInterval(pollRef.current);
          setStatus('paid');
        } else if (r.status === 'expired') {
          clearInterval(timerRef.current);
          clearInterval(pollRef.current);
          setStatus('expired');
        }
      } catch (error) {
        console.error('[PublicPaymentPage] Payment status polling failed:', error);
      }
    }, 3000);

    return () => {
      clearInterval(timerRef.current);
      clearInterval(pollRef.current);
    };
  }, [status, sessionId, API]);

  const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={40} className="animate-spin text-blue-600" />
          <p className="text-slate-500 font-bold animate-pulse">Đang tải thông tin thanh toán...</p>
        </div>
      </div>
    );
  }

  if (status === 'not_found') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center">
        <div className="bg-white p-10 rounded-[40px] shadow-2xl max-w-sm w-full space-y-6">
          <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mx-auto text-red-500">
            <XCircle size={48} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800">Không tìm thấy!</h1>
            <p className="text-slate-400 mt-2">Phiên thanh toán không tồn tại hoặc đã bị xóa.</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'paid') {
    return (
      <div className="min-h-screen bg-emerald-50 flex items-center justify-center p-6 text-center">
        <div className="bg-white p-10 rounded-[40px] shadow-2xl max-w-sm w-full space-y-6 animate-in zoom-in duration-500">
          <div className="relative w-24 h-24 mx-auto">
            <div className="absolute inset-0 bg-emerald-100 rounded-full animate-ping opacity-20" />
            <div className="relative w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center text-white shadow-xl shadow-emerald-200">
              <CheckCircle2 size={56} />
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-black text-emerald-700">Thành công!</h1>
            <p className="text-slate-500 mt-3 font-medium">Hệ thống đã nhận được học phí của học viên <strong>{session?.studentName}</strong>.</p>
          </div>
          <div className="pt-6 border-t border-slate-100">
            <p className="text-xs text-slate-400">Bạn có thể đóng cửa sổ này ngay bây giờ.</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'expired') {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6 text-center">
        <div className="bg-white p-10 rounded-[40px] shadow-2xl max-w-sm w-full space-y-6">
          <div className="w-20 h-20 bg-amber-50 rounded-3xl flex items-center justify-center mx-auto text-amber-500">
            <Clock size={48} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800">Hết thời gian!</h1>
            <p className="text-slate-400 mt-2">Phiên thanh toán đã hết hạn sau 5 phút. Vui lòng liên hệ Admin để nhận mã mới.</p>
          </div>
        </div>
      </div>
    );
  }

  const qrUrl = bankInfo?.centerBankCode && bankInfo?.centerBankAccountNumber && session
    ? generateVietQRUrl(
      bankInfo.centerBankCode,
      bankInfo.centerBankAccountNumber,
      session.amount,
      session.ref,
      bankInfo.centerBankAccountName || '',
    )
    : null;

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-white bg-white shadow-2xl">
        <TransferPaymentHeader title="Thanh toán học phí" />

        <div className="space-y-3 p-3">
          <TransferPaymentDetails
            courseName={session?.courseName || session?.studentName || 'Học phí'}
            amount={session?.amount || 0}
            qrUrl={qrUrl}
            bankName={bankInfo?.centerBankName || bankInfo?.centerBankCode}
            accountNumber={bankInfo?.centerBankAccountNumber}
            accountName={bankInfo?.centerBankAccountName}
            error="Chưa cấu hình tài khoản ngân hàng trung tâm."
          />

          <div className={`flex items-center justify-between rounded-xl border px-3 py-2 text-xs ${timeLeft < 60 ? 'border-rose-200 bg-rose-50 text-rose-600' : 'border-slate-100 bg-slate-50 text-slate-500'}`}>
            <span className="font-semibold">Thời gian chờ thanh toán</span>
            <span className="font-mono text-base font-black tabular-nums">{formatTime(timeLeft)}</span>
          </div>

        </div>

        {/* Polling Label Floating */}
        <div className="flex items-center justify-center gap-2 border-t border-slate-100 bg-slate-50 py-2.5 text-xs font-medium text-slate-500">
          <Loader2 size={14} className="animate-spin text-indigo-500" />
          <span>Đang tự động kiểm tra thanh toán...</span>
        </div>
      </div>
    </div>
  );
};

export default PublicPaymentPage;
