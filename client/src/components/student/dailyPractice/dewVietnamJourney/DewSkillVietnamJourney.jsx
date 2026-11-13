import Mascot from '../Mascot';
import {
  dewSkillAnchorsForCount,
  dewSkillDropletPoints,
} from '../../../../../../shared/dailyPractice/dewSkillJourneyAnchors.mjs';
import {
  dewSkillPlainAnchorsForCount,
  pathPlainMascotTopPct,
  pathPlainStageMinHeightPx,
} from '../../../../../../shared/dailyPractice/pathPlainJourney.mjs';
import { DEW_VN_CROP } from '../../../../../../shared/dailyPractice/dewSkillVietnamOutline.mjs';
import { PATH_DROPLET, pathDropletDone } from '../../../../../../shared/dailyPractice/pathDropletDecor.mjs';
import './DewSkillVietnamJourney.css';

function stopStatus(item, index, nextIdx) {
  if (item.state === 'locked') return 'locked';
  if (item.state === 'completed') return 'done';
  if (index === nextIdx) return 'current';
  if (item.state === 'active') return 'current';
  return 'locked';
}

/**
 * Lộ trình chặng — mốc + giọt nước (không nền đường / không bản đồ).
 */
export default function DewSkillVietnamJourney({
  pathItems,
  nextIdx = -1,
  hubAnchorRef,
  hubSelectedKey = '',
  locked: _locked = false,
  showMascot: _showMascot = true,
  plainJourney = true,
  renderHub,
  renderChest,
}) {
  const positions = plainJourney
    ? dewSkillPlainAnchorsForCount(pathItems.length)
    : dewSkillAnchorsForCount(pathItems.length);
  if (!positions.length) return null;

  const droplets = dewSkillDropletPoints(positions);
  const plainMinH = plainJourney ? pathPlainStageMinHeightPx(pathItems.length) : null;
  const { x: vx, y: vy, w, h } = DEW_VN_CROP;
  const lastPos = positions[positions.length - 1];
  const chestSide = lastPos && lastPos.xPct < 52 ? 'right' : 'left';
  const _mascotTopPct = plainJourney ? pathPlainMascotTopPct(positions, nextIdx) : 42;

  return (
    <div className="ds-journey-shell">
      <section
        className={`ds-journey ${plainJourney ? 'ds-journey--plain' : ''}`}
        style={plainMinH ? { aspectRatio: 'auto', minHeight: plainMinH } : undefined}
        aria-label="Lộ trình các mốc trong chặng"
      >
        {plainJourney ? (
          <div className="ds-journey__drops" aria-hidden="true">
            {droplets.map((drop, idx) => {
              const done = pathDropletDone(drop.segmentIndex, pathItems);
              if (drop.kind === 'star') {
                return (
                  <span
                    key={`drop-star-${idx}`}
                    className="ds-journey__star"
                    style={{ left: `${drop.xPct}%`, top: `${drop.yPct}%` }}
                    aria-hidden="true"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="#F59E0B" stroke="#D97706" strokeWidth="1.5">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  </span>
                );
              }
              return (
                <svg
                  key={`drop-${idx}`}
                  className="ds-journey__droplet"
                  style={{ left: `${drop.xPct}%`, top: `${drop.yPct}%` }}
                  viewBox="-6 -10 12 16"
                  width="13"
                  height="15"
                >
                  <path
                    d={PATH_DROPLET.path}
                    fill={done ? PATH_DROPLET.fillDone : PATH_DROPLET.fillTodo}
                    stroke={PATH_DROPLET.stroke}
                    strokeWidth="1"
                  />
                </svg>
              );
            })}
          </div>
        ) : (
          <svg className="ds-journey__map" viewBox={`${vx} ${vy} ${w} ${h}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            {droplets.map((drop, idx) => {
              const done = pathDropletDone(drop.segmentIndex, pathItems);
              return (
                <g key={`drop-${idx}`} transform={`translate(${drop.viewX} ${drop.viewY})`}>
                  <path
                    d={PATH_DROPLET.path}
                    fill={done ? PATH_DROPLET.fillDone : PATH_DROPLET.fillTodo}
                    stroke={PATH_DROPLET.stroke}
                    strokeWidth="1"
                  />
                </g>
              );
            })}
          </svg>
        )}

        {/* Mascot đồng hành theo hình tham chiếu: bên trái đọc sách, góc phải vui tươi */}
        <div className="ds-journey__mascot-left" aria-hidden="true">
          <Mascot mood="studying" size={82} />
        </div>
        <div className="ds-journey__mascot-right" aria-hidden="true">
          <Mascot mood="happy" size={76} />
        </div>

        {renderChest && lastPos ? (
          <div
            className={`ds-journey__chest ds-journey__chest--${chestSide}`}
            style={{ left: `${lastPos.xPct}%`, top: `${lastPos.yPct}%` }}
          >
            {renderChest()}
          </div>
        ) : null}

        {pathItems.map((item, index) => {
          const pos = positions[index];
          if (!pos) return null;
          const status = stopStatus(item, index, nextIdx);
          const hubNext = index === nextIdx;
          const hubSelected = hubSelectedKey === item.node?.key;

          return (
            <div
              key={item.key}
              ref={hubSelected ? hubAnchorRef : undefined}
              data-path-current={hubNext ? '1' : undefined}
              className={`ds-journey__stop ds-journey__stop--${status} ds-journey__hub-scale`}
              style={{ left: `${pos.xPct}%`, top: `${pos.yPct}%` }}
            >
              {renderHub(item, { hubNext, hubSelected, index, status })}
            </div>
          );
        })}
      </section>
    </div>
  );
}
