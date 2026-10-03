export type HomePoint = { x: number; y: number };

export type HomeEntranceGeometry = {
  point: HomePoint;
  label: HomePoint;
  connector: string;
  side: "left" | "right";
};

type HomeGeometryOptions = {
  count: number;
  width: number;
  centerY: number;
  maxLabelWidth: number;
  labelWidths: readonly number[];
};

export const HOME_ROW_SPACING_REM = 8.375;
export const MAX_ORBIT_ENTRANCES = 10;

const FULL_TURN = Math.PI * 2;
const TOP_ANGLE = -Math.PI / 2;
const BASE_RADIUS = 110;
const LABEL_SAFE_MARGIN = 18;
const LABEL_OUTWARD_GAP = 72;
const LABEL_CONNECTOR_GAP = 8;
const LABEL_ELBOW_DEPTH = 18;
const SIX_ENTRY_SPREADS = [40, 90, 140] as const;
// The top pair tucks inward to match the compact leader lines in the reference.
const SIX_ENTRY_LABEL_GAPS = [52, 72, 72] as const;
const SIX_ENTRY_LABEL_Y_OFFSETS = [-10, -16, -10] as const;

type OrbitPosition = {
  angle: number;
  side: -1 | 1;
};

function getPairIndex(index: number, count: number): number {
  return count % 2 === 1 ? Math.ceil(index / 2) : Math.floor(index / 2);
}

function getOrbitPosition(index: number, count: number): OrbitPosition {
  const isOddCenter = count % 2 === 1 && index === 0;
  if (isOddCenter) return { angle: TOP_ANGLE, side: -1 };

  const side: -1 | 1 =
    count % 2 === 1 ? (index % 2 === 1 ? -1 : 1) : index % 2 === 0 ? -1 : 1;

  const pairIndex = getPairIndex(index, count);
  const spread =
    count % 2 === 1
      ? (pairIndex * FULL_TURN) / count
      : count === 6
        ? SIX_ENTRY_SPREADS[pairIndex] * (Math.PI / 180)
        : ((pairIndex + 0.5) * FULL_TURN) / count;

  return { angle: TOP_ANGLE + side * spread, side };
}

export function getHomeGeometry({
  count,
  width,
  centerY,
  maxLabelWidth,
  labelWidths,
}: HomeGeometryOptions): HomeEntranceGeometry[] {
  if (count <= 0) return [];

  const radius = BASE_RADIUS + Math.max(0, count - 6) * 8;
  const centerX = width / 2;
  const maxLabelInset = Math.max(
    0,
    centerX - maxLabelWidth - LABEL_SAFE_MARGIN
  );

  return Array.from({ length: count }, (_, index) => {
    const { angle, side } = getOrbitPosition(index, count);
    const pairIndex = getPairIndex(index, count);
    const point = {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    };

    // The label coordinate is its inner edge, so language changes only extend outward.
    const labelGap =
      count === 6 ? SIX_ENTRY_LABEL_GAPS[pairIndex] : LABEL_OUTWARD_GAP;
    const labelYOffset =
      count === 6 ? SIX_ENTRY_LABEL_Y_OFFSETS[pairIndex] : -10;
    const labelInset = Math.min(
      Math.abs(point.x - centerX) + labelGap,
      maxLabelInset
    );
    const label = {
      x: centerX + side * labelInset,
      y: centerY + (point.y - centerY) * 1.2 + labelYOffset,
    };
    const elbowX = label.x - side * (LABEL_CONNECTOR_GAP + LABEL_ELBOW_DEPTH);
    const lineEndX = label.x + side * (labelWidths[index] ?? maxLabelWidth);

    // Continue the leader beneath the label while keeping its inner edge anchored.
    const connector = `M ${point.x} ${point.y} L ${elbowX} ${label.y} L ${lineEndX} ${label.y}`;
    return { point, label, connector, side: side < 0 ? "left" : "right" };
  });
}
