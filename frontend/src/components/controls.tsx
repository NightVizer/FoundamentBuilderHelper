import { useId, useRef, type ReactNode } from "react";
import { prefersReducedMotion, useCountUp, useInView } from "../motion";
import type { Option } from "../options";

/** Общие свойства полей формы: якорь для прокрутки и текст ошибки. */
interface FieldProps {
  /** id обёртки поля: к нему прокручивает список ошибок. */
  id: string;
  error?: string;
  /** Номер попытки отправки: при новой попытке ошибка вспыхивает снова. */
  flash?: number;
}

/** Вспышка вокруг поля и текст ошибки под ним. key перезапускает анимацию. */
function FieldError({ id, error, flash = 0, className = "" }: { id: string; error?: string; flash?: number; className?: string }) {
  if (!error) return null;
  return (
    <>
      <span key={`ring-${flash}-${error}`} className="flash-ring" aria-hidden />
      <p key={`msg-${flash}-${error}`} id={id} className={`field-error ${className}`}>
        {error}
      </p>
    </>
  );
}

interface ChoiceGroupProps<T extends string> extends FieldProps {
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
  id,
  error,
  flash,
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
  const errorId = `${id}-error`;
  return (
    <div
      id={id}
      role="radiogroup"
      aria-labelledby={labelId}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? errorId : undefined}
      className={`field ${error ? "is-invalid" : ""} ${inline ? "grid items-center gap-x-6 gap-y-2.5 sm:grid-cols-[8.5rem_minmax(0,1fr)]" : ""}`}
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
      <FieldError id={errorId} error={error} flash={flash} className={inline ? "sm:col-span-2" : ""} />
    </div>
  );
}

const CARD_COLUMNS = {
  3: "grid-cols-1 sm:grid-cols-3",
  4: "grid-cols-2 lg:grid-cols-4",
  5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
} as const;

interface CardGroupProps<T extends string> extends FieldProps {
  label: string;
  name: string;
  options: Option<T>[];
  value: T | null;
  onChange: (value: T) => void;
  renderIcon: (value: T) => ReactNode;
  /** Вторая строка под названием варианта: общая для всех карточек или своя у каждой. */
  sub?: string | ((value: T) => string);
  columns: keyof typeof CARD_COLUMNS;
}

/** Радиогруппа из карточек с миниатюрой: для вариантов, которые проще узнать по картинке. */
export function CardGroup<T extends string>({
  id,
  error,
  flash,
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
  const errorId = `${id}-error`;
  return (
    <div
      id={id}
      role="radiogroup"
      aria-labelledby={labelId}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? errorId : undefined}
      className={`field ${error ? "is-invalid" : ""}`}
    >
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
                {sub && <span className="opt-sub">{typeof sub === "function" ? sub(o.value) : sub}</span>}
              </span>
            </span>
          </label>
        ))}
      </div>
      <FieldError id={errorId} error={error} flash={flash} />
    </div>
  );
}

interface CountFieldProps extends FieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint: string;
  min: number;
  max: number;
}

/** Новое число въезжает снизу при увеличении и сверху при уменьшении, как на счётчике. */
function roll(el: HTMLElement | null, delta: number) {
  if (!el || prefersReducedMotion()) return;
  el.animate([{ transform: `translateY(${delta > 0 ? 60 : -60}%)`, opacity: 0 }, { transform: "none", opacity: 1 }], {
    duration: 240,
    easing: "cubic-bezier(0.2, 0.7, 0.2, 1)",
  });
}

/** Целое число с кнопками − и +, поле можно заполнить и вручную. */
export function CountField({ id, error, flash, label, value, onChange, hint, min, max }: CountFieldProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const n = Number.parseInt(value, 10);
  const step = (delta: number) => {
    const next = Number.isNaN(n) ? min : Math.min(max, Math.max(min, n + delta));
    onChange(String(next));
    if (next !== n) roll(inputRef.current, delta);
  };
  return (
    <div id={id} className={`field ${error ? "is-invalid" : ""}`}>
      <label htmlFor={inputId} className="field-label">
        {label}
      </label>
      <div className="count-input">
        <button type="button" onClick={() => step(-1)} disabled={!Number.isNaN(n) && n <= min} aria-label="Уменьшить">
          <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" aria-hidden>
            <path d="M3 7h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={value}
          placeholder="0"
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : `${id}-hint`}
        />
        <button type="button" onClick={() => step(1)} disabled={!Number.isNaN(n) && n >= max} aria-label="Увеличить">
          <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" aria-hidden>
            <path d="M3 7h8M7 3v8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      {error ? (
        <FieldError id={`${id}-error`} error={error} flash={flash} />
      ) : (
        <p id={`${id}-hint`} className="field-hint">
          {hint}
        </p>
      )}
    </div>
  );
}

interface NumberFieldProps extends FieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  suffix?: string;
  hint: string;
  integer?: boolean;
  placeholder?: string;
  disabled?: boolean;
}

// Поле текстовое, а не type="number": иначе браузер отдаёт пустую строку вместо
// неверного ввода, и ошибку нельзя показать по делу.
export function NumberField({
  id,
  error,
  flash,
  label,
  value,
  onChange,
  suffix,
  hint,
  integer,
  placeholder,
  disabled,
}: NumberFieldProps) {
  const inputId = useId();
  return (
    <div id={id} className={`field ${error ? "is-invalid" : ""}`}>
      <label htmlFor={inputId} className="field-label">
        {label}
      </label>
      <div className="number-input">
        <input
          id={inputId}
          type="text"
          inputMode={integer ? "numeric" : "decimal"}
          autoComplete="off"
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : `${id}-hint`}
        />
        {suffix && <span className="suffix">{suffix}</span>}
      </div>
      {error ? (
        <FieldError id={`${id}-error`} error={error} flash={flash} />
      ) : (
        <p id={`${id}-hint`} className="field-hint">
          {hint}
        </p>
      )}
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

/** Три сваи по очереди уходят в основание: ожидание в духе иллюстрации первого экрана. */
export function PileLoader({ className = "h-5 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 20" className={`pile-loader ${className}`} fill="currentColor" aria-hidden>
      {[3, 10.25, 17.5].map((x, i) => (
        <rect key={x} x={x} y="2" width="3.5" height="11" style={{ ["--i" as string]: i }} />
      ))}
      <rect x="1" y="15" width="22" height="3.5" />
    </svg>
  );
}

const RING_R = 40;
const RING_C = 2 * Math.PI * RING_R;

/** Кольцо пригодности: одинаковый размер у победителя и альтернатив. */
export function ScoreRing({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  // Дуга и число растут, когда кольцо показалось на экране, а не при загрузке страницы.
  const [ref, visible] = useInView<HTMLDivElement>(0.6);
  const shown = useCountUp(clamped, visible);
  return (
    <div
      ref={ref}
      className={`score-ring ${visible ? "is-visible" : ""}`}
      role="img"
      aria-label={`Пригодность ${clamped}%`}
    >
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={RING_R} fill="none" stroke="var(--rule)" strokeWidth="6" />
        <circle
          cx="50"
          cy="50"
          r={RING_R}
          fill="none"
          stroke="var(--ink)"
          strokeWidth="6"
          strokeLinecap="butt"
          strokeDasharray={RING_C}
          strokeDashoffset={RING_C * (1 - clamped / 100)}
          className="ring-arc"
          style={{ ["--ring-c" as string]: RING_C }}
        />
      </svg>
      <span className="score-value" aria-hidden>
        {shown}%
      </span>
    </div>
  );
}
