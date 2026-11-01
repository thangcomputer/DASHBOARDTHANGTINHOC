import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CheckCircle2, ChevronRight, CircleHelp, Clapperboard, Clock3, GraduationCap, Layers3, Lock, Sparkles } from 'lucide-react-native';
import { AppHeader, AppScreen, Card, EmptyState, ErrorState, LoadingSkeleton } from '../components/ui';
import { useAuth } from '../app/AuthContext';
import { useMockResource } from '../hooks/useMockResource';
import {
  getCourseSubjectUnits,
  getCourseVideoCatalog,
  openCourseVideoUnit,
  type LessonPracticeCourse,
  type LessonPracticeSubject,
  type LessonPracticeUnit,
} from '../services/courseVideoApi';
import { learningService } from '../services/mockService';
import { colors, radius, spacing, typography } from '../theme/tokens';

type CourseFilter = 'all' | 'registered' | 'video' | 'instructor' | 'guide';
type CourseSection = { id: string; title: string; courses: LessonPracticeCourse[] };

const filterOptions: { id: CourseFilter; label: string; displayLabel: string; icon: typeof Layers3 }[] = [
  { id: 'all', label: 'Tất cả', displayLabel: 'Tất cả', icon: Layers3 },
  { id: 'registered', label: 'Khóa đã đăng ký', displayLabel: 'Khóa đã\nđăng ký', icon: CheckCircle2 },
  { id: 'video', label: 'Tự học qua video', displayLabel: 'Tự học\nqua video', icon: Clapperboard },
  { id: 'instructor', label: 'Học cùng giảng viên', displayLabel: 'Học cùng\ngiảng viên', icon: GraduationCap },
  { id: 'guide', label: 'Hướng dẫn học', displayLabel: 'Hướng dẫn\nhọc', icon: CircleHelp },
];

function previewCatalog(): Promise<{ subjects: LessonPracticeSubject[]; courses: LessonPracticeCourse[] }> {
  return learningService.courses().then((courses) => ({
    subjects: [],
    courses: courses.map((course) => {
      const subjectNames = course.software.split(',').map((name) => name.trim()).filter(Boolean);
      return {
        id: course._id,
        name: course.title,
        description: course.description,
        thumbnail: '',
        price: course.price || 0,
        totalSessions: course.totalSessions || 0,
        offerType: subjectNames.length === 1 ? 'single' : 'bundle',
        subjects: subjectNames.map((name, index) => ({
          id: `${course._id}-subject-${index}`,
          name,
          opened: Boolean(course.enrolled),
          totalUnitCount: course.units.length,
          previewUnits: course.units.map((unit) => ({
            id: unit._id,
            title: unit.title,
            locked: false,
            status: unit.sections.every((lesson) => lesson.completed) ? 'completed' : 'open',
          })),
        })),
        lessonCount: course.units.reduce((count, unit) => count + unit.sections.length, 0),
        enrolled: Boolean(course.enrolled),
        deliveryMode: course.deliveryMode || 'video',
      };
    }),
  }));
}

function directSubject(course: LessonPracticeCourse) {
  if (!course.subjects.length || course.subjects.length >= 3) return undefined;
  if (!course.enrolled && course.deliveryMode === 'instructor') return undefined;
  if (!course.enrolled && course.offerType !== 'single') return undefined;
  return course.subjects.find((subject) => subject.opened && subject.id)
    || course.subjects.find((subject) => subject.id);
}

function courseProgress(course: LessonPracticeCourse) {
  const completed = course.subjects.reduce((sum, subject) => sum + (Number(subject.completedUnitCount) || 0), 0);
  const total = course.subjects.reduce((sum, subject) => sum + (Number(subject.totalUnitCount) || 0), 0);
  return total ? Math.min(100, Math.round((completed / total) * 100)) : 0;
}

function buildSections(courses: LessonPracticeCourse[], filter: CourseFilter): CourseSection[] {
  const visible = courses.filter((course) => course.enrolled || !course.hiddenByEnrollment);
  const enrolled = visible.filter((course) => course.enrolled);
  const available = visible.filter((course) => !course.enrolled);
  const matching = (items: LessonPracticeCourse[], mode: 'video' | 'instructor') =>
    items.filter((course) => course.deliveryMode === mode);
  if (filter === 'registered') return [{ id: 'registered', title: 'Khóa đã đăng ký', courses: enrolled }];
  if (filter === 'video') return [
    { id: 'video-registered', title: 'Khóa tự học qua video · Đã đăng ký', courses: matching(enrolled, 'video') },
    { id: 'video-available', title: 'Khóa tự học qua video · Chưa đăng ký', courses: matching(available, 'video') },
  ];
  if (filter === 'instructor') return [
    { id: 'instructor-registered', title: 'Khóa học cùng giảng viên · Đã đăng ký', courses: matching(enrolled, 'instructor') },
    { id: 'instructor-available', title: 'Khóa học cùng giảng viên · Chưa đăng ký', courses: matching(available, 'instructor') },
  ];
  const groupedCourseIds = new Set<string>();
  const groupedBundles: LessonPracticeCourse[] = [];
  courses.filter((course) => !course.enrolled && course.offerType === 'bundle' && course.hiddenByEnrollment).forEach((bundle) => {
    const subjectIds = new Set(bundle.subjects.map((subject) => subject.id).filter(Boolean));
    if (!subjectIds.size || subjectIds.size !== bundle.subjects.length) return;
    const covered = enrolled.filter((course) =>
      course.offerType === 'single'
      && course.deliveryMode === bundle.deliveryMode
      && course.subjects.length === 1
      && subjectIds.has(course.subjects[0].id)
      && !groupedCourseIds.has(course.id));
    if (covered.length !== subjectIds.size || new Set(covered.map((course) => course.subjects[0].id)).size !== subjectIds.size) return;
    covered.forEach((course) => groupedCourseIds.add(course.id));
    groupedBundles.push({ ...bundle, enrolled: true, hiddenByEnrollment: false });
  });
  const visibleEnrolled = [...groupedBundles, ...enrolled.filter((course) => !groupedCourseIds.has(course.id))];
  return [
    { id: 'registered', title: 'Khóa đã đăng ký', courses: visibleEnrolled },
    { id: 'video', title: 'Khóa tự học qua video', courses: matching(available, 'video') },
    { id: 'instructor', title: 'Khóa học cùng với giảng viên', courses: matching(available, 'instructor') },
  ];
}

export function CourseVideosScreen() {
  const { user } = useAuth();
  const isPreview = Boolean(user?.previewMode);
  const loader = useCallback(
    () => isPreview ? previewCatalog() : getCourseVideoCatalog(),
    [isPreview],
  );
  const resource = useMockResource(loader);
  const [filter, setFilter] = useState<CourseFilter>('all');
  const [selectedCourse, setSelectedCourse] = useState<LessonPracticeCourse | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<LessonPracticeSubject | null>(null);
  const [units, setUnits] = useState<LessonPracticeUnit[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [unitsError, setUnitsError] = useState('');
  const [selectedUnit, setSelectedUnit] = useState<LessonPracticeUnit | null>(null);
  const [openingUnit, setOpeningUnit] = useState(false);
  const courses = resource.data?.courses || [];
  const sections = useMemo(() => filter === 'guide' ? [] : buildSections(courses, filter), [courses, filter]);
  const counts = useMemo(() => {
    const visible = courses.filter((course) => course.enrolled || !course.hiddenByEnrollment);
    return {
      all: visible.length,
      registered: visible.filter((course) => course.enrolled).length,
      video: visible.filter((course) => course.deliveryMode === 'video').length,
      instructor: visible.filter((course) => course.deliveryMode === 'instructor').length,
    };
  }, [courses]);

  const openCourse = (course: LessonPracticeCourse) => {
    const subject = directSubject(course);
    if (subject) {
      void openSubject(course, subject);
      return;
    }
    setSelectedCourse(course);
    setSelectedSubject(null);
    setSelectedUnit(null);
    setUnits([]);
    setUnitsError('');
  };

  const openSubject = async (course: LessonPracticeCourse, subject: LessonPracticeSubject) => {
    setSelectedCourse(course);
    setSelectedSubject(subject);
    setSelectedUnit(null);
    setUnits([]);
    setUnitsError('');
    if (isPreview) return;
    setUnitsLoading(true);
    try {
      setUnits(await getCourseSubjectUnits(subject.id, course.id));
    } catch (error) {
      setUnitsError(error instanceof Error ? error.message : 'Không tải được danh sách bài học.');
    } finally {
      setUnitsLoading(false);
    }
  };

  const startUnit = async (unit: LessonPracticeUnit) => {
    if (unit.locked) {
      Alert.alert('Bài học đang khóa', 'Hoàn thành buổi học trước để mở nội dung này.');
      return;
    }
    if (isPreview) {
      Alert.alert('Chế độ xem thử', 'Video bài học chỉ khả dụng khi đăng nhập bằng tài khoản học viên thật.');
      return;
    }
    setOpeningUnit(true);
    try {
      const detail = await openCourseVideoUnit(unit.id);
      setSelectedUnit(detail);
    } catch (error) {
      Alert.alert('Không tải được bài học', error instanceof Error ? error.message : 'Vui lòng thử lại.');
    } finally {
      setOpeningUnit(false);
    }
  };

  const openVideo = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert('Không mở được video', error instanceof Error ? error.message : 'Vui lòng thử lại.');
    }
  };

  return (
    <AppScreen contentStyle={styles.screenContent}>
      <View style={styles.headerBand}>
        <View style={styles.headerGroup}>
          <AppHeader title="Video bài giảng" icon={Clapperboard} />
        </View>
      </View>
      <View style={styles.filters}>
        {filterOptions.map((option) => {
          const Icon = option.icon;
          const count = option.id === 'all' ? counts.all
            : option.id === 'registered' ? counts.registered
              : option.id === 'video' ? counts.video
                : option.id === 'instructor' ? counts.instructor : undefined;
          const active = filter === option.id;
          return (
            <Pressable
              key={option.id}
              onPress={() => setFilter(option.id)}
              style={[styles.filterChip, active && styles.filterChipActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={option.label}
            >
              <View style={styles.filterIconWrap}>
                <Icon size={17} color={active ? colors.brandDark : colors.muted} />
                {count !== undefined ? <Text style={[styles.filterCount, active && styles.filterCountActive]}>{count}</Text> : null}
              </View>
              <Text numberOfLines={2} style={[styles.filterText, active && styles.filterTextActive]}>{option.displayLabel}</Text>
            </Pressable>
          );
        })}
      </View>
      {resource.loading ? <LoadingSkeleton /> : null}
      {resource.error ? <ErrorState onRetry={resource.reload} /> : null}
      {!resource.loading && !resource.error && filter === 'guide' ? (
        <Card>
          <View style={styles.guideHeader}><CircleHelp size={20} color={colors.brand} /><Text style={styles.cardTitle}>Hướng dẫn học</Text></View>
          <Text style={styles.body}>Chọn khóa học, mở môn học và hoàn thành lần lượt từng buổi để theo dõi tiến độ.</Text>
        </Card>
      ) : null}
      {!resource.loading && !resource.error && filter !== 'guide' && !courses.length ? (
        <EmptyState title="Chưa có khóa học được mở" message="Các khóa học sẽ hiển thị tại đây." />
      ) : null}
      {!resource.loading && !resource.error && filter !== 'guide' && sections.map((section) => (
        section.courses.length ? (
          <View key={section.id} style={styles.courseSection}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, section.id.startsWith('registered') ? styles.registeredIcon : section.id.startsWith('video') ? styles.videoIcon : styles.instructorIcon]}>
                {section.id.startsWith('registered') ? <CheckCircle2 size={21} color="#059669" /> : section.id.startsWith('video') ? <Clapperboard size={21} color="#B45309" /> : <GraduationCap size={21} color="#0369A1" />}
              </View>
              <View style={styles.sectionCopy}>
                <Text style={styles.eyebrow}>{section.id.startsWith('registered') ? 'LỘ TRÌNH CỦA BẠN' : section.id.startsWith('video') ? 'CHỦ ĐỘNG HỌC TẬP' : 'HỌC CÙNG GIẢNG VIÊN'}</Text>
                <View style={styles.sectionTitleRow}>
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                  <Text style={[styles.sectionCount, section.id.startsWith('registered') ? styles.registeredCount : section.id.startsWith('video') ? styles.videoCount : styles.instructorCount]}>{section.courses.length}</Text>
                </View>
                {section.id.startsWith('registered') || section.id.startsWith('video') ? null : <Text style={styles.sectionDescription}>Học có giảng viên hướng dẫn và đồng hành.</Text>}
              </View>
            </View>
            {section.courses.map((course) => (
              <CourseCard key={course.id} course={course} onOpen={() => openCourse(course)} onRegister={() => Alert.alert('Đăng ký khóa học', 'Vui lòng đăng ký và thanh toán khóa học trên Web app.')} />
            ))}
          </View>
        ) : null
      ))}
      {filter !== 'guide' && sections.every((section) => !section.courses.length) && !resource.loading && !resource.error ? (
        <EmptyState title="Không có khóa học trong bộ lọc" message="Thử chọn một bộ lọc khác." />
      ) : null}
      <Modal visible={Boolean(selectedCourse)} transparent animationType="slide" onRequestClose={() => { setSelectedCourse(null); setSelectedSubject(null); }}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => { setSelectedCourse(null); setSelectedSubject(null); }} accessibilityRole="button" accessibilityLabel="Đóng nội dung khóa học" />
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.flex}>
                <Text style={styles.eyebrow}>{selectedSubject ? 'DANH SÁCH BUỔI HỌC' : 'NỘI DUNG KHÓA HỌC'}</Text>
                <Text style={styles.modalTitle}>{selectedSubject?.name || selectedCourse?.name}</Text>
                <Text style={styles.muted}>{selectedSubject ? `${selectedCourse?.name || ''} · ${selectedCourse?.offerType === 'single' ? 'Khóa lẻ' : 'Trọn gói'}` : `${selectedCourse?.subjects.length || 0} môn học`}</Text>
              </View>
              {selectedUnit ? <Pressable onPress={() => setSelectedUnit(null)} accessibilityRole="button" accessibilityLabel="Quay lại danh sách buổi"><Text style={styles.backText}>Buổi học</Text></Pressable> : selectedSubject ? <Pressable onPress={() => { setSelectedSubject(null); setSelectedUnit(null); setUnits([]); }} accessibilityRole="button" accessibilityLabel="Quay lại danh sách môn"><Text style={styles.backText}>Môn học</Text></Pressable> : null}
              <Pressable onPress={() => { setSelectedCourse(null); setSelectedSubject(null); }} style={styles.modalClose} accessibilityRole="button" accessibilityLabel="Đóng"><Text style={styles.closeText}>×</Text></Pressable>
            </View>
            <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalContentInner}>
              {selectedUnit ? (
                <UnitDetails unit={selectedUnit} onOpenVideo={(url) => void openVideo(url)} />
              ) : selectedSubject ? (
                <>
                  {unitsLoading ? <LoadingSkeleton rows={3} /> : null}
                  {unitsError ? <Text style={styles.errorText}>{unitsError}</Text> : null}
                  {!unitsLoading && !unitsError && !units.length ? <EmptyState title="Chưa có bài học" message="Nội dung sẽ hiển thị tại đây." /> : null}
                  {units.map((unit, index) => (
                    <Pressable key={unit.id} onPress={() => void startUnit(unit)} disabled={openingUnit} style={styles.unitRow} accessibilityRole="button" accessibilityState={{ disabled: unit.locked || openingUnit }}>
                      <View style={[styles.unitNumber, unit.status === 'completed' && styles.unitNumberDone]}>{unit.locked ? <Lock size={15} color={colors.muted} /> : <Text style={styles.unitNumberText}>{index + 1}</Text>}</View>
                      <View style={styles.flex}>
                        <Text style={styles.unitTitle}>{unit.title}</Text>
                        <Text style={styles.muted}>{unit.status === 'completed' ? 'Đã hoàn thành' : unit.locked ? 'Hoàn thành buổi trước để mở' : 'Video và nội dung bài học'}</Text>
                      </View>
                      <ChevronRight size={18} color={colors.muted} />
                    </Pressable>
                  ))}
                </>
              ) : (
                (selectedCourse?.subjects || []).map((subject, index) => (
                  <Pressable key={subject.id || `${subject.name}-${index}`} onPress={() => selectedCourse && void openSubject(selectedCourse, subject)} style={styles.subjectCard} accessibilityRole="button">
                    <View style={styles.unitNumber}><Text style={styles.unitNumberText}>{String(index + 1).padStart(2, '0')}</Text></View>
                    <View style={styles.flex}>
                      <Text style={styles.unitTitle}>{subject.name}</Text>
                      <Text style={styles.muted}>{subject.opened ? `${subject.completedUnitCount || 0}/${subject.totalUnitCount || 0} bài đã hoàn thành` : selectedCourse?.enrolled ? 'Chưa đăng ký' : 'Có bài học thử'}</Text>
                      <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${subject.totalUnitCount ? Math.min(100, Math.round(((subject.completedUnitCount || 0) / subject.totalUnitCount) * 100)) : 0}%` }]} /></View>
                    </View>
                    <ChevronRight size={18} color={colors.muted} />
                  </Pressable>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </AppScreen>
  );
}

function CourseCard({ course, onOpen, onRegister }: { course: LessonPracticeCourse; onOpen: () => void; onRegister: () => void }) {
  const [isHovered, setIsHovered] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const isVideo = course.deliveryMode === 'video';
  const progress = courseProgress(course);
  const showTooltip = !course.enrolled && (isHovered || infoOpen);
  return (
    <Pressable
      style={[styles.courseCardWrap, showTooltip ? styles.courseCardWrapActive : undefined]}
      onHoverIn={() => setIsHovered(true)}
      onHoverOut={() => setIsHovered(false)}
    >
      <Card style={{ ...styles.courseCard, ...(isHovered ? styles.courseCardHovered : {}) }}>
        <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`Mở khóa học ${course.name}`}>
          <View style={[styles.courseBanner, { backgroundColor: course.bannerColorStart || '#BE123C' }]}>
            {course.thumbnail ? <Image source={{ uri: course.thumbnail }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : <View style={[styles.bannerRing, { borderColor: 'rgba(255,255,255,0.13)' }]} />}
            {!course.enrolled ? <View style={styles.lockBadge}><Lock size={14} color="#854D0E" /></View> : null}
            <View style={styles.courseMode}><Clapperboard size={16} color="#B45309" /><Text style={styles.courseModeText}>{isVideo ? 'TỰ HỌC QUA VIDEO' : 'HỌC CÙNG GIẢNG VIÊN'}</Text></View>
            <View style={styles.offerBadge}><Text style={styles.offerText}>{course.offerType === 'single' ? 'Khóa lẻ' : 'Trọn gói'}</Text></View>
          </View>
          <View style={styles.courseInfo}>
            <Text numberOfLines={2} style={styles.courseTitle}>{course.name}</Text>
            {course.subjects.length ? (
              <View style={styles.subjectChips}>
                <Text style={styles.subjectLabel}>Môn:</Text>
                {course.subjects.slice(0, 3).map((subject) => <Text key={subject.id || subject.name} numberOfLines={1} style={styles.subjectChip}>{subject.name}</Text>)}
                {course.subjects.length > 3 ? <Text style={styles.subjectChip}>+{course.subjects.length - 3} môn</Text> : null}
              </View>
            ) : null}
            <View style={styles.courseFooter}>
              {course.enrolled ? (
                <View style={styles.progressCircle}><Text style={styles.progressText}>{progress}%</Text></View>
              ) : (
                <View style={styles.lessonCount}><Clock3 size={13} color={colors.muted} /><Text style={styles.muted}>{isVideo ? course.lessonCount || 0 : course.totalSessions || 0} {isVideo ? 'bài học' : 'buổi'}</Text></View>
              )}
              {course.enrolled ? <Text style={styles.enrolledBadge}><CheckCircle2 size={13} color="#059669" /> Đã đăng ký</Text> : <Text style={styles.priceText}>{Number(course.price || 0).toLocaleString('vi-VN')}đ</Text>}
            </View>
          </View>
        </Pressable>
        <View style={styles.courseActions}>
          {!course.enrolled && isVideo ? <Pressable onPress={onRegister} style={styles.registerButton} accessibilityRole="button"><Text style={styles.registerText}>Đăng ký học</Text></Pressable> : <View />}
          {!course.enrolled && !isVideo ? <Pressable onPress={onRegister} style={styles.registerButton} accessibilityRole="button"><Text style={styles.registerText}>Zalo tư vấn</Text></Pressable> : null}
          <Pressable onPress={onOpen} style={[styles.openButton, course.enrolled ? styles.openButtonActive : null]} accessibilityRole="button">
            <Text style={[styles.openButtonText, course.enrolled && styles.openButtonTextActive]}>{course.enrolled ? progress > 0 && progress < 100 ? 'Tiếp tục học' : progress >= 100 ? 'Xem lại khóa học' : 'Vào học' : directSubject(course) ? 'Học thử' : 'Xem thêm'}</Text>
            <ChevronRight size={16} color={course.enrolled ? '#047857' : colors.red} />
          </Pressable>
        </View>
      </Card>
      {!course.enrolled ? (
        <Pressable
          onPress={() => setInfoOpen((current) => !current)}
          style={styles.courseInfoButton}
          accessibilityRole="button"
          accessibilityLabel={infoOpen ? 'Ẩn thông tin khóa học' : 'Xem thông tin khóa học'}
          accessibilityState={{ expanded: showTooltip }}
        >
          <CircleHelp size={15} color="#475569" />
        </Pressable>
      ) : null}
      {showTooltip ? <CourseTooltip isVideo={isVideo} /> : null}
    </Pressable>
  );
}

function CourseTooltip({ isVideo }: { isVideo: boolean }) {
  return (
    <View style={styles.courseTooltip} pointerEvents="none" accessibilityRole="text">
      <View style={styles.tooltipTitle}>
        <Sparkles size={14} color="#F59E0B" />
        <Text style={styles.tooltipHeading}>{isVideo ? 'Khóa tự học là gì?' : 'Học cùng giảng viên 1 kèm 1'}</Text>
      </View>
      {isVideo ? (
        <>
          <Text style={styles.tooltipLine}>•  Học theo lộ trình có sẵn, kèm video hướng dẫn.</Text>
          <Text style={styles.tooltipLine}>•  Có bài tập thực hành để củng cố kiến thức.</Text>
          <Text style={styles.tooltipLine}>•  Trắc nghiệm được hệ thống chấm tự động.</Text>
          <Text style={styles.tooltipLine}>•  Bài tự luận được AI đánh giá và phản hồi.</Text>
          <Text style={styles.tooltipLine}>•  Đăng ký một lần, học trọn đời.</Text>
          <Text style={styles.tooltipWarning}>Lưu ý: Khóa học này không phải là học 1 kèm 1; không hoàn phí nếu đã đăng ký.</Text>
        </>
      ) : (
        <>
          <Text style={styles.tooltipLine}>•  Học trực tiếp 1 kèm 1 với giảng viên qua UltraViewer hoặc TeamViewer; hỗ trợ Chrome Remote Desktop trên MacBook.</Text>
          <Text style={styles.tooltipLine}>•  Mỗi buổi học đều được ghi lại màn hình để bạn xem lại.</Text>
          <Text style={styles.tooltipLine}>•  Thời gian học linh động, sắp xếp phù hợp với lịch của bạn.</Text>
          <Text style={styles.tooltipLine}>•  Được hỗ trợ trọn đời trong quá trình học.</Text>
        </>
      )}
    </View>
  );
}

function UnitDetails({ unit, onOpenVideo }: { unit: LessonPracticeUnit; onOpenVideo: (url: string) => void }) {
  const videos = unit.videos?.filter((video) => video.url) || [];
  const legacyVideo = unit.videoUrl && !videos.length
    ? [{ id: 'legacy-video', title: 'Video bài học', url: unit.videoUrl }]
    : [];
  const contents = unit.contents || [];
  return (
    <View style={styles.unitDetails}>
      <Text style={styles.unitTitle}>{unit.title}</Text>
      {[...videos, ...legacyVideo].map((video) => (
        <Pressable key={video.id} onPress={() => onOpenVideo(video.url)} style={styles.unitRow} accessibilityRole="button">
          <View style={styles.videoPlay}><Clapperboard size={17} color={colors.brand} /></View>
          <View style={styles.flex}>
            <Text style={styles.unitTitle}>{video.title}</Text>
            <Text style={styles.muted}>Mở video bài giảng</Text>
          </View>
          <ChevronRight size={18} color={colors.muted} />
        </Pressable>
      ))}
      {contents.map((content) => (
        <View key={content.id} style={styles.contentCard}>
          <Text style={styles.contentTitle}>{content.title}</Text>
          <Text style={styles.body}>{content.content}</Text>
        </View>
      ))}
      {!videos.length && !legacyVideo.length && !contents.length ? (
        <EmptyState title="Chưa có nội dung bài học" message="Bài học này chưa có video hoặc tài liệu." />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  screenContent: { gap: spacing.md },
  headerBand: { marginHorizontal: -spacing.xl, marginTop: -spacing.md, marginBottom: -spacing.sm, paddingHorizontal: spacing.xl, paddingTop: spacing.md, backgroundColor: '#F1F5F9' },
  headerGroup: { marginBottom: spacing.sm },
  courseCardWrap: { position: 'relative' },
  courseCardWrapActive: { zIndex: 20 },
  filters: { alignSelf: 'stretch', flexDirection: 'row', flexWrap: 'nowrap', gap: 0, marginHorizontal: -spacing.xl, paddingHorizontal: spacing.lg, marginBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: '#E8EDF3', backgroundColor: colors.surface },
  filterChip: { minWidth: 0, minHeight: 68, flex: 1, flexBasis: 0, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 2, paddingVertical: 4, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  filterChipActive: { borderBottomColor: colors.brand },
  filterIconWrap: { position: 'relative', width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  filterText: { minHeight: 24, color: '#64748B', fontSize: typography.micro, lineHeight: 14, fontWeight: '700', textAlign: 'center' },
  filterTextActive: { color: colors.brandDark, fontWeight: '900' },
  filterCount: { position: 'absolute', top: -5, right: -7, minWidth: 15, paddingHorizontal: 4, paddingVertical: 1, overflow: 'hidden', borderWidth: 1.5, borderColor: colors.surface, borderRadius: radius.pill, backgroundColor: '#E2E8F0', color: '#475569', textAlign: 'center', fontSize: typography.micro, fontWeight: '900' },
  filterCountActive: { backgroundColor: colors.brand, color: colors.surface },
  courseSection: { marginTop: spacing.xs, gap: spacing.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.line },
  sectionIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 15 },
  registeredIcon: { backgroundColor: '#D1FAE5' },
  videoIcon: { backgroundColor: '#FEF3C7' },
  instructorIcon: { backgroundColor: '#E0F2FE' },
  sectionCopy: { flex: 1, minWidth: 0 },
  eyebrow: { color: '#94A3B8', fontSize: typography.micro, fontWeight: '900', letterSpacing: 1.4 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  sectionTitle: { flexShrink: 1, color: colors.ink, fontSize: typography.small, fontWeight: '900' },
  sectionCount: { minWidth: 20, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.pill, textAlign: 'center', fontSize: typography.micro, fontWeight: '800' },
  registeredCount: { backgroundColor: '#D1FAE5', color: '#047857' },
  videoCount: { backgroundColor: '#FEF3C7', color: '#92400E' },
  instructorCount: { backgroundColor: '#E0F2FE', color: '#075985' },
  sectionDescription: { marginTop: 3, color: colors.muted, fontSize: typography.micro, lineHeight: 15 },
  courseCard: { overflow: 'hidden', padding: 0 },
  courseCardHovered: { borderColor: '#CBD5E1', shadowColor: '#0F172A', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  courseBanner: { height: 94, position: 'relative', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  bannerRing: { position: 'absolute', width: 142, height: 142, right: -38, top: -49, borderWidth: 18, borderRadius: 80 },
  lockBadge: { position: 'absolute', left: 10, top: 10, width: 26, height: 26, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: '#FEF3C7' },
  courseMode: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7, paddingHorizontal: 12, borderWidth: 1, borderColor: '#FFFFFF', borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.96)' },
  courseModeText: { color: colors.ink, fontSize: typography.micro, fontWeight: '900', letterSpacing: 0.4 },
  offerBadge: { position: 'absolute', top: 9, right: 9, paddingHorizontal: 9, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.95)' },
  offerText: { color: colors.ink, fontSize: typography.micro, fontWeight: '800' },
  courseInfo: { minHeight: 126, padding: spacing.md, paddingBottom: spacing.sm },
  courseTitle: { minHeight: 34, color: colors.ink, fontSize: typography.caption, lineHeight: 16, fontWeight: '900' },
  subjectChips: { minHeight: 35, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 4, marginTop: 5 },
  subjectLabel: { paddingTop: 4, color: colors.muted, fontSize: typography.micro },
  subjectChip: { maxWidth: 120, paddingHorizontal: 5, paddingVertical: 3, overflow: 'hidden', borderRadius: 5, backgroundColor: colors.blueSoft, color: colors.blue, fontSize: typography.micro },
  courseFooter: { minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginTop: 'auto', paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.line },
  progressCircle: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#D1DCE7', borderRadius: 13 },
  progressText: { color: colors.ink, fontSize: typography.micro, fontWeight: '900' },
  lessonCount: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  enrolledBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: '#ECFDF5', color: '#047857', fontSize: typography.micro, fontWeight: '900' },
  priceText: { color: colors.ink, fontSize: typography.small, fontWeight: '900' },
  courseActions: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm, borderTopWidth: 1, borderTopColor: colors.line },
  courseInfoButton: { position: 'absolute', top: 10, left: 42, width: 26, height: 26, alignItems: 'center', justifyContent: 'center', borderRadius: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.75)', backgroundColor: 'rgba(255,255,255,0.94)' },
  courseTooltip: { position: 'absolute', top: 76, left: 10, right: 10, zIndex: 30, gap: 7, padding: spacing.md, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: radius.md, backgroundColor: '#FFFFFF', shadowColor: '#0F172A', shadowOpacity: 0.2, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 12 },
  tooltipTitle: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  tooltipHeading: { color: colors.ink, fontSize: typography.caption, fontWeight: '900' },
  tooltipLine: { color: '#475569', fontSize: typography.caption, lineHeight: 16 },
  tooltipWarning: { marginTop: 2, paddingTop: spacing.xs, borderTopWidth: 1, borderTopColor: '#FEE2E2', color: colors.ink, fontSize: typography.micro, lineHeight: 15, fontWeight: '700' },
  registerButton: { minHeight: 32, justifyContent: 'center', paddingHorizontal: spacing.sm, borderRadius: radius.pill, backgroundColor: '#ECFDF5' },
  registerText: { color: '#047857', fontSize: typography.micro, fontWeight: '900' },
  openButton: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: '#FEF2F2' },
  openButtonActive: { backgroundColor: '#ECFDF5' },
  openButtonText: { color: '#B91C1C', fontSize: typography.micro, fontWeight: '900' },
  openButtonTextActive: { color: '#047857' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.55)' },
  modalCard: { maxHeight: '88%', paddingTop: spacing.lg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, backgroundColor: colors.surface },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.line },
  modalTitle: { marginTop: 3, color: colors.ink, fontSize: typography.heading, fontWeight: '900' },
  muted: { color: colors.muted, fontSize: typography.micro },
  backText: { paddingTop: spacing.md, color: colors.brand, fontSize: typography.caption, fontWeight: '800' },
  modalClose: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 15, borderWidth: 1, borderColor: colors.line },
  closeText: { color: colors.muted, fontSize: 22, lineHeight: 25 },
  modalContent: { maxHeight: 450 },
  modalContentInner: { gap: spacing.sm, padding: spacing.lg },
  subjectCard: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md },
  unitNumber: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: colors.canvas },
  unitNumberDone: { backgroundColor: '#D1FAE5' },
  unitNumberText: { color: colors.muted, fontSize: typography.caption, fontWeight: '900' },
  unitTitle: { color: colors.ink, fontSize: typography.caption, fontWeight: '900' },
  progressTrack: { height: 5, marginTop: 7, overflow: 'hidden', borderRadius: 3, backgroundColor: colors.line },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: '#10B981' },
  unitRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  unitDetails: { gap: spacing.md },
  videoPlay: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.blueSoft },
  contentCard: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.canvas },
  contentTitle: { color: colors.ink, fontSize: typography.small, fontWeight: '800' },
  errorText: { color: colors.red, fontSize: typography.small },
  guideHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  cardTitle: { color: colors.ink, fontSize: typography.body, fontWeight: '800' },
  body: { color: colors.muted, fontSize: typography.small, lineHeight: 20 },
});
