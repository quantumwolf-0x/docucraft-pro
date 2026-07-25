// Local-first persistence, Excalidraw-style. No backend.
//
// - IndexedDB is the primary store: workspaces (markdown files + edits + UI
//   state) live here, keyed by workspace id.
// - localStorage holds only lightweight preferences (theme, last-opened
//   workspace). Reading progress, recent searches and sidebar width keep their
//   own small localStorage keys elsewhere; they already survive refresh.
//
// All IndexedDB access is funnelled through this module so UI components never
// touch the database directly.

export interface PersistedFile {
  id: string;
  name: string;
  content: string;
  data?: string;
  mimeType?: string;
  size?: number;
  addedAt?: number;
  kind?: import("./markdown-utils").DocumentKind;
}

export interface PersistedUI {
  activeFileId: string | null;
  expanded: Record<string, boolean>;
  sidebarCollapsed: boolean;
  scrollTop: number;
  fileOrder?: string[];
  /** File ids in most-recently-opened order — drives the "Recent" chip. */
  recentFileIds?: string[];
}

import type { Highlight } from "./dom-highlighter";

export interface WorkspaceRecord {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  files: PersistedFile[];
  // Bookmarked file ids, shown on the home page.
  bookmarks: string[];
  highlights?: Highlight[];
  ui: PersistedUI;
}

export type SaveStatus = "idle" | "saving" | "saved" | "restored";

const DB_NAME = "localdox";
const DB_VERSION = 1;
const STORE = "workspaces";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function request<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

async function deleteDatabase(): Promise<void> {
  const openDatabase = dbPromise;
  dbPromise = null;

  try {
    (await openDatabase)?.close();
  } catch {
    // The database may never have opened; deletion can still proceed.
  }

  if (typeof indexedDB === "undefined") return;

  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error("Could not delete local database"));
    req.onblocked = () => reject(new Error("Close Localdox in other tabs before clearing storage"));
  });
}

export const persistence = {
  getWorkspace(id: string) {
    return request<WorkspaceRecord | undefined>("readonly", (s) => s.get(id));
  },
  putWorkspace(w: WorkspaceRecord) {
    return request<IDBValidKey>("readwrite", (s) => s.put(w)).then(() => {});
  },
  deleteWorkspace(id: string) {
    return request<undefined>("readwrite", (s) => s.delete(id)).then(() => {});
  },
  listWorkspaces() {
    return request<WorkspaceRecord[]>("readonly", (s) => s.getAll());
  },
  clearAll() {
    return request<undefined>("readwrite", (s) => s.clear()).then(() => {});
  },
  destroy() {
    return deleteDatabase();
  },
};

export function emptyUI(): PersistedUI {
  return {
    activeFileId: null,
    expanded: {},
    sidebarCollapsed: false,
    scrollTop: 0,
    fileOrder: [],
    recentFileIds: [],
  };
}

export function newWorkspaceRecord(name: string): WorkspaceRecord {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    name,
    createdAt: now,
    updatedAt: now,
    files: [],
    bookmarks: [],
    highlights: [],
    ui: emptyUI(),
  };
}

// ---- lightweight preferences (localStorage) ----

// Reader themes each carry a full, WCAG-checked token palette (see styles.css).
// The old "light"/"dark" values remain valid so existing prefs keep working.
export type ThemePref = "light" | "sepia" | "dark" | "nord" | "black";

// Themes whose surfaces are dark — used to keep the legacy `.dark` class in sync
// so dark-only rules (code highlighting, katex, mermaid) still apply.
export const DARK_THEMES: readonly ThemePref[] = ["dark", "nord", "black"];
export const READER_THEMES: readonly ThemePref[] = ["light", "sepia", "dark", "nord", "black"];

export function isDarkTheme(theme: ThemePref): boolean {
  return DARK_THEMES.includes(theme);
}

// How a multi-section markdown document is laid out for reading.
// "paginated" = one section per page with prev/next; "single" = whole doc scrolls.
export type ReadingMode = "paginated" | "single";

// Reading typeface. Each maps to a --font-body / --font-heading pair in styles.css.
// "system" is the default — the device's own UI font (SF on macOS/iOS, Segoe on
// Windows, Roboto on Android/Chrome OS).
export type ReadingFont = "system" | "serif" | "newsreader" | "sans" | "hyperlegible";
export const READING_FONTS: readonly ReadingFont[] = [
  "system",
  "serif",
  "newsreader",
  "sans",
  "hyperlegible",
];

export interface Prefs {
  theme: ThemePref;
  lastWorkspaceId: string | null;
  // The reader's name, asked once and remembered for personalized greetings.
  name: string | null;
  // True once the reader has answered the name prompt (set a name or skipped),
  // so the greeting modal never asks again.
  namePrompted: boolean;
  readingMode: ReadingMode;
  readingFont: ReadingFont;
}

const PREFS_KEY = "localdox:prefs";
const DEFAULT_PREFS: Prefs = {
  theme: "dark",
  lastWorkspaceId: null,
  name: null,
  namePrompted: false,
  readingMode: "paginated",
  readingFont: "system",
};

export function loadPrefs(): Prefs {
  if (typeof localStorage === "undefined") return { ...DEFAULT_PREFS };
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : { ...DEFAULT_PREFS };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function savePrefs(patch: Partial<Prefs>): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ ...loadPrefs(), ...patch }));
  } catch {
    /* storage unavailable — preferences stay in memory */
  }
}

// ---- import / export (JSON) ----

export function serializeWorkspace(w: WorkspaceRecord): string {
  return JSON.stringify({ format: "localdox-workspace", version: 1, workspace: w }, null, 2);
}

/** Parse an exported workspace JSON into a fresh record (new id, no clobber). */
export function parseWorkspaceImport(json: string): WorkspaceRecord {
  const data = JSON.parse(json);
  const w = data?.workspace ?? data;
  if (!w || !Array.isArray(w.files)) {
    throw new Error("Not a valid workspace file");
  }
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    name: typeof w.name === "string" && w.name.trim() ? w.name : "Imported workspace",
    createdAt: typeof w.createdAt === "number" ? w.createdAt : now,
    updatedAt: now,
    files: w.files
      .filter((f: any) => f && typeof f.content === "string")
      .map((f: any) => ({
        id: typeof f.id === "string" ? f.id : crypto.randomUUID(),
        name: typeof f.name === "string" ? f.name : "untitled.md",
        content: f.content,
        data: typeof f.data === "string" ? f.data : undefined,
        mimeType: typeof f.mimeType === "string" ? f.mimeType : undefined,
        size: typeof f.size === "number" ? f.size : undefined,
        addedAt: typeof f.addedAt === "number" ? f.addedAt : undefined,
        kind: typeof f.kind === "string" ? f.kind : undefined,
      })),
    bookmarks: Array.isArray(w.bookmarks)
      ? w.bookmarks.filter((b: any) => typeof b === "string")
      : [],
    highlights: Array.isArray(w.highlights) ? w.highlights : [],
    ui: {
      activeFileId: typeof w.ui?.activeFileId === "string" ? w.ui.activeFileId : null,
      expanded: typeof w.ui?.expanded === "object" ? w.ui.expanded : {},
      sidebarCollapsed: typeof w.ui?.sidebarCollapsed === "boolean" ? w.ui.sidebarCollapsed : false,
      scrollTop: typeof w.ui?.scrollTop === "number" ? w.ui.scrollTop : 0,
      fileOrder: Array.isArray(w.ui?.fileOrder) ? w.ui.fileOrder : [],
      recentFileIds: Array.isArray(w.ui?.recentFileIds) ? w.ui.recentFileIds : [],
    },
  };
}
