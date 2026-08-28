import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminTab } from '../AdminTabContext';
import { useBranch } from '../../../context/BranchContext';
import api from '../../../services/api';
import { AlertTriangle, ShieldAlert, MessageSquare, CheckCircle2, MessageCircle, UserCheck, Building2, Loader2 } from 'lucide-react';
import { RATING_CRITERIA } from '../../../context/useDataRatings';

function Chip({ label, value, tone = 'sky' }) {
  const toneClass = tone === 'red' ? 'text-red-600' : tone === 'orange' ? 'text-orange-600' : 'text-sky-700';
  return (
    <div className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-100 rounded-xl shadow-sm min-h-11">
      <span className="text-[12px] font-semibold text-slate-400 uppercase">{label}:</span>
      <span className={`text-[13px] font-bold ${toneClass}`}>{value}</span>
    </div>
  );
}

function CriteriaChips({ criteria = {} }) {
  if (criteria.teaching || criteria.voice || criteria.guidance || criteria.support) {
    return (
      <div className="flex flex-wrap gap-2">
        {Object.entries(RATING_CRITERIA).map(([key, cat]) => {
          const opt = cat.options.find((o) => o.key === criteria[key]);
          if (!opt) return null;
          return <Chip key={key} label={cat.label} value={opt.label} />;
        })}
      </div>
    );
  }
  if (criteria.centerSupport || criteria.centerFacility) {
    return (
      <div className="flex flex-wrap gap-2">
        <Chip
          label="Hỗ trợ"
          value={criteria.centerSupport === 'yes' ? 'TỐT' : 'CHƯA TỐT'}
          tone={criteria.centerSupport === 'yes' ? 'sky' : 'red'}
        />
        <Chip
          label="Cơ sở"
          value={criteria.centerFacility === 'yes' ? 'HÀI LÒNG' : 'CHƯA'}
          tone={criteria.centerFacility === 'yes' ? 'sky' : 'orange'}
        />
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      <Chip
        label="Hài lòng"
        value={criteria.satisfied === 'yes' ? 'CÓ' : 'KHÔNG'}
        tone={criteria.satisfied === 'yes' ? 'sky' : 'red'}
      />
      <Chip
        label="Dễ hiểu"
        value={criteria.lessonClear === 'yes' ? 'HIỂU' : 'HƠI KHÓ'}
        tone={criteria.lessonClear === 'yes' ? 'sky' : 'orange'}
      />
    </div>
  );
}

function EvaluationCard({ ev, markEvaluationRead, navigate }) {
  return (
    <div
      className={`p-4 sm:p-5 transition-all duration-200 border-l-4 rounded-xl mb-4 ${
        ev.read ? 'border-slate-200 bg-white shadow-sm hover:shadow-md' : 'border-red-500 bg-red-50/70 shadow-md ring-1 ring-red-100'
      }`}
    >
      <div className="flex flex-col gap-4 min-w-0">
        <div className="space-y-3 flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {!ev.read && (
              <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-md animate-pulse">MỚI</span>
            )}
            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
              ev.milestone === 'lesson_1' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
            }`}>
              {ev.milestone === 'lesson_1' ? 'BUỔI ĐẦU TIÊN'
                : ev.milestone === 'course_end_center' ? 'CUỐI KHÓA - TRUNG TÂM'
                  : ev.milestone === 'course_end_teacher' ? 'CUỐI KHÓA - GIẢNG VIÊN'
                    : ev.milestone === 'manual_feedback' ? 'PHẢN HỒI TỰ NGUYỆN'
                      : ev.milestone === 'mid_course' ? 'MỐC 50% KHÓA'
                        : String(ev.milestone || 'ĐÁNH GIÁ').toUpperCase()}
            </span>
            <span className="text-[11px] font-medium text-slate-500">{ev.date}</span>
          </div>
          <h4 className="text-[15px] font-bold text-slate-800">
            HV: <span className="text-blue-700">{ev.studentName}</span> ➝ GV: <span className="text-slate-600">{ev.teacherName}</span>
          </h4>
          {ev.courseName && (
            <span className="inline-flex max-w-full items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-xl bg-teal-50 text-teal-700 border border-teal-100">
              <span className="line-clamp-2">📚 {ev.courseName}</span>
            </span>
          )}
          <CriteriaChips criteria={ev.criteria} />
          <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-100 relative mt-2 shadow-sm min-h-[64px] flex items-start">
            <div className="absolute -left-2 -top-2 bg-red-50 rounded-full p-1.5 border border-red-100 shadow-sm text-red-500">
              <MessageSquare size={14} aria-hidden="true" />
            </div>
            <p className="text-[13px] text-slate-700 font-medium leading-relaxed italic pl-3 mt-1">
              {(ev.content || ev.comment || '').trim()
                ? `"${(ev.content || ev.comment).trim()}"`
                : <span className="text-slate-400 not-italic">Không có lời nhắn đi kèm.</span>}
            </p>
          </div>
        </div>
        <div className="flex flex-col min-[400px]:flex-row gap-2 flex-shrink-0 pt-2 border-t border-slate-100/50">
          {!ev.read && (
            <button
              type="button"
              onClick={() => markEvaluationRead(ev.id)}
              className="flex-1 inline-flex justify-center items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-xs font-bold transition-colors shadow-sm"
            >
              <CheckCircle2 size={14} /> Đã xem
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate('/admin/inbox', { state: { selectUserId: ev.studentId } })}
            className="flex-1 inline-flex justify-center items-center gap-1.5 bg-slate-900 hover:bg-black text-white px-3 py-2 rounded-lg text-xs font-bold transition-colors shadow-sm"
          >
            <MessageCircle size={14} /> Phản hồi học viên
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminEvaluationsTab() {
  const { markEvaluationRead } = useAdminTab();
  const { selectedBranchId } = useBranch();
  const navigate = useNavigate();
  const [branchEvals, setBranchEvals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.evaluations.getPrivate({ branchId: selectedBranchId || 'all' })
      .then((res) => {
        if (cancelled) return;
        const rows = res?.success ? (res.data || []) : [];
        setBranchEvals(rows.map((e) => ({
          ...e,
          id: e._id || e.id,
          comment: e.content || e.comment || '',
        })));
      })
      .catch(() => {
        if (!cancelled) setBranchEvals([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [selectedBranchId]);

  const markRead = (evalId) => {
    markEvaluationRead(evalId);
    setBranchEvals((prev) => prev.map((ev) => (
      String(ev.id) === String(evalId) ? { ...ev, read: true } : ev
    )));
  };

  const allEvals = branchEvals;
  
  const centerEvals = allEvals.filter(ev => ev.milestone === 'course_end_center' || (ev.criteria && (ev.criteria.centerSupport || ev.criteria.centerFacility)));
  const teacherEvals = allEvals.filter(ev => !centerEvals.includes(ev));

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 py-5 sm:px-6 sm:py-6 border-b border-slate-100 bg-gradient-to-r from-red-50 to-white">
          <h2 className="text-xl font-black text-slate-800 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600">
              <AlertTriangle size={18} aria-hidden="true" />
            </div>
            Báo cáo đánh giá chất lượng nội bộ
          </h2>
          <p className="text-sm font-medium text-slate-500 mt-2 ml-10">
            Đây là các đánh giá riêng tư từ học viên được gửi trực tiếp cho Admin tại các mốc quan trọng của khóa học.
          </p>
        </div>
        
        <div className="p-4 sm:p-6 bg-slate-50">
          {loading ? (
            <div className="py-16 flex justify-center text-slate-400">
              <Loader2 className="animate-spin" size={28} />
            </div>
          ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
            
            {/* Cột 1: Đánh giá Giảng viên */}
            <div className="flex flex-col">
              <div className="flex items-center gap-2 mb-4 px-1">
                <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 shadow-sm border border-blue-200/50">
                  <UserCheck size={16} />
                </div>
                <h3 className="text-[17px] font-black text-slate-800">Đánh giá Giảng viên</h3>
                <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full text-[11px] font-black ml-auto shadow-inner">
                  {teacherEvals.length}
                </span>
              </div>
              
              <div className="flex-1">
                {teacherEvals.length === 0 ? (
                  <div className="h-40 flex flex-col items-center justify-center bg-white rounded-xl border border-dashed border-slate-200 text-slate-400">
                    <ShieldAlert size={24} className="mb-2 opacity-50" />
                    <p className="text-sm font-medium">Chưa có đánh giá nào</p>
                  </div>
                ) : (
                  <div className="space-y-0">
                    {teacherEvals.map(ev => (
                      <EvaluationCard key={ev.id} ev={ev} markEvaluationRead={markRead} navigate={navigate} />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Cột 2: Đánh giá Trung tâm */}
            <div className="flex flex-col">
              <div className="flex items-center gap-2 mb-4 px-1">
                <div className="w-8 h-8 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600 shadow-sm border border-orange-200/50">
                  <Building2 size={16} />
                </div>
                <h3 className="text-[17px] font-black text-slate-800">Đánh giá Trung tâm</h3>
                <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full text-[11px] font-black ml-auto shadow-inner">
                  {centerEvals.length}
                </span>
              </div>
              
              <div className="flex-1">
                {centerEvals.length === 0 ? (
                  <div className="h-40 flex flex-col items-center justify-center bg-white rounded-xl border border-dashed border-slate-200 text-slate-400">
                    <ShieldAlert size={24} className="mb-2 opacity-50" />
                    <p className="text-sm font-medium">Chưa có đánh giá nào</p>
                  </div>
                ) : (
                  <div className="space-y-0">
                    {centerEvals.map(ev => (
                      <EvaluationCard key={ev.id} ev={ev} markEvaluationRead={markRead} navigate={navigate} />
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>
          )}
        </div>
      </div>
    </div>
  );
}
