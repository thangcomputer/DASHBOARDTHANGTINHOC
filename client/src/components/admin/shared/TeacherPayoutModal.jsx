import React from 'react';
import { DollarSign, X, CreditCard, CheckCircle2, AlertCircle, Loader2, Star } from 'lucide-react';
import { generateVietQRUrl } from '../../BankSelect';
import { formatHoaHong, formatStarBonusRule } from '../../../utils/teacherCommission';

function calcAutoAmount(sessions, rate, includeBonus, bonusTotal) {
  const sessionAmt = Math.max(0, Number(sessions) || 0) * Math.max(0, Number(rate) || 0);
  const bonusAmt = includeBonus ? Math.max(0, Number(bonusTotal) || 0) : 0;
  return sessionAmt + bonusAmt;
}

export default function TeacherPayoutModal({ payoutModal, setPayoutModal, onGoToQR, onConfirm, onSaveRate }) {
  if (!payoutModal) return null;
  const pm = payoutModal;
  const sessCount = Number(pm.sessionsCount) || 0;
  const salaryPS = Number(pm.baseSalaryPerSession) || 0;
  const bonusTotal = Number(pm.starBonus?.unpaidBonusTotal) || 0;
  const includeBonus = !!pm.includeStarBonus && bonusTotal > 0;
  const sessionPay = sessCount * salaryPS;
  const autoAmt = calcAutoAmount(sessCount, salaryPS, includeBonus, bonusTotal);
  const qrUrl = generateVietQRUrl(
    pm.bankInfo?.bankCode || '',
    pm.bankInfo?.accountNumber || '',
    Number(pm.amount) || autoAmt,
    pm.note || `Luong GV ${pm.teacherName}`,
    pm.bankInfo?.accountHolder || pm.bankInfo?.accountName || pm.teacherName || '',
  );

  const close = () => setPayoutModal(null);
  const canGoQr = !pm.isLoading && Number(pm.amount) > 0 && (sessCount > 0 || includeBonus);

  const setRate = (raw) => {
    const rate = Math.max(0, Number(String(raw).replace(/\D/g, '')) || 0);
    const sessions = Math.max(0, Number(pm.sessionsCount) || 0);
    const bonusOn = !!pm.includeStarBonus && bonusTotal > 0;
    setPayoutModal((prev) => ({
      ...prev,
      baseSalaryPerSession: rate,
      amount: String(calcAutoAmount(sessions, rate, bonusOn, Number(prev.starBonus?.unpaidBonusTotal) || 0)),
      rateDirty: true,
    }));
  };

  const syncAmountFromParts = (patch) => {
    setPayoutModal((prev) => {
      if (!prev) return null;
      const next = { ...prev, ...patch };
      const sessions = Math.max(0, Number(next.sessionsCount) || 0);
      const rate = Math.max(0, Number(next.baseSalaryPerSession) || 0);
      const bTotal = Number(next.starBonus?.unpaidBonusTotal) || 0;
      const bonusOn = !!next.includeStarBonus && bTotal > 0;
      return { ...next, amount: String(calcAutoAmount(sessions, rate, bonusOn, bTotal)) };
    });
  };

  const avgStars = Number(pm.starBonus?.avgStars) || 0;
  const ratingCount = Number(pm.starBonus?.ratingCount) || 0;

  return (
    <>
      <div className="cms-sheet-backdrop" onClick={close} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Thanh toán lương giảng viên"
        className="cms-sheet cms-sheet--compact w-full md:max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cms-sheet-handle md:hidden" aria-hidden="true" />

        <div className="cms-sheet-header">
          <span className="cms-sheet-header__side bg-red-50 text-red-600" aria-hidden="true">
            <DollarSign size={18} />
          </span>
          <div className="min-w-0 px-1">
            <h3 className="cms-sheet-header__title">Thanh toán lương</h3>
            <div className="mt-1.5 flex items-center justify-center gap-1.5">
              {['Nhập số liệu', 'Quét QR'].map((label, i) => {
                const active = pm.step === i + 1;
                return (
                  <span
                    key={label}
                    className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${
                      active ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-500'
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
                <div className="flex items-center justify-center py-12 gap-3 text-slate-500">
                  <Loader2 size={20} className="animate-spin text-red-500" />
                  <span className="text-sm font-medium">Đang tải...</span>
                </div>
              ) : (
                <>
                  {/* GV summary */}
                  <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 text-base truncate">{pm.teacherName}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {pm.pendingSessionsCount > 0
                            ? `${pm.pendingSessionsCount} buổi chưa chi`
                            : 'Chưa có buổi completed'}
                          {ratingCount > 0 ? ` · ${avgStars}/5★ (${ratingCount})` : ''}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs uppercase tracking-wide text-slate-400 font-semibold">Nợ lương</p>
                        <p className="text-base font-bold text-slate-900 tabular-nums">
                          {formatHoaHong((Number(pm.pendingSessionsCount) || 0) * salaryPS)}
                        </p>
                      </div>
                    </div>
                    {pm.bankInfo?.bankName && (
                      <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-600">
                        <CreditCard size={13} className="text-slate-400 shrink-0" />
                        <span className="font-medium truncate">{pm.bankInfo.bankName}</span>
                        <span className="font-mono text-slate-800">{pm.bankInfo.accountNumber}</span>
                      </div>
                    )}
                  </div>

                  {/* Rate + sessions */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="cms-label">Lương / buổi</label>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={salaryPS || ''}
                          onChange={(e) => setRate(e.target.value)}
                          className="cms-input font-mono font-semibold tabular-nums"
                          placeholder="150000"
                        />
                      </div>
                      {typeof onSaveRate === 'function' && pm.rateDirty && salaryPS > 0 && (
                        <button
                          type="button"
                          onClick={() => onSaveRate(salaryPS)}
                          className="text-xs font-semibold text-sky-700 mt-1 hover:underline"
                        >
                          Lưu vào hồ sơ GV
                        </button>
                      )}
                    </div>
                    <div>
                      <label className="cms-label">Số buổi chi</label>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => syncAmountFromParts({
                            sessionsCount: String(Math.max(0, sessCount - 1)),
                          })}
                          className="w-9 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold flex items-center justify-center shrink-0"
                          aria-label="Giảm"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min="0"
                          value={pm.sessionsCount}
                          onChange={(e) => syncAmountFromParts({ sessionsCount: e.target.value })}
                          className="cms-input text-center font-bold tabular-nums"
                          aria-label="Số buổi"
                        />
                        <button
                          type="button"
                          onClick={() => syncAmountFromParts({
                            sessionsCount: String(sessCount + 1),
                          })}
                          className="w-9 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold flex items-center justify-center shrink-0"
                          aria-label="Tăng"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Star bonus — compact */}
                  <div className="rounded-xl border border-slate-200 px-3.5 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex items-start gap-2">
                        <Star size={14} className="text-amber-500 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-slate-800">Thưởng sao</p>
                          <p className="text-xs text-slate-500 mt-0.5 leading-snug">
                            {formatStarBonusRule(pm.starBonus || {})}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {bonusTotal > 0 ? (
                          <p className="text-sm font-bold text-emerald-700 tabular-nums">
                            +{formatHoaHong(bonusTotal)}
                          </p>
                        ) : (
                          <p className="text-xs font-medium text-slate-400">Chưa đạt</p>
                        )}
                      </div>
                    </div>
                    {bonusTotal > 0 && (
                      <label className="mt-2.5 flex items-center gap-2 cursor-pointer select-none border-t border-slate-100 pt-2.5">
                        <input
                          type="checkbox"
                          checked={!!pm.includeStarBonus}
                          onChange={(e) => syncAmountFromParts({ includeStarBonus: e.target.checked })}
                          className="rounded border-slate-300"
                        />
                        <span className="text-xs font-medium text-slate-700">
                          Cộng vào lần thanh toán này
                          {pm.starBonus?.unpaidMonths?.length
                            ? ` (${pm.starBonus.unpaidMonths.map((m) => m.month).join(', ')})`
                            : ''}
                        </span>
                      </label>
                    )}
                  </div>

                  {/* Amount + note */}
                  <div>
                    <label className="cms-label">Số tiền chuyển (VNĐ)</label>
                    <input
                      type="number"
                      min="0"
                      value={pm.amount}
                      onChange={(e) => setPayoutModal((prev) => ({ ...prev, amount: e.target.value }))}
                      className="cms-input font-bold tabular-nums text-red-700 text-base"
                      placeholder="0"
                    />
                    {autoAmt > 0 && Number(pm.amount) !== autoAmt && (
                      <button
                        type="button"
                        onClick={() => setPayoutModal((prev) => ({ ...prev, amount: String(autoAmt) }))}
                        className="text-xs text-sky-700 mt-1 font-semibold hover:underline"
                      >
                        Dùng số tự tính: {autoAmt.toLocaleString('vi-VN')}đ
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="cms-label">Nội dung CK</label>
                    <input
                      type="text"
                      value={pm.note || ''}
                      onChange={(e) => setPayoutModal((prev) => ({ ...prev, note: e.target.value }))}
                      className="cms-input"
                      placeholder="Lương giảng dạy tháng..."
                    />
                  </div>

                  {/* Breakdown */}
                  <div className="rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-3 space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Lương cứng ({sessCount} × {formatHoaHong(salaryPS)})</span>
                      <span className="font-semibold tabular-nums text-slate-800">{formatHoaHong(sessionPay)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Thưởng sao</span>
                      <span className="font-semibold tabular-nums text-slate-800">
                        {includeBonus ? `+${formatHoaHong(bonusTotal)}` : '0đ'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center border-t border-slate-200 pt-2 mt-1">
                      <span className="font-semibold text-slate-800 text-sm">Tổng chuyển</span>
                      <span className="text-base font-bold text-red-600 tabular-nums">
                        {Number(pm.amount || 0).toLocaleString('vi-VN')}đ
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="cms-sheet-footer">
              <button type="button" onClick={close} className="cms-btn cms-btn-outline">Huỷ</button>
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
                <p className="font-semibold text-slate-900">Quét QR chuyển khoản</p>
                <p className="text-sm text-slate-500 mt-1">
                  <span className="font-bold text-red-600 tabular-nums">
                    {Number(pm.amount).toLocaleString('vi-VN')}đ
                  </span>
                  {' → '}
                  <span className="font-semibold text-slate-800">{pm.teacherName}</span>
                </p>
              </div>

              {qrUrl ? (
                <div className="flex justify-center">
                  <div className="border border-slate-200 rounded-2xl p-3 bg-white">
                    <img
                      src={qrUrl}
                      alt="QR Chuyển khoản"
                      className="w-52 h-52 object-contain rounded-xl"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                    <div
                      style={{ display: 'none' }}
                      className="w-52 h-52 flex flex-col items-center justify-center text-slate-400 gap-2"
                    >
                      <AlertCircle size={28} />
                      <p className="text-xs text-center px-3">Không tải được QR</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-center">
                  <AlertCircle size={22} className="text-amber-500 mx-auto mb-2" />
                  <p className="text-sm text-amber-900 font-medium">Thiếu thông tin ngân hàng</p>
                  <p className="text-xs text-amber-800/80 mt-1">Cập nhật mã NH &amp; số TK trên hồ sơ GV</p>
                </div>
              )}

              <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-3 space-y-2 text-sm">
                {[
                  ['Ngân hàng', pm.bankInfo?.bankName || '—'],
                  ['Số TK', pm.bankInfo?.accountNumber || '—'],
                  ['Chủ TK', pm.bankInfo?.accountHolder || pm.teacherName],
                  ['Nội dung', pm.note || '—'],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3">
                    <span className="text-slate-500 shrink-0">{k}</span>
                    <span className={`font-medium text-right ${k === 'Số TK' ? 'font-mono' : ''}`}>{v}</span>
                  </div>
                ))}
                <div className="flex justify-between gap-3 border-t border-slate-100 pt-2 items-center">
                  <span className="font-semibold text-slate-700">Số tiền</span>
                  <span className="font-bold text-base text-red-600 tabular-nums">
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
