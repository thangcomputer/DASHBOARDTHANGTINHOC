import React from 'react';
import CmsSelect from '../../ui/CmsSelect';
import { useAdminTab } from '../AdminTabContext';
import { useAdminTraining } from '../hooks/AdminTrainingContext';
import { useSocket } from '../../../context/SocketContext';
import { EXAM_RESULTS_STUDENTS_FETCH_CAP } from '../hooks/adminConstants';
import {
  BookOpen, Video, Download, HelpCircle, Trophy, Plus, Clock, Trash2,
  FileSpreadsheet, Edit3, X, Upload, Loader2, FileText, Save, Search,
  CheckCircle2, XCircle, Layers, ImagePlus, Link2,
} from 'lucide-react';
import NavArrow from '../../ui/NavArrow';
import AdminCourseBuilder from '../../AdminCourseBuilder';
import RichTextEditor from '../shared/RichTextEditor';
import { trainingUploadDisplayName } from '../utils/trainingUpload';
import ExamSubjectCheckboxGrid from '../shared/ExamSubjectCheckboxGrid';
import { getExamSubjectOptions } from '../../../utils/examSubjects';
import { DEFAULT_LEARNING_GUIDE_HTML, getLearningGuideVideoEmbedUrl } from '../../../utils/learningGuide';
import { resolveRichHtmlMedia, sanitizeRichHtml } from '../../../utils/htmlContent';
import api, { apiFetch, buildMediaDownloadUrl, resolveMediaUrl } from '../../../services/api';
import { useData } from '../../../context/DataContext';
import StudentQuestionBankPanel from './StudentQuestionBankPanel';
import { getExamProgressDisplayStatus, summarizeExamProgress } from '../../../utils/examProgressStats';

function mergeDocumentCourseOptions(dbCourses) {
  return (dbCourses || [])
    .map((course) => ({
      id: String(course._id || course.id),
      title: String(course.name || '').trim(),
      examSubjects: Array.isArray(course.examSubjects) ? course.examSubjects : [],
    }))
    .filter((course) => course.id && course.title);
}

function findCourseTrainingVideo(items, course, courses) {
  const courseId = String(course?._id || course?.id || '');
  const directMatch = items.find((item) => (
    String(item.courseId || item.course_id || '') === courseId
    || String(item.id || item._id || '') === courseId
  ));
  if (directMatch) return directMatch;

  const knownCourseIds = new Set((courses || []).map((item) => String(item._id || item.id || '')));
  const courseName = String(course?.name || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  return items.find((item) => {
    if (item.courseId || item.course_id) return false;
    const itemId = String(item.id || item._id || '');
    if (itemId && knownCourseIds.has(itemId)) return false;
    return String(item.title || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase() === courseName;
  });
}

function findDocumentCourse(courses, document) {
  const courseId = String(document?.courseId || document?.course_id || '');
  if (courseId) {
    const byId = courses.find((course) => String(course._id || course.id) === courseId);
    if (byId) return byId;
  }
  const courseName = String(document?.courseName || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  if (!courseName) return null;
  return courses.find(
    (course) => String(course.name || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase() === courseName,
  ) || null;
}

export default function AdminStudentTrainingTab({ videoCoursesOnly = false, resourceOnly = false, examRoomOnly = false, learningGuideOnly = false }) {
  const {
    students, showGlobalModal, BLANK_Q,
    erSearch, setErSearch, gradingRow, setGradingRow,
    gradingValue, setGradingValue, ctxUpdateStudent, toast, addNotification,
    erForm, setErForm, safeStudentsList,
    sTrainingTab: storedSTrainingTab, setSTrainingTab,
    fetchStudentsPaginated, selectedBranchId,
  } = useAdminTab();
  const { socket } = useSocket() || {};

  React.useEffect(() => {
    if (typeof fetchStudentsPaginated !== 'function') return undefined;
    const load = () => {
      fetchStudentsPaginated({
        page: 1,
        limit: EXAM_RESULTS_STUDENTS_FETCH_CAP,
        search: '',
        branch_id: selectedBranchId,
        forceBranchIdAll: selectedBranchId === 'all',
      });
    };
    load();
    if (!socket) return undefined;
    const onUpd = () => {
      load();
    };
    socket.on('student:updated', onUpd);
    socket.on('data:refresh', onUpd);
    return () => {
      socket.off('student:updated', onUpd);
      socket.off('data:refresh', onUpd);
    };
  }, [fetchStudentsPaginated, selectedBranchId, socket]);

  const {
    sCourseBuilderMode, setSCourseBuilderMode, updateStudentTrainingItem,
    studentTrainingData, setSTrainingForm,
    studentQuestions, studentExamMinutes, updateStudentExamMinutes,
    studentExamFiles, setStudentExamFile,
    resetStudentQuestions, setSqForm,
    studentQuestionsExcelInputRef, handleStudentQuestionsExcelFile,
    sTrainingForm, sTrainingFileUploading, handleTrainingDocUpload,
    addStudentTrainingItem,
    sqSection, setSqSection, sqType, setSqType, sqSearch, setSqSearch, removeStudentQuestion,
    removeStudentTrainingItem, sqForm, updateStudentQuestion, addStudentQuestion,
    updateExamResult, addExamResult, examSubjectsCatalog,
  } = useAdminTraining();
  const { examAdminGroupLabel, setStudentTrainingData } = useData();
  const sTrainingTab = learningGuideOnly
    ? 'learning-guide'
    : examRoomOnly
    ? storedSTrainingTab === 'exam-results' ? 'exam-results' : 'questions'
    : resourceOnly
    ? ['files', 'softwareLinks'].includes(storedSTrainingTab) ? storedSTrainingTab : 'files'
    : videoCoursesOnly
    ? 'videos'
    : storedSTrainingTab === 'videos' ? 'files' : storedSTrainingTab;

  const [dbCourses, setDbCourses] = React.useState([]);
  const [courseCatalogLoading, setCourseCatalogLoading] = React.useState(true);
  const [courseCatalogError, setCourseCatalogError] = React.useState('');
  const [coverUploading, setCoverUploading] = React.useState(false);
  const [learningGuideHtml, setLearningGuideHtml] = React.useState(DEFAULT_LEARNING_GUIDE_HTML);
  const [learningGuideVideoUrl, setLearningGuideVideoUrl] = React.useState('');
  const [learningGuideSaving, setLearningGuideSaving] = React.useState(false);

  React.useEffect(() => {
    if (sTrainingTab !== 'learning-guide') return;
    setLearningGuideHtml(typeof studentTrainingData?.learningGuideHtml === 'string'
      ? studentTrainingData.learningGuideHtml
      : DEFAULT_LEARNING_GUIDE_HTML);
    setLearningGuideVideoUrl(studentTrainingData?.learningGuideVideoUrl || '');
  }, [sTrainingTab, studentTrainingData?.learningGuideHtml, studentTrainingData?.learningGuideVideoUrl]);

  const saveLearningGuide = async () => {
    const updatedData = {
      ...studentTrainingData,
      learningGuideHtml,
      learningGuideVideoUrl: learningGuideVideoUrl.trim(),
    };
    setLearningGuideSaving(true);
    try {
      await api.settings.updateStudentTrainingData(updatedData);
      setStudentTrainingData(updatedData);
      toast.success('Đã lưu hướng dẫn học');
    } catch (err) {
      toast.error(err.message || 'Không lưu được hướng dẫn học');
    } finally {
      setLearningGuideSaving(false);
    }
  };

  const handleCoverUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!String(file.type || '').startsWith('image/')) {
      toast.error('Chỉ chọn file ảnh (JPG, PNG, WEBP…)');
      return;
    }
    setCoverUploading(true);
    try {
      const data = await api.settings.uploadTrainingFile(file);
      if (!data.success) throw new Error(data.message || 'Upload thất bại');
      setSTrainingForm((prev) => ({ ...prev, coverImage: data.fileUrl }));
      toast.success('Đã tải ảnh bìa');
    } catch (err) {
      toast.error(err.message || 'Không tải được ảnh bìa');
    } finally {
      setCoverUploading(false);
    }
  };

  React.useEffect(() => {
    if (!['videos', 'files', 'questions'].includes(sTrainingTab)) return undefined;
    let cancelled = false;
    (async () => {
      try {
        setCourseCatalogLoading(true);
        const res = await apiFetch('/courses');
        const json = await res.json();
        if (!res.ok || !json?.success) {
          throw new Error(json?.message || 'Không tải được danh sách khóa học');
        }
        if (!cancelled) {
          setDbCourses(Array.isArray(json.data) ? json.data : []);
          setCourseCatalogError('');
        }
      } catch (err) {
        if (!cancelled) setCourseCatalogError(err.message || 'Không tải được danh sách khóa học');
      } finally {
        if (!cancelled) setCourseCatalogLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sTrainingTab]);

  const studentVideoItems = Array.isArray(studentTrainingData?.videos) ? studentTrainingData.videos : [];
  const linkedVideos = new Set();
  const catalogVideoItems = dbCourses.map((course) => {
    const courseId = String(course._id || course.id || '');
    const linkedItem = findCourseTrainingVideo(studentVideoItems, course, dbCourses);
    if (linkedItem) linkedVideos.add(linkedItem);
    const itemId = String(linkedItem?.id || linkedItem?._id || courseId);
    return {
      ...linkedItem,
      id: itemId,
      _id: itemId,
      courseId,
      title: course.name,
      name: course.name,
      examSubjects: Array.isArray(course.examSubjects) ? course.examSubjects : [],
      coverImage: course.thumbnail || linkedItem?.coverImage || '',
      desc: linkedItem?.desc || course.shortDescription || course.description || '',
      totalSessions: course.totalSessions,
      status: course.status,
      isCourseCatalogItem: true,
    };
  });
  const unlinkedVideoItems = studentVideoItems
    .filter((item) => !linkedVideos.has(item))
    .map((item) => ({ ...item, isUnlinkedVideo: true }));

  const documentCourseOptions = React.useMemo(
    () => mergeDocumentCourseOptions(dbCourses),
    [dbCourses],
  );
  const trainingItems = sTrainingTab === 'videos'
    ? [...catalogVideoItems, ...unlinkedVideoItems]
    : (studentTrainingData?.[sTrainingTab] || []);
  const examSubjectLabels = React.useMemo(
    () => new Map(getExamSubjectOptions(examSubjectsCatalog).map(({ id, label }) => [id, label])),
    [examSubjectsCatalog],
  );

  return (
    <>
            <div className="space-y-6">
              {sCourseBuilderMode ? (
                <AdminCourseBuilder
                  course={sCourseBuilderMode}
                  onBack={() => setSCourseBuilderMode(null)}
                  onPatch={async (updatedCourse) => {
                    const cid = sCourseBuilderMode.id || sCourseBuilderMode._id;
                    const payload = { ...updatedCourse };
                    delete payload.isCourseCatalogItem;
                    delete payload.isUnlinkedVideo;
                    await updateStudentTrainingItem('videos', cid, payload);
                  }}
                  onSave={async (updatedCourse) => {
                    const cid = sCourseBuilderMode.id || sCourseBuilderMode._id;
                    const payload = { ...updatedCourse };
                    delete payload.isCourseCatalogItem;
                    delete payload.isUnlinkedVideo;
                    await updateStudentTrainingItem('videos', cid, payload);
                    setSCourseBuilderMode(null);
                  }}
                />
              ) : (
              <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {!videoCoursesOnly && !learningGuideOnly && (
                  <h2 className="text-lg sm:text-xl font-bold text-gray-800 flex items-center gap-2 min-w-0">
                    <BookOpen size={20} className="text-sky-700 shrink-0" /> {resourceOnly ? 'Tài liệu & link phần mềm' : examRoomOnly ? 'Phòng thi' : 'Quản lý Đào tạo Học viên'}
                  </h2>
                )}
              </div>

              {/* Sub-tabs + primary action (laptop+: one row of tabs, action left-aligned) */}
              <div className="flex flex-col gap-3 lg:gap-4">
              {!videoCoursesOnly && !resourceOnly && !examRoomOnly && !learningGuideOnly && (
              <div className="cms-hscroll-tabs w-full rounded-2xl p-1.5 shadow-sm border border-gray-100 bg-white">
                <div className="cms-hscroll-tabs__track">
                {[
                  { key: 'files', icon: Download, label: 'Tài liệu & link phần mềm', count: (studentTrainingData?.files?.length || 0) + (studentTrainingData?.softwareLinks?.length || 0) },
                  { key: 'exam-room', icon: Trophy, label: 'Phòng thi', count: (studentQuestions?.length || 0) + summarizeExamProgress(students).total },
                  { key: 'learning-guide', icon: BookOpen, label: 'Hướng dẫn học' },
                ].map(t => (
                  <button
                    key={t.key}
                    type="button"
                    title={t.count === undefined ? t.label : `${t.label} (${t.count})`}
                    aria-label={t.count === undefined ? t.label : `${t.label} (${t.count})`}
                    onClick={() => {
                      setSTrainingTab(t.key === 'exam-room' ? (sTrainingTab === 'exam-results' ? 'exam-results' : 'questions') : t.key);
                      setSTrainingForm(null);
                      setSCourseBuilderMode(null);
                    }}
                    className={`cms-hscroll-tab ${
                      (t.key === 'files'
                        ? ['files', 'softwareLinks'].includes(sTrainingTab)
                        : t.key === 'exam-room'
                          ? ['questions', 'exam-results'].includes(sTrainingTab)
                          : sTrainingTab === 'learning-guide')
                        ? 'bg-red-600 text-white shadow-md'
                        : 'text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    <t.icon size={16} className="shrink-0" aria-hidden="true" />
                    <span className="cms-hscroll-tab__label">{t.label}</span>
                    {t.count !== undefined && <span className="cms-hscroll-tab__count">({t.count})</span>}
                  </button>
                ))}
                </div>
              </div>
              )}

              {!videoCoursesOnly && ['files', 'softwareLinks'].includes(sTrainingTab) && (
                <div className="flex flex-wrap gap-2 rounded-2xl border border-gray-100 bg-white p-1.5 shadow-sm">
                  {[
                    { key: 'files', icon: Download, label: 'Tài liệu', count: studentTrainingData?.files?.length || 0 },
                    { key: 'softwareLinks', icon: Link2, label: 'Link phần mềm', count: studentTrainingData?.softwareLinks?.length || 0 },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => { setSTrainingTab(tab.key); setSTrainingForm(null); }}
                      className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${
                        sTrainingTab === tab.key ? 'bg-red-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <tab.icon size={15} aria-hidden="true" />
                      <span>{tab.label}</span>
                      <span className="text-xs opacity-80">({tab.count})</span>
                    </button>
                  ))}
                </div>
              )}

              {!videoCoursesOnly && ['questions', 'exam-results'].includes(sTrainingTab) && (
                <div className="flex flex-wrap gap-2 rounded-2xl border border-gray-100 bg-white p-1.5 shadow-sm">
                  {[
                    { key: 'questions', icon: HelpCircle, label: 'Ngân hàng câu hỏi', count: studentQuestions?.length || 0 },
                    { key: 'exam-results', icon: Trophy, label: 'Kết quả thi', count: summarizeExamProgress(students).total },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => { setSTrainingTab(tab.key); setSTrainingForm(null); }}
                      className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${
                        sTrainingTab === tab.key ? 'bg-red-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <tab.icon size={15} aria-hidden="true" />
                      <span>{tab.label}</span>
                      <span className="text-xs opacity-80">({tab.count})</span>
                    </button>
                  ))}
                </div>
              )}

              {sTrainingTab !== 'questions' && sTrainingTab !== 'exam-results' && sTrainingTab !== 'learning-guide' && (
                <button type="button" onClick={() => { setSCourseBuilderMode(null); setSTrainingForm(sTrainingTab === 'softwareLinks' ? { title: '', linkUrl: '', description: '', installGuide: '' } : { examSubjects: [] }); }}
                  className="inline-flex w-full sm:w-auto self-stretch sm:self-center lg:self-start min-h-11 justify-center bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-2xl text-sm font-bold shadow-md transition items-center gap-2">
                  <Plus size={15} /> {sTrainingTab === 'videos' ? 'Gắn nội dung khóa đã tạo' : sTrainingTab === 'softwareLinks' ? 'Thêm link phần mềm' : 'Thêm tài liệu'}
                </button>
              )}
              </div>
              {sTrainingTab === 'learning-guide' ? (
                <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
                  <div>
                    <h3 className="text-lg font-black text-slate-900">Hướng dẫn học viên</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Nội dung này hiển thị trong tab Hướng dẫn học ở danh mục khóa học. Có thể chèn ảnh trong trình soạn thảo và nhúng video YouTube hoặc Vimeo.
                    </p>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Nội dung hướng dẫn</label>
                    <RichTextEditor
                      value={learningGuideHtml}
                      onChange={setLearningGuideHtml}
                      placeholder="Soạn hướng dẫn từng bước, định dạng chữ, danh sách và chèn hình ảnh..."
                    />
                  </div>
                  <div>
                    <label htmlFor="learning-guide-video" className="mb-1 block text-xs font-bold uppercase text-slate-500">Video hướng dẫn (YouTube hoặc Vimeo)</label>
                    <input
                      id="learning-guide-video"
                      type="url"
                      value={learningGuideVideoUrl}
                      onChange={(event) => setLearningGuideVideoUrl(event.target.value)}
                      placeholder="https://youtu.be/... hoặc https://vimeo.com/..."
                      className="min-h-11 w-full rounded-xl border-2 border-slate-200 px-3 text-sm outline-none focus:border-red-400"
                    />
                    {learningGuideVideoUrl.trim() && !getLearningGuideVideoEmbedUrl(learningGuideVideoUrl) && (
                      <p className="mt-1 text-xs font-medium text-red-600">Liên kết video không hợp lệ. Hãy dùng URL YouTube hoặc Vimeo.</p>
                    )}
                    {getLearningGuideVideoEmbedUrl(learningGuideVideoUrl) && (
                      <div className="mt-3 aspect-video max-w-2xl overflow-hidden rounded-xl bg-slate-950">
                        <iframe
                          title="Xem trước video hướng dẫn"
                          src={getLearningGuideVideoEmbedUrl(learningGuideVideoUrl)}
                          className="h-full w-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowFullScreen
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                    <p className="text-xs text-slate-500">Lưu ý: học viên sẽ thấy nội dung sau khi lưu.</p>
                    <button
                      type="button"
                      onClick={saveLearningGuide}
                      disabled={learningGuideSaving || (learningGuideVideoUrl.trim() && !getLearningGuideVideoEmbedUrl(learningGuideVideoUrl))}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-red-600 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {learningGuideSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                      {learningGuideSaving ? 'Đang lưu...' : 'Lưu hướng dẫn'}
                    </button>
                  </div>
                  <details className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <summary className="cursor-pointer text-sm font-bold text-slate-700">Xem trước nội dung học viên</summary>
                    <div className="mt-4 space-y-4">
                      {learningGuideVideoUrl.trim() && getLearningGuideVideoEmbedUrl(learningGuideVideoUrl) && (
                        <div className="aspect-video max-w-2xl overflow-hidden rounded-xl bg-slate-950">
                          <iframe
                            title="Video hướng dẫn học viên"
                            src={getLearningGuideVideoEmbedUrl(learningGuideVideoUrl)}
                            className="h-full w-full"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                          />
                        </div>
                      )}
                      <div
                        className="prose prose-sm max-w-none text-slate-700 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-xl"
                        dangerouslySetInnerHTML={{
                          __html: resolveRichHtmlMedia(sanitizeRichHtml(learningGuideHtml), resolveMediaUrl),
                        }}
                      />
                    </div>
                  </details>
                </section>
              ) : (
              <>
              {sTrainingTab === 'questions' && (
                <StudentQuestionBankPanel
                  courses={dbCourses}
                  coursesLoading={courseCatalogLoading}
                  coursesError={courseCatalogError}
                />
              )}

              {/* Kết quả thi tự động từ bài thi của học viên - không cần thêm thủ công */}

              {/* Add/Edit Form */}
              {sTrainingForm && (
                <div className="bg-white rounded-2xl shadow-sm border border-sky-200 p-4 sm:p-6 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-bold text-sky-700 flex items-center gap-2 min-w-0">
                      <Edit3 size={16} /> {sTrainingForm.id ? 'Chỉnh sửa' : 'Thêm mới'}
                    </h3>
                    <button type="button" onClick={() => setSTrainingForm(null)} className="shrink-0 inline-flex items-center justify-center min-w-11 min-h-11 rounded-2xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"><X size={18} /></button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {sTrainingTab === 'softwareLinks' ? (
                      <>
                        <div className="sm:col-span-2">
                          <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Tên phần mềm</label>
                          <input value={sTrainingForm.title || ''} onChange={e => setSTrainingForm({ ...sTrainingForm, title: e.target.value })}
                            className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm focus:border-green-400 outline-none" placeholder="VD: Microsoft Office 365" />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Link tải / mở</label>
                          <input value={sTrainingForm.linkUrl || ''} onChange={e => setSTrainingForm({ ...sTrainingForm, linkUrl: e.target.value })}
                            className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm focus:border-green-400 outline-none" placeholder="https://..." />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Mô tả</label>
                          <textarea value={sTrainingForm.description || ''} onChange={e => setSTrainingForm({ ...sTrainingForm, description: e.target.value })}
                            rows={3} className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm focus:border-green-400 outline-none resize-y" placeholder="Mô tả ngắn về phần mềm..." />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Hướng dẫn cài đặt</label>
                          <RichTextEditor
                            value={sTrainingForm.installGuide || ''}
                            onChange={(val) => setSTrainingForm((prev) => ({ ...prev, installGuide: val }))}
                            placeholder="Các bước cài đặt (định dạng chữ, danh sách, chèn hình...)"
                          />
                        </div>
                      </>
                    ) : (
                    <>
                    {sTrainingTab === 'videos' && (
                      <div className="sm:col-span-2">
                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Khóa học trong danh mục *</label>
                        <CmsSelect
                          value={sTrainingForm.courseId || ''}
                          onChange={(e) => {
                            const courseId = e.target.value;
                            const course = dbCourses.find((item) => String(item._id || item.id) === courseId);
                            if (!course) {
                              setSTrainingForm((prev) => ({ ...prev, courseId: '', title: '', examSubjects: [] }));
                              return;
                            }
                            const existing = findCourseTrainingVideo(studentVideoItems, course, dbCourses);
                            setSTrainingForm((prev) => ({
                              ...prev,
                              ...(existing || {}),
                              id: existing?.id || existing?._id || undefined,
                              courseId,
                              title: course.name,
                              examSubjects: Array.isArray(course.examSubjects) ? course.examSubjects : [],
                              coverImage: course.thumbnail || existing?.coverImage || prev.coverImage || '',
                              desc: existing?.desc || course.shortDescription || course.description || '',
                            }));
                          }}
                          className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm focus:border-green-400 outline-none bg-white"
                        >
                          <option value="">— Chọn khóa đã tạo —</option>
                          {dbCourses.map((course) => (
                            <option key={course._id || course.id} value={course._id || course.id}>
                              {course.name}{course.status && course.status !== 'published' ? ` (${course.status})` : ''}
                            </option>
                          ))}
                        </CmsSelect>
                        {courseCatalogLoading ? (
                          <p className="mt-1 text-xs text-slate-500">Đang tải danh mục khóa học…</p>
                        ) : courseCatalogError ? (
                          <p className="mt-1 text-xs font-medium text-red-600">{courseCatalogError}</p>
                        ) : dbCourses.length === 0 ? (
                          <p className="mt-1 text-xs text-amber-600">Chưa có khóa trong danh mục. Hãy tạo khóa ở mục Quản lý Học phí Khóa học trước.</p>
                        ) : (
                          <p className="mt-1 text-xs text-slate-500">Tên khóa và môn học được đồng bộ từ danh mục khóa học.</p>
                        )}
                      </div>
                    )}
                    {sTrainingTab !== 'files' && sTrainingTab !== 'videos' && (
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Tiêu đề</label>
                      <input value={sTrainingForm.title || ''} onChange={e => setSTrainingForm({ ...sTrainingForm, title: e.target.value })}
                        className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm focus:border-green-400 outline-none" placeholder="Nhập tiêu đề..." />
                    </div>
                    )}
                    {sTrainingTab === 'videos' && (
                      <div className="sm:col-span-2">
                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Mô tả Khóa học (Tóm tắt)</label>
                        <input value={sTrainingForm.desc || ''} onChange={e => setSTrainingForm({ ...sTrainingForm, desc: e.target.value })}
                          className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm focus:border-green-400 outline-none" placeholder="Nhập mô tả tóm tắt..." />
                      </div>
                    )}
                    {sTrainingTab === 'videos' && (
                      <>
                      <div className="sm:col-span-2">
                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Ảnh bìa khóa học</label>
                        <p className="text-[11px] text-slate-500 mb-2">Khuyến nghị <strong>1280×720px</strong> (16:9). Tối thiểu 640×360. JPG/PNG/WEBP, tối đa ~5MB cho ảnh rõ.</p>
                        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-start">
                          <div className="w-full sm:w-48 aspect-video rounded-xl border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center shrink-0">
                            {sTrainingForm.coverImage ? (
                              <img src={resolveMediaUrl(sTrainingForm.coverImage)} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-xs text-slate-400 font-semibold">Chưa có ảnh</span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2 items-center">
                            <label className={`inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-xl border-2 border-dashed border-sky-300 bg-sky-50/50 text-sky-800 text-xs font-black uppercase tracking-wide cursor-pointer hover:bg-sky-100 transition-colors ${coverUploading ? 'opacity-60 pointer-events-none' : ''}`}>
                              {coverUploading ? <Loader2 className="animate-spin" size={16} /> : <ImagePlus size={16} />}
                              {coverUploading ? 'Đang tải...' : (sTrainingForm.coverImage ? 'Đổi ảnh' : 'Chọn ảnh')}
                              <input type="file" className="hidden" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleCoverUpload} />
                            </label>
                            {sTrainingForm.coverImage ? (
                              <button
                                type="button"
                                onClick={() => setSTrainingForm((prev) => ({ ...prev, coverImage: '' }))}
                                className="min-h-11 px-3 rounded-xl text-sm font-bold text-red-600 hover:bg-red-50"
                              >
                                Xóa ảnh
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Tên giảng viên / người hướng dẫn</label>
                        <input
                          value={sTrainingForm.instructorName || ''}
                          onChange={(e) => setSTrainingForm({ ...sTrainingForm, instructorName: e.target.value })}
                          className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm focus:border-green-400 outline-none"
                          placeholder="VD: Thầy Nguyễn Văn A"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Phần mềm sử dụng</label>
                        <input
                          value={sTrainingForm.software || ''}
                          onChange={(e) => setSTrainingForm({ ...sTrainingForm, software: e.target.value })}
                          className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm focus:border-green-400 outline-none"
                          placeholder="VD: Word, Excel, PowerPoint"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Giới thiệu giảng viên</label>
                        <textarea
                          value={sTrainingForm.instructorBio || ''}
                          onChange={(e) => setSTrainingForm({ ...sTrainingForm, instructorBio: e.target.value })}
                          rows={3}
                          className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm focus:border-green-400 outline-none resize-y"
                          placeholder="Mô tả ngắn về người hướng dẫn (kinh nghiệm, chuyên môn…)"
                        />
                      </div>
                      </>
                    )}

                    {sTrainingTab === 'files' && (
                      <>
                        <div>
                          <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Khóa học *</label>
                          <CmsSelect
                            value={sTrainingForm.courseId || ''}
                            onChange={(e) => {
                              const cid = e.target.value;
                              const course = documentCourseOptions.find((c) => String(c.id) === String(cid));
                              setSTrainingForm({
                                ...sTrainingForm,
                                courseId: cid,
                                courseName: course?.title || '',
                                examSubjects: course?.examSubjects || [],
                              });
                            }}
                            required
                            className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm focus:border-green-400 outline-none bg-white"
                          >
                            <option value="">— Chọn khóa học đã tạo —</option>
                            {documentCourseOptions.map((c) => (
                              <option key={c.id} value={c.id}>{c.title}</option>
                            ))}
                          </CmsSelect>
                          {courseCatalogLoading ? (
                            <p className="mt-1 text-xs text-slate-500">Đang tải danh sách khóa học…</p>
                          ) : courseCatalogError ? (
                            <p className="mt-1 text-xs font-medium text-red-600">{courseCatalogError}</p>
                          ) : documentCourseOptions.length === 0 ? (
                            <p className="mt-1 text-xs font-medium text-amber-700">
                              Chưa có khóa học. Hãy tạo khóa trong Quản lý Học phí Khóa học trước.
                            </p>
                          ) : (
                            <p className="mt-1 text-xs text-slate-500">
                              Danh sách được đồng bộ trực tiếp từ các khóa học đã tạo.
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Tiêu đề</label>
                          <input value={sTrainingForm.title || ''} onChange={e => setSTrainingForm({ ...sTrainingForm, title: e.target.value })}
                            className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm focus:border-green-400 outline-none" placeholder="Nhập tiêu đề..." />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Tải tệp</label>
                          <div className="flex flex-wrap items-center gap-2 min-h-[46px]">
                            <label className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-sky-300 bg-sky-50/50 text-sky-800 text-xs font-black uppercase tracking-wide cursor-pointer hover:bg-sky-100 transition-colors shrink-0 ${sTrainingFileUploading ? 'opacity-60 pointer-events-none' : ''}`}>
                              {sTrainingFileUploading ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
                              {sTrainingFileUploading ? 'Đang tải...' : 'TẢI TỆP'}
                              <input type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar" onChange={(e) => handleTrainingDocUpload(e, 'student')} />
                            </label>
                            {sTrainingForm.fileUrl && String(sTrainingForm.fileType || '').toUpperCase() !== 'LINK' && (
                              <a
                                href={buildMediaDownloadUrl(sTrainingForm.fileUrl, sTrainingForm.fileOriginalName)}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-2 max-w-[min(100%,14rem)] px-3 py-2 rounded-xl bg-sky-100/80 border border-sky-200 text-sky-900 text-xs font-bold hover:bg-sky-200/80 transition-colors truncate"
                                title={trainingUploadDisplayName(sTrainingForm.fileUrl, sTrainingForm.fileOriginalName)}
                              >
                                <FileText size={16} className="shrink-0 text-sky-700" />
                                <span className="truncate">{trainingUploadDisplayName(sTrainingForm.fileUrl, sTrainingForm.fileOriginalName)}</span>
                              </a>
                            )}
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Hoặc link (Drive / URL)</label>
                          <div className="flex items-center gap-2">
                            <Link2 size={16} className="text-slate-400 shrink-0" />
                            <input
                              value={
                                String(sTrainingForm.fileType || '').toUpperCase() === 'LINK'
                                  || /^https?:\/\//i.test(String(sTrainingForm.fileUrl || ''))
                                  ? (sTrainingForm.fileUrl || '')
                                  : (sTrainingForm.linkUrl || '')
                              }
                              onChange={(e) => {
                                const link = e.target.value.trim();
                                setSTrainingForm({
                                  ...sTrainingForm,
                                  linkUrl: link,
                                  ...(link
                                    ? { fileUrl: link, fileType: 'LINK', fileSize: '', fileOriginalName: '' }
                                    : (String(sTrainingForm.fileType || '').toUpperCase() === 'LINK'
                                      ? { fileUrl: '', fileType: 'PDF' }
                                      : {})),
                                });
                              }}
                              className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm focus:border-green-400 outline-none"
                              placeholder="https://drive.google.com/..."
                            />
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1">Nếu điền link, học viên sẽ thấy nút &quot;Mở link&quot; thay vì tải file.</p>
                        </div>
                      </>
                    )}
                    </>
                    )}
                  </div>
                  {sTrainingTab === 'videos' && (
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Môn học trong khóa (đồng bộ)</label>
                      <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                        {sTrainingForm.examSubjects?.length
                          ? sTrainingForm.examSubjects.map((id) => examSubjectLabels.get(id) || id).join(', ')
                          : 'Chọn khóa học để xem các môn đã gắn.'}
                      </p>
                    </div>
                  )}
                  {sTrainingTab === 'files' && sTrainingForm.courseId && (
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Môn thuộc khóa (đồng bộ)</label>
                      <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                        {sTrainingForm.examSubjects?.length
                          ? sTrainingForm.examSubjects.map((id) => examSubjectLabels.get(id) || id).join(', ')
                          : 'Khóa học chưa được gắn môn trong danh mục.'}
                      </p>
                    </div>
                  )}
                  {sTrainingTab !== 'softwareLinks'
                    && sTrainingTab !== 'videos'
                    && sTrainingTab !== 'files' && (
                  <ExamSubjectCheckboxGrid
                    catalog={examSubjectsCatalog}
                    value={sTrainingForm.examSubjects || []}
                    groupLabels={{ admin: examAdminGroupLabel }}
                    onChange={(ids) => setSTrainingForm((prev) => ({ ...prev, examSubjects: ids }))}
                  />
                  )}
                  {sTrainingTab !== 'softwareLinks' && (
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Nội dung (có định dạng)</label>
                    <RichTextEditor
                      value={sTrainingForm.desc || ''}
                      onChange={(val) => setSTrainingForm(prev => ({ ...prev, desc: val }))}
                      placeholder="Nhập nội dung mô tả chi tiết..."
                    />
                  </div>
                  )}
                  <button onClick={async () => {
                    if (sTrainingTab === 'softwareLinks') {
                      if (!String(sTrainingForm.title || '').trim()) {
                        toast.error('Nhập tên phần mềm');
                        return;
                      }
                      if (!String(sTrainingForm.linkUrl || '').trim()) {
                        toast.error('Nhập link tải / mở');
                        return;
                      }
                      const payload = {
                        title: String(sTrainingForm.title || '').trim(),
                        linkUrl: String(sTrainingForm.linkUrl || '').trim(),
                        description: String(sTrainingForm.description || '').trim(),
                        installGuide: String(sTrainingForm.installGuide || '').trim(),
                      };
                      if (sTrainingForm.id) {
                        updateStudentTrainingItem('softwareLinks', sTrainingForm.id, payload);
                      } else {
                        addStudentTrainingItem('softwareLinks', { ...payload, createdAt: new Date().toISOString().split('T')[0] });
                      }
                      setSTrainingForm(null);
                      return;
                    }
                    const selectedDocumentCourse = sTrainingTab === 'files'
                      ? documentCourseOptions.find((course) => course.id === String(sTrainingForm.courseId))
                      : null;
                    if (sTrainingTab === 'files' && !selectedDocumentCourse) {
                      toast.error(
                        sTrainingForm.courseId
                          ? 'Khóa tài liệu không còn trong danh mục. Hãy chọn lại khóa học.'
                          : 'Hãy chọn khóa học đã tạo để gắn tài liệu.',
                      );
                      return;
                    }
                    if (sTrainingTab === 'videos') {
                      const selectedCourse = dbCourses.find(
                        (course) => String(course._id || course.id) === String(sTrainingForm.courseId || ''),
                      );
                      if (!selectedCourse) {
                        toast.error('Hãy chọn khóa học đã tạo trong danh mục trước khi lưu');
                        return;
                      }
                      const courseId = String(selectedCourse._id || selectedCourse.id);
                      const existing = findCourseTrainingVideo(studentVideoItems, selectedCourse, dbCourses);
                      const formValues = { ...sTrainingForm };
                      delete formValues.isCourseCatalogItem;
                      delete formValues.isUnlinkedVideo;
                      const payload = {
                        ...formValues,
                        id: existing?.id || existing?._id || courseId,
                        courseId,
                        title: selectedCourse.name,
                        examSubjects: Array.isArray(selectedCourse.examSubjects) ? selectedCourse.examSubjects : [],
                        coverImage: selectedCourse.thumbnail || sTrainingForm.coverImage || '',
                        totalSessions: selectedCourse.totalSessions,
                      };
                      try {
                        if (existing) {
                          await updateStudentTrainingItem('videos', existing.id || existing._id, payload);
                        } else {
                          await addStudentTrainingItem('videos', {
                            ...payload,
                            createdAt: new Date().toISOString().split('T')[0],
                          });
                        }
                      } catch (err) {
                        toast.error(err.message || 'Không lưu được nội dung khóa học');
                        return;
                      }
                      setSTrainingForm(null);
                      return;
                    }
                    if (sTrainingTab !== 'files' && !sTrainingForm.examSubjects?.length) {
                      showGlobalModal({ title: 'Thiếu thông tin', content: 'Vui lòng chọn ít nhất một môn học!', type: 'warning' });
                      return;
                    }
                    const sTrainingPayload = sTrainingTab === 'files'
                      ? (() => {
                        const link = String(sTrainingForm.linkUrl || '').trim()
                          || (/^https?:\/\//i.test(String(sTrainingForm.fileUrl || '')) ? String(sTrainingForm.fileUrl).trim() : '');
                        if (link || String(sTrainingForm.fileType || '').toUpperCase() === 'LINK') {
                          const url = link || String(sTrainingForm.fileUrl || '').trim();
                          return {
                            ...sTrainingForm,
                            courseId: selectedDocumentCourse?.id || '',
                            courseName: selectedDocumentCourse?.title || (sTrainingForm.courseId ? sTrainingForm.courseName : ''),
                            examSubjects: selectedDocumentCourse?.examSubjects || sTrainingForm.examSubjects || [],
                            fileUrl: url,
                            url,
                            fileType: 'LINK',
                            fileSize: '',
                            fileOriginalName: '',
                            linkUrl: undefined,
                          };
                        }
                        return {
                          ...sTrainingForm,
                          courseId: selectedDocumentCourse?.id || '',
                          courseName: selectedDocumentCourse?.title || (sTrainingForm.courseId ? sTrainingForm.courseName : ''),
                          examSubjects: selectedDocumentCourse?.examSubjects || sTrainingForm.examSubjects || [],
                          fileType: sTrainingForm.fileType || 'PDF',
                        };
                      })()
                      : sTrainingForm;
                    if (sTrainingForm.id) {
                      updateStudentTrainingItem(sTrainingTab, sTrainingForm.id, sTrainingPayload);
                    } else {
                      addStudentTrainingItem(sTrainingTab, { ...sTrainingPayload, createdAt: new Date().toISOString().split('T')[0] });
                    }
                    setSTrainingForm(null);
                  }} className="w-full sm:w-auto min-h-11 justify-center bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-2xl font-bold text-[15px] shadow-md transition flex items-center gap-2">
                    <Save size={15} /> {sTrainingForm.id ? 'Cập nhật' : 'Thêm mới'}
                  </button>
                </div>
              )}

              {/* ===== EXAM RESULTS TAB - ĐỌC TỪ students.examProgress ===== */}
              {sTrainingTab === 'exam-results' && (() => {
                // Flatten all students' examProgress into rows
                const allRows = (students || []).flatMap(s => 
                  (s.examProgress || [])
                    .filter(ep => ep.status && ep.status !== 'chua_thi')
                    .map(ep => ({
                      studentId: s._id || s.id,
                      studentName: s.name,
                      course: s.course,
                      subjectId: ep.id,
                      subjectLabel: examSubjectLabels.get(ep.id) || ep.id,
                      score: ep.tracNghiem?.score ?? 0,
                      total: ep.tracNghiem?.total ?? 15,
                      tracNghiem: ep.tracNghiem || { score: 0, total: 0 },
                      hasTracNghiem: Boolean(ep.tracNghiem && Number(ep.tracNghiem.total) > 0),
                      thucHanh: ep.thucHanh || 'chua_nop',
                      essayFile: ep.essayFile || '',
                      essayScore: ep.essayScore ?? null,
                      status: ep.status,
                      lockUntil: ep.lockUntil,
                    }))
                );
                const filtered = allRows.filter(r => 
                  !erSearch || r.studentName?.toLowerCase().includes(erSearch.toLowerCase())
                );
                const visibleSummary = filtered.reduce((summary, row) => {
                  const status = getExamProgressDisplayStatus(row);
                  if (status === 'dat') summary.dat += 1;
                  else if (status === 'cho_nop') summary.choNop += 1;
                  else if (status === 'cho_cham') summary.choCham += 1;
                  else if (status === 'dang_thi') summary.dangThi += 1;
                  else if (status === 'khong_dat') summary.khongDat += 1;
                  return summary;
                }, { dat: 0, choNop: 0, choCham: 0, dangThi: 0, khongDat: 0 });

                // Helper: save essay score to student's examProgress
                const saveEssayScore = async (studentId, subjectId, newScore) => {
                  const student = (students || []).find(s => (s._id || s.id) === studentId);
                  if (!student) return;
                  const progress = (student.examProgress || []).map(ep => ({...ep}));
                  const idx = progress.findIndex(ep => ep.id === subjectId);
                  if (idx === -1) return;
                  progress[idx].essayScore = newScore;
                  const subjectLabel = examSubjectLabels.get(subjectId) || subjectId;
                  // Nếu trắc nghiệm đạt >= 50% VÀ tự luận >= 5 => đạt, nếu < 5 => rớt + khóa 7 ngày
                  const tn = progress[idx].tracNghiem;
                  const tnPct = tn ? Math.round((tn.score / tn.total) * 100) : 0;
                  let finalResult = null;
                  if (tnPct >= 50 && progress[idx].thucHanh === 'da_nop') {
                    if (newScore >= 5) {
                      progress[idx].status = 'dat';
                      progress[idx].lockUntil = null;
                      finalResult = 'dat';
                    } else {
                      progress[idx].status = 'khong_dat';
                      progress[idx].lockUntil = Date.now() + 7 * 24 * 60 * 60 * 1000;
                      finalResult = 'khong_dat';
                    }
                  }
                  try {
                    await ctxUpdateStudent(studentId, { examProgress: progress });
                    toast.success(`Đã chấm ${newScore}/10 điểm tự luận cho ${student.name}!`);
                    // 🔔 Thông báo cho học viên
                    addNotification(studentId, 'student', `📝 Bài thực hành môn ${subjectLabel} đã được chấm: ${newScore}/10 điểm.`);
                    if (finalResult === 'dat') {
                      addNotification(studentId, 'student', `🎉 Chúc mừng! Bạn đã ĐẠT môn ${subjectLabel}!`);
                    } else if (finalResult === 'khong_dat') {
                      addNotification(studentId, 'student', `❌ Bạn CHƯA ĐẠT môn ${subjectLabel}. Môn thi sẽ bị khóa 7 ngày trước khi thi lại.`);
                    }
                  } catch (err) {
                    toast.error('Lỗi khi lưu điểm!');
                  }
                };

                return (
                <div className="space-y-4 animate-in fade-in duration-300">
                  {/* Filters */}
                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                    <div className="relative w-full sm:w-56">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input value={erSearch} onChange={e => setErSearch(e.target.value)}
                        className="w-full pl-8 pr-4 py-2.5 min-h-11 border-2 border-gray-200 rounded-2xl text-[15px] focus:border-amber-400 outline-none"
                        placeholder="Tìm theo tên học viên..." />
                    </div>
                    <span className="text-xs text-gray-400 font-bold sm:ml-auto">
                      {filtered.length} bản ghi
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {[
                      ['ĐẠT', visibleSummary.dat, 'border-emerald-200 bg-emerald-50 text-emerald-700'],
                      ['CHỜ NỘP', visibleSummary.choNop, 'border-blue-200 bg-blue-50 text-blue-700'],
                      ['CHỜ CHẤM', visibleSummary.choCham, 'border-amber-200 bg-amber-50 text-amber-700'],
                      ['ĐANG THI', visibleSummary.dangThi, 'border-yellow-200 bg-yellow-50 text-yellow-700'],
                      ['RỚT', visibleSummary.khongDat, 'border-red-200 bg-red-50 text-red-700'],
                    ].map(([label, count, classes]) => (
                      <div key={label} className={`rounded-xl border px-3 py-2 ${classes}`}>
                        <p className="text-[10px] font-black uppercase tracking-wide">{label}</p>
                        <p className="mt-0.5 text-xl font-black">{count}</p>
                      </div>
                    ))}
                  </div>

                  {filtered.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-14 text-center text-gray-400">
                      <Trophy size={36} className="mx-auto mb-3 text-gray-200" />
                      <p className="text-sm font-bold">Chưa có kết quả thi nào</p>
                      <p className="text-xs text-gray-300 mt-1">Khi học viên hoàn thành bài thi, kết quả sẽ tự động hiện tại đây</p>
                    </div>
                  ) : (
                  /* Table — mobile: vuốt ngang; chữ header rút gọn để thấy đủ cột */
                  <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                    <p className="sm:hidden text-[11px] text-slate-400 px-3 py-1.5 border-b border-slate-50 flex items-center gap-0.5">
                      Vuốt ngang để xem đủ cột
                      <NavArrow size={12} className="text-slate-400" />
                    </p>
                    <div className="cms-table-wrap">
                      <table className="w-full text-left border-collapse min-w-[640px] sm:min-w-[900px]">
                        <thead>
                          <tr className="bg-amber-50 border-b border-amber-100">
                            <th className="px-2.5 sm:px-4 py-2.5 sm:py-3 text-[10px] sm:text-xs font-bold text-amber-700 uppercase tracking-wide whitespace-nowrap">Học viên</th>
                            <th className="px-2.5 sm:px-4 py-2.5 sm:py-3 text-[10px] sm:text-xs font-bold text-amber-700 uppercase tracking-wide whitespace-nowrap">Khóa học</th>
                            <th className="px-2.5 sm:px-4 py-2.5 sm:py-3 text-[10px] sm:text-xs font-bold text-amber-700 uppercase tracking-wide whitespace-nowrap">Môn thi</th>
                            <th className="px-2.5 sm:px-4 py-2.5 sm:py-3 text-[10px] sm:text-xs font-bold text-amber-700 uppercase tracking-wide text-center whitespace-nowrap">
                              <span className="sm:hidden">TN</span><span className="hidden sm:inline">Trắc nghiệm</span>
                            </th>
                            <th className="px-2.5 sm:px-4 py-2.5 sm:py-3 text-[10px] sm:text-xs font-bold text-amber-700 uppercase tracking-wide text-center whitespace-nowrap">
                              <span className="sm:hidden">TL</span><span className="hidden sm:inline">Tự luận (tệp)</span>
                            </th>
                            <th className="px-2.5 sm:px-4 py-2.5 sm:py-3 text-[10px] sm:text-xs font-bold text-amber-700 uppercase tracking-wide text-center whitespace-nowrap">
                              <span className="sm:hidden">Chấm TL</span><span className="hidden sm:inline">Chấm điểm TL</span>
                            </th>
                            <th className="px-2.5 sm:px-4 py-2.5 sm:py-3 text-[10px] sm:text-xs font-bold text-amber-700 uppercase tracking-wide text-center whitespace-nowrap">Trạng thái</th>
                            <th className="px-2.5 sm:px-4 py-2.5 sm:py-3 text-[10px] sm:text-xs font-bold text-amber-700 uppercase tracking-wide text-center whitespace-nowrap">Khóa đến</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {filtered.map((r, idx) => {
                            const pct = r.total > 0 ? Math.round((r.score / r.total) * 100) : 0;
                            const isLocked = r.lockUntil && r.lockUntil > Date.now();
                            const tnPass = pct >= 50;
                            // Đang thi: không lấy điểm TN=0 thành RỚT. Sau khi đạt TN,
                            // phân biệt rõ trạng thái đang chờ học viên nộp file thực hành.
                            const finalStatus = getExamProgressDisplayStatus(r);
                            return (
                              <tr key={`${r.studentId}-${r.subjectId}`} className="hover:bg-amber-50/30 transition-colors">
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-xl bg-orange-500 flex items-center justify-center text-white text-xs font-black">
                                      {(r.studentName || '?')[0]}
                                    </div>
                                    <span className="font-bold text-sm text-gray-800">{r.studentName}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <span className="text-xs font-semibold text-gray-500">{r.course}</span>
                                </td>
                                <td className="px-4 py-3">
                                  <span className="text-xs font-bold text-gray-700">{r.subjectLabel}</span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <div className="flex flex-col items-center">
                                    {r.status === 'dang_thi' && !r.hasTracNghiem ? (
                                      <span className="text-sm font-bold text-gray-400">—</span>
                                    ) : (
                                      <>
                                        <span className={`text-lg font-black ${pct >= 50 ? 'text-sky-700' : 'text-red-500'}`}>{r.score}/{r.total}</span>
                                        <span className="text-xs cms-min-text-xs text-gray-400 font-bold">{pct}%</span>
                                      </>
                                    )}
                                  </div>
                                </td>
                                {/* Cột Tự luận: Chưa nộp / Nút tải xuống */}
                                <td className="px-4 py-3 text-center">
                                  {r.thucHanh === 'da_nop' ? (
                                    r.essayFile ? (
                                      <a href={buildMediaDownloadUrl(r.essayFile, r.essayFile.split('/').pop())} 
                                         target="_blank" rel="noopener noreferrer"
                                         className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-black transition border border-blue-200">
                                        <Download size={12} /> Tải bài
                                      </a>
                                    ) : (
                                      <div className="flex flex-col items-center gap-1 max-w-[200px] mx-auto">
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black bg-sky-50 text-sky-700 border border-sky-200">
                                          ✅ Đã nộp
                                        </span>
                                        <span className="text-xs cms-min-text-xs text-amber-700 font-semibold leading-tight text-center">
                                          Không có file — HV cần nộp lại phần tự luận để lưu bài.
                                        </span>
                                      </div>
                                    )
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black bg-gray-50 text-gray-400 border border-gray-200">
                                      ⏳ Chưa nộp
                                    </span>
                                  )}
                                </td>
                                {/* Cột Chấm điểm Tự luận (0-10) — INLINE INPUT */}
                                <td className="px-4 py-3 text-center">
                                  {r.thucHanh === 'da_nop' ? (() => {
                                    const rowKey = `${r.studentId}-${r.subjectId}`;
                                    const isGrading = gradingRow === rowKey;
                                    if (r.essayScore != null && !isGrading) {
                                      // Đã chấm: hiện điểm + nút chấm lại
                                      return (
                                        <div className="flex flex-col items-center gap-1">
                                          <span className={`text-lg font-black ${r.essayScore >= 5 ? 'text-sky-700' : 'text-red-500'}`}>
                                            {r.essayScore}/10
                                          </span>
                                          <button onClick={() => { setGradingRow(rowKey); setGradingValue(String(r.essayScore)); }}
                                            className="text-xs cms-min-text-xs text-blue-500 hover:text-blue-700 font-bold cursor-pointer">
                                            Chấm lại
                                          </button>
                                        </div>
                                      );
                                    }
                                    if (isGrading) {
                                      // Đang nhập điểm inline
                                      return (
                                        <div className="flex items-center gap-1.5 justify-center">
                                          <input
                                            type="number" min="0" max="10" step="0.5"
                                            value={gradingValue}
                                            onChange={e => setGradingValue(e.target.value)}
                                            onKeyDown={e => {
                                              if (e.key === 'Enter' && gradingValue !== '' && !isNaN(gradingValue)) {
                                                saveEssayScore(r.studentId, r.subjectId, Math.min(10, Math.max(0, Number(gradingValue))));
                                                setGradingRow(null); setGradingValue('');
                                              }
                                              if (e.key === 'Escape') { setGradingRow(null); setGradingValue(''); }
                                            }}
                                            autoFocus
                                            className="w-14 px-2 py-1.5 border-2 border-amber-400 rounded-lg text-center text-sm font-black outline-none focus:border-amber-600 bg-amber-50"
                                            placeholder="0-10"
                                          />
                                          <button onClick={() => {
                                            if (gradingValue !== '' && !isNaN(gradingValue)) {
                                              saveEssayScore(r.studentId, r.subjectId, Math.min(10, Math.max(0, Number(gradingValue))));
                                              setGradingRow(null); setGradingValue('');
                                            }
                                          }} className="inline-flex items-center justify-center min-w-11 min-h-11 p-3 bg-red-600 text-white rounded-2xl hover:bg-red-700 transition" title="Lưu điểm">
                                            <CheckCircle2 size={16} />
                                          </button>
                                          <button type="button" onClick={() => { setGradingRow(null); setGradingValue(''); }}
                                            className="inline-flex items-center justify-center min-w-11 min-h-11 p-3 bg-gray-200 text-gray-500 rounded-2xl hover:bg-gray-300 transition" title="Huỷ">
                                            <X size={16} />
                                          </button>
                                        </div>
                                      );
                                    }
                                    // Chưa chấm: nút bấm để mở input
                                    return (
                                      <button onClick={() => { setGradingRow(rowKey); setGradingValue(''); }}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-100 text-amber-700 hover:bg-amber-200 rounded-lg text-xs font-black transition border border-amber-300">
                                        ✏️ Chấm điểm
                                      </button>
                                    );
                                  })() : (
                                    <span className="text-xs text-gray-300">—</span>
                                  )}
                                </td>
                                {/* Trạng thái tổng hợp */}
                                <td className="px-4 py-3 text-center">
                                  <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-black ${
                                    finalStatus === 'dat' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : finalStatus === 'khong_dat' ? 'bg-red-50 text-red-600 border border-red-200'
                                    : finalStatus === 'cho_cham' ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                    : finalStatus === 'cho_nop' ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                    : finalStatus === 'dang_thi' ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                                    : 'bg-gray-50 text-gray-500 border border-gray-200'
                                  }`}>
                                    {finalStatus === 'dat' && <><CheckCircle2 size={11} /> ĐẠT</>}
                                    {finalStatus === 'khong_dat' && <><XCircle size={11} /> RỚT</>}
                                    {finalStatus === 'dang_thi' && '⏳ ĐANG THI'}
                                    {finalStatus === 'cho_nop' && '📎 CHỜ NỘP TỰ LUẬN'}
                                    {finalStatus === 'cho_cham' && '📝 CHỜ CHẤM'}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  {isLocked ? (
                                    <div className="group relative inline-flex flex-col items-center cursor-pointer">
                                      <span className="text-xs font-bold text-red-500 group-hover:opacity-30 transition-opacity">
                                        🔒 {new Date(r.lockUntil).toLocaleDateString('vi-VN')}
                                      </span>
                                      <button
                                        onClick={() => {
                                          showGlobalModal({
                                            title: 'Mở khóa cho học viên thi lại?',
                                            content: `Bạn có chắc muốn mở khóa môn "${r.subjectLabel}" cho học viên ${r.studentName}? Học viên sẽ được phép thi lại ngay lập tức.`,
                                            type: 'question',
                                            confirmText: 'Mở khóa',
                                            cancelText: 'Huỷ',
                                            onConfirm: async () => {
                                              const student = (students || []).find(s => (s._id || s.id) === r.studentId);
                                              if (!student) return;
                                              const progress = (student.examProgress || []).map(ep => ({...ep}));
                                              const epIdx = progress.findIndex(ep => ep.id === r.subjectId);
                                              if (epIdx === -1) return;
                                              // Xóa khóa + reset trạng thái để thi lại
                                              progress[epIdx].attemptCount = (progress[epIdx].attemptCount || 0) + 1;
                                              progress[epIdx].lockUntil = null;
                                              progress[epIdx].status = 'chua_thi';
                                              progress[epIdx].tracNghiem = null;
                                              progress[epIdx].thucHanh = 'chua_nop';
                                              progress[epIdx].essayScore = null;
                                              progress[epIdx].essayFile = null;
                                              try {
                                                await ctxUpdateStudent(r.studentId, { examProgress: progress });
                                                toast.success(`Đã mở khóa "${r.subjectLabel}" cho ${r.studentName}. Học viên có thể thi lại!`);
                                                // 🔔 Thông báo cho học viên
                                                addNotification(r.studentId, 'student', `🔓 Môn ${r.subjectLabel} đã được mở khóa! Bạn có thể thi lại ngay bây giờ.`);
                                              } catch (err) {
                                                toast.error('Lỗi khi mở khóa!');
                                              }
                                            }
                                          });
                                        }}
                                        className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200"
                                      >
                                        <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-black shadow-lg hover:bg-red-700 transition whitespace-nowrap">
                                          🔓 Mở khóa thi lại
                                        </span>
                                      </button>
                                    </div>
                                  ) : r.status === 'khong_dat' ? (
                                    <button
                                      onClick={() => {
                                        showGlobalModal({
                                          title: 'Cho học viên thi lại?',
                                          content: `Bạn có chắc muốn reset môn "${r.subjectLabel}" cho học viên ${r.studentName}? Học viên sẽ được phép thi lại.`,
                                          type: 'question',
                                          confirmText: 'Cho thi lại',
                                          cancelText: 'Huỷ',
                                          onConfirm: async () => {
                                            const student = (students || []).find(s => (s._id || s.id) === r.studentId);
                                            if (!student) return;
                                            const progress = (student.examProgress || []).map(ep => ({...ep}));
                                            const epIdx = progress.findIndex(ep => ep.id === r.subjectId);
                                            if (epIdx === -1) return;
                                            progress[epIdx].attemptCount = (progress[epIdx].attemptCount || 0) + 1;
                                            progress[epIdx].lockUntil = null;
                                            progress[epIdx].status = 'chua_thi';
                                            progress[epIdx].tracNghiem = null;
                                            progress[epIdx].thucHanh = 'chua_nop';
                                            progress[epIdx].essayScore = null;
                                            progress[epIdx].essayFile = null;
                                            try {
                                              await ctxUpdateStudent(r.studentId, { examProgress: progress });
                                              toast.success(`Đã mở cho ${r.studentName} thi lại "${r.subjectLabel}"!`);
                                              // 🔔 Thông báo cho học viên
                                              addNotification(r.studentId, 'student', `🔓 Môn ${r.subjectLabel} đã được cấp quyền thi lại! Bạn có thể vào thi ngay.`);
                                            } catch (err) {
                                              toast.error('Lỗi khi reset bài thi!');
                                            }
                                          }
                                        });
                                      }}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-bold transition border border-blue-200"
                                    >
                                      🔓 Cho thi lại
                                    </button>
                                  ) : (
                                    <span className="text-xs text-gray-300">—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  )}
                </div>
                );
              })()}

              {/* List items (training content) */}
              {sTrainingTab !== 'exam-results' && sTrainingTab !== 'questions' && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    {sTrainingTab === 'videos' && courseCatalogError && (
                      <div className="border-b border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                        Không thể đồng bộ danh mục khóa học: {courseCatalogError}
                      </div>
                    )}
                    {sTrainingTab === 'videos' && unlinkedVideoItems.length > 0 && (
                      <div className="border-b border-amber-100 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-800">
                        Có {unlinkedVideoItems.length} nội dung cũ chưa khớp khóa trong danh mục. Mở chỉnh sửa và liên kết với khóa đã tạo để đồng bộ.
                      </div>
                    )}
                    {trainingItems.map(item => (
                      <div key={item.id} className="px-4 sm:px-6 lg:px-8 py-4 lg:py-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between hover:bg-gray-50/50 transition border-b border-gray-50 last:border-b-0">
                        <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1 w-full">
                          {sTrainingTab === 'videos' && (
                            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center flex-shrink-0 cursor-pointer hover:scale-105 transition overflow-hidden" onClick={() => setSCourseBuilderMode(item)}>
                              {item.coverImage ? (
                                <img src={resolveMediaUrl(item.coverImage)} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <BookOpen size={20} className="text-white" />
                              )}
                            </div>
                          )}

                          {sTrainingTab === 'files' && (
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xs font-black text-white flex-shrink-0 shadow-sm ${item.fileType === 'PDF' ? 'bg-red-500' : item.fileType === 'PPTX' ? 'bg-orange-500' : 'bg-sky-500'
                              }`}>
                              {item.fileType || 'FILE'}
                            </div>
                          )}
                          {sTrainingTab === 'softwareLinks' && (
                            <div className="w-12 h-12 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center flex-shrink-0">
                              <Link2 size={20} aria-hidden="true" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-[15px] sm:text-base text-gray-800 line-clamp-2">{item.title}</p>
                            {sTrainingTab === 'videos' && item.isUnlinkedVideo && (
                              <p className="mt-0.5 text-xs font-semibold text-amber-700">Chưa liên kết danh mục khóa học</p>
                            )}
                            {sTrainingTab === 'videos' && item.isCourseCatalogItem && (
                              <p className="mt-0.5 text-xs text-slate-500">
                                {item.examSubjects?.length || 0} môn · {item.totalSessions || 0} buổi
                                {item.status && item.status !== 'published' ? ` · ${item.status}` : ''}
                              </p>
                            )}
                            {sTrainingTab === 'files' && item.courseName && (
                              <p className="text-xs sm:text-[13px] text-sky-700 font-bold mt-0.5">Khóa: {item.courseName}</p>
                            )}
                            {sTrainingTab === 'files' && !item.courseId && !findDocumentCourse(dbCourses, item) && (
                              <p className="text-xs font-semibold text-amber-700 mt-0.5">Chưa liên kết khóa trong danh mục</p>
                            )}
                            {sTrainingTab === 'softwareLinks' && item.linkUrl && (
                              <p className="text-xs sm:text-[13px] text-sky-700 font-semibold mt-0.5 truncate">{item.linkUrl}</p>
                            )}
                            <p className="text-xs sm:text-[13px] text-gray-400 line-clamp-2">
                              {sTrainingTab === 'softwareLinks'
                                ? (item.description || (item.installGuide || '').replace(/<[^>]*>/g, '') || '').slice(0, 80)
                                : (item.desc?.replace(/<[^>]*>/g, '') || '').slice(0, 80)}
                            </p>
                            {item.duration && <p className="text-xs text-green-500 mt-0.5">⏱ {item.duration}</p>}
                            {item.fileSize && <p className="text-xs text-gray-400 mt-0.5">{item.fileSize}</p>}
                          </div>
                        </div>
                        <div className="cms-card-actions w-full sm:w-auto sm:ml-3 self-stretch sm:self-auto">
                          {sTrainingTab === 'videos' && (
                             <button type="button" onClick={() => setSCourseBuilderMode(item)} className="cms-btn cms-btn-outline cms-btn-sm text-sky-700 border-sky-100 bg-sky-50 hover:bg-sky-100">
                               <Layers size={13} /> Giáo trình
                             </button>
                          )}
                          <button type="button" onClick={() => {
                            const linkedCourse = sTrainingTab === 'files'
                              ? findDocumentCourse(dbCourses, item)
                              : null;
                            setSTrainingForm({
                              ...item,
                              ...(linkedCourse ? {
                                courseId: String(linkedCourse._id || linkedCourse.id),
                                courseName: linkedCourse.name,
                                examSubjects: Array.isArray(linkedCourse.examSubjects) ? linkedCourse.examSubjects : [],
                              } : {}),
                            });
                          }}
                            className="cms-btn cms-btn-outline cms-btn-icon text-sky-600" aria-label="Chỉnh sửa" title="Chỉnh sửa"><Edit3 size={16} /></button>
                          {!item.isCourseCatalogItem && <button type="button" onClick={() => {
                            showGlobalModal({
                              title: 'Xác nhận xoá tài liệu',
                              content: `Bạn có chắc muốn xoá tài liệu "${item.title}" dành cho học viên không?`,
                              type: 'warning',
                              confirmText: 'Xoá vĩnh viễn',
                              cancelText: 'Huỷ bỏ',
                              onConfirm: () => removeStudentTrainingItem(sTrainingTab, item.id)
                            });
                          }} className="cms-btn cms-btn-outline cms-btn-icon text-red-600" aria-label="Xóa" title="Xóa"><Trash2 size={16} /></button>}
                        </div>
                      </div>
                    ))}
                  {trainingItems.length === 0 && (
                    <div className="p-12 text-center text-gray-400">
                      <BookOpen size={40} className="mx-auto mb-3 text-gray-300" />
                      <p className="text-sm">
                        {sTrainingTab === 'videos' && courseCatalogLoading
                          ? 'Đang tải danh sách khóa học…'
                          : sTrainingTab === 'videos'
                            ? 'Chưa có khóa học trong danh mục'
                            : 'Chưa có nội dung nào'}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {sTrainingTab === 'videos'
                          ? 'Tạo khóa tại mục Quản lý Học phí Khóa học để khóa xuất hiện đồng bộ ở đây.'
                          : 'Bấm "Thêm" để tạo nội dung đào tạo cho học viên'}
                      </p>
                    </div>
                  )}
                 </div>
              )}

            </>
              )}
            </>
            )}
            </div>

          {erForm && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <div className="bg-white rounded-[32px] w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in duration-300">
                <div className="bg-gradient-to-r from-amber-600 to-orange-500 px-4 sm:px-8 py-4 sm:py-5 flex items-center justify-between gap-3 text-white">
                  <h3 className="font-bold text-lg sm:text-xl flex items-center gap-2 sm:gap-3 min-w-0">
                    <Trophy size={22} className="shrink-0" /> {erForm.id ? 'Chỉnh sửa / Chấm điểm' : 'Thêm kết quả thi mới'}
                  </h3>
                  <button type="button" onClick={() => setErForm(null)} className="shrink-0 inline-flex items-center justify-center min-w-11 min-h-11 hover:bg-white/10 rounded-full transition"><X size={20} /></button>
                </div>
                <div className="p-4 sm:p-8 space-y-5 max-h-[75vh] overflow-y-auto">
                  {/* Chọn học viên */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Học viên</label>
                      <CmsSelect
                        value={erForm.studentId || ''}
                        onChange={e => {
                          const s = safeStudentsList.find(x => String(x.id) === e.target.value || String(x._id) === e.target.value);
                          setErForm({ ...erForm, studentId: e.target.value, studentName: s?.name || '' });
                        }}
                        className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-amber-500 outline-none text-sm font-bold"
                      >
                        <option value="">-- Chọn học viên --</option>
                        {safeStudentsList.map(s => (
                          <option key={s.id || s._id} value={s.id || s._id}>{s.name}</option>
                        ))}
                      </CmsSelect>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Môn / Khóa học thi</label>
                      <CmsSelect value={erForm.subject || ''} onChange={e => setErForm({ ...erForm, subject: e.target.value })}
                        className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-amber-500 outline-none text-sm font-bold">
                        <option value="">-- Chọn môn kiểm thử --</option>
                        {getExamSubjectOptions(examSubjectsCatalog).map(({ id, label }) => (
                          <option key={id} value={id}>{label}</option>
                        ))}
                      </CmsSelect>
                    </div>
                  </div>

                  {/* Trắc nghiệm */}
                  <div className="bg-blue-50 rounded-2xl p-4 space-y-3 border border-blue-100">
                    <p className="text-xs font-black text-blue-700 uppercase tracking-widest">📝 Phần Trắc nghiệm</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Số câu đúng</label>
                        <input type="number" min="0"
                          value={erForm.multipleChoiceCorrect || ''}
                          onChange={e => setErForm({ ...erForm, multipleChoiceCorrect: e.target.value })}
                          className="w-full border-2 border-blue-200 rounded-xl p-3 focus:border-blue-500 outline-none text-sm font-bold text-blue-800"
                          placeholder="30" />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Tổng số câu</label>
                        <input type="number" min="0"
                          value={erForm.multipleChoiceTotal || ''}
                          onChange={e => setErForm({ ...erForm, multipleChoiceTotal: e.target.value })}
                          className="w-full border-2 border-blue-200 rounded-xl p-3 focus:border-blue-500 outline-none text-sm font-bold text-blue-800"
                          placeholder="40" />
                      </div>
                    </div>
                    {erForm.multipleChoiceTotal > 0 && (
                      <p className="text-xs text-blue-600 font-bold">
                        Tỉ lệ: {Math.round((erForm.multipleChoiceCorrect / erForm.multipleChoiceTotal) * 100) || 0}%
                        {' '}({Number(erForm.multipleChoiceCorrect) >= Number(erForm.multipleChoiceTotal) * 0.7 ? '✅ Đạt phần trắc nghiệm' : '❌ Chưa đạt'})
                      </p>
                    )}
                  </div>

                  {/* Tự luận */}
                  <div className="bg-red-50 rounded-2xl p-4 space-y-3 border border-red-100">
                    <p className="text-xs font-black text-sky-700 uppercase tracking-widest">✍️ Phần tự luận (quản trị tự chấm)</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Điểm tự luận (0–10)</label>
                        <input type="number" min="0" max="10" step="0.5"
                          value={erForm.essayScore !== undefined ? erForm.essayScore : ''}
                          onChange={e => setErForm({ ...erForm, essayScore: e.target.value })}
                          className="w-full border-2 border-red-200 rounded-xl p-3 focus:border-green-500 outline-none text-sm font-bold text-red-800"
                          placeholder="7.5" />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Ngày thi</label>
                        <input type="date"
                          value={erForm.date || ''}
                          onChange={e => setErForm({ ...erForm, date: e.target.value })}
                          className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-amber-500 outline-none text-sm" />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Nhận xét tự luận</label>
                      <textarea value={erForm.essayNote || ''} onChange={e => setErForm({ ...erForm, essayNote: e.target.value })}
                        rows={2} className="w-full border-2 border-red-100 rounded-xl p-3 focus:border-green-500 outline-none text-sm resize-none"
                        placeholder="Nhận xét bài tự luận, ghi chú..." />
                    </div>
                  </div>

                  {/* Kết quả tổng */}
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center bg-gray-50 rounded-2xl p-4 border border-gray-100">
                    <p className="text-[15px] font-black text-gray-700 flex-1">Kết quả tổng: Đạt môn?</p>
                    <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                      <button onClick={() => setErForm({ ...erForm, passed: true })}
                        className={`flex-1 px-8 py-3 rounded-2xl text-[13px] font-black transition-all duration-300 border-2 ${
                          erForm.passed 
                            ? 'bg-emerald-600 border-transparent text-white shadow-md scale-[1.02]' 
                            : 'bg-white border-gray-200 text-gray-400 hover:border-emerald-200 hover:text-emerald-500 hover:bg-emerald-50/50 hover:scale-[1.02]'
                        }`}>ĐẠT</button>
                      <button onClick={() => setErForm({ ...erForm, passed: false })}
                        className={`flex-1 px-8 py-3 rounded-2xl text-[13px] font-black transition-all duration-300 border-2 ${
                          !erForm.passed 
                            ? 'bg-red-600 border-transparent text-white shadow-md scale-[1.02]' 
                            : 'bg-white border-gray-200 text-gray-400 hover:border-red-200 hover:text-red-500 hover:bg-red-50/50 hover:scale-[1.02]'
                        }`}>CHƯA ĐẠT</button>
                    </div>
                  </div>
                </div>

                <div className="px-4 sm:px-8 pb-4 sm:pb-8 flex flex-col sm:flex-row gap-3">
                  <button type="button" onClick={() => setErForm(null)} className="flex-1 min-h-11 py-3 border-2 border-gray-200 rounded-2xl font-semibold text-gray-600">Huỷ</button>
                  <button type="button" onClick={() => {
                    if (!erForm.studentName?.trim()) { toast.error('Vui lòng chọn học viên!'); return; }
                    if (!erForm.subject?.trim()) { toast.error('Vui lòng chọn môn thi!'); return; }
                    if (erForm.id) {
                      updateExamResult(erForm.id, erForm);
                      toast.success('Đã cập nhật kết quả thi!');
                    } else {
                      addExamResult(erForm);
                      toast.success('Đã thêm kết quả thi!');
                    }
                    setErForm(null);
                  }} className="flex-1 min-h-11 py-3 bg-gradient-to-r from-amber-600 to-orange-500 text-white rounded-2xl font-bold flex items-center justify-center gap-2">
                    <Save size={16} /> {erForm.id ? 'Cập nhật' : 'Lưu kết quả'}
                  </button>
                </div>
              </div>
            </div>
          )}
    </>
  );
}
