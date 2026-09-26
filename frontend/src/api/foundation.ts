import type {
  CompareAnalysisResponse,
  FoundationInput,
  FoundationRecommendResponse,
  ReportResponse,
} from "../types/foundation";

const API_BASE = "/api/foundation";

export async function fetchRecommendation(
  input: FoundationInput,
): Promise<FoundationRecommendResponse> {
  const res = await fetch(`${API_BASE}/recommend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(detail || "Ошибка расчёта рекомендации");
  }
  return res.json();
}

export async function fetchCompareAnalysis(
  input: FoundationInput,
  result: FoundationRecommendResponse,
): Promise<CompareAnalysisResponse> {
  const res = await fetch(`${API_BASE}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input, result }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(detail || "Ошибка анализа DeepSeek");
  }
  return res.json();
}

export async function fetchReport(
  input: FoundationInput,
  result: FoundationRecommendResponse,
): Promise<ReportResponse> {
  const res = await fetch(`${API_BASE}/report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input, result }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(detail || "Ошибка формирования отчёта");
  }
  return res.json();
}
