import { useEffect, useMemo, useState } from "react";
import type { Calculation } from "../App";
import { fetchExplanations, rankOptions } from "../api/foundation";
import { ScoreRing, Spinner } from "../components/controls";
import { FoundationPicture } from "../components/FoundationPicture";
import { Hero, SectionHeading, Shell } from "../components/Shell";
import { STEP_LABELS, Stepper } from "../components/Stepper";
import {
  BEARING_OPTIONS,
  FOUNDATION_NAMES,
  FOUNDATION_WORDS,
  GROUNDWATER_OPTIONS,
  REGION_OPTIONS,
  SEISMICITY_OPTIONS,
  SOIL_OPTIONS,
  WALL_OPTIONS,
  labelOf,
} from "../options";
import type { Explanation, Explanations, FoundationInput } from "../types/foundation";

const ALT_ITEMS = 3;

const RESULT_STEPS = STEP_LABELS.map((label, i) => ({
  label,
  state: i < STEP_LABELS.length - 1 ? ("done" as const) : ("current" as const),
}));

function floorsWord(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "этаж";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "этажа";
  return "этажей";
}

function describeInput(input: FoundationInput): string {
  const soil = labelOf(SOIL_OPTIONS, input.soil_type);
  const bearing = labelOf(BEARING_OPTIONS, input.bearing_capacity)?.toLowerCase();
  const water = labelOf(GROUNDWATER_OPTIONS, input.groundwater_level)?.toLowerCase();
  const wall = labelOf(WALL_OPTIONS, input.wall_material)?.toLowerCase();
  const region = labelOf(REGION_OPTIONS, input.region);
  const seismic = labelOf(SEISMICITY_OPTIONS, input.seismicity);
  const area = input.building_area_m2.toLocaleString("ru-RU");
  return (
    `${soil}, ${bearing} несущая способность, ${water} уровень грунтовых вод. ` +
    `${input.floors} ${floorsWord(input.floors)}, ${area} м², стены: ${wall}. ` +
    `${region}, сейсмичность ${seismic}.`
  );
}

function Loading() {
  return (
    <div className="flex items-center justify-center gap-3 py-8 text-graphite" role="status">
      <Spinner className="h-6 w-6 text-coral-strong" />
      <span>Готовим описание</span>
    </div>
  );
}

function ItemList({ items, sign, empty }: { items: string[]; sign: "plus" | "minus"; empty: string }) {
  if (items.length === 0) return <p className="text-graphite">{empty}</p>;
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className={sign === "plus" ? "point point-plus" : "point point-minus"}>
          {item}
        </li>
      ))}
    </ul>
  );
}

function ProsCons({ text, limit, wide }: { text: Explanation; limit?: number; wide?: boolean }) {
  const pros = limit ? text.pros.slice(0, limit) : text.pros;
  const cons = limit ? text.cons.slice(0, limit) : text.cons;
  return (
    <div className={wide ? "grid gap-8 sm:grid-cols-2" : "space-y-6"}>
      <section>
        <h4 className="list-title">Плюсы</h4>
        <ItemList items={pros} sign="plus" empty="Не выделены" />
      </section>
      <section>
        <h4 className="list-title">Минусы</h4>
        <ItemList items={cons} sign="minus" empty="Существенных минусов не выявлено" />
      </section>
    </div>
  );
}

interface Props {
  calc: Calculation;
  onNewCalculation: () => void;
  onError: (error: unknown) => void;
}

export function ResultsPage({ calc, onNewCalculation, onError }: Props) {
  const { input, result } = calc;
  const top3 = useMemo(() => rankOptions(result).slice(0, 3), [result]);
  const [texts, setTexts] = useState<Explanations | null>(null);

  useEffect(() => {
    let active = true;
    fetchExplanations(input, result, top3)
      .then((t) => active && setTexts(t))
      .catch((error) => active && onError(error));
    return () => {
      active = false;
    };
  }, [input, result, top3, onError]);

  const [winner, ...alternatives] = top3;
  const winnerText = texts?.[winner.type];

  return (
    <Shell
      stepper={<Stepper steps={RESULT_STEPS} />}
      aside={
        <button type="button" className="btn-secondary" onClick={onNewCalculation}>
          Новый расчёт
        </button>
      }
    >
      <Hero ghost={FOUNDATION_WORDS[winner.type]} title="Результаты подбора">
        {describeInput(input)}
      </Hero>

      <div className="content">
        <article className="winner" aria-labelledby="winner-name">
          <div className="winner-head">
            <div>
              <span className="badge">Наиболее подходящий вариант</span>
              <h2 id="winner-name" className="winner-name">
                {FOUNDATION_NAMES[winner.type]}
              </h2>
              <ScoreRing score={winner.score} primary />
            </div>
            <div className="relative">
              <span className="picture-dot" aria-hidden />
              <FoundationPicture type={winner.type} className="aspect-square" />
            </div>
          </div>
          <div className="card-text">
            {!winnerText ? (
              <Loading />
            ) : (
              <>
                <ProsCons text={winnerText} wide />
                {winnerText.vs_others && (
                  <section className="vs-others">
                    <h3 className="list-title">Чем лучше альтернатив в ваших условиях</h3>
                    <p>{winnerText.vs_others}</p>
                  </section>
                )}
              </>
            )}
          </div>
        </article>

        <section aria-labelledby="alt-heading" className="mt-20">
          <SectionHeading id="alt-heading">Альтернативы</SectionHeading>
          <div className="mt-8 grid gap-x-12 gap-y-14 md:grid-cols-2">
            {alternatives.map((option) => {
              const text = texts?.[option.type];
              return (
                <article key={option.type} aria-labelledby={`alt-${option.type}`}>
                  <FoundationPicture type={option.type} className="aspect-[4/3]" />
                  <div className="mt-6 flex items-center justify-between gap-6">
                    <h3 id={`alt-${option.type}`} className="alt-name">
                      {FOUNDATION_NAMES[option.type]}
                    </h3>
                    <ScoreRing score={option.score} />
                  </div>
                  <div className="card-text">{text ? <ProsCons text={text} limit={ALT_ITEMS} /> : <Loading />}</div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </Shell>
  );
}
