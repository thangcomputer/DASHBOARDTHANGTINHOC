import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getDewSkillThemeAttr } from '../../../utils/dewskillTheme';
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
    <div data-theme={getDewSkillThemeAttr()}>
      <div className="dp-practice-finish-scrim fixed inset-0 z-[9600] overflow-y-auto bg-slate-900/25 backdrop-blur-xs" role="dialog" aria-modal="true">
        <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
          <div className="dew-water-orb left-6 top-14 h-12 w-12 opacity-65" />
          <div className="dew-water-orb right-10 top-20 h-16 w-16 opacity-60" />
          <div className="dew-water-orb bottom-12 left-12 h-14 w-14 opacity-55" />
        </div>
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
    </div>,
    document.body,
  );
}
