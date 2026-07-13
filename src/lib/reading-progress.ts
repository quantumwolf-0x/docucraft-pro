import { useCallback, useEffect, useState } from "react";

/**
 * Per-chapter reading progress. A "chapter" is a single markdown file.
 *
 * Progress is keyed by file *name* (not the random per-session id) so that
 * re-opening the same document later restores where the reader stopped —
 * the "reading memory" the experience depends on.
 *
 * Completion is earned, never granted: a chapter is only marked complete once
 * the reader has actually scrolled through ~85% of it. Opening or clicking a
 * chapter never completes it.
 */
export interface ChapterProgress {
  /** Furthest fraction (0–1) of the chapter the reader has reached. */
  scrollPct: number;
  completed: boolean;
  lastReadAt: number;
}

export type ProgressMap = Record<string, ChapterProgress>;

const KEY = "docucraft:reading:v1";
const COMPLETE_AT = 0.85;

function load(): ProgressMap {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ProgressMap) : {};
  } catch {
    return {};
  }
}

export function useReadingProgress() {
  const [map, setMap] = useState<ProgressMap>(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(map));
    } catch {
      /* storage may be unavailable (private mode, quota) — progress stays in-memory */
    }
  }, [map]);

  // Called frequently from the scroll handler. Progress only ever moves
  // forward, so we bail out (returning the same reference) unless the reader
  // has actually reached further or just crossed the completion line — this
  // keeps a noisy scroll stream from thrashing React.
  const recordScroll = useCallback((name: string, pct: number) => {
    setMap((prev) => {
      const cur = prev[name];
      const scrollPct = Math.max(cur?.scrollPct ?? 0, Math.min(1, pct));
      const completed = (cur?.completed ?? false) || scrollPct >= COMPLETE_AT;
      if (cur && scrollPct <= cur.scrollPct + 0.001 && completed === cur.completed) {
        return prev;
      }
      return { ...prev, [name]: { scrollPct, completed, lastReadAt: Date.now() } };
    });
  }, []);

  // Mark a chapter as visited (updates "last read" for continue-reading) without
  // touching how far the reader got.
  const touch = useCallback((name: string) => {
    setMap((prev) => {
      const cur = prev[name];
      return {
        ...prev,
        [name]: {
          scrollPct: cur?.scrollPct ?? 0,
          completed: cur?.completed ?? false,
          lastReadAt: Date.now(),
        },
      };
    });
  }, []);

  const reset = useCallback(() => setMap({}), []);

  return { map, recordScroll, touch, reset };
}

/** Most recently read chapter that isn't finished yet — the resume target. */
export function pickResume(names: string[], map: ProgressMap): string | null {
  let best: { name: string; at: number } | null = null;
  for (const name of names) {
    const p = map[name];
    if (!p || p.completed) continue;
    if (!best || p.lastReadAt > best.at) best = { name, at: p.lastReadAt };
  }
  return best?.name ?? null;
}
