import { useState, type FormEvent } from "react";
import type { Calculation } from "../App";
import { fetchRecommendation } from "../api/foundation";
import { CardGroup, ChoiceGroup, CountField, NumberField, Spinner } from "../components/controls";
import {
  BearingIcon,
  ClimateIcon,
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

type FieldKey = keyof FormDraft;

// Порядок полей на странице: в нём же идут ошибки и прокрутка к первой из них.
const FIELDS: { key: FieldKey; label: string; missing: string }[] = [
  { key: "soil_type", label: "Тип грунта", missing: "Выберите тип грунта" },
  { key: "bearing_capacity", label: "Несущая способность", missing: "Выберите несущую способность" },
  { key: "groundwater_level", label: "Уровень грунтовых вод", missing: "Выберите уровень грунтовых вод" },
  { key: "floors", label: "Этажность", missing: "Укажите этажность" },
  { key: "building_area_m2", label: "Площадь здания", missing: "Укажите площадь здания" },
  { key: "wall_material", label: "Материал стен", missing: "Выберите материал стен" },
  { key: "climate", label: "Климат", missing: "Выберите климат" },
  { key: "frost_depth", label: "Глубина промерзания", missing: "Выберите глубину промерзания" },
  { key: "seismicity", label: "Сейсмичность", missing: "Выберите сейсмичность" },
];

const fieldId = (key: FieldKey) => `field-${key}`;

function isEmpty(value: FormDraft[FieldKey]): boolean {
  return value === null || (typeof value === "string" && value.trim() === "");
}

/** Число этажей или текст ошибки. */
function parseFloors(raw: string): number | string {
  const v = raw.trim();
  if (!/^\d+$/.test(v)) return "Введите целое число, без букв, дробей и знаков";
  const n = Number(v);
  if (n < 1 || n > FLOORS_MAX) return `Этажность должна быть от 1 до ${FLOORS_MAX}`;
  return n;
}

/** Площадь или текст ошибки. Пробелы между разрядами и запятая допустимы: «12 500,5». */
function parseArea(raw: string): number | string {
  const v = raw.replace(/\s/g, "").replace(",", ".");
  if (!/^-?(\d+(\.\d*)?|\.\d+)$/.test(v)) return "Введите число, например 120 или 85,5";
  const n = Number(v);
  if (n <= 0) return "Площадь должна быть больше нуля";
  if (n > AREA_MAX) return "Площадь не может быть больше 100 000 м²";
  return n;
}

/** Ошибки по полям: пустые поля и значения вне ограничений бэкенда. */
function validate(d: FormDraft): Partial<Record<FieldKey, string>> {
  const errors: Partial<Record<FieldKey, string>> = {};
  for (const { key, missing } of FIELDS) {
    if (isEmpty(d[key])) errors[key] = missing;
  }
  const floors = parseFloors(d.floors);
  if (!errors.floors && typeof floors === "string") errors.floors = floors;
  const area = parseArea(d.building_area_m2);
  if (!errors.building_area_m2 && typeof area === "string") errors.building_area_m2 = area;
  return errors;
}

function toInput(d: FormDraft): { input: FoundationInput; site: SiteConditions } | null {
  const floors = parseFloors(d.floors);
  const area = parseArea(d.building_area_m2);
  if (
    !d.soil_type ||
    !d.bearing_capacity ||
    !d.groundwater_level ||
    typeof floors !== "number" ||
    typeof area !== "number" ||
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

/** Прокрутка к полю и фокус на нём: на выбранном варианте, поле ввода или первом варианте. */
function goToField(key: FieldKey) {
  const el = document.getElementById(fieldId(key));
  if (!el) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
  const target = el.querySelector<HTMLInputElement>("input:checked, input[type=text], input[type=radio]");
  target?.focus({ preventScroll: true });
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
  // Число попыток отправки: после первой показываем и незаполненные поля,
  // каждая следующая заново подсвечивает ошибки.
  const [attempt, setAttempt] = useState(0);
  const errors = validate(draft);
  const ready = toInput(draft);

  const set =
    <K extends keyof FormDraft>(key: K) =>
    (value: FormDraft[K]) =>
      setDraft((d) => ({ ...d, [key]: value }));

  // Неверное значение видно сразу при вводе, незаполненное поле только после попытки отправки.
  const errorOf = (key: FieldKey): string | undefined => {
    if (!errors[key]) return undefined;
    return attempt > 0 || !isEmpty(draft[key]) ? errors[key] : undefined;
  };
  const field = (key: FieldKey) => ({ id: fieldId(key), error: errorOf(key), flash: attempt });

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (!ready) {
      setAttempt((n) => n + 1);
      const first = FIELDS.find(({ key }) => errors[key]);
      if (first) goToField(first.key);
      return;
    }
    setSubmitting(true);
    try {
      const result = await fetchRecommendation(ready.input);
      onCalculated({ ...ready, result });
    } catch (error) {
      onError(error);
    }
  }

  const problems = FIELDS.filter(({ key }) => errors[key]);
  const filled = FIELDS.length - problems.length;

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
                {...field("soil_type")}
                name="soil_type"
                options={SOIL_OPTIONS}
                value={draft.soil_type}
                onChange={set("soil_type")}
                renderIcon={(v) => <SoilIcon soil={v} />}
                columns={5}
              />
              <CardGroup
                label="Несущая способность"
                {...field("bearing_capacity")}
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
                {...field("groundwater_level")}
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
                  {...field("floors")}
                  label="Этажность"
                  value={draft.floors}
                  onChange={set("floors")}
                  min={1}
                  max={FLOORS_MAX}
                  hint={`Целое число от 1 до ${FLOORS_MAX}`}
                />
                <NumberField
                  {...field("building_area_m2")}
                  label="Площадь здания"
                  value={draft.building_area_m2}
                  onChange={set("building_area_m2")}
                  suffix="м²"
                  placeholder="Введите площадь"
                  hint="Больше нуля, до 100 000"
                />
              </div>
              <CardGroup
                label="Материал стен"
                {...field("wall_material")}
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
                {...field("climate")}
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
                {...field("frost_depth")}
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
                {...field("seismicity")}
                name="seismicity"
                options={SEISMICITY_OPTIONS}
                value={draft.seismicity}
                onChange={set("seismicity")}
                renderIcon={(v) => <SeismicIcon level={v} />}
              />
            </div>
          </section>
        </fieldset>

        <footer className="form-footer">
          <div className="min-w-[min(100%,18rem)] flex-1" role="status">
            {attempt > 0 && problems.length > 0 ? (
              <div key={attempt} className="form-issues">
                <p className="form-issues-title">Для расчёта заполните или исправьте:</p>
                <ul className="form-issues-list">
                  {problems.map(({ key, label }) => (
                    <li key={key}>
                      <button type="button" className="issue-chip" onClick={() => goToField(key)}>
                        {label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mono">{ready ? "Все поля заполнены" : `Заполнено ${filled} из ${FIELDS.length}`}</p>
            )}
          </div>
          <button type="submit" className="btn-primary max-sm:w-full" disabled={submitting}>
            {submitting && <Spinner className="h-5 w-5" />}
            {submitting ? "Рассчитываем" : "Рассчитать"}
          </button>
        </footer>
      </form>
    </Shell>
  );
}
