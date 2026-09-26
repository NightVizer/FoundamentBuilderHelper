import { useId, type ReactNode } from "react";
import type { Option } from "../options";

interface ChoiceGroupProps<T extends string> {
  label: string;
  name: string;
  options: Option<T>[];
  value: T | null;
  onChange: (value: T) => void;
  disabled?: boolean;
  /** Необязательная иконка слева от подписи варианта. */
  renderIcon?: (value: T) => ReactNode;
  /** Подпись слева от вариантов, а не над ними. */
  inline?: boolean;
}

/** Выбор одного значения: семантически радиогруппа, визуально кнопки-чипы. */
export function ChoiceGroup<T extends string>({
  label,
  name,
  options,
  value,
  onChange,
  disabled,
  renderIcon,
  inline,
}: ChoiceGroupProps<T>) {
  const labelId = useId();
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelId}
      className={inline ? "grid items-center gap-x-6 gap-y-2.5 sm:grid-cols-[8.5rem_minmax(0,1fr)]" : undefined}
    >
      <div id={labelId} className={inline ? "field-label mb-0" : "field-label"}>
        {label}
      </div>
      <div className="flex flex-wrap gap-2.5">
        {options.map((o) => (
          <label key={o.value} className="relative block">
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              disabled={disabled}
              onChange={() => onChange(o.value)}
              className="peer sr-only"
            />
            <span className="choice">
              {renderIcon?.(o.value)}
              <span>{o.label}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

const CARD_COLUMNS = {
  3: "grid-cols-1 sm:grid-cols-3",
  4: "grid-cols-2 lg:grid-cols-4",
  5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
} as const;

interface CardGroupProps<T extends string> {
  label: string;
  name: string;
  options: Option<T>[];
  value: T | null;
  onChange: (value: T) => void;
  renderIcon: (value: T) => ReactNode;
  /** Вторая строка под названием варианта, общая для всех карточек. */
  sub?: string;
  columns: keyof typeof CARD_COLUMNS;
}

/** Радиогруппа из карточек с миниатюрой: для вариантов, которые проще узнать по картинке. */
export function CardGroup<T extends string>({
  label,
  name,
  options,
  value,
  onChange,
  renderIcon,
  sub,
  columns,
}: CardGroupProps<T>) {
  const labelId = useId();
  return (
    <div role="radiogroup" aria-labelledby={labelId}>
      <div id={labelId} className="field-label">
        {label}
      </div>
      <div className={`grid gap-3 ${CARD_COLUMNS[columns]}`}>
        {options.map((o) => (
          <label key={o.value} className="opt-wrap relative block">
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="peer sr-only"
            />
            <span className="opt-card">
              <span className="opt-icon">{renderIcon(o.value)}</span>
              <span className="min-w-0">
                <span className="opt-title">{o.label}</span>
                {sub && <span className="opt-sub">{sub}</span>}
              </span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

interface CountFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint: string;
  min: number;
  max: number;
}

/** Целое число с кнопками − и +, поле можно заполнить и вручную. */
export function CountField({ label, value, onChange, hint, min, max }: CountFieldProps) {
  const id = useId();
  const n = Number.parseInt(value, 10);
  const step = (delta: number) => {
    const next = Number.isNaN(n) ? min : Math.min(max, Math.max(min, n + delta));
    onChange(String(next));
  };
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <div className="count-input">
        <button type="button" onClick={() => step(-1)} disabled={!Number.isNaN(n) && n <= min} aria-label="Уменьшить">
          <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" aria-hidden>
            <path d="M3 7h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={1}
          value={value}
          placeholder="0"
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={`${id}-hint`}
        />
        <button type="button" onClick={() => step(1)} disabled={!Number.isNaN(n) && n >= max} aria-label="Увеличить">
          <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" aria-hidden>
            <path d="M3 7h8M7 3v8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <p id={`${id}-hint`} className="field-hint">
        {hint}
      </p>
    </div>
  );
}

interface NumberFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  suffix?: string;
  hint: string;
  integer?: boolean;
  min: number;
  max: number;
  placeholder?: string;
  disabled?: boolean;
}

export function NumberField({
  label,
  value,
  onChange,
  suffix,
  hint,
  integer,
  min,
  max,
  placeholder,
  disabled,
}: NumberFieldProps) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <div className="number-input">
        <input
          id={id}
          type="number"
          inputMode={integer ? "numeric" : "decimal"}
          min={min}
          max={max}
          step={integer ? 1 : "any"}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={`${id}-hint`}
        />
        {suffix && <span className="suffix">{suffix}</span>}
      </div>
      <p id={`${id}-hint`} className="field-hint">
        {hint}
      </p>
    </div>
  );
}

export function Spinner({ className = "h-5 w-5", label }: { className?: string; label?: string }) {
  return (
    <svg
      className={`spinner ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2.5" />
      <path d="M21.5 12a9.5 9.5 0 0 0-9.5-9.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

const RING_R = 40;
const RING_C = 2 * Math.PI * RING_R;

/** Кольцо пригодности: одинаковый размер у победителя и альтернатив. */
export function ScoreRing({ score, primary }: { score: number; primary?: boolean }) {
  const clamped = Math.max(0, Math.min(100, score));
  return (
    <div className="score-ring" role="img" aria-label={`Пригодность ${clamped}%`}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={RING_R} fill="none" stroke="var(--rule)" strokeWidth="6" />
        <circle
          cx="50"
          cy="50"
          r={RING_R}
          fill="none"
          stroke={primary ? "var(--coral)" : "var(--ink)"}
          strokeWidth="6"
          strokeLinecap="butt"
          strokeDasharray={RING_C}
          strokeDashoffset={RING_C * (1 - clamped / 100)}
          className="ring-arc"
          style={{ ["--ring-c" as string]: RING_C }}
        />
      </svg>
      <span className="score-value" aria-hidden>
        {clamped}%
      </span>
    </div>
  );
}
