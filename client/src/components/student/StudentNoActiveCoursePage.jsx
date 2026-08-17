import React from 'react';
import { BookOpen, GraduationCap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * Shown when student account is valid but has no usable course
 * (chỉ còn hủy / hoàn tiền / chưa thanh toán — không gồm đã hoàn thành khóa).
 */
export default function StudentNoActiveCoursePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-5">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
          <GraduationCap className="text-slate-500" size={32} />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-black text-slate-800">
            Bạn hiện không có khóa học để tiếp tục
          </h1>
          <p className="text-sm text-slate-500 leading-relaxed">
            Khóa học trước của bạn đã được hủy hoặc hoàn tiền.
            Bạn có thể đăng ký khóa học mới để tiếp tục học.
            Tài khoản của bạn vẫn còn hiệu lực.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <button
            type="button"
            onClick={() => navigate('/dangkykhoahoc')}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700"
          >
            <BookOpen size={16} />
            Đăng ký khóa học
          </button>
          <button
            type="button"
            onClick={() => navigate('/student#profile')}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-bold hover:bg-slate-50"
          >
            Xem hồ sơ
          </button>
        </div>
      </div>
    </div>
  );
}
