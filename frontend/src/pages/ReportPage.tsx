import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { fetchReport } from "../api/foundation";
import { ReportView } from "../components/ReportView";
import type { FoundationInput, FoundationRecommendResponse } from "../types/foundation";

interface LocationState {
  input: FoundationInput;
  result: FoundationRecommendResponse;
}

export function ReportPage() {
  const location = useLocation();
  const state = location.state as LocationState | null;
  const [text, setText] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!state?.input || !state?.result) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchReport(state.input, state.result);
        if (!cancelled) setText(res.report_text);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Ошибка");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state]);

  function exportTxt() {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "teo-fundament.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!state?.result) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <p>Сначала выполните расчёт на главной странице.</p>
        <Link to="/" className="mt-4 inline-block underline">
          На главную
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-8">
      <Link to="/" className="text-sm text-slate-600 hover:underline">
        ← Назад
      </Link>
      {loading && <p className="text-slate-600">Формирование отчёта…</p>}
      {error && <p className="text-red-700">{error}</p>}
      {text && <ReportView text={text} onExport={exportTxt} />}
    </div>
  );
}
