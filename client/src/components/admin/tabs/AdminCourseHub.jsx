import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Loader2, Video } from 'lucide-react';
import api, { apiFetch } from '../../../services/api';
import { useToast } from '../../../utils/useToast';
import {
  SAMPLE_LESSON_VIDEO_URL,
  firstSubjectForCourse,
  publishedWithoutOutline,
  studentVideoCount,
  teacherLessonCount,
} from '../courseReadiness';

const money = new Intl.NumberFormat('vi-VN');

async function readJson(response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) {
    throw new Error(body.message || 'Không tải được dữ liệu');
  }
  return body;
}

async function attachTeacherSample(course) {
  const current = await api.settings.getTrainingData();
  const data = current?.data && typeof current.data === 'object' ? current.data : {};
  const videos = Array.isArray(data.videos) ? data.videos.map((item) => ({ ...item })) : [];
  const courseId = String(course._id);
  const lesson = {
    id: `sample-lesson-${Date.now()}`,
    title: 'Bài mẫu giảng viên',
    type: 'video',
    videoUrl: SAMPLE_LESSON_VIDEO_URL,
    url: SAMPLE_LESSON_VIDEO_URL,
    duration: 0,
    antiSeek: true,
    isPreview: true,
  };
  const chapter = {
    id: `sample-chapter-${Date.now()}`,
    title: 'Chương mẫu',
    lessons: [lesson],
  };
  const index = videos.findIndex((item) => String(item.courseId || item.id || item._id || '') === courseId);
  if (index >= 0) {
    const chapters = Array.isArray(videos[index].chapters) ? videos[index].chapters : [];
    videos[index] = {
      ...videos[index],
      id: videos[index].id || courseId,
      courseId,
      title: course.name,
      name: course.name,
      chapters: [...chapters, chapter],
    };
  } else {
    videos.push({
      id: courseId,
      courseId,
      title: course.name,
      name: course.name,
      chapters: [chapter],
      videos: [lesson],
      lessons: [lesson],
    });
  }
  await api.settings.updateTrainingData({ ...data, videos });
}

async function attachOutline(course) {
  await readJson(await apiFetch(`/courses/${course._id}`, {
    method: 'PUT',
    body: JSON.stringify({
      curriculum: [{
        title: 'Chương 1 - Làm quen',
        sessions: 1,
        duration: '1 giờ 30 phút',
        topics: ['Video bài giảng'],
      }],
    }),
  }));
}

async function attachSampleVideo(subjectId) {
  const listed = await readJson(await apiFetch(`/lesson-practice/subjects/${subjectId}/units`));
  const units = Array.isArray(listed.data) ? listed.data : [];
  let unit = units.find((item) => !String(item.videoUrl || '').trim());
  if (!unit) {
    const created = await readJson(await apiFetch(`/lesson-practice/subjects/${subjectId}/units`, {
      method: 'POST',
      body: JSON.stringify({
        title: 'Bài mẫu - xem video',
        isPreviewAllowed: true,
        antiSeek: false,
      }),
    }));
    unit = created.data;
  }
  await readJson(await apiFetch(`/lesson-practice/units/${unit.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      title: unit.title || 'Bài mẫu - xem video',
      videoUrl: SAMPLE_LESSON_VIDEO_URL,
    }),
  }));
}

export default function AdminCourseHub() {
  const navigate = useNavigate();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [courses, setCourses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teacherVideos, setTeacherVideos] = useState([]);
  const [busyKey, setBusyKey] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [courseBody, subjectBody, trainingBody] = await Promise.all([
        readJson(await apiFetch('/courses?status=all')),
        readJson(await apiFetch('/lesson-practice/subjects')),
        api.settings.getTrainingData(),
      ]);
      setCourses(Array.isArray(courseBody.data) ? courseBody.data : []);
      setSubjects(Array.isArray(subjectBody.data) ? subjectBody.data : []);
      setTeacherVideos(Array.isArray(trainingBody?.data?.videos) ? trainingBody.data.videos : []);
    } catch (err) {
      setError(err.message || 'Không tải được khóa học');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const go = (hash) => navigate({ pathname: '/admin', hash });

  const onAttach = async (course) => {
    const subject = firstSubjectForCourse(subjects, course._id);
    if (!subject) {
      toast.error('Khóa chưa gắn môn thi nên chưa có chỗ lưu video học viên.');
      go('settings?section=pricing');
      return;
    }
    const key = `${course._id}:student`;
    setBusyKey(key);
    try {
      await attachSampleVideo(subject.id);
      toast.success('Đã gắn video học viên. Đổi link trong Luyện tập tự do nếu cần.');
      await load();
    } catch (err) {
      toast.error(err.message || 'Không gắn được video');
    } finally {
      setBusyKey('');
    }
  };

  const run = async (key, action, success) => {
    setBusyKey(key);
    try {
      await action();
      toast.success(success);
      await load();
    } catch (err) {
      toast.error(err.message || 'Không lưu được');
    } finally {
      setBusyKey('');
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <BookOpen size={20} className="text-emerald-600" /> Khóa học
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Giá, video giảng viên và bài học viên vẫn sửa ở màn riêng. Bảng này chỉ báo khóa đang xuất bản mà còn thiếu nội dung.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500 py-10">
          <Loader2 size={18} className="animate-spin" /> Đang tải khóa học
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
          <button type="button" onClick={load} className="ml-3 font-semibold underline">Tải lại</button>
        </div>
      ) : null}

      {!loading && !error && courses.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-sm text-slate-500">
          Chưa có khóa học.
          <button type="button" onClick={() => go('settings?section=pricing')} className="ml-2 font-semibold text-emerald-700">Tạo ở Học phí khóa học</button>
        </div>
      ) : null}

      <div className="space-y-3">
        {courses.map((course) => {
          const id = String(course._id);
          const outlineMissing = publishedWithoutOutline(course);
          const studentVideos = studentVideoCount(subjects, id);
          const teacherLessons = teacherLessonCount(teacherVideos, id);
          const subject = firstSubjectForCourse(subjects, id);
          const gaps = [
            outlineMissing ? 'Chưa có dàn ý chương' : '',
            studentVideos === 0 ? 'Chưa có video học viên' : '',
            teacherLessons === 0 ? 'Chưa có video giảng viên' : '',
          ].filter(Boolean);
          return (
            <article key={id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">{course.name}</h2>
                  <p className="text-sm text-slate-500 mt-1">
                    {money.format(Number(course.price) || 0)} đ
                    {' · '}
                    {course.status === 'published' ? 'Đã xuất bản' : course.status === 'draft' ? 'Bản nháp' : 'Đã lưu trữ'}
                    {' · '}
                    {Array.isArray(course.curriculum) ? course.curriculum.length : 0} chương trong dàn ý
                    {' · '}
                    {studentVideos} video học viên
                    {' · '}
                    {teacherLessons} video giảng viên
                  </p>
                </div>
                {gaps.length === 0 ? (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">Đủ nội dung đã kiểm</span>
                ) : (
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">{gaps.length} mục còn thiếu</span>
                )}
              </div>
              {gaps.length > 0 ? (
                <ul className="mt-3 text-sm text-amber-900 list-disc pl-5">
                  {gaps.map((gap) => <li key={gap}>{gap}</li>)}
                </ul>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => go('settings?section=pricing')} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Giá và dàn ý</button>
                <button type="button" onClick={() => go('training-videos')} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Video giảng viên</button>
                <button type="button" onClick={() => go('lesson-practice')} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Bài học viên</button>
                {outlineMissing ? (
                  <button
                    type="button"
                    onClick={() => run(`${id}:outline`, () => attachOutline(course), 'Đã thêm chương mẫu. Sửa tên trong Học phí khóa học.')}
                    disabled={busyKey === `${id}:outline`}
                    className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 disabled:opacity-60"
                  >
                    Thêm dàn ý mẫu
                  </button>
                ) : null}
                {teacherLessons === 0 ? (
                  <button
                    type="button"
                    onClick={() => run(`${id}:teacher`, () => attachTeacherSample(course), 'Đã gắn video giảng viên. Mở Video đào tạo để sửa chương.')}
                    disabled={busyKey === `${id}:teacher`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60"
                  >
                    {busyKey === `${id}:teacher` ? <Loader2 size={14} className="animate-spin" /> : <Video size={14} />}
                    Gắn video giảng viên
                  </button>
                ) : null}
                {studentVideos === 0 ? (
                  <button
                    type="button"
                    onClick={() => onAttach(course)}
                    disabled={busyKey === `${id}:student`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {busyKey === `${id}:student` ? <Loader2 size={14} className="animate-spin" /> : <Video size={14} />}
                    {subject ? 'Gắn video học viên' : 'Gắn môn rồi thêm video'}
                  </button>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
