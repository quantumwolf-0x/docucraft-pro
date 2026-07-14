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
      const rel = line.match(
        /^(\s*)([\w".:-]+)(\s+)(\S*--\S*)(\s+)([\w".:-]+)(\s*:\s*.*)$/,
      );
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
          <div className="fixed inset-0 z-[70] flex flex-col bg-background">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <span className="text-sm font-medium text-muted-foreground">
              Diagram — zoom with the +/− buttons, drag to move
            </span>
            <button
              onClick={() => setFullscreen(false)}
              aria-label="Close fullscreen"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground active:scale-95"
            >
              <X className="h-4 w-4" />
              Close
            </button>
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
  // Wheel-zoom stays off until the reader opts in via a zoom button, so
  // scrolling the page over a diagram scrolls the page (not the diagram).
  const [zoomEnabled, setZoomEnabled] = useState(false);
  const zoomEnabledRef = useRef(false);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    zoomEnabledRef.current = zoomEnabled;
  }, [zoomEnabled]);

  // Wheel-to-zoom via a non-passive native listener so we can preventDefault
  // (React's onWheel is passive and would let the page scroll instead). Only
  // hijack the wheel once zoom has been enabled; otherwise let the page scroll.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!zoomEnabledRef.current) return;
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      setZoom((z) => Math.min(8, Math.max(0.3, z * factor)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const zoomIn = () => {
    setZoomEnabled(true);
    setZoom((z) => Math.min(8, z * 1.25));
  };
  const zoomOut = () => {
    setZoomEnabled(true);
    setZoom((z) => Math.max(0.3, z / 1.25));
  };

  return (
    <div className="group/stage relative flex h-full w-full flex-col">
      <div
        className={`absolute right-2 top-2 z-10 flex items-center gap-1 transition-opacity ${
          fill ? "opacity-100" : "opacity-0 group-hover/stage:opacity-100"
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
          fill ? "" : "min-h-[160px]"
        }`}
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
