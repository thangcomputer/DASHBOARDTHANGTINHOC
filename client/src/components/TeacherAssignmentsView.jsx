import React, { useState, useEffect, useMemo } from 'react';
import CmsSelect from './ui/CmsSelect';
import { Plus, Clipboard, FileText, Download, CheckCircle, Clock, XCircle, Search } from 'lucide-react';
import NavArrow from './ui/NavArrow';
import { useLocation } from 'react-router-dom';
import api, { resolveMediaUrl, buildMediaDownloadUrl } from '../services/api';
import { getGradeTextClasses } from '../utils/gradeColors';
import { useModal } from '../utils/Modal.jsx';

import TeacherQuizManager from './teacher/TeacherQuizManager';

/** Local datetime-local string (YYYY-MM-DDTHH:mm) — không dùng toISOString (UTC lệch). */
function toDatetimeLocalValue(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function studentRowKey(s) {
  return String(s?._enrollmentKey || s?._id || s?.id || '');
}

function studentIdOf(s) {
  return String(s?._id || s?.id || '').trim();
}

const TeacherAssignmentsView = ({ teacherId, myStudents }) => {
  const location = useLocation();
  const { showModal } = useModal();
  const [activeTab, setActiveTab] = useState('quiz'); // 'quiz' | 'file'
  // Compute unique courses from students
  const uniqueCourses = [...new Set((myStudents || []).map(s => s.course).filter(Boolean))];
  const [selectedCourse, setSelectedCourse] = useState(uniqueCourses[0] || '');

  const [assignments, setAssignments] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeSubmissions, setActiveSubmissions] = useState(null);
  
  // Create / Grade state
  const [formData, setFormData] = useState({ title: '', description: '', attachedFileUrl: '', deadline: '' });
  const [assignScope, setAssignScope] = useState('all'); // 'all' | 'selected'
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [deadlineMin, setDeadlineMin] = useState(() => toDatetimeLocalValue(new Date()));
  const [isSubmitting, setIsSubmitting] = useState(false);

  const courseStudents = useMemo(
    () => (myStudents || []).filter((s) => String(s.course || '') === String(selectedCourse || '')),
    [myStudents, selectedCourse],
  );

  const [gradingSubmission, setGradingSubmission] = useState(null);
  const [gradeData, setGradeData] = useState({ grade: '', teacherFeedback: '' });
  const [highlightStudentId, setHighlightStudentId] = useState(null);

  // First paint often has myStudents=[] — pick first course when data arrives
  useEffect(() => {
    if (!uniqueCourses.length) return;
    if (selectedCourse && uniqueCourses.includes(selectedCourse)) return;
    setSelectedCourse(uniqueCourses[0]);
  }, [uniqueCourses, selectedCourse]);

  useEffect(() => {
    fetchAssignments();
  }, [selectedCourse]);

  // ⭐ Auto-scroll/Auto-select logic for Notifications
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('?')) {
      const params = new URLSearchParams(hash.split('?')[1]);
      const courseId = params.get('courseId');
      const assignmentId = params.get('assignmentId');
      
      if (courseId && courseId !== selectedCourse) {
        setSelectedCourse(courseId);
      }
      
      if (assignmentId && assignments.length > 0) {
        const target = assignments.find(a => a._id === assignmentId);
        if (target && (!activeSubmissions || activeSubmissions._id !== assignmentId)) {
          setActiveSubmissions(target);
          setHighlightStudentId(params.get('studentId'));
        }
      }
    }
  }, [assignments, selectedCourse, location.hash]);

  const fetchAssignments = () => {
    if (!selectedCourse) return Promise.resolve([]);
    return api.assignments.getByCourse(selectedCourse)
      .then(res => {
        if (res.success) {
          const rows = res.data || [];
          setAssignments(rows);
          setActiveSubmissions((prev) => {
            if (!prev?._id) return prev;
            const fresh = rows.find((a) => String(a._id) === String(prev._id));
            return fresh || prev;
          });
          return rows;
        }
        return [];
      })
      .catch((err) => {
        console.error(err);
        return [];
      });
  };

  const openCreateModal = () => {
    setDeadlineMin(toDatetimeLocalValue(new Date()));
    setAssignScope('all');
    setSelectedStudentIds([]);
    setFormData({ title: '', description: '', attachedFileUrl: '', deadline: '' });
    setShowCreateModal(true);
  };

  const toggleStudentId = (id) => {
    const key = String(id || '').trim();
    if (!key) return;
    setSelectedStudentIds((prev) => (
      prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]
    ));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!selectedCourse) {
        showModal({ 
            title: 'Yêu cầu chọn lớp', 
            content: 'Vui lòng chọn một lớp học bên Sidebar trước khi thực hiện giao bài tập mới!', 
            type: 'warning' 
        });
        return;
    }
    if (!formData.title || !formData.deadline) return;

    const deadlineDate = new Date(formData.deadline);
    if (Number.isNaN(deadlineDate.getTime()) || deadlineDate.getTime() <= Date.now()) {
      showModal({
        title: 'Deadline không hợp lệ',
        content: 'Thời hạn nộp bài phải sau thời điểm hiện tại.',
        type: 'warning',
      });
      return;
    }

    let targets = [];
    if (assignScope === 'selected') {
      if (!selectedStudentIds.length) {
        showModal({
          title: 'Chưa chọn học viên',
          content: 'Chọn ít nhất một học viên, hoặc chọn giao cho cả lớp.',
          type: 'warning',
        });
        return;
      }
      targets = selectedStudentIds;
    } else {
      // Cả lớp → 1 bài / HV (API HV chỉ trả bài có studentId; null = HV không thấy)
      const ids = [...new Set(courseStudents.map(studentIdOf).filter(Boolean))];
      targets = ids.length ? ids : [null];
    }

    setIsSubmitting(true);
    try {
      const fileUrl = String(formData.attachedFileUrl || '').trim();
      const basePayload = {
        title: formData.title,
        description: formData.description,
        fileUrl,
        attachedFileUrl: fileUrl,
        teacherId,
        courseId: selectedCourse,
        deadline: deadlineDate,
      };

      let ok = 0;
      for (const studentId of targets) {
        const res = await api.assignments.create({
          ...basePayload,
          studentId: studentId || null,
        });
        if (res?.success) ok += 1;
      }

      if (ok > 0) {
        setShowCreateModal(false);
        setFormData({ title: '', description: '', attachedFileUrl: '', deadline: '' });
        setAssignScope('all');
        setSelectedStudentIds([]);
        fetchAssignments();
      } else {
        showModal({
          title: 'Không tạo được bài tập',
          content: 'Vui lòng thử lại hoặc kiểm tra kết nối.',
          type: 'error',
        });
      }
    } catch {
      showModal({
        title: 'Lỗi kết nối',
        content: 'Không tạo được bài tập. Vui lòng thử lại.',
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGrade = (e) => {
    e.preventDefault();
    const submissionId = gradingSubmission?._id;
    const assignmentId = activeSubmissions?._id || gradingSubmission?.assignmentId;
    if (!submissionId) return;
    setIsSubmitting(true);
    api.assignments.grade(submissionId, gradeData)
      .then(res => {
        setIsSubmitting(false);
        if (res.success) {
          const updated = res.data || {};
          const nextGrade = updated.grade != null ? updated.grade : gradeData.grade;
          const nextFeedback = updated.teacherFeedback != null
            ? updated.teacherFeedback
            : gradeData.teacherFeedback;
          const patchSub = (sub) => (
            String(sub._id) === String(submissionId)
              ? {
                  ...sub,
                  ...updated,
                  grade: nextGrade,
                  teacherFeedback: nextFeedback,
                  status: 'graded',
                }
              : sub
          );

          // Cập nhật ngay bảng trong popup (không chờ đóng/mở lại)
          setActiveSubmissions((prev) => {
            if (!prev) return prev;
            if (assignmentId && String(prev._id) !== String(assignmentId)) return prev;
            return {
              ...prev,
              submissions: (prev.submissions || []).map(patchSub),
            };
          });
          setAssignments((prev) => prev.map((a) => {
            if (assignmentId && String(a._id) !== String(assignmentId)) return a;
            if (!assignmentId && !(a.submissions || []).some((s) => String(s._id) === String(submissionId))) {
              return a;
            }
            return {
              ...a,
              submissions: (a.submissions || []).map(patchSub),
            };
          }));

          setGradingSubmission(null);
          setGradeData({ grade: '', teacherFeedback: '' });
          fetchAssignments();
        }
      }).catch(() => setIsSubmitting(false));
  };

  if (!selectedCourse) {
    const waitingForStudents = !(myStudents && myStudents.length);
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <Search size={48} className="mb-4 opacity-20" />
        <p className="font-medium text-lg">
          {waitingForStudents ? 'Đang tải lớp / khóa học…' : 'Chưa có Lớp / Khóa học'}
        </p>
        <p className="text-sm text-center max-w-sm">
          {waitingForStudents
            ? 'Vui lòng chờ danh sách học viên tải xong.'
            : 'Chưa có học viên được phân công khóa học — không thể xem bài tập.'}
        </p>
      </div>
    );
  }

  // Calculate stats for submissions view
  const calculateStats = (subs = []) => {
    const total = myStudents.filter(s => s.course === selectedCourse).length || 1; // Fallback to 1 to avoid div by 0
    const submitted = subs.filter(s => s.status !== 'not_submitted').length;
    const graded = subs.filter(s => s.status === 'graded').length;
    return {
      total,
      submitted,
      graded,
      missing: total - submitted
    };
  };

  return (
    <div className="space-y-6 w-full">
      {/* ── TAB SWITCHER DÀNH CHO GIẢNG VIÊN ── */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('quiz')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 ${
            activeTab === 'quiz'
              ? 'bg-red-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Clipboard size={16} /> Bài thi Trắc nghiệm
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('file')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 ${
            activeTab === 'file'
              ? 'bg-red-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <FileText size={16} /> Bài tập về nhà (Nộp file)
        </button>
      </div>

      {activeTab === 'quiz' ? (
        <TeacherQuizManager myStudents={myStudents} />
      ) : (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-3">
              <span className="flex items-center gap-2"><Clipboard size={20} className="text-red-600" /> Bài tập của:</span>
              <CmsSelect 
                value={selectedCourse} 
                onChange={(e) => setSelectedCourse(e.target.value)}
                className="border-2 border-red-200 focus:border-red-500 rounded-xl px-3 py-1.5 outline-none font-black text-red-700 bg-red-50 hover:bg-red-100 transition-colors cursor-pointer text-sm"
              >
                {uniqueCourses.map(c => <option key={c} value={c}>{c}</option>)}
              </CmsSelect>
            </h2>
        <button 
          onClick={openCreateModal}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-red-200 transition-all flex items-center gap-2 active:scale-95"
        >
          <Plus size={16} /> Tạo bài tập mới
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {assignments.length === 0 ? (
          <div className="col-span-full py-16 text-center bg-white rounded-3xl border border-slate-100 shadow-sm">
            <FileText size={40} className="mx-auto mb-4 text-slate-200" />
            <p className="font-bold text-slate-600">Chưa có Bài tập nào</p>
            <p className="text-sm text-slate-400 mt-1">Giao bài đầu tiên cho lớp tải về làm thực hành</p>
          </div>
        ) : (
          assignments.map(a => {
            const stats = calculateStats(a.submissions);
            const isClosed = new Date(a.deadline) < new Date();
            
            return (
              <div key={a._id} className="bg-white rounded-2xl p-5 border border-slate-100 flex flex-col justify-between hover:shadow-lg transition-shadow">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-slate-800 text-lg leading-tight">{a.title}</h3>
                    <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-md ${isClosed ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                      {isClosed ? 'Đã đóng' : 'Hoạt động'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mb-3 line-clamp-2">{a.description || 'Không có mô tả'}</p>
                  <p className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                    <Clock size={12}/> Hạn chót: {new Date(a.deadline).toLocaleString('vi-VN')}
                  </p>
                </div>
                
                <div className="mt-5 space-y-3">
                  <div className="flex bg-slate-50 rounded-xl overflow-hidden divide-x divide-slate-100 border border-slate-100">
                    <div className="flex-1 text-center py-2">
                      <p className="text-xs font-semibold text-slate-400">Nộp bài</p>
                      <p className="font-black text-slate-700">{stats.submitted}/{stats.total}</p>
                    </div>
                    <div className="flex-1 text-center py-2">
                      <p className="text-xs font-semibold text-slate-400">Đã chấm</p>
                      <p className="font-black text-green-600">{stats.graded}</p>
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => setActiveSubmissions(a)}
                    className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl text-sm transition-colors text-center"
                  >
                    Xem tất cả {stats.submitted} bài nộp
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* CREATE SUBMISSION MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-w-lg w-full max-h-[92dvh] sm:max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <h3 className="font-bold text-lg text-slate-800">Tạo mới Bài tập</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-red-500 bg-white shadow-sm p-1 rounded-full"><XCircle size={22}/></button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4 overflow-y-auto overscroll-contain min-h-0 flex-1">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Tên bài tập *</label>
                <input required type="text" className="w-full border-2 border-slate-200 focus:border-red-500 rounded-xl px-4 py-2.5 outline-none font-semibold" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="VD: THVP Buổi 1..."/>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Mô tả / Yêu cầu</label>
                <textarea className="w-full border-2 border-slate-200 focus:border-red-500 rounded-xl px-4 py-2.5 outline-none text-sm min-h-[100px]" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Yêu cầu làm các sheet..."></textarea>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Link File đề bài (Google Drive...)</label>
                <input type="url" className="w-full border-2 border-slate-200 focus:border-red-500 rounded-xl px-4 py-2.5 outline-none text-sm" value={formData.attachedFileUrl} onChange={e => setFormData({...formData, attachedFileUrl: e.target.value})} placeholder="https://..."/>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Giao cho *</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => { setAssignScope('all'); setSelectedStudentIds([]); }}
                    className={`h-9 px-3 rounded-xl text-xs font-bold border-2 transition ${
                      assignScope === 'all'
                        ? 'bg-red-600 text-white border-red-600'
                        : 'bg-white text-red-600 border-red-600 hover:bg-red-50'
                    }`}
                  >
                    Cả lớp ({courseStudents.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setAssignScope('selected')}
                    className={`h-9 px-3 rounded-xl text-xs font-bold border-2 transition ${
                      assignScope === 'selected'
                        ? 'bg-red-600 text-white border-red-600'
                        : 'bg-white text-red-600 border-red-600 hover:bg-red-50'
                    }`}
                  >
                    Chọn học viên
                  </button>
                </div>
                {assignScope === 'selected' ? (
                  <div className="max-h-40 overflow-y-auto rounded-xl border-2 border-slate-200 divide-y divide-slate-100 bg-slate-50/80">
                    {courseStudents.length === 0 ? (
                      <p className="text-xs text-slate-400 font-medium p-3">Không có học viên trong khóa này.</p>
                    ) : (
                      courseStudents.map((s) => {
                        const sid = studentIdOf(s);
                        const checked = selectedStudentIds.includes(sid);
                        return (
                          <label
                            key={studentRowKey(s) || sid}
                            className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-white"
                          >
                            <input
                              type="checkbox"
                              className="rounded border-slate-300 text-red-600 focus:ring-red-500"
                              checked={checked}
                              onChange={() => toggleStudentId(sid)}
                            />
                            <span className="text-sm font-semibold text-slate-700 truncate">
                              {s.name || 'Học viên'}
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500 font-medium">
                    Sẽ giao cho từng học viên khóa <strong>{selectedCourse}</strong>
                    {courseStudents.length ? ` (${courseStudents.length} HV)` : ''}.
                  </p>
                )}
              </div>

              <div className="min-w-0">
                <label className="block text-sm font-bold text-slate-700 mb-1">Thời hạn (Deadline) *</label>
                <input
                  required
                  type="datetime-local"
                  min={deadlineMin}
                  className="w-full max-w-full min-w-0 border-2 border-slate-200 focus:border-red-500 rounded-xl px-3 sm:px-4 py-2.5 outline-none font-semibold text-sm sm:text-base"
                  value={formData.deadline}
                  onChange={e => setFormData({...formData, deadline: e.target.value})}
                  onFocus={() => setDeadlineMin(toDatetimeLocalValue(new Date()))}
                />
                <p className="text-[11px] text-slate-400 mt-1">Chỉ chọn thời điểm từ hiện tại trở đi.</p>
              </div>
              <button disabled={isSubmitting} type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-red-200 mt-4 disabled:opacity-50 sticky bottom-0">
                {isSubmitting ? 'Đang tạo...' : 'Tạo Bài Tập'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* VIEW SUBMISSIONS MODAL */}
      {activeSubmissions && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="font-bold text-lg text-slate-800">Bài nộp: {activeSubmissions.title}</h3>
                <p className="text-xs text-slate-500 font-semibold mt-1">Hạn nộp: {new Date(activeSubmissions.deadline).toLocaleString('vi-VN')}</p>
              </div>
              <button onClick={() => setActiveSubmissions(null)} className="text-slate-400 hover:text-red-500 bg-white shadow-sm p-1 rounded-full"><XCircle size={22}/></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              {activeSubmissions.submissions?.length === 0 ? (
                <div className="text-center py-10 opacity-50"><p className="font-bold">Chưa có học viên nào nộp bài</p></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[600px]">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 text-xs uppercase font-black tracking-wider border-b border-slate-100">
                        <th className="p-3">Học viên</th>
                        <th className="p-3">Thời gian nộp</th>
                        <th className="p-3">Trạng thái</th>
                        <th className="p-3">Bài làm</th>
                        <th className="p-3">Điểm / Chấm</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeSubmissions.submissions.map(sub => {
                        const isGraded = sub.status === 'graded';
                        const isHighlighted = highlightStudentId && (sub.studentId?._id === highlightStudentId || sub.studentId === highlightStudentId);
                        return (
                          <tr key={sub._id} className={`border-b border-slate-50 hover:bg-slate-50/50 transition-colors ${isHighlighted ? 'bg-blue-50 ring-2 ring-blue-500 ring-inset ring-opacity-50' : ''}`}>
                            <td className="p-3 font-bold text-slate-700 text-sm whitespace-nowrap">
                              {isHighlighted && <span className="inline-block w-2 h-2 bg-red-500 rounded-full mr-2 animate-pulse"></span>}
                              {sub.studentId?.name || 'Không xác định'}
                            </td>
                            <td className="p-3 text-xs font-semibold text-slate-500 whitespace-nowrap">{new Date(sub.submittedAt || sub.createdAt).toLocaleString('vi-VN')}</td>
                            <td className="p-3 whitespace-nowrap">
                              {isGraded ? <span className="bg-green-100 text-green-700 text-[10px] uppercase font-black px-2 py-1 rounded-md">Đã chấm</span> : <span className="bg-blue-100 text-blue-700 text-[10px] uppercase font-black px-2 py-1 rounded-md">Đã nộp</span>}
                            </td>
                            <td className="p-3 whitespace-nowrap">
                              {sub.submittedFileUrl ? (
                                <a href={buildMediaDownloadUrl(sub.submittedFileUrl, sub.submittedFileUrl.split('/').pop())} target="_blank" rel="noreferrer" className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1 w-max">
                                  <Download size={14}/> Mở bài làm
                                </a>
                              ) : (
                                <span className="text-[10px] text-slate-400 italic">Không có file</span>
                              )}
                            </td>
                            <td className="p-3">
                              {isGraded ? (
                                <div className="text-sm max-w-[180px]">
                                  <span className={`font-black ${getGradeTextClasses(sub.grade)}`}>{sub.grade}/10</span>
                                  {sub.teacherFeedback ? (
                                    <span className="block text-[10px] text-slate-500 mt-0.5 leading-snug whitespace-normal" title={sub.teacherFeedback}>
                                      Góp ý: {sub.teacherFeedback}
                                    </span>
                                  ) : null}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setGradingSubmission(sub);
                                      setGradeData({
                                        grade: sub.grade != null ? String(sub.grade) : '',
                                        teacherFeedback: sub.teacherFeedback || '',
                                      });
                                    }}
                                    className="mt-1 text-[10px] font-bold text-orange-600 hover:underline"
                                  >
                                    Sửa điểm / góp ý
                                  </button>
                                </div>
                              ) : (
                                <button onClick={() => { setGradingSubmission(sub); setGradeData({ grade: '', teacherFeedback: '' }); }} className="text-xs font-bold bg-orange-100 text-orange-700 hover:bg-orange-200 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                                  Chấm bài
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* GRADING MODAL */}
      {gradingSubmission && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-lg text-slate-800">Chấm bài</h3>
              <button onClick={() => setGradingSubmission(null)} className="text-slate-400 hover:text-red-500 bg-white shadow-sm p-1 rounded-full"><XCircle size={22}/></button>
            </div>
            <form onSubmit={handleGrade} className="p-6 space-y-4">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 mb-4">
                <p className="text-xs text-slate-500 font-semibold mb-1">Đang chấm cho:</p>
                <p className="font-bold text-slate-800">{gradingSubmission.studentId?.name}</p>
                <a href={gradingSubmission.submittedFileUrl} target="_blank" rel="noreferrer" className="text-xs font-bold text-blue-600 hover:underline mt-2 inline-flex items-center gap-0.5">
                  Xem bài làm
                  <NavArrow size={14} className="text-blue-600" />
                </a>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Điểm số (0-10) *</label>
                <input required type="number" min="0" max="10" step="0.5" className="w-full border-2 border-slate-200 focus:border-green-500 rounded-xl px-4 py-2.5 outline-none font-bold text-xl text-green-700" value={gradeData.grade} onChange={e => setGradeData({...gradeData, grade: e.target.value})}/>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Nhận xét / Chữa bài</label>
                <textarea className="w-full border-2 border-slate-200 focus:border-green-500 rounded-xl px-4 py-2.5 outline-none text-sm min-h-[80px]" value={gradeData.teacherFeedback} onChange={e => setGradeData({...gradeData, teacherFeedback: e.target.value})} placeholder="Tốt, nhưng cần chú ý hàm VLOOKUP..."></textarea>
              </div>
              <button disabled={isSubmitting} type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-green-200 mt-4 disabled:opacity-50">
                {isSubmitting ? 'Đang lưu...' : 'Hoàn tất Chấm'}
              </button>
            </form>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
};

export default TeacherAssignmentsView;
