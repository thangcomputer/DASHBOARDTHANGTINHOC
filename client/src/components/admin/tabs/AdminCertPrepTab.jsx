import { useEffect, useState } from 'react';
import { BookOpen, ChevronRight, Plus, X } from 'lucide-react';
import { useToast } from '../../../utils/toast';
import certPrepApi, { certPrepErrorMessage } from '../../../services/certPrepApi';
import useCertPrepAdmin from '../../../hooks/useCertPrepAdmin';
import CertPrepOverview from '../certPrep/CertPrepOverview';
import CertPrepCourseList from '../certPrep/CertPrepCourseList';
import CertPrepCourseForm from '../certPrep/CertPrepCourseForm';
import CertPrepLevelList from '../certPrep/CertPrepLevelList';
import CertPrepLevelForm from '../certPrep/CertPrepLevelForm';
import CertPrepTestList from '../certPrep/CertPrepTestList';
import CertPrepTestForm from '../certPrep/CertPrepTestForm';
import CertPrepQuestionList from '../certPrep/CertPrepQuestionList';
import CertPrepQuestionForm from '../certPrep/CertPrepQuestionForm';
import CertPrepQuestionPreview from '../certPrep/CertPrepQuestionPreview';
import CertPrepAccessManager from '../certPrep/CertPrepAccessManager';
import CertPrepEnrollmentMappingPanel from '../certPrep/CertPrepEnrollmentMappingPanel';
import CertPrepConfirmDialog from '../certPrep/CertPrepConfirmDialog';

const TABS = [
  { key: 'courses', label: 'Khóa học' },
  { key: 'levels', label: 'Cấp độ' },
  { key: 'tests', label: 'Đề thi' },
  { key: 'questions', label: 'Câu hỏi' },
  { key: 'access', label: 'Cấp quyền' },
  { key: 'enrollment', label: 'Liên kết khóa học' },
];

export default function AdminCertPrepTab() {
  const toast = useToast();
  const admin = useCertPrepAdmin();
  const [section, setSection] = useState('courses');
  const [course, setCourse] = useState(null);
  const [level, setLevel] = useState(null);
  const [test, setTest] = useState(null);

  const [courseForm, setCourseForm] = useState(null);
  const [levelForm, setLevelForm] = useState(null);
  const [testForm, setTestForm] = useState(null);
  const [questionForm, setQuestionForm] = useState(null);
  const [previewQ, setPreviewQ] = useState(null);
  const [previewTestQs, setPreviewTestQs] = useState(null);
  const [confirm, setConfirm] = useState(null);

  useEffect(() => {
    admin.loadCourses().catch((err) => toast.error(certPrepErrorMessage(err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goSection = async (key) => {
    if (key === 'levels' && !course) return;
    if (key === 'tests' && !level) return;
    if (key === 'questions' && !test) return;
    setSection(key);
    try {
      if (key === 'courses') await admin.loadCourses();
      if (key === 'levels' && course) await admin.loadLevels(course._id || course.id);
      if (key === 'tests' && level) await admin.loadTests(level._id || level.id);
      if (key === 'questions' && test) await admin.loadQuestions(test._id || test.id);
      if (key === 'access') {
        await admin.loadCourses();
        await admin.loadAccess();
      }
      if (key === 'enrollment') await admin.loadCourses();
    } catch (err) {
      toast.error(certPrepErrorMessage(err));
    }
  };

  const openCourse = async (c) => {
    setCourse(c);
    setLevel(null);
    setTest(null);
    setSection('levels');
    try { await admin.loadLevels(c._id || c.id); } catch (err) { toast.error(certPrepErrorMessage(err)); }
  };
  const openLevel = async (lv) => {
    setLevel(lv);
    setTest(null);
    setSection('tests');
    try { await admin.loadTests(lv._id || lv.id); } catch (err) { toast.error(certPrepErrorMessage(err)); }
  };
  const openTest = async (t) => {
    setTest(t);
    setSection('questions');
    try { await admin.loadQuestions(t._id || t.id); } catch (err) { toast.error(certPrepErrorMessage(err)); }
  };

  const handleError = (err) => toast.error(certPrepErrorMessage(err));

  const saveCourse = (body) => admin.runSave(async () => {
    try {
      if (courseForm?._id || courseForm?.id) await certPrepApi.courses.update(courseForm._id || courseForm.id, body);
      else await certPrepApi.courses.create(body);
      toast.success('Đã lưu khóa học');
      setCourseForm(null);
      await admin.loadCourses();
    } catch (err) { handleError(err); }
  });

  const saveLevel = (body) => admin.runSave(async () => {
    try {
      const cid = course._id || course.id;
      if (levelForm?._id || levelForm?.id) await certPrepApi.levels.update(levelForm._id || levelForm.id, body);
      else await certPrepApi.levels.create(cid, body);
      toast.success('Đã lưu level');
      setLevelForm(null);
      await admin.loadLevels(cid);
    } catch (err) { handleError(err); }
  });

  const saveTest = (body) => admin.runSave(async () => {
    try {
      const lid = level._id || level.id;
      if (testForm?._id || testForm?.id) await certPrepApi.tests.update(testForm._id || testForm.id, body);
      else await certPrepApi.tests.create(lid, body);
      toast.success('Đã lưu đề thi');
      setTestForm(null);
      await admin.loadTests(lid);
    } catch (err) { handleError(err); }
  });

  const saveQuestion = (body) => admin.runSave(async () => {
    try {
      const tid = test._id || test.id;
      if (questionForm?._id || questionForm?.id) await certPrepApi.questions.update(questionForm._id || questionForm.id, body);
      else await certPrepApi.questions.create(tid, body);
      toast.success('Đã lưu câu hỏi');
      setQuestionForm(null);
      await admin.loadQuestions(tid);
    } catch (err) { handleError(err); }
  });

  const toggleActive = (kind, doc) => {
    setConfirm({
      kind,
      doc,
      title: doc.isActive === false ? 'Bật lại?' : 'Vô hiệu hóa?',
      message: doc.isActive === false
        ? 'Mục này sẽ hiện lại cho quản trị và học viên (nếu còn quyền).'
        : 'Sẽ vô hiệu hóa. Lịch sử phiên làm bài không bị xóa.',
    });
  };

  const applyToggle = async () => {
    const { kind, doc } = confirm;
    const next = { isActive: doc.isActive === false };
    setConfirm(null);
    try {
      if (kind === 'course') {
        await certPrepApi.courses.update(doc._id || doc.id, next);
        await admin.loadCourses();
      }
      if (kind === 'level') {
        await certPrepApi.levels.update(doc._id || doc.id, next);
        await admin.loadLevels(course._id || course.id);
      }
      if (kind === 'test') {
        await certPrepApi.tests.update(doc._id || doc.id, next);
        await admin.loadTests(level._id || level.id);
      }
      if (kind === 'question') {
        await certPrepApi.questions.update(doc._id || doc.id, next);
        await admin.loadQuestions(test._id || test.id);
      }
      toast.success(next.isActive ? 'Đã bật' : 'Đã vô hiệu hóa');
    } catch (err) { handleError(err); }
  };

  const moveLevel = async (idx, dir) => {
    const list = [...admin.levels];
    const swap = idx + dir;
    if (swap < 0 || swap >= list.length) return;
    const a = list[idx];
    const b = list[swap];
    try {
      await certPrepApi.levels.update(a._id || a.id, { sortOrder: b.sortOrder ?? swap });
      await certPrepApi.levels.update(b._id || b.id, { sortOrder: a.sortOrder ?? idx });
      await admin.loadLevels(course._id || course.id);
    } catch (err) { handleError(err); }
  };

  const moveQuestion = async (idx, dir) => {
    const list = [...admin.questions];
    const swap = idx + dir;
    if (swap < 0 || swap >= list.length) return;
    const a = list[idx];
    const b = list[swap];
    const items = list.map((q, i) => ({
      id: q._id || q.id,
      sortOrder: i === idx ? (b.sortOrder ?? swap) : i === swap ? (a.sortOrder ?? idx) : (q.sortOrder ?? i),
    }));
    try {
      await certPrepApi.questions.reorder(items);
      await admin.loadQuestions(test._id || test.id);
    } catch (err) { handleError(err); }
  };

  const previewTest = async (t) => {
    try {
      const res = await certPrepApi.questions.list(t._id || t.id);
      setPreviewTestQs({ test: t, questions: res.data || [] });
    } catch (err) { handleError(err); }
  };

  const primaryAdd = () => {
    if (section === 'courses') setCourseForm({});
    if (section === 'levels') setLevelForm({});
    if (section === 'tests') setTestForm({});
    if (section === 'questions') setQuestionForm({});
  };

  return (
    <div className="space-y-4">
      <div className="cms-toolbar">
        <div className="min-w-0">
          <h2 className="text-lg sm:text-xl font-bold text-gray-800 flex items-center gap-2">
            <BookOpen size={20} className="text-red-600" aria-hidden="true" /> Ôn thi MOS/IC3
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">Quản lý chương trình ôn thi</p>
        </div>
        {section !== 'access' && section !== 'enrollment' ? (
          <button type="button" onClick={primaryAdd} className="inline-flex min-h-11 items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-2xl text-sm font-bold shadow-md">
            <Plus size={15} aria-hidden="true" /> {
              section === 'courses' ? 'Thêm khóa học'
                : section === 'levels' ? 'Thêm level'
                  : section === 'tests' ? 'Thêm đề thi'
                    : 'Thêm câu hỏi'
            }
          </button>
        ) : null}
      </div>

      <nav aria-label="Đường dẫn ôn thi" className="flex flex-wrap items-center gap-1 text-sm text-slate-500">
        <button type="button" className="font-bold text-red-600 hover:underline" onClick={() => goSection('courses')}>Ôn thi MOS/IC3</button>
        {course ? (
          <>
            <ChevronRight size={14} aria-hidden="true" />
            <button type="button" className="font-semibold hover:underline" onClick={() => openCourse(course)}>{course.name}</button>
          </>
        ) : null}
        {level ? (
          <>
            <ChevronRight size={14} aria-hidden="true" />
            <button type="button" className="font-semibold hover:underline" onClick={() => openLevel(level)}>{level.title}</button>
          </>
        ) : null}
        {test ? (
          <>
            <ChevronRight size={14} aria-hidden="true" />
            <button type="button" className="font-semibold hover:underline" onClick={() => openTest(test)}>{test.name}</button>
          </>
        ) : null}
      </nav>

      <div className="cms-hscroll-tabs rounded-2xl p-1.5 shadow-sm border border-gray-100 bg-white">
        <div className="cms-hscroll-tabs__track">
          {TABS.map((t) => {
            const disabled = (t.key === 'levels' && !course)
              || (t.key === 'tests' && !level)
              || (t.key === 'questions' && !test);
            return (
              <button
                key={t.key}
                type="button"
                disabled={disabled}
                onClick={() => goSection(t.key)}
                className={`cms-hscroll-tab ${section === t.key ? 'bg-red-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'} disabled:opacity-40`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {section === 'courses' && (
        <>
          <CertPrepOverview courses={admin.courses} />
          <CertPrepCourseList
            courses={admin.courses}
            loading={admin.loadingCourses}
            onCreate={() => setCourseForm({})}
            onEdit={setCourseForm}
            onToggle={(c) => toggleActive('course', c)}
            onOpen={openCourse}
          />
        </>
      )}
      {section === 'levels' && (
        <CertPrepLevelList
          levels={admin.levels}
          loading={admin.loadingLevels}
          onCreate={() => setLevelForm({})}
          onEdit={setLevelForm}
          onToggle={(lv) => toggleActive('level', lv)}
          onOpen={openLevel}
          onMove={moveLevel}
        />
      )}
      {section === 'tests' && (
        <CertPrepTestList
          tests={admin.tests}
          loading={admin.loadingTests}
          onCreate={() => setTestForm({})}
          onEdit={setTestForm}
          onToggle={(t) => toggleActive('test', t)}
          onQuestions={openTest}
          onPreview={previewTest}
        />
      )}
      {section === 'questions' && (
        <CertPrepQuestionList
          questions={admin.questions}
          loading={admin.loadingQuestions}
          onCreate={() => setQuestionForm({})}
          onEdit={setQuestionForm}
          onPreview={setPreviewQ}
          onToggle={(q) => toggleActive('question', q)}
          onMove={moveQuestion}
        />
      )}
      {section === 'access' && (
        <CertPrepAccessManager
          courses={admin.courses}
          rows={admin.accessRows}
          loading={admin.loadingAccess}
          onRefresh={admin.loadAccess}
          toast={toast}
        />
      )}
      {section === 'enrollment' && (
        <CertPrepEnrollmentMappingPanel
          certPrepCourses={admin.courses}
          toast={toast}
        />
      )}

      {courseForm !== null ? (
        <CertPrepCourseForm
          key={String(courseForm._id || courseForm.id || 'new-course')}
          course={courseForm._id || courseForm.id ? courseForm : null}
          saving={admin.saving}
          onSave={saveCourse}
          onClose={() => setCourseForm(null)}
        />
      ) : null}
      {levelForm !== null ? (
        <CertPrepLevelForm
          key={String(levelForm._id || levelForm.id || 'new-level')}
          level={levelForm._id || levelForm.id ? levelForm : null}
          saving={admin.saving}
          onSave={saveLevel}
          onClose={() => setLevelForm(null)}
        />
      ) : null}
      {testForm !== null ? (
        <CertPrepTestForm
          key={String(testForm._id || testForm.id || 'new-test')}
          test={testForm._id || testForm.id ? testForm : null}
          saving={admin.saving}
          onSave={saveTest}
          onClose={() => setTestForm(null)}
        />
      ) : null}
      {questionForm !== null ? (
        <CertPrepQuestionForm
          key={String(questionForm._id || questionForm.id || 'new-q')}
          question={questionForm._id || questionForm.id ? questionForm : null}
          test={test}
          saving={admin.saving}
          onSave={saveQuestion}
          onClose={() => setQuestionForm(null)}
        />
      ) : null}

      {previewQ ? (
        <div className="cms-modal-shell">
          <div className="cms-modal-panel max-w-2xl p-5 space-y-3" role="dialog" aria-modal="true" aria-label="Xem trước câu hỏi">
            <div className="flex justify-between items-center">
              <h3 className="font-bold">Xem trước câu hỏi</h3>
              <button type="button" aria-label="Đóng" onClick={() => setPreviewQ(null)} className="w-10 h-10 rounded-xl hover:bg-slate-50"><X size={18} /></button>
            </div>
            <CertPrepQuestionPreview question={previewQ} />
          </div>
        </div>
      ) : null}

      {previewTestQs ? (
        <div className="cms-modal-shell">
          <div className="cms-modal-panel max-w-3xl p-5 space-y-3" role="dialog" aria-modal="true" aria-label="Xem trước đề">
            <div className="flex justify-between items-center">
              <h3 className="font-bold">Preview đề · {previewTestQs.test.name}</h3>
              <button type="button" aria-label="Đóng" onClick={() => setPreviewTestQs(null)} className="w-10 h-10 rounded-xl hover:bg-slate-50"><X size={18} /></button>
            </div>
            <p className="text-xs text-amber-700 font-bold uppercase">Admin preview — không tạo session</p>
            <div className="max-h-[70dvh] overflow-y-auto space-y-3">
              {previewTestQs.questions.length ? previewTestQs.questions.map((q) => (
                <CertPrepQuestionPreview key={q._id || q.id} question={q} />
              )) : <p className="text-sm text-slate-500">Chưa có câu hỏi.</p>}
            </div>
          </div>
        </div>
      ) : null}

      <CertPrepConfirmDialog
        open={!!confirm}
        title={confirm?.title}
        message={confirm?.message}
        confirmText={confirm?.doc?.isActive === false ? 'Bật' : 'Vô hiệu hóa'}
        onCancel={() => setConfirm(null)}
        onConfirm={applyToggle}
      />

      {admin.saving ? (
        <div className="sr-only" role="status">Đang lưu...</div>
      ) : null}
    </div>
  );
}
