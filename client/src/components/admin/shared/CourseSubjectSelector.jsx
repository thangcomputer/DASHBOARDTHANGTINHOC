import React, { useEffect, useMemo, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { apiFetch } from '../../../services/api';
import { BUILTIN_EXAM_SUBJECTS, getExamSubjectOptions } from '../../../utils/examSubjects';

export default function CourseSubjectSelector({
  catalog,
  value = [],
  onChange,
  accent = 'blue',
}) {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const subjectCatalog = catalog || BUILTIN_EXAM_SUBJECTS;
  const subjectOptions = useMemo(
    () => new Map(getExamSubjectOptions(subjectCatalog).map((subject) => [String(subject.id), subject])),
    [subjectCatalog],
  );
  const selected = Array.isArray(value) ? value.map(String) : [];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await apiFetch('/courses');
        const json = await response.json();
        if (!response.ok || !json?.success) {
          throw new Error(json?.message || 'Không tải được danh mục khóa học');
        }
        if (!cancelled) {
          setCourses(Array.isArray(json.data) ? json.data : []);
          setError('');
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || 'Không tải được danh mục khóa học');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const courseGroups = courses.map((course) => ({
    id: String(course._id || course.id),
    name: String(course.name || '').trim(),
    subjects: [...new Set((Array.isArray(course.examSubjects) ? course.examSubjects : []).map(String))]
      .map((id) => ({ id, label: subjectOptions.get(id)?.label || id }))
      .filter((subject) => subject.id),
  })).filter((course) => course.id && course.name && course.subjects.length);

  const courseSubjectIds = new Set(courseGroups.flatMap((course) => course.subjects.map((subject) => subject.id)));
  const legacySubjects = selected
    .filter((id) => !courseSubjectIds.has(id))
    .map((id) => ({ id, label: subjectOptions.get(id)?.label || id }));

  const toggleSubject = (subjectId) => {
    const next = selected.includes(subjectId)
      ? selected.filter((id) => id !== subjectId)
      : [...selected, subjectId];
    onChange(next);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2 text-xs text-slate-500">
        <Loader2 size={14} className="animate-spin" /> Đang tải khóa học và môn học…
      </div>
    );
  }
  if (error) return <p className="py-2 text-xs text-red-600">{error}</p>;

  return (
    <div className="space-y-3">
      <label className="cms-label">
        Môn học <span className="text-red-500">*</span>
        {selected.length > 0 && (
          <span className="ml-1.5 normal-case tracking-normal font-semibold text-slate-400">({selected.length} đã chọn)</span>
        )}
      </label>
      {courseGroups.map((course) => (
        <section key={course.id} className="rounded-xl border border-slate-200 bg-white p-3">
          <h4 className="text-sm font-bold text-slate-800">{course.name}</h4>
          <div className="mt-2 flex flex-wrap gap-2">
            {course.subjects.map((subject) => {
              const checked = selected.includes(subject.id);
              return (
                <button
                  key={`${course.id}-${subject.id}`}
                  type="button"
                  aria-pressed={checked}
                  onClick={() => toggleSubject(subject.id)}
                  className={`inline-flex min-h-8 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition ${
                    checked
                      ? accent === 'red' ? 'border-red-200 bg-red-50 text-red-700' : 'border-sky-200 bg-sky-50 text-sky-700'
                      : 'border-slate-100 bg-slate-50/70 text-slate-500 hover:border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded border ${
                    checked
                      ? accent === 'red' ? 'border-red-500 bg-red-500 text-white' : 'border-sky-500 bg-sky-500 text-white'
                      : 'border-slate-300 bg-white'
                  }`}>
                    {checked && <Check size={10} strokeWidth={3} />}
                  </span>
                  <span>{subject.label}</span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
      {legacySubjects.length > 0 && (
        <section className="rounded-xl border border-amber-200 bg-amber-50/50 p-3">
          <h4 className="text-xs font-bold text-amber-800">Môn cũ chưa gắn với khóa hiện có</h4>
          <div className="mt-2 flex flex-wrap gap-2">
            {legacySubjects.map((subject) => {
              const checked = selected.includes(subject.id);
              return (
                <button
                  key={subject.id}
                  type="button"
                  aria-pressed={checked}
                  onClick={() => toggleSubject(subject.id)}
                  className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-amber-200 bg-white px-2.5 py-1 text-xs text-amber-800"
                >
                  <span className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded border ${checked ? 'border-amber-600 bg-amber-600 text-white' : 'border-amber-300 bg-white'}`}>
                    {checked && <Check size={10} strokeWidth={3} />}
                  </span>
                  {subject.label}
                </button>
              );
            })}
          </div>
        </section>
      )}
      {!courseGroups.length && !legacySubjects.length && (
        <p className="text-xs text-amber-600">
          {courses.length
            ? 'Các khóa học hiện có chưa được gắn môn học.'
            : 'Chưa có khóa học trong danh mục admin để lấy môn.'}
        </p>
      )}
    </div>
  );
}
