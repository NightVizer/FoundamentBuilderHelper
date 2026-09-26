import { Link, useLocation } from "react-router-dom";
import { ResultCard } from "../components/ResultCard";
import type { FoundationInput, FoundationRecommendResponse } from "../types/foundation";

interface LocationState {
  input: FoundationInput;
  result: FoundationRecommendResponse;
}

export function ComparePage() {
  const location = useLocation();
  const state = location.state as LocationState | null;

  if (!state?.result) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <p>Нет данных для сравнения.</p>
        <Link to="/" className="mt-4 inline-block text-slate-700 underline">
          Вернуться к форме
        </Link>
      </div>
    );
  }

  const all = [state.result.recommended, ...state.result.alternatives];

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Сравнение вариантов</h1>
        <Link to="/" className="text-sm text-slate-600 hover:underline">
          ← Назад
        </Link>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        {all.map((opt, i) => (
          <ResultCard
            key={opt.type}
            option={opt}
            title={i === 0 ? "Рекомендация" : "Альтернатива"}
            highlight={i === 0}
          />
        ))}
      </div>
    </div>
  );
}
