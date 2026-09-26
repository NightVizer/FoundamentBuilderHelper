export type SoilType = "sand" | "sandy_loam" | "loam" | "clay" | "fill";
export type BearingCapacity = "low" | "medium" | "high";
export type GroundwaterLevel = "low" | "medium" | "high";
export type WallMaterial = "wood" | "aerated_concrete" | "brick" | "reinforced_concrete";
export type FoundationType = "strip" | "slab" | "pile" | "column";

export interface FoundationInput {
  soil_type: SoilType;
  bearing_capacity: BearingCapacity;
  groundwater_level: GroundwaterLevel;
  floors: number;
  building_area_m2: number;
  wall_material: WallMaterial;
  region: string;
  seismicity: string;
}

export interface FoundationOption {
  type: FoundationType;
  score: number;
  estimated_cost_rub: number;
  labor_hours: number;
  reasons: string[];
}

export interface FoundationRecommendResponse {
  recommended: FoundationOption;
  alternatives: FoundationOption[];
  warning: string | null;
  score_source?: "jev" | "rules_fallback";
}

export interface TypeInsight {
  type: FoundationType;
  pros: string[];
  cons: string[];
}

export interface CompareAnalysisResponse {
  overview: string;
  why_recommended: string;
  types: TypeInsight[];
  provider: "deepseek" | "template";
}

export interface ReportResponse {
  report_text: string;
}

export const FOUNDATION_TYPE_LABELS: Record<FoundationType, string> = {
  strip: "Ленточный",
  slab: "Плитный",
  pile: "Свайный",
  column: "Столбчатый",
};

export const REGIONS = [
  { id: "moscow", label: "Москва и МО" },
  { id: "spb", label: "Санкт-Петербург" },
  { id: "ekb", label: "Екатеринбург" },
  { id: "novosibirsk", label: "Новосибирск" },
  { id: "krasnodar", label: "Краснодар" },
] as const;
