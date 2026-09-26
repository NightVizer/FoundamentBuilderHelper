import { useState, type FormEvent } from "react";
import type { Calculation } from "../App";
import { fetchRecommendation } from "../api/foundation";
import { CardGroup, ChoiceGroup, CountField, NumberField, Spinner } from "../components/controls";
import { BearingIcon, FoundationIllustration, SeismicIcon, SoilIcon, WallIcon, WaterIcon } from "../components/icons";
import { Hero, Shell } from "../components/Shell";
import { STEP_LABELS, Stepper, type StepItem } from "../components/Stepper";
import {
  BEARING_OPTIONS,
  FOUNDATION_HINTS,
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

const SECTION_IDS = ["sec-soil", "sec-building", "sec-site", "sec-result"] as const;

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

  // Поля по разделам 1–3: раздел считается пройденным, когда заполнены все его поля.
  const sections = [
    [draft.soil_type, draft.bearing_capacity, draft.groundwater_level],
    [parseFloors(draft.floors), parseArea(draft.building_area_m2), draft.wall_material],
    [draft.region, draft.seismicity],
  ];
  const fields = sections.flat();
  const filled = fields.filter((v) => v !== null).length;
  const sectionDone = sections.map((s) => s.every((v) => v !== null));
  const firstOpen = sectionDone.indexOf(false);
  const current = firstOpen === -1 ? SECTION_IDS.length - 1 : firstOpen;
  const steps: StepItem[] = STEP_LABELS.map((label, i) => ({
    label,
    target: SECTION_IDS[i],
    state: sectionDone[i] ? "done" : i === current ? "current" : "upcoming",
  }));

  return (
    <Shell stepper={<Stepper steps={steps} />}>
      <Hero ghost="Грунт" title="Помощник проектировщика фундамента">
        Опишите грунт, здание и условия площадки. Покажем три типа фундамента, которые подходят лучше
        всего, с оценкой пригодности каждого.
      </Hero>

      <form onSubmit={submit} className="content" noValidate>
        <fieldset disabled={submitting} className="min-w-0 disabled:opacity-60">
          <section id={SECTION_IDS[0]} className="form-block" aria-labelledby="h-soil">
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

          <section id={SECTION_IDS[1]} className="form-block form-block-split" aria-labelledby="h-building">
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

          <section id={SECTION_IDS[2]} className="form-block form-block-split" aria-labelledby="h-site">
            <BlockHead n={3} id="h-site" title="Условия" sub="Регион и сейсмическая активность" />
            <div className="min-w-0 space-y-6">
              <ChoiceGroup
                label="Регион"
                name="region"
                options={REGION_OPTIONS}
                value={draft.region}
                onChange={set("region")}
                inline
              />
              <ChoiceGroup
                label="Сейсмичность"
                name="seismicity"
                options={SEISMICITY_OPTIONS}
                value={draft.seismicity}
                onChange={set("seismicity")}
                renderIcon={(v) => <SeismicIcon level={v} />}
                inline
              />
            </div>
          </section>

          <section id={SECTION_IDS[3]} className="form-block form-block-split" aria-labelledby="h-result">
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
            {input
              ? "Все поля заполнены"
              : `Заполнено ${filled} из ${fields.length}. Кнопка станет активной, когда заполнены все поля`}
          </p>
          <button type="submit" className="btn-primary" disabled={!input || submitting}>
            {submitting && <Spinner className="h-5 w-5" />}
            {submitting ? "Рассчитываем" : "Рассчитать"}
          </button>
        </footer>
      </form>
    </Shell>
  );
}
