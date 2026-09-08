import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

/**
 * One navigation history for the whole app.
 *
 * The header's chevrons used to be a content stepper — next file in sidebar
 * order, next section, next slide — which is not what a back button means. Jump
 * to a file from search and "back" walked to its alphabetical neighbour rather
 * than to where you came from.
 *
 * This hook is the trail instead: every *destination* the reader lands on, in
 * visit order. A destination is the whole view, not just a file id, so going
 * back restores the section and the scroll position too.
 *
 * Modes (edit, fullscreen, present, mind map, settings, the AI panel, …) are
 * not entries here. They are escapes: a mode registers itself while open, and
 * back closes the innermost one before it touches the trail. That is what makes
 * one button work everywhere — it always undoes the last thing that happened,
 * whether that was opening a panel or opening a document.
 */

export interface NavEntry {
  /** Route path — "/" for the reader, "/settings" for settings. */
  path: string;
  /** Open document, when the entry is a reader view. */
  fileId: string | null;
  /** Section within the document. */
  headingId: string | null;
  /** Search term the document was opened with, so back restores highlighting. */
  query: string | null;
  /** Scroll offset, captured when we navigate away from this entry. */
  scrollY: number;
}

/**
 * A dismissable layer stacked over the current entry. `depth` breaks ties when
 * several are open at once: the innermost (highest depth) closes first, so back
 * from fullscreen-inside-edit leaves the editor open rather than dropping both.
 */
export interface NavEscape {
  id: string;
  depth: number;
  close: () => void;
}

/** Depths for the escapes in use. Higher closes first. */
export const ESCAPE_DEPTH = {
  /** A mode you are reading/working *inside* — leaves you on the same document. */
  mode: 10,
  /** A panel or sheet docked beside the content. */
  panel: 20,
  /** A modal, dialog, or full overlay taking the whole screen. */
  overlay: 30,
} as const;

const MAX_ENTRIES = 100;

export interface NavHistory {
  canBack: boolean;
  canForward: boolean;
  back: () => void;
  forward: () => void;
  /** Label for the back control — names what it will actually undo. */
  backLabel: string;
  forwardLabel: string;
  /** Record a destination. No-op when it matches where we already are. */
  push: (entry: Partial<NavEntry>) => void;
  /** Register a dismissable layer for as long as it is open. */
  registerEscape: (escape: NavEscape) => () => void;
  /** Close the innermost escape, if any. Returns whether one was closed. */
  popEscape: () => boolean;
}

export const NavHistoryContext = createContext<NavHistory | null>(null);

/** Read the app's navigation history. Safe to call outside the provider. */
export function useNavHistory(): NavHistory {
  return useContext(NavHistoryContext) ?? NOOP_HISTORY;
}

const NOOP_HISTORY: NavHistory = {
  canBack: false,
  canForward: false,
  back: () => {},
  forward: () => {},
  backLabel: "Back",
  forwardLabel: "Forward",
  push: () => {},
  registerEscape: () => () => {},
  popEscape: () => false,
};

function sameEntry(a: NavEntry, b: NavEntry) {
  return (
    a.path === b.path && a.fileId === b.fileId && a.headingId === b.headingId && a.query === b.query
  );
}

function normalize(entry: Partial<NavEntry>): NavEntry {
  return {
    path: entry.path ?? "/",
    fileId: entry.fileId ?? null,
    headingId: entry.headingId ?? null,
    query: entry.query ?? null,
    scrollY: entry.scrollY ?? 0,
  };
}

/**
 * The trail outlives the component that owns it.
 *
 * Settings is a separate route, so moving to it unmounts the app shell and
 * takes any in-memory stack with it — which is exactly the moment back matters
 * most, and why settings used to offer a hardcoded link home instead. Session
 * storage is the right shape for this: per-tab, cleared when the tab closes,
 * and never shared between two windows onto the same workspace.
 */
const STORAGE_KEY = "localdox:nav-history";

function loadTrail(): { stack: NavEntry[]; index: number } {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { stack: [], index: -1 };
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.stack) || typeof parsed?.index !== "number") {
      return { stack: [], index: -1 };
    }
    return { stack: parsed.stack.map(normalize), index: parsed.index };
  } catch {
    return { stack: [], index: -1 };
  }
}

function saveTrail(stack: NavEntry[], index: number) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ stack, index }));
  } catch {
    /* private mode, quota — the trail is a convenience, not state to protect */
  }
}

/**
 * Owns the trail. `apply` is how the history moves the app: it is handed an
 * entry and puts the app into that state. Applying is flagged while it runs so
 * the resulting state change does not push a new entry and erase the future.
 */
export function useNavHistoryState({
  apply,
  captureScroll,
}: {
  apply: (entry: NavEntry) => void;
  captureScroll: () => number;
}): NavHistory {
  const restored = useRef(loadTrail());
  const [stack, setStack] = useState<NavEntry[]>(restored.current.stack);
  const [index, setIndex] = useState(restored.current.index);
  const escapesRef = useRef<NavEscape[]>([]);
  const [escapeCount, setEscapeCount] = useState(0);
  const applyingRef = useRef(false);
  const stackRef = useRef(stack);
  const indexRef = useRef(index);
  stackRef.current = stack;
  indexRef.current = index;

  useEffect(() => {
    saveTrail(stack, index);
  }, [stack, index]);

  const registerEscape = useCallback((escape: NavEscape) => {
    escapesRef.current = [...escapesRef.current, escape];
    setEscapeCount(escapesRef.current.length);
    return () => {
      escapesRef.current = escapesRef.current.filter((item) => item.id !== escape.id);
      setEscapeCount(escapesRef.current.length);
    };
  }, []);

  const popEscape = useCallback(() => {
    const escapes = escapesRef.current;
    if (escapes.length === 0) return false;
    // Innermost first; among equals, the most recently opened.
    const target = escapes.reduce((best, item) => (item.depth >= best.depth ? item : best));
    target.close();
    return true;
  }, []);

  const push = useCallback(
    (partial: Partial<NavEntry>) => {
      if (applyingRef.current) return;
      const entry = normalize(partial);
      const current = stackRef.current[indexRef.current];
      if (current && sameEntry(current, entry)) return;

      setStack((prev) => {
        // Remember where we were leaving from, so back returns to the same place
        // in the document rather than to its top.
        const trimmed = prev.slice(0, indexRef.current + 1);
        if (trimmed.length > 0) {
          trimmed[trimmed.length - 1] = {
            ...trimmed[trimmed.length - 1],
            scrollY: captureScroll(),
          };
        }
        const next = [...trimmed, entry];
        // Cap the trail. Dropping from the front keeps recent history intact.
        const overflow = Math.max(0, next.length - MAX_ENTRIES);
        const capped = next.slice(overflow);
        setIndex(capped.length - 1);
        return capped;
      });
    },
    [captureScroll],
  );

  const go = useCallback(
    (delta: number) => {
      const target = indexRef.current + delta;
      const entry = stackRef.current[target];
      if (!entry) return;

      // Leaving the current entry: save where we are in it first.
      const scrollY = captureScroll();
      setStack((prev) =>
        prev.map((item, i) => (i === indexRef.current ? { ...item, scrollY } : item)),
      );

      applyingRef.current = true;
      setIndex(target);
      apply(entry);
      // Released after the state changes `apply` triggered have flushed, so
      // none of them are mistaken for a new navigation.
      queueMicrotask(() => {
        applyingRef.current = false;
      });
    },
    [apply, captureScroll],
  );

  const back = useCallback(() => {
    // A mode or panel is open: back leaves that, not the document.
    if (popEscape()) return;
    go(-1);
  }, [go, popEscape]);

  const forward = useCallback(() => go(1), [go]);

  // Referenced so the labels recompute when a mode opens or closes.
  void escapeCount;
  const hasEscape = escapesRef.current.length > 0;

  return {
    canBack: hasEscape || index > 0,
    canForward: index >= 0 && index < stack.length - 1,
    back,
    forward,
    backLabel: hasEscape ? "Back (close)" : "Back",
    forwardLabel: "Forward",
    push,
    registerEscape,
    popEscape,
  };
}

/**
 * Keep a mode dismissable by the back button for as long as it is open.
 *
 * Call it from the component owning the mode; `close` is whatever the mode's
 * own exit control does, so back and that control stay in step by construction.
 */
export function useNavEscape(
  active: boolean,
  close: () => void,
  depth: number = ESCAPE_DEPTH.mode,
) {
  const { registerEscape } = useNavHistory();
  const closeRef = useRef(close);
  closeRef.current = close;
  const idRef = useRef<string>("");
  if (!idRef.current) idRef.current = Math.random().toString(36).slice(2);

  useEffect(() => {
    if (!active) return;
    return registerEscape({
      id: idRef.current,
      depth,
      close: () => closeRef.current(),
    });
  }, [active, depth, registerEscape]);
}
