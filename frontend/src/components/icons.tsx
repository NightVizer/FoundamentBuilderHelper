import type { ReactNode } from "react";
import type { FoundationType, Level, Seismicity, SoilType, WallMaterial } from "../types/foundation";

// Миниатюры для карточек выбора. Основные линии рисуются currentColor (ink),
// акцентные детали берут var(--acc) и var(--acc-soft): карточка перекрашивает их
// в коралловый при наведении и выборе.

const ACC = "var(--acc)";
const ACC_SOFT = "var(--acc-soft)";

function range(from: number, to: number, step: number): number[] {
  const out: number[] = [];
  for (let v = from; v <= to; v += step) out.push(v);
  return out;
}

/* Грунт: образец в квадратной рамке, штриховка по типу грунта */

function SoilPattern({ soil }: { soil: SoilType }) {
  switch (soil) {
    case "sand":
      return (
        <g fill={ACC}>
          {[8, 15, 22, 29, 35].flatMap((y, row) =>
            (row % 2 ? [12, 20, 28] : [8, 16, 24, 32]).map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.3" />),
          )}
        </g>
      );
    case "sandy_loam":
      return (
        <g stroke={ACC} fill={ACC} strokeWidth="1.5" strokeLinecap="round">
          {[8, 22, 35].flatMap((y) => [8, 16, 24, 32].map((x) => <circle key={`d${x}-${y}`} cx={x} cy={y} r="1.2" stroke="none" />))}
          {[15, 29].flatMap((y) => [6, 18, 30].map((x) => <line key={`l${x}-${y}`} x1={x} y1={y} x2={x + 5} y2={y} />))}
        </g>
      );
    case "loam":
      return (
        <g stroke={ACC} strokeWidth="1.5" strokeLinecap="round">
          {[8, 14, 20, 26, 32].flatMap((y, row) =>
            (row % 2 ? [10, 20, 30] : [5, 15, 25]).map((x) => <line key={`${x}-${y}`} x1={x} y1={y} x2={x + 5} y2={y} />),
          )}
        </g>
      );
    case "clay":
      return (
        <g stroke={ACC} strokeWidth="1.4">
          {[8, 13, 18, 23, 28, 33].map((y) => (
            <line key={y} x1="5" y1={y} x2="35" y2={y} />
          ))}
        </g>
      );
    case "fill":
      return (
        <g stroke={ACC} strokeWidth="1.3" strokeLinejoin="round" fill={ACC_SOFT}>
          <polygon points="6,10 12,6 16,12 10,16" />
          <polygon points="20,6 28,8 26,14 19,12" />
          <polygon points="28,18 35,20 33,26 27,24" />
          <polygon points="7,22 14,20 16,28 9,30" />
          <polygon points="18,25 25,23 27,32 20,34" />
          <circle cx="31" cy="32" r="1.3" fill={ACC} stroke="none" />
          <circle cx="19" cy="18" r="1.3" fill={ACC} stroke="none" />
        </g>
      );
  }
}

export function SoilIcon({ soil }: { soil: SoilType }) {
  return (
    <svg viewBox="0 0 40 40" className="h-10 w-10" aria-hidden>
      <rect x="1" y="1" width="38" height="38" rx="2" fill="#fff" stroke="currentColor" strokeWidth="1.5" />
      <SoilPattern soil={soil} />
    </svg>
  );
}

/* Несущая способность: нагрузка на поверхности, ниже грунт разной плотности */

export function BearingIcon({ level }: { level: Level }) {
  return (
    <svg viewBox="0 0 48 40" className="h-10 w-12" aria-hidden>
      <rect x="17" y="2" width="14" height="8" fill="currentColor" />
      <line x1="3" y1="11" x2="45" y2="11" stroke="currentColor" strokeWidth="1.5" />
      {level === "low" && (
        <g fill={ACC}>
          {[18, 26, 34].flatMap((y, row) =>
            (row % 2 ? [13, 25, 37] : [7, 19, 31, 43]).map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.3" />),
          )}
        </g>
      )}
      {level === "medium" && (
        <g stroke={ACC} strokeWidth="1.5" strokeDasharray="4 3">
          {[18, 25, 32].map((y) => (
            <line key={y} x1="4" y1={y} x2="44" y2={y} />
          ))}
        </g>
      )}
      {level === "high" && (
        <g stroke={ACC} strokeWidth="1.5">
          {[16, 21, 26, 31, 36].map((y) => (
            <line key={y} x1="4" y1={y} x2="44" y2={y} />
          ))}
        </g>
      )}
    </svg>
  );
}

/* Грунтовые воды: волна на глубине, над ней знак уровня воды ▽ */

const WATER_Y: Record<Level, number> = { low: 32, medium: 23, high: 15 };

export function WaterIcon({ level }: { level: Level }) {
  const y = WATER_Y[level];
  const wave = `M4 ${y} q5 -3 10 0 t10 0 t10 0 t10 0`;
  return (
    <svg viewBox="0 0 48 40" className="h-10 w-12" aria-hidden>
      <line x1="3" y1="8" x2="45" y2="8" stroke="currentColor" strokeWidth="1.5" />
      <g fill="currentColor" fillOpacity="0.35">
        {range(13, y - 4, 6).flatMap((dy, row) =>
          (row % 2 ? [10, 22, 34] : [6, 18, 30, 42]).map((x) => <circle key={`${x}-${dy}`} cx={x} cy={dy} r="1.1" />),
        )}
      </g>
      <path d={`${wave} L44 38 L4 38 Z`} fill={ACC_SOFT} />
      <path d={wave} fill="none" stroke={ACC} strokeWidth="1.6" strokeLinecap="round" />
      <polygon points={`36,${y - 8} 42,${y - 8} 39,${y - 3}`} fill="#fff" stroke={ACC} strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

/* Материал стен */

function Block({ children }: { children?: ReactNode }) {
  return (
    <g stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
      <polygon points="5,14 13,7 42,7 34,14" fill="#fff" />
      <polygon points="34,14 42,7 42,27 34,34" fill={ACC_SOFT} />
      <rect x="5" y="14" width="29" height="20" fill="#fff" />
      {children}
    </g>
  );
}

export function WallIcon({ wall }: { wall: WallMaterial }) {
  return (
    <svg viewBox="0 0 48 40" className="h-10 w-12" aria-hidden>
      {wall === "wood" &&
        [6, 16, 26].map((y) => (
          <g key={y} stroke="currentColor" strokeWidth="1.4">
            <rect x="10" y={y} width="34" height="8" rx="4" fill="#fff" />
            <circle cx="10" cy={y + 4} r="4" fill={ACC_SOFT} />
            <circle cx="10" cy={y + 4} r="1.6" fill="none" stroke={ACC} />
          </g>
        ))}
      {wall === "aerated_concrete" && (
        <Block>
          <g fill="none" stroke={ACC} strokeWidth="1.2">
            {[
              [11, 20],
              [19, 25],
              [27, 19],
              [13, 29],
              [26, 29],
              [20, 18],
            ].map(([cx, cy]) => (
              <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.3" />
            ))}
          </g>
        </Block>
      )}
      {wall === "brick" && (
        <g stroke="currentColor" strokeWidth="1.3">
          {[4, 12, 20, 28].flatMap((y, row) =>
            (row % 2 ? [[4, 7], [11, 14], [25, 14], [39, 5]] : [[4, 14], [18, 14], [32, 12]]).map(([x, w], i) => (
              <rect
                key={`${x}-${y}`}
                x={x}
                y={y}
                width={w}
                height="8"
                fill={(row + i) % 3 === 1 ? ACC_SOFT : "#fff"}
              />
            )),
          )}
        </g>
      )}
      {wall === "reinforced_concrete" && (
        <Block>
          <g stroke={ACC} strokeWidth="1" strokeDasharray="2 2">
            <line x1="8" y1="20" x2="31" y2="20" />
            <line x1="8" y1="28" x2="31" y2="28" />
          </g>
          <g fill={ACC} stroke="none">
            {[11, 19.5, 28].flatMap((x) => [20, 28].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.8" />))}
          </g>
        </Block>
      )}
    </svg>
  );
}

/* Сейсмичность: сейсмограмма растущей амплитуды */

const SEISMIC_PATH: Record<Seismicity, string> = {
  "0-6": "M1 8 H9 L11 6 L13 10 L15 7 L17 9 L19 8 H27",
  "7": "M1 8 H6 L8 4 L11 12 L14 3 L17 13 L20 6 L22 8 H27",
  "8+": "M1 8 H4 L6 3 L9 14 L12 1 L15 15 L18 2 L21 13 L23 8 H27",
};

export function SeismicIcon({ level }: { level: Seismicity }) {
  return (
    <svg viewBox="0 0 28 16" className="h-4 w-7 shrink-0" aria-hidden>
      <path d={SEISMIC_PATH[level]} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function CheckIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 14 14" className={className} aria-hidden>
      <path d="M3 7.5 L6 10.5 L11.5 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* Фундаменты: изометрия из параллелепипедов */

type Box = { b: [x: number, y: number, z: number, w: number, d: number, h: number]; acc?: boolean };

const COS30 = Math.cos(Math.PI / 6);
const project = (x: number, y: number, z: number): [number, number] => [(x - y) * COS30, (x + y) * 0.5 - z];

function faces([x, y, z, w, d, h]: Box["b"]) {
  const top = [project(x, y, z + h), project(x + w, y, z + h), project(x + w, y + d, z + h), project(x, y + d, z + h)];
  const left = [project(x, y + d, z), project(x + w, y + d, z), project(x + w, y + d, z + h), project(x, y + d, z + h)];
  const right = [project(x + w, y, z), project(x + w, y + d, z), project(x + w, y + d, z + h), project(x + w, y, z + h)];
  return { top, left, right };
}

const pts = (p: [number, number][]) => p.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(" ");

const grid = (coords: number[]) => coords.flatMap((y) => coords.map((x) => [x, y] as const));

// Порядок коробок = порядок отрисовки (сзади вперёд).
const FOUNDATION_BOXES: Record<FoundationType, Box[]> = {
  slab: [{ b: [0, 0, 0, 64, 64, 9], acc: true }],
  pile: [
    ...grid([4, 29.5, 55])
      .sort((a, b) => a[0] + a[1] - (b[0] + b[1]))
      .map(([x, y]): Box => ({ b: [x, y, 0, 5, 5, 28], acc: true })),
    { b: [0, 0, 28, 64, 64, 7] },
  ],
  strip: [
    { b: [0, 0, 0, 64, 9, 15], acc: true },
    { b: [0, 9, 0, 9, 46, 15], acc: true },
    { b: [55, 9, 0, 9, 46, 15], acc: true },
    { b: [0, 55, 0, 64, 9, 15], acc: true },
  ],
  column: [
    [0, 0],
    [44, 0],
    [0, 44],
    [44, 44],
  ].flatMap(([x, y]): Box[] => [
    { b: [x, y, 0, 20, 20, 5] },
    { b: [x + 6, y + 6, 5, 8, 8, 20], acc: true },
  ]),
};

export function FoundationIllustration({ type, className = "" }: { type: FoundationType; className?: string }) {
  const boxes = FOUNDATION_BOXES[type].map((box) => ({ ...box, f: faces(box.b) }));
  const all = boxes.flatMap(({ f }) => [...f.top, ...f.left, ...f.right]);
  const xs = all.map((p) => p[0]);
  const ys = all.map((p) => p[1]);
  const pad = 3;
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  const viewBox = `${minX} ${minY} ${Math.max(...xs) + pad - minX} ${Math.max(...ys) + pad - minY}`;
  return (
    <svg viewBox={viewBox} className={`iso ${className}`} aria-hidden>
      {boxes.map(({ f, acc }, i) => (
        <g key={i} className={acc ? "iso-acc" : undefined}>
          <polygon points={pts(f.left)} className="iso-l" />
          <polygon points={pts(f.right)} className="iso-r" />
          <polygon points={pts(f.top)} className="iso-t" />
        </g>
      ))}
    </svg>
  );
}
