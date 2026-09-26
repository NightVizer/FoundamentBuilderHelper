import type { CompareAnalysisResponse } from "../types/foundation";
import { FOUNDATION_TYPE_LABELS } from "../types/foundation";

interface Props {
  analysis: CompareAnalysisResponse | null;
  loading?: boolean;
}

export function ProsConsPanel({ analysis, loading }: Props) {
  if (loading || !analysis) {
    return <p className="text-sm text-slate-600">DeepSeek готовит плюсы и минусы…</p>;
  }

  return (
    <section className="space-y-4 rounded-xl border bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold">Сравнение в ваших условиях</h2>
        <p className="mt-1 text-xs text-slate-500">
          Текст: {analysis.provider === "deepseek" ? "DeepSeek" : "шаблон (нет API-ключа)"}
        </p>
      </div>
      <p className="text-sm text-slate-800">{analysis.overview}</p>
      <p className="rounded-lg bg-slate-50 p-3 text-sm">{analysis.why_recommended}</p>
      <div className="grid gap-4 md:grid-cols-2">
        {analysis.types.map((t) => (
          <article key={t.type} className="rounded-lg border p-4">
            <h3 className="font-medium">{FOUNDATION_TYPE_LABELS[t.type]}</h3>
            <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <p className="font-medium text-emerald-700">Плюсы</p>
                <ul className="mt-1 list-disc pl-4 text-slate-700">
                  {t.pros.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-medium text-amber-800">Минусы</p>
                <ul className="mt-1 list-disc pl-4 text-slate-700">
                  {t.cons.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
