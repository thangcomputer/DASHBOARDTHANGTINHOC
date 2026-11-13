import DewSkillVietnamJourney from './dewVietnamJourney/DewSkillVietnamJourney';
import { PathStageArt } from './PathDecor';

/** Lộ trình chặng — bọc bộ DewSkill_VietnamJourney + hub/API hiện tại. */
export default function VietnamJourneyStage({
  pathItems,
  mapProps: _mapProps,
  tone: _tone,
  nextIdx,
  hubSelectedKey,
  unit: _unit,
  locked,
  isUnitNewlyUnlocked: _isUnitNewlyUnlocked,
  artAt,
  hasVideo,
  unitImageUrl,
  laneWidthPx: _laneWidthPx = 280,
  hubAnchorRef,
  renderHub,
  plainJourney = true,
}) {
  if (!pathItems.length) return null;

  const artIndex = artAt;
  const wrapRender = (item, ctx) => (
    <>
      {!plainJourney && artIndex === ctx.index && !hasVideo && unitImageUrl ? (
        <PathStageArt
          side={positionsEast(item) ? 'left' : 'right'}
          imageUrl={unitImageUrl}
          mood={locked ? 'thinking' : ctx.hubNext ? 'determinedSoft' : 'studying'}
          size={68}
        />
      ) : null}
      {renderHub(item, ctx)}
    </>
  );

  return (
    <DewSkillVietnamJourney
      pathItems={pathItems}
      nextIdx={nextIdx}
      hubAnchorRef={hubAnchorRef}
      hubSelectedKey={hubSelectedKey}
      locked={locked}
      showMascot={!locked && nextIdx >= 0}
      plainJourney
      renderHub={wrapRender}
    />
  );
}

function positionsEast(item) {
  const icons = { book: 0, dumbbell: 1, flame: 2, crown: 3 };
  return (icons[item.node?.icon] ?? 0) % 2 === 0;
}
