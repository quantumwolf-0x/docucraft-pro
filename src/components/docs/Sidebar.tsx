import { useEffect, useRef, useState } from "react";
import { isEditableTarget, hasModKey, modKeyLabel } from "@/lib/keyboard";
import {
  ChevronRight,
  Settings,
  MoreVertical,
  Trash2,
  Pencil,
  GripVertical,
  Check,
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
  FolderOpen,
  Archive,
  Download,
  CheckSquare,
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
 *   file order so drag reordering stays meaningful.
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
  onArchiveFile?: (id: string) => void;
  onDownloadFile?: (id: string) => void;
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
  onArchiveFile,
  onDownloadFile,
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

  // Reorder mode: toggled from any file's three-dots menu. While on, rows in the
  // flat list become draggable and dropping calls onReorderFile. dragIndex is the
  // row being dragged; overIndex is the row currently hovered as a drop target.
  const [reordering, setReordering] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  // Multi-select mode
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelection = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };


  const total = files.length;

  // Recent: files in most-recently-opened order (persisted in IndexedDB as
  // ui.recentFileIds), filtered to those still present in the workspace.
  const activeFiles = files.filter((f) => !f.isArchived);

  const recentFiles = recentFileIds
    .map((id) => activeFiles.find((f) => f.id === id))
    .filter((f): f is MdFile => !!f);

  // Multi-select shortcuts. Read through a ref so the listener isn't torn down
  // and rebuilt on every render just because `activeFiles` is a fresh array.
  const activeFilesRef = useRef(activeFiles);
  activeFilesRef.current = activeFiles;

  useEffect(() => {
    // Only while multi-select is on: outside it, Cmd/Ctrl+A must keep meaning
    // "select all text on the page".
    if (!selecting) return;
    const onKey = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      if (hasModKey(e) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setSelectedIds(new Set(activeFilesRef.current.map((f) => f.id)));
        return;
      }
      if (e.key === "Escape") {
        setSelecting(false);
        setSelectedIds(new Set());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selecting]);

  // Apply the sidebar view (sort → group). Manual reorder is only meaningful
  // against the real file order in a flat list, so it is disabled once a sort
  // is chosen or the list is grouped.
  const kindOf = (f: MdFile) => f.kind ?? getDocumentKind(f.name, f.mimeType);
  const viewActive = view.sort !== "manual" || view.mode !== "all";

  // Drag reorder is only meaningful against the real file order in a flat list,
  // so enabling it forces the view back to manual/All. Disabled entirely when
  // there is nothing to reorder or the parent gave us no reorder handler.
  const canReorder = !!onReorderFile && total > 1;
  const toggleReorder = () => {
    setReordering((on) => {
      const next = !on;
      if (next && viewActive) onView?.(DEFAULT_VIEW);
      if (!next) {
        setDragIndex(null);
        setOverIndex(null);
      }
      return next;
    });
  };

  // If the view leaves the flat manual list while reordering, leave reorder mode
  // so we never drag against a sorted/grouped list that ignores the drop index.
  useEffect(() => {
    if (reordering && viewActive) {
      setReordering(false);
      setDragIndex(null);
      setOverIndex(null);
    }
  }, [reordering, viewActive]);

  const endDrag = () => {
    setDragIndex(null);
    setOverIndex(null);
  };
  const dropOn = (targetIndex: number) => {
    if (dragIndex !== null && dragIndex !== targetIndex) {
      onReorderFile?.(dragIndex, targetIndex);
    }
    endDrag();
  };
  const sorted =
    view.sort === "manual"
      ? activeFiles
      : [...activeFiles].sort((a, b) => {
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
    const dragActive = reordering && !viewActive && realIndex >= 0 && !selecting;
    const isDragging = dragActive && dragIndex === realIndex;
    const isDropTarget = dragActive && overIndex === realIndex && dragIndex !== realIndex;
    return (
      <div key={file.id} className="mb-1.5">
        <div
          draggable={dragActive}
          onDragStart={
            dragActive
              ? (e) => {
                  setDragIndex(realIndex);
                  e.dataTransfer.effectAllowed = "move";
                }
              : undefined
          }
          onDragOver={
            dragActive
              ? (e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setOverIndex(realIndex);
                }
              : undefined
          }
          onDrop={
            dragActive
              ? (e) => {
                  e.preventDefault();
                  dropOn(realIndex);
                }
              : undefined
          }
          onDragEnd={dragActive ? endDrag : undefined}
          className={`group flex items-center gap-1 rounded-lg px-1 transition-colors ${
            current ? "bg-accent/60" : ""
          } ${dragActive ? "cursor-grab active:cursor-grabbing" : ""} ${
            isDragging ? "opacity-40" : ""
          } ${isDropTarget ? "ring-2 ring-primary/60" : ""}`}
        >
          {dragActive && (
            <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden />
          )}
          {selecting && (
            <div className="flex h-6 w-6 shrink-0 items-center justify-center pl-1" onClick={(e) => { e.stopPropagation(); toggleSelection(file.id); }}>
              <input 
                type="checkbox" 
                checked={selectedIds.has(file.id)} 
                onChange={() => toggleSelection(file.id)}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
              />
            </div>
          )}
          <button
            onClick={() => {
              if (selecting) toggleSelection(file.id);
              else onSelect(file.id);
            }}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-md py-2 pl-2 pr-1.5 text-left"
            aria-current={current ? "page" : undefined}
          >
            {!selecting && (
              <KindIcon
                className={`h-3.5 w-3.5 shrink-0 ${
                  current ? "text-primary" : "text-muted-foreground/70"
                }`}
                aria-hidden
              />
            )}
            <span
              className={`min-w-0 flex-1 truncate text-sm ${
                current ? "font-semibold text-foreground" : "font-medium text-foreground/80"
              }`}
            >
              {title}
            </span>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {kind === "markdown" || kind === "text" ? `${mins}m` : null}
            </span>
          </button>
          {!selecting ? (
            <FileMenu
              onRename={() => {
                const newName = window.prompt("Rename file to:", file.name);
                if (newName && newName !== file.name) {
                  onRenameFile(file.id, newName);
                }
              }}
              onDelete={() => onRemoveFile(file.id)}
              onArchive={onArchiveFile ? () => onArchiveFile(file.id) : undefined}
              onDownload={onDownloadFile ? () => onDownloadFile(file.id) : undefined}
              onShowHighlights={
                onShowHighlights && (kind === "markdown" || kind === "text")
                  ? () => onShowHighlights(file.id)
                  : undefined
              }
              reordering={reordering}
              onToggleReorder={canReorder ? toggleReorder : undefined}
              onSelectMode={() => {
                setSelecting(true);
                setSelectedIds(new Set([file.id]));
              }}
            />
          ) : selectedIds.has(file.id) ? (
            <GroupActionMenu
              onArchive={onArchiveFile ? () => {
                selectedIds.forEach((id) => onArchiveFile(id));
                setSelecting(false); setSelectedIds(new Set());
              } : undefined}
              onDownload={onDownloadFile ? () => {
                selectedIds.forEach((id) => onDownloadFile(id));
                setSelecting(false); setSelectedIds(new Set());
              } : undefined}
              onDelete={() => {
                if (window.confirm(`Are you sure you want to delete ${selectedIds.size} selected files?`)) {
                  selectedIds.forEach((id) => onRemoveFile(id));
                  setSelecting(false); setSelectedIds(new Set());
                }
              }}
              onCancel={() => { setSelecting(false); setSelectedIds(new Set()); }}
              onSelectAll={() => setSelectedIds(new Set(activeFiles.map((f) => f.id)))}
              allSelected={selectedIds.size >= activeFiles.length}
            />
          ) : null}
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
          {(onSwitchWorkspace || onOpenPalette) && (
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
              {onSwitchWorkspace && (
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
              )}
              {onOpenPalette && (
                <button
                  onClick={onOpenPalette}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  aria-label="Search docs or ask AI..."
                  title="Search (⌘K)"
                >
                  <Search className="h-4 w-4" />
                </button>
              )}
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
      <div className="mt-3 flex w-full min-w-0 items-center justify-between gap-2 border-b border-border p-3 pt-0">
        <SidebarChips view={view} onView={onView} />
      </div>

      <nav className="flex-1 overflow-y-auto p-3">
        {reordering && !viewActive && (
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-2 text-xs text-primary">
            <GripVertical className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1">Drag files to reorder</span>
            <button
              onClick={toggleReorder}
              className="shrink-0 rounded px-2 py-0.5 text-xs font-semibold hover:bg-primary/15"
            >
              Done
            </button>
          </div>
        )}
        {view.mode === "recent" ? (
          recentFiles.length === 0 ? (
            <p className="px-2 py-4 text-sm text-muted-foreground">No recently opened files.</p>
          ) : (
            recentFiles.map(renderFileRow)
          )
        ) : view.mode === "saved" ? (
          bookmarks.length === 0 ? (
            <p className="px-2 py-4 text-sm text-muted-foreground">No saved items yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {bookmarks.map((bm) => (
                <li
                  key={`${bm.fileId}-${bm.subtopicId}`}
                  className="group flex items-center gap-1 rounded-lg px-1 hover:bg-accent/60"
                >
                  <button
                    onClick={() => onSelect(bm.fileId, bm.subtopicId)}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-md py-2 pl-2 pr-1.5 text-left text-sm font-medium text-foreground/80"
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
                <div className="px-2 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Settings"
          title="Settings"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}

function GroupActionMenu({
  onArchive,
  onDownload,
  onDelete,
  onCancel,
  onSelectAll,
  allSelected,
}: {
  onArchive?: () => void;
  onDownload?: () => void;
  onDelete: () => void;
  onCancel: () => void;
  onSelectAll: () => void;
  allSelected: boolean;
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
        className={`flex h-6 w-6 items-center justify-center rounded text-primary transition-opacity hover:bg-accent hover:text-primary ${open ? "opacity-100" : "opacity-100"}`}
        aria-label="Group options"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-(--z-dropdown) mt-1 w-52 rounded-md border border-border bg-popover p-1 shadow-md">
          {/* Also bound to Cmd/Ctrl+A while multi-select is on; shown here so
              the shortcut is discoverable rather than folklore. */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              onSelectAll();
            }}
            disabled={allSelected}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-foreground hover:bg-accent disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <CheckSquare className="h-3 w-3" />
            Select All
            <kbd className="ml-auto text-[10px] font-medium text-muted-foreground">
              {modKeyLabel}A
            </kbd>
          </button>
          <div className="my-1 h-px bg-border" />
          {onDownload && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                onDownload();
              }}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-foreground hover:bg-accent"
            >
              <Download className="h-3 w-3" />
              Download Selected
            </button>
          )}
          {onArchive && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                onArchive();
              }}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-foreground hover:bg-accent"
            >
              <Archive className="h-3 w-3" />
              Archive Selected
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
            <Trash2 className="h-3 w-3" />
            Delete Selected
          </button>
          <div className="my-1 h-px bg-border" />
          <button
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              onCancel();
            }}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-foreground hover:bg-accent"
          >
            Cancel Selection
          </button>
        </div>
      )}
    </div>
  );
}

function FileMenu({
  onRename,
  onDelete,
  onArchive,
  onDownload,
  onShowHighlights,
  reordering,
  onToggleReorder,
  onSelectMode,
}: {
  onRename: () => void;
  onDelete: () => void;
  onArchive?: () => void;
  onDownload?: () => void;
  onShowHighlights?: () => void;
  reordering?: boolean;
  onToggleReorder?: () => void;
  onSelectMode?: () => void;
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
        <div className="absolute right-0 top-full z-(--z-dropdown) mt-1 w-44 rounded-md border border-border bg-popover p-1 shadow-md">
          {onToggleReorder && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                onToggleReorder();
              }}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-foreground hover:bg-accent"
            >
              {reordering ? <Check className="h-3 w-3" /> : <GripVertical className="h-3 w-3" />}
              {reordering ? "Done reordering" : "Reorder"}
            </button>
          )}
          {onToggleReorder && <div className="my-1 h-px bg-border" />}
          {onSelectMode && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                onSelectMode();
              }}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-foreground hover:bg-accent"
            >
              <CheckSquare className="h-3 w-3" />
              Select
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              onRename();
            }}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-foreground hover:bg-accent"
          >
            <Pencil className="h-3 w-3" />
            Rename
          </button>
          {onDownload && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                onDownload();
              }}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-foreground hover:bg-accent"
            >
              <Download className="h-3 w-3" />
              Download
            </button>
          )}
          {onShowHighlights && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                onShowHighlights();
              }}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-foreground hover:bg-accent"
            >
              <Highlighter className="h-3 w-3" />
              See Highlights
            </button>
          )}
          {onArchive && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                onArchive();
              }}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-foreground hover:bg-accent"
            >
              <Archive className="h-3 w-3" />
              Archive
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
            <Trash2 className="h-3 w-3" />
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
    <div className="flex w-full min-w-0 items-center gap-1.5 overflow-x-auto scrollbar-none [&::-webkit-scrollbar]:hidden">
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
