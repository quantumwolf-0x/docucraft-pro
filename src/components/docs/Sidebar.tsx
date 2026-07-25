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
  Sparkles,
  Search,
  PanelLeft,
  FileText,
  FileType,
  FileSpreadsheet,
  FileJson,
  FileImage,
  FileVideo,
  FileAudio,
  Presentation,
  Globe,
  File as FileIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { splitIntoSubtopics } from "@/lib/markdown-utils";
import type { Highlight } from "@/lib/dom-highlighter";
import type { MdFile, DocumentKind } from "@/lib/markdown-utils";
import { readingMinutes } from "@/lib/markdown-utils";
import { fileLabel, getDocumentKind } from "@/lib/document-utils";
import { WorkspaceMenu } from "./WorkspaceMenu";

// Arc-style "favicon" per file type — a small colored glyph that anchors each
// row so the list scans by shape, not just text.
const KIND_ICON: Partial<Record<DocumentKind, LucideIcon>> = {
  markdown: FileText,
  text: FileText,
  docx: FileType,
  pdf: FileType,
  spreadsheet: FileSpreadsheet,
  csv: FileSpreadsheet,
  json: FileJson,
  presentation: Presentation,
  "google-doc": Globe,
  "google-slide": Globe,
  html: Globe,
  image: FileImage,
  video: FileVideo,
  audio: FileAudio,
};

function kindIcon(kind: DocumentKind): LucideIcon {
  return KIND_ICON[kind] ?? FileIcon;
}

/**
 * How the file list is presented in the sidebar.
 * - `mode` is driven by the chip row: All (flat), Recent (most-recently
 *   opened), Grouped (by file type), or Saved (bookmarks only).
 * - `sort`/`dir` are set from the three-dots menu. `manual` keeps the real
 *   file order so drag/Move Up-Down reordering stays meaningful.
 */
export type SidebarView = {
  sort: "manual" | "name" | "date";
  dir: "asc" | "desc";
  mode: "all" | "recent" | "grouped" | "saved";
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
  /** File ids in most-recently-opened order — drives the "Recent" chip. */
  recentFileIds: string[];
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
  /** Open the Ask AI panel. When omitted, the Ask AI button is hidden. */
  onAskAi?: () => void;
  onNewWorkspace?: (name?: string) => void;
  onImportWorkspace?: (file: File) => void;
  onExportWorkspace?: () => void;
  onShareWorkspace?: () => void;
  theme?: string;
  onCycleTheme?: () => void;
  workspaces?: { id: string; name: string }[];
  currentWorkspaceId?: string | null;
  onSwitchWorkspace?: (id: string) => void;
  onDeleteWorkspace?: (id: string) => void;
  /**
   * Docked = the desktop/landscape full-height rail with no app header. It grows
   * a workspace picker, a search field, and a continue-reading card at the top.
   * Undocked (mobile drawer) keeps the compact Ask AI hero layout.
   */
  docked?: boolean;
  onOpenPalette?: () => void;
  onToggleSidebar?: () => void;
}

export function Sidebar({
  files,
  activeFileId,
  activeHeadingId,
  recentFileIds,
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
  onAskAi,
  onNewWorkspace,
  onImportWorkspace,
  onExportWorkspace,
  onShareWorkspace,
  workspaces = [],
  currentWorkspaceId,
  onSwitchWorkspace,
  onDeleteWorkspace,
  docked = false,
  onOpenPalette,
  onToggleSidebar,
}: Props) {
  // Progressive disclosure: chapters stay collapsed unless the reader opens
  // them; the current chapter is expanded automatically. This keeps the
  // reader from facing hundreds of headings at once.
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeHeadingId]);

  const total = files.length;

  // Recent: files in most-recently-opened order (persisted in IndexedDB as
  // ui.recentFileIds), filtered to those still present in the workspace.
  const recentFiles = recentFileIds
    .map((id) => files.find((f) => f.id === id))
    .filter((f): f is MdFile => !!f);

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



  const renderFileRow = (file: MdFile) => {
    const realIndex = files.indexOf(file);
    const current = file.id === activeFileId;
    const open = expanded[file.id] ?? current;
    const kind = kindOf(file);
    const KindIcon = kindIcon(kind);
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

          <button
            onClick={() => onSelect(file.id)}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-md py-2 pl-2 pr-1.5 text-left"
            aria-current={current ? "page" : undefined}
          >
            <KindIcon
              className={`h-3.5 w-3.5 shrink-0 ${
                current ? "text-primary" : "text-muted-foreground/70"
              }`}
              aria-hidden
            />
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
      </div>
    );
  };

  return (
    <aside className="flex h-full flex-col">
      {docked ? (
        <>
          {/* Workspace picker replaces the removed app header: Localdox logo,
              workspace name, and doc count, opening the workspace menu. */}
          {onSwitchWorkspace && (
            <div className="flex items-center gap-1 px-3 pt-3">
              {onToggleSidebar && (
                <button
                  onClick={onToggleSidebar}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  aria-label="Toggle sidebar"
                  title="Toggle sidebar"
                >
                  <PanelLeft className="h-4 w-4" />
                </button>
              )}
              <WorkspaceMenu
                variant="sidebar"
                docCount={total}
                workspaces={workspaces}
                currentId={currentWorkspaceId ?? null}
                onSwitch={onSwitchWorkspace}
                onNew={(name) => onNewWorkspace?.(name)}
                onDelete={(id) => onDeleteWorkspace?.(id)}
                onImport={(file) => onImportWorkspace?.(file)}
                onExport={() => onExportWorkspace?.()}
                onShare={() => onShareWorkspace?.()}
              />
            </div>
          )}

          {/* Search trigger — opens the command palette (docs + Ask AI). */}
          {onOpenPalette && (
            <div className="px-3 pt-3">
              <button
                onClick={onOpenPalette}
                className="flex w-full items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              >
                <Search className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate text-left text-xs">Search docs or ask AI...</span>
                <span className="flex shrink-0 items-center gap-1">
                  <kbd className="rounded border border-border bg-background px-1 py-0.5 font-mono text-[10px]">
                    ⌘
                  </kbd>
                  <kbd className="rounded border border-border bg-background px-1 py-0.5 font-mono text-[10px]">
                    K
                  </kbd>
                </span>
              </button>
            </div>
          )}
        </>
      ) : (
        // Ask AI is the mobile-drawer hero action, pinned Arc-style at the top.
        onAskAi && (
          <div className="p-3 pb-0">
            <button
              onClick={onAskAi}
              className="group flex w-full items-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-3 py-2.5 text-sm font-semibold text-primary transition-colors hover:border-primary/40 hover:bg-primary/15"
            >
              <Sparkles className="h-4 w-4 shrink-0 transition-transform group-hover:scale-110" />
              <span className="flex-1 text-left">Ask AI</span>
              <ChevronRight className="h-4 w-4 shrink-0 opacity-40 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        )
      )}

      {/* Chip row: switches the file list between All / Grouped / Saved. */}
      <div className="mt-3 flex w-full min-w-0 items-center border-b border-border p-3 pt-0">
        <SidebarChips view={view} onView={onView} />
      </div>

      <nav className="flex-1 overflow-y-auto p-3">
        {view.mode === "recent" ? (
          recentFiles.length === 0 ? (
            <p className="px-2 py-4 text-[13px] text-muted-foreground">No recently opened files.</p>
          ) : (
            recentFiles.map(renderFileRow)
          )
        ) : view.mode === "saved" ? (
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
 * between All (flat), Recent (most-recently opened), Grouped (by file type),
 * and Saved (bookmarks). Shared by the desktop header and the mobile chip row.
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
    ["recent", "Recent"],
    ["grouped", "Grouped"],
    ["saved", "Saved"],
  ] as const;

  return (
    <div className="flex w-full min-w-0 items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
