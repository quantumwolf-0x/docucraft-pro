import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, Expand, Home, LoaderCircle, Pause, Play, X } from "lucide-react";
import { toast } from "sonner";
import { MermaidAnimator, type MermaidAnimator as MermaidAnimatorInstance } from "mermaid-animator";

// mermaid's erDiagram lexer reserves words like CLASS. Keep the existing
// compatibility fallback, but only apply it after the unmodified source fails.
function quoteErEntities(src: string): string {
  const q = (token: string) => (/^".*"$/.test(token) ? token : `"${token}"`);
  return src
    .split("\n")
    .map((line) => {
      const rel = line.match(/^(\s*)([\w".:-]+)(\s+)(\S*--\S*)(\s+)([\w".:-]+)(\s*:\s*.*)$/);
      if (!rel) return line;
      return rel[1] + q(rel[2]) + rel[3] + rel[4] + rel[5] + q(rel[6]) + rel[7];
    })
    .join("\n");
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function baseName(name: string) {
  return name.replace(/\.(mmd|mermaid|md|markdown)$/i, "") || "diagram";
}

export function Mermaid({ code, name = "diagram" }: { code: string; name?: string }) {
  const [fullscreen, setFullscreen] = useState(false);
  const [dark, setDark] = useState(
    () => typeof document !== "undefined" && document.documentElement.classList.contains("dark"),
  );
  const [renderError, setRenderError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"gif" | "webm" | "svg" | null>(null);
  const source = code.trim();

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => setDark(root.classList.contains("dark")));
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  // A syntax error removes the stage. Clear it when the source or theme changes
  // so editing the diagram immediately gets a fresh render attempt.
  useEffect(() => setRenderError(null), [source, dark]);

  useEffect(() => {
    if (!fullscreen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setFullscreen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [fullscreen]);

  const exportDiagram = useCallback(
    async (format: "gif" | "webm" | "svg") => {
      if (!source || exporting) return;
      setExporting(format);
      const theme = dark ? "dark" : "light";
      try {
        const exporter = await import("mermaid-animator/export");
        if (format === "gif") {
          const bytes = await exporter.exportGif(source, { theme, width: 1200, height: 800 });
          // `gifenc` exposes ArrayBufferLike in its declaration even though the
          // browser result is bytes. Copying gives Blob the concrete ArrayBuffer
          // view its DOM type requires (and keeps SharedArrayBuffer out).
          download(
            new Blob([Uint8Array.from(bytes)], { type: "image/gif" }),
            `${baseName(name)}.gif`,
          );
        } else if (format === "webm") {
          const blob = await exporter.exportVideo(source, { theme, width: 1200, height: 800 });
          download(blob, `${baseName(name)}.webm`);
        } else {
          const svg = await exporter.exportSvg(source, { theme });
          download(new Blob([svg], { type: "image/svg+xml" }), `${baseName(name)}.svg`);
        }
        toast.success(`Downloaded animated Mermaid as ${format.toUpperCase()}`);
      } catch (error) {
        toast.error(`Could not export ${format.toUpperCase()}`, {
          description: error instanceof Error ? error.message : "The browser could not encode it.",
        });
      } finally {
        setExporting(null);
      }
    },
    [dark, exporting, name, source],
  );

  if (!source) {
    return (
      <div className="my-6 flex min-h-40 items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 text-sm text-muted-foreground">
        Add Mermaid source to preview the animation.
      </div>
    );
  }

  const exportControls = (
    <>
      <IconBtn onClick={() => void exportDiagram("gif")} label="Download animated GIF">
        {exporting === "gif" ? (
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Download className="h-3.5 w-3.5" />
        )}
        <span className="text-[10px] font-semibold">GIF</span>
      </IconBtn>
      <IconBtn onClick={() => void exportDiagram("webm")} label="Download WebM video">
        {exporting === "webm" ? (
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Download className="h-3.5 w-3.5" />
        )}
        <span className="text-[10px] font-semibold">WEBM</span>
      </IconBtn>
      <IconBtn onClick={() => void exportDiagram("svg")} label="Download current frame as SVG">
        {exporting === "svg" ? (
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Download className="h-3.5 w-3.5" />
        )}
        <span className="text-[10px] font-semibold">SVG</span>
      </IconBtn>
    </>
  );

  return (
    <>
      <div className="my-6 overflow-hidden rounded-xl border border-border bg-muted/30">
        {renderError ? (
          <MermaidError error={renderError} />
        ) : (
          <AnimatorStage
            code={source}
            dark={dark}
            onError={setRenderError}
            controls={
              <>
                {exportControls}
                <IconBtn onClick={() => setFullscreen(true)} label="Fullscreen">
                  <Expand className="h-3.5 w-3.5" />
                </IconBtn>
              </>
            }
          />
        )}
      </div>

      {fullscreen &&
        createPortal(
          <div className="fixed inset-0 z-(--z-overlay) flex items-center justify-center p-0 sm:p-4">
            <div
              className="absolute inset-0 bg-foreground/30 backdrop-blur-sm"
              onClick={() => setFullscreen(false)}
              aria-hidden
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Animated Mermaid diagram"
              className="relative flex h-full w-full flex-col overflow-hidden border-border bg-card shadow-2xl sm:h-[92vh] sm:max-w-[min(1600px,95vw)] sm:rounded-2xl sm:border"
            >
              <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border px-4 sm:px-6">
                <div>
                  <h1 className="text-sm font-semibold text-foreground">{baseName(name)}</h1>
                  <p className="text-[11px] text-muted-foreground">Animated Mermaid</p>
                </div>
                <div className="flex items-center gap-1">
                  {exportControls}
                  <IconBtn onClick={() => setFullscreen(false)} label="Close diagram">
                    <X className="h-4 w-4" />
                  </IconBtn>
                </div>
              </header>
              <div className="min-h-0 flex-1">
                <AnimatorStage code={source} dark={dark} fill onError={setRenderError} />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function AnimatorStage({
  code,
  dark,
  fill,
  controls,
  onError,
}: {
  code: string;
  dark: boolean;
  fill?: boolean;
  controls?: React.ReactNode;
  onError: (message: string | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const animatorRef = useRef<MermaidAnimatorInstance | null>(null);
  const renderChainRef = useRef<Promise<void>>(Promise.resolve());
  const renderGenerationRef = useRef(0);
  const ownerGenerationRef = useRef(0);
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const generation = ++renderGenerationRef.current;
    let disposed = false;
    setLoading(true);
    setPaused(false);
    onError(null);
    const create = async () => {
      const options = {
        theme: dark ? "dark" : "light",
        pan: true,
        zoom: true,
        inspect: true,
        minZoom: 0.2,
        maxZoom: 8,
        mermaid: { securityLevel: "loose", fontFamily: "ui-sans-serif, system-ui, sans-serif" },
      } as const;
      try {
        let animator: MermaidAnimatorInstance;
        try {
          animator = await MermaidAnimator.create(container, code, options);
        } catch (error) {
          const alternative = /^\s*(?:---[\s\S]*?---\s*)?erDiagram\b/.test(code)
            ? quoteErEntities(code)
            : code;
          if (alternative === code) throw error;
          animator = await MermaidAnimator.create(container, alternative, options);
        }
        if (disposed || generation !== renderGenerationRef.current) {
          animator.destroy();
          return;
        }
        animatorRef.current = animator;
        ownerGenerationRef.current = generation;
        if (fill) requestAnimationFrame(() => animator.fitToView());
        setLoading(false);
      } catch (error) {
        if (!disposed) {
          setLoading(false);
          onError(error instanceof Error ? error.message : "Failed to render diagram");
        }
      }
    };
    // React Strict Mode mounts effects twice in development. MermaidAnimator
    // mutates and clears its container, so two overlapping create() calls can
    // let the stale instance erase the live one. Serialize renders per stage;
    // a superseded generation is cleaned up before the next one starts.
    renderChainRef.current = renderChainRef.current
      .catch(() => undefined)
      .then(async () => {
        if (!disposed) await create();
      });
    return () => {
      disposed = true;
      if (ownerGenerationRef.current === generation) {
        animatorRef.current?.destroy();
        animatorRef.current = null;
        ownerGenerationRef.current = 0;
      }
    };
  }, [code, dark, fill, onError]);

  const togglePlayback = () => {
    const animator = animatorRef.current;
    if (!animator) return;
    if (animator.isPaused()) animator.resume();
    else animator.pause();
    setPaused(animator.isPaused());
  };

  return (
    <div className="group/stage relative h-full w-full">
      <div
        className={`absolute z-10 flex items-center gap-1 ${fill ? "bottom-4 right-4" : "right-2 top-2 opacity-0 transition-opacity group-hover/stage:opacity-100 [@media(hover:none)]:opacity-100"}`}
      >
        <IconBtn onClick={togglePlayback} label={paused ? "Play animation" : "Pause animation"}>
          {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
        </IconBtn>
        <IconBtn onClick={() => animatorRef.current?.fitToView()} label="Fit diagram">
          <Home className="h-3.5 w-3.5" />
        </IconBtn>
        {controls}
      </div>
      {loading && (
        <div className="absolute inset-0 z-1 flex items-center justify-center text-sm text-muted-foreground">
          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> Rendering animation…
        </div>
      )}
      <div
        ref={containerRef}
        tabIndex={0}
        aria-label="Animated Mermaid diagram"
        // Keep the package class in React's declared className. The animator
        // also adds it imperatively, but a later loading-state render would
        // otherwise make React restore only the utility classes.
        className={
          fill
            ? "ma-container h-full min-h-0 w-full"
            : "ma-container h-[min(32rem,65vh)] min-h-64 w-full"
        }
      />
    </div>
  );
}

function MermaidError({ error }: { error: string }) {
  return (
    <div className="min-h-40 overflow-auto p-4 text-sm">
      <div className="mb-2 font-semibold text-destructive">Mermaid animation error</div>
      <pre className="whitespace-pre-wrap text-xs text-muted-foreground">{error}</pre>
    </div>
  );
}

function IconBtn({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded-md border border-border/60 bg-background/90 px-2 text-muted-foreground shadow-sm backdrop-blur transition-colors hover:text-foreground active:scale-95"
    >
      {children}
    </button>
  );
}
