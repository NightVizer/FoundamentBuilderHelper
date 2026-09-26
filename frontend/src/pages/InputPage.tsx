import { useState, type FormEvent } from "react";
import type { Calculation } from "../App";
import { fetchRecommendation } from "../api/foundation";
import { ChoiceGroup, NumberField, Spinner } from "../components/controls";
import { Hero, SectionHeading, Shell } from "../components/Shell";
import {
  BEARING_OPTIONS,
  GROUNDWATER_OPTIONS,
  REGION_OPTIONS,
  SEISMICITY_OPTIONS,
  SOIL_OPTIONS,
  WALL_OPTIONS,
} from "../options";
import type { FormDraft, FoundationInput } from "../types/foundation";

const EMPTY: FormDraft = {
  soil_type: null,
  bearing_capacity: null,
  groundwater_level: null,
  floors: "",
  building_area_m2: "",
  wall_material: null,
  region: null,
  seismicity: null,
};

// Диапазоны совпадают со схемой FoundationInput бэкенда.
const FLOORS_MAX = 50;
const AREA_MAX = 100_000;

function parseFloors(raw: string): number | null {
  if (!/^\d+$/.test(raw.trim())) return null;
  const n = Number(raw);
  return n >= 1 && n <= FLOORS_MAX ? n : null;
}

function parseArea(raw: string): number | null {
  const n = Number(raw.replace(",", "."));
  return raw.trim() !== "" && Number.isFinite(n) && n > 0 && n <= AREA_MAX ? n : null;
}

function toInput(d: FormDraft): FoundationInput | null {
  const floors = parseFloors(d.floors);
  const area = parseArea(d.building_area_m2);
  if (
    !d.soil_type ||
    !d.bearing_capacity ||
    !d.groundwater_level ||
    floors === null ||
    area === null ||
    !d.wall_material ||
    !d.region ||
    !d.seismicity
  ) {
    return null;
  }
  return {
    soil_type: d.soil_type,
    bearing_capacity: d.bearing_capacity,
    groundwater_level: d.groundwater_level,
    floors,
    building_area_m2: area,
    wall_material: d.wall_material,
    region: d.region,
    seismicity: d.seismicity,
  };
}

interface Props {
  onCalculated: (calc: Calculation) => void;
  onError: (error: unknown) => void;
}

export function InputPage({ onCalculated, onError }: Props) {
  const [draft, setDraft] = useState<FormDraft>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const input = toInput(draft);

  const set =
    <K extends keyof FormDraft>(key: K) =>
    (value: FormDraft[K]) =>
      setDraft((d) => ({ ...d, [key]: value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!input || submitting) return;
    setSubmitting(true);
    try {
      const result = await fetchRecommendation(input);
      onCalculated({ input, result });
    } catch (error) {
      onError(error);
    }
  }

  const filled = [
    draft.soil_type,
    draft.bearing_capacity,
    draft.groundwater_level,
    parseFloors(draft.floors),
    parseArea(draft.building_area_m2),
    draft.wall_material,
    draft.region,
    draft.seismicity,
  ].filter((v) => v !== null).length;

  return (
    <Shell
      step="input"
      aside={
        <span className="mono" aria-live="polite">
          Заполнено {filled} из 8
        </span>
      }
    >
      <Hero ghost="Грунт" title="Помощник проектировщика фундамента">
        Опишите грунт, здание и условия площадки. Покажем три типа фундамента, которые подходят лучше
        всего, с оценкой пригодности каждого.
      </Hero>

      <form onSubmit={submit} className="content" noValidate>
        <div className="form-row">
          <SectionHeading id="sec-geo">Геология</SectionHeading>
          <fieldset className="form-fields" aria-labelledby="sec-geo" disabled={submitting}>
            <ChoiceGroup
              label="Тип грунта"
              name="soil_type"
              options={SOIL_OPTIONS}
              value={draft.soil_type}
              onChange={set("soil_type")}
              columns="wrap"
            />
            <ChoiceGroup
              label="Несущая способность"
              name="bearing_capacity"
              options={BEARING_OPTIONS}
              value={draft.bearing_capacity}
              onChange={set("bearing_capacity")}
            />
            <ChoiceGroup
              label="Уровень грунтовых вод"
              name="groundwater_level"
              options={GROUNDWATER_OPTIONS}
              value={draft.groundwater_level}
              onChange={set("groundwater_level")}
            />
          </fieldset>
        </div>

        <div className="form-row">
          <SectionHeading id="sec-building">Здание</SectionHeading>
          <fieldset className="form-fields" aria-labelledby="sec-building" disabled={submitting}>
            <div className="grid max-w-[30rem] grid-cols-2 gap-4">
              <NumberField
                label="Этажность"
                value={draft.floors}
                onChange={set("floors")}
                integer
                min={1}
                max={FLOORS_MAX}
                hint={`Целое число от 1 до ${FLOORS_MAX}`}
              />
              <NumberField
                label="Площадь здания"
                value={draft.building_area_m2}
                onChange={set("building_area_m2")}
                suffix="м²"
                min={1}
                max={AREA_MAX}
                hint="Больше нуля, до 100 000"
              />
            </div>
            <ChoiceGroup
              label="Материал стен"
              name="wall_material"
              options={WALL_OPTIONS}
              value={draft.wall_material}
              onChange={set("wall_material")}
              columns="wrap"
            />
          </fieldset>
        </div>

        <div className="form-row">
          <SectionHeading id="sec-site">Условия</SectionHeading>
          <fieldset className="form-fields" aria-labelledby="sec-site" disabled={submitting}>
            <ChoiceGroup
              label="Регион"
              name="region"
              options={REGION_OPTIONS}
              value={draft.region}
              onChange={set("region")}
              columns="wrap"
            />
            <ChoiceGroup
              label="Сейсмичность"
              name="seismicity"
              options={SEISMICITY_OPTIONS}
              value={draft.seismicity}
              onChange={set("seismicity")}
            />
          </fieldset>
        </div>

        <div className="form-row">
          <div />
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <button type="submit" className="btn-primary" disabled={!input || submitting}>
              {submitting && <Spinner className="h-5 w-5" />}
              {submitting ? "Рассчитываем" : "Рассчитать"}
            </button>
            {!input && !submitting && (
              <p className="mono">Кнопка станет активной, когда заполнены все поля</p>
            )}
          </div>
        </div>
      </form>
    </Shell>
  );
}
