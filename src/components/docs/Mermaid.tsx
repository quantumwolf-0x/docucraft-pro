import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import mermaid from "mermaid";
import { Download, Home, Maximize2, Minus, Plus, X, ZoomIn, ZoomOut } from "lucide-react";

let counter = 0;

/** Breathing room kept around a fitted diagram, in CSS pixels. */
const FIT_PADDING = 24;
/** Ceiling for the opening fit. Past this, a sparse diagram reads as zoomed-in
 *  rather than large; the +/− buttons still go all the way to 8x. */
const MAX_FIT_ZOOM = 2.2;

function configure(dark: boolean) {
  mermaid.initialize({
    startOnLoad: false,
    theme: dark ? "dark" : "default",
    securityLevel: "loose",
    fontFamily: "ui-sans-serif, system-ui, sans-serif",
  });
}

// mermaid's erDiagram lexer reserves words like CLASS, so a diagram that uses
// them as bare entity names (valid domain modelling) fails to parse. Quoting
// the two entity names around each cardinality operator renders identically and
// lets reserved words through. Applied only as a fallback so valid diagrams are
// never altered.
function quoteErEntities(src: string): string {
  const q = (t: string) => (/^".*"$/.test(t) ? t : `"${t}"`);
  return src
    .split("\n")
    .map((line) => {
      const rel = line.match(/^(\s*)([\w".:-]+)(\s+)(\S*--\S*)(\s+)([\w".:-]+)(\s*:\s*.*)$/);
      if (!rel) return line;
      return rel[1] + q(rel[2]) + rel[3] + rel[4] + rel[5] + q(rel[6]) + rel[7];
    })
    .join("\n");
}

async function renderMermaid(id: string, source: string): Promise<string> {
  try {
    await mermaid.parse(source);
    return (await mermaid.render(id, source)).svg;
  } catch (err) {
    // Fallback: rescue erDiagrams that use reserved words as entity names.
    if (/^\s*erDiagram\b/.test(source)) {
      const alt = quoteErEntities(source);
      if (alt !== source) {
        await mermaid.parse(alt);
        return (await mermaid.render(id, alt)).svg;
      }
    }
    throw err;
  }
}

export function Mermaid({ code }: { code: string }) {
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const source = code.trim();

    const render = async () => {
      if (!source) {
        setSvg("");
        setError(null);
        return;
      }
      // A unique id per render avoids collisions with orphaned nodes mermaid
      // leaves behind — a stale id makes render() silently no-op or throw.
      const id = `mmd-${++counter}`;
      try {
        configure(document.documentElement.classList.contains("dark"));
        const out = await renderMermaid(id, source);
        if (!cancelled) {
          setSvg(out);
          setError(null);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to render diagram");
      } finally {
        // mermaid injects a temp measuring node; drop it if it lingers.
        document.getElementById(id)?.remove();
        document.getElementById(`d${id}`)?.remove();
      }
    };

    render();
    // Re-render on theme (class) changes so diagram colors track light/dark.
    let raf = 0;
    const obs = new MutationObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(render);
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      obs.disconnect();
    };
  }, [code]);

  // Fullscreen: lock body scroll and close on Escape.
  useEffect(() => {
    if (!fullscreen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [fullscreen]);

  const downloadSvg = () => {
    if (!svg) return;
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "diagram.svg";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  if (error) {
    return (
      <div className="my-6 overflow-auto rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
        <div className="mb-2 font-semibold text-destructive">Mermaid error</div>
        <pre className="whitespace-pre-wrap text-xs text-muted-foreground">{error}</pre>
      </div>
    );
  }

  const downloadBtn = (
    <button
      type="button"
      onClick={downloadSvg}
      aria-label="Download SVG"
      title="Download SVG"
      className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      <Download className="h-4 w-4" />
    </button>
  );

  return (
    <>
      <div className="my-6 overflow-hidden rounded-xl border border-border bg-muted/30">
        <Stage
          svg={svg}
          extraControls={
            <>
              <IconBtn onClick={downloadSvg} label="Download SVG">
                <Download className="h-3.5 w-3.5" />
              </IconBtn>
              <IconBtn onClick={() => setFullscreen(true)} label="Fullscreen">
                <Maximize2 className="h-3.5 w-3.5" />
              </IconBtn>
            </>
          }
        />
      </div>

      {fullscreen &&
        typeof document !== "undefined" &&
        createPortal(
          // Portal to <body>: an ancestor (the article carries a GSAP transform)
          // would otherwise become the containing block for this fixed overlay,
          // trapping it inside the article box instead of the viewport.
          // Same dialog shell as Settings, so every full-view layer in the app
          // reads as one surface rather than a bespoke takeover per feature.
          <div className="fixed inset-0 z-(--z-overlay) flex items-center justify-center p-0 sm:p-4">
            <div
              className="absolute inset-0 bg-foreground/30 backdrop-blur-sm animate-in fade-in duration-150"
              onClick={() => setFullscreen(false)}
              aria-hidden
            />

            <div
              role="dialog"
              aria-modal="true"
              aria-label="Diagram"
              // Wider and taller than the Settings shell it otherwise matches:
              // a diagram is the content here, not a column of form rows, so it
              // takes as much of the viewport as it can while staying a dialog.
              className="relative flex h-full w-full flex-col overflow-hidden border-border bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-150 sm:h-[92vh] sm:max-w-[min(1600px,95vw)] sm:rounded-2xl sm:border"
            >
              <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border px-4 sm:px-6">
                <h1 className="text-base font-semibold tracking-tight text-foreground">Diagram</h1>
                <div className="-mr-1 flex items-center gap-1">
                  {downloadBtn}
                  <button
                    type="button"
                    onClick={() => setFullscreen(false)}
                    aria-label="Close diagram"
                    className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </header>
              <div className="min-h-0 flex-1">
                <Stage svg={svg} fill />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

/** Interactive zoom/pan stage for a rendered SVG. Owns its own transform state,
 *  so the inline diagram and the fullscreen view zoom independently. */
function Stage({
  svg,
  fill,
  extraControls,
}: {
  svg: string;
  fill?: boolean;
  extraControls?: React.ReactNode;
}) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  /** Scale the diagram so it fills the stage without overflowing it. It grows
   *  as well as shrinks — mermaid sizes a small graph to its content, which in
   *  a large dialog would otherwise leave the diagram marooned in empty space.
   *  Vector art, so scaling up costs no sharpness; the cap just stops a
   *  two-box diagram from turning into wall art. */
  const fit = useCallback(() => {
    const stage = stageRef.current;
    const drawing = contentRef.current?.querySelector("svg");
    if (!stage || !drawing) return;
    const box = drawing.getBoundingClientRect();
    // The rect is already scaled by the live transform; divide it back out to
    // recover the diagram's natural size.
    const naturalWidth = box.width / zoom,
      naturalHeight = box.height / zoom;
    if (!naturalWidth || !naturalHeight) return;
    const next = Math.min(
      MAX_FIT_ZOOM,
      (stage.clientWidth - FIT_PADDING * 2) / naturalWidth,
      (stage.clientHeight - FIT_PADDING * 2) / naturalHeight,
    );
    setZoom(Math.max(0.3, next));
    setPan({ x: 0, y: 0 });
  }, [zoom]);

  // The full view opens fitted, so the whole diagram is visible at a glance
  // rather than cropped by the dialog at 1:1.
  useEffect(() => {
    if (!fill || !svg) return;
    // After the SVG has been painted, so it can be measured.
    const raf = requestAnimationFrame(fit);
    return () => cancelAnimationFrame(raf);
    // Deliberately keyed to the diagram, not to `fit` — refitting on every zoom
    // change would fight the user's own zooming.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fill, svg]);

  // Zooming is the +/− buttons' job only. Pinch (which trackpads report as
  // ctrl+wheel, Safari as gesture* events) is swallowed here rather than acted
  // on: left alone it becomes a browser page zoom that outlives the viewer and
  // leaves the document behind it scaled. A plain wheel still scrolls the page.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) e.preventDefault();
    };
    const swallow = (e: Event) => e.preventDefault();
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("gesturestart", swallow);
    el.addEventListener("gesturechange", swallow);
    el.addEventListener("gestureend", swallow);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("gesturestart", swallow);
      el.removeEventListener("gesturechange", swallow);
      el.removeEventListener("gestureend", swallow);
    };
  }, []);

  const zoomIn = () => setZoom((z) => Math.min(8, z * 1.25));
  const zoomOut = () => setZoom((z) => Math.max(0.3, z / 1.25));
  // "Home" restores the view the dialog opened with, which is the fitted one.
  const reset = fill
    ? fit
    : () => {
        setZoom(1);
        setPan({ x: 0, y: 0 });
      };

  // `fit` is rebuilt whenever the zoom changes, so the keydown listener below —
  // registered once — would otherwise keep calling a stale copy and refit
  // against an out-of-date scale. The ref always points at the current one.
  const resetRef = useRef(reset);
  resetRef.current = reset;

  // Fullscreen owns the keyboard zoom shortcuts too, so cmd/ctrl +/-/0 scales
  // the diagram rather than the document underneath it.
  useEffect(() => {
    if (!fill) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        zoomIn();
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        zoomOut();
      } else if (e.key === "0") {
        e.preventDefault();
        resetRef.current();
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [fill]);

  return (
    <div className="group/stage relative flex h-full w-full flex-col">
      {/* Full view borrows the mind map's segmented control so the two canvases
          are driven the same way; inline keeps the lighter hover-only icons. */}
      {fill ? (
        <div className="absolute bottom-4 right-4 z-10 flex overflow-hidden rounded-md border border-border bg-background/95 shadow-sm backdrop-blur">
          <StageControl label="Zoom in" onClick={zoomIn}>
            <Plus className="h-3.5 w-3.5" />
          </StageControl>
          <StageControl label="Zoom out" onClick={zoomOut}>
            <Minus className="h-3.5 w-3.5" />
          </StageControl>
          <StageControl label="Reset view" onClick={reset}>
            <Home className="h-3.5 w-3.5" />
          </StageControl>
        </div>
      ) : (
        <div className="mermaid-controls absolute right-2 top-2 z-10 flex items-center gap-1 opacity-0 transition-opacity group-hover/stage:opacity-100">
          <IconBtn onClick={zoomIn} label="Zoom in">
            <ZoomIn className="h-3.5 w-3.5" />
          </IconBtn>
          <IconBtn onClick={zoomOut} label="Zoom out">
            <ZoomOut className="h-3.5 w-3.5" />
          </IconBtn>
          {extraControls}
        </div>
      )}
      <div
        ref={stageRef}
        className={`flex flex-1 cursor-grab items-center justify-center overflow-hidden p-4 active:cursor-grabbing ${
          fill ? "" : "min-h-40"
        }`}
        // Blocks touch pinch-zoom (which would zoom the page, not the diagram).
        // Inline still allows one-finger scrolling past the diagram.
        style={{ touchAction: fill ? "none" : "pan-x pan-y" }}
        onMouseDown={(e) => (dragRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y })}
        onMouseMove={(e) => {
          if (!dragRef.current) return;
          setPan({ x: e.clientX - dragRef.current.x, y: e.clientY - dragRef.current.y });
        }}
        onMouseUp={() => (dragRef.current = null)}
        onMouseLeave={() => (dragRef.current = null)}
      >
        <div
          ref={contentRef}
          className="docs-mermaid"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transition: dragRef.current ? "none" : "transform 0.15s ease",
          }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>
    </div>
  );
}

/** One cell of the full-view segmented zoom control — matches MindMapView. */
function StageControl({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center border-l border-border text-muted-foreground transition-colors first:border-l-0 hover:bg-accent hover:text-foreground"
    >
      {children}
    </button>
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
      onClick={onClick}
      aria-label={label}
      className="inline-flex h-7 min-w-7 items-center justify-center rounded-md border border-border/60 bg-background/90 px-1.5 text-muted-foreground backdrop-blur transition-colors hover:text-foreground active:scale-95"
    >
      {children}
    </button>
  );
}
