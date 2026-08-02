import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Clock, ArrowLeft, Send, CheckCircle, XCircle, AlertTriangle,
  ChevronLeft, ChevronRight, LayoutGrid, Award, BookOpen, User, RefreshCw
} from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../utils/toast';

export default function StudentQuizExamRoom({ quizId, onBack }) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [quizData, setQuizData] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [resultData, setResultData] = useState(null);

  const timerRef = useRef(null);

  // 1. Tải thông tin đề thi trắc nghiệm
  useEffect(() => {
    let active = true;
    setLoading(true);
    api.quizzes.getQuizForExam(quizId)
      .then(res => {
        if (!active) return;
        if (res.success && res.data) {
          setQuizData(res.data);
          setTimeLeft((res.data.timeLimitMinutes || 15) * 60);
          // Nếu đã làm rồi, hiển thị bài nộp trước đó
          if (res.data.mySubmission) {
            setResultData({
              score: res.data.mySubmission.score,
              correctCount: res.data.mySubmission.correctCount,
              totalQuestions: res.data.mySubmission.totalQuestions,
              status: res.data.mySubmission.status,
              submittedAt: res.data.mySubmission.submittedAt,
            });
          }
        } else {
          toast.error(res.message || 'Không thể tải bài trắc nghiệm');
        }
      })
      .catch(() => {
        if (active) toast.error('Lỗi kết nối máy chủ');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [quizId]);

  // 2. Đếm ngược thời gian
  useEffect(() => {
    if (loading || resultData || timeLeft <= 0) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [loading, resultData, timeLeft]);

  // Nộp bài tự động khi hết giờ
  const handleAutoSubmit = () => {
    toast.info('Hết giờ làm bài! Đang tự động nộp bài...');
    submitAnswers();
  };

  // 3. Thực hiện nộp bài
  const submitAnswers = async () => {
    if (submitting || !quizData) return;
    setSubmitting(true);
    setShowConfirmModal(false);

    const questions = quizData.questions || [];
    const answerArray = questions.map((_, idx) => (
      selectedAnswers[idx] !== undefined ? selectedAnswers[idx] : null
    ));

    try {
      const res = await api.quizzes.submit(quizId, answerArray);
      if (res.success && res.data) {
        setResultData(res.data);
        toast.success('Đã nộp bài thành công!');
      } else {
        toast.error(res.message || 'Lỗi nộp bài');
      }
    } catch {
      toast.error('Lỗi nộp bài trắc nghiệm');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
        <RefreshCw className="animate-spin text-emerald-400 mb-3" size={32} />
        <p className="text-sm font-bold">Đang tải phòng thi trắc nghiệm...</p>
      </div>
    );
  }

  if (!quizData) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-white">
        <p className="text-base font-bold text-red-400 mb-4">Không có dữ liệu bài thi</p>
        <button type="button" onClick={onBack} className="px-4 py-2 bg-slate-800 rounded-xl text-sm font-bold">
          Quay lại
        </button>
      </div>
    );
  }

  const questions = quizData.questions || [];
  const currentQ = questions[currentIndex];
  const answeredCount = Object.keys(selectedAnswers).length;

  // ── 4. MÀN HÌNH KẾT QUẢ VÀ XEM LẠI BÀI ──────────────────────────────────────
  if (resultData) {
    const isPassed = resultData.status === 'passed' || resultData.score >= 70;
    return (
      <div className="min-h-screen bg-[#0d1117] text-white p-4 sm:p-6 lg:p-8 flex flex-col items-center">
        <div className="w-full max-w-4xl space-y-6">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold transition"
            >
              <ArrowLeft size={16} /> Quay lại danh sách
            </button>
            <span className="text-xs font-bold text-slate-400">Kết quả bài trắc nghiệm</span>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-8 text-center relative overflow-hidden shadow-2xl">
            <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-4 ${
              isPassed ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
            }`}>
              <Award size={40} />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black mb-1">{quizData.title}</h1>
            <p className="text-xs text-slate-400 mb-6">Giảng viên: {quizData.teacherName}</p>

            <div className="inline-flex flex-col items-center justify-center px-8 py-4 rounded-2xl bg-white/5 border border-white/10 mb-6">
              <span className="text-4xl sm:text-5xl font-black text-amber-400 tabular-nums">
                {resultData.score}%
              </span>
              <span className={`text-xs font-bold uppercase tracking-wider mt-1 ${isPassed ? 'text-emerald-400' : 'text-red-400'}`}>
                {isPassed ? 'ĐẠT YÊU CẦU' : 'CHƯA ĐẠT'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-md mx-auto text-left text-xs font-semibold">
              <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                <span className="text-slate-400 block text-[10px]">Số câu đúng</span>
                <span className="text-emerald-400 font-bold text-sm">{resultData.correctCount}/{resultData.totalQuestions}</span>
              </div>
              <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                <span className="text-slate-400 block text-[10px]">Thời gian làm</span>
                <span className="text-white font-bold text-sm">{quizData.timeLimitMinutes} phút</span>
              </div>
              <div className="bg-white/5 p-3 rounded-xl border border-white/5 col-span-2 sm:col-span-1">
                <span className="text-slate-400 block text-[10px]">Trạng thái</span>
                <span className={`font-bold text-sm ${isPassed ? 'text-emerald-400' : 'text-red-400'}`}>
                  {isPassed ? 'Đã hoàn thành' : 'Cần học lại'}
                </span>
              </div>
            </div>
          </div>

          {/* Chi tiết đáp án từng câu */}
          {resultData.detailedReview && resultData.detailedReview.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-slate-200">Chi tiết đáp án bài thi</h3>
              {resultData.detailedReview.map((q, idx) => (
                <div key={q._id || idx} className="bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-bold text-sm text-slate-100">
                      <span className="text-emerald-400 mr-2">Câu {idx + 1}:</span> {q.questionText}
                    </p>
                    {q.isCorrect ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md shrink-0">
                        <CheckCircle size={12} /> Đúng
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-black text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-md shrink-0">
                        <XCircle size={12} /> Sai
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-semibold">
                    {q.options.map((opt, optIdx) => {
                      const isUserChoice = q.userAnswer === optIdx;
                      const isCorrectChoice = q.correctAnswer === optIdx;
                      let optionStyle = 'bg-white/5 text-slate-400 border-white/5';
                      if (isCorrectChoice) {
                        optionStyle = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold';
                      } else if (isUserChoice && !q.isCorrect) {
                        optionStyle = 'bg-red-500/20 text-red-300 border-red-500/40 font-bold';
                      }
                      return (
                        <div key={optIdx} className={`p-3 rounded-xl border flex items-center gap-2 ${optionStyle}`}>
                          <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-[10px] shrink-0">
                            {String.fromCharCode(65 + optIdx)}
                          </span>
                          <span className="flex-1 min-w-0 leading-tight">{opt}</span>
                        </div>
                      );
                    })}
                  </div>

                  {q.explanation && (
                    <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-xs text-indigo-200">
                      <strong>Giải thích từ GV:</strong> {q.explanation}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── 5. MÀN HÌNH THI TRẮC NGHIỆM CHUẨN BỐ CỤC PHÒNG THI CHỨNG CHỈ ──────────
  return (
    <div className="min-h-screen bg-[#0b1018] text-white flex flex-col font-sans select-none overflow-x-hidden">
      {/* ── TOPBAR PHÒNG THI ── */}
      <header className="h-14 bg-[#0e1420] border-b border-white/10 px-4 sm:px-6 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="min-w-0">
            <h1 className="font-bold text-sm sm:text-base text-slate-100 truncate">{quizData.title}</h1>
            <p className="text-[11px] text-slate-400 truncate">Lớp: {quizData.courseName || 'Bài thi trắc nghiệm'}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 bg-amber-500/15 border border-amber-500/30 px-3 py-1.5 rounded-xl text-amber-300 font-black text-sm tabular-nums">
            <Clock size={16} className="text-amber-400 animate-pulse" />
            <span>{formatTime(timeLeft)}</span>
          </div>
          <button
            type="button"
            onClick={() => setShowConfirmModal(true)}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition shadow-md shadow-red-900/30 flex items-center gap-1.5"
          >
            <Send size={14} /> Nộp bài
          </button>
        </div>
      </header>

      {/* ── NỘI DUNG CHÍNH (2 CỘT PADDING CHUẨN) ── */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-y-auto lg:overflow-hidden">
        {/* Cột trái: Câu hỏi hiện tại */}
        <div className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {currentQ ? (
            <div className="max-w-3xl mx-auto w-full space-y-6">
              <div className="flex items-center justify-between gap-3 text-xs font-bold text-slate-400 border-b border-white/10 pb-3">
                <span className="text-emerald-400 uppercase tracking-widest text-[11px]">
                  Câu hỏi {currentIndex + 1} / {questions.length}
                </span>
                <span>Đã chọn: {answeredCount}/{questions.length}</span>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-5 sm:p-6 shadow-xl">
                <h2 className="text-base sm:text-lg font-bold text-slate-100 leading-relaxed mb-6">
                  {currentQ.questionText}
                </h2>

                <div className="space-y-3">
                  {(currentQ.options || []).map((opt, optIdx) => {
                    const isSelected = selectedAnswers[currentIndex] === optIdx;
                    return (
                      <button
                        key={optIdx}
                        type="button"
                        onClick={() => {
                          setSelectedAnswers(prev => ({ ...prev, [currentIndex]: optIdx }));
                        }}
                        className={`w-full p-4 rounded-xl border text-left transition-all flex items-center gap-3 ${
                          isSelected
                            ? 'bg-emerald-500/20 border-emerald-500 text-white shadow-md shadow-emerald-900/20'
                            : 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-300'
                        }`}
                      >
                        <span className={`w-7 h-7 rounded-full border text-xs font-black flex items-center justify-center shrink-0 transition-all ${
                          isSelected
                            ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                            : 'border-white/20 text-slate-400'
                        }`}>
                          {String.fromCharCode(65 + optIdx)}
                        </span>
                        <span className="text-sm font-semibold flex-1 leading-snug">{opt}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Điều hướng Trước / Sau */}
              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  disabled={currentIndex <= 0}
                  onClick={() => setCurrentIndex(prev => prev - 1)}
                  className="px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-30 text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <ChevronLeft size={16} /> Câu trước
                </button>
                <button
                  type="button"
                  disabled={currentIndex >= questions.length - 1}
                  onClick={() => setCurrentIndex(prev => prev + 1)}
                  className="px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-30 text-xs font-bold flex items-center gap-1.5 transition"
                >
                  Câu tiếp <ChevronRight size={16} />
                </button>
              </div>
            </div>
          ) : (
            <p className="text-center py-10 text-slate-400 text-sm">Chưa có câu hỏi</p>
          )}
        </div>

        {/* Cột phải: Ma trận số câu hỏi (Sidebar) */}
        <div className="lg:w-80 border-t lg:border-t-0 lg:border-l border-white/10 p-4 sm:p-6 bg-[#0e1420] flex flex-col shrink-0">
          <div className="flex items-center gap-2 mb-4 text-xs font-bold text-slate-300">
            <LayoutGrid size={16} className="text-emerald-400" />
            <span>Danh sách câu hỏi</span>
          </div>

          <div className="grid grid-cols-5 gap-2 overflow-y-auto flex-1 max-h-60 lg:max-h-none pr-1">
            {questions.map((_, idx) => {
              const isAnswered = selectedAnswers[idx] !== undefined;
              const isCurrent = idx === currentIndex;
              let btnStyle = 'bg-white/5 border-white/10 text-slate-400';
              if (isCurrent) {
                btnStyle = 'bg-emerald-500 text-slate-950 font-black border-emerald-400 ring-2 ring-emerald-400/50';
              } else if (isAnswered) {
                btnStyle = 'bg-emerald-500/25 border-emerald-500/50 text-emerald-300 font-bold';
              }

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  className={`h-10 rounded-xl border text-xs font-bold flex items-center justify-center transition-all ${btnStyle}`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          <div className="mt-4 pt-4 border-t border-white/10 space-y-2 text-[11px] text-slate-400 font-semibold">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-md bg-emerald-500/25 border border-emerald-500/50" />
              <span>Đã làm ({answeredCount})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-md bg-white/5 border border-white/10" />
              <span>Chưa làm ({questions.length - answeredCount})</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── MODAL XÁC NHẬN NỘP BÀI ── */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#161d2a] border border-white/10 rounded-2xl max-w-sm w-full p-6 text-white space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <AlertTriangle className="text-amber-400" size={20} /> Xác nhận nộp bài?
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Bạn đã hoàn thành <strong>{answeredCount}/{questions.length}</strong> câu hỏi. Bạn có chắc chắn muốn nộp bài thi ngay bây giờ?
            </p>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-bold transition"
              >
                Làm tiếp
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={submitAnswers}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition shadow-md"
              >
                {submitting ? 'Đang nộp...' : 'Nộp bài ngay'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
