interface Props {
  text: string;
  onExport?: () => void;
}

export function ReportView({ text, onExport }: Props) {
  return (
    <section className="rounded-xl border bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">Технико-экономическое обоснование</h2>
        {onExport && (
          <button
            type="button"
            onClick={onExport}
            className="rounded-lg border px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            Скачать .txt
          </button>
        )}
      </div>
      <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-800">{text}</pre>
    </section>
  );
}
