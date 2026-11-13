import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Celebration from './Celebration';
import PracticeReviewModal from './PracticeReviewModal';
import './achievementPopup.css';

export default function PracticeFinishOverlay({
  summary,
  onDismiss,
  onContinue,
  onReplay,
  onRelatedVideo: _onRelatedVideo,
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
      <div className="dp-practice-finish-scrim fixed inset-0 z-[9600] overflow-y-auto" role="dialog" aria-modal="true">
        <Celebration
          summary={summary}
          onDone={onContinue}
          onClose={onDismiss}
          onReviewResults={() => setReviewOpen(true)}
          onReplay={onReplay}
        />
      </div>
      {reviewOpen ? (
        <PracticeReviewModal review={reviewItems} onClose={() => setReviewOpen(false)} />
      ) : null}
    </>,
    document.body,
  );
}
