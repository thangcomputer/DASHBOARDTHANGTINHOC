import React, { useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AchievementPopup } from './AchievementPopup';
import { PracticeReviewModal } from './PracticeReviewModal';
import type { GameSound } from './useGameSounds';
import type { DpSummary } from '../../services/dailyPracticeApi';

export function PracticeFinishOverlay({
  summary,
  play,
  visible,
  onDismiss,
  onContinue,
  onReplay,
  onRelatedVideo,
}: {
  summary: DpSummary;
  play: (s: GameSound) => void;
  visible: boolean;
  onDismiss: () => void;
  onContinue: () => void;
  onReplay?: () => void;
  onRelatedVideo?: () => void;
}) {
  const [reviewOpen, setReviewOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const reviewItems = (summary.reviewAll?.length ? summary.reviewAll : summary.review) || [];

  return (
    <>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
        <View style={[styles.backdrop, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }]}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <AchievementPopup
              summary={summary}
              play={play}
              onContinue={onContinue}
              onReviewResults={() => setReviewOpen(true)}
              onReplay={onReplay}
              onDismiss={onDismiss}
              onRelatedVideo={onRelatedVideo}
            />
          </ScrollView>
        </View>
      </Modal>
      <PracticeReviewModal review={reviewItems} visible={reviewOpen} onClose={() => setReviewOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.68)',
    justifyContent: 'center',
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
});
