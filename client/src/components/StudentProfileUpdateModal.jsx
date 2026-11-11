import React, { useState } from 'react';
import { X, Save, User, Phone, Mail, MapPin } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useModal } from '../utils/Modal.jsx';
import { isFreePortalSelfRegistrationStudent } from '../utils/enrollments';

const StudentProfileUpdateModal = ({ student, onClose }) => {
  const { updateStudent } = useData();
  const { showModal } = useModal();
  const isFreePortal = isFreePortalSelfRegistrationStudent(student ? { ...student, role: 'student' } : null)
    || (typeof document !== 'undefined' && document.documentElement.hasAttribute('data-free-portal-student'));
  const isBrandStudent = !isFreePortal;
  const [formData, setFormData] = useState({
    name: student.name || '',
    phone: student.phone || '',
    zalo: student.zalo || '',
    email: student.email || '',
    address: student.address || '',
    gender: student.gender || 'male',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateStudent(student._id || student.id, formData);
      try {
        const key = 'student_user';
        const saved = JSON.parse(localStorage.getItem(key) || '{}');
        const sid = student._id || student.id;
        const patched = {
          ...saved,
          id: saved.id || sid,
          _id: saved._id || student._id || student.id,
          gender: formData.gender,
        };
        localStorage.setItem(key, JSON.stringify(patched));
        window.dispatchEvent(new CustomEvent('cms:session-patched', { detail: patched }));
      } catch { /* ignore */ }
      showModal({ title: 'Thành công', content: 'Hệ thống đã cập nhật thông tin hồ sơ của bạn thành công!', type: 'success' });
      onClose();
    } catch (err) {
      showModal({ title: 'Lỗi cập nhật', content: 'Đã xảy ra sự cố khi lưu hồ sơ: ' + err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-300">
        <div className={`flex items-center justify-between px-6 py-4 border-b border-gray-100 ${
          isBrandStudent ? 'bg-red-50' : 'bg-teal-50'
        }`}>
          <h3 className={`font-black flex items-center gap-2 ${
            isBrandStudent ? 'text-red-700' : 'text-teal-800'
          }`}>
            <User size={18} /> Cập nhật Hồ sơ Cá nhân
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-red-500 bg-white rounded-full p-1.5 shadow-sm transition">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-[10px] font-black  text-gray-500 tracking-widest pl-1 mb-1 block">Họ và Tên</label>
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className={`w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium outline-none transition ${
                isBrandStudent ? 'focus:ring-2 focus:ring-red-500/20 focus:border-red-500' : 'focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500'
              }`}
              readOnly
            />
            <p className="text-[9px] text-red-500 mt-1 pl-1 italic">* Tên không thể tự sửa. Vui lòng liên hệ Admin.</p>
          </div>

          <div>
            <label className="text-[10px] font-black  text-gray-500 tracking-widest pl-1 mb-1 block">Giới tính chọn ảnh đại diện</label>
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, gender: 'male' })}
                className={`select-none flex-1 py-2.5 px-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all ${formData.gender === 'male' || formData.gender === 'Nam'
                    ? (isBrandStudent
                        ? 'bg-red-50 text-red-700 border-red-300 ring-2 ring-red-400/20 shadow-sm'
                        : 'bg-teal-50 text-teal-700 border-teal-300 ring-2 ring-teal-400/20 shadow-sm')
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                  }`}
              >
                <span>👨 Nam</span>
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, gender: 'female' })}
                className={`select-none flex-1 py-2.5 px-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all ${formData.gender === 'female' || formData.gender === 'Nữ'
                    ? 'bg-rose-50 text-rose-700 border-rose-300 ring-2 ring-rose-400/20 shadow-sm'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                  }`}
              >
                <span>👩 Nữ</span>
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black  text-gray-500 tracking-widest pl-1 mb-1 block">Số điện thoại</label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  className={`w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-4 py-3 text-sm font-medium outline-none transition ${
                    isBrandStudent ? 'focus:ring-2 focus:ring-red-500/20 focus:border-red-500' : 'focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500'
                  }`}
                  readOnly
                />
                <Phone size={14} className="absolute left-3 top-3.5 text-gray-400" />
              </div>
              <p className="text-[9px] text-red-500 mt-1 pl-1 italic">* Liên hệ Admin để đổi SĐT.</p>
            </div>
            <div>
              <label className="text-[10px] font-black  text-gray-500 tracking-widest pl-1 mb-1 block">SĐT Liên hệ 2</label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.zalo}
                  onChange={e => setFormData({ ...formData, zalo: e.target.value })}
                  className={`w-full bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-3 text-sm font-medium outline-none transition ${
                    isBrandStudent ? 'focus:ring-2 focus:ring-red-500/20 focus:border-red-500' : 'focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500'
                  }`}
                />
                <Phone size={14} className="absolute left-3 top-3.5 text-blue-400" />
              </div>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-black  text-gray-500 tracking-widest pl-1 mb-1 block">Email</label>
            <div className="relative">
              <input
                type="email"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                className={`w-full bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-3 text-sm font-medium outline-none transition ${
                  isBrandStudent ? 'focus:ring-2 focus:ring-red-500/20 focus:border-red-500' : 'focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500'
                }`}
                placeholder="Ví dụ: nguyenvan@gmail.com"
              />
              <Mail size={14} className="absolute left-3 top-3.5 text-gray-400" />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black  text-gray-500 tracking-widest pl-1 mb-1 block">Địa chỉ</label>
            <div className="relative">
              <input
                type="text"
                value={formData.address}
                onChange={e => setFormData({ ...formData, address: e.target.value })}
                className={`w-full bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-3 text-sm font-medium outline-none transition ${
                  isBrandStudent ? 'focus:ring-2 focus:ring-red-500/20 focus:border-red-500' : 'focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500'
                }`}
                placeholder="Nhập địa chỉ của bạn"
              />
              <MapPin size={14} className="absolute left-3 top-3.5 text-gray-400" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`duo-btn duo-btn--primary ${isBrandStudent ? 'duo-btn--danger' : 'duo-btn--emerald'} duo-btn--lg duo-btn--full mt-4`}
          >
            {loading ? (
              <span className="duo-btn__label">Đang lưu...</span>
            ) : (
              <>
                <span className="duo-btn__icon"><Save size={18} /></span>
                <span className="duo-btn__label">Lưu thông tin</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default StudentProfileUpdateModal;
