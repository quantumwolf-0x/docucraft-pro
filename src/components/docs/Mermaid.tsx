import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Download,
  Expand,
  Home,
  LoaderCircle,
  Minus,
  Pause,
  Play,
  Plus,
  Star,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { MermaidAnimator, type MermaidAnimator as MermaidAnimatorInstance } from "mermaid-animator";
import { useSaveAction } from "./save-action";

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
  const [exporting, setExporting] = useState(false);
  // Measured by the inline stage; the frame needs it too, to narrow with a tall
  // diagram instead of drawing a full-width border around empty space.
  const [stageRatio, setStageRatio] = useState<number | null>(null);
  // Present when the markdown viewer has delegated its save star to this tray.
  const saveAction = useSaveAction();
  const source = code.trim();
  const frameCap = stageRatio ? `calc(min(32rem, 70vh) / ${stageRatio})` : null;

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

  // One download, one format. The animation *is* the artifact, and WebM is the
  // only export that carries it; GIF and a still SVG were each a lossy answer to
  // a question nobody asked at the download button.
  const exportDiagram = useCallback(async () => {
    if (!source || exporting) return;
    setExporting(true);
    try {
      const exporter = await import("mermaid-animator/export");
      const blob = await exporter.exportVideo(source, {
        theme: dark ? "dark" : "light",
        width: 1200,
        height: 800,
      });
      download(blob, `${baseName(name)}.webm`);
      toast.success("Downloaded animated Mermaid as WebM");
    } catch (error) {
      toast.error("Could not export WebM", {
        description: error instanceof Error ? error.message : "The browser could not encode it.",
      });
    } finally {
      setExporting(false);
    }
  }, [dark, exporting, name, source]);

  if (!source) {
    return (
      <div className="my-6 flex min-h-40 items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 text-sm text-muted-foreground">
        Add Mermaid source to preview the animation.
      </div>
    );
  }

  const downloadControl = (
    <TrayButton onClick={() => void exportDiagram()} label="Download WebM video" busy={exporting}>
      {exporting ? (
        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Download className="h-3.5 w-3.5" />
      )}
    </TrayButton>
  );

  // Saving is something you do *to* this diagram, like downloading it, so it
  // joins that segment rather than floating in the corner as its own surface.
  const saveControl = saveAction ? (
    <TrayButton
      onClick={saveAction.toggle}
      label={saveAction.label}
      title={saveAction.title}
      active={saveAction.saved}
    >
      <Star className={`h-3.5 w-3.5 ${saveAction.saved ? "fill-gold text-gold" : ""}`} />
    </TrayButton>
  ) : null;

  return (
    <>
      {/* The frame hugs the stage rather than the column: a tall diagram is
          capped to a screenful and narrower than the text, and a full-width card
          around it would just re-draw the dead space the sizing removed. The cap
          is the stage's, mirrored here, because `w-fit` would instead collapse a
          wide diagram to its intrinsic width and shrink the picture. */}
      <div
        className="mermaid-frame my-6 overflow-hidden rounded-xl border border-border bg-muted/30 mx-auto"
        style={frameCap ? { maxWidth: frameCap } : undefined}
      >
        {renderError ? (
          <MermaidError error={renderError} />
        ) : (
          <AnimatorStage
            code={source}
            dark={dark}
            onError={setRenderError}
            onRatio={setStageRatio}
            controls={
              <>
                {saveControl}
                {downloadControl}
                <TrayButton onClick={() => setFullscreen(true)} label="Fullscreen">
                  <Expand className="h-3.5 w-3.5" />
                </TrayButton>
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
                <div className="flex items-center gap-2">
                  <Tray>
                    {saveControl}
                    {downloadControl}
                  </Tray>
                  <Tray>
                    <TrayButton onClick={() => setFullscreen(false)} label="Close diagram">
                      <X className="h-4 w-4" />
                    </TrayButton>
                  </Tray>
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

// The animator stretches its SVG to the full box and lets preserveAspectRatio
// letterbox the remainder, so a wide diagram in a tall frame is read as a band
// of art floating in dead space. Measuring the rendered viewBox lets the inline
// stage take the diagram's own proportions instead, within bounds that keep a
// very wide or very tall graph from collapsing or running off the screen.
//
// The floor is low deliberately: a left-to-right flow of four or five nodes is
// genuinely around 0.3, and clamping it to something squarer reintroduces the
// exact dead band this measurement exists to remove.
const MIN_STAGE_RATIO = 0.26,
  MAX_STAGE_RATIO = 1.6;
// The control row floats over the diagram's bottom edge. Adding its height to
// the stage keeps it off the artwork instead of parked on the last node.
const TRAY_GUTTER = 56;

/** Zoom by rewriting the SVG viewBox — the same maths the animator's own wheel
 *  handler uses, reachable here because that handler is off and its PanZoom
 *  instance is private to the package. */
const ZOOM_LIMIT = { min: 0.2, max: 8 };
function zoomStage(container: HTMLElement | null, factor: number) {
  const svg = container?.querySelector("svg");
  const view = svg?.viewBox.baseVal;
  if (!svg || !view?.width || !view.height) return;
  const base = svg.dataset.maBaseView?.split(" ").map(Number);
  if (!base || base.length !== 4) return;
  const level = base[2] / view.width;
  const target = Math.min(Math.max(level * factor, ZOOM_LIMIT.min), ZOOM_LIMIT.max);
  if (target === level) return;
  const scale = level / target;
  const width = view.width * scale,
    height = view.height * scale;
  // Anchor on the centre so repeated taps zoom into what is being looked at.
  svg.setAttribute(
    "viewBox",
    `${view.x + (view.width - width) / 2} ${view.y + (view.height - height) / 2} ${width} ${height}`,
  );
}

function AnimatorStage({
  code,
  dark,
  fill,
  controls,
  onError,
  onRatio,
}: {
  code: string;
  dark: boolean;
  fill?: boolean;
  controls?: React.ReactNode;
  onError: (message: string | null) => void;
  /** Reports the diagram's measured aspect ratio so the frame can match it. */
  onRatio?: (ratio: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const animatorRef = useRef<MermaidAnimatorInstance | null>(null);
  const renderChainRef = useRef<Promise<void>>(Promise.resolve());
  const renderGenerationRef = useRef(0);
  const ownerGenerationRef = useRef(0);
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [ratio, setRatio] = useState<number | null>(null);

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
        // Wheel zoom hijacked the page scroll: scrolling past a diagram zoomed it
        // instead of moving on. Zoom is deliberate now — the tray's + and −.
        zoom: false,
        inspect: true,
        minZoom: ZOOM_LIMIT.min,
        maxZoom: ZOOM_LIMIT.max,
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
        // The untouched viewBox is the diagram's natural frame: it is both the
        // aspect ratio the inline stage should take and the zoom baseline.
        const svg = container.querySelector("svg");
        const view = svg?.viewBox.baseVal;
        if (svg && view?.width && view.height) {
          svg.dataset.maBaseView = `${view.x} ${view.y} ${view.width} ${view.height}`;
          const measured = Math.min(
            MAX_STAGE_RATIO,
            Math.max(MIN_STAGE_RATIO, view.height / view.width),
          );
          setRatio(measured);
          onRatio?.(measured);
        }
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
  }, [code, dark, fill, onError, onRatio]);

  const togglePlayback = () => {
    const animator = animatorRef.current;
    if (!animator) return;
    if (animator.isPaused()) animator.resume();
    else animator.pause();
    setPaused(animator.isPaused());
  };

  return (
    <div
      className="group/stage relative h-full w-full"
      // A tall diagram is capped to a screenful and so ends up narrower than the
      // column. The wrapper narrows with it, so the control row stays anchored
      // to the picture's own corner rather than floating out in the margin.
      style={
        fill || !ratio
          ? undefined
          : { maxWidth: `calc(min(32rem, 70vh) / ${ratio})`, marginInline: "auto" }
      }
    >
      {/* One tray, bottom-right, in both the inline and fullscreen stages: the
          controls keep one address instead of migrating between corners, and a
          single grouped surface means nothing can land on top of anything else.
          Playback and view are separate segments — pressing pause is a different
          kind of act from framing the picture. */}
      <div
        className={`pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-wrap items-center justify-end gap-2 p-3 ${
          fill
            ? ""
            : "opacity-0 transition-opacity duration-150 group-hover/stage:opacity-100 group-focus-within/stage:opacity-100 [@media(hover:none)]:opacity-100"
        }`}
      >
        <Tray>
          <TrayButton
            onClick={togglePlayback}
            label={paused ? "Play animation" : "Pause animation"}
          >
            {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
          </TrayButton>
        </Tray>
        <Tray>
          <TrayButton onClick={() => zoomStage(containerRef.current, 1 / 1.25)} label="Zoom out">
            <Minus className="h-3.5 w-3.5" />
          </TrayButton>
          <TrayButton onClick={() => zoomStage(containerRef.current, 1.25)} label="Zoom in">
            <Plus className="h-3.5 w-3.5" />
          </TrayButton>
          <TrayButton onClick={() => animatorRef.current?.fitToView()} label="Fit diagram">
            <Home className="h-3.5 w-3.5" />
          </TrayButton>
        </Tray>
        {controls && <Tray>{controls}</Tray>}
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
        className={fill ? "ma-container h-full min-h-0 w-full" : "ma-container w-full box-content"}
        // Inline: hold the diagram's own proportions so there is no letterboxed
        // dead band above and below it, with the control row's gutter added as
        // padding rather than taken out of the picture (hence `box-content`, so
        // the ratio still describes the diagram alone). Before the first
        // measurement a neutral ratio reserves roughly the right room, so the
        // surrounding text does not jump when the diagram appears.
        style={
          fill
            ? undefined
            : {
                aspectRatio: `1 / ${ratio ?? 0.42}`,
                paddingBottom: TRAY_GUTTER,
                // A tall diagram would otherwise grow past a screenful. The
                // wrapper caps the width in the same proportion, so this height
                // cap is only a backstop and never letterboxes the picture.
                maxHeight: "min(32rem, 70vh)",
                minHeight: "9rem",
              }
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

/**
 * A segmented control: one rounded surface, hairline dividers between its
 * buttons, no gaps for the diagram to show through. Grouping by meaning — and
 * spacing the groups — is what tells the eye which buttons belong together,
 * so no group needs a label to explain itself.
 *
 * Exported so the star affordance the markdown viewer overlays on a diagram can
 * join the same row instead of being positioned next to it by guesswork.
 */
export function Tray({ children }: { children: React.ReactNode }) {
  return (
    <div className="pointer-events-auto flex items-center overflow-hidden rounded-lg border border-border/70 bg-background/85 shadow-sm ring-1 ring-black/2 backdrop-blur-md [&>*+*]:border-l [&>*+*]:border-border/60">
      {children}
    </div>
  );
}

export function TrayButton({
  onClick,
  label,
  title,
  busy,
  active,
  children,
}: {
  onClick: (event: React.MouseEvent) => void;
  label: string;
  /** Tooltip, when it should differ from the accessible name. */
  title?: string;
  busy?: boolean;
  /** Renders the pressed state for a button that toggles something on. */
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-label={label}
      aria-pressed={active}
      title={title ?? label}
      className={`inline-flex h-8 w-8 items-center justify-center transition-colors duration-100 hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring active:bg-accent/80 disabled:pointer-events-none disabled:opacity-60 ${
        active ? "text-foreground" : "text-muted-foreground"
      }`}
    >
      {children}
    </button>
  );
}
