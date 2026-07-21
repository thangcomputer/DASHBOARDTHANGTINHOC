import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { mutate } from 'swr';
import api from '../../../services/api';
import { parseQuestionBankExcel } from '../../../utils/studentQuestionsExcel';

/**
 * Teacher list, payout, approve/review, and teacher-tab UI state.
 */
export function useAdminTeachers({
  selectedBranchId,
  activeTab,
  toast,
  search = '',
  setDeleteModal,
  ctxApproveTeacher,
  ctxUpdateTeacher,
  addSystemLog,
  addQuestionsBulk,
  triggerBackgroundSync,
  getTeacherRating,
}) {
  const [teachers, setLocalTeachers] = useState([]);
  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [teacherForm, setTeacherForm] = useState({
    name: '', phone: '', specialty: '',
    startDate: new Date().toISOString().split('T')[0],
    address: '', branchId: '', branchCode: '',
  });
  const [editTeacher, setEditTeacher] = useState(null);
  const [grantModal, setGrantModal] = useState(null);
  const [approveModal, setApproveModal] = useState(null);
  const [reviewModal, setReviewModal] = useState(null);
  const [payoutModal, setPayoutModal] = useState(null);
  const [erGvSearch, setErGvSearch] = useState('');
  const [erGvForm, setErGvForm] = useState(null);
  const teacherQuestionsExcelInputRef = useRef(null);

  const BLANK_ER_GV = {
    type: 'teacher',
    teacherId: '', teacherName: '',
    subject: 'BÀI TEST GIẢNG VIÊN',
    multipleChoiceCorrect: '', multipleChoiceTotal: '',
    essayScore: '', essayNote: '',
    passed: false, date: new Date().toISOString().split('T')[0],
  };

  const fetchTeachers = useCallback(async () => {
    try {
      const params = selectedBranchId && selectedBranchId !== 'all'
        ? { branch_id: selectedBranchId } : {};
      const res = await api.teachers.getAll(params);
      if (res?.success) setLocalTeachers(res.data.map((t) => ({ ...t, id: t._id })));
    } catch { /* ignore */ }
  }, [selectedBranchId]);

  useEffect(() => {
    fetchTeachers();
  }, [fetchTeachers, activeTab]);

  const safeTeachersList = useMemo(() => (teachers || []).filter(Boolean), [teachers]);
  const safeTeachers = safeTeachersList;
  const filteredTeachers = safeTeachers.filter((t) =>
    (t.name || '').toLowerCase().includes((search || '').toLowerCase())
    || (t.phone || '').toLowerCase().includes((search || '').toLowerCase()),
  );

  const handlePayTeacher = async (teacher) => {
    const teacherId = String(teacher.id || teacher._id);
    const now = new Date();
    setPayoutModal({
      step: 1,
      isLoading: true,
      teacher,
      teacherId,
      teacherName: teacher.name,
      baseSalaryPerSession: teacher.baseSalaryPerSession || 0,
      pendingSessionsCount: 0,
      sessionsCount: '',
      amount: '',
      note: `Thù lao giảng dạy tháng ${now.getMonth() + 1}/${now.getFullYear()}`,
      bankInfo: teacher.bankAccount || {},
    });
    try {
      const res = await api.teachers.getPendingSessions(teacherId);
      if (res.success) {
        const { pendingSessionsCount, salaryPerSession, bankInfo } = res.data;
        const autoAmount = pendingSessionsCount * (salaryPerSession || teacher.baseSalaryPerSession || 0);
        setPayoutModal((prev) => (prev ? {
          ...prev,
          isLoading: false,
          pendingSessionsCount,
          baseSalaryPerSession: salaryPerSession || prev.baseSalaryPerSession,
          sessionsCount: String(pendingSessionsCount),
          amount: String(autoAmount),
          bankInfo: bankInfo || prev.bankInfo || {},
        } : null));
      } else {
        setPayoutModal((prev) => (prev ? { ...prev, isLoading: false } : null));
      }
    } catch {
      setPayoutModal((prev) => (prev ? { ...prev, isLoading: false } : null));
    }
  };

  const handleGoToQR = () => {
    if (!payoutModal?.sessionsCount || Number(payoutModal.sessionsCount) <= 0) {
      toast.error('Số buổi phải lớn hơn 0');
      return;
    }
    if (!payoutModal?.amount || Number(payoutModal.amount) <= 0) {
      toast.error('Số tiền phải lớn hơn 0');
      return;
    }
    setPayoutModal((prev) => ({ ...prev, step: 2 }));
  };

  const handlePayout = async () => {
    if (!payoutModal?.teacherId) return;
    const loadingId = toast.loading('Đang lưu giao dịch...');
    try {
      const res = await api.teachers.payFlexible(
        payoutModal.teacherId,
        Number(payoutModal.sessionsCount),
        Number(payoutModal.amount),
        payoutModal.note,
      );
      toast.dismiss(loadingId);
      if (res.success) {
        const { paidSessions, totalAmount } = res.data || {};
        toast.success(`Thanh toán ${paidSessions} buổi — ${Number(totalAmount).toLocaleString('vi-VN')}đ cho ${payoutModal.teacherName}`);
        setPayoutModal(null);
        mutate(['admin_finance', selectedBranchId]);
        triggerBackgroundSync?.();
      } else {
        toast.error(res.message || 'Thanh toán thất bại');
      }
    } catch (err) {
      toast.dismiss(loadingId);
      toast.error('Lỗi kết nối: ' + (err.message || 'Không rõ nguyên nhân'));
    }
  };

  const approveTeacher = async (id) => {
    await ctxApproveTeacher(id);
    const t = safeTeachersList.find((x) => String(x.id) === String(id));
    if (t) addSystemLog('Phê duyệt Giảng viên', t.name, 'Admin', 'bg-green-50 text-green-600');
    setApproveModal(null);
    fetchTeachers();
  };

  const markFileReviewed = async (id) => {
    try {
      await ctxUpdateTeacher(id, { practicalStatus: 'passed', status: 'active' });
      toast.success('Đã cập nhật: Giảng viên đủ điều kiện giảng dạy!');
      fetchTeachers();
    } catch {
      toast.error('Lỗi khi lưu trạng thái.');
    } finally {
      setReviewModal(null);
    }
  };

  const removeTeacher = (id) => {
    const t = safeTeachersList.find((x) => String(x.id) === String(id));
    setDeleteModal({ type: 'teacher', id, name: t?.name || 'Giảng viên' });
  };

  const handleTeacherQuestionsExcelFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const { questions: imported, errors, skipped } = parseQuestionBankExcel(evt.target.result);
        if (!imported.length) {
          toast.error(errors[0] || 'Không có câu hỏi hợp lệ trong file.');
          errors.slice(1, 5).forEach((m) => toast.error(m));
          return;
        }
        addQuestionsBulk(imported);
        toast.success(
          `Đã nhập ${imported.length} câu hỏi GV từ Excel.${skipped ? ` (${skipped} dòng trống đã bỏ qua)` : ''}`,
        );
        if (errors.length) {
          toast.error(`${errors.length} dòng lỗi: ${errors.slice(0, 2).join(' — ')}${errors.length > 2 ? '…' : ''}`);
        }
      } catch {
        toast.error('Không đọc được file. Dùng mẫu .xlsx Giảng viên và thử lại.');
      }
    };
    reader.readAsBinaryString(file);
  };

  return {
    teachers,
    fetchTeachers,
    safeTeachersList,
    safeTeachers,
    filteredTeachers,
    showTeacherModal,
    setShowTeacherModal,
    teacherForm,
    setTeacherForm,
    editTeacher,
    setEditTeacher,
    grantModal,
    setGrantModal,
    approveModal,
    setApproveModal,
    reviewModal,
    setReviewModal,
    payoutModal,
    setPayoutModal,
    handlePayTeacher,
    handleGoToQR,
    handlePayout,
    approveTeacher,
    markFileReviewed,
    removeTeacher,
    erGvSearch,
    setErGvSearch,
    erGvForm,
    setErGvForm,
    BLANK_ER_GV,
    getTeacherRating,
    teacherQuestionsExcelInputRef,
    handleTeacherQuestionsExcelFile,
  };
}