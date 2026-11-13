import { useState } from 'react';
import { createPortal } from 'react-dom';
import AchievementPopup from './AchievementPopup';
import PracticeReviewModal from './PracticeReviewModal';

export default function PracticeFinishOverlay({
  summary,
  onDismiss,
  onContinue,
  onReplay,
  onRelatedVideo,
}) {
  const [reviewOpen, setReviewOpen] = useState(false);

  return createPortal(
    <>
      <div className="fixed inset-0 z-[9200] flex max-h-[100dvh] items-center justify-center overflow-y-auto bg-slate-950/44 p-3 sm:p-4" role="presentation">
        <AchievementPopup
          summary={summary}
          eventKey={summary?.sessionId || summary?.id || ''}
          onContinue={onContinue}
          onReviewResults={() => setReviewOpen(true)}
          onReplay={onReplay}
          onDismiss={onDismiss}
          onRelatedVideo={onRelatedVideo}
        />
      </div>
      {reviewOpen ? (
        <PracticeReviewModal review={summary?.review || []} onClose={() => setReviewOpen(false)} />
      ) : null}
    </>,
    document.body,
  );
}
