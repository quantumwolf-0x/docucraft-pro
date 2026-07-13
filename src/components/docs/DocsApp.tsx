import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpen, Menu, Moon, Sun, X, Search, Focus, Monitor } from "lucide-react";
import { DropZone } from "./DropZone";
import { Sidebar } from "./Sidebar";
import { MarkdownViewer } from "./MarkdownViewer";
import { CommandPalette } from "./CommandPalette";
import type { MdFile } from "@/lib/markdown-utils";
import { parseHeadings } from "@/lib/markdown-utils";

type Theme = "light" | "dark" | "system";

export function DocsApp() {
  const [files, setFiles] = useState<MdFile[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null);
  const [scrollTarget, setScrollTarget] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>("system");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [highlightQuery, setHighlightQuery] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const addFiles = useCallback(async (fileList: File[]) => {
    const parsed: MdFile[] = await Promise.all(
      fileList.map(async (f) => {
        const content = await f.text();
        const id = `${f.name}-${crypto.randomUUID().slice(0, 8)}`;
        return { id, name: f.name, content, headings: parseHeadings(content, id) };
      }),
    );
    setFiles((prev) => [...prev, ...parsed]);
    setActiveFileId((cur) => cur ?? parsed[0]?.id ?? null);
  }, []);

  const handleFileInput = (list: FileList | null) => {
    if (!list) return;
    const files = Array.from(list).filter((f) => /\.(md|markdown|mdx|txt)$/i.test(f.name));
    if (files.length) addFiles(files);
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

  const cycleTheme = () => setTheme((t) => (t === "system" ? "light" : t === "light" ? "dark" : "system"));

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
          focusMode={focusMode}
          onToggleFocus={() => setFocusMode((f) => !f)}
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
        focusMode={focusMode}
        onToggleFocus={() => setFocusMode((f) => !f)}
      />

      <CommandPalette
        files={files}
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onSelect={handleSelect}
      />

      <div className="flex">
        {!focusMode && (
          <div className="sticky top-16 hidden h-[calc(100dvh-4rem)] w-72 shrink-0 border-r border-border md:block">
            <Sidebar
              files={files}
              activeFileId={activeFileId}
              activeHeadingId={activeHeadingId}
              onSelect={handleSelect}
              onAddFiles={() => inputRef.current?.click()}
              onRemoveFile={removeFile}
            />
          </div>
        )}

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
              focusMode={focusMode}
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
  focusMode,
  onToggleFocus,
}: {
  theme: Theme;
  onCycleTheme: () => void;
  onMenu: (() => void) | null;
  hideMenu?: boolean;
  onOpenPalette: () => void;
  hasFiles: boolean;
  focusMode: boolean;
  onToggleFocus: () => void;
}) {
  const ThemeIcon = theme === "dark" ? Sun : theme === "light" ? Moon : Monitor;
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md md:px-6">
      {!hideMenu && (
        <button
          onClick={() => onMenu?.()}
          className="rounded-md p-2 hover:bg-accent md:hidden"
          aria-label="Menu"
        >
          <Menu className="h-4 w-4" />
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
          className="ml-4 hidden min-w-[240px] items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground md:flex"
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
              onClick={onToggleFocus}
              className={`rounded-md p-2 transition-colors hover:bg-accent ${focusMode ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
              aria-label="Toggle focus mode"
              title="Focus mode"
            >
              <Focus className="h-4 w-4" />
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
