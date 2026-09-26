import { Fragment, type ReactNode } from "react";

/** Лист на сером фоне: шапка с логотипом и слотом справа. */
export function Shell({ aside, children }: { aside?: ReactNode; children: ReactNode }) {
  return (
    <div className="backdrop">
      <div className="backdrop-dots" aria-hidden />
      <div className="backdrop-quarter shell-quarter" aria-hidden />
      <div className="sheet">
        <header className="topbar">
          <span className="flex items-center gap-2.5 text-[1.0625rem] font-semibold">
            <Logo />
            Фундамент
          </span>
          {aside}
        </header>
        {children}
      </div>
    </div>
  );
}

export function Logo({ className = "h-6 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 24" className={className} aria-hidden>
      <rect x="0" y="0" width="12" height="24" fill="var(--ink)" />
      <rect x="12" y="12" width="8" height="12" fill="var(--coral)" />
    </svg>
  );
}

/** Заголовок первого экрана: слова поднимаются по очереди, точка падает последней. */
function HeroTitle({ text }: { text: string }) {
  const words = text.split(" ");
  return (
    <h1 className="hero-title">
      {words.map((word, i) => (
        <Fragment key={i}>
          {i > 0 && " "}
          <span className="hero-word">
            <span style={{ ["--i" as string]: i }}>
              {word}
              {i === words.length - 1 && <span className="hero-dot text-coral">.</span>}
            </span>
          </span>
        </Fragment>
      ))}
    </h1>
  );
}

/** Большой заголовок с бледным словом на фоне и иллюстрацией справа. */
export function Hero({ ghost, title, art, children }: { ghost: string; title: string; art?: ReactNode; children?: ReactNode }) {
  return (
    <section className="hero">
      <span className="hero-ghost" aria-hidden>
        {ghost}
      </span>
      <div className="relative flex flex-wrap items-end gap-x-10 gap-y-5">
        <HeroTitle text={title} />
        {children && <div className="hero-lede mono max-w-[17rem] pb-2">{children}</div>}
      </div>
      {art ?? <Geometry />}
    </section>
  );
}

function Geometry() {
  return (
    <svg viewBox="0 0 260 300" className="hero-art geo" aria-hidden>
      <defs>
        <pattern id="halftone" width="9" height="9" patternUnits="userSpaceOnUse">
          <circle cx="4.5" cy="4.5" r="1.6" fill="var(--ink)" />
        </pattern>
      </defs>
      <path className="geo-top" d="M130 88 A70 70 0 0 1 260 88 Z" fill="var(--ink)" />
      <circle className="geo-dots" cx="150" cy="168" r="78" fill="url(#halftone)" />
      <circle className="geo-ball" cx="72" cy="150" r="44" fill="var(--coral)" />
      <path className="geo-bottom" d="M140 222 A60 60 0 0 0 260 222 Z" fill="var(--ink)" />
      {[46, 32, 18].map((r, i) => (
        <path
          key={r}
          className="geo-arc"
          style={{ ["--i" as string]: i }}
          d={`M${200 - r} 222 A${r} ${r} 0 0 0 ${200 + r} 222`}
          pathLength={1}
          fill="none"
          stroke="#fff"
          strokeWidth="2"
        />
      ))}
    </svg>
  );
}

// Сваи стоят над ростверком; в цикле по очереди слева направо уходят в него и выходят обратно.
const PILE_X = [62, 130, 198];
const BLOCK_TOP = 180;
const BLOCK_H = 42;

/** Иллюстрация первого экрана ввода: ростверк на грунте и три сваи, которые по очереди входят в него. */
export function PileDriver() {
  return (
    <svg viewBox="0 0 260 300" className="hero-piles" aria-hidden>
      <defs>
        <pattern id="pile-halftone" width="9" height="9" patternUnits="userSpaceOnUse">
          <circle cx="4.5" cy="4.5" r="1.6" fill="var(--ink)" />
        </pattern>
        <linearGradient id="pile-soil-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id="pile-soil-mask">
          <rect x="0" y={BLOCK_TOP + BLOCK_H} width="260" height="78" fill="url(#pile-soil-fade)" />
        </mask>
        <clipPath id="pile-block-clip">
          <rect x="14" y={BLOCK_TOP} width="232" height={BLOCK_H} />
        </clipPath>
      </defs>

      <circle cx="196" cy="70" r="52" fill="url(#pile-halftone)" opacity="0.45" />

      {/* Свая квадратного сечения: лицевая грань, затенённая боковая и пирамидальное остриё */}
      {PILE_X.map((x, i) => (
        <g key={x} className="pile" style={{ ["--i" as string]: i }}>
          <rect x={x - 14} y="30" width="20" height="120" fill="var(--coral)" />
          <rect x={x + 6} y="30" width="8" height="120" fill="var(--coral-strong)" />
          <polygon points={`${x - 14},150 ${x + 6},150 ${x + 2},170`} fill="var(--coral)" />
          <polygon points={`${x + 6},150 ${x + 14},150 ${x + 2},170`} fill="var(--coral-strong)" />
        </g>
      ))}

      <g className="pile-base">
        <rect x="0" y={BLOCK_TOP + BLOCK_H} width="260" height="78" fill="url(#pile-halftone)" mask="url(#pile-soil-mask)" />
        <rect x="14" y={BLOCK_TOP} width="232" height={BLOCK_H} fill="var(--ink)" />
        <g clipPath="url(#pile-block-clip)" fill="none" stroke="#fff" strokeWidth="2">
          {PILE_X.map((x, i) => (
            <g key={x} className="pile-ripple" style={{ ["--i" as string]: i }}>
              {[12, 24].map((r) => (
                <path key={r} d={`M${x - r} ${BLOCK_TOP} A${r} ${r} 0 0 0 ${x + r} ${BLOCK_TOP}`} />
              ))}
            </g>
          ))}
        </g>
        {/* Метки гнёзд под сваи на верхней грани ростверка */}
        <g stroke="#fff" strokeWidth="2">
          {PILE_X.map((x) => (
            <line key={x} x1={x - 17} y1={BLOCK_TOP + 1} x2={x + 17} y2={BLOCK_TOP + 1} />
          ))}
        </g>
      </g>
    </svg>
  );
}

/** Заголовок раздела с цветным двоеточием, как «My Story:» в референсе. */
export function SectionHeading({ children, id }: { children: string; id?: string }) {
  return (
    <h2 id={id} className="section-heading">
      {children}
      <span className="text-coral">:</span>
    </h2>
  );
}
