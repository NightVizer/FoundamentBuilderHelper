import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchCompareAnalysis, fetchRecommendation } from "../api/foundation";
import { AlternativesTable } from "../components/AlternativesTable";
import { InputForm } from "../components/InputForm";
import { ProsConsPanel } from "../components/ProsConsPanel";
import { ResultCard } from "../components/ResultCard";
import { SuitabilityChart } from "../components/SuitabilityChart";
import type {
  CompareAnalysisResponse,
  FoundationInput,
  FoundationRecommendResponse,
} from "../types/foundation";

export function HomePage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState<FoundationInput | null>(null);
  const [result, setResult] = useState<FoundationRecommendResponse | null>(null);
  const [analysis, setAnalysis] = useState<CompareAnalysisResponse | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);

  async function handleSubmit(data: FoundationInput) {
    setLoading(true);
    setError(null);
    setAnalysis(null);
    try {
      const res = await fetchRecommendation(data);
      setInput(data);
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Неизвестная ошибка");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!input || !result) return;
    let cancelled = false;
    (async () => {
      setAnalysisLoading(true);
      try {
        const res = await fetchCompareAnalysis(input, result);
        if (!cancelled) setAnalysis(res);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Ошибка анализа");
        }
      } finally {
        if (!cancelled) setAnalysisLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [input, result]);

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <header>
        <h1 className="text-2xl font-bold">Помощник проектировщика фундамента</h1>
        <p className="mt-1 text-slate-600">Предварительный подбор типа фундамента (MVP)</p>
      </header>

      <InputForm onSubmit={handleSubmit} loading={loading} />

      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800">{error}</p>}

      {result && (
        <div className="space-y-6">
          {result.warning && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">{result.warning}</p>
          )}
          <SuitabilityChart
            recommended={result.recommended}
            alternatives={result.alternatives}
            scoreSource={result.score_source}
          />
          <ResultCard option={result.recommended} highlight />
          {(analysis || analysisLoading) && (
            <ProsConsPanel analysis={analysis} loading={analysisLoading} />
          )}
          <div>
            <h2 className="mb-3 text-lg font-semibold">Альтернативы</h2>
            <AlternativesTable alternatives={result.alternatives} />
          </div>
          {input && (
            <Link
              to="/compare"
              state={{ input, result }}
              className="inline-block rounded-lg border px-4 py-2 text-sm hover:bg-white"
            >
              Подробное сравнение →
            </Link>
          )}
          {input && (
            <Link
              to="/report"
              state={{ input, result }}
              className="ml-3 inline-block rounded-lg bg-slate-800 px-4 py-2 text-sm text-white hover:bg-slate-700"
            >
              Сформировать ТЭО →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
