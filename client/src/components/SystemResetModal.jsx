import React, { useState } from 'react';
import { AlertTriangle, Key, Loader2, RefreshCw, Users, DollarSign, Calendar, MessageSquare, ShieldAlert, FileText, CheckSquare, Square } from 'lucide-react';

export default function SystemResetModal({ onClose, onSubmit }) {
  const [phrase, setPhrase] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [options, setOptions] = useState({
    all: true,
    students: false,
    finance: false,
    schedules: false,
    communication: false,
    hr: false,
    logs: false,
  });

  const toggleOption = (key) => {
    if (key === 'all') {
      setOptions({ all: true, students: false, finance: false, schedules: false, communication: false, hr: false, logs: false });
    } else {
      setOptions((prev) => ({
        ...prev,
        all: false,
        [key]: !prev[key],
      }));
    }
  };

  const isAnySelected = options.all || Object.values(options).some((v) => v === true);
  const isValid = phrase === 'XOA_DU_LIEU' && password.length >= 6 && isAnySelected;

  const handleSubmit = async () => {
    if (!isValid) return;
    setSubmitting(true);
    await onSubmit({ phrase, password, options });
    setSubmitting(false);
  };

  const categories = [
    { key: 'students', label: 'Học viên & Thi', icon: Users, color: 'text-blue-600' },
    { key: 'finance', label: 'Doanh thu & Lương', icon: DollarSign, color: 'text-emerald-600' },
    { key: 'schedules', label: 'Lịch dạy', icon: Calendar, color: 'text-amber-600' },
    { key: 'communication', label: 'Tin nhắn', icon: MessageSquare, color: 'text-purple-600' },
    { key: 'hr', label: 'Nhân sự', icon: ShieldAlert, color: 'text-rose-600' },
    { key: 'logs', label: 'Nhật ký', icon: FileText, color: 'text-slate-600' },
  ];

  return (
    <div className="fixed inset-0 bg-red-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-[999] animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in duration-200 border border-white/20 max-h-[min(92dvh,640px)] flex flex-col">

        {/* Header gọn ngang */}
        <div className="bg-gradient-to-r from-red-600 to-red-700 px-4 py-3 flex items-center gap-3 shrink-0">
          <AlertTriangle size={22} className="text-white shrink-0" />
          <div className="min-w-0 text-left">
            <h2 className="text-sm font-black text-white uppercase tracking-wider leading-tight">
              Trung tâm kiểm soát
            </h2>
            <p className="text-red-100/90 text-[10px] font-bold uppercase tracking-wide truncate">
              Nguy hiểm cấp 1 · Không hoàn tác
            </p>
          </div>
        </div>

        <div className="px-4 py-3 space-y-3 overflow-y-auto custom-scrollbar flex-1 min-h-0">
          {/* Bước 1 */}
          <div className="space-y-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
              1. Chọn dữ liệu làm mới
            </p>

            <button
              type="button"
              onClick={() => toggleOption('all')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border-2 transition-all ${
                options.all
                  ? 'border-red-500 bg-red-50'
                  : 'border-slate-100 hover:border-slate-200'
              }`}
            >
              <RefreshCw className={options.all ? 'text-red-600 shrink-0' : 'text-slate-400 shrink-0'} size={16} />
              <div className="text-left min-w-0 flex-1">
                <p className={`font-black text-xs ${options.all ? 'text-red-700' : 'text-slate-600'}`}>
                  Làm mới tất cả
                </p>
                <p className="text-[10px] text-slate-400 font-semibold leading-tight">
                  Xóa toàn bộ · hệ thống sạch
                </p>
              </div>
              {options.all
                ? <CheckSquare className="text-red-600 shrink-0" size={18} />
                : <Square className="text-slate-200 shrink-0" size={18} />}
            </button>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {categories.map((cat) => (
                <button
                  type="button"
                  key={cat.key}
                  onClick={() => toggleOption(cat.key)}
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border transition-all text-left ${
                    options[cat.key]
                      ? 'border-amber-500 bg-amber-50'
                      : 'border-slate-100 bg-slate-50/80 hover:border-slate-200'
                  }`}
                >
                  <cat.icon className={`shrink-0 ${options[cat.key] ? cat.color : 'text-slate-400'}`} size={14} />
                  <span className={`text-[10px] font-black uppercase tracking-tight leading-tight truncate ${
                    options[cat.key] ? 'text-slate-800' : 'text-slate-400'
                  }`}>
                    {cat.label}
                  </span>
                  <span className="ml-auto shrink-0">
                    {options[cat.key]
                      ? <CheckSquare className="text-amber-600" size={14} />
                      : <Square className="text-slate-200" size={14} />}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Bước 2 */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
              2. Xác thực Super Admin
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                value={phrase}
                onChange={(e) => setPhrase(e.target.value)}
                placeholder="XOA_DU_LIEU"
                className="w-full border-2 border-slate-100 rounded-xl px-3 py-2 font-mono text-center text-xs font-black outline-none focus:border-red-500 transition focus:bg-red-50 text-slate-700 placeholder:text-slate-300"
              />
              <div className="relative">
                <Key size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mật khẩu Super Admin"
                  className="w-full border-2 border-slate-100 rounded-xl pl-9 pr-3 py-2 text-xs font-black outline-none focus:border-red-500 transition focus:bg-red-50 text-slate-700 placeholder:text-slate-300"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-4 py-2.5 flex gap-2 border-t border-slate-100 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 py-2.5 rounded-xl font-black text-slate-500 hover:bg-slate-200 transition text-[10px] uppercase tracking-wider"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            className={`flex-[1.6] py-2.5 rounded-xl font-black uppercase tracking-wider text-[10px] flex justify-center items-center gap-1.5 transition-all ${
              isValid
                ? 'bg-red-600 text-white hover:bg-red-700 shadow-md shadow-red-200 cursor-pointer'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            {submitting ? 'Đang xử lý...' : 'Xác nhận xóa'}
          </button>
        </div>
      </div>
    </div>
  );
}
