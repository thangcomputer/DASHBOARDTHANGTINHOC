/**
 * TuitionPaymentModal.jsx
 *
 * Modal học viên đóng học phí — Luồng TỰ ĐỘNG qua SePay:
 *  1. Hiển thị mã QR lấy thông tin từ System_Settings (ngân hàng trung tâm)
 *  2. Polling mỗi 3 giây → GET /api/webhooks/payment-status/:studentId
 *  3. Khi SePay webhook xác nhận → socket event 'tuition:paid' → đóng modal, hiện thành công
 *
 * KHÔNG có polling ở modal giảng viên (xử lý riêng trong AdminDashboard).
 */

import { useState, useEffect, useRef } from 'react';
import { X, Loader2, CheckCircle2, QrCode, RefreshCw, AlertCircle } from 'lucide-react';
import { generateVietQRUrl } from './BankSelect';
import TransferPaymentDetails from './shared/TransferPaymentDetails';
import api from '../services/api';
import { useSocket } from '../context/SocketContext';
import { useToast } from '../utils/toast';
import { setLoginOverlay } from '../utils/loginOverlayGate';

const POLL_INTERVAL = 3000; // 3 giây

export default function TuitionPaymentModal({ student, onClose, onPaid }) {
  const [centerBank, setCenterBank]   = useState(null);
  const [loadingBank, setLoadingBank] = useState(true);
  const [paid, setPaid]               = useState(false);
  const [polling, setPolling]         = useState(false);
  const [seconds, setSeconds]         = useState(0);
  const pollRef = useRef(null);
  const timerRef = useRef(null);
  const { socket } = useSocket() || {};
  const toast = useToast();

  useEffect(() => {
    setLoginOverlay('tuition-payment', true);
    return () => setLoginOverlay('tuition-payment', false);
  }, []);

  // Canonical studentCode from server only — never invent TTH / _id slice
  const studentCode = String(student?.studentCode || '').trim();
  const courseName  = student?.course || 'KHOA HOC';
  const amount      = student?.price || 0;
  const description = studentCode
    ? `${studentCode} Nop hoc phi ${courseName}`
    : '';

  // Lấy thông tin ngân hàng trung tâm từ SystemSettings
  useEffect(() => {
    setLoadingBank(true);
    api.settings.getPayment()
      .then(res => {
        if (res.success && res.data.bankCode && res.data.accountNumber) {
          setCenterBank(res.data);
        } else {
          setCenterBank(null);
        }
      })
      .catch(() => setCenterBank(null))
      .finally(() => setLoadingBank(false));
  }, []);

  // Bắt đầu polling sau khi modal mở
  useEffect(() => {
    if (!student?.id && !student?._id) return;
    const studentId = String(student?._id || student?.id);

    setPolling(true);

    // Polling mỗi 3 giây
    pollRef.current = setInterval(async () => {
      try {
        const res = await api.settings.getPaymentStatus(studentId);
        /* Legacy polling implementation removed; api.settings.getPaymentStatus is canonical.
          {
            headers: {
              Authorization: `Bearer ${(() => {
                try {
                  const keys = ['admin_user', 'teacher_user', 'student_user'];
                  for (const k of keys) {
                    const d = JSON.parse(localStorage.getItem(k) || 'null');
                    if (d?.token) return d.token;
                  }
                } catch (error) {
                  console.error('[TuitionPaymentModal] Payment status polling failed:', error);
                }
                return '';
              })()}`
            }
          }
        ).then(r => r.json());
        */

        if (res?.paid) {
          clearInterval(pollRef.current);
          clearInterval(timerRef.current);
          setPolling(false);
          setPaid(true);
          toast.success('🎉 Xác nhận học phí thành công!', { duration: 5000 });
          setTimeout(() => {
            onPaid?.();
            onClose?.();
          }, 2500);
        }
      } catch (error) {
        console.error('[TuitionPaymentModal] Payment status polling failed:', error);
      }
    }, POLL_INTERVAL);

    // Đếm giây chờ
    timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);

    return () => {
      clearInterval(pollRef.current);
      clearInterval(timerRef.current);
    };
  }, [student]);

  // Lắng nghe socket event từ SePay webhook
  useEffect(() => {
    if (!socket) return;
    const studentId = String(student?._id || student?.id);

    const handler = (data) => {
      if (String(data.studentId) === studentId) {
        clearInterval(pollRef.current);
        clearInterval(timerRef.current);
        setPolling(false);
        setPaid(true);
        toast.success(`🎉 ${data.message}`, { duration: 5000 });
        setTimeout(() => {
          onPaid?.();
          onClose?.();
        }, 2500);
      }
    };

    socket.on('tuition:paid', handler);
    return () => socket.off('tuition:paid', handler);
  }, [socket, student]);

  const qrUrl = centerBank && description
    ? generateVietQRUrl(
        centerBank.bankCode,
        centerBank.accountNumber,
        amount,
        description,
        centerBank.accountName
      )
    : null;

  if (!studentCode) {
    return (
      <div
        className="fixed inset-0 z-[9998] flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
      >
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 text-center">
          <AlertCircle className="mx-auto text-amber-500 mb-3" size={36} />
          <h3 className="font-bold text-lg mb-2">Chưa có mã học viên</h3>
          <p className="text-slate-600 text-sm mb-4">
            Hệ thống chưa cấp mã HV cho học viên này. Không tự tạo mã trên thiết bị.
          </p>
          <button type="button" onClick={onClose} className="cms-btn cms-btn--primary w-full">
            Đóng
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-5 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center transition"
          >
            <X size={16} strokeWidth={2.5} />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <QrCode size={20} />
            </div>
            <div>
              <h3 className="font-black text-lg leading-tight">Đóng học phí</h3>
              <p className="text-blue-100 text-xs">{student?.name}</p>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Paid success state */}
          {paid && (
            <div className="text-center py-6 space-y-3 animate-in fade-in zoom-in-95">
              <CheckCircle2 size={56} className="text-emerald-500 mx-auto" strokeWidth={1.5} />
              <h4 className="text-xl font-black text-gray-900">Đã xác nhận!</h4>
              <p className="text-gray-500 text-sm">Học phí đã được ghi nhận thành công.</p>
            </div>
          )}

          {/* Loading bank info */}
          {!paid && loadingBank && (
            <div className="flex items-center justify-center py-10 gap-3 text-gray-400">
              <Loader2 size={24} className="animate-spin text-blue-400" />
              <span className="text-sm">Đang tải thông tin ngân hàng...</span>
            </div>
          )}

          {/* No bank configured */}
          {!paid && !loadingBank && !centerBank && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
              <AlertCircle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-800 text-sm">Chưa cấu hình tài khoản</p>
                <p className="text-amber-600 text-xs mt-1">Admin cần vào <strong>Cài đặt hệ thống › Tài khoản Thu học phí</strong> để cấu hình ngân hàng.</p>
              </div>
            </div>
          )}

          {/* QR + Info */}
          {!paid && !loadingBank && centerBank && (
            <>
              <TransferPaymentDetails
                courseName={courseName}
                amount={amount}
                qrUrl={qrUrl}
                bankName={centerBank.bankName || centerBank.bankCode}
                accountNumber={centerBank.accountNumber}
                accountName={centerBank.accountName}
              />

              {/* Polling indicator */}
              <div className="flex items-center justify-center gap-2 text-xs text-gray-400 bg-gray-50 rounded-xl py-2.5">
                <RefreshCw size={12} className={polling ? 'animate-spin text-blue-400' : ''} />
                {polling
                  ? `Đang tự động kiểm tra... (${seconds}s)`
                  : 'Chờ xác nhận thanh toán'
                }
              </div>

            </>
          )}
        </div>
      </div>
    </div>
  );
}
