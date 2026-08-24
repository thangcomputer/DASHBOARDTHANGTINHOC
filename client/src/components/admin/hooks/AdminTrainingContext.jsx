import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useData } from '../../../context/DataContext';
import { useToast } from '../../../utils/toast.jsx';
import api from '../../../services/api';
import ConfirmDeleteTrainingModal from '../shared/ConfirmDeleteTrainingModal';

const AdminTrainingContext = createContext(null);

export function AdminTrainingProvider({ children, activeTab }) {
  const {
    trainingData, addTrainingItem, updateTrainingItem, removeTrainingItem,
    studentTrainingData, addStudentTrainingItem, updateStudentTrainingItem, removeStudentTrainingItem,
    questions, addQuestion, addQuestionsBulk, updateQuestion, removeQuestion, resetQuestions, replaceTeacherQuestionsForSubject,
    teacherExamTimeLimitMinutes, setTeacherExamTimeLimitMinutes,
    studentQuestions, addStudentQuestion, updateStudentQuestion, removeStudentQuestion, resetStudentQuestions,
    studentExamMinutes, updateStudentExamMinutes, studentExamFiles, setStudentExamFile,
    addExamResult, updateExamResult, examSubjectsCatalog,
  } = useData();
  
  const toast = useToast();

  const [trainingTab, setTrainingTab] = useState('videos');
  const [trainingForm, setTrainingForm] = useState(null);
  const [courseBuilderMode, setCourseBuilderMode] = useState(null);

  const BLANK_Q = {
    type: 'multiple', section: 'excel', q: '', options: ['', '', '', ''], correct: 0,
    difficulty: 'medium', sampleAnswer: '', imageUrl: '', imageName: '',
    attachedFileUrl: '', attachedFileName: '',
  };
  const [qSearch, setQSearch] = useState('');
  const [qSection, setQSection] = useState('coban');
  const [qDifficulty, setQDifficulty] = useState('all');
  const [qSort, setQSort] = useState('newest');
  const [qForm, setQForm] = useState(null);

  const [sqSearch, setSqSearch] = useState('');
  const [sqSection, setSqSection] = useState('coban');
  const [sqType, setSqType] = useState('all');
  const [sqForm, setSqForm] = useState(null);
  const [erSearch, setErSearch] = useState('');

  const [gradingRow, setGradingRow] = useState(null);
  const [gradingValue, setGradingValue] = useState('');
  const [erForm, setErForm] = useState(null);

  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const [sTrainingTab, setSTrainingTab] = useState('videos');
  const [sTrainingForm, setSTrainingForm] = useState(null);
  const [sCourseBuilderMode, setSCourseBuilderMode] = useState(null);

  const [trainingFileUploading, setTrainingFileUploading] = useState(false);
  const [sTrainingFileUploading, setSTrainingFileUploading] = useState(false);

  // Clear builders when navigating away
  useEffect(() => {
    if (activeTab !== 'student-training') setSCourseBuilderMode(null);
  }, [activeTab]);

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
      toast.error(err.message || 'Lỗi tải lên');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminTrainingContext.Provider value={{
      trainingData, addTrainingItem, updateTrainingItem, removeTrainingItem,
      studentTrainingData, addStudentTrainingItem, updateStudentTrainingItem, removeStudentTrainingItem,
      questions, addQuestion, addQuestionsBulk, updateQuestion, removeQuestion, resetQuestions, replaceTeacherQuestionsForSubject,
      teacherExamTimeLimitMinutes, setTeacherExamTimeLimitMinutes,
      studentQuestions, addStudentQuestion, updateStudentQuestion, removeStudentQuestion, resetStudentQuestions,
      studentExamMinutes, updateStudentExamMinutes, studentExamFiles, setStudentExamFile,
      addExamResult, updateExamResult, examSubjectsCatalog,
      
      trainingTab, setTrainingTab,
      trainingForm, setTrainingForm,
      courseBuilderMode, setCourseBuilderMode,

      BLANK_Q,
      qSearch, setQSearch, qSection, setQSection, qDifficulty, setQDifficulty, qSort, setQSort, qForm, setQForm,
      sqSearch, setSqSearch, sqSection, setSqSection, sqType, setSqType, sqForm, setSqForm, erSearch, setErSearch,
      gradingRow, setGradingRow, gradingValue, setGradingValue, erForm, setErForm,
 deleteConfirm, setDeleteConfirm,
      
      sTrainingTab, setSTrainingTab,
      sTrainingForm, setSTrainingForm,
      sCourseBuilderMode, setSCourseBuilderMode,
      
      trainingFileUploading, setTrainingFileUploading,
      sTrainingFileUploading, setSTrainingFileUploading,
      
      handleTrainingDocUpload
    }}>
      {children}
      {deleteConfirm && (
        <ConfirmDeleteTrainingModal
          item={deleteConfirm}
          onCancel={() => setDeleteConfirm(null)}
          onConfirm={() => {
            if (activeTab === 'student-training') {
              removeStudentTrainingItem(deleteConfirm.category, deleteConfirm.id);
            } else {
              removeTrainingItem(deleteConfirm.category, deleteConfirm.id);
            }
            setDeleteConfirm(null);
          }}
        />
      )}
    </AdminTrainingContext.Provider>
  );
}

export function useAdminTraining() {
  return useContext(AdminTrainingContext);
}
