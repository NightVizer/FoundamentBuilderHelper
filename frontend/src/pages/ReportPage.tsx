import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { Calculation } from "../App";
import { downloadEngineeringPdf, postEngineeringReport } from "../api/foundation";
import { Spinner } from "../components/controls";
import { Logo } from "../components/Shell";
import { FOUNDATION_NAMES } from "../options";
import type { EngineeringReport, FoundationType, RiskItem, RiskScope } from "../types/foundation";

const MONTHS = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

const LEVELS: Record<RiskItem["probability"], number> = { низкая: 1, средняя: 2, высокая: 3 };

/** '2026-09-26' → '26 сентября 2026', как в PDF. */
function longDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return month ? `${day} ${MONTHS[month - 1]} ${year}` : iso;
}

/** «Свайный» из «Свайный фундамент» для шапки матрицы. */
function shortName(type: FoundationType): string {
  return FOUNDATION_NAMES[type].split(" ")[0];
}

/** Плашка с подписями колонок и колонки под ней. На узком экране у каждой колонки своя плашка. */
function Split({ labels, children }: { labels: string[]; children: ReactNode[] }) {
  return (
    <div className="rep-split" style={{ "--cols": labels.length } as CSSProperties}>
      <div className="rep-pill rep-pill-row" aria-hidden>
        {labels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div className="rep-cols">
        {children.map((child, i) => (
          <section key={labels[i]}>
            <h4 className="rep-pill rep-pill-single">{labels[i]}</h4>
            {child}
          </section>
        ))}
      </div>
    </div>
  );
}

function SectionTitle({ num, children }: { num: number; children: string }) {
  return (
    <h2 className="rep-section-title">
      <span className="rep-section-num">{num}</span>
      {children}
    </h2>
  );
}

function Gauge({ score }: { score: number }) {
  const value = Math.max(0, Math.min(100, score));
  return (
    <div className="rep-gauge" role="img" aria-label={`Оценка пригодности ${value}%`}>
      <svg viewBox="0 0 120 64">
        <path d="M10 60 A50 50 0 0 1 110 60" fill="none" stroke="#ececf0" strokeWidth="18" />
        <path
          d="M10 60 A50 50 0 0 1 110 60"
          fill="none"
          stroke="var(--coral-strong)"
          strokeWidth="18"
          pathLength={100}
          strokeDasharray={`${value} 100`}
          className="rep-gauge-arc"
          style={{ "--gauge": value } as CSSProperties}
        />
      </svg>
      <span className="rep-gauge-value" aria-hidden>
        {value}%
      </span>
    </div>
  );
}

function Level({ probability }: { probability: RiskItem["probability"] }) {
  const on = LEVELS[probability];
  return (
    <span className="rep-level">
      <span className="rep-level-bars" aria-hidden>
        {[0, 1, 2].map((i) => (
          <i key={i} className={i < on ? "on" : undefined} />
        ))}
      </span>
      {probability}
    </span>
  );
}

function ReportDocument({ report }: { report: EngineeringReport }) {
  const [winner] = report.top3;
  const scores = Object.fromEntries(report.top3.map((t) => [t.type, t.score])) as Record<FoundationType, number>;
  const scopes: RiskScope[] = [...report.top3.map((t) => t.type), "общие"];

  return (
    <article className="rep-doc" aria-label={`Инженерный отчёт № ${report.meta.report_number}`}>
      <span className="rep-orb rep-orb-top" aria-hidden />
      <span className="rep-orb rep-orb-side" aria-hidden />
      <span className="rep-orb rep-orb-bottom" aria-hidden />

      <header className="rep-title-block">
        <h1 className="rep-title">
          <span className="rep-title-light">Выбор типа фундамента</span>
          <span className="rep-title-bold">Отчёт</span>
        </h1>
        <div className="rep-meta">
          <Logo className="rep-logo" />
          <p className="rep-meta-number">Отчёт № {report.meta.report_number}</p>
          <p className="rep-meta-date">{longDate(report.meta.date)}</p>
          <p className="rep-meta-version">Версия {report.meta.version}</p>
        </div>
      </header>

      <section className="rep-section">
        <SectionTitle num={1}>Резюме</SectionTitle>
        <Split labels={["Рекомендованный вариант", "Обоснование выбора"]}>
          {[
            <div key="name">
              <p className="rep-winner-name">{FOUNDATION_NAMES[winner.type]}</p>
              <p className="rep-winner-note">Наибольшая оценка пригодности среди рассмотренных типов</p>
            </div>,
            <p key="reason">{report.summary_reason}</p>,
          ]}
        </Split>
        <div className="rep-scores">
          <Gauge score={winner.score} />
          <ul className="rep-metrics">
            {report.top3.map((item, i) => (
              <li key={item.type} className={i === 0 ? "rep-metric rep-metric-first" : "rep-metric"}>
                <span className="rep-metric-label">{FOUNDATION_NAMES[item.type]}</span>
                <span className="rep-metric-value">{item.score}%</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="rep-section">
        <SectionTitle num={2}>Исходные данные</SectionTitle>
        <Split labels={report.source_data.map((g) => g.title)}>
          {report.source_data.map((group) => (
            <dl key={group.title} className="rep-params">
              {group.rows.map((row) => (
                <div key={row.label}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
          ))}
        </Split>
      </section>

      <section className="rep-section rep-break">
        <SectionTitle num={3}>Сравнительная матрица</SectionTitle>
        <div className="rep-scroll">
          <table className="rep-table rep-matrix">
            <colgroup>
              <col className="rep-col-head" />
              {report.top3.map((t) => (
                <col key={t.type} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th scope="col">Критерий</th>
                {report.top3.map((t, i) => (
                  <th key={t.type} scope="col" className={i === 0 ? "is-winner" : undefined}>
                    {shortName(t.type)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="rep-score-row">
                <th scope="row">Оценка пригодности</th>
                {report.top3.map((t, i) => (
                  <td key={t.type} className={i === 0 ? "is-winner" : undefined}>
                    {t.score}%
                  </td>
                ))}
              </tr>
              {report.matrix.map((row) => (
                <tr key={row.criterion}>
                  <th scope="row">{row.criterion}</th>
                  {report.top3.map((t) => (
                    <td key={t.type}>{row.assessments[t.type]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rep-section">
        <SectionTitle num={4}>Детальный разбор вариантов</SectionTitle>
        {report.review.map((item, i) => (
          <article key={item.type} className="rep-review" aria-labelledby={`review-${item.type}`}>
            <div className="rep-review-head">
              <h3 id={`review-${item.type}`} className="rep-review-name">
                {FOUNDATION_NAMES[item.type]}
                {i === 0 && <span className="rep-tag">Рекомендован</span>}
              </h3>
              <p className="rep-review-score">
                Оценка пригодности <b>{scores[item.type]}%</b>
              </p>
            </div>
            <p className="rep-review-text">{item.applicability}</p>
            <Split labels={["Преимущества", "Недостатки"]}>
              {[
                <ul key="plus" className="rep-points rep-points-plus">
                  {item.advantages.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>,
                <ul key="minus" className="rep-points rep-points-minus">
                  {item.disadvantages.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>,
              ]}
            </Split>
            <p className="rep-conditions">
              <b>Условия применения.</b> {item.conditions}
            </p>
          </article>
        ))}
      </section>

      <section className="rep-section rep-break">
        <SectionTitle num={5}>Риски</SectionTitle>
        <div className="rep-scroll">
          <table className="rep-table rep-risks">
            <thead>
              <tr>
                <th scope="col">Описание</th>
                <th scope="col">Вероятность</th>
                <th scope="col">Последствия</th>
                <th scope="col">Мероприятие по снижению</th>
              </tr>
            </thead>
            {scopes.map((scope) => {
              const group = report.risks.filter((r) => r.scope === scope);
              if (group.length === 0) return null;
              return (
                <tbody key={scope}>
                  <tr className="rep-group-row">
                    <th scope="colgroup" colSpan={4}>
                      {scope === "общие" ? "Общие для площадки" : FOUNDATION_NAMES[scope]}
                    </th>
                  </tr>
                  {group.map((risk) => (
                    <tr key={risk.description}>
                      <td className="rep-risk-desc">{risk.description}</td>
                      <td>
                        <Level probability={risk.probability} />
                      </td>
                      <td>{risk.consequence}</td>
                      <td>{risk.mitigation}</td>
                    </tr>
                  ))}
                </tbody>
              );
            })}
          </table>
        </div>
      </section>

      <section className="rep-section">
        <SectionTitle num={6}>Вывод</SectionTitle>
        <Split labels={["Итог", "Условия применения результатов"]}>
          {[
            <p key="conclusion" className="rep-conclusion">
              {report.conclusion}
            </p>,
            <ul key="conditions" className="rep-conds">
              {report.application_conditions.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>,
          ]}
        </Split>
      </section>
    </article>
  );
}

interface Props {
  calc: Calculation;
  onBack: () => void;
}

type State = { status: "loading" } | { status: "error" } | { status: "ready"; report: EngineeringReport };

export function ReportPage({ calc, onBack }: Props) {
  const { input, result } = calc;
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [pdf, setPdf] = useState<"idle" | "busy" | "error">("idle");

  useEffect(() => {
    let active = true;
    setState({ status: "loading" });
    postEngineeringReport(input, result, { retry: attempt > 0 })
      .then((report) => active && setState({ status: "ready", report }))
      .catch((error) => {
        console.error(error);
        if (active) setState({ status: "error" });
      });
    return () => {
      active = false;
    };
  }, [input, result, attempt]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const download = useCallback(async () => {
    if (state.status !== "ready") return;
    setPdf("busy");
    try {
      await downloadEngineeringPdf(state.report);
      setPdf("idle");
    } catch (error) {
      console.error(error);
      setPdf("error");
    }
  }, [state]);

  return (
    <div className="backdrop report-screen">
      <div className="backdrop-dots no-print" aria-hidden />
      <div className="backdrop-quarter no-print" aria-hidden />

      <header className="report-bar no-print">
        <span className="flex items-center gap-2.5 text-[1.0625rem] font-semibold">
          <Logo />
          Фундамент
        </span>
        <div className="report-actions">
          <button type="button" className="btn-secondary" onClick={onBack}>
            Назад к результатам
          </button>
          <button
            type="button"
            className="btn-primary report-download"
            onClick={download}
            disabled={state.status !== "ready" || pdf === "busy"}
          >
            {pdf === "busy" && <Spinner className="h-5 w-5" />}
            Скачать PDF
          </button>
        </div>
        {pdf === "error" && (
          <p role="alert" className="report-bar-error">
            PDF не сформирован. Нажмите «Скачать PDF» ещё раз.
          </p>
        )}
      </header>

      {state.status === "ready" && <ReportDocument report={state.report} />}

      {state.status === "loading" && (
        <div className="rep-doc rep-placeholder" role="status">
          <Spinner className="h-8 w-8 text-coral-strong" />
          <p className="rep-placeholder-title">Формируем отчёт</p>
          <p className="rep-placeholder-text">Обычно это занимает до минуты.</p>
        </div>
      )}

      {state.status === "error" && (
        <div className="rep-doc rep-placeholder" role="alert">
          <p className="rep-placeholder-title">Отчёт не сформирован</p>
          <p className="rep-placeholder-text">Сервер не вернул разделы отчёта. Повторите запрос.</p>
          <button type="button" className="btn-primary mt-8" onClick={() => setAttempt((n) => n + 1)}>
            Повторить
          </button>
        </div>
      )}
    </div>
  );
}
