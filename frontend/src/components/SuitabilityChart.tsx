import type { FoundationOption } from "../types/foundation";
import { FOUNDATION_TYPE_LABELS } from "../types/foundation";

interface Props {
  recommended: FoundationOption;
  alternatives: FoundationOption[];
  scoreSource?: "jev" | "rules_fallback";
}

export function SuitabilityChart({ recommended, alternatives, scoreSource }: Props) {
  const all = [recommended, ...alternatives].sort((a, b) => b.score - a.score);
  const sourceLabel =
    scoreSource === "jev" ? "модель JEV" : "локальные правила (до подключения JEV)";

  return (
    <section className="rounded-xl border bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold">Пригодность по типам фундамента</h2>
      <p className="mt-1 text-sm text-slate-500">Источник оценки: {sourceLabel}</p>
      <ul className="mt-4 space-y-3">
        {all.map((opt) => (
          <li key={opt.type}>
            <div className="mb-1 flex justify-between text-sm">
              <span className="font-medium">{FOUNDATION_TYPE_LABELS[opt.type]}</span>
              <span>{opt.score}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-slate-800 transition-all"
                style={{ width: `${opt.score}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
