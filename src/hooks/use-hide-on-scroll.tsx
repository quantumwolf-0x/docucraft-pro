import { useEffect, useRef } from "react";

/**
 * Mobile "reveal on scroll up" header behaviour.
 *
 * The header is sticky, so it stays in the layout; this only slides it out of
 * the way while the reader is scrolling *down* and brings it straight back on
 * the first upward scroll. Like ReadingProgress, the transform is written
 * directly to the DOM rather than through state: scrolling a long document
 * fires this on nearly every frame, and routing it through React would
 * re-render the whole app shell (and the markdown tree under it) each time.
 *
 * Returns a ref to attach to the element that should hide.
 */

/** Ignore jitter below this many pixels — thumb scrolling is never still. */
const THRESHOLD = 6;
/** Never hide while still near the top; there is nothing to gain from it. */
const TOP_ZONE = 64;

export function useHideOnScroll<T extends HTMLElement>(enabled = true) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;

    let lastY = window.scrollY;
    let hidden = false;
    let frame = 0;

    const apply = (next: boolean) => {
      if (next === hidden) return;
      hidden = next;
      el.style.transform = next ? "translateY(-100%)" : "translateY(0)";
    };

    const measure = () => {
      frame = 0;
      const y = window.scrollY;
      const delta = y - lastY;
      if (Math.abs(delta) < THRESHOLD) return;
      lastY = y;
      // Bounce past the top (iOS rubber-banding) reports a negative scrollY;
      // treat anything in the top zone as "show", never as a downward scroll.
      apply(y > TOP_ZONE && delta > 0);
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      // Leave the element visible if the behaviour is torn down mid-hide.
      el.style.transform = "";
    };
  }, [enabled]);

  return ref;
}
