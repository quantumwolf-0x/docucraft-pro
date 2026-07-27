import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import mermaid from "mermaid";
import { ZoomIn, ZoomOut, Maximize2, Download, X } from "lucide-react";

let counter = 0;

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
    <IconBtn onClick={downloadSvg} label="Download SVG">
      <Download className="h-3.5 w-3.5" />
    </IconBtn>
  );

  return (
    <>
      <div className="my-6 overflow-hidden rounded-xl border border-border bg-muted/30">
        <Stage
          svg={svg}
          extraControls={
            <>
              {downloadBtn}
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
          <div className="fixed inset-0 z-(--z-overlay) flex flex-col bg-background">
            {/* Fixed, top-most Close so it stays reachable through any zoom/pan on
                any viewport — sits above the overlay and the stage's zoom controls. */}
            <button
              onClick={() => setFullscreen(false)}
              aria-label="Close fullscreen"
              className="fixed right-3 top-3 z-80 inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background/90 px-3 text-sm font-medium text-muted-foreground shadow-lg backdrop-blur transition-colors hover:text-foreground active:scale-95"
            >
              <X className="h-4 w-4" />
              Close
            </button>
            <div className="border-b border-border px-4 py-2.5 pr-28">
              <span className="text-sm font-medium text-muted-foreground">
                Diagram — zoom with the +/− buttons, drag to move
              </span>
            </div>
            <div className="min-h-0 flex-1">
              <Stage svg={svg} fill extraControls={downloadBtn} />
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
        setZoom(1);
        setPan({ x: 0, y: 0 });
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [fill]);

  return (
    <div className="group/stage relative flex h-full w-full flex-col">
      <div
        className={`absolute top-2 z-10 flex items-center gap-1 transition-opacity ${
          // In fullscreen the fixed Close owns the top-right corner, so keep the
          // zoom controls on the left to avoid overlap.
          fill ? "left-2 opacity-100" : "right-2 opacity-0 group-hover/stage:opacity-100"
        }`}
      >
        <IconBtn onClick={zoomIn} label="Zoom in">
          <ZoomIn className="h-3.5 w-3.5" />
        </IconBtn>
        <IconBtn onClick={zoomOut} label="Zoom out">
          <ZoomOut className="h-3.5 w-3.5" />
        </IconBtn>
        {extraControls}
      </div>
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
