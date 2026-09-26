import type { FoundationType, Level, RegionId, Seismicity, SoilType, WallMaterial } from "./types/foundation";

export interface Option<T extends string> {
  value: T;
  label: string;
}

export const SOIL_OPTIONS: Option<SoilType>[] = [
  { value: "sand", label: "Песок" },
  { value: "sandy_loam", label: "Супесь" },
  { value: "loam", label: "Суглинок" },
  { value: "clay", label: "Глина" },
  { value: "fill", label: "Насыпной грунт" },
];

export const BEARING_OPTIONS: Option<Level>[] = [
  { value: "low", label: "Низкая" },
  { value: "medium", label: "Средняя" },
  { value: "high", label: "Высокая" },
];

export const GROUNDWATER_OPTIONS: Option<Level>[] = [
  { value: "low", label: "Низкий" },
  { value: "medium", label: "Средний" },
  { value: "high", label: "Высокий" },
];

export const WALL_OPTIONS: Option<WallMaterial>[] = [
  { value: "wood", label: "Дерево" },
  { value: "aerated_concrete", label: "Газобетон" },
  { value: "brick", label: "Кирпич" },
  { value: "reinforced_concrete", label: "Железобетон" },
];

// Названия из ТЗ, коды из backend/app/data/prices.json.
// Свердловская область в бэкенде представлена Екатеринбургом (ekb).
export const REGION_OPTIONS: Option<RegionId>[] = [
  { value: "moscow", label: "Москва" },
  { value: "krasnoyarsk", label: "Красноярский край" },
  { value: "ekb", label: "Свердловская область" },
];

export const SEISMICITY_OPTIONS: Option<Seismicity>[] = [
  { value: "0-6", label: "0–6 баллов" },
  { value: "7", label: "7 баллов" },
  { value: "8+", label: "8+ баллов" },
];

export const FOUNDATION_NAMES: Record<FoundationType, string> = {
  strip: "Ленточный фундамент",
  slab: "Плитный фундамент",
  pile: "Свайный фундамент",
  column: "Столбчатый фундамент",
};

// Карточки «что сравним» на странице ввода: порядок и краткие подсказки.
export const FOUNDATION_HINTS: { type: FoundationType; name: string; hint: string }[] = [
  { type: "pile", name: "Свайный", hint: "Для слабых грунтов и высоких грунтовых вод" },
  { type: "slab", name: "Плитный", hint: "Для неоднородных грунтов и тяжёлых зданий" },
  { type: "strip", name: "Ленточный", hint: "Для малоэтажных зданий на устойчивых грунтах" },
  { type: "column", name: "Столбчатый", hint: "Для лёгких построек на прочных грунтах" },
];

// Короткое слово для бледного фона за заголовком результатов.
export const FOUNDATION_WORDS: Record<FoundationType, string> = {
  strip: "Лента",
  slab: "Плита",
  pile: "Сваи",
  column: "Столбы",
};

export function labelOf<T extends string>(options: Option<T>[], value: T | null): string | null {
  return options.find((o) => o.value === value)?.label ?? null;
}
