import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { loadState, applyDataVersionReset } from './dataStorage';
import { useDataTraining } from './useDataTraining';
import { useDataMessaging } from './useDataMessaging';
import { useDataNotifications } from './useDataNotifications';
import { useDataSchedule } from './useDataSchedule';
import { useDataAdminCrud } from './useDataAdminCrud';
import { useDataMaterials } from './useDataMaterials';
import { useDataRatings } from './useDataRatings';
import { useDataEvaluations } from './useDataEvaluations';
import { useDataSync } from './useDataSync';

export { buildConversationId } from '../utils/chatConversationId';

const INITIAL_STUDENTS = [];
const INITIAL_TEACHERS = [];
const INITIAL_TRANSACTIONS = [];

const DataContext = createContext(null);

export const DataProvider = ({ children, user, onLogout }) => {
  const [currentUser, setCurrentUser] = useState(user || null);
  const triggerBackgroundSyncRef = useRef(async () => {});
  const triggerBackgroundSyncProxy = useCallback((...args) => triggerBackgroundSyncRef.current(...args), []);

  const setGroupsRef = useRef(null);
  const setSchedulesRef = useRef(() => {});
  const setExamResultsRef = useRef(() => {});

  useEffect(() => {
    applyDataVersionReset();
  }, []);

  useEffect(() => {
    setCurrentUser(user);
    if (user) triggerBackgroundSyncRef.current();
  }, [user]);

  useEffect(() => {
    const savedUser = localStorage.getItem('thvp_user');
    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch (e) {
      }
    }
  }, []);

  const [students, setStudents] = useState(() => loadState('thvp_students', INITIAL_STUDENTS));
  const [teachers, setTeachers] = useState(() => loadState('thvp_teachers', INITIAL_TEACHERS));
  const [transactions, setTransactions] = useState(() => loadState('thvp_transactions', INITIAL_TRANSACTIONS));
  const [staffs, setStaffs] = useState(() => loadState('thvp_staffs', []));

  useEffect(() => {
    const stripNulls = (setter) => setter((prev) => {
      if (!Array.isArray(prev)) return prev;
      const next = prev.filter(Boolean);
      return next.length === prev.length ? prev : next;
    });
    stripNulls(setStudents);
    stripNulls(setTeachers);
    stripNulls(setStaffs);
  }, []);

  useEffect(() => { localStorage.setItem('thvp_students', JSON.stringify(students)); }, [students]);
  useEffect(() => { localStorage.setItem('thvp_teachers', JSON.stringify(teachers)); }, [teachers]);
  useEffect(() => { localStorage.setItem('thvp_transactions', JSON.stringify(transactions)); }, [transactions]);
  useEffect(() => { localStorage.setItem('thvp_staffs', JSON.stringify(staffs)); }, [staffs]);

  const {
    trainingData, setTrainingData,
    studentTrainingData, setStudentTrainingData,
    questions, setQuestions,
    teacherExamTimeLimitMinutes, setTeacherExamTimeLimitMinutes,
    studentQuestions, setStudentQuestions,
    studentExamMinutes, updateStudentExamMinutes,
    applyStudentExamConfigFromServer,
    addStudentTrainingItem, updateStudentTrainingItem, removeStudentTrainingItem,
    addTrainingItem, updateTrainingItem, removeTrainingItem,
    addQuestion, addQuestionsBulk, updateQuestion, removeQuestion, resetQuestions,
    addStudentQuestion, addStudentQuestionsBulk, updateStudentQuestion,
    removeStudentQuestion, resetStudentQuestions, copyTeacherQuestionBankToStudents,
  } = useDataTraining(currentUser);

  const {
    socketNotifications,
    addNotification, markNotificationRead, dismissNotificationLocal, getNotifications,
  } = useDataNotifications({ currentUser });

  const {
    privateEvaluations, setPrivateEvaluations,
    submitPrivateEvaluation, getPrivateEvaluationsForAdmin, markEvaluationRead,
  } = useDataEvaluations({
    students, teachers,
    triggerBackgroundSync: triggerBackgroundSyncProxy,
    addNotification,
  });

  const {
    materials, addMaterial, removeMaterial, getMaterialsByCourse, getMaterialsByCategory,
  } = useDataMaterials({ students, addNotification });

  const {
    RATING_CRITERIA, rateTeacher, getTeacherRating,
  } = useDataRatings({
    students, teachers, setTeachers,
    triggerBackgroundSync: triggerBackgroundSyncProxy,
    addNotification,
  });

  const {
    isRefetching, studentsPagination, fetchStudentsPaginated,
    triggerBackgroundSync, systemLogs, addSystemLog,
  } = useDataSync({
    currentUser, onLogout,
    setStudents, setTeachers, setTransactions, setStaffs,
    setSchedulesRef, setExamResultsRef, setGroupsRef,
    setTrainingData, setStudentTrainingData, setQuestions, setTeacherExamTimeLimitMinutes,
    applyStudentExamConfigFromServer,
    setPrivateEvaluations,
  });
  triggerBackgroundSyncRef.current = triggerBackgroundSync;

  const {
    messages, setMessages, groups, setGroups,
    sendMessage, syncMessages, toggleMessageReaction, recallMessage,
    softDeleteMessage, createChatGroup, deleteChatGroup,
    markMessagesRead, getConversations, getMessages,
  } = useDataMessaging({ currentUser, students, teachers, staffs, triggerBackgroundSync });
  setGroupsRef.current = setGroups;

  const {
    schedules, setSchedules,
    addSchedule, updateSchedule, cancelSchedule,
    markAttendance, getSchedulesByTeacher, getSchedulesByStudent,
  } = useDataSchedule({ students, teachers, setStudents, triggerBackgroundSync, addNotification });
  setSchedulesRef.current = setSchedules;

  const {
    examResults, setExamResults,
    addStudent, addTeacher, grantPending, removeTeacher, updateTeacher, updateStudent,
    assignTeacher, approveTeacher, rejectTeacher, payTeacher, removeStudent, markStudentPaid,
    updateStudentLink, updateStudentSchedule, submitTestResult, submitPracticalFile,
    approveStudentExam, revokeStudentExam, saveExamResult,
    addExamResult, updateExamResult, removeExamResult,
    getStudentsByTeacher, getTeacherStats, getAdminStats, getTransactionsByTeacher,
  } = useDataAdminCrud({
    students, setStudents, teachers, setTeachers, transactions, setTransactions,
    triggerBackgroundSync, addNotification,
    fetchStudentsPaginated, studentsPagination, currentUser,
  });
  setExamResultsRef.current = setExamResults;

  const value = useMemo(() => ({
    examResults, addExamResult, updateExamResult, removeExamResult,
    students, teachers, staffs, transactions, schedules, notifications: socketNotifications, messages, materials,
    currentUser, setCurrentUser,

    addStudent, addTeacher, removeTeacher, updateTeacher, updateStudent, assignTeacher, approveTeacher, rejectTeacher, payTeacher, removeStudent, grantPending,
    markStudentPaid,
    getAdminStats,
    studentsPagination, fetchStudentsPaginated,

    markAttendance, updateStudentLink, updateStudentSchedule,
    submitTestResult, submitPracticalFile,
    getStudentsByTeacher, getTeacherStats, getSchedulesByTeacher, getTransactionsByTeacher,

    getSchedulesByStudent,

    approveStudentExam, revokeStudentExam, saveExamResult,

    sendMessage, syncMessages, markMessagesRead, getConversations, getMessages,
    groups, recallMessage, softDeleteMessage, createChatGroup, deleteChatGroup,

    addNotification, markNotificationRead, dismissNotificationLocal, getNotifications,

    addSchedule, updateSchedule, cancelSchedule,

    addMaterial, removeMaterial, getMaterialsByCourse, getMaterialsByCategory,

    rateTeacher, getTeacherRating, RATING_CRITERIA,

    submitPrivateEvaluation, getPrivateEvaluationsForAdmin, markEvaluationRead, privateEvaluations,

    trainingData,
    studentTrainingData,
    addStudentTrainingItem,
    updateStudentTrainingItem,
    removeStudentTrainingItem,
    addTrainingItem,
    updateTrainingItem,
    removeTrainingItem,

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
    addStudentQuestionsBulk,
    updateStudentQuestion,
    removeStudentQuestion,
    resetStudentQuestions,
    copyTeacherQuestionBankToStudents,
    studentExamMinutes,
    updateStudentExamMinutes,

    systemLogs,
    addSystemLog,

    isRefetching,
    triggerBackgroundSync,
    currentUser,
    setCurrentUser,
    toggleMessageReaction,
  }), [
    examResults, addExamResult, updateExamResult, removeExamResult,
    students, teachers, staffs, transactions, schedules, socketNotifications, messages, materials,
    currentUser, setCurrentUser,
    addStudent, addTeacher, removeTeacher, updateTeacher, updateStudent, assignTeacher, approveTeacher, rejectTeacher, payTeacher, removeStudent, grantPending,
    markStudentPaid, getAdminStats, studentsPagination, fetchStudentsPaginated,
    markAttendance, updateStudentLink, updateStudentSchedule, submitTestResult, submitPracticalFile,
    getStudentsByTeacher, getTeacherStats, getSchedulesByTeacher, getTransactionsByTeacher,
    getSchedulesByStudent, approveStudentExam, revokeStudentExam, saveExamResult,
    sendMessage, syncMessages, markMessagesRead, getConversations, getMessages,
    groups, recallMessage, softDeleteMessage, createChatGroup, deleteChatGroup,
    addNotification, markNotificationRead, dismissNotificationLocal, getNotifications,
    addSchedule, updateSchedule, cancelSchedule,
    addMaterial, removeMaterial, getMaterialsByCourse, getMaterialsByCategory,
    rateTeacher, getTeacherRating, RATING_CRITERIA,
    submitPrivateEvaluation, getPrivateEvaluationsForAdmin, markEvaluationRead, privateEvaluations,
    trainingData, studentTrainingData,
    addStudentTrainingItem, updateStudentTrainingItem, removeStudentTrainingItem,
    addTrainingItem, updateTrainingItem, removeTrainingItem,
    questions, addQuestion, addQuestionsBulk, updateQuestion, removeQuestion, resetQuestions,
    teacherExamTimeLimitMinutes, setTeacherExamTimeLimitMinutes,
    studentQuestions, addStudentQuestion, addStudentQuestionsBulk, updateStudentQuestion,
    removeStudentQuestion, resetStudentQuestions, copyTeacherQuestionBankToStudents,
    studentExamMinutes, updateStudentExamMinutes,
    systemLogs, addSystemLog,
    isRefetching, triggerBackgroundSync, toggleMessageReaction,
  ]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useData = () => {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be inside DataProvider');
  return ctx;
};

export default DataContext;
