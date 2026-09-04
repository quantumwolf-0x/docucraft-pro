import { memo, useEffect, useMemo, useRef, useState } from "react";
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
  Folder,
  FolderOpen,
  FolderPlus,
  FolderInput,
  FilePlus,
  Archive,
  Download,
  Upload,
  CheckSquare,
  Share2,
  Hash,
  Table,
  Code,
  Quote,
  List,
  Star,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { splitIntoSubtopics } from "@/lib/markdown-utils";
import type { Highlight } from "@/lib/dom-highlighter";
import { savedTypeLabel, type SavedEntry, type SavedItem } from "@/lib/saved-items";
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

/** Glyph for a saved item, so the Saved list scans by what was starred. */
function savedIcon(item: SavedItem): LucideIcon {
  if (item.kind === "file") return FileText;
  if (item.kind === "section") return Hash;
  switch (item.blockType) {
    case "table":
      return Table;
    case "code":
      return Code;
    case "quote":
      return Quote;
    case "image":
      return FileImage;
    case "list":
      return List;
    default:
      return Star;
  }
}

/** Saved items grouped under the file they came from, newest group first. */
function savedByFile(items: SavedEntry[]): Array<[string, SavedEntry[]]> {
  const groups = new Map<string, SavedEntry[]>();
  for (const item of items) {
    const bucket = groups.get(item.fileName);
    if (bucket) bucket.push(item);
    else groups.set(item.fileName, [item]);
  }
  return [...groups.entries()];
}

/**
 * How the file list is presented in the sidebar.
 * - `mode` is driven by the chip row: All (flat), Grouped (by file type),
 *   or Saved (bookmarks only).
 * - `sort`/`dir` are set from the three-dots menu. `manual` keeps the real
 *   file order so drag reordering stays meaningful.
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

/** The list's three views, in the order the picker offers them. */
const VIEW_MODES: readonly SidebarView["mode"][] = ["all", "grouped", "saved"];
const VIEW_LABEL: Record<SidebarView["mode"], string> = {
  all: "All files",
  grouped: "Grouped",
  saved: "Saved",
};

/** A sidebar folder, as far as the sidebar is concerned. */
export interface SidebarFolder {
  id: string;
  name: string;
}

/**
 * Drag payload for filing a document into a folder. Distinct from the reorder
 * drag (which carries no data) so a folder only accepts real file drags, and a
 * file dragged in from the desktop still reaches the uploader.
 */
const FILE_DND = "application/x-localdox-file";

interface Props {
  files: MdFile[];
  activeFileId: string | null;
  activeHeadingId: string | null;
  expanded: Record<string, boolean>;
  onToggleFile: (fileId: string) => void;
  onSelect: (fileId: string, headingId?: string) => void;
  onAddFiles: () => void;
  onRemoveFile: (id: string) => void;
  onRenameFile: (id: string, newName: string) => void;
  /**
   * Folders the workspace has, flat. Files point at one through `folderId`;
   * anything unfiled stays at the top level under the folder rows.
   */
  folders?: SidebarFolder[];
  /** Create a blank `new.md`, optionally straight inside a folder. */
  onCreateFile?: (folderId?: string | null) => void;
  onCreateFolder?: (name: string) => void;
  onRenameFolder?: (id: string, name: string) => void;
  /** Deleting a folder keeps its documents — they return to the top level. */
  onDeleteFolder?: (id: string) => void;
  onMoveFileToFolder?: (fileId: string, folderId: string | null) => void;
  /** Stars on documents, sections and blocks — the Saved chip. */
  saved: SavedEntry[];
  currentWorkspaceName: string;
  canDeleteWorkspace: boolean;
  onRenameCurrentWorkspace: (name: string) => void;
  onDeleteCurrentWorkspace: () => void;
  onClearStorage: () => void;
  highlights: Highlight[];
  /** Go to a saved item: its file, its page, then the passage itself. */
  onOpenSaved: (item: SavedItem) => void;
  onRemoveSaved: (id: string) => void;
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
  /** Copy a link to one file. The recipient chooses where it lands. */
  onShareFile?: (id: string) => void;
  /** Copy a link to the multi-select batch. */
  onShareFiles?: (ids: string[]) => void;
  /**
   * Docked = the desktop/landscape full-height rail with no app header. It grows
   * a workspace picker, a search field, and a continue-reading card at the top.
   * Undocked (mobile drawer) keeps the compact Ask AI hero layout.
   */
  docked?: boolean;
  onOpenPalette?: () => void;
  onToggleSidebar?: () => void;
}

function SidebarImpl({
  files,
  activeFileId,
  activeHeadingId,
  expanded,
  onToggleFile,
  onSelect,
  onAddFiles,
  onRemoveFile,
  onRenameFile,
  folders = [],
  onCreateFile,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveFileToFolder,
  saved,
  currentWorkspaceName,
  canDeleteWorkspace,
  onRenameCurrentWorkspace,
  onDeleteCurrentWorkspace,
  onClearStorage,
  highlights,
  onOpenSaved,
  onRemoveSaved,
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
  onShareFile,
  onShareFiles,
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

  // Folders start open — a folder the reader just made should show what lands
  // in it — and only the ones they collapse are remembered (for this session).
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  // Folder currently hovered by a file drag, so the drop target is obvious.
  const [dropFolderId, setDropFolderId] = useState<string | null>(null);

  const toggleFolder = (id: string) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const promptNewFolder = () => {
    const name = window.prompt("Folder name:", "New folder");
    if (name && name.trim()) onCreateFolder?.(name.trim());
  };

  // "Create" opens a small File/Folder menu; "view" picks what the list below
  // shows. Both are click-away dropdowns anchored to their own button.
  const [creatingOpen, setCreatingOpen] = useState(false);
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const createRef = useRef<HTMLDivElement>(null);
  const viewMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!creatingOpen && !viewMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!createRef.current?.contains(t)) setCreatingOpen(false);
      if (!viewMenuRef.current?.contains(t)) setViewMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setCreatingOpen(false);
      setViewMenuOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [creatingOpen, viewMenuOpen]);

  const total = files.length;

  const activeFiles = files.filter((f) => !f.isArchived);

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
  // Folders only shape the flat "All" list; Grouped stays grouped by file type,
  // and Recent/Saved are their own orderings.
  const knownFolderIds = new Set(folders.map((f) => f.id));
  const showFolders = view.mode === "all" && folders.length > 0;
  const rootFiles = sorted.filter((f) => !f.folderId || !knownFolderIds.has(f.folderId));
  const listed = showFolders ? rootFiles : sorted;

  /** Drop handlers that file a dragged document into `folderId` (null = top). */
  const dropTargetProps = (folderId: string | null) => {
    if (!onMoveFileToFolder) return {};
    return {
      onDragOver: (e: React.DragEvent) => {
        if (!e.dataTransfer.types.includes(FILE_DND)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move" as const;
        setDropFolderId(folderId);
      },
      onDragLeave: () => setDropFolderId((current) => (current === folderId ? null : current)),
      onDrop: (e: React.DragEvent) => {
        const fileId = e.dataTransfer.getData(FILE_DND);
        setDropFolderId(null);
        if (!fileId) return;
        e.preventDefault();
        e.stopPropagation();
        onMoveFileToFolder(fileId, folderId);
      },
    };
  };

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
      : [{ label: "", items: listed }];

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
    // Outside reorder mode, a row is dragged to file it into a folder instead.
    const folderDragActive =
      !!onMoveFileToFolder && folders.length > 0 && !selecting && !dragActive;
    const isDragging = dragActive && dragIndex === realIndex;
    const isDropTarget = dragActive && overIndex === realIndex && dragIndex !== realIndex;
    return (
      <div key={file.id} className="mb-1.5">
        <div
          draggable={dragActive || folderDragActive}
          onDragStart={
            dragActive
              ? (e) => {
                  setDragIndex(realIndex);
                  e.dataTransfer.effectAllowed = "move";
                }
              : folderDragActive
                ? (e) => {
                    e.dataTransfer.setData(FILE_DND, file.id);
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
          onDragEnd={
            dragActive || folderDragActive
              ? () => {
                  endDrag();
                  setDropFolderId(null);
                }
              : undefined
          }
          className={`group flex items-center gap-1 rounded-xl px-1 transition-colors ${
            current ? "bg-accent" : "hover:bg-accent/50"
          } ${dragActive ? "cursor-grab active:cursor-grabbing" : ""} ${
            isDragging ? "opacity-40" : ""
          } ${isDropTarget ? "ring-2 ring-primary/60" : ""}`}
        >
          {dragActive && (
            <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden />
          )}
          {selecting && (
            <div
              className="flex h-6 w-6 shrink-0 items-center justify-center pl-1"
              onClick={(e) => {
                e.stopPropagation();
                toggleSelection(file.id);
              }}
            >
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
              onNewFile={onCreateFile ? () => onCreateFile(file.folderId ?? null) : undefined}
              onNewFolder={onCreateFolder ? promptNewFolder : undefined}
              folders={folders}
              currentFolderId={file.folderId ?? null}
              onMoveToFolder={
                onMoveFileToFolder ? (folderId) => onMoveFileToFolder(file.id, folderId) : undefined
              }
              onArchive={onArchiveFile ? () => onArchiveFile(file.id) : undefined}
              onDownload={onDownloadFile ? () => onDownloadFile(file.id) : undefined}
              onShare={onShareFile ? () => onShareFile(file.id) : undefined}
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
              onShare={
                onShareFiles
                  ? () => {
                      onShareFiles([...selectedIds]);
                      setSelecting(false);
                      setSelectedIds(new Set());
                    }
                  : undefined
              }
              onArchive={
                onArchiveFile
                  ? () => {
                      selectedIds.forEach((id) => onArchiveFile(id));
                      setSelecting(false);
                      setSelectedIds(new Set());
                    }
                  : undefined
              }
              onDownload={
                onDownloadFile
                  ? () => {
                      selectedIds.forEach((id) => onDownloadFile(id));
                      setSelecting(false);
                      setSelectedIds(new Set());
                    }
                  : undefined
              }
              onDelete={() => {
                if (
                  window.confirm(
                    `Are you sure you want to delete ${selectedIds.size} selected files?`,
                  )
                ) {
                  selectedIds.forEach((id) => onRemoveFile(id));
                  setSelecting(false);
                  setSelectedIds(new Set());
                }
              }}
              onCancel={() => {
                setSelecting(false);
                setSelectedIds(new Set());
              }}
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
          {/* Default header: Title + Search */}
          {(onToggleSidebar || onOpenPalette) && (
            <div className="flex items-center justify-between gap-2 px-3 pt-3">
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
      ) : null}

      {/* The two ways to grow the workspace, side by side in what used to be
          the chip row: bringing in documents you already have, and starting an
          empty one here. Which view the list shows moved to the list header
          below, where it sits next to the thing it filters. */}
      <div className="mt-3 border-b border-border p-3 pt-0">
        <div className="flex w-full min-w-0 items-stretch gap-2">
          {(onCreateFile || onCreateFolder) && (
            <div ref={createRef} className="relative min-w-0 flex-1">
              <button
                onClick={() => setCreatingOpen((o) => !o)}
                aria-expanded={creatingOpen}
                className="flex w-full min-w-0 items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-2 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Plus className="h-4 w-4 shrink-0" />
                <span className="truncate">Create</span>
              </button>

              {creatingOpen && (
                <div className="absolute left-0 top-full z-(--z-dropdown) mt-1 w-40 rounded-md border border-border bg-popover p-1 shadow-md">
                  {onCreateFile && (
                    <button
                      onClick={() => {
                        setCreatingOpen(false);
                        // A file created from here belongs to the workspace
                        // root; the per-folder menus create inside a folder.
                        onCreateFile(null);
                      }}
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-foreground hover:bg-accent"
                    >
                      <FilePlus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      File
                    </button>
                  )}
                  {onCreateFolder && (
                    <button
                      onClick={() => {
                        setCreatingOpen(false);
                        promptNewFolder();
                      }}
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-foreground hover:bg-accent"
                    >
                      <FolderPlus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      Folder
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          <button
            onClick={onAddFiles}
            className="flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-2 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Upload className="h-4 w-4 shrink-0" />
            <span className="truncate">Upload</span>
          </button>
        </div>
      </div>

      {/* What the list shows. This was a row of All / Grouped / Saved chips;
          as a labelled dropdown it says which view is active in words and
          gives the two buttons above it the full width of the sidebar. */}
      {onView && (
        <div ref={viewMenuRef} className="relative px-3 pb-1 pt-3">
          <button
            onClick={() => setViewMenuOpen((o) => !o)}
            aria-expanded={viewMenuOpen}
            className="flex w-full min-w-0 items-center gap-1.5 rounded-md px-1 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
          >
            <span className="truncate">{VIEW_LABEL[view.mode]}</span>
            <ChevronRight
              className={`h-3.5 w-3.5 shrink-0 opacity-60 transition-transform ${
                viewMenuOpen ? "rotate-90" : ""
              }`}
            />
          </button>

          {viewMenuOpen && (
            <div className="absolute left-3 top-full z-(--z-dropdown) mt-1 w-40 rounded-md border border-border bg-popover p-1 shadow-md">
              {VIEW_MODES.map((mode) => (
                <button
                  key={mode}
                  onClick={() => {
                    onView({ ...view, mode });
                    setViewMenuOpen(false);
                  }}
                  aria-pressed={view.mode === mode}
                  className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent ${
                    view.mode === mode ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  <Check
                    className={`h-3.5 w-3.5 shrink-0 ${view.mode === mode ? "" : "opacity-0"}`}
                  />
                  {VIEW_LABEL[mode]}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <nav className="flex-1 overflow-y-auto px-3 pb-3">
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
        {view.mode === "saved" ? (
          saved.length === 0 ? (
            <p className="px-2 py-4 text-sm text-muted-foreground">
              No saved items yet. Star a document, a section, a table or a code block.
            </p>
          ) : (
            savedByFile(saved).map(([fileName, items]) => (
              <div key={fileName} className="mb-3">
                <div className="px-2 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {fileName}
                </div>
                <ul className="space-y-1">
                  {items.map((item) => {
                    const Icon = savedIcon(item);
                    return (
                      <li
                        key={item.id}
                        className="group flex items-start gap-1 rounded-lg px-1 hover:bg-accent/60"
                      >
                        <button
                          onClick={() => onOpenSaved(item)}
                          className="flex min-w-0 flex-1 items-start gap-2 rounded-md py-2 pl-2 pr-1.5 text-left"
                          title={item.text || item.title}
                        >
                          <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-foreground/80">
                              {item.title}
                            </span>
                            <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                              {savedTypeLabel(item)}
                              {item.orphaned && (
                                <span className="text-amber-600 dark:text-amber-400">
                                  · edited away
                                </span>
                              )}
                            </span>
                          </span>
                        </button>
                        <button
                          onClick={() => onRemoveSaved(item.id)}
                          className="mt-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground opacity-100 transition-opacity hover:text-destructive md:opacity-0 md:group-hover:opacity-100"
                          aria-label="Remove saved item"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )
        ) : total === 0 && folders.length === 0 ? null : (
          <>
            {showFolders &&
              folders.map((folder) => {
                const items = sorted.filter((f) => f.folderId === folder.id);
                const collapsed = collapsedFolders.has(folder.id);
                const isDropTarget = dropFolderId === folder.id;
                return (
                  <div
                    key={folder.id}
                    className={`mb-1.5 rounded-lg ${isDropTarget ? "ring-2 ring-primary/60" : ""}`}
                    {...dropTargetProps(folder.id)}
                  >
                    <div className="group flex items-center gap-1 rounded-lg px-1">
                      <button
                        onClick={() => toggleFolder(folder.id)}
                        className="flex min-w-0 flex-1 items-center gap-2 rounded-md py-2 pl-2 pr-1.5 text-left"
                        aria-expanded={!collapsed}
                      >
                        <ChevronRight
                          className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${
                            collapsed ? "" : "rotate-90"
                          }`}
                          aria-hidden
                        />
                        {collapsed ? (
                          <Folder
                            className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70"
                            aria-hidden
                          />
                        ) : (
                          <FolderOpen
                            className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70"
                            aria-hidden
                          />
                        )}
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground/80">
                          {folder.name}
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {items.length}
                        </span>
                      </button>
                      <FolderMenu
                        onNewFile={onCreateFile ? () => onCreateFile(folder.id) : undefined}
                        onNewFolder={onCreateFolder ? promptNewFolder : undefined}
                        onRename={
                          onRenameFolder
                            ? () => {
                                const next = window.prompt("Rename folder to:", folder.name);
                                if (next && next.trim() && next.trim() !== folder.name) {
                                  onRenameFolder(folder.id, next.trim());
                                }
                              }
                            : undefined
                        }
                        onDelete={
                          onDeleteFolder
                            ? () => {
                                if (
                                  items.length === 0 ||
                                  window.confirm(
                                    `Delete "${folder.name}"? Its ${items.length} file${
                                      items.length > 1 ? "s" : ""
                                    } move back to the top level.`,
                                  )
                                ) {
                                  onDeleteFolder(folder.id);
                                }
                              }
                            : undefined
                        }
                      />
                    </div>
                    {!collapsed && (
                      <div className="ml-4 border-l border-border pl-1">
                        {items.length === 0 ? (
                          <p className="px-2 py-2 text-xs text-muted-foreground">
                            Empty — drag a file here.
                          </p>
                        ) : (
                          items.map(renderFileRow)
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            <div {...(showFolders ? dropTargetProps(null) : {})}>
              {groups.map((groupItem) => (
                <div key={groupItem.label || "__all"} className={groupItem.label ? "mb-3" : ""}>
                  {groupItem.label && (
                    <div className="px-2 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {groupItem.label}
                    </div>
                  )}
                  {groupItem.items.map(renderFileRow)}
                </div>
              ))}
            </div>
          </>
        )}
      </nav>

      <div className="flex flex-col gap-1 border-t border-sidebar-border p-2">
        {onSwitchWorkspace && (
          <WorkspaceMenu
            variant="sidebar"
            workspaces={workspaces}
            currentId={currentWorkspaceId ?? null}
            onSwitch={onSwitchWorkspace}
            onNew={(name) => onNewWorkspace?.(name)}
            onDelete={(id) => onDeleteWorkspace?.(id)}
            onImport={(file) => onImportWorkspace?.(file)}
            onExport={() => onExportWorkspace?.()}
            onShare={() => onShareWorkspace?.()}
            onSettings={onOpenSettings}
          />
        )}
      </div>
    </aside>
  );
}

/**
 * The sidebar renders a row per document (and a sub-list per open document), so
 * it is the most expensive thing in the shell after the viewer itself. Memoized
 * so that reading, scrolling, saving and every other app-level state change
 * leaves it alone; `DocsApp` holds its callbacks and derived lists to stable
 * identities to make that hold.
 */
export const Sidebar = memo(SidebarImpl);

function GroupActionMenu({
  onShare,
  onArchive,
  onDownload,
  onDelete,
  onCancel,
  onSelectAll,
  allSelected,
}: {
  onShare?: () => void;
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
          {onShare && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                onShare();
              }}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-foreground hover:bg-accent"
            >
              <Share2 className="h-3 w-3" />
              Share Selected
            </button>
          )}
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
  onNewFile,
  onNewFolder,
  folders = [],
  currentFolderId = null,
  onMoveToFolder,
  onArchive,
  onDownload,
  onShare,
  onShowHighlights,
  reordering,
  onToggleReorder,
  onSelectMode,
}: {
  onRename: () => void;
  onDelete: () => void;
  /** Create a blank document beside this one (same folder). */
  onNewFile?: () => void;
  onNewFolder?: () => void;
  folders?: SidebarFolder[];
  currentFolderId?: string | null;
  onMoveToFolder?: (folderId: string | null) => void;
  onArchive?: () => void;
  onDownload?: () => void;
  onShare?: () => void;
  onShowHighlights?: () => void;
  reordering?: boolean;
  onToggleReorder?: () => void;
  onSelectMode?: () => void;
}) {
  const [open, setOpen] = useState(false);
  // Which nested list is unfolded inside the menu: "New" or "Move to".
  const [submenu, setSubmenu] = useState<"new" | "move" | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) setSubmenu(null);
  }, [open]);

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
        <div className="absolute right-0 top-full z-(--z-dropdown) mt-1 w-52 rounded-md border border-border bg-popover p-1 shadow-md">
          {(onNewFile || onNewFolder) && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSubmenu((s) => (s === "new" ? null : "new"));
                }}
                aria-expanded={submenu === "new"}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-foreground hover:bg-accent"
              >
                <Plus className="h-3 w-3" />
                New
                <ChevronRight
                  className={`ml-auto h-3 w-3 transition-transform ${
                    submenu === "new" ? "rotate-90" : ""
                  }`}
                />
              </button>
              {submenu === "new" && (
                <div className="ml-3 border-l border-border pl-1">
                  {onNewFile && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpen(false);
                        onNewFile();
                      }}
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-foreground hover:bg-accent"
                    >
                      <FilePlus className="h-3 w-3" />
                      New File
                    </button>
                  )}
                  {onNewFolder && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpen(false);
                        onNewFolder();
                      }}
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-foreground hover:bg-accent"
                    >
                      <FolderPlus className="h-3 w-3" />
                      New Folder
                    </button>
                  )}
                </div>
              )}
              <div className="my-1 h-px bg-border" />
            </>
          )}
          {onMoveToFolder && folders.length > 0 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSubmenu((s) => (s === "move" ? null : "move"));
                }}
                aria-expanded={submenu === "move"}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-foreground hover:bg-accent"
              >
                <FolderInput className="h-3 w-3" />
                Move to
                <ChevronRight
                  className={`ml-auto h-3 w-3 transition-transform ${
                    submenu === "move" ? "rotate-90" : ""
                  }`}
                />
              </button>
              {submenu === "move" && (
                <div className="ml-3 max-h-52 overflow-y-auto border-l border-border pl-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpen(false);
                      onMoveToFolder(null);
                    }}
                    disabled={currentFolderId === null}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-foreground hover:bg-accent disabled:opacity-40 disabled:hover:bg-transparent"
                  >
                    <FileText className="h-3 w-3" />
                    Top level
                  </button>
                  {folders.map((folder) => (
                    <button
                      key={folder.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpen(false);
                        onMoveToFolder(folder.id);
                      }}
                      disabled={currentFolderId === folder.id}
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-foreground hover:bg-accent disabled:opacity-40 disabled:hover:bg-transparent"
                    >
                      <Folder className="h-3 w-3" />
                      <span className="truncate">{folder.name}</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="my-1 h-px bg-border" />
            </>
          )}
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
          {onShare && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                onShare();
              }}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-foreground hover:bg-accent"
            >
              <Share2 className="h-3 w-3" />
              Share link
            </button>
          )}
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

/** Three-dots menu on a folder row: create inside it, rename it, delete it. */
function FolderMenu({
  onNewFile,
  onNewFolder,
  onRename,
  onDelete,
}: {
  onNewFile?: () => void;
  onNewFolder?: () => void;
  onRename?: () => void;
  onDelete?: () => void;
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

  const item = (label: string, Icon: LucideIcon, run: () => void, destructive = false) => (
    <button
      onClick={(e) => {
        e.stopPropagation();
        setOpen(false);
        run();
      }}
      className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent ${
        destructive ? "text-destructive hover:bg-accent/50" : "text-foreground"
      }`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  );

  return (
    <div ref={rootRef} className="relative ml-0.5 flex shrink-0 items-center">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-opacity hover:bg-accent hover:text-foreground md:opacity-0 md:group-hover:opacity-100"
        aria-label="Folder options"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-(--z-dropdown) mt-1 w-48 rounded-md border border-border bg-popover p-1 shadow-md">
          {onNewFile && item("New File here", FilePlus, onNewFile)}
          {onNewFolder && item("New Folder", FolderPlus, onNewFolder)}
          {(onNewFile || onNewFolder) && (onRename || onDelete) && (
            <div className="my-1 h-px bg-border" />
          )}
          {onRename && item("Rename folder", Pencil, onRename)}
          {onDelete && item("Delete folder", Trash2, onDelete, true)}
        </div>
      )}
    </div>
  );
}
