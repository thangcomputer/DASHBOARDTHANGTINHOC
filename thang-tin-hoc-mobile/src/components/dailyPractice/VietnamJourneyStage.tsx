import React from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { dewSkillDropletPoints } from '../../../../shared/dailyPractice/dewSkillJourneyAnchors.mjs';
import { PATH_DROPLET, pathDropletDone } from '../../../../shared/dailyPractice/pathDropletDecor.mjs';
import {
  dewSkillPlainAnchorsForCount,
  pathPlainHubHalfPx,
  pathPlainMascotTopPct,
  pathPlainStageMinHeightPx,
} from '../../../../shared/dailyPractice/pathPlainJourney.mjs';
import { PATH_HUB_DUO } from '../../../../shared/dailyPractice/pathHubDuoVisual.mjs';
import { Mascot, type MascotMood } from './Mascot';

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
  const positions = dewSkillPlainAnchorsForCount(pathItems.length);
  const stageW = Math.min(winW - 16, 420);
  const stageH = pathPlainStageMinHeightPx(pathItems.length, stageW);
  const droplets = dewSkillDropletPoints(positions);
  const uid = 'dsvn';
  if (!positions.length) return null;

  const hubHalf = pathPlainHubHalfPx(PATH_HUB_DUO.buttonSize.mobile);
  const hubColW = 104;

  return (
    <View style={[styles.stage, { width: stageW, height: stageH, alignSelf: 'center' }]}>
      {droplets.map((drop, idx) => {
        if (drop.xPct == null || drop.yPct == null) return null;
        const done = pathDropletDone(drop.segmentIndex, pathItems);
        const left = (drop.xPct / 100) * stageW;
        const top = (drop.yPct / 100) * stageH;
        if (drop.kind === 'star') {
          return (
            <View
              key={`${uid}-star-${idx}`}
              style={{ position: 'absolute', left: left - 7, top: top - 7, zIndex: 1 }}
              pointerEvents="none"
            >
              <Svg width={14} height={14} viewBox="0 0 24 24">
                <Path
                  d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                  fill="#F59E0B"
                  stroke="#D97706"
                  strokeWidth={1.5}
                />
              </Svg>
            </View>
          );
        }
        return (
          <Svg
            key={`${uid}-drop-${idx}`}
            width={13}
            height={15}
            viewBox="-6 -10 12 16"
            style={{ position: 'absolute', left: left - 6.5, top: top - 7.5, zIndex: 1 }}
          >
            <Path
              d={PATH_DROPLET.path}
              fill={done ? PATH_DROPLET.fillDone : PATH_DROPLET.fillTodo}
              stroke={PATH_DROPLET.stroke}
              strokeWidth={1}
            />
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
