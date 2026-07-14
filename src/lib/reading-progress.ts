import { useCallback, useEffect, useState } from "react";

export interface ChapterProgress {
  lastReadAt: number;
}

export type ProgressMap = Record<string, ChapterProgress>;

const KEY = "docucraft:reading:v1";

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

  // Mark a chapter as visited (updates "last read" for continue-reading)
  const touch = useCallback((name: string) => {
    setMap((prev) => {
      return {
        ...prev,
        [name]: {
          lastReadAt: Date.now(),
        },
      };
    });
  }, []);

  const reset = useCallback(() => setMap({}), []);

  return { map, touch, reset };
}

export function pickResume(names: string[], map: ProgressMap): string | null {
  let best: { name: string; at: number } | null = null;
  for (const name of names) {
    const p = map[name];
    if (!p) continue;
    if (!best || p.lastReadAt > best.at) best = { name, at: p.lastReadAt };
  }
  return best?.name ?? null;
}
