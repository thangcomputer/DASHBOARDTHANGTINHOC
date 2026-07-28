import React, { useState, useMemo, useEffect, useRef } from 'react';
import { mutate } from 'swr';
import { Printer, Download } from 'lucide-react';
import { useData } from '../../../context/DataContext';
import { useSocket } from '../../../context/SocketContext';
import { useToast } from '../../../utils/toast.jsx';
import { useBranch } from '../../../context/BranchContext';
import { useModal } from '../../../utils/Modal.jsx';
import InvoiceTemplate from '../../InvoiceTemplate';
import exportPDF, { printInvoice } from '../../../utils/exportPDF';
import { exportToCSV } from '../../../utils/exportExcel';
import { parseQuestionBankExcel } from '../../../utils/studentQuestionsExcel';
import api from '../../../services/api';
import { EXAM_RESULTS_STUDENTS_FETCH_CAP } from './adminConstants';

const PAGE_SIZE = 10;

/**
 * Student list filters, pagination, CRUD, export, and student-tab UI state.
 */
export function useAdminStudents({ activeTab, setDeleteModal, sTrainingTabRef, sqSectionRef }) {
  const {
    students,
    addStudent: ctxAddStudent,
    removeStudent: ctxRemoveStudent,
    updateStudent: ctxUpdateStudent,
    assignTeacher: ctxAssignTeacher,
    approveStudentExam,
    revokeStudentExam,
    failStudentExam,
    replaceStudentQuestionsForSubject,
    studentsPagination,
    fetchStudentsPaginated,
  } = useData();

  const { socket } = useSocket();
  const toast = useToast();
  const { showModal: showGlobalModal, closeModal } = useModal();
  const { selectedBranchId } = useBranch();

  const [search, setSearch] = useState('');
  const [filterPaid, setFilterPaid] = useState('all');
  const [filterCourse, setFilterCourse] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [actionMenuId, setActionMenuId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showStudentDetailId, setShowStudentDetailId] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [enrollmentModalStudent, setEnrollmentModalStudent] = useState(null);
  const [editStudent, setEditStudent] = useState(null);
  const [exportingId, setExportingId] = useState(null);
  const [printStudent, setPrintStudent] = useState(null);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const studentQuestionsExcelInputRef = useRef(null);

  const safeStudentsList = useMemo(() => (students || []).filter(Boolean), [students]);
  const filteredStudents = safeStudentsList;

  useEffect(() => {
    if (activeTab === 'students') {
      fetchStudentsPaginated({
        page: currentPage, limit: PAGE_SIZE, search,
        paid: filterPaid, course: filterCourse, branch_id: selectedBranchId,
      });
    }
  }, [activeTab, currentPage, search, filterPaid, filterCourse, fetchStudentsPaginated, selectedBranchId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterPaid, filterCourse, selectedBranchId]);

  useEffect(() => {
    if (!actionMenuId) return;
    const handler = () => setActionMenuId(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [actionMenuId]);

  const lockStudentExam = async (student) => {
    const reason = 'Vi phạm quy chế phòng thi';
    try {
      await failStudentExam(
        student.id || student._id,
        `Admin đã khóa bài thi. Lý do: ${reason}`,
      );
      toast.success(`Đã đánh trượt ${student.name}. Học viên và Admin đã nhận thông báo.`);
    } catch (err) {
      toast.error(err?.message || 'Không khóa được phòng thi');
    }
  };

  const sendDebtReminder = (student) => {
    const message = `Chào ${student.name}, Trung tâm gửi lời nhắn nhắc bạn hoàn thiện học phí khóa ${student.course}. Trân trọng!`;
    const url = `https://zalo.me/${student.zalo}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const removeStudent = (id) => {
    const s = safeStudentsList.find((x) => String(x.id) === String(id));
    setDeleteModal({ type: 'student', id, name: s?.name || 'Học viên' });
  };

  const refreshStudentList = (page = currentPage) => {
    fetchStudentsPaginated({
      page, limit: PAGE_SIZE, search,
      paid: filterPaid, course: filterCourse, branch_id: selectedBranchId,
    });
  };

  const addStudent = async (student) => {
    try {
      await ctxAddStudent({
        name: student.name,
        age: student.age,
        phone: student.phone,
        zalo: student.zalo,
        courseId: student.courseId,
        course: student.course,
        price: student.price,
        totalSessions: Number(student.totalSessions) > 0 ? Number(student.totalSessions) : 12,
        paid: student.paid,
        learningMode: student.learningMode,
        teacherId: student.teacherId,
        branchId: student.branchId,
      });
      toast.success('Đã thêm học viên thành công!');

      if (student.paid) {
        showGlobalModal({
          title: 'HÓA ĐƠN THU HỌC PHÍ',
          content: (
            <div className="flex flex-col items-center bg-gray-100 p-6 rounded-2xl w-full overflow-hidden">
              <div className="w-full flex justify-center overflow-hidden py-2">
                <div
                  className="shadow-2xl overflow-hidden flex-shrink-0 mx-auto"
                  style={{ width: '168mm', height: '118.4mm' }}
                >
                  <div style={{ transform: 'scale(0.8)', transformOrigin: 'top left', width: '210mm', height: '148mm' }}>
                    <InvoiceTemplate data={{
                      studentName: student.name,
                      courseName: student.course,
                      tuitionFee: student.price,
                      date: new Date(),
                      isPaid: true,
                    }} />
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap justify-center gap-3 mt-6 w-full max-w-lg relative z-20">
                <button
                  type="button"
                  onClick={() => printInvoice()}
                  className="flex-1 min-w-[120px] py-3.5 bg-red-600 text-white font-bold rounded-xl shadow-lg hover:bg-red-700 transform hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
                >
                  <Printer size={18} /> IN (PRINT)
                </button>
                <button
                  type="button"
                  onClick={() => exportPDF({ studentName: student.name })}
                  className="flex-1 min-w-[120px] py-3.5 bg-emerald-600 text-white font-bold rounded-xl shadow-lg hover:bg-emerald-700 transform hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
                >
                  <Download size={18} /> TẢI PDF
                </button>
                <button
                  type="button"
                  onClick={() => closeModal()}
                  className="flex-1 min-w-[120px] py-3.5 bg-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-300 transition-all"
                >
                  ĐÓNG
                </button>
              </div>
            </div>
          ),
          type: 'info',
          confirmText: null,
          size: '3xl',
          onConfirm: () => {},
        });
      }

      mutate(['admin_stats', selectedBranchId]);
      mutate(['admin_finance', selectedBranchId]);
      refreshStudentList(1);
      setCurrentPage(1);
    } catch (err) {
      toast.error('Lỗi thêm học viên: ' + (err.message || 'Không xác định'));
    }
  };

  const assignTeacher = (studentId, teacherId, enrollmentId) => {
    return ctxAssignTeacher(studentId, teacherId, enrollmentId);
  };

  const addEnrollment = async (student, payload) => {
    const sid = student.id || student._id;
    if (!sid) {
      toast.error('Không xác định được học viên');
      return false;
    }
    const tid = toast.loading(`Đang thêm khóa cho ${student.name}...`);
    try {
      const res = await api.students.addEnrollment(sid, payload);
      toast.dismiss(tid);
      if (res?.success) {
        toast.success(res.message || 'Đã thêm khóa học');
        refreshStudentList();
        return true;
      }
      toast.error(res?.message || 'Không thể thêm khóa học');
      return false;
    } catch {
      toast.dismiss(tid);
      toast.error('Lỗi kết nối API');
      return false;
    }
  };

  const handlePayTeacherForStudent = async (student, action) => {
    const isPack = action === 'PAID_IN_ADVANCE';
    const actionText = isPack
      ? 'thanh toán TRỌN GÓI lương Giảng viên'
      : 'thanh toán các buổi CHƯA TRẢ LƯƠNG (cộng dồn)';
    showGlobalModal({
      title: 'Xác nhận thanh toán lương',
      content: `Xác nhận ${actionText} cho môn của học viên ${student.name}?\n\nChú ý: Hành động này sẽ thay đổi trạng thái nhận lương của giảng viên.`,
      type: 'question',
      confirmText: 'Xác nhận',
      cancelText: 'Quay lại',
      onConfirm: async () => {
        const tid = toast.loading(`Đang xử lý thanh toán GV cho ${student.name}...`);
        try {
          const res = await api.students.payTeacher(student.id || student._id, action).catch((e) => e);
          toast.dismiss(tid);
          if (res && res.success) {
            toast.success(res.message || 'Cập nhật thành công');
            refreshStudentList();
          } else {
            toast.error('Lỗi: ' + (res?.message || 'Không xác định'));
          }
        } catch {
          toast.dismiss(tid);
          toast.error('Lỗi kết nối API');
        }
      },
    });
  };

  const handlePrintInvoice = async (student) => {
    setExportingId(student.id);
    setPrintStudent(student);
    const tid = toast.loading(`Đang tạo hóa đơn cho ${student.name}...`);
    try {
      await new Promise((r) => setTimeout(r, 600));
      await exportPDF({ studentName: student.name });
      toast.dismiss(tid);
      toast.success('Xuất hóa đơn thành công!');
    } catch {
      toast.dismiss(tid);
      toast.error('Xuất hóa đơn thất bại. Vui lòng thử lại.');
    } finally {
      setExportingId(null);
    }
  };

  const handleExportExcel = async () => {
    setIsExportingExcel(true);
    const tid = toast.loading('Đang xuất dữ liệu học viên sang Excel(CSV)...');
    try {
      const dataToExport = filteredStudents.map((s) => ({
        'Họ Tên': s.name,
        'Khóa học': s.course,
        'Tuổi': s.age || '',
        'SĐT': s.phone || '',
        'Zalo': s.zalo || '',
        'Học phí': s.price,
        'Trạng thái': s.paid ? 'Đã thanh toán' : 'Chưa thanh toán',
      }));
      exportToCSV(dataToExport, `DanhSachHocVien_${Date.now()}.csv`);
      toast.dismiss(tid);
      toast.success('Xuất Excel thành công!');
    } catch (e) {
      toast.dismiss(tid);
      toast.error('Xuất Excel thất bại: ' + (e.message || 'Lỗi không xác định'));
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleStudentQuestionsExcelFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const subjectId = sqSectionRef?.current;
    if (!subjectId || subjectId === 'all') {
      toast.error('Chọn môn thi trước khi nhập Excel (không chọn "Tất cả môn").');
      return;
    }
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const { questions, errors, skipped } = await parseQuestionBankExcel(evt.target.result);
        if (!questions.length) {
          toast.error(errors[0] || 'Không có câu hỏi hợp lệ trong file.');
          errors.slice(1, 5).forEach((m) => toast.error(m));
          return;
        }
        const normalized = questions.map((q) => ({ ...q, section: subjectId }));
        replaceStudentQuestionsForSubject(subjectId, normalized);
        toast.success(
          `Đã nhập ${normalized.length} câu cho môn đã chọn (thay thế câu cũ cùng môn).${skipped ? ` (${skipped} dòng trống)` : ''}`,
        );
        if (errors.length) {
          toast.error(`${errors.length} dòng lỗi: ${errors.slice(0, 2).join(' — ')}${errors.length > 2 ? '…' : ''}`);
        }
      } catch {
        toast.error('Không đọc được file. Dùng mẫu .xlsx và thử lại.');
      }
    };
    reader.readAsBinaryString(file);
  };

  /** Refresh list used by socket / exam-results / confirmDelete */
  const refreshStudentsForTab = () => {
    if (activeTab === 'student-training' && sTrainingTabRef?.current === 'exam-results') {
      fetchStudentsPaginated({
        page: 1,
        limit: EXAM_RESULTS_STUDENTS_FETCH_CAP,
        search: '',
        branch_id: selectedBranchId,
      });
    } else if (activeTab === 'students') {
      refreshStudentList();
    }
  };

  return {
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
    enrollmentModalStudent, setEnrollmentModalStudent,
    editStudent, setEditStudent,
    printStudent,
    exportingId,
    isExportingExcel,
    expandedId, setExpandedId,
    lockStudentExam,
    sendDebtReminder,
    removeStudent,
    addStudent,
    assignTeacher,
    addEnrollment,
    handlePayTeacherForStudent,
    handlePrintInvoice,
    handleExportExcel,
    handleStudentQuestionsExcelFile,
    studentQuestionsExcelInputRef,
    approveStudentExam,
    revokeStudentExam,
    ctxUpdateStudent,
    refreshStudentsForTab,
    refreshStudentList,
  };
}
