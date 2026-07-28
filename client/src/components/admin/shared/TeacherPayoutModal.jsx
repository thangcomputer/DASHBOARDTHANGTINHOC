import React from 'react';
import { DollarSign, X, CreditCard, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { generateVietQRUrl } from '../../BankSelect';

export default function TeacherPayoutModal({ payoutModal, setPayoutModal, onGoToQR, onConfirm }) {
  if (!payoutModal) return null;
  const pm = payoutModal;
  const sessCount = Number(pm.sessionsCount) || 0;
  const salaryPS = pm.baseSalaryPerSession || 0;
  const autoAmt = sessCount * salaryPS;
  const qrUrl = generateVietQRUrl(
    pm.bankInfo?.bankCode || '',
    pm.bankInfo?.accountNumber || '',
    Number(pm.amount) || autoAmt,
    pm.note || `Luong GV ${pm.teacherName}`,
    pm.bankInfo?.accountHolder || pm.bankInfo?.accountName || pm.teacherName || '',
  );

  const close = () => setPayoutModal(null);
  const canGoQr = !pm.isLoading && Number(pm.amount) > 0 && Number(pm.sessionsCount) > 0;

  return (
    <>
      <div className="cms-sheet-backdrop" onClick={close} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Thanh toán lương giảng viên"
        className="cms-sheet w-full md:max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cms-sheet-handle md:hidden" aria-hidden="true" />

        <div className="cms-sheet-header">
          <span className="cms-sheet-header__side bg-red-50 text-red-600" aria-hidden="true">
            <DollarSign size={18} />
          </span>
          <div className="min-w-0 px-1">
            <h3 className="cms-sheet-header__title">Thanh toán lương GV</h3>
            <div className="mt-1.5 flex items-center justify-center gap-1.5 overflow-x-auto hide-scrollbar">
              {['Nhập thông tin', 'Quét QR'].map((label, i) => {
                const active = pm.step === i + 1;
                return (
                  <span
                    key={label}
                    className={`shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                      active
                        ? 'bg-red-600 text-white'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {i + 1}. {label}
                  </span>
                );
              })}
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Đóng"
            className="cms-sheet-header__side bg-slate-50 text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {pm.step === 1 && (
          <>
            <div className="cms-sheet-body space-y-4">
              {pm.isLoading ? (
                <div className="flex items-center justify-center py-10 gap-3 text-slate-500">
                  <Loader2 size={20} className="animate-spin text-red-500" />
                  <span className="text-sm font-medium">Đang tải thông tin giảng viên...</span>
                </div>
              ) : (
                <>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="font-semibold text-slate-900 text-[16px] truncate">{pm.teacherName}</p>
                    <div className="grid grid-cols-3 gap-2 mt-3">
                      <div className="min-w-0">
                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wide">Lương/buổi</p>
                        <p className="font-semibold text-slate-800 text-[13px] tabular-nums truncate">
                          {salaryPS.toLocaleString('vi-VN')}đ
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wide">Buổi nợ</p>
                        <p className="font-semibold text-amber-700 text-[13px] tabular-nums">
                          {pm.pendingSessionsCount} buổi
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wide">Tổng nợ</p>
                        <p className="font-semibold text-red-600 text-[13px] tabular-nums truncate">
                          {(pm.pendingSessionsCount * salaryPS).toLocaleString('vi-VN')}đ
                        </p>
                      </div>
                    </div>
                    {pm.bankInfo?.bankName && (
                      <div className="mt-3 pt-3 border-t border-slate-200 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-slate-600">
                        <CreditCard size={14} className="text-sky-600 shrink-0" />
                        <span className="font-semibold">{pm.bankInfo.bankName}</span>
                        <span className="font-mono font-bold text-slate-800">{pm.bankInfo.accountNumber}</span>
                        {pm.bankInfo.accountHolder && (
                          <span className="text-slate-400 truncate">{pm.bankInfo.accountHolder}</span>
                        )}
                      </div>
                    )}
                  </div>

                  {salaryPS === 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
                      <AlertCircle size={15} className="text-amber-600 mt-0.5 shrink-0" />
                      <p className="text-[13px] text-amber-800 font-medium leading-snug">
                        Giảng viên chưa có mức lương/buổi. Cập nhật ở Giảng viên → Chỉnh sửa trước.
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3">
                    <div>
                      <label className="cms-label">Số buổi muốn thanh toán</label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const cur = Math.max(0, Number(pm.sessionsCount || 0) - 1);
                            setPayoutModal((prev) => ({
                              ...prev,
                              sessionsCount: String(cur),
                              amount: String(cur * salaryPS),
                            }));
                          }}
                          className="w-11 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-lg flex items-center justify-center transition shrink-0"
                          aria-label="Giảm số buổi"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min="0"
                          value={pm.sessionsCount}
                          onChange={(e) => {
                            const s = e.target.value;
                            const autoA = Math.max(0, Number(s)) * salaryPS;
                            setPayoutModal((prev) => ({
                              ...prev,
                              sessionsCount: s,
                              amount: String(autoA),
                            }));
                          }}
                          className="cms-input text-center font-bold tabular-nums"
                          placeholder="0"
                          aria-label="Số buổi"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const cur = Number(pm.sessionsCount || 0) + 1;
                            setPayoutModal((prev) => ({
                              ...prev,
                              sessionsCount: String(cur),
                              amount: String(cur * salaryPS),
                            }));
                          }}
                          className="w-11 h-11 rounded-xl bg-red-50 hover:bg-red-100 font-bold text-lg text-red-700 flex items-center justify-center transition shrink-0"
                          aria-label="Tăng số buổi"
                        >
                          +
                        </button>
                      </div>
                      <p className="text-[12px] text-slate-500 mt-1.5">
                        {pm.pendingSessionsCount > 0
                          ? `Hệ thống ghi nhận: ${pm.pendingSessionsCount} buổi chưa thanh toán`
                          : 'Chưa có lịch dạy completed — nhập thủ công'}
                      </p>
                    </div>

                    <div>
                      <label className="cms-label">Số tiền thanh toán (VND)</label>
                      <input
                        type="number"
                        min="0"
                        value={pm.amount}
                        onChange={(e) => setPayoutModal((prev) => ({ ...prev, amount: e.target.value }))}
                        className="cms-input font-bold tabular-nums text-red-700"
                        placeholder="Tự nhập hoặc tự tính"
                      />
                      {autoAmt > 0 && Number(pm.amount) !== autoAmt && (
                        <button
                          type="button"
                          onClick={() => setPayoutModal((prev) => ({ ...prev, amount: String(autoAmt) }))}
                          className="text-[12px] text-sky-700 mt-1.5 font-semibold underline"
                        >
                          Khôi phục = {autoAmt.toLocaleString('vi-VN')}đ
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="cms-label">Nội dung chuyển khoản</label>
                    <textarea
                      value={pm.note || ''}
                      onChange={(e) => setPayoutModal((prev) => ({ ...prev, note: e.target.value }))}
                      className="cms-input !min-h-[72px] py-3 resize-none"
                      rows={2}
                      placeholder="Thù lao dạy tháng..."
                    />
                  </div>

                  {Number(pm.amount) > 0 && (
                    <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 flex items-center justify-between gap-3">
                      <span className="text-[13px] text-red-800 font-medium">Tổng cần chuyển</span>
                      <span className="text-lg font-bold text-red-700 tabular-nums">
                        {Number(pm.amount).toLocaleString('vi-VN')}đ
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="cms-sheet-footer">
              <button type="button" onClick={close} className="cms-btn cms-btn-outline">
                Huỷ
              </button>
              <button
                type="button"
                onClick={onGoToQR}
                disabled={!canGoQr}
                className="cms-btn cms-btn-primary"
              >
                <CreditCard size={16} /> Xem QR
              </button>
            </div>
          </>
        )}

        {pm.step === 2 && (
          <>
            <div className="cms-sheet-body space-y-4">
              <div className="text-center">
                <p className="font-semibold text-slate-900 text-base">Quét mã QR để chuyển khoản</p>
                <p className="text-[13px] text-slate-500 mt-1">
                  {Number(pm.amount).toLocaleString('vi-VN')}đ →{' '}
                  <span className="font-semibold text-slate-800">{pm.teacherName}</span>
                </p>
              </div>

              {qrUrl ? (
                <div className="flex justify-center">
                  <div className="border-2 border-slate-200 rounded-2xl p-2 bg-white shadow-sm">
                    <img
                      src={qrUrl}
                      alt="QR Chuyển khoản"
                      className="w-52 h-52 sm:w-56 sm:h-56 object-contain rounded-xl"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                    <div
                      style={{ display: 'none' }}
                      className="w-52 h-52 sm:w-56 sm:h-56 flex flex-col items-center justify-center text-slate-400 gap-2"
                    >
                      <AlertCircle size={32} />
                      <p className="text-xs text-center px-3">
                        Không thể tải QR.
                        <br />
                        Vui lòng chuyển thủ công.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-center">
                  <AlertCircle size={28} className="text-amber-500 mx-auto mb-2" />
                  <p className="text-sm text-amber-800 font-medium">
                    Giảng viên chưa có thông tin ngân hàng đầy đủ (mã NH &amp; số TK)
                  </p>
                  <p className="text-xs text-amber-700 mt-1">Vui lòng cập nhật hồ sơ giảng viên</p>
                </div>
              )}

              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-2.5 text-[13px]">
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500 shrink-0">Ngân hàng</span>
                  <span className="font-semibold text-right">{pm.bankInfo?.bankName || '—'}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500 shrink-0">Số tài khoản</span>
                  <span className="font-mono font-bold text-right">{pm.bankInfo?.accountNumber || '—'}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500 shrink-0">Chủ tài khoản</span>
                  <span className="font-semibold text-right">
                    {pm.bankInfo?.accountHolder || pm.teacherName}
                  </span>
                </div>
                <div className="flex justify-between gap-3 border-t border-slate-200 pt-2.5">
                  <span className="text-slate-500 shrink-0">Nội dung CK</span>
                  <span className="font-medium text-right max-w-[62%]">{pm.note}</span>
                </div>
                <div className="flex justify-between gap-3 border-t border-slate-200 pt-2.5 items-center">
                  <span className="font-semibold text-slate-700">Số tiền</span>
                  <span className="font-bold text-lg text-red-600 tabular-nums">
                    {Number(pm.amount).toLocaleString('vi-VN')}đ
                  </span>
                </div>
              </div>
            </div>

            <div className="cms-sheet-footer">
              <button
                type="button"
                onClick={() => setPayoutModal((prev) => ({ ...prev, step: 1 }))}
                className="cms-btn cms-btn-outline"
              >
                ← Quay lại
              </button>
              <button type="button" onClick={onConfirm} className="cms-btn cms-btn-primary">
                <CheckCircle2 size={16} /> Đã chuyển xong
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
