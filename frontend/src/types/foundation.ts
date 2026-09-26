export type SoilType = "sand" | "sandy_loam" | "loam" | "clay" | "fill";
export type Level = "low" | "medium" | "high";
export type WallMaterial = "wood" | "aerated_concrete" | "brick" | "reinforced_concrete";
export type Seismicity = "0-6" | "7" | "8+";
export type FoundationType = "strip" | "slab" | "pile" | "column";

/** Коды регионов бэкенда (prices.json), см. BACKEND_REPORT.md. */
export type RegionId = "moscow" | "krasnoyarsk" | "ekb";

export interface FoundationInput {
  soil_type: SoilType;
  bearing_capacity: Level;
  groundwater_level: Level;
  floors: number;
  building_area_m2: number;
  wall_material: WallMaterial;
  region: RegionId;
  seismicity: Seismicity;
}

/** Черновик формы: всё пусто до выбора пользователем. */
export type FormDraft = {
  [K in keyof FoundationInput]: FoundationInput[K] extends number ? string : FoundationInput[K] | null;
};

// Ответ POST /api/foundation/recommend (схема FoundationRecommendResponse бэкенда).
// Объект целиком возвращается в /analyze, поэтому храним его как есть.
export interface FoundationOption {
  type: FoundationType;
  name: string;
  score: number;
  [extra: string]: unknown;
}

export interface RecommendResponse {
  recommended: FoundationOption;
  alternatives: FoundationOption[];
  [extra: string]: unknown;
}

// Ответ POST /api/foundation/analyze (CompareAnalysisResponse).
export interface AnalyzeResponse {
  overview: string;
  why_recommended: string;
  types: { type: FoundationType; pros: string[]; cons: string[] }[];
  provider: "deepseek" | "template";
}

export interface RankedOption {
  type: FoundationType;
  name: string;
  score: number;
}

export interface Explanation {
  pros: string[];
  cons: string[];
  vs_others?: string;
}

export type Explanations = Partial<Record<FoundationType, Explanation>>;
