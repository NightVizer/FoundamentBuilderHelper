import { useState, type FormEvent } from "react";
import type { Calculation } from "../App";
import { fetchRecommendation } from "../api/foundation";
import { CardGroup, ChoiceGroup, CountField, NumberField, Spinner } from "../components/controls";
import {
  BearingIcon,
  ClimateIcon,
  FoundationIllustration,
  FrostIcon,
  SeismicIcon,
  SoilIcon,
  WallIcon,
  WaterIcon,
} from "../components/icons";
import { Hero, Shell } from "../components/Shell";
import {
  BEARING_OPTIONS,
  CLIMATE_HINTS,
  CLIMATE_OPTIONS,
  CLIMATE_REGION,
  FOUNDATION_HINTS,
  FROST_OPTIONS,
  GROUNDWATER_OPTIONS,
  SEISMICITY_OPTIONS,
  SOIL_OPTIONS,
  WALL_OPTIONS,
} from "../options";
import type { FormDraft, FoundationInput, SiteConditions } from "../types/foundation";

const EMPTY: FormDraft = {
  soil_type: null,
  bearing_capacity: null,
  groundwater_level: null,
  floors: "",
  building_area_m2: "",
  wall_material: null,
  climate: null,
  frost_depth: null,
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

function toInput(d: FormDraft): { input: FoundationInput; site: SiteConditions } | null {
  const floors = parseFloors(d.floors);
  const area = parseArea(d.building_area_m2);
  if (
    !d.soil_type ||
    !d.bearing_capacity ||
    !d.groundwater_level ||
    floors === null ||
    area === null ||
    !d.wall_material ||
    !d.climate ||
    !d.frost_depth ||
    !d.seismicity
  ) {
    return null;
  }
  return {
    input: {
      soil_type: d.soil_type,
      bearing_capacity: d.bearing_capacity,
      groundwater_level: d.groundwater_level,
      floors,
      building_area_m2: area,
      wall_material: d.wall_material,
      region: CLIMATE_REGION[d.climate],
      seismicity: d.seismicity,
    },
    site: { climate: d.climate, frost_depth: d.frost_depth },
  };
}

function BlockHead({ n, title, sub, id }: { n: number; title: string; sub: string; id: string }) {
  return (
    <header>
      <h2 id={id} className="block-title">
        <span className="block-num">{n}.</span>
        {title}
      </h2>
      <p className="block-sub">{sub}</p>
    </header>
  );
}

interface Props {
  onCalculated: (calc: Calculation) => void;
  onError: (error: unknown) => void;
}

export function InputPage({ onCalculated, onError }: Props) {
  const [draft, setDraft] = useState<FormDraft>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const ready = toInput(draft);

  const set =
    <K extends keyof FormDraft>(key: K) =>
    (value: FormDraft[K]) =>
      setDraft((d) => ({ ...d, [key]: value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!ready || submitting) return;
    setSubmitting(true);
    try {
      const result = await fetchRecommendation(ready.input);
      onCalculated({ ...ready, result });
    } catch (error) {
      onError(error);
    }
  }

  const fields = [
    draft.soil_type,
    draft.bearing_capacity,
    draft.groundwater_level,
    parseFloors(draft.floors),
    parseArea(draft.building_area_m2),
    draft.wall_material,
    draft.climate,
    draft.frost_depth,
    draft.seismicity,
  ];
  const filled = fields.filter((v) => v !== null).length;

  return (
    <Shell>
      <Hero ghost="Грунт" title="Помощник проектировщика фундамента">
        Опишите грунт, здание и условия площадки. Покажем три типа фундамента, которые подходят лучше
        всего, с оценкой пригодности каждого.
      </Hero>

      <form onSubmit={submit} className="content" noValidate>
        <fieldset disabled={submitting} className="min-w-0 disabled:opacity-60">
          <section className="form-block" aria-labelledby="h-soil">
            <BlockHead n={1} id="h-soil" title="Грунт" sub="Укажите характеристики грунта на вашем участке" />
            <div className="mt-8 space-y-8">
              <CardGroup
                label="Тип грунта"
                name="soil_type"
                options={SOIL_OPTIONS}
                value={draft.soil_type}
                onChange={set("soil_type")}
                renderIcon={(v) => <SoilIcon soil={v} />}
                columns={5}
              />
              <CardGroup
                label="Несущая способность"
                name="bearing_capacity"
                options={BEARING_OPTIONS}
                value={draft.bearing_capacity}
                onChange={set("bearing_capacity")}
                renderIcon={(v) => <BearingIcon level={v} />}
                sub="несущая способность"
                columns={3}
              />
              <CardGroup
                label="Уровень грунтовых вод"
                name="groundwater_level"
                options={GROUNDWATER_OPTIONS}
                value={draft.groundwater_level}
                onChange={set("groundwater_level")}
                renderIcon={(v) => <WaterIcon level={v} />}
                sub="уровень грунтовых вод"
                columns={3}
              />
            </div>
          </section>

          <section className="form-block form-block-split" aria-labelledby="h-building">
            <BlockHead n={2} id="h-building" title="Здание" sub="Параметры будущего здания" />
            <div className="min-w-0 space-y-8">
              <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
                <CountField
                  label="Этажность"
                  value={draft.floors}
                  onChange={set("floors")}
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
                  placeholder="Введите площадь"
                  hint="Больше нуля, до 100 000"
                />
              </div>
              <CardGroup
                label="Материал стен"
                name="wall_material"
                options={WALL_OPTIONS}
                value={draft.wall_material}
                onChange={set("wall_material")}
                renderIcon={(v) => <WallIcon wall={v} />}
                columns={4}
              />
            </div>
          </section>

          <section className="form-block" aria-labelledby="h-site">
            <BlockHead n={3} id="h-site" title="Условия" sub="Климат площадки, промерзание грунта и сейсмичность" />
            <div className="mt-8 space-y-8">
              <CardGroup
                label="Климат"
                name="climate"
                options={CLIMATE_OPTIONS}
                value={draft.climate}
                onChange={set("climate")}
                renderIcon={(v) => <ClimateIcon climate={v} />}
                sub={(v) => CLIMATE_HINTS[v]}
                columns={5}
              />
              <CardGroup
                label="Глубина промерзания"
                name="frost_depth"
                options={FROST_OPTIONS}
                value={draft.frost_depth}
                onChange={set("frost_depth")}
                renderIcon={(v) => <FrostIcon depth={v} />}
                sub="сезонное промерзание"
                columns={4}
              />
              <ChoiceGroup
                label="Сейсмичность"
                name="seismicity"
                options={SEISMICITY_OPTIONS}
                value={draft.seismicity}
                onChange={set("seismicity")}
                renderIcon={(v) => <SeismicIcon level={v} />}
              />
            </div>
          </section>

          <section className="form-block form-block-split" aria-labelledby="h-result">
            <BlockHead
              n={4}
              id="h-result"
              title="Результат"
              sub="Оценим четыре типа фундамента и покажем три самых подходящих"
            />
            <ul className="grid min-w-0 grid-cols-2 gap-3 xl:grid-cols-4">
              {FOUNDATION_HINTS.map((f) => (
                <li key={f.type} className="fnd-card">
                  <div className="fnd-art">
                    <FoundationIllustration type={f.type} className="h-[5.5rem] w-auto max-w-full" />
                  </div>
                  <p className="mt-4 font-semibold">{f.name}</p>
                  <p className="mt-1 text-sm leading-snug text-graphite">{f.hint}</p>
                </li>
              ))}
            </ul>
          </section>
        </fieldset>

        <footer className="form-footer">
          <p className="mono" aria-live="polite">
            {ready
              ? "Все поля заполнены"
              : `Заполнено ${filled} из ${fields.length}. Кнопка станет активной, когда заполнены все поля`}
          </p>
          <button type="submit" className="btn-primary" disabled={!ready || submitting}>
            {submitting && <Spinner className="h-5 w-5" />}
            {submitting ? "Рассчитываем" : "Рассчитать"}
          </button>
        </footer>
      </form>
    </Shell>
  );
}
