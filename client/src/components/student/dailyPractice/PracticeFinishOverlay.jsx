import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import AchievementPopup from './AchievementPopup';
import PracticeReviewModal from './PracticeReviewModal';
import './achievementPopup.css';

export default function PracticeFinishOverlay({
  summary,
  onDismiss,
  onContinue,
  onReplay,
  onRelatedVideo,
}) {
  const [reviewOpen, setReviewOpen] = useState(false);
  const reviewItems = (summary?.reviewAll?.length ? summary.reviewAll : summary?.review) || [];

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return createPortal(
    <>
      <div className="dp-practice-finish-scrim" role="dialog" aria-modal="true">
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
        <PracticeReviewModal review={reviewItems} onClose={() => setReviewOpen(false)} />
      ) : null}
    </>,
    document.body,
  );
}
