import { useEffect, useRef, useState } from "react";
import {
  ChevronRight,
  Settings,
  MoreVertical,
  Trash2,
  Pencil,
  ArrowUp,
  ArrowDown,
  Plus,
  Highlighter,
} from "lucide-react";
import { splitIntoSubtopics } from "@/lib/markdown-utils";
import type { Highlight } from "@/lib/dom-highlighter";
import type { MdFile } from "@/lib/markdown-utils";
import { readingMinutes } from "@/lib/markdown-utils";
import { fileLabel, getDocumentKind } from "@/lib/document-utils";
import type { ProgressMap } from "@/lib/reading-progress";

/**
 * How the file list is presented in the sidebar.
 * - `mode` is driven by the chip row: All (flat), Grouped (by file type),
 *   or Saved (bookmarks only).
 * - `sort`/`dir` are set from the three-dots menu. `manual` keeps the real
 *   file order so drag/Move Up-Down reordering stays meaningful.
 */
export type SidebarView = {
  sort: "manual" | "name" | "date";
  dir: "asc" | "desc";
  mode: "all" | "grouped" | "saved";
};
export const DEFAULT_VIEW: SidebarView = {
  sort: "manual",
  dir: "asc",
  mode: "all",
};

interface Props {
  files: MdFile[];
  activeFileId: string | null;
  activeHeadingId: string | null;
  progress: ProgressMap;
  expanded: Record<string, boolean>;
  onToggleFile: (fileId: string) => void;
  onSelect: (fileId: string, headingId?: string) => void;
  onAddFiles: () => void;
  onRemoveFile: (id: string) => void;
  onRenameFile: (id: string, newName: string) => void;
  bookmarks: { fileId: string; subtopicId: string; name: string }[];
  currentWorkspaceName: string;
  canDeleteWorkspace: boolean;
  onRenameCurrentWorkspace: (name: string) => void;
  onDeleteCurrentWorkspace: () => void;
  onClearStorage: () => void;
  highlights: Highlight[];
  onRemoveBookmark: (fileId: string, subtopicId: string) => void;
  onRemoveHighlight: (id: string) => void;
  /** Open the isolated "highlights only" view for a file (text-based only). */
  onShowHighlights?: (fileId: string) => void;
  onReorderFile?: (oldIndex: number, newIndex: number) => void;
  onSortByName?: () => void;
  view?: SidebarView;
  onView?: (view: SidebarView) => void;
  onOpenSettings: () => void;
  onNewWorkspace?: (name?: string) => void;
  onImportWorkspace?: (file: File) => void;
  onExportWorkspace?: () => void;
  onShareWorkspace?: () => void;
  theme?: string;
  onCycleTheme?: () => void;
  workspaces?: { id: string; name: string }[];
  currentWorkspaceId?: string | null;
  onSwitchWorkspace?: (id: string) => void;
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
  onRenameFile,
  bookmarks,
  currentWorkspaceName,
  canDeleteWorkspace,
  onRenameCurrentWorkspace,
  onDeleteCurrentWorkspace,
  onClearStorage,
  highlights,
  onRemoveBookmark,
  onRemoveHighlight,
  onShowHighlights,
  onReorderFile,
  onSortByName,
  view = DEFAULT_VIEW,
  onView,
  onOpenSettings,
  onNewWorkspace,
  onImportWorkspace,
  onExportWorkspace,
  onShareWorkspace,
  workspaces = [],
  currentWorkspaceId,
  onSwitchWorkspace,
}: Props) {
  // Progressive disclosure: chapters stay collapsed unless the reader opens
  // them; the current chapter is expanded automatically. This keeps the
  // reader from facing hundreds of headings at once.
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeHeadingId]);

  const total = files.length;

  // Apply the sidebar view (sort → group). Manual reorder is only meaningful
  // against the real file order in a flat list, so it is disabled once a sort
  // is chosen or the list is grouped.
  const kindOf = (f: MdFile) => f.kind ?? getDocumentKind(f.name, f.mimeType);
  const viewActive = view.sort !== "manual" || view.mode !== "all";
  const sorted =
    view.sort === "manual"
      ? files
      : [...files].sort((a, b) => {
          const base =
            view.sort === "name"
              ? a.name.localeCompare(b.name)
              : (a.addedAt ?? 0) - (b.addedAt ?? 0);
          return base * (view.dir === "desc" ? -1 : 1);
        });
  const groups =
    view.mode === "grouped"
      ? Array.from(
          sorted
            .reduce((map, f) => {
              const label = fileLabel(kindOf(f));
              const bucket = map.get(label) ?? [];
              bucket.push(f);
              map.set(label, bucket);
              return map;
            }, new Map<string, MdFile[]>())
            .entries(),
        ).map(([label, items]) => ({ label, items }))
      : [{ label: "", items: sorted }];

  const renderSubtopics = (subtopics: any[], fileId: string) => (
    <ul className="space-y-0.5">
      {subtopics.map((chunk) => {
        const active = activeFileId === fileId && activeHeadingId === chunk.id;
        return (
          <li key={chunk.id}>
            <button
              onClick={() => onSelect(fileId, chunk.id)}
              className={`group relative flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-[13px] leading-snug transition-all duration-150 hover:translate-x-0.5 ${
                active
                  ? "font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              style={{ paddingLeft: "14px" }}
            >
              {active && (
                <span
                  className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r bg-primary"
                  aria-hidden
                />
              )}
              <span className="truncate">{chunk.title}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );

  const renderFileRow = (file: MdFile) => {
    const realIndex = files.indexOf(file);
    const current = file.id === activeFileId;
    const open = expanded[file.id] ?? current;
    const kind = kindOf(file);
    const mins = readingMinutes(file.content);
    const title = file.name.replace(
      /\.(md|markdown|mdx|txt|docx|pdf|xlsx|xls|csv|json|ppt|pptx|gdoc|gslides)$/i,
      "",
    );
    return (
      <div key={file.id} className="mb-1.5">
        <div
          className={`group flex items-center gap-1 rounded-lg px-1 transition-colors ${
            current ? "bg-accent/60" : ""
          }`}
        >
          {["presentation", "pdf", "csv", "json", "image"].includes(kind) ? (
            <div className="h-8 w-5 shrink-0" />
          ) : (
            <button
              onClick={() => onToggleFile(file.id)}
              className="flex h-8 w-5 shrink-0 items-center justify-center rounded-md text-muted-foreground/70 transition-colors hover:bg-accent hover:text-foreground"
              aria-label={`${open ? "Collapse" : "Expand"} ${title}`}
            >
              <ChevronRight
                className={`h-3.5 w-3.5 shrink-0 text-muted-foreground/70 transition-transform ${open ? "rotate-90" : ""}`}
              />
            </button>
          )}
          <button
            onClick={() => onSelect(file.id)}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-md py-2 pr-1.5 text-left"
            aria-current={current ? "page" : undefined}
          >
            <span
              className={`min-w-0 flex-1 truncate text-[13px] ${
                current ? "font-semibold text-foreground" : "font-medium text-foreground/80"
              }`}
            >
              {title}
            </span>
            <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
              {kind === "markdown" || kind === "text" ? `${mins}m` : null}
            </span>
          </button>
          <FileMenu
            onRename={() => {
              const newName = window.prompt("Rename file to:", file.name);
              if (newName && newName !== file.name) {
                onRenameFile(file.id, newName);
              }
            }}
            onDelete={() => onRemoveFile(file.id)}
            onShowHighlights={
              onShowHighlights && (kind === "markdown" || kind === "text")
                ? () => onShowHighlights(file.id)
                : undefined
            }
            onMoveUp={
              !viewActive && realIndex > 0 && onReorderFile
                ? () => onReorderFile(realIndex, realIndex - 1)
                : undefined
            }
            onMoveDown={
              !viewActive && realIndex < files.length - 1 && onReorderFile
                ? () => onReorderFile(realIndex, realIndex + 1)
                : undefined
            }
          />
        </div>
        {open && (file.subtopics || splitIntoSubtopics(file.content, file.name))?.length > 0 && (
          <div className="relative mb-2 mt-0.5 pl-3">
            {renderSubtopics(file.subtopics || splitIntoSubtopics(file.content, file.name), file.id)}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside className="flex h-full flex-col">
      {/* Chip row: switches the file list between All / Grouped / Saved. */}
      <div className="flex items-center border-b border-border p-3">
        <SidebarChips view={view} onView={onView} />
      </div>

      <nav className="flex-1 overflow-y-auto p-3">
        {view.mode === "saved" ? (
          bookmarks.length === 0 ? (
            <p className="px-2 py-4 text-[13px] text-muted-foreground">No saved items yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {bookmarks.map((bm) => (
                <li
                  key={`${bm.fileId}-${bm.subtopicId}`}
                  className="group flex items-center gap-1 rounded-lg px-1 hover:bg-accent/60"
                >
                  <button
                    onClick={() => onSelect(bm.fileId, bm.subtopicId)}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-md py-2 pl-2 pr-1.5 text-left text-[13px] font-medium text-foreground/80"
                  >
                    <span className="min-w-0 flex-1 truncate">{bm.name}</span>
                  </button>
                  <button
                    onClick={() => onRemoveBookmark(bm.fileId, bm.subtopicId)}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground opacity-100 transition-opacity hover:text-destructive md:opacity-0 md:group-hover:opacity-100"
                    aria-label="Remove bookmark"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : total === 0 ? null : (
          groups.map((groupItem) => (
            <div key={groupItem.label || "__all"} className={groupItem.label ? "mb-3" : ""}>
              {groupItem.label && (
                <div className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {groupItem.label}
                </div>
              )}
              {groupItem.items.map(renderFileRow)}
            </div>
          ))
        )}
      </nav>

      <div className="flex gap-2 border-t border-border p-3">
        <button
          onClick={onAddFiles}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          <span>Add more files</span>
        </button>
        <button
          onClick={onOpenSettings}
          className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Settings"
          title="Settings"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}

function FileMenu({
  onRename,
  onDelete,
  onShowHighlights,
  onMoveUp,
  onMoveDown,
}: {
  onRename: () => void;
  onDelete: () => void;
  onShowHighlights?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative ml-0.5 flex shrink-0 items-center">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className={`flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-opacity hover:bg-accent hover:text-foreground ${open ? "opacity-100" : "opacity-100 md:opacity-0 md:group-hover:opacity-100"}`}
        aria-label="Options"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-md border border-border bg-popover p-1 shadow-md">
          {onMoveUp && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                onMoveUp();
              }}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-foreground hover:bg-accent"
            >
              <ArrowUp className="h-3.5 w-3.5" />
              Move Up
            </button>
          )}
          {onMoveDown && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                onMoveDown();
              }}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-foreground hover:bg-accent"
            >
              <ArrowDown className="h-3.5 w-3.5" />
              Move Down
            </button>
          )}
          {(onMoveUp || onMoveDown) && <div className="my-1 h-px bg-border" />}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              onRename();
            }}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-foreground hover:bg-accent"
          >
            <Pencil className="h-3.5 w-3.5" />
            Rename
          </button>
          {onShowHighlights && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                onShowHighlights();
              }}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-foreground hover:bg-accent"
            >
              <Highlighter className="h-3.5 w-3.5" />
              See Highlights
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              onDelete();
            }}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-destructive hover:bg-accent/50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * The chip row that replaces the workspace name: switches the file list
 * between All (flat), Grouped (by file type), and Saved (bookmarks). Shared
 * by the desktop header and the mobile chip row.
 */
function SidebarChips({
  view = DEFAULT_VIEW,
  onView,
}: {
  view?: SidebarView;
  onView?: (view: SidebarView) => void;
}) {
  const chips = [
    ["all", "All"],
    ["grouped", "Grouped"],
    ["saved", "Saved"],
  ] as const;

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {chips.map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onView?.({ ...view, mode: key })}
          aria-pressed={view.mode === key}
          className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
            view.mode === key
              ? "border-primary/50 bg-transparent text-primary"
              : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
