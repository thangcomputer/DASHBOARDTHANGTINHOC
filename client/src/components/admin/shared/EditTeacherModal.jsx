import React from 'react';
import { Edit3, X, Save, KeyRound, CreditCard, MapPin } from 'lucide-react';
import { BankSelect } from '../../BankSelect';
import TeacherScheduleHistoryPanel from '../../TeacherScheduleHistoryPanel';

export default function EditTeacherModal({
  editTeacher, setEditTeacher, onClose, onSave, onResetPassword, isSuperAdmin, safeBranches,
}) {
  if (!editTeacher) return null;
  return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[150] p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5 text-white flex flex-col flex-shrink-0">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-extrabold flex items-center gap-2 text-lg"><Edit3 size={20} /> Hồ sơ Giảng viên</h3>
                <button onClick={onClose} className="hover:bg-blue-800/40 p-1.5 rounded-xl transition-colors"><X size={20} /></button>
              </div>
              <div className="flex gap-4">
                <button 
                  onClick={() => setEditTeacher(p => ({ ...p, _tab: 'info' }))}
                  className={`pb-2 px-1 text-sm font-bold border-b-2 transition-colors ${editTeacher._tab !== 'history' ? 'border-white text-white' : 'border-transparent text-blue-200 hover:text-white'}`}
                >
                  Thông tin chung
                </button>
                <button 
                  onClick={() => setEditTeacher(p => ({ ...p, _tab: 'history' }))}
                  className={`pb-2 px-1 text-sm font-bold border-b-2 transition-colors ${editTeacher._tab === 'history' ? 'border-white text-white' : 'border-transparent text-blue-200 hover:text-white'}`}
                >
                  Lịch sử sắp lịch
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1 bg-slate-50/50">
              {editTeacher._tab === 'history' ? (
                <TeacherScheduleHistoryPanel teacherId={editTeacher.id || editTeacher._id} />
              ) : (
              <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Cột 1 */}
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-extrabold text-slate-500 uppercase block mb-1.5 tracking-wider">Họ tên</label>
                    <input type="text" value={editTeacher.name || ''} onChange={e => setEditTeacher(p => ({ ...p, name: e.target.value }))}
                      className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition-all font-semibold" />
                  </div>
                  <div>
                    <label className="text-xs font-extrabold text-slate-500 uppercase block mb-1.5 tracking-wider">Số điện thoại / Zalo</label>
                    <input type="text" value={editTeacher.phone || ''} onChange={e => setEditTeacher(p => ({ ...p, phone: e.target.value }))}
                      className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition-all font-mono font-semibold" />
                  </div>
                  <div>
                    <label className="text-xs font-extrabold text-slate-500 uppercase block mb-1.5 tracking-wider">Chuyên môn</label>
                    <input type="text" value={editTeacher.specialty || ''}
                      onChange={e => setEditTeacher(p => ({ ...p, specialty: e.target.value }))}
                      className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition-all font-semibold text-slate-700" 
                      placeholder="VD: Word, Excel" />
                  </div>
                  <div>
                    <label className="text-xs font-extrabold text-slate-500 uppercase block mb-1.5 tracking-wider">Email</label>
                    <input type="email" value={editTeacher.email || ''}
                      onChange={e => setEditTeacher(p => ({ ...p, email: e.target.value }))}
                      className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition-all font-semibold" 
                      placeholder="email@example.com" />
                  </div>
                </div>

                {/* Cột 2 */}
                <div className="space-y-4">
                   <div>
                    <label className="text-xs font-extrabold text-slate-500 uppercase block mb-1.5 tracking-wider">Trạng thái duyệt</label>
                    <select value={String(editTeacher.status || 'inactive').toLowerCase()} onChange={e => setEditTeacher(p => ({ ...p, status: e.target.value }))}
                      className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition-all font-bold text-slate-700 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M5%207l5%205%205-5%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:calc(100%-1rem)_center]">
                      <option value="inactive">🔒 Chưa cấp quyền</option>
                      <option value="pending">🕒 Cấp quyền thi (Chờ làm bài)</option>
                      <option value="active">🟢 Đã cấp quyền (Active)</option>
                      <option value="locked">🚫 Đã khóa</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-extrabold text-slate-500 uppercase block mb-1.5 tracking-wider">Lương / buổi (VNĐ)</label>
                    <input type="text"
                      value={editTeacher.baseSalaryPerSession || ''}
                      onChange={e => setEditTeacher(p => ({ ...p, baseSalaryPerSession: Number(e.target.value.replace(/\D/g, '')) }))}
                      className="w-full border-2 border-blue-200 bg-blue-50/30 rounded-xl px-4 py-3 text-sm focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-50 outline-none transition-all font-black text-blue-700 font-mono"
                      placeholder="150000" />
                  </div>

                  {/* ⭐ Chi nhánh — chỉ SUPER_ADMIN */}
                  {(() => {
                    const sess = JSON.parse(localStorage.getItem('admin_user') || '{}');
                    const isSA = sess?.id === 'admin' || sess?.adminRole === 'SUPER_ADMIN';
                    if (!isSA) return null;
                    return (
                      <div>
                        <label className="text-xs font-extrabold text-slate-500 uppercase block mb-1.5 tracking-wider">Điều chuyển chi nhánh</label>
                        <select
                          value={editTeacher.branchId || ''}
                          onChange={e => {
                            const opt = e.target.selectedOptions[0];
                            setEditTeacher(p => ({ ...p, branchId: e.target.value, branchCode: opt?.dataset.code || '' }));
                          }}
                          className="w-full border-2 border-amber-200 bg-amber-50/30 rounded-xl px-4 py-3 text-sm focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-50 outline-none transition-all font-bold text-amber-900 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M5%207l5%205%205-5%22%20stroke%3D%22%23b45309%22%20stroke-width%3D%222%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:calc(100%-1rem)_center]"
                        >
                          <option value="">— Chưa phân chi nhánh —</option>
                          {(JSON.parse(localStorage.getItem('thvp_branches') || '[]')).map(b => (
                            <option key={b._id} value={b._id} data-code={b.code}>{b.name} ({b.code})</option>
                          ))}
                        </select>
                        {editTeacher.branchCode && (
                          <p className="text-xs text-amber-700 font-bold mt-1.5 flex items-center gap-1"><MapPin size={12}/> Hiện tại: {editTeacher.branchCode}</p>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>

              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-5 border-t border-slate-100 pt-5">
                 <div>
                  <label className="text-xs font-extrabold text-slate-500 uppercase block mb-1.5 tracking-wider">Ngày vào làm</label>
                  <input type="date" value={editTeacher.startDate ? new Date(editTeacher.startDate).toISOString().split('T')[0] : ''}
                    onChange={e => setEditTeacher(p => ({ ...p, startDate: e.target.value }))}
                    className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-sm focus:border-blue-500 outline-none hover:border-slate-300 transition-all font-semibold" />
                </div>
                <div>
                  <label className="text-xs font-extrabold text-slate-500 uppercase block mb-1.5 tracking-wider">Địa chỉ</label>
                  <input type="text" value={editTeacher.address || ''}
                    onChange={e => setEditTeacher(p => ({ ...p, address: e.target.value }))}
                    className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-sm focus:border-blue-500 outline-none hover:border-slate-300 transition-all font-semibold"
                    placeholder="Nhập địa chỉ..." />
                </div>
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-500 uppercase block mb-1.5 tracking-wider">Giới thiệu bản thân (Bio)</label>
                <textarea 
                  value={editTeacher.bio || ''}
                  onChange={e => setEditTeacher(p => ({ ...p, bio: e.target.value }))}
                  rows={2}
                  className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-sm focus:border-blue-500 outline-none hover:border-slate-300 transition-all font-medium resize-none"
                  placeholder="Kinh nghiệm cá nhân, bằng cấp, sở trường..."
                />
              </div>

              {/* Ngân hàng */}
              <div className="border-t-2 border-dashed border-slate-200 pt-5 mt-2">
                <p className="text-xs font-black text-emerald-700 uppercase mb-4 flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-lg w-max"><CreditCard size={14} /> Thông tin ngân hàng (QR Nhận Lương)</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="md:col-span-2">
                    <label className="text-xs font-extrabold text-slate-500 uppercase block mb-1.5 tracking-wider">Ngân hàng nhận</label>
                    <BankSelect
                      value={editTeacher.bankAccount?.bankCode || ''}
                      onChange={bank => setEditTeacher(p => ({
                        ...p,
                        bankAccount: {
                          ...(p.bankAccount || {}),
                          bankCode: bank.bin,
                          bankName: bank.shortName,
                        }
                      }))}
                    />
                    {editTeacher.bankAccount?.bankCode && (
                      <p className="text-xs font-bold text-emerald-600 mt-1.5 flex items-center gap-1">✓ Đã chọn: {editTeacher.bankAccount.bankName}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-extrabold text-slate-500 uppercase block mb-1.5 tracking-wider">Số tài khoản</label>
                    <input type="text"
                      value={editTeacher.bankAccount?.accountNumber || ''}
                      onChange={e => setEditTeacher(p => ({ ...p, bankAccount: { ...(p.bankAccount || {}), accountNumber: e.target.value.replace(/\D/g,'') } }))}
                      className="w-full border-2 border-emerald-200 focus:border-emerald-500 bg-emerald-50/20 focus:bg-white rounded-xl px-4 py-3 text-sm font-mono font-black text-emerald-800 outline-none transition-all"
                      placeholder="VD: 123456789" />
                  </div>
                  <div>
                    <label className="text-xs font-extrabold text-slate-500 uppercase block mb-1.5 tracking-wider">Tên chủ tài khoản</label>
                    <input type="text"
                      value={editTeacher.bankAccount?.accountHolder || editTeacher.bankAccount?.accountName || ''}
                      onChange={e => setEditTeacher(p => ({ ...p, bankAccount: { ...(p.bankAccount || {}), accountHolder: e.target.value.toUpperCase(), accountName: e.target.value.toUpperCase() } }))}
                      className="w-full border-2 border-emerald-200 focus:border-emerald-500 bg-emerald-50/20 focus:bg-white rounded-xl px-4 py-3 text-sm outline-none uppercase font-black text-emerald-800 transition-all"
                      placeholder="VD: NGUYEN VAN A" />
                  </div>
                </div>
              </div>
              </>
              )}
            </div>

            <div className="bg-slate-50 border-t border-slate-100 px-6 py-5 flex gap-4 flex-shrink-0">
              <button 
                onClick={onClose} 
                className={`${editTeacher._tab === 'history' ? 'w-full' : 'flex-1'} py-3.5 bg-white border-2 border-slate-200 rounded-2xl font-bold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm`}
              >
                {editTeacher._tab === 'history' ? 'Đóng' : 'Huỷ bỏ'}
              </button>
              {editTeacher._tab !== 'history' && (
                <>
                  <button onClick={() => onResetPassword(editTeacher.id || editTeacher._id, editTeacher.name)}
                    className="py-3.5 px-4 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-1.5 shadow-lg shadow-amber-100 transition-all whitespace-nowrap">
                    <KeyRound size={15} /> Cấp lại MK
                  </button>
                  <button onClick={onSave} className="flex-[2] py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl font-black text-sm uppercase tracking-wide hover:from-blue-700 hover:to-indigo-700 flex items-center justify-center gap-2 shadow-lg shadow-blue-200 transition-all">
                    <Save size={18} /> Lưu thay đổi
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
  );
}
