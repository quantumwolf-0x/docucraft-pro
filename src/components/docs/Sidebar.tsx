import { useEffect, useRef } from "react";
import { ChevronRight, Plus, X, Check } from "lucide-react";
import type { MdFile, MdHeading } from "@/lib/markdown-utils";
import { readingMinutes } from "@/lib/markdown-utils";
import type { ProgressMap } from "@/lib/reading-progress";

interface Props {
  files: MdFile[];
  activeFileId: string | null;
  activeHeadingId: string | null;
  progress: ProgressMap;
  // Controlled so expanded/collapsed chapters persist and restore across sessions.
  expanded: Record<string, boolean>;
  onToggleFile: (fileId: string) => void;
  onSelect: (fileId: string, headingId?: string) => void;
  onAddFiles: () => void;
  onRemoveFile: (id: string) => void;
}

export function Sidebar({
  files,
  activeFileId,
  activeHeadingId,
  progress,
  expanded,
  onToggleFile,
  onSelect,
  onAddFiles,
  onRemoveFile,
}: Props) {
  // Progressive disclosure: chapters stay collapsed unless the reader opens
  // them; the current chapter is expanded automatically. This keeps the
  // reader from facing hundreds of headings at once.
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeHeadingId]);

  const total = files.length;
  const done = files.filter((f) => progress[f.name]?.completed).length;

  const renderHeadings = (hs: MdHeading[], depth = 0) => (
    <ul className="space-y-0.5">
      {hs.map((h) => {
        const active = h.id === activeHeadingId;
        return (
          <li key={h.id}>
            <button
              ref={active ? activeRef : null}
              onClick={() => onSelect(h.fileId, h.id)}
              className={`group relative flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-[13px] leading-snug transition-all duration-150 hover:translate-x-0.5 ${
                active
                  ? "font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              style={{ paddingLeft: `${depth * 12 + 14}px` }}
            >
              {active && (
                <span
                  className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r bg-primary"
                  aria-hidden
                />
              )}
              <span className="truncate">{h.text}</span>
            </button>
            {h.children.length > 0 && renderHeadings(h.children, depth + 1)}
          </li>
        );
      })}
    </ul>
  );

  return (
    <aside className="flex h-full flex-col">
      {/* Reading ledger — orientation without percentages */}
      <div className="border-b border-border px-4 py-3.5">
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Documentation
          </span>
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {done} of {total}
          </span>
        </div>
        {total > 1 && (
          <div className="mt-2.5 flex gap-1" aria-hidden>
            {files.map((f) => {
              const completed = progress[f.name]?.completed;
              const current = f.id === activeFileId;
              return (
                <span
                  key={f.id}
                  className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                    completed
                      ? "bg-primary"
                      : current
                        ? "bg-primary/40"
                        : "bg-border"
                  }`}
                />
              );
            })}
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto p-3">
        {files.map((file, i) => {
          const current = file.id === activeFileId;
          const open = expanded[file.id] ?? current;
          const completed = !!progress[file.name]?.completed;
          const mins = readingMinutes(file.content);
          const title = file.name.replace(/\.(md|markdown|mdx|txt)$/i, "");
          return (
            <div key={file.id} className="mb-1.5">
              <div
                className={`group flex items-center gap-1 rounded-lg px-1 transition-colors ${
                  current ? "bg-accent/60" : ""
                }`}
              >
                <button
                  onClick={() => onToggleFile(file.id)}
                  className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-2 text-left"
                >
                  <ChevronRight
                    className={`h-3.5 w-3.5 shrink-0 text-muted-foreground/70 transition-transform ${open ? "rotate-90" : ""}`}
                  />
                  {/* Chapter state marker */}
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px] ${
                      completed
                        ? "border-primary bg-primary text-primary-foreground"
                        : current
                          ? "border-primary text-primary"
                          : "border-muted-foreground/40 text-muted-foreground"
                    }`}
                  >
                    {completed ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : i + 1}
                  </span>
                  <span
                    className={`min-w-0 flex-1 truncate text-[13px] ${
                      current ? "font-semibold text-foreground" : "font-medium text-foreground/80"
                    }`}
                  >
                    {title}
                  </span>
                  <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                    {mins}m
                  </span>
                </button>
                <button
                  onClick={() => onRemoveFile(file.id)}
                  className="mr-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label={`Remove ${title}`}
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
              {open && file.headings.length > 0 && (
                <div className="relative mb-2 mt-0.5 pl-3">
                  {renderHeadings(file.headings)}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-border p-3">
        <button
          onClick={onAddFiles}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-border py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" />
          Add markdown files
        </button>
      </div>
    </aside>
  );
}
