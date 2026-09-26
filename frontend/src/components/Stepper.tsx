import { CheckIcon } from "./icons";

export type StepState = "done" | "current" | "upcoming";

export interface StepItem {
  label: string;
  state: StepState;
  /** id раздела на странице: шаг становится ссылкой-прокруткой. */
  target?: string;
}

export const STEP_LABELS = ["Грунт", "Здание", "Условия", "Результат"] as const;

function scrollToSection(id: string) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.getElementById(id)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}

/** Этапы расчёта: кружки с номерами, соединённые линией прогресса. */
export function Stepper({ steps }: { steps: StepItem[] }) {
  return (
    <nav aria-label="Этапы расчёта" className="stepper">
      <ol className="stepper-list">
        {steps.map((s, i) => {
          const inner = (
            <>
              <span className="step-dot">{s.state === "done" ? <CheckIcon /> : i + 1}</span>
              <span className="step-label">
                {s.label}
                {s.state === "done" && <span className="sr-only">, заполнено</span>}
              </span>
            </>
          );
          const current = s.state === "current" ? "step" : undefined;
          return (
            <li key={s.label} className="stepper-item" data-state={s.state}>
              {i < steps.length - 1 && (
                <span className="step-line" aria-hidden>
                  <span className="step-line-fill" data-on={s.state === "done"} />
                </span>
              )}
              {s.target ? (
                <a
                  href={`#${s.target}`}
                  className="step"
                  aria-current={current}
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToSection(s.target!);
                  }}
                >
                  {inner}
                </a>
              ) : (
                <span className="step" aria-current={current}>
                  {inner}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
