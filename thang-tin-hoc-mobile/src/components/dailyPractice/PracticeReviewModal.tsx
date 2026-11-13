import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Sparkles, X } from 'lucide-react-native';
import type { DpSummary } from '../../services/dailyPracticeApi';
import { reviewItemFollowUpLine } from '../../../../shared/dailyPractice/reviewDisplay.mjs';

export function PracticeReviewModal({
  review,
  visible,
  onClose,
}: {
  review: DpSummary['review'];
  visible: boolean;
  onClose: () => void;
}) {
  const items = review || [];
  if (!visible) return null;

  if (!items.length) {
    return (
      <Modal visible transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.backdrop}>
          <View style={[styles.card, { padding: 20, maxHeight: undefined }]}>
            <Text style={styles.headTitle}>Chưa có dữ liệu xem lại cho lượt này.</Text>
            <Pressable onPress={onClose} style={[styles.closeBtn, { alignSelf: 'center', marginTop: 12 }]}>
              <Text style={styles.headTitle}>Đóng</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.head}>
            <View style={styles.headTitleRow}>
              <Sparkles size={16} color="#D97706" />
              <Text style={styles.headTitle}>Xem lại kết quả</Text>
              <Text style={styles.headCount}>{`(${items.length})`}</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Đóng">
              <X size={17} color="#64748B" />
            </Pressable>
          </View>
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {items.map((item, idx) => {
              const answerText = String(item.correctAnswer?.text || '').trim();
              const followUp = reviewItemFollowUpLine(item);
              const wrong = (item as { correct?: boolean }).correct === false;
              return (
                <View key={item.id || idx} style={[styles.item, wrong && styles.itemWrong]}>
                  {wrong ? <Text style={styles.itemWrongTag}>CHƯA ĐÚNG</Text> : null}
                  <Text style={styles.prompt}>{item.prompt}</Text>
                  {answerText ? (
                    <Text style={styles.answer}>{`✓ ${answerText}`}</Text>
                  ) : followUp ? (
                    <Text style={styles.explainMain}>{followUp}</Text>
                  ) : null}
                  {answerText && followUp ? <Text style={styles.explain}>{followUp}</Text> : null}
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
  },
  card: {
    maxHeight: '78%',
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  headTitle: { fontSize: 14, fontWeight: '900', color: '#0F172A' },
  headCount: { fontSize: 12, fontWeight: '700', color: '#94A3B8' },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { maxHeight: 420 },
  listContent: { padding: 14, gap: 10 },
  item: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  itemWrong: {
    backgroundColor: '#FFF1F2',
    borderColor: '#FECDD3',
  },
  itemWrongTag: {
    marginBottom: 4,
    fontSize: 10,
    fontWeight: '900',
    color: '#E11D48',
    letterSpacing: 0.4,
  },
  prompt: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  answer: { marginTop: 6, fontSize: 13, fontWeight: '700', color: '#059669' },
  explainMain: { marginTop: 6, fontSize: 13, fontWeight: '600', color: '#475569' },
  explain: { marginTop: 4, fontSize: 12, color: '#64748B' },
});
