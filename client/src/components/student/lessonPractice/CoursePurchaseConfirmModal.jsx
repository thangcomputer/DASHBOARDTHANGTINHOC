import { useEffect, useRef } from 'react';
import { AlertTriangle, Loader2, ShoppingCart } from 'lucide-react';

export default function CoursePurchaseConfirmModal({ course, onCancel, onConfirm, confirming }) {
  const confirmButtonRef = useRef(null);
  const onCancelRef = useRef(onCancel);

  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    confirmButtonRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !confirming) onCancelRef.current();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [confirming]);

  if (!course) return null;
  const subjects = Array.isArray(course.subjects)
    ? course.subjects
      .map((subject) => typeof subject === 'string' ? subject : subject?.name)
      .filter(Boolean)
    : [];

  return (
    <div
      className="fixed inset-0 z-[310] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !confirming) onCancel();
      }}
    >
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="course-purchase-confirm-title"
        aria-describedby="course-purchase-confirm-description"
        className="w-full max-w-lg overflow-hidden rounded-3xl border border-white/80 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.28)]"
      >
        <div className="h-2 bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500" />
        <div className="p-6 sm:p-8">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-100 to-orange-50 text-amber-600 shadow-inner">
          <ShoppingCart size={29} strokeWidth={2.2} />
        </div>
        <h2 id="course-purchase-confirm-title" className="text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
          Xác nhận đăng ký khóa học
        </h2>
        <p className="mt-2 text-base font-extrabold text-slate-700 sm:text-lg">{course.name}</p>
        <p id="course-purchase-confirm-description" className="mt-4 text-base leading-relaxed text-slate-600 sm:text-[17px]">
          Bạn có đồng ý đăng ký khóa học này không? Bạn sẽ học qua video bài giảng được sắp xếp theo lộ trình rõ ràng, chủ động học và ôn tập theo thời gian của mình. Đây không phải lớp học trực tiếp cùng giảng viên; tuy vậy, trong quá trình học, bạn vẫn có thể gửi câu hỏi để được hỗ trợ khi cần.
        </p>
        {subjects.length > 0 && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-black text-slate-800 sm:text-base">
              Khóa học gồm {subjects.length} môn:
            </p>
            <div className="mt-2 flex max-h-28 flex-wrap gap-2 overflow-y-auto">
              {subjects.map((subject, index) => (
                <span
                  key={`${subject}-${index}`}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-semibold text-slate-700"
                >
                  {subject}
                </span>
              ))}
            </div>
          </div>
        )}
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3.5 text-rose-800">
          <AlertTriangle className="mt-0.5 shrink-0" size={21} />
          <p className="text-sm font-bold leading-relaxed sm:text-base">
            Khóa học không hoàn phí sau khi đã thanh toán.
          </p>
        </div>
        <div className="mt-7 flex flex-col-reverse justify-end gap-3 sm:flex-row">
          <button
            type="button"
            disabled={confirming}
            onClick={onCancel}
            className="min-h-12 rounded-xl border border-slate-300 bg-white px-6 text-base font-bold text-slate-600 transition hover:border-slate-400 hover:bg-slate-50 disabled:opacity-60"
          >
            Hủy
          </button>
          <button
            ref={confirmButtonRef}
            type="button"
            disabled={confirming}
            onClick={onConfirm}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-7 text-base font-black text-white shadow-lg shadow-emerald-900/15 transition hover:-translate-y-0.5 hover:from-emerald-700 hover:to-teal-700 disabled:cursor-wait disabled:opacity-60"
          >
            {confirming && <Loader2 className="animate-spin" size={16} />}
            Thanh toán
          </button>
        </div>
        </div>
      </section>
    </div>
  );
}
