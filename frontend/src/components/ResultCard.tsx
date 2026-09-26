import type { FoundationOption } from "../types/foundation";
import { FOUNDATION_TYPE_LABELS } from "../types/foundation";

interface Props {
  option: FoundationOption;
  title?: string;
  highlight?: boolean;
}

export function ResultCard({ option, title = "Рекомендация", highlight }: Props) {
  return (
    <article
      className={`rounded-xl border p-5 ${highlight ? "border-emerald-500 bg-emerald-50" : "bg-white shadow-sm"}`}
    >
      <h3 className="text-sm font-medium text-slate-500">{title}</h3>
      <p className="mt-1 text-xl font-semibold">{FOUNDATION_TYPE_LABELS[option.type]}</p>
      <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <div>
          <dt className="text-slate-500">Пригодность (JEV)</dt>
          <dd className="font-medium">{option.score}%</dd>
        </div>
        <div>
          <dt className="text-slate-500">Трудозатраты</dt>
          <dd className="font-medium">{option.labor_hours} ч</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-slate-500">Стоимость (ориентир)</dt>
          <dd className="font-medium">{option.estimated_cost_rub.toLocaleString("ru-RU")} ₽</dd>
        </div>
      </dl>
      <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-slate-700">
        {option.reasons.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
    </article>
  );
}
