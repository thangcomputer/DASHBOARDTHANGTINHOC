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

  return (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[150] p-4 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">

              {/* Header */}
              <div className="bg-gradient-to-r from-emerald-700 to-emerald-600 px-6 py-4 text-white flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <DollarSign size={20} />
                  <div>
                    <h3 className="font-bold text-base leading-tight">Thanh Toán Lương Giảng Viên</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      {['Nhập thông tin', 'Quét QR chuyển khoản'].map((s, i) => (
                        <span key={i} className={`text-xs px-2 py-0.5 rounded-full ${pm.step === i + 1 ? 'bg-white text-emerald-700 font-bold' : 'bg-emerald-800/50 text-emerald-200'}`}>
                          {i + 1}. {s}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <button onClick={() => setPayoutModal(null)} className="hover:bg-emerald-800/40 rounded-lg p-1 transition"><X size={20} /></button>
              </div>

              {/* BƯỚC 1: FORM NHẬP */}
              {pm.step === 1 && (
                <>
                  <div className="p-6 space-y-4">
                    {pm.isLoading ? (
                      <div className="flex items-center justify-center py-8 gap-3 text-gray-500">
                        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                        <span>Đang tải thông tin giảng viên...</span>
                      </div>
                    ) : (
                      <>
                        {/* Teacher card */}
                        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-4">
                          <p className="font-bold text-emerald-800 text-lg">{pm.teacherName}</p>
                          <div className="grid grid-cols-3 gap-3 mt-3">
                            <div>
                              <p className="text-xs text-gray-500 uppercase font-bold">Lương/buổi</p>
                              <p className="font-bold text-gray-800 text-sm">{salaryPS.toLocaleString('vi-VN')}đ</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 uppercase font-bold">Buổi còn nợ</p>
                              <p className="font-bold text-amber-600 text-sm">{pm.pendingSessionsCount} buổi</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 uppercase font-bold">Tổng nợ</p>
                              <p className="font-bold text-red-600 text-sm">{(pm.pendingSessionsCount * salaryPS).toLocaleString('vi-VN')}đ</p>
                            </div>
                          </div>
                          {pm.bankInfo?.bankName && (
                            <div className="mt-3 pt-3 border-t border-emerald-200 flex items-center gap-2 text-sm text-gray-600">
                              <CreditCard size={14} className="text-emerald-600" />
                              <span className="font-semibold">{pm.bankInfo.bankName}</span>
                              <span>·</span>
                              <span className="font-mono font-bold">{pm.bankInfo.accountNumber}</span>
                              {pm.bankInfo.accountHolder && <span className="text-gray-400">· {pm.bankInfo.accountHolder}</span>}
                            </div>
                          )}
                        </div>

                        {salaryPS === 0 && (
                          <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 flex items-start gap-2">
                            <AlertCircle size={15} className="text-amber-600 mt-0.5 shrink-0" />
                            <p className="text-xs text-amber-700 font-medium">Giảng viên chưa có mức lương/buổi. Hãy cập nhật ở trang Giảng viên → Chỉnh sửa trước.</p>
                          </div>
                        )}

                        {/* Số buổi thanh toán */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs font-bold text-gray-500 uppercase block mb-1.5">
                              Số buổi muốn thanh toán
                            </label>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  const cur = Math.max(0, Number(pm.sessionsCount || 0) - 1);
                                  setPayoutModal(prev => ({ ...prev, sessionsCount: String(cur), amount: String(cur * salaryPS) }));
                                }}
                                className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 font-black text-xl flex items-center justify-center transition flex-shrink-0"
                              >−</button>
                              <input
                                type="number" min="0"
                                value={pm.sessionsCount}
                                onChange={e => {
                                  const s = e.target.value;
                                  const autoA = Math.max(0, Number(s)) * salaryPS;
                                  setPayoutModal(prev => ({ ...prev, sessionsCount: s, amount: String(autoA) }));
                                }}
                                className="flex-1 border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold text-center focus:border-emerald-400 outline-none"
                                placeholder="0"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const cur = Number(pm.sessionsCount || 0) + 1;
                                  setPayoutModal(prev => ({ ...prev, sessionsCount: String(cur), amount: String(cur * salaryPS) }));
                                }}
                                className="w-10 h-10 rounded-xl bg-emerald-100 hover:bg-emerald-200 font-black text-xl text-emerald-700 flex items-center justify-center transition flex-shrink-0"
                              >+</button>
                            </div>
                            <p className="text-xs text-gray-400 mt-1">
                              {pm.pendingSessionsCount > 0
                                ? `Hệ thống ghi nhận: ${pm.pendingSessionsCount} buổi chưa thanh toán`
                                : '⚠️ Chưa có lịch dạy completed — nhập thủ công'}
                            </p>
                          </div>

                          {/* Số tiền */}
                          <div>
                            <label className="text-xs font-bold text-gray-500 uppercase block mb-1.5">
                              Số tiền thanh toán (VND)
                            </label>
                            <input
                              type="number" min="0"
                              value={pm.amount}
                              onChange={e => setPayoutModal(prev => ({ ...prev, amount: e.target.value }))}
                              className="w-full border-2 border-emerald-300 rounded-xl px-3 py-2.5 text-sm font-bold text-emerald-700 focus:border-emerald-500 outline-none bg-emerald-50"
                              placeholder="Tự nhập hoặc tự tính"
                            />
                            {autoAmt > 0 && Number(pm.amount) !== autoAmt && (
                              <button onClick={() => setPayoutModal(prev => ({ ...prev, amount: String(autoAmt) }))}
                                className="text-xs text-emerald-600 mt-1 underline">
                                Khôi phục = {autoAmt.toLocaleString('vi-VN')}đ
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Ghi chú */}
                        <div>
                          <label className="text-xs font-bold text-gray-500 uppercase block mb-1.5">
                            Nội dung chuyển khoản
                          </label>
                          <textarea
                            value={pm.note || ''}
                            onChange={e => setPayoutModal(prev => ({ ...prev, note: e.target.value }))}
                            className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-emerald-400 outline-none resize-none"
                            rows={2} placeholder="Thù lao dạy tháng 4..."
                          />
                        </div>

                        {Number(pm.amount) > 0 && (
                          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between">
                            <span className="text-sm text-emerald-700 font-medium">💸 Tổng cần chuyển:</span>
                            <span className="text-xl font-black text-emerald-700">{Number(pm.amount).toLocaleString('vi-VN')}đ</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <div className="px-6 pb-6 flex gap-3">
                    <button onClick={() => setPayoutModal(null)} className="flex-1 py-3 border-2 border-gray-200 rounded-xl font-semibold text-gray-600 hover:bg-gray-50">Huỷ</button>
                    <button
                      onClick={onGoToQR}
                      disabled={pm.isLoading || !Number(pm.amount) || !Number(pm.sessionsCount)}
                      className="flex-1 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-bold hover:from-emerald-700 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    >
                      <CreditCard size={16} /> Xem QR Chuyển Khoản →
                    </button>
                  </div>
                </>
              )}

              {/* BƯỚC 2: QR CODE */}
              {pm.step === 2 && (
                <>
                  <div className="p-6 space-y-4">
                    <div className="text-center">
                      <p className="font-bold text-gray-800 text-base">Quét mã QR để chuyển khoản</p>
                      <p className="text-sm text-gray-500 mt-1">
                        {Number(pm.amount).toLocaleString('vi-VN')}đ → <span className="font-semibold">{pm.teacherName}</span>
                      </p>
                    </div>

                    {qrUrl ? (
                      <div className="flex justify-center">
                        <div className="border-4 border-emerald-100 rounded-2xl p-2 bg-white shadow-lg">
                          <img
                            src={qrUrl}
                            alt="QR Chuyển khoản"
                            className="w-56 h-56 object-contain rounded-xl"
                            onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                          />
                          <div style={{ display: 'none' }} className="w-56 h-56 flex flex-col items-center justify-center text-gray-400 gap-2">
                            <AlertCircle size={32} />
                            <p className="text-xs text-center">Không thể tải QR.<br/>Vui lòng chuyển thủ công.</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-center">
                        <AlertCircle size={28} className="text-amber-500 mx-auto mb-2" />
                        <p className="text-sm text-amber-700 font-medium">Giảng viên chưa có thông tin ngân hàng đầy đủ (mã ngân hàng &amp; số TK)</p>
                        <p className="text-xs text-amber-600 mt-1">Vui lòng cập nhật trang hồ sơ của giảng viên</p>
                      </div>
                    )}

                    {/* Summary */}
                    <div className="bg-gray-50 rounded-2xl p-4 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Ngân hàng</span>
                        <span className="font-semibold">{pm.bankInfo?.bankName || '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Số tài khoản</span>
                        <span className="font-mono font-bold">{pm.bankInfo?.accountNumber || '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Chủ tài khoản</span>
                        <span className="font-semibold">{pm.bankInfo?.accountHolder || pm.teacherName}</span>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <span className="text-gray-500">Nội dung CK</span>
                        <span className="font-medium text-right max-w-[60%]">{pm.note}</span>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <span className="font-bold text-gray-700">Số tiền</span>
                        <span className="font-black text-lg text-emerald-700">{Number(pm.amount).toLocaleString('vi-VN')}đ</span>
                      </div>
                    </div>
                  </div>
                  <div className="px-6 pb-6 flex gap-3">
                    <button onClick={() => setPayoutModal(prev => ({ ...prev, step: 1 }))}
                      className="flex-1 py-3 border-2 border-gray-200 rounded-xl font-semibold text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-2">
                      ← Quay lại chỉnh sửa
                    </button>
                    <button
                      onClick={onConfirm}
                      className="flex-1 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-bold hover:from-emerald-700 flex items-center justify-center gap-2 shadow-lg shadow-emerald-100"
                    >
                      <CheckCircle2 size={16} /> Đã chuyển khoản xong
                    </button>
                  </div>
                </>
              )}

            </div>
          </div>
  );
}
