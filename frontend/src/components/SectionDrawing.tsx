import { useId } from "react";
import type { FoundationType, Level, SoilType, WallMaterial } from "../types/foundation";

/**
 * Схематичный геологический разрез площадки: грунт (штриховка по мотивам ГОСТ 21.302),
 * уровень грунтовых вод, здание и, на экране результатов, фундамент.
 * Чертёж условный, без масштаба: он только отражает введённые данные.
 */

const VIEW_W = 480;
const VIEW_H = 330;
const GROUND = 150;
const FLOOR_H = 17;
const MAX_DRAWN_FLOORS = 7;

export const SOIL_FILL: Record<SoilType, string> = {
  sand: "#EAD79A",
  sandy_loam: "#E2C897",
  loam: "#D5B287",
  clay: "#BF9677",
  fill: "#BBBCB2",
};

const WALL_FILL: Record<WallMaterial, string> = {
  wood: "#D9BC8C",
  aerated_concrete: "#E8EAE5",
  brick: "#BF7E64",
  reinforced_concrete: "#C9CDCC",
};

const WATER_Y: Record<Level, number> = { high: 178, medium: 230, low: 292 };
// Несущая способность: чем ниже, тем «рыхлее» штриховка.
const DENSITY: Record<Level, number> = { low: 1.4, medium: 1, high: 0.75 };

const INK = "#1C2B36";
const WATER = "#2E82A6";

export interface SectionProps {
  soil: SoilType | null;
  bearing: Level | null;
  groundwater: Level | null;
  floors: number | null;
  area: number | null;
  wall: WallMaterial | null;
  foundation?: FoundationType;
  compact?: boolean;
  className?: string;
  title?: string;
}

function buildingWidth(area: number | null): number {
  if (!area || area <= 0) return 150;
  const side = Math.min(Math.sqrt(area), 100);
  return Math.round(80 + ((Math.max(side, 5) - 5) / 95) * 220);
}

function spread(count: number, from: number, to: number): number[] {
  if (count <= 1) return [(from + to) / 2];
  return Array.from({ length: count }, (_, i) => from + ((to - from) * i) / (count - 1));
}

function Foundation({ type, x, w, fill }: { type: FoundationType; x: number; w: number; fill: string }) {
  const common = { fill, stroke: INK, strokeWidth: 1.25 };
  const G = GROUND;
  switch (type) {
    case "slab":
      return <rect x={x - 10} y={G - 2} width={w + 20} height={18} {...common} />;
    case "strip": {
      const centers = w > 150 ? [x + 7, x + w / 2, x + w - 7] : [x + 7, x + w - 7];
      return (
        <g>
          {centers.map((c) => (
            <path
              key={c}
              d={`M${c - 7} ${G - 2} h14 v42 h6 v10 h-26 v-10 h6 z`}
              {...common}
            />
          ))}
        </g>
      );
    }
    case "column": {
      const n = Math.max(3, Math.round(w / 45) + 1);
      return (
        <g>
          {spread(n, x + 6, x + w - 6).map((c) => (
            <path key={c} d={`M${c - 5} ${G} h10 v30 h7 v9 h-24 v-9 h7 z`} {...common} />
          ))}
          <rect x={x - 4} y={G - 7} width={w + 8} height={9} {...common} />
        </g>
      );
    }
    case "pile": {
      const n = Math.max(3, Math.round(w / 32) + 1);
      const tip = 306;
      return (
        <g>
          {spread(n, x + 5, x + w - 5).map((c) => (
            <path key={c} d={`M${c - 3.5} ${G + 8} v${tip - G - 14} l3.5 7 l3.5 -7 v${-(tip - G - 14)} z`} {...common} />
          ))}
          <rect x={x - 7} y={G - 4} width={w + 14} height={14} {...common} />
        </g>
      );
    }
  }
}

/** Условные штриховки грунтов; id(soil) даёт ссылку на паттерн. */
export function SoilPatterns({ id, density = 1 }: { id: (name: string) => string; density?: number }) {
  return (
    <>
      <pattern id={id("sand")} width={10} height={10} patternUnits="userSpaceOnUse" patternTransform={`scale(${density})`}>
        <circle cx={2.5} cy={2.5} r={0.95} fill={INK} fillOpacity={0.55} />
        <circle cx={7.5} cy={7.5} r={0.95} fill={INK} fillOpacity={0.55} />
      </pattern>
      <pattern id={id("sandy_loam")} width={12} height={12} patternUnits="userSpaceOnUse" patternTransform={`scale(${density})`}>
        <circle cx={3} cy={9} r={0.9} fill={INK} fillOpacity={0.55} />
        <circle cx={9} cy={3} r={0.9} fill={INK} fillOpacity={0.55} />
        <path d="M0 12L12 0" stroke={INK} strokeOpacity={0.4} strokeWidth={0.8} />
      </pattern>
      <pattern id={id("loam")} width={10} height={10} patternUnits="userSpaceOnUse" patternTransform={`rotate(-45) scale(${density})`}>
        <line x1={0} y1={2.5} x2={10} y2={2.5} stroke={INK} strokeOpacity={0.45} strokeWidth={0.8} />
        <line x1={0} y1={7.5} x2={10} y2={7.5} stroke={INK} strokeOpacity={0.45} strokeWidth={0.8} strokeDasharray="3 2" />
      </pattern>
      <pattern id={id("clay")} width={5} height={5} patternUnits="userSpaceOnUse" patternTransform={`rotate(-45) scale(${density})`}>
        <line x1={0} y1={2.5} x2={5} y2={2.5} stroke={INK} strokeOpacity={0.5} strokeWidth={0.8} />
      </pattern>
      <pattern id={id("fill")} width={12} height={12} patternUnits="userSpaceOnUse" patternTransform={`rotate(30) scale(${density})`}>
        <path d="M0 6H12M6 0V12" stroke={INK} strokeOpacity={0.4} strokeWidth={0.8} strokeDasharray="4 2" />
        <rect x={1.5} y={1.5} width={2} height={2} fill={INK} fillOpacity={0.35} />
      </pattern>
    </>
  );
}

function DimTick({ x, y }: { x: number; y: number }) {
  return <line x1={x - 3.5} y1={y + 3.5} x2={x + 3.5} y2={y - 3.5} stroke={INK} strokeWidth={1.1} />;
}

export function SectionDrawing({
  soil,
  bearing,
  groundwater,
  floors,
  area,
  wall,
  foundation,
  compact = false,
  className,
  title,
}: SectionProps) {
  const uid = useId().replace(/:/g, "");
  const id = (name: string) => `${uid}-${name}`;

  const w = buildingWidth(area);
  const x = Math.round((VIEW_W - w) / 2);
  const hasFloors = floors !== null && floors >= 1;
  const broken = hasFloors && floors > MAX_DRAWN_FLOORS;
  const drawnFloors = hasFloors ? (broken ? MAX_DRAWN_FLOORS - 1 : floors) : 2;
  const breakGap = broken ? 12 : 0;
  const top = GROUND - drawnFloors * FLOOR_H - breakGap;
  const outlineOnly = !wall || !hasFloors;
  const density = bearing ? DENSITY[bearing] : 1;
  const waterY = groundwater ? WATER_Y[groundwater] : null;

  const windows: { wx: number; wy: number }[] = [];
  if (hasFloors) {
    const cols = Math.max(1, Math.floor((w - 12) / 22));
    const step = (w - 12) / cols;
    for (let f = 0; f < drawnFloors; f++) {
      const fy = GROUND - (f + 1) * FLOOR_H - (broken && f >= 3 ? breakGap : 0);
      for (let c = 0; c < cols; c++) windows.push({ wx: x + 6 + step * c + step / 2 - 4, wy: fy + 5 });
    }
  }
  const breakY = GROUND - 3 * FLOOR_H - breakGap / 2;

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      className={className}
      role="img"
      aria-label={title ?? "Схема разреза площадки"}
      fontFamily="Geologica, sans-serif"
    >
      <defs>
        <pattern id={id("grid")} width={10} height={10} patternUnits="userSpaceOnUse">
          <path d="M10 0H0V10" fill="none" stroke={INK} strokeOpacity={0.06} strokeWidth={0.6} />
        </pattern>
        <pattern id={id("grid5")} width={50} height={50} patternUnits="userSpaceOnUse">
          <path d="M50 0H0V50" fill="none" stroke={INK} strokeOpacity={0.1} strokeWidth={0.7} />
        </pattern>

        <SoilPatterns id={id} density={density} />

        {/* Стены и бетон */}
        <pattern id={id("wood")} width={6} height={6} patternUnits="userSpaceOnUse">
          <line x1={0} y1={5.5} x2={6} y2={5.5} stroke="#7C5B36" strokeOpacity={0.55} strokeWidth={0.8} />
        </pattern>
        <pattern id={id("aerated_concrete")} width={16} height={16} patternUnits="userSpaceOnUse">
          <path d="M0 0.5H16M0 8.5H16M0.5 0V8M8.5 8V16" stroke={INK} strokeOpacity={0.25} strokeWidth={0.7} />
        </pattern>
        <pattern id={id("brick")} width={10} height={10} patternUnits="userSpaceOnUse">
          <path d="M0 0.5H10M0 5.5H10M0.5 0V5M5.5 5V10" stroke="#F4E8DF" strokeOpacity={0.75} strokeWidth={0.7} />
        </pattern>
        <pattern id={id("concrete")} width={14} height={14} patternUnits="userSpaceOnUse">
          <path d="M3 5l2.5-3.5L7 5z" fill="none" stroke={INK} strokeOpacity={0.5} strokeWidth={0.6} />
          <circle cx={10.5} cy={10} r={0.8} fill={INK} fillOpacity={0.5} />
          <circle cx={4} cy={11.5} r={0.6} fill={INK} fillOpacity={0.45} />
        </pattern>
        <clipPath id={id("soilclip")}>
          <rect x={0} y={GROUND} width={VIEW_W} height={VIEW_H - GROUND} />
        </clipPath>
      </defs>

      {/* Миллиметровка над землёй */}
      <rect x={0} y={0} width={VIEW_W} height={GROUND} fill={`url(#${id("grid")})`} />
      <rect x={0} y={0} width={VIEW_W} height={GROUND} fill={`url(#${id("grid5")})`} />

      {/* Грунт */}
      <g clipPath={`url(#${id("soilclip")})`}>
        <rect x={0} y={GROUND} width={VIEW_W} height={VIEW_H - GROUND} fill={soil ? SOIL_FILL[soil] : "#E2E6E3"} />
        {soil && <rect x={0} y={GROUND} width={VIEW_W} height={VIEW_H - GROUND} fill={`url(#${id(soil)})`} />}
        {waterY !== null && (
          <rect x={0} y={waterY} width={VIEW_W} height={VIEW_H - waterY} fill="#4FA6CC" fillOpacity={0.13} />
        )}
      </g>

      {/* Фундамент рисуется до здания, чтобы стены перекрыли стык */}
      {foundation && (
        <g aria-hidden>
          <Foundation type={foundation} x={x} w={w} fill="#D3D7D5" />
          <Foundation type={foundation} x={x} w={w} fill={`url(#${id("concrete")})`} />
        </g>
      )}

      {/* УГВ */}
      {waterY !== null && (
        <g>
          <line x1={0} y1={waterY} x2={VIEW_W} y2={waterY} stroke={WATER} strokeWidth={1.3} strokeDasharray="10 4" />
          <g transform={`translate(${compact ? 30 : 44} ${waterY})`}>
            <path d="M-7 -12H7L0 0Z" fill="#FAFBFA" stroke={WATER} strokeWidth={1.3} />
            <line x1={-5} y1={4} x2={5} y2={4} stroke={WATER} strokeWidth={1.2} />
            <line x1={-2.5} y1={7.5} x2={2.5} y2={7.5} stroke={WATER} strokeWidth={1.2} />
            {!compact && (
              <text x={12} y={-4} className="drawing-label" fill={WATER} fontSize={12}>
                УГВ
              </text>
            )}
          </g>
        </g>
      )}

      {/* Здание */}
      <g>
        <rect
          x={x}
          y={top}
          width={w}
          height={GROUND - top}
          fill={outlineOnly || !wall ? "none" : WALL_FILL[wall]}
          stroke={INK}
          strokeOpacity={outlineOnly ? 0.45 : 1}
          strokeWidth={1.5}
          strokeDasharray={outlineOnly ? "5 4" : undefined}
        />
        {!outlineOnly && wall && <rect x={x} y={top} width={w} height={GROUND - top} fill={`url(#${id(wall)})`} />}
        {!outlineOnly && (
          <rect x={x} y={top} width={w} height={GROUND - top} fill="none" stroke={INK} strokeWidth={1.5} />
        )}
        {windows.map(({ wx, wy }) => (
          <rect
            key={`${wx}-${wy}`}
            x={wx}
            y={wy}
            width={8}
            height={8}
            fill="#FAFBFA"
            stroke={INK}
            strokeOpacity={outlineOnly ? 0.4 : 0.8}
            strokeWidth={0.75}
          />
        ))}
        <line x1={x - 4} y1={top} x2={x + w + 4} y2={top} stroke={INK} strokeWidth={2} strokeOpacity={outlineOnly ? 0.45 : 1} />
        {broken && (
          <g>
            <rect x={x - 8} y={breakY - 5} width={w + 16} height={10} fill="#FAFBFA" />
            {[-5, 5].map((dy) => (
              <polyline
                key={dy}
                fill="none"
                stroke={INK}
                strokeWidth={1}
                points={`${x - 8},${breakY + dy} ${x + w / 2 - 6},${breakY + dy} ${x + w / 2 - 2},${breakY + dy - 5} ${x + w / 2 + 2},${breakY + dy + 5} ${x + w / 2 + 6},${breakY + dy} ${x + w + 8},${breakY + dy}`}
              />
            ))}
          </g>
        )}
      </g>

      {/* Поверхность земли */}
      <line x1={0} y1={GROUND} x2={VIEW_W} y2={GROUND} stroke={INK} strokeWidth={1.75} />

      {!compact && (
        <g className="drawing-label" fill={INK} fontSize={12}>
          <text x={10} y={GROUND - 6}>±0,000</text>
          {hasFloors && (
            <g>
              <line x1={x + w + 22} y1={top} x2={x + w + 22} y2={GROUND} stroke={INK} strokeWidth={0.8} />
              <line x1={x + w + 6} y1={top} x2={x + w + 28} y2={top} stroke={INK} strokeWidth={0.6} />
              <DimTick x={x + w + 22} y={top} />
              <DimTick x={x + w + 22} y={GROUND} />
              <text x={x + w + 30} y={(top + GROUND) / 2 + 4}>
                {floors} эт.
              </text>
            </g>
          )}
          {area !== null && area > 0 && (
            <g>
              <line x1={x} y1={top - 16} x2={x + w} y2={top - 16} stroke={INK} strokeWidth={0.8} />
              <line x1={x} y1={top - 22} x2={x} y2={top - 2} stroke={INK} strokeWidth={0.6} />
              <line x1={x + w} y1={top - 22} x2={x + w} y2={top - 2} stroke={INK} strokeWidth={0.6} />
              <DimTick x={x} y={top - 16} />
              <DimTick x={x + w} y={top - 16} />
              <text x={x + w / 2} y={top - 21} textAnchor="middle">
                {area.toLocaleString("ru-RU")} м²
              </text>
            </g>
          )}
        </g>
      )}
    </svg>
  );
}
