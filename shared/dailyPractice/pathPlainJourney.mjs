/** Bố cục lộ trình lượn sóng hình chữ S chuẩn DewSkill (tỷ lệ % đồng bộ web + mobile). */
export const PATH_PLAIN = {
  sCurveCycle: [52, 65, 53, 42],
  yStart: 10,
  yEnd: 85,
  mascotLeftPct: 4,
  mascotRightPct: 4,
};

/** Mốc lộ trình lượn sóng chữ S — tọa độ % trong khung chặng. */
export function dewSkillPlainAnchorsForCount(nodeCount) {
  const count = Math.max(0, Number(nodeCount) || 0);
  if (!count) return [];

  const { sCurveCycle, yStart, yEnd } = PATH_PLAIN;
  const ySpan = yEnd - yStart;
  const positions = [];

  for (let i = 0; i < count; i += 1) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const yPct = yStart + t * ySpan;
    const xPct = sCurveCycle[i % sCurveCycle.length];
    positions.push({ xPct, yPct });
  }

  return positions;
}

/** Chiều cao khung lộ trình (px) — khoảng cách thoáng đãng cho nút 3D + giọt nước + sao. */
export function pathPlainStageMinHeightPx(nodeCount, laneWidth = 320) {
  const count = Math.max(1, Number(nodeCount) || 1);
  const w = Math.min(laneWidth, 420);
  const nodeStep = 135;
  const chrome = 120;
  const h = chrome + Math.max(0, count - 1) * nodeStep;
  return Math.round(h * (w / 320));
}

/** Mascot canh theo mốc kế tiếp (bên phải đường zigzag). */
export function pathPlainMascotTopPct(positions, nextIdx = -1) {
  if (!positions?.length) return 40;
  const base = Math.min(Math.max(nextIdx, 0), positions.length - 1);
  const peek = Math.min(base + 1, positions.length - 1);
  const a = positions[base]?.yPct ?? 40;
  const b = positions[peek]?.yPct ?? a;
  return (a + b) / 2;
}

/** Bán kính nút (px) — neo tâm nút, nhãn treo phía dưới. */
export function pathPlainHubHalfPx(buttonSize = 70) {
  return Math.round(buttonSize / 2);
}
