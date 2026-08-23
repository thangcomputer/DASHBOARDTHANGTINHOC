import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, LogOut } from 'lucide-react';
import RegistrationForm from '../RegistrationForm';

/**
 * Shown when student account is valid but has no usable course
 * Displays a full-screen Registration Form, blocking interaction with the dashboard.
 */
export default function StudentNoActiveCoursePage({ student }) {
  const navigate = useNavigate();
  
  const handleNavigate = (path) => {
    // Navigate via hard reload if the user completes registration
    if (path.includes('payment') || path === '/') {
       window.location.href = path;
    } else {
       navigate(path);
    }
  };

  const isLocked = student && (student.status === 'Locked' || student.status === 'Bị khóa');

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <div className="absolute top-4 right-4 z-50">
        <button
          onClick={() => {
            localStorage.removeItem('student_user');
            localStorage.removeItem('student_token');
            window.location.href = '/login';
          }}
          className="flex items-center gap-2 px-4 py-2 bg-white text-slate-700 hover:text-red-600 border border-slate-200 rounded-lg shadow-sm font-medium transition-colors"
        >
          <LogOut size={16} />
          <span>Đăng xuất</span>
        </button>
      </div>

      {isLocked ? (
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden p-8 text-center border-t-4 border-red-500">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Tài khoản bị khóa</h2>
          <p className="text-slate-600 mb-6 leading-relaxed">
            Tài khoản của bạn đã bị khóa bởi quản trị viên. Bạn không thể thực hiện bất kỳ thao tác nào hoặc đăng ký khóa học mới lúc này.
          </p>
          <p className="text-sm text-slate-500 bg-slate-50 p-4 rounded-xl border border-slate-100">
            Vui lòng liên hệ với trung tâm qua số điện thoại hoặc Zalo hỗ trợ để được giải đáp.
          </p>
        </div>
      ) : (
        <RegistrationForm 
          onNavigate={handleNavigate} 
          initialData={student ? { 
            id: student._id || student.id, 
            name: student.name, 
            phone: student.phone || student.zalo,
            branchId: student.branchId,
            branchCode: student.branchCode
          } : {}}
        />
      )}
    </div>
  );
}
