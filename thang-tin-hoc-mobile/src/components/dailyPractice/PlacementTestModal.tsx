import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Check,
  CheckCircle2,
  Clock,
  Compass,
  FileText,
  RotateCcw,
  Sparkles,
  Target,
} from 'lucide-react-native';
import {
  dailyPracticeApi,
  type DpPlacementAdvice,
  type DpPlacementSkillRow,
} from '../../services/dailyPracticeApi';
import { ShareAchievementModal, ShareTriggerButton, type ShareAchievementData } from '../ShareAchievementModal';
import { buildPlacementShareData } from '../../../../shared/dailyPractice/shareAchievement.mjs';

const STORAGE_PREFIX = 'dewskill_placement_v1';

export type PlacementTopicInput = {
  id?: string;
  name?: string;
  topic?: { id?: string; name?: string };
};

export type PlacementResult = {
  score: number;
  total: number;
  bySkill: DpPlacementSkillRow[];
  recommendedSkill: string;
  recommendedLevel: string;
  matchedTopicId: string;
  matchedTopicName: string;
  completedAt: string;
  savedAnswers?: Record<string, number>;
  ai?: DpPlacementAdvice;
  __retaking?: boolean;
};

type PlacementQuestion = {
  id: string;
  skill: string;
  keywords: string[];
  question: string;
  options: string[];
  answer: number;
};

const QUESTIONS: PlacementQuestion[] = [
  {
    id: 'win1',
    skill: 'Windows & Cơ bản',
    keywords: ['windows', 'cơ bản', 'tin học'],
    question: 'Phím tắt nào dùng để sao chép tệp tin hoặc đoạn văn bản đã chọn trong Windows?',
    options: ['Ctrl + X', 'Ctrl + C', 'Ctrl + V', 'Ctrl + Z'],
    answer: 1,
  },
  {
    id: 'win2',
    skill: 'Windows & Cơ bản',
    keywords: ['windows', 'cơ bản', 'tin học'],
    question: 'Đuôi tệp mặc định của tài liệu Microsoft Word phiên bản mới (2007 trở đi) là gì?',
    options: ['.xlsx', '.pptx', '.docx', '.pdf'],
    answer: 2,
  },
  {
    id: 'word1',
    skill: 'Microsoft Word',
    keywords: ['word', 'soạn thảo'],
    question: 'Theo Nghị định 30/2020/NĐ-CP về thể thức văn bản hành chính trong Word, lề trái chuẩn là bao nhiêu?',
    options: ['15 - 20 mm', '20 - 25 mm', '30 - 35 mm', '40 - 45 mm'],
    answer: 2,
  },
  {
    id: 'word2',
    skill: 'Microsoft Word',
    keywords: ['word', 'soạn thảo'],
    question: 'Để tạo mục lục tự động trong Word, trước tiên ta cần gán thành phần nào cho các đề mục?',
    options: ['Heading (Heading 1, 2, 3...)', 'Watermark', 'Drop Cap', 'Header & Footer'],
    answer: 0,
  },
  {
    id: 'word3',
    skill: 'Microsoft Word',
    keywords: ['word', 'soạn thảo'],
    question: 'Chức năng Mail Merge (Trộn thư) trong Microsoft Word dùng để làm gì?',
    options: [
      'Nén dung lượng ảnh trong văn bản',
      'Tạo hàng loạt thư mời/giấy chứng nhận từ danh sách Excel có sẵn',
      'Kiểm tra lỗi chính tả tiếng Việt',
      'Chuyển Word sang PowerPoint',
    ],
    answer: 1,
  },
  {
    id: 'excel1',
    skill: 'Microsoft Excel',
    keywords: ['excel', 'bảng tính'],
    question: 'Ký hiệu nào dùng để cố định địa chỉ ô/vùng (tham chiếu tuyệt đối) trong công thức Excel?',
    options: ['# (ví dụ #A#1)', '$ (ví dụ $A$1)', '& (ví dụ &A&1)', '% (ví dụ %A%1)'],
    answer: 1,
  },
  {
    id: 'excel2',
    skill: 'Microsoft Excel',
    keywords: ['excel', 'bảng tính'],
    question: 'Trong hàm VLOOKUP(lookup_value, table_array, col_index_num, [range_lookup]), tham số thứ 4 để tìm kiếm CHÍNH XÁC là?',
    options: ['0 hoặc FALSE', '1 hoặc TRUE', '2', '"EXACT"'],
    answer: 0,
  },
  {
    id: 'excel3',
    skill: 'Microsoft Excel',
    keywords: ['excel', 'bảng tính'],
    question: 'Hàm nào dùng để tính tổng theo NHIỀU điều kiện cùng lúc trong Excel?',
    options: ['SUM', 'SUMIF', 'SUMIFS', 'COUNTIFS'],
    answer: 2,
  },
  {
    id: 'ppt1',
    skill: 'Microsoft PowerPoint',
    keywords: ['powerpoint', 'ppt', 'trình chiếu'],
    question: 'Để chèn logo hoặc khung tiêu đề thống nhất cho TẤT CẢ các slide trong PowerPoint, bạn chỉnh sửa ở đâu?',
    options: ['Slide Sorter', 'Slide Master', 'Notes Page', 'Reading View'],
    answer: 1,
  },
  {
    id: 'ppt2',
    skill: 'Microsoft PowerPoint',
    keywords: ['powerpoint', 'ppt', 'trình chiếu'],
    question: 'Nhóm hiệu ứng Transition trong PowerPoint khác Animation ở điểm nào?',
    options: [
      'Transition là hiệu ứng chuyển trang giữa các Slide; Animation là hiệu ứng cho từng đối tượng trên Slide',
      'Transition chỉ áp dụng cho chữ; Animation chỉ áp dụng cho hình ảnh',
      'Hai tính năng hoàn toàn giống nhau',
      'Transition dùng để chèn âm thanh nền',
    ],
    answer: 0,
  },
];

function storageKey(studentId?: string) {
  return `${STORAGE_PREFIX}:${studentId || 'guest'}`;
}

export async function readPlacementResult(studentId?: string): Promise<PlacementResult | null> {
  const key = storageKey(studentId);
  try {
    if (Platform.OS === 'web' && typeof globalThis.localStorage !== 'undefined') {
      const raw = globalThis.localStorage.getItem(key);
      if (raw) return JSON.parse(raw) as PlacementResult;
    }
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as PlacementResult) : null;
  } catch {
    return null;
  }
}

export async function savePlacementResult(studentId: string | undefined, result: PlacementResult) {
  const key = storageKey(studentId);
  const serialized = JSON.stringify(result);
  try {
    if (Platform.OS === 'web' && typeof globalThis.localStorage !== 'undefined') {
      globalThis.localStorage.setItem(key, serialized);
    }
    await AsyncStorage.setItem(key, serialized);
  } catch {
    // ignore persistence errors
  }
}

export function computePlacementRecommendation(
  answers: Record<string, number>,
  topics: PlacementTopicInput[] = [],
): PlacementResult {
  const buckets: Record<string, { skill: string; keywords: string[]; correct: number; total: number }> = {};
  let totalCorrect = 0;

  for (const q of QUESTIONS) {
    if (!buckets[q.skill]) {
      buckets[q.skill] = { skill: q.skill, keywords: q.keywords, correct: 0, total: 0 };
    }
    buckets[q.skill].total += 1;
    if (answers[q.id] === q.answer) {
      buckets[q.skill].correct += 1;
      totalCorrect += 1;
    }
  }

  const bySkill: DpPlacementSkillRow[] = Object.values(buckets).map((b) => ({
    ...b,
    percent: Math.round((b.correct / Math.max(1, b.total)) * 100),
  }));
  const sortedWeakest = [...bySkill].sort((a, b) => a.percent - b.percent || a.correct - b.correct);
  const recommended = sortedWeakest[0] || bySkill[0];

  let recommendedLevel = 'Cơ bản (Lấy lại nền tảng)';
  if (totalCorrect >= 8) recommendedLevel = 'Nâng cao (Thực chiến & Luyện đề)';
  else if (totalCorrect >= 5) recommendedLevel = 'Trung cấp (Tăng tốc kỹ năng văn phòng)';

  const matchedTopic = topics.find((t) => {
    const name = String(t?.name || t?.topic?.name || '').toLowerCase();
    return (recommended.keywords || []).some((kw) => name.includes(kw));
  });

  return {
    score: totalCorrect,
    total: QUESTIONS.length,
    bySkill,
    recommendedSkill: recommended.skill,
    recommendedLevel,
    matchedTopicId: matchedTopic ? String(matchedTopic.id || matchedTopic.topic?.id || '') : '',
    matchedTopicName: matchedTopic ? String(matchedTopic.name || matchedTopic.topic?.name || '') : recommended.skill,
    completedAt: new Date().toISOString(),
  };
}

type PlacementTestModalProps = {
  visible: boolean;
  onClose: () => void;
  studentId?: string;
  topics?: PlacementTopicInput[];
  onApplied?: (result: PlacementResult) => void;
  surveyLevel?: string;
  intro?: boolean;
};

export function PlacementTestModal({
  visible,
  onClose,
  studentId,
  topics = [],
  onApplied,
  surveyLevel = '',
  intro = false,
}: PlacementTestModalProps) {
  const [existing, setExisting] = useState<PlacementResult | null>(null);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<PlacementResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [showIntro, setShowIntro] = useState(Boolean(intro));
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    setShowIntro(Boolean(intro));
    void readPlacementResult(studentId).then((loaded) => {
      if (alive) setExisting(loaded);
    });
    return () => {
      alive = false;
    };
  }, [studentId, visible, intro]);

  const effectiveSurveyLevel = useMemo(() => {
    if (surveyLevel) return surveyLevel;
    try {
      if (Platform.OS === 'web' && typeof globalThis.localStorage !== 'undefined') {
        return globalThis.localStorage.getItem('dewskill_survey_level') || '';
      }
    } catch {
      // ignore
    }
    return '';
  }, [surveyLevel]);

  if (!visible) return null;

  const activeResult = result || (Object.keys(answers).length === 0 ? existing : null);
  const current = QUESTIONS[step];
  const answeredCount = Object.keys(answers).length;
  const showResultScreen = Boolean(activeResult && !activeResult.__retaking);
  const ai = showResultScreen ? activeResult?.ai : null;

  const choose = (optIndex: number) => {
    const next = { ...answers, [current.id]: optIndex };
    setAnswers(next);
    if (step < QUESTIONS.length - 1) {
      setTimeout(() => setStep((s) => Math.min(QUESTIONS.length - 1, s + 1)), 180);
    }
  };

  const requestAiAdvice = async (computed: PlacementResult, answerMap?: Record<string, number>) => {
    setAiLoading(true);
    setAiError('');
    try {
      const answersToUse = answerMap && Object.keys(answerMap).length > 0
        ? answerMap
        : (computed.savedAnswers || answers || {});
      const wrongTopics = QUESTIONS
        .filter((q) => answersToUse[q.id] !== undefined && answersToUse[q.id] !== q.answer)
        .map((q) => `[${q.skill}] ${q.question}`);
      const advice = await dailyPracticeApi.placementAdvice({
        score: computed.score,
        total: computed.total,
        bySkill: computed.bySkill.map(({ skill, correct, total }) => ({ skill, correct, total })),
        wrongTopics,
        surveyLevel: effectiveSurveyLevel,
        topics: topics.map((t) => t?.name || t?.topic?.name || '').filter(Boolean),
      });
      if (!advice?.summary) throw new Error('empty');
      let next: PlacementResult = { ...computed, ai: advice };
      const aiTopic = String(advice.recommendedTopic || '').toLowerCase();
      if (aiTopic) {
        const matched = topics.find((t) => {
          const name = String(t?.name || t?.topic?.name || '').toLowerCase();
          return Boolean(name) && (name.includes(aiTopic) || aiTopic.includes(name));
        });
        if (matched) {
          next = {
            ...next,
            matchedTopicId: String(matched.id || matched.topic?.id || ''),
            matchedTopicName: String(matched.name || matched.topic?.name || next.matchedTopicName),
          };
        } else if (advice.recommendedTopic) {
          next = { ...next, matchedTopicName: advice.recommendedTopic };
        }
      }
      await savePlacementResult(studentId, next);
      setResult(next);
      setExisting(next);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      setAiError(
        msg && msg !== 'empty'
          ? msg
          : 'Chưa phân tích chi tiết được lúc này. Kết quả cơ bản vẫn được lưu.',
      );
    } finally {
      setAiLoading(false);
    }
  };

  const finish = () => {
    const computed: PlacementResult = {
      ...computePlacementRecommendation(answers, topics),
      savedAnswers: answers,
    };
    void savePlacementResult(studentId, computed);
    setResult(computed);
    setExisting(computed);
    void requestAiAdvice(computed, answers);
  };

  const resetTest = () => {
    setAnswers({});
    setStep(0);
    setAiError('');
    setShowIntro(false);
    setResult({ ...computePlacementRecommendation({}, topics), __retaking: true });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => { if (!aiLoading) onClose(); }}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIcon}>
                <Compass size={19} color="#FFFFFF" />
              </View>
              <View style={styles.flex}>
                <Text style={styles.headerTitle} numberOfLines={1}>
                  Kiểm tra đầu vào · Gợi ý lộ trình
                </Text>
                <Text style={styles.headerSubtitle} numberOfLines={1}>
                  10 câu đánh giá nhanh Windows, Word, Excel, PowerPoint
                </Text>
              </View>
            </View>
            <Pressable
              disabled={aiLoading}
              onPress={onClose}
              style={[styles.closeBtn, aiLoading && styles.disabled]}
              accessibilityRole="button"
              accessibilityLabel="Đóng"
            >
              <Text style={styles.closeBtnText}>Đóng</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            {showIntro && !showResultScreen ? (
              <View style={styles.introWrap}>
                <View style={styles.introIcon}>
                  <Compass size={28} color="#FFFFFF" />
                </View>
                <Text style={styles.introTitle}>Cùng tìm điểm xuất phát phù hợp nhất cho bạn</Text>
                <Text style={styles.introDesc}>
                  10 câu trắc nghiệm nhanh (khoảng 3 phút) về Windows, Word, Excel và PowerPoint.
                  Hệ thống sẽ phân tích bài làm và gợi ý lộ trình học riêng cho bạn.
                </Text>
                <View style={styles.introPills}>
                  <View style={[styles.introPill, { backgroundColor: '#ECFDF5' }]}>
                    <Clock size={14} color="#065F46" />
                    <Text style={[styles.introPillText, { color: '#065F46' }]}>~3 phút</Text>
                  </View>
                  <View style={[styles.introPill, { backgroundColor: '#F0F9FF' }]}>
                    <FileText size={14} color="#075985" />
                    <Text style={[styles.introPillText, { color: '#075985' }]}>10 câu</Text>
                  </View>
                  <View style={[styles.introPill, { backgroundColor: '#F5F3FF' }]}>
                    <Target size={14} color="#5B21B6" />
                    <Text style={[styles.introPillText, { color: '#5B21B6' }]}>Gợi ý lộ trình</Text>
                  </View>
                </View>
                <View style={styles.introActions}>
                  <Pressable onPress={onClose} style={styles.secondaryBtn} accessibilityRole="button">
                    <Text style={styles.secondaryBtnText}>Để sau</Text>
                  </Pressable>
                  <Pressable onPress={() => setShowIntro(false)} style={styles.primaryBtn} accessibilityRole="button">
                    <Sparkles size={14} color="#FFFFFF" />
                    <Text style={styles.primaryBtnText}>Bắt đầu kiểm tra</Text>
                  </Pressable>
                </View>
              </View>
            ) : showResultScreen && activeResult ? (
              <View style={styles.resultWrap}>
                <View style={styles.scoreBox}>
                  <View style={styles.scoreTop}>
                    <View>
                      <Text style={styles.scoreEyebrow}>KẾT QUẢ ĐÁNH GIÁ NĂNG LỰC</Text>
                      <Text style={styles.scoreValue}>{`${activeResult.score}/${activeResult.total} câu đúng`}</Text>
                    </View>
                    <View style={styles.levelBadge}>
                      <Text style={styles.levelBadgeText}>{activeResult.recommendedLevel}</Text>
                    </View>
                  </View>
                  <Text style={styles.recommendLine}>
                    Đề xuất ưu tiên luyện ngay:{' '}
                    <Text style={styles.recommendTopic}>{activeResult.matchedTopicName}</Text>
                    {` (Kỹ năng cần củng cố nhất: ${activeResult.recommendedSkill}).`}
                  </Text>
                </View>

                {aiLoading ? (
                  <View style={styles.aiLoadingBox}>
                    <ActivityIndicator size="small" color="#6D28D9" />
                    <Text style={styles.aiLoadingText}>
                      Đang phân tích bài làm và thiết kế lộ trình riêng cho bạn...
                    </Text>
                  </View>
                ) : ai ? (
                  <View style={styles.aiCard}>
                    <View style={styles.aiHead}>
                      <View style={styles.inline}>
                        <Sparkles size={14} color="#6D28D9" />
                        <Text style={styles.aiTitle}>NHẬN XÉT & ĐỊNH HƯỚNG HỌC TẬP</Text>
                      </View>
                      {ai.levelLabel ? (
                        <View style={styles.aiLevelPill}>
                          <Text style={styles.aiLevelPillText}>{ai.levelLabel}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.aiSummary}>{ai.summary}</Text>
                    {ai.strengths?.length ? (
                      <View style={styles.aiListCard}>
                        <Text style={[styles.aiListHeading, { color: '#047857' }]}>ĐIỂM MẠNH</Text>
                        {ai.strengths.map((s) => (
                          <View key={s} style={styles.aiListItem}>
                            <Check size={13} color="#059669" />
                            <Text style={styles.aiListText}>{s}</Text>
                          </View>
                        ))}
                      </View>
                    ) : null}
                    {ai.focus?.length ? (
                      <View style={[styles.aiListCard, { borderColor: '#FDE68A' }]}>
                        <Text style={[styles.aiListHeading, { color: '#B45309' }]}>CẦN TẬP TRUNG</Text>
                        {ai.focus.map((s) => (
                          <View key={s} style={styles.aiListItem}>
                            <View style={styles.amberDot} />
                            <Text style={styles.aiListText}>{s}</Text>
                          </View>
                        ))}
                      </View>
                    ) : null}
                    {ai.plan?.length ? (
                      <View style={styles.planWrap}>
                        <Text style={styles.planHeading}>LỘ TRÌNH GỢI Ý</Text>
                        {ai.plan.map((p, idx) => (
                          <View key={`${p.title}-${idx}`} style={styles.planRow}>
                            <View style={styles.planNum}>
                              <Text style={styles.planNumText}>{idx + 1}</Text>
                            </View>
                            <View style={styles.flex}>
                              <Text style={styles.planTitle}>{p.title}</Text>
                              {p.detail ? <Text style={styles.planDetail}>{p.detail}</Text> : null}
                            </View>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                ) : (
                  <View style={styles.aiRetryCard}>
                    <Text style={styles.aiRetryText}>
                      {aiError || 'Nhận phân tích chi tiết & lộ trình học dành riêng cho bạn.'}
                    </Text>
                    <Pressable
                      onPress={() => { void requestAiAdvice(activeResult, answers); }}
                      style={styles.aiRetryBtn}
                      accessibilityRole="button"
                    >
                      <Sparkles size={13} color="#FFFFFF" />
                      <Text style={styles.aiRetryBtnText}>{aiError ? 'Thử lại' : 'Phân tích lộ trình'}</Text>
                    </Pressable>
                  </View>
                )}

                <View style={styles.skillSection}>
                  <Text style={styles.skillHeading}>MỨC ĐỘ THÀNH THẠO THEO KỸ NĂNG</Text>
                  {(activeResult.bySkill || []).map((row) => (
                    <View key={row.skill} style={styles.skillRow}>
                      <View style={styles.skillTop}>
                        <Text style={styles.skillName}>{row.skill}</Text>
                        <Text style={styles.skillScore}>{`${row.correct}/${row.total} (${row.percent}%)`}</Text>
                      </View>
                      <View style={styles.skillTrack}>
                        <View style={[styles.skillFill, { width: `${Math.max(8, row.percent)}%` }]} />
                      </View>
                    </View>
                  ))}
                </View>

                <View style={styles.resultFooter}>
                  <Pressable
                    disabled={aiLoading}
                    onPress={resetTest}
                    style={[styles.secondaryBtn, aiLoading && styles.disabled]}
                    accessibilityRole="button"
                  >
                    <RotateCcw size={14} color="#334155" />
                    <Text style={styles.secondaryBtnText}>Làm lại bài 10 câu</Text>
                  </Pressable>
                  <ShareTriggerButton
                    onPress={() => setShareOpen(true)}
                    label="SHARE"
                    size="sm"
                    style={{ borderRadius: 12, paddingVertical: 10 }}
                  />
                  <Pressable
                    disabled={aiLoading}
                    onPress={() => {
                      onApplied?.(activeResult);
                      onClose();
                    }}
                    style={[styles.primaryBtn, aiLoading && styles.disabled]}
                    accessibilityRole="button"
                  >
                    <Target size={15} color="#FFFFFF" />
                    <Text style={styles.primaryBtnText}>
                      {aiLoading ? 'Đang phân tích...' : 'Áp dụng lộ trình gợi ý'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={styles.quizWrap}>
                <View style={styles.quizMetaRow}>
                  <View style={styles.skillBadge}>
                    <Sparkles size={13} color="#047857" />
                    <Text style={styles.skillBadgeText}>{current.skill}</Text>
                  </View>
                  <Text style={styles.quizStepText}>{`Câu ${step + 1} / ${QUESTIONS.length}`}</Text>
                </View>

                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${Math.round(((step + 1) / QUESTIONS.length) * 100)}%` }]} />
                </View>

                <Text style={styles.questionText}>{current.question}</Text>

                <View style={styles.optionsList}>
                  {current.options.map((opt, idx) => {
                    const picked = answers[current.id] === idx;
                    return (
                      <Pressable
                        key={opt}
                        onPress={() => choose(idx)}
                        style={[styles.optionBtn, picked && styles.optionBtnActive]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: picked }}
                      >
                        <Text style={[styles.optionText, picked && styles.optionTextActive]}>
                          {`${String.fromCharCode(65 + idx)}. ${opt}`}
                        </Text>
                        {picked ? <CheckCircle2 size={18} color="#059669" /> : null}
                      </Pressable>
                    );
                  })}
                </View>

                <View style={styles.quizFooter}>
                  <Pressable
                    disabled={step === 0}
                    onPress={() => setStep((s) => Math.max(0, s - 1))}
                    style={[styles.secondaryBtn, step === 0 && styles.disabled]}
                    accessibilityRole="button"
                  >
                    <Text style={styles.secondaryBtnText}>Câu trước</Text>
                  </Pressable>
                  {step < QUESTIONS.length - 1 ? (
                    <Pressable
                      onPress={() => setStep((s) => Math.min(QUESTIONS.length - 1, s + 1))}
                      style={styles.darkBtn}
                      accessibilityRole="button"
                    >
                      <Text style={styles.darkBtnText}>Câu tiếp</Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      disabled={answeredCount < QUESTIONS.length}
                      onPress={finish}
                      style={[styles.primaryBtn, answeredCount < QUESTIONS.length && styles.disabled]}
                      accessibilityRole="button"
                    >
                      <Text style={styles.primaryBtnText}>
                        {`Xem kết quả (${answeredCount}/${QUESTIONS.length})`}
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>
            )}
          </ScrollView>
        </View>
        <ShareAchievementModal
          visible={shareOpen}
          onClose={() => setShareOpen(false)}
          data={activeResult ? (buildPlacementShareData(activeResult) as ShareAchievementData) : null}
          inlineOverlay
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  disabled: { opacity: 0.45 },
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
  },
  card: {
    width: '100%',
    maxWidth: 640,
    maxHeight: '92%',
    overflow: 'hidden',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerLeft: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 15, fontWeight: '900', color: '#0F172A' },
  headerSubtitle: { fontSize: 11, fontWeight: '600', color: '#64748B', marginTop: 1 },
  closeBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  closeBtnText: { fontSize: 12, fontWeight: '900', color: '#475569' },
  scroll: { flexShrink: 1 },
  body: { padding: 18 },
  introWrap: { alignItems: 'center', gap: 14, paddingVertical: 8 },
  introIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  introTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A', textAlign: 'center' },
  introDesc: { fontSize: 13, lineHeight: 20, fontWeight: '500', color: '#64748B', textAlign: 'center' },
  introPills: { flexDirection: 'row', gap: 8, width: '100%' },
  introPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  introPillText: { fontSize: 11, fontWeight: '800' },
  introActions: { flexDirection: 'row', gap: 10, paddingTop: 4 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    backgroundColor: '#10B981',
    borderBottomWidth: 3,
    borderBottomColor: '#047857',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  primaryBtnText: { fontSize: 12, fontWeight: '900', color: '#FFFFFF' },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  secondaryBtnText: { fontSize: 12, fontWeight: '800', color: '#334155' },
  darkBtn: {
    borderRadius: 12,
    backgroundColor: '#0F172A',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  darkBtnText: { fontSize: 12, fontWeight: '800', color: '#FFFFFF' },
  quizWrap: { gap: 14 },
  quizMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  skillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  skillBadgeText: { fontSize: 11, fontWeight: '800', color: '#047857' },
  quizStepText: { fontSize: 12, fontWeight: '800', color: '#64748B' },
  progressTrack: { height: 6, borderRadius: 999, backgroundColor: '#F1F5F9', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: '#10B981' },
  questionText: { fontSize: 16, lineHeight: 23, fontWeight: '900', color: '#0F172A' },
  optionsList: { gap: 10 },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  optionBtnActive: { borderColor: '#10B981', backgroundColor: '#ECFDF5' },
  optionText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#334155', lineHeight: 19 },
  optionTextActive: { color: '#064E3B', fontWeight: '800' },
  quizFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  resultWrap: { gap: 14 },
  scoreBox: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    backgroundColor: '#ECFDF5',
    padding: 14,
    gap: 8,
  },
  scoreTop: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  scoreEyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 0.6, color: '#047857' },
  scoreValue: { fontSize: 22, fontWeight: '900', color: '#0F172A', marginTop: 2 },
  levelBadge: { borderRadius: 999, backgroundColor: '#059669', paddingHorizontal: 12, paddingVertical: 5 },
  levelBadgeText: { fontSize: 11, fontWeight: '900', color: '#FFFFFF' },
  recommendLine: { fontSize: 13, lineHeight: 19, color: '#334155', fontWeight: '500' },
  recommendTopic: { fontWeight: '900', color: '#047857' },
  aiLoadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DDD6FE',
    backgroundColor: '#F5F3FF',
    padding: 12,
  },
  aiLoadingText: { flex: 1, fontSize: 12, fontWeight: '700', color: '#5B21B6' },
  aiCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DDD6FE',
    backgroundColor: '#FAF5FF',
    padding: 14,
    gap: 10,
  },
  aiHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  aiTitle: { fontSize: 11, fontWeight: '900', color: '#6D28D9' },
  aiLevelPill: { borderRadius: 999, backgroundColor: '#7C3AED', paddingHorizontal: 10, paddingVertical: 3 },
  aiLevelPillText: { fontSize: 11, fontWeight: '900', color: '#FFFFFF' },
  aiSummary: { fontSize: 13, lineHeight: 20, fontWeight: '500', color: '#334155' },
  aiListCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1FAE5',
    backgroundColor: '#FFFFFF',
    padding: 10,
    gap: 5,
  },
  aiListHeading: { fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },
  aiListItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  aiListText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '500', color: '#334155' },
  amberDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#F59E0B', marginTop: 5 },
  planWrap: { gap: 6 },
  planHeading: { fontSize: 10, fontWeight: '900', letterSpacing: 0.6, color: '#64748B' },
  planRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    padding: 10,
  },
  planNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
  planNumText: { fontSize: 11, fontWeight: '900', color: '#FFFFFF' },
  planTitle: { fontSize: 12, fontWeight: '900', color: '#1E293B' },
  planDetail: { fontSize: 12, color: '#475569', marginTop: 2 },
  aiRetryCard: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    padding: 12,
  },
  aiRetryText: { flex: 1, minWidth: 180, fontSize: 12, fontWeight: '600', color: '#475569' },
  aiRetryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 10,
    backgroundColor: '#7C3AED',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  aiRetryBtnText: { fontSize: 12, fontWeight: '800', color: '#FFFFFF' },
  skillSection: { gap: 8 },
  skillHeading: { fontSize: 11, fontWeight: '900', letterSpacing: 0.6, color: '#64748B' },
  skillRow: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    padding: 12,
    gap: 8,
  },
  skillTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  skillName: { fontSize: 12, fontWeight: '800', color: '#1E293B' },
  skillScore: { fontSize: 12, fontWeight: '800', color: '#047857' },
  skillTrack: { height: 7, borderRadius: 999, backgroundColor: '#E2E8F0', overflow: 'hidden' },
  skillFill: { height: '100%', borderRadius: 999, backgroundColor: '#10B981' },
  resultFooter: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10, paddingTop: 4 },
});
