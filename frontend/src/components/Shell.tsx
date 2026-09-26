import type { ReactNode } from "react";

/** Лист на сером фоне: шапка с логотипом, слот справа, под шапкой этапы расчёта. */
export function Shell({ aside, stepper, children }: { aside?: ReactNode; stepper?: ReactNode; children: ReactNode }) {
  return (
    <div className="backdrop">
      <div className="backdrop-dots" aria-hidden />
      <div className="backdrop-quarter" aria-hidden />
      <div className="sheet">
        <header className="topbar">
          <span className="flex items-center gap-2.5 text-[1.0625rem] font-semibold">
            <Logo />
            Фундамент
          </span>
          {aside}
        </header>
        {stepper}
        {children}
      </div>
    </div>
  );
}

function Logo() {
  return (
    <svg viewBox="0 0 20 24" className="h-6 w-5" aria-hidden>
      <rect x="0" y="0" width="12" height="24" fill="var(--ink)" />
      <rect x="12" y="12" width="8" height="12" fill="var(--coral)" />
    </svg>
  );
}

/** Большой заголовок с бледным словом на фоне и геометрией справа. */
export function Hero({ ghost, title, children }: { ghost: string; title: string; children?: ReactNode }) {
  return (
    <section className="hero">
      <span className="hero-ghost" aria-hidden>
        {ghost}
      </span>
      <div className="relative flex flex-wrap items-end gap-x-10 gap-y-5">
        <h1 className="hero-title">
          {title}
          <span className="text-coral">.</span>
        </h1>
        {children && <div className="mono max-w-[17rem] pb-2">{children}</div>}
      </div>
      <Geometry />
    </section>
  );
}

function Geometry() {
  return (
    <svg viewBox="0 0 260 300" className="hero-art" aria-hidden>
      <defs>
        <pattern id="halftone" width="9" height="9" patternUnits="userSpaceOnUse">
          <circle cx="4.5" cy="4.5" r="1.6" fill="var(--ink)" />
        </pattern>
      </defs>
      <path d="M130 88 A70 70 0 0 1 260 88 Z" fill="var(--ink)" />
      <circle cx="150" cy="168" r="78" fill="url(#halftone)" />
      <circle cx="72" cy="150" r="44" fill="var(--coral)" />
      <path d="M140 222 A60 60 0 0 0 260 222 Z" fill="var(--ink)" />
      {[46, 32, 18].map((r) => (
        <path key={r} d={`M${200 - r} 222 A${r} ${r} 0 0 0 ${200 + r} 222`} fill="none" stroke="#fff" strokeWidth="2" />
      ))}
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
