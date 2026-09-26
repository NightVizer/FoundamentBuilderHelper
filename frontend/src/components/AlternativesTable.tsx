import type { FoundationOption } from "../types/foundation";
import { FOUNDATION_TYPE_LABELS } from "../types/foundation";

interface Props {
  alternatives: FoundationOption[];
}

export function AlternativesTable({ alternatives }: Props) {
  if (alternatives.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b bg-slate-50 text-slate-600">
          <tr>
            <th className="px-4 py-3 font-medium">Тип</th>
            <th className="px-4 py-3 font-medium">Пригодность</th>
            <th className="px-4 py-3 font-medium">Стоимость</th>
            <th className="px-4 py-3 font-medium">Трудозатраты</th>
          </tr>
        </thead>
        <tbody>
          {alternatives.map((a) => (
            <tr key={a.type} className="border-b last:border-0">
              <td className="px-4 py-3">{FOUNDATION_TYPE_LABELS[a.type]}</td>
              <td className="px-4 py-3">{a.score}%</td>
              <td className="px-4 py-3">{a.estimated_cost_rub.toLocaleString("ru-RU")} ₽</td>
              <td className="px-4 py-3">{a.labor_hours} ч</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
