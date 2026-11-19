import React, { useId } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Stop } from 'react-native-svg';
import { dewSkillDropletPoints } from '../../../../shared/dailyPractice/dewSkillJourneyAnchors.mjs';
import { PATH_DROPLET, pathDropletDone } from '../../../../shared/dailyPractice/pathDropletDecor.mjs';
import {
  dewSkillPlainAnchorsForCount,
  pathPlainHubHalfPx,
  pathPlainStageMinHeightPx,
} from '../../../../shared/dailyPractice/pathPlainJourney.mjs';
import { PATH_HUB_DUO } from '../../../../shared/dailyPractice/pathHubDuoVisual.mjs';
import { Mascot } from './Mascot';

type PathItem = {
  key: string;
  state: string;
  node: { key: string };
};

function stopStatus(item: PathItem, index: number, nextIdx: number) {
  if (item.state === 'locked') return 'locked';
  if (item.state === 'completed') return 'done';
  if (index === nextIdx) return 'current';
  if (item.state === 'active') return 'current';
  return 'locked';
}

type VietnamJourneyStageProps = {
  pathItems: PathItem[];
  laneWidthPx?: number;
  mapProps?: Record<string, unknown>;
  nextIdx: number;
  locked: boolean;
  renderNode: (item: PathItem, ctx: { hubNext: boolean; index: number; status: string }) => React.ReactNode;
};

export function VietnamJourneyStage({
  pathItems,
  laneWidthPx = 300,
  nextIdx,
  locked,
  renderNode,
}: VietnamJourneyStageProps) {
  const { width: winW } = useWindowDimensions();
  const uid = useId().replace(/:/g, '');
  const positions = dewSkillPlainAnchorsForCount(pathItems.length);
  const stageW = Math.min(winW - 16, 420);
  const stageH = pathPlainStageMinHeightPx(pathItems.length, stageW);
  const droplets = dewSkillDropletPoints(positions);
  if (!positions.length) return null;

  const hubBox = PATH_HUB_DUO.buttonSize.mobile + PATH_HUB_DUO.ringPad;
  const hubHalf = pathPlainHubHalfPx(hubBox);
  const hubColW = 112;

  return (
    <View style={[styles.stage, { width: stageW, height: stageH, alignSelf: 'center' }]}>
      {droplets.map((drop, idx) => {
        if (drop.xPct == null || drop.yPct == null) return null;
        const done = pathDropletDone(drop.segmentIndex, pathItems);
        const left = (drop.xPct / 100) * stageW;
        const top = (drop.yPct / 100) * stageH;
        const gradId = `drop-${uid}-${idx}`;
        const stopTop = done ? PATH_DROPLET.fillDoneTop : PATH_DROPLET.fillTodoTop;
        const stopMid = done ? PATH_DROPLET.fillDoneMid : PATH_DROPLET.fillTodoMid;
        const stopBot = done ? PATH_DROPLET.fillDoneBot : PATH_DROPLET.fillTodoBot;
        const glowColor = done ? '#A7F3D0' : '#E0F2FE';
        const shadowColor = done ? 'rgba(4, 120, 87, 0.20)' : 'rgba(56, 189, 248, 0.22)';

        return (
          <Svg
            key={gradId}
            width={18}
            height={22}
            viewBox="0 0 28 34"
            style={{ position: 'absolute', left: left - 9, top: top - 11, zIndex: 1 }}
            pointerEvents="none"
          >
            <Defs>
              <LinearGradient id={gradId} x1="0.2" y1="0.05" x2="0.85" y2="0.98">
                <Stop offset="0" stopColor={stopTop} />
                <Stop offset="0.48" stopColor={stopMid} />
                <Stop offset="1" stopColor={stopBot} />
              </LinearGradient>
            </Defs>
            {/* Bóng mềm phía dưới giọt nước */}
            <Ellipse cx="14" cy="31.5" rx="6.5" ry="2" fill={shadowColor} />
            {/* Thân giọt nước chuyển sắc 3D */}
            <Path
              d={PATH_DROPLET.glossyPath}
              fill={`url(#${gradId})`}
              stroke="rgba(255,255,255,0.95)"
              strokeWidth={1.3}
            />
            {/* Ánh phản quang đáy giọt */}
            <Ellipse cx="15" cy="24.5" rx="4.5" ry="2.2" fill={glowColor} opacity={0.45} />
            {/* Vệt bóng sáng lấp lánh góc trên trái */}
            <Ellipse
              cx="10.8"
              cy="17.2"
              rx="2.3"
              ry="4.8"
              fill="#FFFFFF"
              opacity={0.85}
              transform="rotate(-18 10.8 17.2)"
            />
            <Circle cx="13.2" cy="11.5" r="1.25" fill="#FFFFFF" opacity={0.95} />
          </Svg>
        );
      })}

      {/* Linh vật bên trái đọc sách & bên phải tươi vui theo thiết kế tham chiếu */}
      <View style={styles.mascotLeft} pointerEvents="none">
        <Mascot mood="studying" size={80} />
      </View>
      <View style={styles.mascotRight} pointerEvents="none">
        <Mascot mood="happy" size={74} />
      </View>

      {pathItems.map((item, index) => {
        const pos = positions[index];
        if (!pos) return null;
        const hubNext = index === nextIdx;
        const status = stopStatus(item, index, nextIdx);
        const cx = (pos.xPct / 100) * stageW;
        const cy = (pos.yPct / 100) * stageH;
        return (
          <View
            key={item.key}
            style={[styles.stop, { left: cx - hubColW / 2, top: cy - hubHalf, width: hubColW }]}
          >
            {renderNode(item, { hubNext, index, status })}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    alignSelf: 'stretch',
    width: '100%',
    borderRadius: 0,
    backgroundColor: 'transparent',
    overflow: 'visible',
    position: 'relative',
  },
  stop: { position: 'absolute', alignItems: 'center', zIndex: 2, overflow: 'visible' },
  mascotLeft: { position: 'absolute', left: 4, top: '22%', zIndex: 1 },
  mascotRight: { position: 'absolute', right: 4, top: '84%', zIndex: 1 },
});
