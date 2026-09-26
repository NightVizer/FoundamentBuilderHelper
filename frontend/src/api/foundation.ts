import type {
  AnalyzeResponse,
  Explanations,
  FoundationInput,
  FoundationType,
  RankedOption,
  RecommendResponse,
} from "../types/foundation";

const API_BASE = "/api/foundation";
const TYPES: FoundationType[] = ["strip", "slab", "pile", "column"];

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

function isOption(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  return (
    TYPES.includes(o.type as FoundationType) &&
    typeof o.score === "number" &&
    Number.isFinite(o.score)
  );
}

export async function fetchRecommendation(input: FoundationInput): Promise<RecommendResponse> {
  const data = await postJson<RecommendResponse>("/recommend", input);
  const all = [data?.recommended, ...(Array.isArray(data?.alternatives) ? data.alternatives : [])];
  if (all.length < 3 || !all.every(isOption)) throw new Error("/recommend: неверный формат ответа");
  return data;
}

/** Все варианты по убыванию оценки; при равенстве сохраняется порядок бэкенда. */
export function rankOptions(data: RecommendResponse): RankedOption[] {
  return [data.recommended, ...data.alternatives]
    .map(({ type, name, score }) => ({ type, name, score: Math.round(score) }))
    .sort((a, b) => b.score - a.score);
}

// Шаблонный ответ бэкенда (без LLM) дублирует оценку первым пунктом плюсов.
const SCORE_LINE = /^Оценка:\s*\d+\s*\/\s*100$/;

function cleanList(value: unknown): string[] {
  if (!Array.isArray(value)) throw new Error("/analyze: неверный формат ответа");
  return value.map(String).map((s) => s.trim()).filter((s) => s && !SCORE_LINE.test(s));
}

// Бэкенд не имеет /explain из ТЗ; тексты берём из /analyze.
// Кэш по объекту ответа /recommend: один LLM-запрос на расчёт, даже при двойном
// монтировании эффекта в React StrictMode.
const explainCache = new WeakMap<RecommendResponse, Promise<Explanations>>();

export function fetchExplanations(
  input: FoundationInput,
  result: RecommendResponse,
  top3: RankedOption[],
): Promise<Explanations> {
  let pending = explainCache.get(result);
  if (!pending) {
    pending = postJson<AnalyzeResponse>("/analyze", { input, result }).then((data) => {
      if (!data || !Array.isArray(data.types)) throw new Error("/analyze: неверный формат ответа");
      const out: Explanations = {};
      top3.forEach(({ type }, index) => {
        const item = data.types.find((t) => t.type === type);
        if (!item) throw new Error(`/analyze: нет текста для ${type}`);
        out[type] = {
          pros: cleanList(item.pros),
          cons: cleanList(item.cons),
          vs_others: index === 0 ? String(data.why_recommended ?? "").trim() : undefined,
        };
      });
      return out;
    });
    explainCache.set(result, pending);
  }
  return pending;
}
