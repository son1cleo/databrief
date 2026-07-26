interface DatasetTextPreviewProps {
  charCount: number;
  wordCount: number;
  preview: string;
}

export function DatasetTextPreview({ charCount, wordCount, preview }: DatasetTextPreviewProps) {
  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="mb-1 text-[10px] uppercase tracking-wide text-text-muted">Words</div>
          <div className="text-xl font-semibold">{wordCount.toLocaleString()}</div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="mb-1 text-[10px] uppercase tracking-wide text-text-muted">Characters</div>
          <div className="text-xl font-semibold">{charCount.toLocaleString()}</div>
        </div>
      </div>
      <div className="rounded-xl border border-border bg-surface p-4">
        <p className="whitespace-pre-wrap text-sm text-text-muted">{preview || "No preview available."}</p>
      </div>
    </div>
  );
}
