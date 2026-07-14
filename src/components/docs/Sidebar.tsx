import { useEffect, useRef, useState } from "react";
import { ChevronRight, Settings, Check, MoreVertical, Trash2, Pencil, Home, Bookmark, Highlighter } from "lucide-react";
import { splitIntoSubtopics } from "@/lib/markdown-utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { Highlight } from "@/lib/dom-highlighter";
import { Link } from "@tanstack/react-router";
import type { MdFile } from "@/lib/markdown-utils";
import { readingMinutes } from "@/lib/markdown-utils";
import type { ProgressMap } from "@/lib/reading-progress";

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
}: Props) {
  // Progressive disclosure: chapters stay collapsed unless the reader opens
  // them; the current chapter is expanded automatically. This keeps the
  // reader from facing hundreds of headings at once.
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeHeadingId]);

  const total = files.length;

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

  return (
    <aside className="flex h-full flex-col">
      <div className="hidden grid-cols-3 gap-2 border-b border-border p-3 lg:grid md:landscape:grid">
        <Link
          to="/"
          title="Home"
          className="flex flex-col items-center justify-center gap-1 rounded-lg py-2 text-muted-foreground transition-all hover:bg-accent hover:text-foreground"
        >
          <Home className="h-5 w-5" />
          <span className="text-[10px] font-medium leading-none">Home</span>
        </Link>
        <Sheet>
          <SheetTrigger asChild>
            <button
              title="Bookmarks"
              className="flex flex-col items-center justify-center gap-1 rounded-lg py-2 text-muted-foreground transition-all hover:bg-accent hover:text-foreground"
            >
              <Bookmark className="h-5 w-5" />
              <span className="text-[10px] font-medium leading-none">Bookmarks</span>
            </button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[400px] sm:max-w-[450px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Bookmarks</SheetTitle>
            </SheetHeader>
            <div className="mt-6 flex flex-col gap-3">
              {bookmarks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No bookmarks yet.</p>
              ) : (
                bookmarks.map((bm) => (
                  <div key={`${bm.fileId}-${bm.subtopicId}`} className="group flex items-center justify-between rounded-lg border p-3">
                    <button
                      onClick={() => onSelect(bm.fileId, bm.subtopicId)}
                      className="flex-1 text-left text-sm hover:underline"
                    >
                      {bm.name}
                    </button>
                    <button
                      onClick={() => onRemoveBookmark(bm.fileId, bm.subtopicId)}
                      className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity p-2"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </SheetContent>
        </Sheet>



        <Link
          to="/settings"
          title="Settings"
          className="flex flex-col items-center justify-center gap-1 rounded-lg py-2 text-muted-foreground transition-all hover:bg-accent hover:text-foreground"
        >
          <Settings className="h-5 w-5" />
          <span className="text-[10px] font-medium leading-none">Settings</span>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto p-3">
        {files.map((file, i) => {
          const current = file.id === activeFileId;
          const open = expanded[file.id] ?? current;
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
                <FileMenu
                  onRename={() => {
                    const newName = window.prompt("Rename file to:", file.name);
                    if (newName && newName !== file.name) {
                      onRenameFile(file.id, newName);
                    }
                  }}
                  onDelete={() => onRemoveFile(file.id)}
                />
              </div>
              {open && (file.subtopics || splitIntoSubtopics(file.content, file.name))?.length > 0 && (
                <div className="relative mb-2 mt-0.5 pl-3">
                  {renderSubtopics(file.subtopics || splitIntoSubtopics(file.content, file.name), file.id)}
                </div>
              )}
            </div>
          );
        })}
      </nav>

    </aside>
  );
}

function FileMenu({ onRename, onDelete }: { onRename: () => void; onDelete: () => void }) {
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
        <div className="absolute right-0 top-full z-50 mt-1 w-32 rounded-md border border-border bg-popover p-1 shadow-md">
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

