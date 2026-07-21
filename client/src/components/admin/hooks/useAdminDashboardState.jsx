import { useState, useEffect, useRef } from 'react';
import useSWR, { mutate } from 'swr';
import { useData } from '../../../context/DataContext';
import { useSocket } from '../../../context/SocketContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { useToast } from '../../../utils/toast.jsx';
import { useBranch } from '../../../context/BranchContext';
import { useModal } from '../../../utils/Modal.jsx';
import api from '../../../services/api';
import { useAdminStudents } from './useAdminStudents';
import { useAdminTeachers } from './useAdminTeachers';
import { EXAM_RESULTS_STUDENTS_FETCH_CAP } from './adminConstants';

export { EXAM_RESULTS_STUDENTS_FETCH_CAP };

/**
 * State + handlers for AdminDashboard.
 * Composes useAdminStudents and useAdminTeachers with shared finance/logs/training state.
 */
export function useAdminDashboardState() {
  const {
    teachers: globalTeachers,
    addTeacher: ctxAddTeacher,
    removeTeacher: ctxRemoveTeacher,
    updateTeacher: ctxUpdateTeacher,
    approveTeacher: ctxApproveTeacher,
    removeStudent: ctxRemoveStudent,
    markStudentPaid,
    transactions,
    getTeacherRating,
    getPrivateEvaluationsForAdmin,
    markEvaluationRead,
    addNotification,
    addSystemLog,
    trainingData,
    addTrainingItem,
    updateTrainingItem,
    removeTrainingItem,
    studentTrainingData,
    addStudentTrainingItem,
    updateStudentTrainingItem,
    removeStudentTrainingItem,
    questions,
    addQuestion,
    addQuestionsBulk,
    updateQuestion,
    removeQuestion,
    resetQuestions,
    teacherExamTimeLimitMinutes,
    setTeacherExamTimeLimitMinutes,
    studentQuestions,
    addStudentQuestion,
    updateStudentQuestion,
    removeStudentQuestion,
    resetStudentQuestions,
    studentExamMinutes,
    updateStudentExamMinutes,
    grantPending,
    triggerBackgroundSync,
    addExamResult,
    updateExamResult,
  } = useData();

  const { socket } = useSocket();
  const toast = useToast();
  const { showModal: showGlobalModal } = useModal();
  const { selectedBranchId, branches } = useBranch();
  const safeBranches = (branches || []).filter(Boolean);

  const _sess = JSON.parse(localStorage.getItem('admin_user') || localStorage.getItem('staff_user') || '{}');
  const isSuperAdmin = _sess?.id === 'admin' || _sess?.adminRole === 'SUPER_ADMIN';

  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = location.hash?.replace('#', '') || 'dashboard';

  const [deleteModal, setDeleteModal] = useState(null);
  const [resetPwModal, setResetPwModal] = useState(null);
  const sTrainingTabRef = useRef('videos');

  const studentsApi = useAdminStudents({ activeTab, setDeleteModal, sTrainingTabRef });
  const teachersApi = useAdminTeachers({
    selectedBranchId,
    activeTab,
    toast,
    search: studentsApi.search,
    setDeleteModal,
    ctxApproveTeacher,
    ctxUpdateTeacher,
    addSystemLog,
    addQuestionsBulk,
    triggerBackgroundSync,
    getTeacherRating,
  });

  const {
    students,
    studentsPagination,
    fetchStudentsPaginated,
    safeStudentsList,
    filteredStudents,
    search, setSearch,
    filterPaid, setFilterPaid,
    filterCourse, setFilterCourse,
    currentPage, setCurrentPage,
    PAGE_SIZE,
    actionMenuId, setActionMenuId,
    showModal, setShowModal,
    showStudentDetailId, setShowStudentDetailId,
    showImportModal, setShowImportModal,
    editStudent, setEditStudent,
    printStudent,
    isExportingExcel,
    sendDebtReminder,
    removeStudent,
    addStudent,
    assignTeacher,
    handlePrintInvoice,
    handleExportExcel,
    handleStudentQuestionsExcelFile,
    studentQuestionsExcelInputRef,
    approveStudentExam,
    revokeStudentExam,
    ctxUpdateStudent,
    refreshStudentsForTab,
    refreshStudentList,
  } = studentsApi;

  const {
    teachers,
    fetchTeachers,
    safeTeachersList,
    safeTeachers,
    filteredTeachers,
    showTeacherModal, setShowTeacherModal,
    teacherForm, setTeacherForm,
    editTeacher, setEditTeacher,
    grantModal, setGrantModal,
    approveModal, setApproveModal,
    reviewModal, setReviewModal,
    payoutModal, setPayoutModal,
    handlePayTeacher,
    handleGoToQR,
    handlePayout,
    approveTeacher,
    markFileReviewed,
    removeTeacher,
    erGvSearch, setErGvSearch,
    erGvForm, setErGvForm,
    BLANK_ER_GV,
    teacherQuestionsExcelInputRef,
    handleTeacherQuestionsExcelFile,
  } = teachersApi;

  // Branch-aware stats (dashboard tab only)
  const statsFetcher = async ([, branch_id]) => {
    const params = branch_id && branch_id !== 'all' ? { branch_id } : {};
    const res = await api.students.getStats(params);
    return res?.success ? res.data : null;
  };

  const { data: branchStats } = useSWR(
    activeTab === 'dashboard' ? ['admin_stats', selectedBranchId] : null,
    statsFetcher,
    { refreshInterval: 5000, revalidateOnFocus: true },
  );

  useEffect(() => {
    triggerBackgroundSync();
  }, [activeTab, triggerBackgroundSync]);

  // System logs from DB
  const [dbLogs, setDbLogs] = useState([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  useEffect(() => {
    if (activeTab === 'logs') {
      setIsLoadingLogs(true);
      api.systemLogs.getAll(1, 100)
        .then((res) => setDbLogs(res.data))
        .catch(() => {})
        .finally(() => setIsLoadingLogs(false));
    }
  }, [activeTab]);

  // Finance from server
  const financeFetcher = async ([, branch_id]) => {
    const params = branch_id && branch_id !== 'all' ? { branch_id } : {};
    const [resTx, resSt] = await Promise.all([
      api.transactions.getAll(params),
      api.students.getAll(`?${new URLSearchParams(params).toString()}`),
    ]);
    return {
      financialData: resTx?.success ? (resTx.data || []) : [],
      financeStudents: resSt?.success ? (resSt.data || []) : [],
    };
  };

  const { data: financeRes, isValidating: isLoadingFinance } = useSWR(
    activeTab === 'finance' ? ['admin_finance', selectedBranchId] : null,
    financeFetcher,
    { refreshInterval: 5000, revalidateOnFocus: true },
  );

  const financialData = financeRes?.financialData || [];
  const financeStudents = financeRes?.financeStudents || [];

  // Socket: refresh dashboard views when server data changes
  const adminBumpTimerRef = useRef(null);
  useEffect(() => {
    if (!socket) return;

    const runBump = () => {
      mutate(['admin_stats', selectedBranchId]);
      mutate(['admin_finance', selectedBranchId]);
      refreshStudentsForTab();
      if (activeTab === 'logs') {
        setIsLoadingLogs(true);
        api.systemLogs.getAll(1, 100)
          .then((res) => setDbLogs(res.data))
          .catch(() => {})
          .finally(() => setIsLoadingLogs(false));
      }
      if (activeTab === 'teachers') {
        fetchTeachers();
      }
    };

    const bumpAdminViews = () => {
      if (adminBumpTimerRef.current) clearTimeout(adminBumpTimerRef.current);
      adminBumpTimerRef.current = setTimeout(() => {
        adminBumpTimerRef.current = null;
        runBump();
      }, 350);
    };

    const onStudentNew = (data) => {
      toast.success(`📋 Học viên mới: ${data?.name || 'N/A'} — ${data?.course || ''}`);
      bumpAdminViews();
    };

    const adminRealtimeEvents = [
      'data:refresh', 'student:updated', 'student:assigned', 'student:history_reset',
      'schedule:new', 'schedule:updated', 'schedule:completed', 'schedule:cancelled',
      'transactions:new', 'teacher:financeUpdated', 'tuition:paid', 'revenue:updated',
      'teacher:scored', 'teacher:approved', 'teacher:practical_submitted', 'teacher:rejected', 'teacher:new',
      'assignment:new', 'assignment:graded', 'assignment:submitted', 'assignment:updated', 'assignment:deleted',
      'submission:new', 'submission:graded',
      'exam:unlocked', 'teacher:updated',
      'evaluation:admin_feedback', 'evaluation:teacher_rating',
      'new-notification',
    ];

    socket.on('student:new', onStudentNew);
    adminRealtimeEvents.forEach((ev) => socket.on(ev, bumpAdminViews));

    return () => {
      if (adminBumpTimerRef.current) clearTimeout(adminBumpTimerRef.current);
      socket.off('student:new', onStudentNew);
      adminRealtimeEvents.forEach((ev) => socket.off(ev, bumpAdminViews));
    };
  }, [
    socket,
    activeTab,
    selectedBranchId,
    refreshStudentsForTab,
    fetchTeachers,
    toast,
  ]);

  const handleOpenResetPw = (id, name, role) => {
    setResetPwModal({ id, name, role });
  };

  useEffect(() => {
    const handleResetEvent = (e) => {
      const { userId, userName, role } = e.detail || {};
      if (userId && role) {
        handleOpenResetPw(userId, userName || 'Người dùng', role);
      }
    };
    window.addEventListener('open-reset-pw', handleResetEvent);
    return () => window.removeEventListener('open-reset-pw', handleResetEvent);
  }, []);

  // Training management state
  const [trainingTab, setTrainingTab] = useState('videos');
  const [trainingForm, setTrainingForm] = useState(null);
  const [courseBuilderMode, setCourseBuilderMode] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Student training management state
  const [sTrainingTab, setSTrainingTab] = useState('videos');
  useEffect(() => {
    sTrainingTabRef.current = sTrainingTab;
  }, [sTrainingTab]);

  useEffect(() => {
    if (activeTab !== 'student-training' || sTrainingTab !== 'exam-results') return;
    fetchStudentsPaginated({
      page: 1,
      limit: EXAM_RESULTS_STUDENTS_FETCH_CAP,
      search: '',
      branch_id: selectedBranchId,
    });
  }, [activeTab, sTrainingTab, selectedBranchId, fetchStudentsPaginated]);

  const [sTrainingForm, setSTrainingForm] = useState(null);
  const [sCourseBuilderMode, setSCourseBuilderMode] = useState(null);
  useEffect(() => {
    if (activeTab !== 'student-training') setSCourseBuilderMode(null);
  }, [activeTab]);

  const [trainingFileUploading, setTrainingFileUploading] = useState(false);
  const [sTrainingFileUploading, setSTrainingFileUploading] = useState(false);

  const formatTrainingFileSize = (bytes) => {
    if (bytes == null || Number.isNaN(bytes)) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const extToTrainingFileType = (fileName) => {
    const ext = (fileName.split('.').pop() || '').toUpperCase();
    const map = {
      PDF: 'PDF', DOC: 'DOCX', DOCX: 'DOCX', XLS: 'XLSX', XLSX: 'XLSX',
      PPT: 'PPTX', PPTX: 'PPTX', ZIP: 'ZIP', RAR: 'ZIP',
    };
    return map[ext] || (ext.length <= 5 ? ext : 'FILE');
  };

  const handleTrainingDocUpload = async (e, which) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const setForm = which === 'teacher' ? setTrainingForm : setSTrainingForm;
    const setBusy = which === 'teacher' ? setTrainingFileUploading : setSTrainingFileUploading;
    setBusy(true);
    try {
      const data = await api.settings.uploadTrainingFile(file);
      if (!data.success) throw new Error(data.message || 'Upload thất bại');
      setForm((prev) => ({
        ...prev,
        fileUrl: data.fileUrl,
        fileType: extToTrainingFileType(file.name),
        fileSize: formatTrainingFileSize(file.size),
        fileOriginalName: file.name,
      }));
      toast.success('Đã tải tài liệu lên');
    } catch (err) {
      toast.error(err.message || 'Không tải được file');
    } finally {
      setBusy(false);
    }
  };

  // Teacher question bank filters
  const BLANK_Q = { type: 'multiple', section: 'excel', q: '', options: ['', '', '', ''], correct: 0, difficulty: 'medium', sampleAnswer: '' };
  const [qSearch, setQSearch] = useState('');
  const [qSection, setQSection] = useState('all');
  const [qDifficulty, setQDifficulty] = useState('all');
  const [qSort, setQSort] = useState('newest');
  const [qForm, setQForm] = useState(null);

  // Student question bank / exam results UI
  const [sqSearch, setSqSearch] = useState('');
  const [sqSection, setSqSection] = useState('all');
  const [sqForm, setSqForm] = useState(null);
  const [erSearch, setErSearch] = useState('');
  const [gradingRow, setGradingRow] = useState(null);
  const [gradingValue, setGradingValue] = useState('');
  const [erForm, setErForm] = useState(null);

  const confirmDelete = async () => {
    if (!deleteModal) return;
    try {
      if (deleteModal.type === 'teacher') {
        await ctxRemoveTeacher(deleteModal.id);
        addSystemLog('Xoá bản ghi', `Giảng viên - ${deleteModal.name}`, 'Admin', 'bg-red-50 text-red-600');
        toast.success(`Đã xoá giảng viên ${deleteModal.name}`);
        fetchTeachers();
      } else {
        await ctxRemoveStudent(deleteModal.id);
        addSystemLog('Xoá bản ghi', `Học viên - ${deleteModal.name}`, 'Admin', 'bg-red-50 text-red-600');
        toast.success(`Đã xoá học viên ${deleteModal.name}`);
        mutate(['admin_stats', selectedBranchId]);
        mutate(['admin_finance', selectedBranchId]);
        refreshStudentList();
      }
    } catch (err) {
      toast.error('Lỗi xoá: ' + (err.message || 'Không xác định'));
    }
    setDeleteModal(null);
  };

  // Stats cards: prefer branch API, fallback to local lists
  const statTotalStudents = branchStats?.total ?? filteredStudents.length;
  const statPaidStudents = branchStats?.paid ?? filteredStudents.filter((s) => s.paid).length;
  const statActiveTeachers = branchStats?.activeTeachers
    ?? safeTeachers.filter((t) => t.status === 'Active' || t.status === 'active').length;
  const statTotalTeachers = branchStats?.activeTeachers != null
    ? branchStats.activeTeachers
    : safeTeachers.length;
  const statTotalRevenue = branchStats?.totalRevenue
    ?? filteredStudents.filter((s) => s.paid).reduce((sum, s) => sum + (s.price || 0), 0);
  const statPendingTeachers = branchStats?.pendingTeachers
    ?? safeTeachers.filter((t) => t.status === 'Pending').length;

  const adminTabValue = {
    search, setSearch, filterCourse, setFilterCourse, filterPaid, setFilterPaid,
    handleExportExcel, isExportingExcel, setShowImportModal, setShowModal,
    studentsPagination, filteredStudents, safeTeachers, safeBranches,
    assignTeacher, actionMenuId, setActionMenuId, setShowStudentDetailId, setEditStudent,
    sendDebtReminder, approveStudentExam, revokeStudentExam, ctxUpdateStudent, toast,
    handlePrintInvoice, removeStudent, currentPage, setCurrentPage,
    teachers, filteredTeachers, isSuperAdmin, setShowTeacherModal, getTeacherRating,
    setReviewModal, setGrantModal, setApproveModal, setEditTeacher, handlePayTeacher,
    removeTeacher, approveTeacher, fetchTeachers, reviewModal, approveModal, markFileReviewed,
    courseBuilderMode, setCourseBuilderMode, trainingData, updateTrainingItem, trainingTab, setTrainingTab,
    trainingForm, setTrainingForm, questions, setErGvForm, BLANK_ER_GV, trainingFileUploading,
    handleTrainingDocUpload, teacherQuestionsExcelInputRef, handleTeacherQuestionsExcelFile,
    addTrainingItem, showGlobalModal, erGvSearch, setErGvSearch, erGvForm, ctxUpdateTeacher,
    qSearch, setQSearch, qSection, setQSection, qDifficulty, setQDifficulty, qSort, qForm, setQForm,
    BLANK_Q, addQuestion, updateQuestion, removeQuestion, resetQuestions,
    setTeacherExamTimeLimitMinutes, teacherExamTimeLimitMinutes, setDeleteConfirm, safeTeachersList,
    getPrivateEvaluationsForAdmin, markEvaluationRead,
    transactions, addSystemLog, financeStudents, isLoadingFinance, markStudentPaid, financialData,
    isLoadingLogs, setIsLoadingLogs, dbLogs, setDbLogs,
    sCourseBuilderMode, setSCourseBuilderMode, updateStudentTrainingItem,
    studentTrainingData, sTrainingTab, setSTrainingTab, setSTrainingForm,
    students, studentQuestions, studentExamMinutes, updateStudentExamMinutes,
    resetStudentQuestions, setSqForm, studentQuestionsExcelInputRef, handleStudentQuestionsExcelFile,
    sTrainingForm, sTrainingFileUploading, addStudentTrainingItem,
    erSearch, setErSearch, gradingRow, setGradingRow, gradingValue, setGradingValue,
    addNotification, sqSection, setSqSection, sqSearch, setSqSearch, removeStudentQuestion,
    removeStudentTrainingItem, sqForm, updateStudentQuestion, addStudentQuestion,
    erForm, setErForm, safeStudentsList, updateExamResult, addExamResult,
  };

  return {
    activeTab,
    navigate,
    statTotalStudents,
    statPaidStudents,
    statTotalTeachers,
    statActiveTeachers,
    statTotalRevenue,
    statPendingTeachers,
    filteredStudents,
    safeTeachers,
    adminTabValue,
    deleteConfirm,
    setDeleteConfirm,
    removeTrainingItem,
    showModal,
    setShowModal,
    teachers,
    addStudent,
    payoutModal,
    setPayoutModal,
    handleGoToQR,
    handlePayout,
    printStudent,
    showTeacherModal,
    setShowTeacherModal,
    teacherForm,
    setTeacherForm,
    isSuperAdmin,
    safeBranches,
    ctxAddTeacher,
    toast,
    fetchTeachers,
    editTeacher,
    setEditTeacher,
    handleOpenResetPw,
    ctxUpdateTeacher,
    editStudent,
    setEditStudent,
    globalTeachers,
    ctxUpdateStudent,
    selectedBranchId,
    currentPage,
    PAGE_SIZE,
    search,
    filterPaid,
    filterCourse,
    fetchStudentsPaginated,
    grantModal,
    setGrantModal,
    grantPending,
    deleteModal,
    setDeleteModal,
    confirmDelete,
    showStudentDetailId,
    setShowStudentDetailId,
    showImportModal,
    setShowImportModal,
    resetPwModal,
    setResetPwModal,
  };
}
