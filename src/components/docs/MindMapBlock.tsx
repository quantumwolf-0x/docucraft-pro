import { Suspense, lazy, useMemo } from "react";
import { buildMindMap } from "@/lib/mindmap";

/**
 * A ```mindmap fence in a markdown document, rendered the way ```mermaid is.
 *
 * The layout engine and renderer stay behind a lazy boundary: a document that
 * never draws a map never downloads them. Parsing and normalising is cheap and
 * synchronous, so it happens here — that is also what decides whether the fence
 * can be drawn at all.
 */
const MindMapView = lazy(() =>
  import("./MindMapView").then((module) => ({ default: module.MindMapView })),
);

/** Holds the map's rough footprint so surrounding text doesn't jump. */
function MapPlaceholder() {
  return (
    <div
      className="my-6 flex min-h-64 items-center justify-center rounded-xl border border-border bg-muted/30 text-sm text-muted-foreground"
      role="status"
      aria-label="Loading mind map"
    >
      Loading mind map…
    </div>
  );
}

/**
 * A fence that isn't usable JSON is shown as plain code rather than replaced by
 * an error: the author can still read what they wrote, and a malformed diagram
 * never costs them the content.
 */
function RawFence({ code, reason }: { code: string; reason: string }) {
  return (
    <div className="my-6 overflow-hidden rounded-xl border border-border">
      <div className="border-b border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
        {reason}
      </div>
      <pre className="overflow-auto bg-[#101722] p-4 text-sm leading-6 text-slate-200">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function MindMapBlock({ code, title }: { code: string; title?: string }) {
  const tree = useMemo(() => buildMindMap(code, title?.trim() || "root"), [code, title]);

  if (!tree) {
    const invalid = (() => {
      try {
        JSON.parse(code);
        return false;
      } catch {
        return true;
      }
    })();
    return (
      <RawFence
        code={code}
        reason={
          invalid
            ? "This mind map block is not valid JSON."
            : "This JSON has no nested structure to draw as a mind map."
        }
      />
    );
  }

  return (
    <div className="my-6 overflow-hidden rounded-xl border border-border">
      <Suspense fallback={<MapPlaceholder />}>
        {/* Bounded height: inside a document the map is a figure, not a page,
            and it must not grow past the text it belongs to. */}
        <MindMapView tree={tree} embedded />
      </Suspense>
    </div>
  );
}
