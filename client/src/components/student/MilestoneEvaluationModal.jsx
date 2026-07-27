import React, { useState } from 'react';
import { Star } from 'lucide-react';

export function MilestoneEvaluationModal({ milestone, studentId, teacherId, courseName, onClose, onSubmit }) {
  const [feedback, setFeedback] = useState({
    satisfied: 'yes',
    lessonClear: 'yes',
    comment: '',
  });

  const handleSubmit = () => {
    onSubmit({
      studentId,
      teacherId,
      milestone,
      courseName,
      criteria: {
        satisfied: feedback.satisfied,
        lessonClear: feedback.lessonClear,
      },
      comment: feedback.comment,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-300">
        <div className="bg-gradient-to-r from-red-600 to-red-500 px-6 py-8 text-center text-white relative">
            <p className="text-sm mt-1">Khóa học: {courseName}</p>
           <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner">
             <Star size={32} className="fill-white text-white" />
           </div>
           <h3 className="text-xl font-black uppercase tracking-tight">Đánh giá chất lượng</h3>
           <p className="text-red-100 text-xs mt-1 font-medium italic">Gửi trực tiếp Admin (Giáo viên không thấy phần này)</p>
        </div>

        <div className="p-6 space-y-6">
           <p className="text-sm text-gray-600 leading-relaxed text-center font-medium">
             Chào {milestone === 'lesson_1' ? 'buổi học đầu tiên' : 'mốc 50% khóa học'}! Hãy cho Admin biết cảm nhận của bạn nhé.
           </p>

           <div className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between p-3 bg-gray-50 rounded-2xl border border-gray-100">
                <span className="text-xs font-bold text-gray-700">Bạn hài lòng với Thầy?</span>
                <div className="flex gap-2">
                  {['yes', 'no'].map(v => (
                    <button key={v} onClick={() => setFeedback({...feedback, satisfied: v})}
                      className={`px-3 py-1 rounded-full text-xs font-black transition-all ${feedback.satisfied === v ? 'bg-red-500 text-white shadow-md shadow-red-200' : 'bg-white text-gray-400 border border-gray-200'}`}>
                      {v === 'yes' ? 'HÀI LÒNG' : 'CHƯA'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between p-3 bg-gray-50 rounded-2xl border border-gray-100">
                <span className="text-xs font-bold text-gray-700">Giảng bài dễ hiểu?</span>
                <div className="flex gap-2">
                  {['yes', 'no'].map(v => (
                    <button key={v} onClick={() => setFeedback({...feedback, lessonClear: v})}
                      className={`px-3 py-1 rounded-full text-xs font-black transition-all ${feedback.lessonClear === v ? 'bg-red-500 text-white shadow-md shadow-red-200' : 'bg-white text-gray-400 border border-gray-200'}`}>
                      {v === 'yes' ? 'RẤT HIỂU' : 'HƠI KHÓ'}
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                value={feedback.comment}
                onChange={e => setFeedback({...feedback, comment: e.target.value})}
                placeholder="Lời nhắn riêng cho Admin (bắt buộc)..."
                className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl p-4 text-sm outline-none focus:border-red-400 focus:bg-white transition-all h-24 italic"
              />
           </div>

           <button onClick={handleSubmit} disabled={!feedback.comment.trim()}
             className="w-full bg-gradient-to-r from-red-600 to-red-500 py-4 rounded-2xl text-white font-black text-sm shadow-xl shadow-red-100 active:scale-95 transition transform disabled:opacity-50">
             GỬI ĐÁNH GIÁ RIÊNG
           </button>
        </div>
      </div>
    </div>
  );
}
