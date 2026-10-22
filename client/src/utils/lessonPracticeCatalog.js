export function getDirectCourseSubject(course) {
  const subjects = Array.isArray(course.subjects) ? course.subjects : [];
  if (subjects.length === 0 || subjects.length >= 3) return null;
  if (!course.enrolled && course.deliveryMode === 'instructor') return null;
  if (!course.enrolled && course.offerType !== 'single') return null;
  return subjects.find((subject) => subject.opened && subject.id) || subjects.find((subject) => subject.id) || null;
}

export function getCourseProgressPercent(course, progressById) {
  const subjects = Array.isArray(course?.subjects) ? course.subjects : [];
  const totals = subjects.reduce((result, subject) => {
    const progress = progressById?.get(subject.id) || subject;
    result.completed += Math.max(0, Number(progress?.completedUnitCount) || 0);
    result.total += Math.max(0, Number(progress?.totalUnitCount) || 0);
    return result;
  }, { completed: 0, total: 0 });

  return totals.total > 0
    ? Math.min(100, Math.round((totals.completed / totals.total) * 100))
    : 0;
}

export function groupCoveredEnrolledCourses(courses) {
  const rows = Array.isArray(courses) ? courses : [];
  const groupedCourseIds = new Set();
  const groupedCourses = [];
  const bundles = rows.filter((course) =>
    !course.enrolled
    && course.hiddenByEnrollment
    && course.offerType === 'bundle'
    && course.subjects?.length >= 3,
  );

  bundles.forEach((bundle) => {
    const bundleSubjectIds = new Set(
      bundle.subjects.map((subject) => String(subject.id || '')).filter(Boolean),
    );
    if (bundleSubjectIds.size !== bundle.subjects.length) return;

    const singleCourses = rows.filter((course) =>
      course.enrolled
      && course.offerType === 'single'
      && course.deliveryMode === bundle.deliveryMode
      && course.subjects?.length === 1
      && bundleSubjectIds.has(String(course.subjects[0].id || '')),
    );
    const coveredSubjectIds = singleCourses.map((course) => String(course.subjects[0].id));
    if (
      singleCourses.length !== bundleSubjectIds.size
      || new Set(coveredSubjectIds).size !== bundleSubjectIds.size
      || coveredSubjectIds.some((id) => !bundleSubjectIds.has(id))
      || singleCourses.some((course) => groupedCourseIds.has(course.id))
    ) return;

    singleCourses.forEach((course) => groupedCourseIds.add(course.id));
    groupedCourses.push({
      ...bundle,
      enrolled: true,
      hiddenByEnrollment: false,
    });
  });

  return [
    ...groupedCourses,
    ...rows.filter((course) =>
      !groupedCourseIds.has(course.id)
      && (course.enrolled || !course.hiddenByEnrollment),
    ),
  ];
}
