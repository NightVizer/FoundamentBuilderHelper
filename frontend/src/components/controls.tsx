import { useId, type ReactNode } from "react";
import type { Option } from "../options";

interface ChoiceGroupProps<T extends string> {
  label: string;
  name: string;
  options: Option<T>[];
  value: T | null;
  onChange: (value: T) => void;
  disabled?: boolean;
  /** Необязательная миниатюра слева от подписи варианта. */
  renderSwatch?: (value: T) => ReactNode;
  /** "wrap": ширина по содержимому, для длинных подписей. */
  columns?: 3 | "wrap";
}

const LAYOUT = {
  3: "grid max-w-[30rem] grid-cols-3",
  wrap: "flex flex-wrap",
} as const;

/** Выбор одного значения: семантически радиогруппа, визуально сегменты. */
export function ChoiceGroup<T extends string>({
  label,
  name,
  options,
  value,
  onChange,
  disabled,
  renderSwatch,
  columns = 3,
}: ChoiceGroupProps<T>) {
  const labelId = useId();
  return (
    <div role="radiogroup" aria-labelledby={labelId} className="field">
      <div id={labelId} className="field-label">
        {label}
      </div>
      <div className={`gap-1.5 ${LAYOUT[columns]}`}>
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
              {renderSwatch?.(o.value)}
              <span>{o.label}</span>
            </span>
          </label>
        ))}
      </div>
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
    <div className="field">
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
