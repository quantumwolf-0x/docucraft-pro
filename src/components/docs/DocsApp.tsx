import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import {
  BookOpen,
  Menu,
  Moon,
  Sun,
  X,
  Search,
  Plus,
 
  Monitor,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { DropZone } from "./DropZone";
import { Sidebar } from "./Sidebar";
import { MarkdownViewer } from "./MarkdownViewer";
import { CommandPalette } from "./CommandPalette";
import type { MdFile } from "@/lib/markdown-utils";
import { parseHeadings, readingMinutes } from "@/lib/markdown-utils";
import { useReadingProgress, pickResume } from "@/lib/reading-progress";

type Theme = "light" | "dark" | "system";

const SIDEBAR_MIN = 220;
const SIDEBAR_MAX = 480;
const SIDEBAR_DEFAULT = 288;
const SIDEBAR_WIDTH_KEY = "docucraft:sidebarWidth";

const clampWidth = (w: number) => Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, w));

function loadSidebarWidth(): number {
  if (typeof localStorage === "undefined") return SIDEBAR_DEFAULT;
  const v = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY));
  return v >= SIDEBAR_MIN && v <= SIDEBAR_MAX ? v : SIDEBAR_DEFAULT;
}

export function DocsApp() {
  const [files, setFiles] = useState<MdFile[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null);
  const [scrollTarget, setScrollTarget] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>("system");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(loadSidebarWidth);
  const [highlightQuery, setHighlightQuery] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sidebarWrapRef = useRef<HTMLDivElement>(null);
  const sidebarInnerRef = useRef<HTMLDivElement>(null);
  // Latest width, read imperatively by the collapse animation and the drag
  // handler so neither fights React's render cycle over the wrapper's width.
  const widthRef = useRef(sidebarWidth);
  const firstCollapseRun = useRef(true);
  const { map: progress, recordScroll, touch } = useReadingProgress();

  useEffect(() => {
    widthRef.current = sidebarWidth;
  }, [sidebarWidth]);

  // Collapse/expand the desktop sidebar; the main column is flex-1, so animating
  // the sidebar width lets content reflow frame-by-frame (Lovable/Linear-style)
  // rather than snapping. Width is driven imperatively (never via a React style
  // prop) so a re-render can't clobber the tween mid-flight.
  useEffect(() => {
    const wrap = sidebarWrapRef.current;
    if (!wrap) return;
    const target = sidebarCollapsed ? 0 : widthRef.current;
    if (firstCollapseRun.current) {
      gsap.set(wrap, { width: target });
      firstCollapseRun.current = false;
    } else {
      gsap.to(wrap, { width: target, duration: 0.45, ease: "power3.inOut" });
    }
    if (sidebarInnerRef.current) {
      gsap.to(sidebarInnerRef.current, {
        opacity: sidebarCollapsed ? 0 : 1,
        x: sidebarCollapsed ? -16 : 0,
        duration: sidebarCollapsed ? 0.25 : 0.4,
        ease: "power2.out",
      });
    }
  }, [sidebarCollapsed]);

  // Drag the right edge to resize; commit the final width to localStorage.
  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = widthRef.current;
    const onMove = (ev: MouseEvent) => {
      const w = clampWidth(startW + (ev.clientX - startX));
      widthRef.current = w;
      if (sidebarWrapRef.current) sidebarWrapRef.current.style.width = `${w}px`;
      setSidebarWidth(w);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      try {
        localStorage.setItem(SIDEBAR_WIDTH_KEY, String(widthRef.current));
      } catch {
        /* storage unavailable — width stays for this session only */
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const isDark = theme === "dark" || (theme === "system" && mq.matches);
      document.documentElement.classList.toggle("dark", isDark);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);

  const addFiles = useCallback(
    async (fileList: File[]) => {
      const parsed: MdFile[] = await Promise.all(
        fileList.map(async (f) => {
          const content = await f.text();
          const id = `${f.name}-${crypto.randomUUID().slice(0, 8)}`;
          return { id, name: f.name, content, headings: parseHeadings(content, id) };
        }),
      );
      setFiles((prev) => [...prev, ...parsed]);
      // Resume the chapter the reader last stopped on, if any; else start at one.
      setActiveFileId((cur) => {
        if (cur) return cur;
        const resumeName = pickResume(
          parsed.map((f) => f.name),
          progress,
        );
        const resume = resumeName ? parsed.find((f) => f.name === resumeName) : null;
        return (resume ?? parsed[0])?.id ?? null;
      });
    },
    [progress],
  );

  const handleFileInput = (list: FileList | null) => {
    if (!list) return;
    const picked = Array.from(list).filter((f) => /\.(md|markdown|mdx|txt)$/i.test(f.name));
    if (picked.length) addFiles(picked);
  };

  const activeFile = files.find((f) => f.id === activeFileId) ?? null;
  const activeIdx = activeFile ? files.findIndex((f) => f.id === activeFile.id) : -1;
  const prevFile = activeIdx > 0 ? files[activeIdx - 1] : null;
  const nextFile = activeIdx >= 0 && activeIdx < files.length - 1 ? files[activeIdx + 1] : null;

  const handleSelect = (fileId: string, headingId?: string, query?: string) => {
    setActiveFileId(fileId);
    if (query !== undefined) setHighlightQuery(query || null);
    if (headingId) {
      window.location.hash = headingId;
      setScrollTarget(headingId);
      setTimeout(() => setScrollTarget(null), 100);
    } else {
      setScrollTarget(null);
      window.location.hash = "";
    }
    setDrawerOpen(false);
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
    if (activeFileId === id) {
      setActiveFileId(files.find((f) => f.id !== id)?.id ?? null);
    }
  };

  const handleContentChange = useCallback((fileId: string, content: string) => {
    setFiles((prev) =>
      prev.map((f) =>
        f.id === fileId ? { ...f, content, headings: parseHeadings(content, fileId) } : f,
      ),
    );
  }, []);

  useEffect(() => {
    if (!activeFile) return;
    const hash = window.location.hash.slice(1);
    if (hash) {
      setScrollTarget(hash);
      setTimeout(() => setScrollTarget(null), 100);
    }
  }, [activeFileId]);

  // Record that this chapter is the one currently being read (reading memory).
  useEffect(() => {
    if (activeFile) touch(activeFile.name);
  }, [activeFileId, activeFile, touch]);

  const cycleTheme = () =>
    setTheme((t) => (t === "system" ? "light" : t === "light" ? "dark" : "system"));

  // Chapter = file. Derive the reading-orientation facts the UI needs.
  const totalChapters = files.length;
  const completedCount = files.filter((f) => progress[f.name]?.completed).length;
  const activeComplete = activeFile ? !!progress[activeFile.name]?.completed : false;
  const allComplete = totalChapters > 0 && completedCount === totalChapters;
  const nextReadingMin = nextFile ? readingMinutes(nextFile.content) : null;

  const handleReadProgress = useCallback(
    (pct: number) => {
      if (activeFile) recordScroll(activeFile.name, pct);
    },
    [activeFile, recordScroll],
  );

  if (files.length === 0) {
    return (
      <div className="min-h-dvh bg-background">
        <Header
          theme={theme}
          onCycleTheme={cycleTheme}
          onMenu={null}
          hideMenu
          onOpenPalette={() => setPaletteOpen(true)}
          hasFiles={false}
          onAddFiles={() => inputRef.current?.click()}
        />
        <DropZone onFiles={addFiles} fullscreen />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background">
      <Header
        theme={theme}
        onCycleTheme={cycleTheme}
        onMenu={() => setDrawerOpen(true)}
        onOpenPalette={() => setPaletteOpen(true)}
        hasFiles
        onAddFiles={() => inputRef.current?.click()}
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed((c) => !c)}
      />

      <CommandPalette
        files={files}
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onSelect={handleSelect}
      />

      <div className="flex">
        <div
          ref={sidebarWrapRef}
          className="sticky top-16 hidden h-[calc(100dvh-4rem)] shrink-0 overflow-hidden border-r border-border md:block"
        >
          <div ref={sidebarInnerRef} className="h-full" style={{ width: sidebarWidth }}>
            <Sidebar
              files={files}
              activeFileId={activeFileId}
              activeHeadingId={activeHeadingId}
              progress={progress}
              onSelect={handleSelect}
              onAddFiles={() => inputRef.current?.click()}
              onRemoveFile={removeFile}
            />
          </div>
          {!sidebarCollapsed && (
            <div
              onMouseDown={startResize}
              onDoubleClick={() => {
                widthRef.current = SIDEBAR_DEFAULT;
                setSidebarWidth(SIDEBAR_DEFAULT);
                if (sidebarWrapRef.current)
                  sidebarWrapRef.current.style.width = `${SIDEBAR_DEFAULT}px`;
                try {
                  localStorage.setItem(SIDEBAR_WIDTH_KEY, String(SIDEBAR_DEFAULT));
                } catch {
                  /* ignore */
                }
              }}
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize sidebar (double-click to reset)"
              title="Drag to resize · double-click to reset"
              className="group absolute right-0 top-0 z-20 h-full w-1.5 cursor-col-resize"
            >
              <span className="absolute right-0 top-0 h-full w-px bg-transparent transition-colors group-hover:bg-primary/50" />
            </div>
          )}
        </div>

        {drawerOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div
              className="absolute inset-0 bg-foreground/20 backdrop-blur-sm"
              onClick={() => setDrawerOpen(false)}
            />
            <div className="absolute left-0 top-0 h-full w-80 max-w-[85vw] border-r border-border bg-background shadow-2xl animate-in slide-in-from-left duration-200">
              <div className="flex h-14 items-center justify-between border-b border-border px-4">
                <span className="text-sm font-semibold">Documentation</span>
                <button onClick={() => setDrawerOpen(false)} aria-label="Close">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="h-[calc(100%-3.5rem)]">
                <Sidebar
                  files={files}
                  activeFileId={activeFileId}
                  activeHeadingId={activeHeadingId}
                  progress={progress}
                  onSelect={handleSelect}
                  onAddFiles={() => inputRef.current?.click()}
                  onRemoveFile={removeFile}
                />
              </div>
            </div>
          </div>
        )}

        <main className="min-w-0 flex-1">
          {activeFile && (
            <MarkdownViewer
              file={activeFile}
              prevFile={prevFile}
              nextFile={nextFile}
              onNavFile={(id) => handleSelect(id)}
              onActiveHeading={setActiveHeadingId}
              scrollTargetId={scrollTarget}
              highlightQuery={highlightQuery}
              onContentChange={handleContentChange}
              chapterNumber={activeIdx + 1}
              totalChapters={totalChapters}
              isComplete={activeComplete}
              allComplete={allComplete}
              nextReadingMin={nextReadingMin}
              onReadProgress={handleReadProgress}
            />
          )}
        </main>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".md,.markdown,.mdx,.txt,text/markdown"
        className="hidden"
        onChange={(e) => handleFileInput(e.target.files)}
      />
    </div>
  );
}

function Header({
  theme,
  onCycleTheme,
  onMenu,
  hideMenu,
  onOpenPalette,
  hasFiles,
  onAddFiles,
  sidebarCollapsed,
  onToggleSidebar,
}: {
  theme: Theme;
  onCycleTheme: () => void;
  onMenu: (() => void) | null;
  hideMenu?: boolean;
  onOpenPalette: () => void;
  hasFiles: boolean;
  onAddFiles: () => void;
  sidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}) {
  const ThemeIcon = theme === "dark" ? Sun : theme === "light" ? Moon : Monitor;
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md md:px-6">
      {!hideMenu && (
        <button
          onClick={() => onMenu?.()}
          className="rounded-md p-2 transition-transform hover:bg-accent active:scale-90 md:hidden"
          aria-label="Menu"
        >
          <Menu className="h-4 w-4" />
        </button>
      )}
      {onToggleSidebar && (
        <button
          onClick={onToggleSidebar}
          className="hidden rounded-md p-2 text-muted-foreground transition-all hover:bg-accent hover:text-foreground active:scale-90 md:inline-flex"
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      )}
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground text-background">
          <BookOpen className="h-4 w-4" />
        </div>
        <span className="text-sm font-semibold tracking-tight">Markdown Docs</span>
      </div>

      {hasFiles && (
        <button
          onClick={onOpenPalette}
          className="ml-4 hidden min-w-60 items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground md:flex"
        >
          <Search className="h-3.5 w-3.5" />
          <span>Search documentation…</span>
          <span className="ml-auto flex items-center gap-1">
            <kbd className="rounded border border-border bg-background px-1 py-0.5 font-mono text-[10px]">
              ⌘
            </kbd>
            <kbd className="rounded border border-border bg-background px-1 py-0.5 font-mono text-[10px]">
              K
            </kbd>
          </span>
        </button>
      )}

      <div className="ml-auto flex items-center gap-1">
        {hasFiles && (
          <>
            <button
              onClick={onOpenPalette}
              className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:hidden"
              aria-label="Search"
            >
              <Search className="h-4 w-4" />
            </button>
            <button
              onClick={onAddFiles}
              className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Add files"
              title="Add files"
            >
              <Plus className="h-4 w-4" />
            </button>
          </>
        )}
        <button
          onClick={onCycleTheme}
          className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label={`Theme: ${theme}`}
          title={`Theme: ${theme}`}
        >
          <ThemeIcon className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
