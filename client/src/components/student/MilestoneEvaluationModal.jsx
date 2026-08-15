import React, { useState } from 'react';
import { Star, Building2, UserRound } from 'lucide-react';

const EMPTY = {
  satisfied: 'yes',
  lessonClear: 'yes',
  centerSupport: 'yes',
  centerFacility: 'yes',
  comment: '',
};

/**
 * lesson_1 → đánh giá giảng viên (1 lần sau buổi đầu)
 * course_end → bước 1 trung tâm, bước 2 giảng viên
 */
export function MilestoneEvaluationModal({
  milestone,
  studentId,
  teacherId,
  courseName,
  onClose,
  onSubmit,
}) {
  const isCourseEnd = milestone === 'course_end' || milestone === 'course_end_teacher';
  const [step, setStep] = useState(
    milestone === 'course_end_teacher' ? 'teacher' : (milestone === 'course_end' ? 'center' : 'teacher'),
  );  const [feedback, setFeedback] = useState(EMPTY);

  const submitCenter = () => {
    onSubmit({
      studentId,
      teacherId,
      milestone: 'course_end_center',
      courseName,
      criteria: {
        centerSupport: feedback.centerSupport,
        centerFacility: feedback.centerFacility,
      },
      comment: feedback.comment,
    });
    setFeedback(EMPTY);
    setStep('teacher');
  };

  const submitTeacher = () => {
    onSubmit({
      studentId,
      teacherId,
      milestone: isCourseEnd ? 'course_end_teacher' : 'lesson_1',
      courseName,
      criteria: {
        satisfied: feedback.satisfied,
        lessonClear: feedback.lessonClear,
      },
      comment: feedback.comment,
    });
    onClose();
  };

  const title = step === 'center'
    ? 'Đánh giá trung tâm'
    : (isCourseEnd ? 'Đánh giá giảng viên' : 'Đánh giá chất lượng');

  const subtitle = step === 'center'
    ? 'Gửi Admin — đánh giá trung tâm sau khi hoàn thành khóa'
    : (milestone === 'lesson_1'
      ? 'Buổi học đầu tiên — gửi Admin (GV không thấy)'
      : 'Bước cuối — đánh giá giảng viên (gửi Admin)');

  const canSubmit = feedback.comment.trim().length > 0;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-300">
        <div className="bg-gradient-to-r from-red-600 to-red-500 px-6 py-8 text-center text-white relative">
          <p className="text-sm mt-1">Khóa học: {courseName}</p>
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner">
            {step === 'center'
              ? <Building2 size={32} className="text-white" />
              : <Star size={32} className="fill-white text-white" />}
          </div>
          <h3 className="text-xl font-black uppercase tracking-tight">{title}</h3>
          <p className="text-red-100 text-xs mt-1 font-medium italic">{subtitle}</p>
          {isCourseEnd ? (
            <p className="text-[10px] font-bold text-white/80 mt-2 uppercase tracking-wider">
              Bước {step === 'center' ? '1/2 · Trung tâm' : '2/2 · Giảng viên'}
            </p>
          ) : null}
        </div>

        <div className="p-6 space-y-6">
          {step === 'center' ? (
            <>
              <p className="text-sm text-gray-600 leading-relaxed text-center font-medium">
                Bạn đã hoàn thành khóa học. Hãy đánh giá trung tâm trước nhé.
              </p>
              <div className="space-y-4">
                <YesNoRow
                  label="Hỗ trợ / tư vấn của trung tâm?"
                  value={feedback.centerSupport}
                  yesLabel="TỐT"
                  noLabel="CHƯA TỐT"
                  onChange={(v) => setFeedback({ ...feedback, centerSupport: v })}
                />
                <YesNoRow
                  label="Cơ sở vật chất / lịch học?"
                  value={feedback.centerFacility}
                  yesLabel="HÀI LÒNG"
                  noLabel="CHƯA"
                  onChange={(v) => setFeedback({ ...feedback, centerFacility: v })}
                />
                <textarea
                  value={feedback.comment}
                  onChange={(e) => setFeedback({ ...feedback, comment: e.target.value })}
                  placeholder="Góp ý cho trung tâm (bắt buộc)..."
                  className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl p-4 text-sm outline-none focus:border-red-400 focus:bg-white transition-all h-24 italic"
                />
              </div>
              <button
                type="button"
                onClick={submitCenter}
                disabled={!canSubmit}
                className="w-full bg-gradient-to-r from-red-600 to-red-500 py-4 rounded-2xl text-white font-black text-sm shadow-xl shadow-red-100 active:scale-95 transition transform disabled:opacity-50"
              >
                TIẾP TỤC → ĐÁNH GIÁ GIẢNG VIÊN
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600 leading-relaxed text-center font-medium inline-flex items-center justify-center gap-2 w-full">
                <UserRound size={16} className="text-red-500" />
                {milestone === 'lesson_1'
                  ? 'Chào buổi học đầu tiên! Cho Admin biết cảm nhận về Thầy/Cô.'
                  : 'Cuối cùng — đánh giá giảng viên phụ trách khóa học.'}
              </p>
              <div className="space-y-4">
                <YesNoRow
                  label="Bạn hài lòng với Thầy?"
                  value={feedback.satisfied}
                  yesLabel="HÀI LÒNG"
                  noLabel="CHƯA"
                  onChange={(v) => setFeedback({ ...feedback, satisfied: v })}
                />
                <YesNoRow
                  label="Giảng bài dễ hiểu?"
                  value={feedback.lessonClear}
                  yesLabel="RẤT HIỂU"
                  noLabel="HƠI KHÓ"
                  onChange={(v) => setFeedback({ ...feedback, lessonClear: v })}
                />
                <textarea
                  value={feedback.comment}
                  onChange={(e) => setFeedback({ ...feedback, comment: e.target.value })}
                  placeholder="Lời nhắn riêng cho Admin (bắt buộc)..."
                  className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl p-4 text-sm outline-none focus:border-red-400 focus:bg-white transition-all h-24 italic"
                />
              </div>
              <button
                type="button"
                onClick={submitTeacher}
                disabled={!canSubmit}
                className="w-full bg-gradient-to-r from-red-600 to-red-500 py-4 rounded-2xl text-white font-black text-sm shadow-xl shadow-red-100 active:scale-95 transition transform disabled:opacity-50"
              >
                GỬI ĐÁNH GIÁ
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function YesNoRow({ label, value, yesLabel, noLabel, onChange }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between p-3 bg-gray-50 rounded-2xl border border-gray-100">
      <span className="text-xs font-bold text-gray-700">{label}</span>
      <div className="flex gap-2">
        {['yes', 'no'].map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={`px-3 py-1 rounded-full text-xs font-black transition-all ${
              value === v
                ? 'bg-red-500 text-white shadow-md shadow-red-200'
                : 'bg-white text-gray-400 border border-gray-200'
            }`}
          >
            {v === 'yes' ? yesLabel : noLabel}
          </button>
        ))}
      </div>
    </div>
  );
}
