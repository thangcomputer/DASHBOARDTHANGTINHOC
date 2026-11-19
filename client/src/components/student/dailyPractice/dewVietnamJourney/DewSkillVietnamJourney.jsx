import { useId } from 'react';
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
  const uid = useId().replace(/:/g, '');
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
              const gradId = `ds-drop-${uid}-${idx}`;
              const stopTop = done ? PATH_DROPLET.fillDoneTop : PATH_DROPLET.fillTodoTop;
              const stopMid = done ? PATH_DROPLET.fillDoneMid : PATH_DROPLET.fillTodoMid;
              const stopBot = done ? PATH_DROPLET.fillDoneBot : PATH_DROPLET.fillTodoBot;
              const glowColor = done ? '#A7F3D0' : '#E0F2FE';
              const shadowColor = done ? 'rgba(4, 120, 87, 0.20)' : 'rgba(56, 189, 248, 0.22)';
              return (
                <svg
                  key={gradId}
                  className="ds-journey__droplet"
                  style={{ left: `${drop.xPct}%`, top: `${drop.yPct}%` }}
                  viewBox="0 0 28 34"
                  width="18"
                  height="22"
                >
                  <defs>
                    <linearGradient id={gradId} x1="20%" y1="5%" x2="85%" y2="98%">
                      <stop offset="0%" stopColor={stopTop} />
                      <stop offset="48%" stopColor={stopMid} />
                      <stop offset="100%" stopColor={stopBot} />
                    </linearGradient>
                  </defs>
                  <ellipse cx="14" cy="31.5" rx="6.5" ry="2" fill={shadowColor} />
                  <path
                    d={PATH_DROPLET.glossyPath}
                    fill={`url(#${gradId})`}
                    stroke="rgba(255,255,255,0.95)"
                    strokeWidth="1.3"
                  />
                  <ellipse cx="15" cy="24.5" rx="4.5" ry="2.2" fill={glowColor} opacity="0.45" />
                  <ellipse
                    cx="10.8"
                    cy="17.2"
                    rx="2.3"
                    ry="4.8"
                    fill="#FFFFFF"
                    opacity="0.85"
                    transform="rotate(-18 10.8 17.2)"
                  />
                  <circle cx="13.2" cy="11.5" r="1.25" fill="#FFFFFF" opacity="0.95" />
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
