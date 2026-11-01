import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, DeviceEventEmitter, Linking, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { Clock3, Download, FileBox, MessageSquare, Plus, Search, Star, Trash2 } from 'lucide-react-native';
import {
  createCourseLessonQuestion,
  getCourseLessonQuestions,
  getCourseReviews,
  replyCourseLessonQuestion,
  submitCourseReview,
  type CourseLessonQuestion,
  type CourseReview,
  type LessonPracticeResource,
} from '../services/courseVideoApi';
import { SOCKET_EVENTS } from '../services/socketService';
import { resolveMobilePublicUrl } from '../services/apiClient';
import { colors, radius, spacing, typography } from '../theme/tokens';

type VideoLessonTab = 'qa' | 'notes' | 'reviews' | 'resources';
type VideoLessonNote = {
  id: string;
  lessonId: string;
  lessonTitle: string;
  text: string;
  atSec: number;
  createdAt: number;
};

type VideoLessonTabsProps = {
  activeTab: VideoLessonTab;
  courseId: string;
  courseTitle: string;
  lessonId: string;
  lessonTitle: string;
  userId: string;
  enabled: boolean;
  videoUrl: string;
  resources: LessonPracticeResource[];
  currentTime: number;
  videoDuration: number;
};

function messageFromError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function formatTime(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds || 0));
  return `${Math.floor(safeSeconds / 60)}:${String(safeSeconds % 60).padStart(2, '0')}`;
}

function relativeTime(timestamp: number) {
  const age = Math.max(0, Date.now() - timestamp);
  if (age < 60_000) return 'Vừa xong';
  if (age < 3_600_000) return `${Math.floor(age / 60_000)} phút trước`;
  if (age < 86_400_000) return `${Math.floor(age / 3_600_000)} giờ trước`;
  return `${Math.floor(age / 86_400_000)} ngày trước`;
}

export function VideoLessonTabs({
  activeTab,
  courseId,
  courseTitle,
  lessonId,
  lessonTitle,
  userId,
  enabled,
  videoUrl,
  resources,
  currentTime,
  videoDuration,
}: VideoLessonTabsProps) {
  const [questions, setQuestions] = useState<CourseLessonQuestion[]>([]);
  const [questionSearch, setQuestionSearch] = useState('');
  const [questionTitle, setQuestionTitle] = useState('');
  const [questionBody, setQuestionBody] = useState('');
  const [questionLoading, setQuestionLoading] = useState(false);
  const [questionSending, setQuestionSending] = useState(false);
  const [replySendingId, setReplySendingId] = useState('');
  const [questionError, setQuestionError] = useState('');
  const [replyError, setReplyError] = useState('');
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [expandedQuestionId, setExpandedQuestionId] = useState('');
  const [notes, setNotes] = useState<VideoLessonNote[]>([]);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteFilter, setNoteFilter] = useState<'current' | 'all'>('current');
  const [noteError, setNoteError] = useState('');
  const [resourceError, setResourceError] = useState('');
  const [reviews, setReviews] = useState<CourseReview[]>([]);
  const [averageRating, setAverageRating] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewDraft, setReviewDraft] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewSending, setReviewSending] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [reviewSuccess, setReviewSuccess] = useState('');
  const noteStorageKey = `lms_notes_${userId || 'anon'}_${courseId || 'course'}`;
  const legacyNoteStorageKey = `lms-notes:v1:${userId}:${courseId}`;

  const loadQuestions = useCallback(async () => {
    if (!enabled || !courseId || !lessonId) {
      setQuestions([]);
      return;
    }
    setQuestionLoading(true);
    setQuestionError('');
    try {
      setQuestions(await getCourseLessonQuestions(courseId, lessonId));
    } catch (error) {
      setQuestionError(messageFromError(error, 'Không tải được hỏi đáp.'));
    } finally {
      setQuestionLoading(false);
    }
  }, [courseId, enabled, lessonId]);

  useEffect(() => {
    if (activeTab === 'qa') void loadQuestions();
  }, [activeTab, loadQuestions]);

  useEffect(() => {
    if (activeTab !== 'qa') return undefined;
    const subscription = DeviceEventEmitter.addListener(SOCKET_EVENTS.LMS_QA_UPDATED, (payload: {
      courseId?: string;
      lessonId?: string;
      audience?: string;
    }) => {
      if (payload?.courseId && String(payload.courseId) !== String(courseId)) return;
      if (payload?.lessonId && String(payload.lessonId) !== String(lessonId)) return;
      if (payload?.audience && payload.audience !== 'student') return;
      void loadQuestions();
    });
    return () => subscription.remove();
  }, [activeTab, courseId, lessonId, loadQuestions]);

  useEffect(() => {
    let active = true;
    setNotes([]);
    setNoteError('');
    Promise.resolve().then(async () => (
      Platform.OS === 'web'
        ? globalThis.localStorage.getItem(noteStorageKey)
        : await AsyncStorage.getItem(noteStorageKey)
    )).then(async (value) => {
      if (value) return value;
      return AsyncStorage.getItem(legacyNoteStorageKey);
    })
      .then((value) => {
        if (!active || !value) return;
        const parsed: unknown = JSON.parse(value);
        if (Array.isArray(parsed)) setNotes(parsed as VideoLessonNote[]);
        else throw new Error('Dữ liệu ghi chú không hợp lệ.');
      })
      .catch((error: unknown) => {
        if (active) setNoteError(messageFromError(error, 'Không tải được ghi chú đã lưu.'));
      });
    return () => { active = false; };
  }, [legacyNoteStorageKey, noteStorageKey]);

  const saveNotes = async (nextNotes: VideoLessonNote[]) => {
    setNotes(nextNotes);
    setNoteError('');
    try {
      const serialized = JSON.stringify(nextNotes);
      if (Platform.OS === 'web') globalThis.localStorage.setItem(noteStorageKey, serialized);
      else await AsyncStorage.setItem(noteStorageKey, serialized);
    } catch (error) {
      setNoteError(messageFromError(error, 'Không lưu được ghi chú.'));
    }
  };

  const addNote = () => {
    const text = noteDraft.trim();
    if (!text || !lessonId) return;
    const nextNote: VideoLessonNote = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      lessonId,
      lessonTitle,
      text,
      atSec: Math.max(0, Math.floor(currentTime)),
      createdAt: Date.now(),
    };
    void saveNotes([nextNote, ...notes]);
    setNoteDraft('');
  };

  const visibleNotes = useMemo(() => {
    const sorted = [...notes].sort((a, b) => b.createdAt - a.createdAt);
    return noteFilter === 'current' ? sorted.filter((note) => note.lessonId === lessonId) : sorted;
  }, [lessonId, noteFilter, notes]);

  const loadReviews = useCallback(async () => {
    if (!enabled || !courseId) {
      setReviews([]);
      setAverageRating(0);
      setReviewCount(0);
      return;
    }
    setReviewLoading(true);
    setReviewError('');
    try {
      const result = await getCourseReviews(courseId);
      setReviews(result.items);
      setAverageRating(result.average);
      setReviewCount(result.count);
    } catch (error) {
      setReviewError(messageFromError(error, 'Không tải được đánh giá.'));
    } finally {
      setReviewLoading(false);
    }
  }, [courseId, enabled]);

  useEffect(() => {
    if (activeTab === 'reviews') void loadReviews();
  }, [activeTab, loadReviews]);

  const sendQuestion = async () => {
    const title = questionTitle.trim();
    if (!enabled || !courseId || !lessonId || !title || questionSending) return;
    setQuestionSending(true);
    setQuestionError('');
    try {
      const question = await createCourseLessonQuestion({
        courseId,
        courseTitle,
        lessonId,
        lessonTitle,
        title,
        body: questionBody.trim(),
        videoUrl,
        atSec: Math.max(0, Math.floor(currentTime)),
        videoDuration: Math.max(0, Math.floor(videoDuration)),
      });
      setQuestions((previous) => [question, ...previous.filter((item) => item.id !== question.id)]);
      setQuestionTitle('');
      setQuestionBody('');
    } catch (error) {
      setQuestionError(messageFromError(error, 'Gửi câu hỏi thất bại.'));
    } finally {
      setQuestionSending(false);
    }
  };

  const sendReply = async (question: CourseLessonQuestion) => {
    const body = (replyDrafts[question.id] || '').trim();
    if (!enabled || question.askerId !== userId || !body || replySendingId) return;
    setReplySendingId(question.id);
    setReplyError('');
    try {
      const updatedQuestion = await replyCourseLessonQuestion(question.id, body);
      setQuestions((previous) => previous.map((item) => item.id === question.id ? updatedQuestion : item));
      setReplyDrafts((previous) => ({ ...previous, [question.id]: '' }));
    } catch (error) {
      setReplyError(messageFromError(error, 'Gửi phản hồi thất bại.'));
    } finally {
      setReplySendingId('');
    }
  };

  const sendReview = async () => {
    const comment = reviewDraft.trim();
    if (!enabled || !courseId || !comment || reviewSending) return;
    setReviewSending(true);
    setReviewError('');
    setReviewSuccess('');
    try {
      await submitCourseReview({ courseId, courseTitle, rating: reviewRating, comment });
      setReviewDraft('');
      setReviewRating(5);
      setReviewSuccess('Đã gửi đánh giá — Admin sẽ nhận thông báo.');
      await loadReviews();
    } catch (error) {
      setReviewError(messageFromError(error, 'Gửi đánh giá thất bại.'));
    } finally {
      setReviewSending(false);
    }
  };

  if (activeTab === 'qa') {
    const needle = questionSearch.trim().toLocaleLowerCase('vi');
    const filteredQuestions = questions.filter((question) => (
      `${question.title} ${question.body} ${question.answer || ''}`.toLocaleLowerCase('vi').includes(needle)
    ));

    return (
      <View style={[styles.panel, styles.qaPanel]}>
        <View style={styles.searchBox}>
          <View style={styles.searchIcon}><Search size={15} color="#64748B" /></View>
          <TextInput
            value={questionSearch}
            onChangeText={setQuestionSearch}
            placeholder="Tìm kiếm câu hỏi trong khóa học"
            placeholderTextColor="#64748B"
            style={styles.searchInput}
            accessibilityLabel="Tìm kiếm câu hỏi trong khóa học"
          />
        </View>
        <View style={[styles.formCard, styles.qaFormCard]}>
          <View style={styles.formHeading}>
            <View style={styles.formTitleWrap}>
              <View style={styles.formIcon}><MessageSquare size={16} color="#FFFFFF" /></View>
              <View>
                <Text style={styles.formLabel}>ĐẶT CÂU HỎI</Text>
                <Text style={styles.formHint}>Trao đổi về nội dung bài học</Text>
              </View>
            </View>
            <View style={styles.timeBadge}>
              <Clock3 size={12} color="#047857" />
              <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
            </View>
          </View>
          <TextInput
            value={questionTitle}
            onChangeText={setQuestionTitle}
            placeholder="Tiêu đề câu hỏi"
            placeholderTextColor="#64748B"
            style={[styles.input, styles.qaInput]}
            maxLength={300}
          />
          <TextInput
            value={questionBody}
            onChangeText={setQuestionBody}
            placeholder="Mô tả chi tiết (tùy chọn)"
            placeholderTextColor="#64748B"
            style={[styles.input, styles.multilineInput, styles.qaInput, styles.qaMultilineInput]}
            multiline
            textAlignVertical="top"
            maxLength={5000}
          />
          {!enabled ? <Text style={styles.errorText}>Hãy đăng nhập để sử dụng hỏi đáp.</Text> : null}
          {questionError ? <Text style={styles.errorText}>{questionError}</Text> : null}
          <Pressable
            onPress={() => void sendQuestion()}
            disabled={!enabled || !questionTitle.trim() || questionSending}
            style={[styles.primaryButton, styles.qaPrimaryButton, (!enabled || !questionTitle.trim() || questionSending) && styles.disabledButton]}
            accessibilityRole="button"
          >
            <MessageSquare size={15} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>{questionSending ? 'Đang gửi...' : 'Gửi câu hỏi'}</Text>
          </Pressable>
        </View>
        <View style={styles.listHeadingRow}>
          <Text style={styles.listHeading}>Câu hỏi trong video</Text>
          <Text style={styles.questionCount}>{filteredQuestions.length}</Text>
        </View>
        {questionLoading ? (
          <ActivityIndicator color={colors.brand} style={styles.loader} />
        ) : filteredQuestions.length ? (
          <View style={styles.list}>
            {filteredQuestions.map((question) => {
              const expanded = expandedQuestionId === question.id;
              const thread = Array.isArray(question.thread) ? question.thread : [];
              const includesAnswer = thread.some((message) => message.body === question.answer);
              const dialogue = thread.length
                ? question.answer && !includesAnswer
                  ? [{
                    id: `${question.id}-answer`,
                    authorId: '',
                    authorName: question.answeredByName || 'Support',
                    authorRole: question.answeredByRole || 'staff',
                    body: question.answer,
                    createdAt: question.answeredAt ? new Date(question.answeredAt).getTime() : question.createdAt,
                  }, ...thread]
                  : thread
                : question.answer
                  ? [{
                    id: `${question.id}-answer`,
                    authorId: '',
                    authorName: question.answeredByName || 'Support',
                    authorRole: question.answeredByRole || 'staff',
                    body: question.answer,
                    createdAt: question.answeredAt ? new Date(question.answeredAt).getTime() : question.createdAt,
                  }]
                  : [];
              const canReply = enabled && question.askerId === userId && dialogue.length > 0;
              return (
                <View key={question.id} style={styles.questionCard}>
                  <Pressable
                    onPress={() => setExpandedQuestionId(expanded ? '' : question.id)}
                    accessibilityRole="button"
                    accessibilityState={{ expanded }}
                  >
                    <View style={styles.formHeading}>
                      <Text style={styles.questionTitle}>{question.title}</Text>
                      <Text style={styles.timeText}>{formatTime(question.atSec)}</Text>
                    </View>
                    <Text style={styles.metaText}>
                      {question.askerName || 'Học viên'} · {question.status === 'answered' ? 'Đã trả lời' : 'Chờ trả lời'} · {relativeTime(question.createdAt)}
                    </Text>
                  </Pressable>
                  {expanded ? (
                    <>
                      {question.body ? <Text style={styles.bodyText}>{question.body}</Text> : null}
                      {dialogue.map((message) => (
                        <View key={message.id} style={styles.replyCard}>
                          <Text style={styles.replyAuthor}>
                            {['admin', 'staff', 'teacher'].includes(message.authorRole.toLowerCase()) ? 'Trả lời' : 'Phản hồi'} · {message.authorName || 'Support'}
                          </Text>
                          <Text style={styles.bodyText}>{message.body}</Text>
                          <Text style={styles.metaText}>{relativeTime(message.createdAt)}</Text>
                        </View>
                      ))}
                      {canReply ? (
                        <View style={styles.replyForm}>
                          <TextInput
                            value={replyDrafts[question.id] || ''}
                            onChangeText={(text) => setReplyDrafts((previous) => ({ ...previous, [question.id]: text }))}
                            placeholder="Phản hồi thêm / hỏi lại Support..."
                            placeholderTextColor="#64748B"
                            style={[styles.input, styles.multilineInput]}
                            multiline
                            textAlignVertical="top"
                            maxLength={5000}
                          />
                          {replyError ? <Text style={styles.errorText}>{replyError}</Text> : null}
                          <Pressable
                            onPress={() => void sendReply(question)}
                            disabled={!replyDrafts[question.id]?.trim() || Boolean(replySendingId)}
                            style={[styles.primaryButton, (!replyDrafts[question.id]?.trim() || Boolean(replySendingId)) && styles.disabledButton]}
                            accessibilityRole="button"
                          >
                            <Text style={styles.primaryButtonText}>{replySendingId === question.id ? 'Đang gửi...' : 'Gửi phản hồi'}</Text>
                          </Pressable>
                        </View>
                      ) : null}
                    </>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : questionLoading ? null : (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}><MessageSquare size={20} color="#64748B" /></View>
            <Text style={styles.emptyTitle}>{questionSearch ? 'Không tìm thấy câu hỏi' : 'Chưa có câu hỏi nào'}</Text>
            <Text style={styles.qaEmptyText}>{questionSearch ? 'Thử từ khóa khác để tìm nội dung phù hợp.' : 'Hãy đặt câu hỏi đầu tiên về video này nhé.'}</Text>
          </View>
        )}
      </View>
    );
  }

  if (activeTab === 'notes') {
    return (
      <View style={styles.panel}>
        <View style={styles.searchBox}>
          <TextInput
            value={noteDraft}
            onChangeText={setNoteDraft}
            placeholder={`Tạo ghi chú mới tại ${formatTime(currentTime)}`}
            placeholderTextColor="#64748B"
            style={styles.searchInput}
            onSubmitEditing={addNote}
            returnKeyType="done"
          />
          <Pressable onPress={addNote} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Thêm ghi chú">
            <Plus size={18} color="#047857" />
          </Pressable>
        </View>
        <View style={styles.filterRow}>
          {(['current', 'all'] as const).map((filter) => (
            <Pressable
              key={filter}
              onPress={() => setNoteFilter(filter)}
              style={[styles.filterButton, noteFilter === filter && styles.filterButtonActive]}
            >
              <Text style={[styles.filterText, noteFilter === filter && styles.filterTextActive]}>
                {filter === 'current' ? 'Bài hiện tại' : 'Tất cả bài giảng'}
              </Text>
            </Pressable>
          ))}
        </View>
        {noteError ? <Text style={styles.errorText}>{noteError}</Text> : null}
        {visibleNotes.length ? (
          <View style={styles.list}>
            {visibleNotes.map((note) => (
              <View key={note.id} style={styles.questionCard}>
                <View style={styles.formHeading}>
                  <Text style={styles.timeText}>{formatTime(note.atSec)}</Text>
                  {noteFilter === 'all' && note.lessonTitle ? <Text style={styles.metaText}>{note.lessonTitle}</Text> : null}
                  <Pressable
                    onPress={() => void saveNotes(notes.filter((item) => item.id !== note.id))}
                    accessibilityRole="button"
                    accessibilityLabel="Xóa ghi chú"
                    style={styles.deleteButton}
                  >
                    <Trash2 size={16} color="#64748B" />
                  </Pressable>
                </View>
                <Text style={styles.bodyText}>{note.text}</Text>
                <Text style={styles.metaText}>{relativeTime(note.createdAt)}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>Nhấp vào ô “Tạo ghi chú mới” hoặc nút + để tạo ghi chú đầu tiên của bạn.</Text>
        )}
      </View>
    );
  }

  if (activeTab === 'reviews') {
    return (
      <View style={[styles.panel, styles.reviewsPanel]}>
        <View style={styles.ratingSummary}>
          <Text style={styles.ratingValue}>{averageRating ? averageRating.toFixed(1) : '—'}</Text>
          <View style={styles.reviewStars}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Star key={star} size={17} color={averageRating >= star - 0.25 ? '#F59E0B' : '#CBD5E1'} fill={averageRating >= star - 0.25 ? '#F59E0B' : 'transparent'} />
            ))}
          </View>
          <Text style={styles.reviewCount}>{reviewCount} đánh giá</Text>
        </View>
        <View style={[styles.formCard, styles.reviewFormCard]}>
          <Text style={styles.formLabel}>VIẾT ĐÁNH GIÁ</Text>
          <View style={styles.reviewStars}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Pressable key={star} onPress={() => setReviewRating(star)} accessibilityRole="button" accessibilityLabel={`${star} sao`}>
                <Star size={23} color={reviewRating >= star ? '#F59E0B' : '#CBD5E1'} fill={reviewRating >= star ? '#F59E0B' : 'transparent'} />
              </Pressable>
            ))}
          </View>
          <TextInput
            value={reviewDraft}
            onChangeText={setReviewDraft}
            placeholder="Chia sẻ trải nghiệm học của bạn..."
            placeholderTextColor="#64748B"
            style={[styles.input, styles.multilineInput, styles.reviewInput]}
            multiline
            textAlignVertical="top"
            maxLength={2000}
          />
          {!enabled ? <Text style={styles.errorText}>Hãy đăng nhập để gửi đánh giá.</Text> : null}
          {reviewError ? <Text style={styles.errorText}>{reviewError}</Text> : null}
          {reviewSuccess ? <Text style={styles.successText}>{reviewSuccess}</Text> : null}
          <Pressable
            onPress={() => void sendReview()}
            disabled={!enabled || !reviewDraft.trim() || reviewSending}
            style={[styles.primaryButton, styles.reviewSubmitButton, (!enabled || !reviewDraft.trim() || reviewSending) && styles.disabledButton]}
            accessibilityRole="button"
          >
            <Text style={styles.primaryButtonText}>{reviewSending ? 'Đang gửi...' : 'Gửi đánh giá'}</Text>
          </Pressable>
        </View>
        {reviewLoading ? (
          <ActivityIndicator color={colors.brand} style={styles.loader} />
        ) : reviews.length ? (
          <View style={styles.list}>
            {reviews.map((review) => <ReviewCard key={review.id} review={review} />)}
          </View>
        ) : (
          <Text style={styles.emptyText}>Chưa có đánh giá nào</Text>
        )}
      </View>
    );
  }

  const fileList = Array.isArray(resources) ? resources : [];
  if (!fileList.length) {
    return (
      <View style={styles.emptyFiles}>
        <FileBox size={36} color="#94A3B8" />
        <Text style={styles.emptyText}>Chưa có tài liệu đính kèm</Text>
      </View>
    );
  }
  return (
    <View style={styles.panel}>
      {fileList.map((file, index) => {
        const url = file.fileUrl || file.url || '';
        const href = url ? resolveMobilePublicUrl(url) : '';
        return (
          <Pressable
            key={file.id || file._id || `${file.title}-${index}`}
            onPress={() => {
              if (!href) return;
              void Linking.openURL(href).catch((error: unknown) => {
                  setResourceError(messageFromError(error, 'Không mở được tài liệu.'));
              });
            }}
            style={styles.questionCard}
            accessibilityRole="link"
          >
            <View style={styles.formHeading}>
              <Text style={styles.questionTitle}>{file.title || file.fileOriginalName || 'Tài liệu'}</Text>
              <Download size={17} color={colors.brand} />
            </View>
            {file.fileSize ? <Text style={styles.metaText}>{String(file.fileSize)}</Text> : null}
          </Pressable>
        );
      })}
      {resourceError ? <Text style={styles.errorText}>{resourceError}</Text> : null}
    </View>
  );
}

function ReviewCard({ review }: { review: CourseReview }) {
  return (
    <View style={[styles.questionCard, styles.reviewCard]}>
      <View style={styles.reviewCardHeader}>
        <View style={styles.flex}>
          <Text style={styles.questionTitle}>{review.author || 'Học viên'}</Text>
          <View style={styles.reviewStars}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Star key={star} size={11} color={review.rating >= star ? '#F59E0B' : '#CBD5E1'} fill={review.rating >= star ? '#F59E0B' : 'transparent'} />
            ))}
          </View>
        </View>
        <Text style={styles.reviewDate}>{relativeTime(review.createdAt)}</Text>
      </View>
      <Text style={styles.bodyText}>{review.comment}</Text>
    </View>
  );
}

const styles = {
  panel: { gap: spacing.md, padding: spacing.md },
  reviewsPanel: { gap: spacing.sm, padding: spacing.sm },
  qaPanel: { gap: spacing.sm, padding: spacing.sm },
  searchBox: { minHeight: 44, flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm, paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: '#D5DFEC', borderRadius: 14, backgroundColor: '#F8FAFC' },
  searchIcon: { width: 28, height: 28, alignItems: 'center' as const, justifyContent: 'center' as const, borderRadius: 9, backgroundColor: '#FFFFFF' },
  searchInput: { minWidth: 0, flex: 1, color: colors.ink, fontSize: typography.caption },
  formCard: { gap: spacing.sm, padding: spacing.md, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: radius.md, backgroundColor: '#FFFFFF', shadowColor: '#0F172A', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  reviewFormCard: { gap: spacing.xs, padding: spacing.sm, borderColor: '#DFE7F1', borderRadius: 16 },
  qaFormCard: { gap: spacing.xs, padding: spacing.sm, borderColor: '#DFE7F1', borderRadius: 16, shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  formHeading: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, gap: spacing.sm },
  formTitleWrap: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm },
  formIcon: { width: 30, height: 30, alignItems: 'center' as const, justifyContent: 'center' as const, borderRadius: 10, backgroundColor: '#0F766E' },
  formLabel: { color: '#1E293B', fontSize: typography.micro, fontWeight: '900' as const, letterSpacing: 0.5 },
  formHint: { marginTop: 2, color: '#64748B', fontSize: typography.micro, fontWeight: '500' as const },
  timeBadge: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, paddingHorizontal: spacing.xs, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: '#ECFDF5' },
  timeText: { color: '#047857', fontSize: typography.micro, fontWeight: '800' as const },
  input: { minHeight: 40, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: radius.sm, backgroundColor: '#FFFFFF', color: colors.ink, fontSize: typography.caption },
  qaInput: { minHeight: 38, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderColor: '#D5DFEC', borderRadius: 11 },
  multilineInput: { minHeight: 70, paddingTop: spacing.sm, textAlignVertical: 'top' as const },
  qaMultilineInput: { minHeight: 62, paddingTop: spacing.sm },
  primaryButton: { minHeight: 38, flexDirection: 'row' as const, alignSelf: 'flex-start' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radius.sm, backgroundColor: '#78B9A8' },
  qaPrimaryButton: { minHeight: 36, borderRadius: 11, backgroundColor: '#0F766E' },
  primaryButtonText: { color: '#FFFFFF', fontSize: typography.micro, fontWeight: '800' as const },
  disabledButton: { opacity: 0.55 },
  listHeadingRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.xs },
  listHeading: { color: '#0F172A', fontSize: typography.caption, fontWeight: '900' as const },
  questionCount: { minWidth: 22, overflow: 'hidden' as const, paddingHorizontal: 6, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: '#F1F5F9', color: '#475569', textAlign: 'center' as const, fontSize: typography.micro, fontWeight: '800' as const },
  list: { gap: spacing.sm },
  questionCard: { gap: spacing.xs, padding: spacing.md, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: radius.md, backgroundColor: '#FFFFFF' },
  questionTitle: { flexShrink: 1, color: '#0F172A', fontSize: typography.caption, fontWeight: '800' as const },
  metaText: { color: '#64748B', fontSize: typography.micro },
  bodyText: { color: '#475569', fontSize: typography.caption, lineHeight: 20 },
  reviewInput: { minHeight: 70, paddingTop: spacing.sm },
  reviewSubmitButton: { minHeight: 36, borderRadius: 11 },
  reviewCard: { gap: spacing.xs, padding: spacing.sm, borderRadius: 15 },
  reviewCardHeader: { flexDirection: 'row' as const, alignItems: 'flex-start' as const, justifyContent: 'space-between' as const, gap: spacing.sm },
  reviewStars: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 2 },
  reviewDate: { paddingTop: 1, color: '#64748B', fontSize: typography.micro },
  replyText: { padding: spacing.sm, borderRadius: radius.sm, backgroundColor: '#ECFDF5', color: '#047857', fontSize: typography.caption, lineHeight: 20 },
  replyCard: { gap: 4, padding: spacing.sm, borderRadius: radius.sm, backgroundColor: '#F8FAFC' },
  replyAuthor: { color: '#047857', fontSize: typography.micro, fontWeight: '800' as const },
  replyForm: { gap: spacing.sm },
  emptyState: { minHeight: 100, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 2, padding: spacing.sm, borderWidth: 1, borderStyle: 'dashed' as const, borderColor: '#E2E8F0', borderRadius: 14, backgroundColor: '#F8FAFC' },
  emptyIcon: { width: 34, height: 34, alignItems: 'center' as const, justifyContent: 'center' as const, marginBottom: 2, borderRadius: 12, backgroundColor: '#E2E8F0' },
  emptyTitle: { color: '#334155', fontSize: typography.caption, fontWeight: '800' as const },
  qaEmptyText: { color: '#64748B', fontSize: typography.caption, textAlign: 'center' as const, lineHeight: 18 },
  emptyText: { paddingVertical: spacing.lg, color: '#64748B', fontSize: typography.caption, textAlign: 'center' as const, lineHeight: 20 },
  emptyFiles: { minHeight: 140, alignItems: 'center' as const, justifyContent: 'center' as const, gap: spacing.xs },
  errorText: { color: '#B91C1C', fontSize: typography.micro, fontWeight: '700' as const },
  successText: { color: '#047857', fontSize: typography.micro, fontWeight: '700' as const },
  loader: { paddingVertical: spacing.md },
  iconButton: { width: 36, height: 36, alignItems: 'center' as const, justifyContent: 'center' as const, borderWidth: 1, borderColor: '#A7F3D0', borderRadius: radius.pill, backgroundColor: '#ECFDF5' },
  filterRow: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: spacing.xs },
  filterButton: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 9, backgroundColor: '#FFFFFF' },
  filterButtonActive: { borderColor: '#059669', backgroundColor: '#ECFDF5' },
  filterText: { color: '#64748B', fontSize: typography.micro, fontWeight: '800' as const },
  filterTextActive: { color: '#047857' },
  deleteButton: { padding: 4 },
  ratingSummary: { minHeight: 66, flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 1, borderColor: '#DFE7F1', borderRadius: 16, backgroundColor: '#FFFFFF' },
  ratingValue: { color: '#0F172A', fontSize: typography.display, lineHeight: 34, fontWeight: '900' as const },
  reviewCount: { color: '#64748B', fontSize: typography.micro, fontWeight: '600' as const },
  starRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 2 },
  flex: { flex: 1 },
};
