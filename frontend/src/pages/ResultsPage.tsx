import { useEffect, useMemo, useState } from "react";
import type { Calculation } from "../App";
import { fetchExplanations, postEngineeringReport, rankOptions } from "../api/foundation";
import { PileLoader, ScoreRing } from "../components/controls";
import { FoundationIllustration } from "../components/icons";
import { Hero, SectionHeading, Shell } from "../components/Shell";
import { useInView } from "../motion";
import {
  BEARING_OPTIONS,
  CLIMATE_OPTIONS,
  FOUNDATION_NAMES,
  FOUNDATION_WORDS,
  FROST_OPTIONS,
  GROUNDWATER_OPTIONS,
  SEISMICITY_OPTIONS,
  SOIL_OPTIONS,
  WALL_OPTIONS,
  labelOf,
} from "../options";
import type { Explanation, Explanations, FoundationInput, FoundationType, SiteConditions } from "../types/foundation";

const ALT_ITEMS = 3;

function floorsWord(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "этаж";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "этажа";
  return "этажей";
}

function describeInput(input: FoundationInput, site: SiteConditions): string {
  const soil = labelOf(SOIL_OPTIONS, input.soil_type);
  const bearing = labelOf(BEARING_OPTIONS, input.bearing_capacity)?.toLowerCase();
  const water = labelOf(GROUNDWATER_OPTIONS, input.groundwater_level)?.toLowerCase();
  const wall = labelOf(WALL_OPTIONS, input.wall_material)?.toLowerCase();
  const climate = labelOf(CLIMATE_OPTIONS, site.climate)?.toLowerCase();
  const frost = labelOf(FROST_OPTIONS, site.frost_depth)?.toLowerCase();
  const seismic = labelOf(SEISMICITY_OPTIONS, input.seismicity);
  const area = input.building_area_m2.toLocaleString("ru-RU");
  return (
    `${soil}, ${bearing} несущая способность, ${water} уровень грунтовых вод. ` +
    `${input.floors} ${floorsWord(input.floors)}, ${area} м², стены: ${wall}. ` +
    `Климат ${climate}, промерзание ${frost}, сейсмичность ${seismic}.`
  );
}

/** Модель фундамента собирается по деталям, когда сцена показалась на экране. */
function FoundationArt({ type, primary, className }: { type: FoundationType; primary?: boolean; className: string }) {
  const [ref, built] = useInView<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={`fnd-stage ${primary ? "fnd-stage-primary" : ""} ${built ? "is-built" : ""} ${className}`}
      role="img"
      aria-label={FOUNDATION_NAMES[type]}
    >
      <FoundationIllustration type={type} />
    </div>
  );
}

function Loading() {
  return (
    <div className="flex items-center justify-center gap-3 py-8 text-graphite" role="status">
      <PileLoader className="h-6 w-7 text-coral-strong" />
      <span>Готовим описание</span>
    </div>
  );
}

function ItemList({ items, sign, empty }: { items: string[]; sign: "plus" | "minus"; empty: string }) {
  if (items.length === 0) return <p className="text-graphite">{empty}</p>;
  return (
    <ul className="space-y-1">
      {items.map((item, i) => (
        <li
          key={i}
          className={sign === "plus" ? "point point-plus" : "point point-minus"}
          style={{ ["--i" as string]: i }}
        >
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
    <div className={wide ? "grid gap-4 sm:grid-cols-2" : "space-y-3"}>
      <section className={`${wide ? "pc-panel" : "pc-soft"} pc-plus`}>
        <h4 className="list-title">Плюсы</h4>
        <ItemList items={pros} sign="plus" empty="Не выделены" />
      </section>
      <section className={`${wide ? "pc-panel" : "pc-soft"} pc-minus`}>
        <h4 className="list-title">Минусы</h4>
        <ItemList items={cons} sign="minus" empty="Существенных минусов не выявлено" />
      </section>
    </div>
  );
}

type ReportStatus = "loading" | "ready" | "error";

const REPORT_STATUS_TEXT: Record<ReportStatus, string> = {
  loading: "Отчёт формируется",
  ready: "Отчёт готов",
  error: "Отчёт не сформирован, повторите на странице отчёта",
};

/** Миниатюра листов отчёта: верхний лист с дугой оценки и строками, под ним ещё два. */
function ReportPages() {
  return (
    <div className="teaser-pages" aria-hidden>
      <span className="teaser-page teaser-page-back" />
      <span className="teaser-page teaser-page-mid" />
      <span className="teaser-page teaser-page-front">
        <svg viewBox="0 0 120 150" className="h-full w-full">
          <rect x="14" y="16" width="44" height="6" rx="3" fill="var(--ink)" />
          <rect x="14" y="27" width="28" height="4" rx="2" fill="#d6d6dc" />
          <path d="M22 78 A26 26 0 0 1 74 78" fill="none" stroke="#ececf0" strokeWidth="9" />
          <path
            className="teaser-gauge"
            d="M22 78 A26 26 0 0 1 74 78"
            fill="none"
            stroke="var(--coral-strong)"
            strokeWidth="9"
            pathLength={100}
            strokeDasharray="82 100"
          />
          <rect x="84" y="58" width="22" height="5" rx="2.5" fill="var(--coral-strong)" />
          <rect x="84" y="68" width="22" height="5" rx="2.5" fill="var(--ink)" />
          <rect x="84" y="78" width="22" height="5" rx="2.5" fill="#d6d6dc" />
          {[96, 108, 120].map((y) => (
            <rect key={y} x="14" y={y} width="92" height="7" rx="3.5" fill="#f0f0f3" />
          ))}
        </svg>
      </span>
    </div>
  );
}

/** Переход к инженерному отчёту: светлая панель с миниатюрой листов и статусом формирования. */
function ReportTeaser({ status, onOpen }: { status: ReportStatus; onOpen: () => void }) {
  const [ref, visible] = useInView<HTMLElement>();
  return (
    <section ref={ref} className={`report-teaser ${visible ? "is-visible" : ""}`} aria-labelledby="report-teaser-title">
      <ReportPages />
      <div className="report-teaser-body">
        <h2 id="report-teaser-title" className="report-teaser-title">
          Отчёт для инженера<span className="text-coral">.</span>
        </h2>
        <p className="report-teaser-text">
          Исходные данные, сравнительная матрица по пяти критериям, разбор трёх вариантов, риски и вывод. Можно скачать
          в PDF.
        </p>
        <div className="report-teaser-actions">
          <button type="button" className="teaser-btn" onClick={onOpen}>
            Открыть отчёт
          </button>
          <p className={`teaser-status teaser-status-${status}`} role="status">
            {status === "loading" && <PileLoader className="h-4 w-5 text-coral-strong" />}
            {status !== "loading" && <span className="teaser-status-dot" aria-hidden />}
            {REPORT_STATUS_TEXT[status]}
          </p>
        </div>
      </div>
    </section>
  );
}

interface Props {
  calc: Calculation;
  onNewCalculation: () => void;
  onOpenReport: () => void;
  onError: (error: unknown) => void;
}

export function ResultsPage({ calc, onNewCalculation, onOpenReport, onError }: Props) {
  const { input, result, site } = calc;
  const top3 = useMemo(() => rankOptions(result).slice(0, 3), [result]);
  const [texts, setTexts] = useState<Explanations | null>(null);
  const [reportStatus, setReportStatus] = useState<ReportStatus>("loading");

  useEffect(() => {
    let active = true;
    fetchExplanations(input, result, top3)
      .then((t) => active && setTexts(t))
      .catch((error) => active && onError(error));
    return () => {
      active = false;
    };
  }, [input, result, top3, onError]);

  // Запрос B стартует вместе с /analyze; ошибка показывается на странице отчёта, а не общим экраном.
  useEffect(() => {
    let active = true;
    postEngineeringReport(input, result)
      .then(() => active && setReportStatus("ready"))
      .catch(() => active && setReportStatus("error"));
    return () => {
      active = false;
    };
  }, [input, result]);

  // Страница открывается сверху, а не на прокрутке формы: иначе сборка лучшего варианта пройдёт за экраном.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const [winner, ...alternatives] = top3;
  const winnerText = texts?.[winner.type];

  return (
    <Shell
      aside={
        <button type="button" className="btn-secondary" onClick={onNewCalculation}>
          Новый расчёт
        </button>
      }
    >
      <Hero ghost={FOUNDATION_WORDS[winner.type]} title="Результаты подбора">
        {describeInput(input, site)}
      </Hero>

      <div className="content">
        <article className="winner" aria-labelledby="winner-name">
          <div className="winner-head">
            <div>
              <span className="badge">
                <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0" aria-hidden>
                  <circle cx="10" cy="10" r="10" fill="#fff" />
                  <path
                    className="badge-check"
                    d="M5.8 10.4 L8.6 13.1 L14.2 7.3"
                    pathLength={1}
                    fill="none"
                    stroke="var(--coral-strong)"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Наиболее подходящий вариант
              </span>
              <h2 id="winner-name" className="winner-name">
                {FOUNDATION_NAMES[winner.type]}
              </h2>
            </div>
            <div className="relative">
              <span className="picture-dot" aria-hidden />
              <FoundationArt type={winner.type} primary className="aspect-square" />
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

        <section aria-labelledby="alt-heading" className="mx-auto mt-20 max-w-[62rem]">
          <SectionHeading id="alt-heading">Альтернативы</SectionHeading>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {alternatives.map((option) => {
              const text = texts?.[option.type];
              return (
                <article key={option.type} className="alt-card" aria-labelledby={`alt-${option.type}`}>
                  <FoundationArt type={option.type} className="aspect-[4/3]" />
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

        <ReportTeaser status={reportStatus} onOpen={onOpenReport} />
      </div>
    </Shell>
  );
}
