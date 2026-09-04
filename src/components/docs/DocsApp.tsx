import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { Menu, X, Search, Plus, Undo2, Upload, Settings } from "lucide-react";

import { Sidebar, DEFAULT_VIEW, type SidebarView } from "./Sidebar";
import { MarkdownViewer } from "./MarkdownViewer";
import { WorkspaceMenu } from "./WorkspaceMenu";
import { WorkspaceSheet } from "./WorkspaceSheet";
import { BrandMark } from "./BrandMark";
import type { AskAiPrefill } from "./ai/AskAiPanel";

// Code-split surfaces. None of these is on the path to reading a document — the
// settings page, the search palette, the AI panel and the binary-document
// viewers are all reached by an explicit action — so none of them belongs in
// the download that stands between the reader and their first paint. Each is
// mounted only once it is actually asked for, so the fetch overlaps the
// interaction that triggered it.
const DocumentViewer = lazy(() =>
  import("./DocumentViewer").then((m) => ({ default: m.DocumentViewer })),
);
const CommandPalette = lazy(() =>
  import("./CommandPalette").then((m) => ({ default: m.CommandPalette })),
);
const SettingsPage = lazy(() =>
  import("./SettingsPage").then((m) => ({ default: m.SettingsPage })),
);
const HighlightsOnlyModal = lazy(() =>
  import("./HighlightsOnlyModal").then((m) => ({ default: m.HighlightsOnlyModal })),
);
const AskAiPanel = lazy(() => import("./ai/AskAiPanel").then((m) => ({ default: m.AskAiPanel })));
const SharedFilesDialog = lazy(() =>
  import("./SharedFilesDialog").then((m) => ({ default: m.SharedFilesDialog })),
);
import type { MdFile, MdChunk } from "@/lib/markdown-utils";
import type { Highlight } from "@/lib/dom-highlighter";
import { fileSubtopics, readingMinutes } from "@/lib/markdown-utils";
import { getDocumentKind, importDocumentFile, SUPPORTED_ACCEPT } from "@/lib/document-utils";
import { clearArtifactResolutionCache } from "@/lib/workspace-artifacts";
import { loadReadingFont, warmAppFonts } from "@/lib/fonts";
import { warmMarkdownPlugins } from "@/lib/markdown-plugins";
import { toast } from "sonner";
import { useHistory } from "@/hooks/use-history";
import { isEditableTarget, hasModKey } from "@/lib/keyboard";
import {
  persistence,
  loadPrefs,
  savePrefs,
  newWorkspaceRecord,
  serializeWorkspace,
  parseWorkspaceImport,
  isDarkTheme,
  saveScrollTop,
  loadScrollTop,
  type PersistedFile,
  type FolderRecord,
  type WorkspaceRecord,
  type SaveStatus,
  type ThemePref,
  type ReadingMode,
  type ReadingFont,
} from "@/lib/persistence";
import {
  findSaved,
  migrateBookmarks,
  newSavedId,
  savedKey,
  toLegacyBookmarks,
  type SavedDraft,
  type SavedEntry,
  type SavedItem,
} from "@/lib/saved-items";
import {
  copyLink,
  fetchShare,
  parseSharedFiles,
  serializeSharedFiles,
  uploadShare,
  SHARE_HASH,
  SHARE_FILES_HASH,
  type SharedFilesPayload,
} from "@/lib/share";
import { MAX_UPLOAD_BYTES, getMaxStorageBytes, formatBytes } from "@/lib/storage-limits";

type Theme = ThemePref;

const SIDEBAR_MIN = 220;
const SIDEBAR_MAX = 480;
const SIDEBAR_DEFAULT = 288;
const SIDEBAR_WIDTH_KEY = "localdox:sidebarWidth";

const clampWidth = (w: number) => Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, w));

// Shared empties, so "this file has no highlights / nothing saved" is always the
// same array. A fresh `[]` would be a new prop identity on every render.
const EMPTY_HIGHLIGHTS: Highlight[] = [];
const EMPTY_SAVED: SavedItem[] = [];

function loadSidebarWidth(): number {
  if (typeof localStorage === "undefined") return SIDEBAR_DEFAULT;
  const v = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY));
  return v >= SIDEBAR_MIN && v <= SIDEBAR_MAX ? v : SIDEBAR_DEFAULT;
}

interface WorkspaceLite {
  id: string;
  name: string;
  docCount?: number;
}

/**
 * Stored file → in-memory file.
 *
 * Structure is deliberately not parsed here. This runs for every document in
 * the workspace during hydrate, before the first paint, and parsing each one
 * meant scanning the entire workspace's text up front — most of it for
 * documents the reader never opens. `fileSubtopics()` derives (and caches) a
 * document's sections the first time something actually asks.
 */
function toMdFile(f: PersistedFile): MdFile {
  return {
    id: f.id,
    name: f.name,
    content: f.content,
    data: f.data,
    mimeType: f.mimeType,
    size: f.size,
    addedAt: f.addedAt,
    kind: f.kind ?? getDocumentKind(f.name, f.mimeType),
    folderId: f.folderId ?? null,
  };
}

/** `report.md` → `report (2).md` when the workspace already holds that name. */
function uniqueFileName(name: string, taken: Set<string>): string {
  if (!taken.has(name)) return name;
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  for (let n = 2; ; n++) {
    const candidate = `${stem} (${n})${ext}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/**
 * Workspace names are how the reader tells one workspace from another in the
 * switcher, so two carrying the same name is a real ambiguity rather than a
 * cosmetic one. Compared case- and whitespace-insensitively: "Notes" and
 * "notes " are the same name to a person reading the list.
 */
function normalizeWorkspaceName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

/** `Notes` → `Notes (2)` when a workspace already carries that name. */
function availableWorkspaceName(name: string, existing: { name: string }[]): string {
  const taken = new Set(existing.map((w) => normalizeWorkspaceName(w.name)));
  const base = name.trim() || "Workspace";
  if (!taken.has(normalizeWorkspaceName(base))) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base} (${n})`;
    if (!taken.has(normalizeWorkspaceName(candidate))) return candidate;
  }
}

/**
 * Asks for a different workspace name until one is free, or the reader cancels.
 *
 * `existing` holds the names already in use; `excludeId` lets a rename keep its
 * own current name. Returns the accepted name, or `null` when the reader backs
 * out of the prompt.
 */
function resolveWorkspaceName(
  proposed: string,
  existing: { id: string; name: string }[],
  opts: { excludeId?: string; whatIsIt?: string } = {},
): string | null {
  const { excludeId, whatIsIt = "A workspace" } = opts;
  const taken = new Set(
    existing.filter((w) => w.id !== excludeId).map((w) => normalizeWorkspaceName(w.name)),
  );
  let candidate = proposed.trim();
  while (candidate && taken.has(normalizeWorkspaceName(candidate))) {
    const next = window.prompt(
      `${whatIsIt} named “${candidate}” already exists. Enter a different name:`,
      candidate,
    );
    if (next == null) return null; // cancelled — leave everything untouched
    candidate = next.trim();
  }
  return candidate || null;
}

/**
 * A file already in the workspace that the incoming one duplicates.
 *
 * Two kinds of duplicate matter, and they are not the same problem: the same
 * bytes arriving again (re-uploading a file that is already here, which is
 * simply redundant) and a different document arriving under a name that is
 * taken (which would leave two indistinguishable rows in the sidebar).
 */
type DuplicateKind = "content" | "name";

function fileFingerprint(f: { content?: string; data?: string }): string {
  // Binary files carry their bytes in `data`; text ones in `content`. Either is
  // a faithful identity for "the same file uploaded twice".
  return f.data ?? f.content ?? "";
}

function findDuplicate(
  incoming: { name: string; content?: string; data?: string },
  existing: MdFile[],
): { kind: DuplicateKind; file: MdFile } | null {
  const print = fileFingerprint(incoming);
  if (print) {
    const same = existing.find((f) => fileFingerprint(f) === print);
    if (same) return { kind: "content", file: same };
  }
  const clash = existing.find((f) => f.name === incoming.name);
  return clash ? { kind: "name", file: clash } : null;
}

export function DocsApp() {
  const [files, setFiles] = useState<MdFile[]>([]);
  // Sidebar folders. Flat buckets over the file list — a file's `folderId` says
  // which one it sits in, so folders can appear and disappear without touching
  // the documents themselves.
  const [folders, setFolders] = useState<FolderRecord[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  // A just-created blank document: the viewer opens straight into its editor so
  // the reader can paste markdown in without hunting for the Edit button.
  const [autoEditFileId, setAutoEditFileId] = useState<string | null>(null);
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null);
  const [scrollTarget, setScrollTarget] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => loadPrefs().theme);
  const [readingMode, setReadingMode] = useState<ReadingMode>(() => loadPrefs().readingMode);
  const [readingFont, setReadingFont] = useState<ReadingFont>(() => loadPrefs().readingFont);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(loadSidebarWidth);
  const [highlightQuery, setHighlightQuery] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  // File ids in most-recently-opened order — drives the "Recent" chip.
  const [recentFileIds, setRecentFileIds] = useState<string[]>([]);

  // Persistence-facing state.
  const [booting, setBooting] = useState(true);
  const [workspaces, setWorkspaces] = useState<WorkspaceLite[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  // Stars. Not just files any more: a star can point at a section, a table, a
  // code block or a passage the reader selected. Legacy `${fileId}#${sectionId}`
  // bookmarks are read as saved items on hydrate (see `migrateBookmarks`).
  const [saved, setSaved] = useState<SavedItem[]>([]);
  /** A saved item the reader just opened — handed to the viewer to scroll to. */
  const [pendingSaved, setPendingSaved] = useState<SavedItem | null>(null);
  // Highlights are the one reader action with no other way back — a mis-drag
  // silently replaces whatever it overlaps — so they get an undo stack.
  // `resetHighlights` loads a workspace without making the previous one's
  // highlights reachable by pressing undo.
  const {
    state: highlights,
    set: setHighlights,
    amend: amendHighlights,
    reset: resetHighlights,
    undo: undoHighlights,
    redo: redoHighlights,
    canUndo: canUndoHighlights,
    canRedo: canRedoHighlights,
  } = useHistory<Highlight[]>([]);
  // File whose highlights are shown in isolation via the "Show highlights only"
  // menu item; null when the modal is closed.
  const [highlightsOnlyFileId, setHighlightsOnlyFileId] = useState<string | null>(null);
  // Files arriving from a `#share-files=` link, held until the reader picks
  // between a new workspace and the one they already have open.
  const [incomingShare, setIncomingShare] = useState<SharedFilesPayload | null>(null);
  const [importingShare, setImportingShare] = useState(false);
  // Ask AI panel: open state + the selection/action it was seeded from.
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrefill, setAiPrefill] = useState<AskAiPrefill | null>(null);
  // Sidebar chip + sort state, shared across the desktop header, the mobile
  // chip row, and the mobile three-dots menu (rendered outside <Sidebar>).
  const [sidebarView, setSidebarView] = useState<SidebarView>(DEFAULT_VIEW);

  // Home page + personalization.
  const location = useLocation();
  const navigate = useNavigate();
  const showSettings = location.pathname === "/settings";
  const [userName, setUserName] = useState<string | null>(null);
  const firstVisitRef = useRef(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const sidebarWrapRef = useRef<HTMLDivElement>(null);
  const sidebarInnerRef = useRef<HTMLDivElement>(null);
  const widthRef = useRef(sidebarWidth);
  const firstCollapseRun = useRef(true);

  // Refs the (async, debounced) save reads from, so it always writes the latest
  // state without being recreated on every render.
  const snapshotRef = useRef({
    files,
    folders,
    activeFileId,
    expanded,
    sidebarCollapsed,
    saved,
    highlights,
    recentFileIds,
  });
  snapshotRef.current = {
    files,
    folders,
    activeFileId,
    expanded,
    sidebarCollapsed,
    saved,
    highlights,
    recentFileIds,
  };
  const scrollRef = useRef(0);
  const activeFileNameRef = useRef<string | null>(null);
  const readingModeRef = useRef(readingMode);
  const workspaceIdRef = useRef<string | null>(null);
  const workspaceNameRef = useRef("My workspace");
  const createdAtRef = useRef(Date.now());
  const hydratedRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoredFlash = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    widthRef.current = sidebarWidth;
  }, [sidebarWidth]);

  // Collapse/expand the desktop sidebar; the main column is flex-1, so animating
  // the sidebar width lets content reflow frame-by-frame rather than snapping.
  // Width is driven imperatively so a re-render can't clobber the tween.
  //
  // This and one fade in the markdown viewer were the app's only uses of GSAP —
  // 153 kB in the initial download for two keyframe pairs. They run on the Web
  // Animations API now, which the browser can hand to the compositor.
  useEffect(() => {
    const wrap = sidebarWrapRef.current;
    if (!wrap) return;
    const inner = sidebarInnerRef.current;
    const width = sidebarCollapsed ? 56 : widthRef.current;
    const opacity = sidebarCollapsed ? 0 : 1;
    const shift = sidebarCollapsed ? -16 : 0;

    // First run positions without animating: the restored state shouldn't play
    // an entrance every time the app boots.
    if (firstCollapseRun.current) {
      firstCollapseRun.current = false;
      wrap.style.width = `${width}px`;
      if (inner) {
        inner.style.opacity = String(opacity);
        inner.style.visibility = sidebarCollapsed ? "hidden" : "visible";
        inner.style.transform = `translateX(${shift}px)`;
      }
      return;
    }

    const animations: Animation[] = [];
    // Width isn't compositable, but this element is a fixed-width flex sibling
    // of the content column — the reflow it drives is the point of the effect.
    if (wrap.animate) {
      animations.push(
        wrap.animate(
          [{ width: wrap.getBoundingClientRect().width + "px" }, { width: `${width}px` }],
          {
            duration: 450,
            easing: "cubic-bezier(0.65, 0, 0.35, 1)",
            fill: "forwards",
          },
        ),
      );
    }
    wrap.style.width = `${width}px`;

    if (inner) {
      // Expanding: become visible up front so the fade-in is actually seen.
      // Collapsing: stay visible until the fade finishes, then drop out of
      // hit-testing — a transparent-but-visible sidebar would swallow clicks
      // meant for the collapsed icon rail underneath it.
      if (!sidebarCollapsed) inner.style.visibility = "visible";

      const fade = inner.animate?.(
        [
          { opacity: inner.style.opacity || "1", transform: inner.style.transform || "none" },
          { opacity: String(opacity), transform: `translateX(${shift}px)` },
        ],
        {
          duration: sidebarCollapsed ? 250 : 400,
          easing: "cubic-bezier(0.16, 1, 0.3, 1)",
          fill: "forwards",
        },
      );
      inner.style.opacity = String(opacity);
      inner.style.transform = `translateX(${shift}px)`;

      if (sidebarCollapsed) {
        if (fade) {
          animations.push(fade);
          void fade.finished
            .then(() => {
              // Guard against a re-expand landing while the fade was running.
              if (inner.style.opacity === "0") inner.style.visibility = "hidden";
            })
            .catch(() => {
              /* cancelled by a state change — the next run sets visibility */
            });
        } else {
          inner.style.visibility = "hidden";
        }
      } else if (fade) {
        animations.push(fade);
      }
    }

    return () => animations.forEach((a) => a.cancel());
  }, [sidebarCollapsed]);

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = widthRef.current;
    const onMove = (ev: MouseEvent) => {
      const w = clampWidth(startW + (ev.clientX - startX));
      widthRef.current = w;
      if (sidebarWrapRef.current) sidebarWrapRef.current.style.width = `${w}px`;
      setSidebarWidth(w);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      try {
        localStorage.setItem(SIDEBAR_WIDTH_KEY, String(widthRef.current));
      } catch {
        /* storage unavailable — width stays for this session only */
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
  }, []);

  // Theme: apply to <html> and persist as a lightweight preference.
  // Apply the selected reader theme. All five themes are keyed by the
  // `data-theme` attribute; dark-based themes also carry the `.dark` class so
  // dark-only rules (code highlighting, katex, mermaid) keep working.
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
    root.classList.toggle("dark", isDarkTheme(theme));
  }, [theme]);

  // Reading typeface is keyed by `data-font`; "system" uses the base vars.
  // The webfont itself is fetched here rather than bundled into the app's
  // stylesheet — the attribute applies immediately against the system fallback
  // and the real face swaps in when it lands.
  useEffect(() => {
    const root = document.documentElement;
    if (readingFont === "system") root.removeAttribute("data-font");
    else root.setAttribute("data-font", readingFont);
    loadReadingFont(readingFont);
  }, [readingFont]);

  // Inter backs the app chrome, and syntax highlighting / math typesetting back
  // most documents. All three are requested off the critical path: the first
  // paint runs on system fonts and unhighlighted code, and each upgrade lands
  // without the reader having waited on it.
  useEffect(() => {
    warmAppFonts();
    warmMarkdownPlugins();
  }, []);

  useEffect(() => {
    savePrefs({ theme });
  }, [theme]);

  useEffect(() => {
    savePrefs({ readingMode });
  }, [readingMode]);

  useEffect(() => {
    savePrefs({ readingFont });
  }, [readingFont]);

  // ---- persistence core ----

  const buildRecord = useCallback((): WorkspaceRecord => {
    const s = snapshotRef.current;
    return {
      id: workspaceIdRef.current ?? crypto.randomUUID(),
      name: workspaceNameRef.current,
      createdAt: createdAtRef.current,
      updatedAt: Date.now(),
      files: s.files.map((f) => ({
        id: f.id,
        name: f.name,
        content: f.content,
        data: f.data,
        mimeType: f.mimeType,
        size: f.size,
        addedAt: f.addedAt,
        kind: f.kind,
        folderId: f.folderId ?? null,
      })),
      folders: s.folders,
      // `bookmarks` is the legacy projection of `saved`, still written so an
      // older build reading this workspace keeps its file/section stars.
      bookmarks: toLegacyBookmarks(s.saved),
      saved: s.saved,
      highlights: s.highlights,
      ui: {
        activeFileId: s.activeFileId,
        expanded: s.expanded,
        sidebarCollapsed: s.sidebarCollapsed,
        scrollTop: scrollRef.current,
        fileOrder: s.files.map((f) => f.id),
        recentFileIds: s.recentFileIds,
      },
    };
  }, []);

  // Writing a workspace means structured-cloning every document in it, so a
  // redundant write is one of the most expensive things this app can do.
  // `mutationRef` counts user mutations and `savedMutationRef` records the count
  // at the last successful write; a save with nothing new to say is skipped.
  const mutationRef = useRef(0);
  const savedMutationRef = useRef(0);

  const persistNow = useCallback(
    async (silent: boolean) => {
      if (!workspaceIdRef.current) return;
      if (mutationRef.current === savedMutationRef.current) {
        // Nothing changed since the last write. Still settle the indicator, so
        // a "Saving…" left over from a coalesced burst doesn't stick.
        if (!silent) setSaveStatus("saved");
        return;
      }
      const pending = mutationRef.current;
      try {
        await persistence.putWorkspace(buildRecord());
        savedMutationRef.current = pending;
        if (!silent) setSaveStatus("saved");
      } catch {
        if (!silent) setSaveStatus("idle");
      }
    },
    [buildRecord],
  );

  // Called by every user mutation. Shows "Saving…", then writes after a pause.
  const markDirty = useCallback(() => {
    if (!hydratedRef.current || !workspaceIdRef.current) return;
    mutationRef.current++;
    setSaveStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void persistNow(false), 700);
  }, [persistNow]);

  const hydrateWorkspace = useCallback(
    (ws: WorkspaceRecord) => {
      const wsFolders = ws.folders ?? [];
      const folderIds = new Set(wsFolders.map((f) => f.id));
      // A file can outlive its folder (an older export, a share link that carried
      // files but no folders). Those fall back to the top level instead of
      // vanishing into a folder that is never rendered.
      const parsed: MdFile[] = ws.files.map((f) => {
        const file = toMdFile(f);
        return file.folderId && folderIds.has(file.folderId) ? file : { ...file, folderId: null };
      });

      if (ws.ui?.fileOrder && ws.ui.fileOrder.length > 0) {
        const order = ws.ui.fileOrder;
        parsed.sort((a, b) => {
          const idxA = order.indexOf(a.id);
          const idxB = order.indexOf(b.id);
          if (idxA === -1 && idxB === -1) return 0;
          if (idxA === -1) return 1;
          if (idxB === -1) return -1;
          return idxA - idxB;
        });
      }

      setFiles(parsed);
      setFolders(wsFolders);
      setAutoEditFileId(null);
      setActiveFileId(ws.ui?.activeFileId ?? parsed[0]?.id ?? null);
      setRecentFileIds(ws.ui?.recentFileIds ?? []);
      setExpanded(ws.ui?.expanded ?? {});
      setSidebarCollapsed(!!ws.ui?.sidebarCollapsed);
      setSaved(ws.saved?.length ? ws.saved : migrateBookmarks(ws.bookmarks ?? [], parsed));
      resetHighlights((ws.highlights ?? []).filter((h) => typeof h.text === "string"));
      setWorkspaceId(ws.id);
      workspaceIdRef.current = ws.id;
      workspaceNameRef.current = ws.name;
      createdAtRef.current = ws.createdAt ?? Date.now();
      // The live position is tracked in localStorage (see `saveScrollTop`); the
      // record's own value is the fallback for an imported or shared workspace
      // that has never been scrolled on this device.
      const st = loadScrollTop(ws.id) ?? ws.ui?.scrollTop ?? 0;
      scrollRef.current = st;
      // A freshly hydrated workspace is exactly what is on disk.
      mutationRef.current = 0;
      savedMutationRef.current = 0;
      // Restore the exact scroll after the document has painted. Runs after the
      // viewer's own mount effects, so it wins.
      setTimeout(() => window.scrollTo({ top: st }), 350);
      setSaveStatus("restored");
      if (restoredFlash.current) clearTimeout(restoredFlash.current);
      restoredFlash.current = setTimeout(
        () => setSaveStatus((s) => (s === "restored" ? "saved" : s)),
        2500,
      );
    },
    [resetHighlights],
  );

  const refreshWorkspaceList = useCallback(async () => {
    const list = await persistence.listWorkspaces().catch(() => [] as WorkspaceRecord[]);
    list.sort((a, b) => a.createdAt - b.createdAt);
    setWorkspaces(list.map((w) => ({ id: w.id, name: w.name, docCount: w.files?.length || 0 })));
  }, []);

  // Restore the previous session on first load.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const prefs = loadPrefs();
        setUserName(prefs.name);
        firstVisitRef.current = !prefs.name;

        let hashSharedWs: WorkspaceRecord | null = null;
        if (window.location.hash.startsWith(SHARE_HASH)) {
          try {
            const json = await fetchShare(window.location.hash.slice(SHARE_HASH.length));
            const ws = parseWorkspaceImport(json);
            ws.id = crypto.randomUUID();
            // This runs during boot, before anything is on screen, so a name
            // clash is settled by numbering rather than by a modal prompt the
            // reader would meet before the app has even drawn.
            const already = await persistence.listWorkspaces().catch(() => [] as WorkspaceRecord[]);
            ws.name = availableWorkspaceName(`${ws.name} (Shared)`, already);
            await persistence.putWorkspace(ws);
            hashSharedWs = ws;
            window.history.replaceState(
              null,
              "",
              window.location.pathname + window.location.search,
            );
            toast.success("Shared workspace imported successfully!");
          } catch (e) {
            console.error("Failed to import shared workspace", e);
            toast.error("Invalid or corrupted shared workspace link.");
          }
        }

        const list = await persistence.listWorkspaces().catch(() => [] as WorkspaceRecord[]);
        if (list.length === 0 && !hashSharedWs) {
          if (!alive) return;
          setWorkspaces([]);
          setWorkspaceId(null);
          workspaceIdRef.current = null;
          setSaveStatus("idle");
        } else {
          const ws = hashSharedWs || (list.find((w) => w.id === prefs.lastWorkspaceId) ?? list[0]);
          if (!alive) return;
          list.sort((a, b) => a.createdAt - b.createdAt);
          setWorkspaces(
            list.map((w) => ({ id: w.id, name: w.name, docCount: w.files?.length || 0 })),
          );
          hydrateWorkspace(ws);
          savePrefs({ lastWorkspaceId: ws.id });
        }
      } finally {
        if (alive) {
          hydratedRef.current = true;
          setBooting(false);
        }
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist scroll position and flush pending edits on tab hide / unload.
  //
  // The scroll handler used to schedule a full workspace write. It now records
  // the position in localStorage instead — one small string, no clone of the
  // document set — and the IndexedDB write is left to real mutations.
  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      // Reading scrollY is cheap, but doing it inside the scroll event competes
      // with the browser's own scrolling work; sample it on the next frame.
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        scrollRef.current = window.scrollY;
        if (!hydratedRef.current) return;
        if (scrollTimer.current) clearTimeout(scrollTimer.current);
        scrollTimer.current = setTimeout(() => {
          const id = workspaceIdRef.current;
          if (id) saveScrollTop(id, scrollRef.current);
        }, 400);
      });
    };
    const flush = () => {
      if (!hydratedRef.current) return;
      const id = workspaceIdRef.current;
      if (id) saveScrollTop(id, scrollRef.current);
      void persistNow(true);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("beforeunload", flush);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", flush);
    };
  }, [persistNow]);

  // ---- file + navigation actions (each marks the workspace dirty) ----

  const addFiles = useCallback(
    async (fileList: File[]) => {
      if (fileList.length === 0) return;

      // Reject any single file over the per-file cap before touching disk.
      const oversize = fileList.filter((f) => f.size > MAX_UPLOAD_BYTES);
      if (oversize.length) {
        const names = oversize.map((f) => f.name).join(", ");
        toast.error(
          `${names} exceeds the ${formatBytes(MAX_UPLOAD_BYTES)} per-file limit. Please upload a smaller file.`,
        );
      }
      const accepted = fileList.filter((f) => f.size <= MAX_UPLOAD_BYTES);
      if (accepted.length === 0) return;

      // Enforce the hard total-storage ceiling (5% of the browser quota).
      const maxStorage = await getMaxStorageBytes();
      if (maxStorage != null) {
        const usedBytes = snapshotRef.current.files.reduce((sum, f) => sum + (f.size ?? 0), 0);
        const incomingBytes = accepted.reduce((sum, f) => sum + f.size, 0);
        if (usedBytes + incomingBytes > maxStorage) {
          toast.error(
            `Storage full — this application is strictly capped at ${formatBytes(maxStorage)}. Remove some files before uploading more.`,
          );
          return;
        }
      }

      const total = accepted.length;
      const toastId = toast.loading(`Uploading ${total} file${total > 1 ? "s" : ""}...`);

      try {
        let loaded = 0;
        const parsed: MdFile[] = await Promise.all(
          accepted.map(async (f) => {
            const imported = await importDocumentFile(f);
            loaded++;
            toast.loading(
              `Uploading ${total} file${total > 1 ? "s" : ""}... ${Math.round((loaded / total) * 100)}%`,
              { id: toastId },
            );
            return imported;
          }),
        );

        // Duplicate check runs after parsing, because "the same file" means the
        // same bytes, not the same filename. A re-upload of something already
        // here is dropped; a genuinely different document arriving under a
        // taken name is kept, under a name the reader chooses.
        const kept: MdFile[] = [];
        const skipped: string[] = [];
        // Grows as the batch is processed, so two identical files picked in one
        // go are caught against each other, not just against what is stored.
        const pool = [...snapshotRef.current.files];

        for (const file of parsed) {
          const dup = findDuplicate(file, pool);
          if (dup?.kind === "content") {
            skipped.push(file.name);
            continue;
          }
          if (dup?.kind === "name") {
            const taken = new Set(pool.map((f) => f.name));
            const suggestion = uniqueFileName(file.name, taken);
            const answer = window.prompt(
              `“${file.name}” already exists in this workspace and the contents differ. ` +
                `Enter a name for the new copy, or cancel to skip it:`,
              suggestion,
            );
            const chosen = answer?.trim();
            if (!chosen) {
              skipped.push(file.name);
              continue;
            }
            file.name = uniqueFileName(chosen, taken);
            file.kind = getDocumentKind(file.name, file.mimeType);
          }
          kept.push(file);
          pool.push(file);
        }

        if (skipped.length) {
          const label =
            skipped.length === 1 ? `“${skipped[0]}”` : `${skipped.length} duplicate files`;
          toast.info(`Skipped ${label} — already in this workspace.`);
        }
        if (kept.length === 0) {
          toast.dismiss(toastId);
          return;
        }

        const nextFiles = [...snapshotRef.current.files, ...kept];
        // Keep the currently open file if one is open; otherwise open the first
        // of the just-uploaded batch.
        const nextActiveFileId = snapshotRef.current.activeFileId ?? kept[0]?.id ?? null;

        if (!workspaceIdRef.current) {
          const id = crypto.randomUUID();
          workspaceIdRef.current = id;
          workspaceNameRef.current = "My workspace";
          createdAtRef.current = Date.now();
          setWorkspaceId(id);
          setWorkspaces([{ id, name: workspaceNameRef.current, docCount: nextFiles.length }]);
          savePrefs({ lastWorkspaceId: id });
        }

        // The home and reader are separate route components. Persist before
        // navigating so the reader's new DocsApp instance can hydrate the upload.
        snapshotRef.current = {
          ...snapshotRef.current,
          files: nextFiles,
          activeFileId: nextActiveFileId,
        };
        setFiles(nextFiles);
        setActiveFileId(nextActiveFileId);
        setSaveStatus("saving");
        await persistence.putWorkspace(buildRecord());
        setSaveStatus("saved");

        toast.success(`Successfully uploaded ${kept.length} file${kept.length > 1 ? "s" : ""}!`, {
          id: toastId,
        });
        navigate({ to: "/" }); // Uploading takes you straight into reading.
      } catch {
        setSaveStatus("idle");
        toast.error("Could not upload the selected file(s). Please try again.", { id: toastId });
      }
    },
    [buildRecord, navigate],
  );

  const handleFileInput = useCallback(
    (list: FileList | null) => {
      if (!list) return;
      const picked = Array.from(list);
      if (picked.length) addFiles(picked);
    },
    [addFiles],
  );

  const [globalDrag, setGlobalDrag] = useState(false);

  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer?.types.includes("Files")) {
        setGlobalDrag(true);
      }
    };
    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      if (e.clientX === 0 && e.clientY === 0) {
        setGlobalDrag(false);
      }
    };
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      setGlobalDrag(false);
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        handleFileInput(e.dataTransfer.files);
      }
    };

    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("drop", handleDrop);

    return () => {
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("drop", handleDrop);
    };
  }, [handleFileInput]);

  const activeFile = useMemo(
    () => files.find((f) => f.id === activeFileId) ?? null,
    [files, activeFileId],
  );
  activeFileNameRef.current = activeFile?.name ?? null;
  readingModeRef.current = readingMode;

  // Identity of the workspace's file set, used to invalidate the artifact
  // resolution cache and to key embed rendering. Built by walking every file, so
  // it is memoized rather than recomputed on every render of the app shell.
  const workspaceRevision = useMemo(
    () =>
      files
        .map((file) => `${file.id}:${file.name}:${file.content.length}:${file.data?.length ?? 0}`)
        .join("|"),
    [files],
  );

  const { prevFile, nextFile } = useMemo(() => {
    const idx = activeFile ? files.findIndex((f) => f.id === activeFile.id) : -1;
    return {
      prevFile: idx > 0 ? files[idx - 1] : null,
      nextFile: idx >= 0 && idx < files.length - 1 ? files[idx + 1] : null,
    };
  }, [files, activeFile]);

  // `files` is read through a ref by the callbacks below so that selecting,
  // deleting or downloading a document doesn't have to be a new function on
  // every render — those go straight into <Sidebar>, which is memoized and
  // would otherwise re-render its entire list whenever anything here changed.
  const filesRef = useRef(files);
  filesRef.current = files;
  const activeFileIdRef = useRef(activeFileId);
  activeFileIdRef.current = activeFileId;
  const pathnameRef = useRef(location.pathname);
  pathnameRef.current = location.pathname;

  const handleSelect = useCallback(
    (fileId: string, headingId?: string, query?: string) => {
      setActiveFileId(fileId);
      if (query !== undefined) setHighlightQuery(query || null);

      let targetHeadingId = headingId;
      if (!targetHeadingId) {
        const file = filesRef.current.find((f) => f.id === fileId);
        const subs = file ? fileSubtopics(file) : [];
        targetHeadingId = subs?.[0]?.id || "preamble";
      }
      setActiveHeadingId(targetHeadingId);

      if (pathnameRef.current !== "/") {
        navigate({ to: "/" });
      }

      setDrawerOpen(false);
      markDirty();
    },
    [navigate, markDirty],
  );

  const removeFile = useCallback(
    (id: string) => {
      const files = filesRef.current;
      const index = files.findIndex((f) => f.id === id);
      const fileToRestore = files[index];
      const activeWas = activeFileIdRef.current;

      if (!fileToRestore) return;

      setFiles((prev) => prev.filter((f) => f.id !== id));
      if (activeWas === id) {
        setActiveFileId(files.find((f) => f.id !== id)?.id ?? null);
      }
      markDirty();

      toast("File deleted", {
        description: fileToRestore.name,
        duration: 6000,
        icon: <Undo2 className="h-4 w-4" />,
        className: "bg-background/60 backdrop-blur-xl border border-border/50 shadow-2xl",
        action: {
          label: "Undo",
          onClick: () => {
            setFiles((prev) => {
              const newFiles = [...prev];
              newFiles.splice(index, 0, fileToRestore);
              return newFiles;
            });
            if (activeWas === id) {
              setActiveFileId(id);
            }
            markDirty();
          },
        },
      });
    },
    [markDirty],
  );

  const toggleArchiveFile = useCallback(
    (id: string) => {
      setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, isArchived: !f.isArchived } : f)));
      markDirty();
    },
    [markDirty],
  );

  const downloadFile = useCallback((id: string) => {
    const file = filesRef.current.find((f) => f.id === id);
    if (!file) return;
    let url = "";
    if (file.data) {
      url = file.data;
    } else {
      const blob = new Blob([file.content], { type: file.mimeType || "text/markdown" });
      url = URL.createObjectURL(blob);
    }
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    if (!file.data) URL.revokeObjectURL(url);
  }, []);

  const renameFile = useCallback(
    (id: string, newName: string) => {
      setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, name: newName } : f)));
      markDirty();
    },
    [markDirty],
  );

  /**
   * Blank markdown document, created from the sidebar's New menu. It opens
   * immediately in the viewer's editor so the reader can paste markdown into
   * it; from there the normal autosave path takes over.
   */
  const createFile = useCallback(
    (folderId?: string | null) => {
      const taken = new Set(snapshotRef.current.files.map((f) => f.name));
      const name = uniqueFileName("new.md", taken);
      const id = `${name}-${crypto.randomUUID().slice(0, 8)}`;
      const doc: MdFile = {
        id,
        name,
        content: "",
        mimeType: "text/markdown",
        size: 0,
        addedAt: Date.now(),
        kind: "markdown",
        folderId: folderId ?? null,
        headings: [],
      };
      // Creating the very first document also creates the workspace it lives
      // in, the same way the first upload does — otherwise nothing persists.
      if (!workspaceIdRef.current) {
        const workspace = crypto.randomUUID();
        workspaceIdRef.current = workspace;
        workspaceNameRef.current = "My workspace";
        createdAtRef.current = Date.now();
        setWorkspaceId(workspace);
        setWorkspaces([{ id: workspace, name: workspaceNameRef.current, docCount: 1 }]);
        savePrefs({ lastWorkspaceId: workspace });
      }

      setFiles((prev) => [...prev, doc]);
      setActiveFileId(id);
      setActiveHeadingId(null);
      setAutoEditFileId(id);
      setDrawerOpen(false);
      if (location.pathname !== "/") navigate({ to: "/" });
      markDirty();
      toast.success(`Created ${name}`, { description: "Paste your markdown, then Save." });
    },
    [location.pathname, navigate, markDirty],
  );

  const createFolder = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const folder: FolderRecord = {
        id: crypto.randomUUID(),
        name: trimmed,
        createdAt: Date.now(),
      };
      setFolders((prev) => [...prev, folder]);
      markDirty();
      toast.success(`Created folder "${trimmed}"`);
    },
    [markDirty],
  );

  const renameFolder = useCallback(
    (id: string, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, name: trimmed } : f)));
      markDirty();
    },
    [markDirty],
  );

  /** Deleting a folder keeps its documents — they move back to the top level. */
  const deleteFolder = useCallback(
    (id: string) => {
      setFolders((prev) => prev.filter((f) => f.id !== id));
      setFiles((prev) => prev.map((f) => (f.folderId === id ? { ...f, folderId: null } : f)));
      markDirty();
    },
    [markDirty],
  );

  const moveFileToFolder = useCallback(
    (fileId: string, folderId: string | null) => {
      setFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, folderId } : f)));
      markDirty();
    },
    [markDirty],
  );

  const reorderFile = useCallback(
    (oldIndex: number, newIndex: number) => {
      setFiles((prev) => {
        const next = [...prev];
        const [moved] = next.splice(oldIndex, 1);
        next.splice(newIndex, 0, moved);
        return next;
      });
      markDirty();
    },
    [markDirty],
  );

  const addHighlight = useCallback(
    (hl: Omit<Highlight, "id" | "fileId">, fileId: string) => {
      setHighlights((prev) => {
        const overlaps = prev.filter(
          (p) =>
            p.fileId === fileId &&
            p.subtopicId === hl.subtopicId &&
            typeof p.start === "number" &&
            typeof p.end === "number" &&
            typeof hl.start === "number" &&
            typeof hl.end === "number" &&
            !(hl.end <= p.start || hl.start >= p.end),
        );
        const withoutOverlaps = prev.filter((p) => !overlaps.includes(p));
        return [...withoutOverlaps, { id: crypto.randomUUID(), fileId, ...hl }];
      });
      markDirty();
    },
    [markDirty],
  );

  const updateHighlight = useCallback(
    (id: string, patch: Partial<{ color: string; label: string }>) => {
      setHighlights((prev) => prev.map((h) => (h.id === id ? { ...h, ...patch } : h)));
      markDirty();
    },
    [markDirty],
  );

  const removeHighlight = useCallback(
    (id: string) => {
      setHighlights((prev) => prev.filter((h) => h.id !== id));
      markDirty();
    },
    [markDirty],
  );

  // The viewer re-anchors highlights whose text moved (the document was edited)
  // and hands back the corrected offsets. Not an undoable step — the reader
  // didn't do it — but persisted, so the repair survives a reload.
  const repairHighlights = useCallback(
    (patches: Array<{ id: string; patch: Partial<Highlight> }>) => {
      if (!patches.length) return;
      const byId = new Map(patches.map((p) => [p.id, p.patch]));
      amendHighlights((prev) => {
        let changed = false;
        const next = prev.map((h) => {
          const patch = byId.get(h.id);
          if (!patch) return h;
          const merged = { ...h, ...patch };
          if ((Object.keys(patch) as Array<keyof Highlight>).every((k) => h[k] === merged[k])) {
            return h;
          }
          changed = true;
          return merged;
        });
        return changed ? next : prev;
      });
      markDirty();
    },
    [amendHighlights, markDirty],
  );

  // Undo/redo for highlights. Cmd on macOS, Ctrl elsewhere; redo accepts both
  // the Windows form (Ctrl+Y) and the macOS one (Cmd+Shift+Z).
  //
  // Two things are deliberately left alone: a focused input or textarea keeps
  // its native undo (the markdown editor lives in one), and if there is nothing
  // to undo the event is not consumed, so the browser's own undo still works.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!hasModKey(e)) return;
      if (isEditableTarget(e.target)) return;
      const key = e.key.toLowerCase();

      const isRedo = key === "y" || (key === "z" && e.shiftKey);
      const isUndo = key === "z" && !e.shiftKey;
      if (!isRedo && !isUndo) return;

      if (isRedo) {
        if (!canRedoHighlights) return;
        e.preventDefault();
        redoHighlights();
        toast("Redid highlight change");
      } else {
        if (!canUndoHighlights) return;
        e.preventDefault();
        undoHighlights();
        toast("Undid highlight change");
      }
      markDirty();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canUndoHighlights, canRedoHighlights, undoHighlights, redoHighlights, markDirty]);

  const toggleFile = useCallback(
    (fileId: string) => {
      setExpanded((e) => ({ ...e, [fileId]: !(e[fileId] ?? fileId === activeFileId) }));
      markDirty();
    },
    [activeFileId, markDirty],
  );

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((c) => !c);
    markDirty();
  }, [markDirty]);

  // Star or unstar one thing. Identity is what the star points at (file,
  // section anchor, or the passage's text), never a generated id — re-saving
  // the same table has to find the existing star, not add a second one.
  const toggleSaved = useCallback(
    (fileId: string, draft: SavedDraft) => {
      setSaved((prev) => {
        const key = savedKey({ fileId, ...draft });
        const hit = prev.find((s) => savedKey(s) === key);
        return hit
          ? prev.filter((s) => s.id !== hit.id)
          : [...prev, { ...draft, id: newSavedId(), fileId, createdAt: Date.now() }];
      });
      markDirty();
    },
    [markDirty],
  );

  const removeSaved = useCallback(
    (id: string) => {
      setSaved((prev) => prev.filter((s) => s.id !== id));
      markDirty();
    },
    [markDirty],
  );

  const sortFilesByName = useCallback(() => {
    setFiles((prev) => {
      const next = [...prev].sort((a, b) => a.name.localeCompare(b.name));
      return next;
    });
    markDirty();
  }, [markDirty]);

  const openFromHome = useCallback(
    async (fileId: string, subtopicId?: string) => {
      const file = filesRef.current.find((item) => item.id === fileId);
      if (!file) return;

      const chunks = fileSubtopics(file);
      const targetSubtopicId = subtopicId ?? chunks[0]?.id ?? "preamble";

      // Collapse sidebar to show only the document
      setSidebarCollapsed(true);

      // Home and reader are separate route instances. Save the selection before
      // navigating so the reader hydrates the document the user chose, rather
      // than the workspace's previously open document.
      snapshotRef.current = {
        ...snapshotRef.current,
        activeFileId: fileId,
      };
      setActiveFileId(fileId);
      setActiveHeadingId(targetSubtopicId);

      if (workspaceIdRef.current) {
        setSaveStatus("saving");
        try {
          await persistence.putWorkspace(buildRecord());
          setSaveStatus("saved");
        } catch {
          setSaveStatus("idle");
        }
      }

      navigate({ to: "/" });
    },
    [buildRecord, navigate],
  );

  const handleContentChange = useCallback(
    (fileId: string, content: string) => {
      // Structure is dropped rather than recomputed. This fires on every pause
      // in typing, and re-parsing the whole document here put an O(document)
      // scan on the autosave path; whatever next reads the sections derives
      // them from the new content and caches the result.
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileId ? { ...f, content, headings: undefined, subtopics: undefined } : f,
        ),
      );
      markDirty();
    },
    [markDirty],
  );

  useEffect(() => {
    if (!activeFile) return;
    const hash = window.location.hash.slice(1);
    if (hash) {
      setScrollTarget(hash);
      setTimeout(() => setScrollTarget(null), 100);
    }
  }, [activeFileId]);

  // Track most-recently-opened files for the "Recent" chip. Every open path
  // sets activeFileId, so keying on it captures them all. Persisted to IndexedDB.
  useEffect(() => {
    if (!activeFileId) return;
    setRecentFileIds((prev) => {
      if (prev[0] === activeFileId) return prev;
      return [activeFileId, ...prev.filter((id) => id !== activeFileId)].slice(0, 30);
    });
    markDirty();
  }, [activeFileId, markDirty]);

  const cycleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  const nextReadingMin = nextFile ? readingMinutes(nextFile.content) : null;

  // ---- workspace management ----

  const switchWorkspace = useCallback(
    async (id: string) => {
      if (id === workspaceIdRef.current) return;
      await persistNow(true);
      const ws = await persistence.getWorkspace(id);
      if (!ws) return;
      hydrateWorkspace(ws);
      savePrefs({ lastWorkspaceId: id });
    },
    [persistNow, hydrateWorkspace],
  );

  const openEmbeddedArtifact = useCallback(
    async (fileId: string, targetWorkspaceId: string) => {
      if (targetWorkspaceId !== workspaceIdRef.current) await switchWorkspace(targetWorkspaceId);
      setActiveFileId(fileId);
      setActiveHeadingId("preamble");
      setDrawerOpen(false);
      if (location.pathname !== "/") navigate({ to: "/" });
    },
    [location.pathname, navigate, switchWorkspace],
  );

  useEffect(() => {
    clearArtifactResolutionCache();
  }, [workspaceRevision]);

  // The workspace list held in state is a render-time convenience; name checks
  // read the store directly so a workspace created in another tab still counts.
  const storedWorkspaces = useCallback(
    () => persistence.listWorkspaces().catch(() => [] as WorkspaceRecord[]),
    [],
  );

  const newWorkspace = useCallback(
    async (name?: string) => {
      const asked = name || window.prompt("Enter new workspace name:");
      if (!asked) return;
      const finalName = resolveWorkspaceName(asked, await storedWorkspaces());
      if (!finalName) return;
      await persistNow(true);
      const ws = newWorkspaceRecord(finalName);
      await persistence.putWorkspace(ws);
      await refreshWorkspaceList();
      hydrateWorkspace(ws);
      savePrefs({ lastWorkspaceId: ws.id });
    },
    [persistNow, refreshWorkspaceList, hydrateWorkspace, storedWorkspaces],
  );

  const importWorkspace = useCallback(
    async (file: File) => {
      try {
        const ws = parseWorkspaceImport(await file.text());
        const existing = await storedWorkspaces();

        // The same export imported twice would otherwise overwrite the copy
        // already here (`put` keys on id), silently discarding whatever has
        // been read, highlighted or saved in it since.
        const sameRecord = existing.find((w) => w.id === ws.id);
        if (sameRecord) {
          const keepBoth = window.confirm(
            `“${sameRecord.name}” has already been imported. ` +
              `Import it again as a separate copy?\n\n` +
              `Cancel leaves the workspace you already have untouched.`,
          );
          if (!keepBoth) {
            await switchWorkspace(sameRecord.id);
            return;
          }
          ws.id = crypto.randomUUID();
        }

        const finalName = resolveWorkspaceName(ws.name, existing, {
          excludeId: ws.id,
          whatIsIt: "A workspace",
        });
        if (!finalName) return; // reader cancelled the rename — import nothing
        ws.name = finalName;

        await persistNow(true);
        await persistence.putWorkspace(ws);
        await refreshWorkspaceList();
        hydrateWorkspace(ws);
        savePrefs({ lastWorkspaceId: ws.id });
      } catch {
        setSaveStatus("idle");
        alert("That file isn't a valid workspace export.");
      }
    },
    [persistNow, refreshWorkspaceList, hydrateWorkspace, storedWorkspaces, switchWorkspace],
  );

  const exportWorkspace = useCallback(() => {
    const rec = buildRecord();
    const blob = new Blob([serializeWorkspace(rec)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${rec.name.trim().replace(/\s+/g, "-").toLowerCase() || "workspace"}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [buildRecord]);

  const shareWorkspace = useCallback(async () => {
    try {
      toast.loading("Generating share link...", { id: "share-workspace" });
      const key = await uploadShare(serializeWorkspace(buildRecord()));
      const url = `${window.location.origin}${window.location.pathname}${SHARE_HASH}${key}`;
      await copyLink(url);
      toast.success("Workspace link copied to clipboard!", { id: "share-workspace" });
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate share link. Workspace might be too large.", {
        id: "share-workspace",
      });
    }
  }, [buildRecord]);

  /**
   * Share one file or a hand-picked set of them. Unlike the workspace link,
   * this one asks the recipient where the files should land — see
   * `SharedFilesDialog` and `acceptSharedFiles`.
   */
  const shareFiles = useCallback(async (fileIds: string[]) => {
    const picked = snapshotRef.current.files.filter((f) => fileIds.includes(f.id));
    if (picked.length === 0) return;
    const label = picked.length === 1 ? `“${picked[0].name}”` : `${picked.length} files`;
    try {
      toast.loading(`Generating link for ${label}...`, { id: "share-files" });
      const json = serializeSharedFiles(
        picked.map((f) => ({
          id: f.id,
          name: f.name,
          content: f.content,
          data: f.data,
          mimeType: f.mimeType,
          size: f.size,
          addedAt: f.addedAt,
          kind: f.kind,
        })),
        workspaceNameRef.current,
      );
      const key = await uploadShare(json);
      const url = `${window.location.origin}${window.location.pathname}${SHARE_FILES_HASH}${key}`;
      await copyLink(url);
      toast.success(`Link to ${label} copied to clipboard!`, { id: "share-files" });
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate share link. The files might be too large.", {
        id: "share-files",
      });
    }
  }, []);

  const shareFile = useCallback((fileId: string) => void shareFiles([fileId]), [shareFiles]);

  // ---- receiving a #share-files= link ----
  //
  // Nothing is written on arrival: the payload is held here until the reader
  // picks a destination in SharedFilesDialog.

  const loadIncomingShare = useCallback(async () => {
    const hash = window.location.hash;
    if (!hash.startsWith(SHARE_FILES_HASH)) return;
    // Drop the hash first, so a refresh or a failed fetch doesn't re-prompt.
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    try {
      toast.loading("Opening shared files...", { id: "incoming-share" });
      const json = await fetchShare(hash.slice(SHARE_FILES_HASH.length));
      setIncomingShare(parseSharedFiles(json));
      toast.dismiss("incoming-share");
    } catch (e) {
      console.error("Failed to read shared files link", e);
      toast.error("Invalid or expired shared files link.", { id: "incoming-share" });
    }
  }, []);

  useEffect(() => {
    void loadIncomingShare();
    // A link opened from another tab on this origin only changes the hash.
    const onHashChange = () => void loadIncomingShare();
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [loadIncomingShare]);

  const acceptSharedFiles = useCallback(
    async (target: "new" | "current", fileIds: string[], newName: string) => {
      const payload = incomingShare;
      if (!payload) return;
      const picked = payload.files.filter((f) => fileIds.includes(f.id));
      if (picked.length === 0) return;

      setImportingShare(true);
      try {
        // The same file can arrive twice (re-shared, or shared back); fresh ids
        // keep both copies addressable.
        const stamped: PersistedFile[] = picked.map((f) => ({
          ...f,
          id: crypto.randomUUID(),
          addedAt: f.addedAt ?? Date.now(),
          // Folders don't travel with a share link; shared files land at the
          // top level rather than pointing at a folder that isn't here.
          folderId: null,
        }));

        const incomingBytes = stamped.reduce((sum, f) => sum + (f.size ?? f.content.length), 0);
        const maxStorage = await getMaxStorageBytes();
        if (maxStorage != null) {
          const usedBytes = snapshotRef.current.files.reduce((sum, f) => sum + (f.size ?? 0), 0);
          if (usedBytes + incomingBytes > maxStorage) {
            toast.error(
              `Storage full — this application is strictly capped at ${formatBytes(maxStorage)}. Remove some files before importing shared ones.`,
            );
            return;
          }
        }

        if (target === "new") {
          await persistNow(true);
          const ws = newWorkspaceRecord(newName.trim() || payload.sourceName);
          ws.files = stamped;
          ws.ui.activeFileId = stamped[0].id;
          ws.ui.fileOrder = stamped.map((f) => f.id);
          await persistence.putWorkspace(ws);
          await refreshWorkspaceList();
          hydrateWorkspace(ws);
          savePrefs({ lastWorkspaceId: ws.id });
        } else {
          const taken = new Set(snapshotRef.current.files.map((f) => f.name));
          const added = stamped.map((f) => {
            const name = uniqueFileName(f.name, taken);
            taken.add(name);
            return toMdFile({ ...f, name });
          });
          const nextFiles = [...snapshotRef.current.files, ...added];
          const nextActiveFileId = snapshotRef.current.activeFileId ?? added[0].id;

          // Dropping into "the current workspace" before one exists (a first
          // visit opened straight from a link) creates it, as an upload would.
          if (!workspaceIdRef.current) {
            const id = crypto.randomUUID();
            workspaceIdRef.current = id;
            workspaceNameRef.current = payload.sourceName;
            createdAtRef.current = Date.now();
            setWorkspaceId(id);
            savePrefs({ lastWorkspaceId: id });
          }

          snapshotRef.current = {
            ...snapshotRef.current,
            files: nextFiles,
            activeFileId: nextActiveFileId,
          };
          setFiles(nextFiles);
          setActiveFileId(nextActiveFileId);
          setSaveStatus("saving");
          await persistence.putWorkspace(buildRecord());
          setSaveStatus("saved");
          await refreshWorkspaceList();
        }

        setIncomingShare(null);
        toast.success(
          `Added ${stamped.length} shared file${stamped.length > 1 ? "s" : ""} to ${
            target === "new" ? newName.trim() || payload.sourceName : workspaceNameRef.current
          }.`,
        );
        if (location.pathname !== "/") navigate({ to: "/" });
      } catch (e) {
        console.error("Failed to import shared files", e);
        setSaveStatus("idle");
        toast.error("Could not import the shared files. Please try again.");
      } finally {
        setImportingShare(false);
      }
    },
    [
      incomingShare,
      persistNow,
      refreshWorkspaceList,
      hydrateWorkspace,
      buildRecord,
      location.pathname,
      navigate,
    ],
  );

  const deleteWorkspace = useCallback(
    async (id: string) => {
      await persistence.deleteWorkspace(id);
      let list = await persistence.listWorkspaces().catch(() => [] as WorkspaceRecord[]);
      if (list.length === 0) {
        const ws = newWorkspaceRecord("My workspace");
        await persistence.putWorkspace(ws);
        list = [ws];
      }
      list.sort((a, b) => a.createdAt - b.createdAt);
      setWorkspaces(list.map((w) => ({ id: w.id, name: w.name, docCount: w.files?.length || 0 })));
      if (id === workspaceIdRef.current) {
        hydrateWorkspace(list[0]);
        savePrefs({ lastWorkspaceId: list[0].id });
      }
    },
    [hydrateWorkspace],
  );

  const renameWorkspace = useCallback(
    async (id: string, newName: string) => {
      const ws = await persistence.getWorkspace(id);
      if (!ws) return;
      const finalName = resolveWorkspaceName(newName, await storedWorkspaces(), { excludeId: id });
      if (!finalName || finalName === ws.name) return;
      ws.name = finalName;
      await persistence.putWorkspace(ws);
      if (id === workspaceIdRef.current) {
        workspaceNameRef.current = finalName;
      }
      await refreshWorkspaceList();
    },
    [refreshWorkspaceList, storedWorkspaces],
  );

  const clearAllStorage = useCallback(async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (scrollTimer.current) clearTimeout(scrollTimer.current);
    if (restoredFlash.current) clearTimeout(restoredFlash.current);

    // Stop lifecycle handlers from writing the current snapshot back while the
    // database is being deleted and the page is reloading.
    hydratedRef.current = false;
    workspaceIdRef.current = null;

    try {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {
        // Continue with IndexedDB deletion when Web Storage is unavailable.
      }
      await persistence.destroy();
      window.location.reload();
    } catch (error) {
      console.error("Could not clear all browser storage", error);
      alert("Some data could not be cleared. Close Localdox in other tabs and try again.");
    }
  }, []);

  // Rows for the Saved list: newest first, each carrying the name of the file it
  // came from. Stars whose file is gone are dropped rather than shown as dead
  // rows — removing a file already removes its content.
  const savedEntries: SavedEntry[] = useMemo(
    () =>
      saved
        .map((item) => {
          const file = files.find((f) => f.id === item.fileId);
          return file ? { ...item, fileName: file.name } : null;
        })
        .filter(Boolean as unknown as (v: SavedEntry | null) => v is SavedEntry)
        .sort((a, b) => b.createdAt - a.createdAt),
    [saved, files],
  );

  // The header star saves whatever page the reader is on: the current section
  // when one is selected, otherwise the document itself.
  const activePageDraft = useCallback((): SavedDraft | null => {
    if (!activeFile) return null;
    if (!activeHeadingId) {
      return { kind: "file", title: activeFile.name };
    }
    const chunks = fileSubtopics(activeFile);
    const chunk = chunks.find((c) => c.id === activeHeadingId);
    return {
      kind: "section",
      title: chunk?.title ?? activeFile.name,
      headingId: activeHeadingId,
      subtopicId: activeHeadingId,
    };
  }, [activeFile, activeHeadingId]);

  const activePageSaved = activeFile
    ? findSaved(saved, {
        fileId: activeFile.id,
        kind: activeHeadingId ? "section" : "file",
        headingId: activeHeadingId ?? undefined,
      })
    : undefined;

  const toggleActivePageSaved = useCallback(() => {
    const draft = activePageDraft();
    if (activeFile && draft) toggleSaved(activeFile.id, draft);
  }, [activeFile, activePageDraft, toggleSaved]);

  // ---- props for the viewer, held to stable identities ----
  //
  // Each of these used to be built inline in the JSX below. A `.filter()` or a
  // `.map()` in a prop returns a new array every render, so <MarkdownViewer>
  // saw changed props on every render of this component no matter what actually
  // changed — which made memoizing it pointless and re-ran its highlight
  // painting and plugin work each time.

  const activeFileHighlights = useMemo(
    () => (activeFile ? highlights.filter((h) => h.fileId === activeFile.id) : EMPTY_HIGHLIGHTS),
    [highlights, activeFile],
  );

  const activeFileSaved = useMemo(
    () => (activeFile ? saved.filter((s) => s.fileId === activeFile.id) : EMPTY_SAVED),
    [saved, activeFile],
  );

  const addHighlightToActive = useCallback(
    (hl: Omit<Highlight, "id" | "fileId">) => {
      if (activeFile) addHighlight(hl, activeFile.id);
    },
    [addHighlight, activeFile],
  );

  const toggleSavedOnActive = useCallback(
    (draft: SavedDraft) => {
      if (activeFile) toggleSaved(activeFile.id, draft);
    },
    [toggleSaved, activeFile],
  );

  const shareActiveFile = useCallback(() => {
    if (activeFile) shareFile(activeFile.id);
  }, [shareFile, activeFile]);

  const navFromViewer = useCallback(
    (fileId: string, subtopicId: string | null) => handleSelect(fileId, subtopicId || undefined),
    [handleSelect],
  );

  const navToFile = useCallback(
    (fileId: string) => handleSelect(fileId, undefined),
    [handleSelect],
  );

  const toggleActiveDocumentSaved = useCallback(() => {
    if (activeFile) toggleSaved(activeFile.id, { kind: "file", title: activeFile.name });
  }, [toggleSaved, activeFile]);

  const consumeStartInEdit = useCallback(() => setAutoEditFileId(null), []);
  const clearPendingSaved = useCallback(() => setPendingSaved(null), []);

  const nextReadingMinutes = useMemo(
    () => (nextFile ? readingMinutes(nextFile.content) : null),
    [nextFile],
  );

  // The AI panel only needs each document's text. Mapping in the JSX rebuilt
  // this array — and every object in it — on every render of the app.
  const aiFiles = useMemo(
    () => files.map((f) => ({ id: f.id, name: f.name, content: f.content })),
    [files],
  );

  const aiActiveFile = useMemo(
    () =>
      activeFile ? { id: activeFile.id, name: activeFile.name, content: activeFile.content } : null,
    [activeFile],
  );

  const aiActiveSection = useMemo(() => {
    if (!activeFile) return null;
    const subs = fileSubtopics(activeFile);
    const section = subs.find((s) => s.id === activeHeadingId);
    return section ? { title: section.title, content: section.content } : null;
  }, [activeFile, activeHeadingId]);

  // Opening a star: go to its file and page first, then hand the item to the
  // viewer, which scrolls to the passage and flashes it once it has rendered.
  const openSaved = useCallback(
    async (item: SavedItem) => {
      const target = item.headingId ?? item.subtopicId ?? undefined;
      if (showSettings) await openFromHome(item.fileId, target);
      else handleSelect(item.fileId, target);
      setPendingSaved(item);
      setDrawerOpen(false);
    },
    // handleSelect is redefined every render; calling the latest one is correct.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [openFromHome, showSettings],
  );

  const goHome = useCallback(() => navigate({ to: "/" }), [navigate]);
  const openSettings = useCallback(() => navigate({ to: "/settings" }), [navigate]);

  // Ask AI: opened either from the sidebar (no prefill) or from a text-selection
  // quick action in the reader (seeded with the selection + chosen action).
  const openAskAi = useCallback(() => {
    setAiPrefill(null);
    setAiOpen(true);
  }, []);
  const askAiFromSelection = useCallback((prefill: AskAiPrefill) => {
    setAiPrefill(prefill);
    setAiOpen(true);
  }, []);
  const closeAskAi = useCallback(() => setAiOpen(false), []);

  // Cmd/Ctrl+K. Owned here rather than inside <CommandPalette>, which is code
  // split and unmounted until the palette opens — a shortcut registered by that
  // component could not open it the first time.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (hasModKey(e) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Fetch the palette's chunk as soon as the app is idle. It is the most likely
  // of the split surfaces to be opened, and opening it is a keystroke away, so
  // it should already be in cache by the time that keystroke arrives.
  useEffect(() => {
    const warm = () => void import("./CommandPalette");
    if (typeof requestIdleCallback === "function") requestIdleCallback(warm, { timeout: 4000 });
    else setTimeout(warm, 1500);
  }, []);

  // Append AI output to the open document, or spin it out into a new one.
  const insertAiOutput = useCallback(
    (markdown: string) => {
      const target = snapshotRef.current.activeFileId;
      const file = snapshotRef.current.files.find((f) => f.id === target);
      if (!file) return;
      handleContentChange(file.id, `${file.content}\n\n${markdown}`);
      toast.success("Inserted into document");
    },
    [handleContentChange],
  );
  const createAiDoc = useCallback(
    (name: string, content: string) => {
      const id = `${name}-${crypto.randomUUID().slice(0, 8)}`;
      const doc: MdFile = {
        id,
        name,
        content,
        mimeType: "text/markdown",
        size: content.length,
        addedAt: Date.now(),
        kind: "markdown",
      };
      setFiles((prev) => [...prev, doc]);
      setActiveFileId(id);
      setAiOpen(false);
      if (location.pathname !== "/") navigate({ to: "/" });
      markDirty();
      toast.success("Created new document");
    },
    [location.pathname, navigate, markDirty],
  );

  const openWorkspaceFromHome = useCallback(
    async (id: string) => {
      setSidebarCollapsed(false);
      if (id !== workspaceIdRef.current) await switchWorkspace(id);
      navigate({ to: "/" });
    },
    [switchWorkspace, navigate],
  );

  const createWorkspaceFromDock = useCallback(async () => {
    await newWorkspace();
    navigate({ to: "/" });
  }, [navigate, newWorkspace]);

  const dragOverlay = globalDrag ? (
    <div className="fixed inset-0 z-(--z-overlay) flex items-center justify-center bg-background/70 backdrop-blur-md">
      <div className="flex flex-col items-center gap-5 rounded-[28px] border border-border bg-card px-12 py-10 shadow-[0_24px_80px_color-mix(in_oklab,var(--foreground)_12%,transparent)]">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-foreground text-background">
          <Upload className="h-6 w-6" />
        </span>
        <div className="text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">Drop to add</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Documents, spreadsheets, PDFs, and presentations.
          </p>
        </div>
      </div>
    </div>
  ) : null;

  // Rendered from both the empty state and the reader — a shared link can land
  // on either.
  const shareDialog = incomingShare ? (
    <Suspense fallback={null}>
      <SharedFilesDialog
        open
        files={incomingShare.files}
        sourceName={incomingShare.sourceName}
        currentWorkspaceName={workspaceId ? workspaceNameRef.current : null}
        busy={importingShare}
        onDismiss={() => setIncomingShare(null)}
        onImport={(target: "new" | "current", ids: string[], name: string) =>
          void acceptSharedFiles(target, ids, name)
        }
      />
    </Suspense>
  ) : null;

  // Search palette. Split out of the main bundle, so it is only in the tree
  // while it is open; its chunk is warmed on idle above.
  const commandPalette = paletteOpen ? (
    <Suspense fallback={null}>
      <CommandPalette
        files={files}
        open
        onOpenChange={setPaletteOpen}
        onSelect={showSettings ? openFromHome : handleSelect}
      />
    </Suspense>
  ) : null;

  if (booting) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <BrandMark className="h-9 w-9 rounded-[11px] text-sm" />
          <div className="h-1 w-24 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-foreground/40" />
          </div>
        </div>
      </div>
    );
  }

  if (files.length === 0 && !showSettings) {
    return (
      <div className="min-h-dvh">
        <Header
          theme={theme}
          onCycleTheme={cycleTheme}
          onMenu={null}
          hideMenu
          onOpenPalette={() => setPaletteOpen(true)}
          hasFiles={false}
          onAddFiles={() => inputRef.current?.click()}
          saveStatus={saveStatus}
          onHome={goHome}
          workspaces={workspaces}
          currentWorkspaceId={workspaceId}
          onSwitchWorkspace={switchWorkspace}
          onNewWorkspace={newWorkspace}
          onImportWorkspace={importWorkspace}
          onExportWorkspace={exportWorkspace}
          onShareWorkspace={shareWorkspace}
          onDeleteWorkspace={deleteWorkspace}
          onOpenSettings={openSettings}
        />
        {commandPalette}
        <div className="flex min-h-[calc(100dvh-4rem)] flex-col items-center justify-center gap-7 px-6 text-center">
          <BrandMark className="h-12 w-12 rounded-[14px] text-base" />
          <div className="max-w-md">
            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-foreground">
              A quieter place to read
            </h1>
            <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
              Drop files here — Markdown, PDFs, spreadsheets, decks, and images stay on this device.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="h-11 rounded-xl bg-foreground px-5 text-sm font-medium text-background transition-opacity hover:opacity-90"
            >
              Upload files
            </button>
            {/* Nothing to right-click yet, so the sidebar's New menu is out of
                reach — a blank document has to be startable from here too. */}
            <button
              type="button"
              onClick={() => createFile(null)}
              className="h-11 rounded-xl border border-border bg-card px-5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              New markdown file
            </button>
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={SUPPORTED_ACCEPT}
          className="hidden"
          onChange={(e) => {
            handleFileInput(e.target.files);
            e.target.value = "";
          }}
        />
        {dragOverlay}
        {shareDialog}
      </div>
    );
  }

  return (
    <div className="min-h-dvh">
      <Header
        hideOnDesktop
        theme={theme}
        onCycleTheme={cycleTheme}
        onMenu={() => setDrawerOpen(true)}
        onOpenPalette={() => setPaletteOpen(true)}
        hasFiles
        onAddFiles={() => inputRef.current?.click()}
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={toggleSidebar}
        saveStatus={saveStatus}
        onHome={goHome}
        workspaces={workspaces}
        currentWorkspaceId={workspaceId}
        onSwitchWorkspace={switchWorkspace}
        onNewWorkspace={newWorkspace}
        onImportWorkspace={importWorkspace}
        onExportWorkspace={exportWorkspace}
        onShareWorkspace={shareWorkspace}
        onDeleteWorkspace={deleteWorkspace}
      />

      {commandPalette}

      <div className="flex">
        <div
          ref={sidebarWrapRef}
          className="sticky top-0 hidden h-dvh shrink-0 bg-transparent p-2 pr-0 md:block md:portrait:hidden"
        >
          <div
            ref={sidebarInnerRef}
            className="chrome-island mx-2 my-2 h-[calc(100%-1rem)] w-[calc(100%-1rem)] overflow-hidden rounded-[22px] bg-sidebar/90"
          >
            <Sidebar
              files={files}
              activeFileId={activeFileId}
              activeHeadingId={activeHeadingId}
              expanded={expanded}
              onToggleFile={toggleFile}
              onSelect={handleSelect}
              onAddFiles={() => inputRef.current?.click()}
              onRemoveFile={removeFile}
              onArchiveFile={toggleArchiveFile}
              onDownloadFile={downloadFile}
              onShareFile={shareFile}
              onShareFiles={(ids) => void shareFiles(ids)}
              onRenameFile={renameFile}
              folders={folders}
              onCreateFile={createFile}
              onCreateFolder={createFolder}
              onRenameFolder={renameFolder}
              onDeleteFolder={deleteFolder}
              onMoveFileToFolder={moveFileToFolder}
              onReorderFile={reorderFile}
              onSortByName={sortFilesByName}
              view={sidebarView}
              onView={setSidebarView}
              saved={savedEntries}
              onOpenSaved={openSaved}
              onRemoveSaved={removeSaved}
              theme={theme}
              onCycleTheme={cycleTheme}
              currentWorkspaceName={workspaceNameRef.current}
              canDeleteWorkspace={workspaces.length > 1}
              onRenameCurrentWorkspace={(name) =>
                workspaceIdRef.current && void renameWorkspace(workspaceIdRef.current, name)
              }
              onDeleteCurrentWorkspace={() =>
                workspaceIdRef.current && void deleteWorkspace(workspaceIdRef.current)
              }
              onClearStorage={clearAllStorage}
              highlights={highlights}
              onRemoveHighlight={removeHighlight}
              onShowHighlights={setHighlightsOnlyFileId}
              onOpenSettings={openSettings}
              onAskAi={openAskAi}
              onNewWorkspace={newWorkspace}
              onImportWorkspace={importWorkspace}
              onExportWorkspace={exportWorkspace}
              onShareWorkspace={shareWorkspace}
              workspaces={workspaces}
              currentWorkspaceId={workspaceId}
              onSwitchWorkspace={switchWorkspace}
              onDeleteWorkspace={deleteWorkspace}
              docked
              onOpenPalette={() => setPaletteOpen(true)}
              onToggleSidebar={toggleSidebar}
            />
          </div>

          <div
            className="chrome-island absolute inset-y-2 left-2 z-20 flex w-12 flex-col items-center gap-2 rounded-[22px] bg-sidebar/90 py-3 transition-opacity duration-200"
            style={{
              opacity: sidebarCollapsed ? 1 : 0,
              pointerEvents: sidebarCollapsed ? "auto" : "none",
            }}
          >
            <button
              onClick={() => setSidebarCollapsed(false)}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Expand sidebar"
              title="Expand sidebar"
            >
              <Menu className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPaletteOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Search docs or ask AI"
              title="Search docs or ask AI"
            >
              <Search className="h-4 w-4" />
            </button>
            <button
              onClick={() => inputRef.current?.click()}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Upload files"
              title="Upload files"
            >
              <Plus className="h-4 w-4" />
            </button>
            <div className="flex-1" />
            <button
              onClick={openSettings}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Settings"
              title="Settings"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>

          {!sidebarCollapsed && (
            <div
              onMouseDown={startResize}
              onDoubleClick={() => {
                widthRef.current = SIDEBAR_DEFAULT;
                setSidebarWidth(SIDEBAR_DEFAULT);
                if (sidebarWrapRef.current)
                  sidebarWrapRef.current.style.width = `${SIDEBAR_DEFAULT}px`;
                try {
                  localStorage.setItem(SIDEBAR_WIDTH_KEY, String(SIDEBAR_DEFAULT));
                } catch {
                  /* ignore */
                }
              }}
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize sidebar (double-click to reset)"
              title="Drag to resize · double-click to reset"
              className="absolute right-0 top-16 z-10 h-[calc(100%-4rem)] w-1.5 cursor-col-resize"
            ></div>
          )}
        </div>

        {drawerOpen && (
          <div className="fixed inset-0 z-(--z-overlay) md:hidden">
            <div
              className="absolute inset-0 bg-foreground/20 backdrop-blur-sm"
              onClick={() => setDrawerOpen(false)}
            />
            <div className="absolute left-2 top-2 h-[calc(100%-1rem)] w-80 max-w-[85vw] overflow-hidden rounded-[22px] border border-border bg-background shadow-2xl animate-in slide-in-from-left duration-200">
              <div className="flex h-14 items-center justify-between border-b border-border/70 px-4">
                <span className="truncate px-1 text-sm font-semibold tracking-tight">
                  {workspaceNameRef.current || "Workspace"}
                </span>
                <button
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Close"
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="h-[calc(100%-3.5rem)]">
                <Sidebar
                  files={files}
                  activeFileId={activeFileId}
                  activeHeadingId={activeHeadingId}
                  expanded={expanded}
                  onToggleFile={toggleFile}
                  onSelect={handleSelect}
                  onAddFiles={() => inputRef.current?.click()}
                  onRemoveFile={removeFile}
                  onArchiveFile={toggleArchiveFile}
                  onDownloadFile={downloadFile}
                  onShareFile={shareFile}
                  onShareFiles={(ids) => void shareFiles(ids)}
                  onRenameFile={renameFile}
                  folders={folders}
                  onCreateFile={createFile}
                  onCreateFolder={createFolder}
                  onRenameFolder={renameFolder}
                  onDeleteFolder={deleteFolder}
                  onMoveFileToFolder={moveFileToFolder}
                  onReorderFile={reorderFile}
                  onSortByName={sortFilesByName}
                  view={sidebarView}
                  onView={setSidebarView}
                  saved={savedEntries}
                  onOpenSaved={openSaved}
                  onRemoveSaved={removeSaved}
                  theme={theme}
                  onCycleTheme={cycleTheme}
                  currentWorkspaceName={workspaceNameRef.current}
                  canDeleteWorkspace={workspaces.length > 1}
                  onRenameCurrentWorkspace={(name) =>
                    workspaceIdRef.current && void renameWorkspace(workspaceIdRef.current, name)
                  }
                  onDeleteCurrentWorkspace={() =>
                    workspaceIdRef.current && void deleteWorkspace(workspaceIdRef.current)
                  }
                  onClearStorage={clearAllStorage}
                  highlights={highlights}
                  onRemoveHighlight={removeHighlight}
                  onShowHighlights={(id) => {
                    setHighlightsOnlyFileId(id);
                    setDrawerOpen(false);
                  }}
                  onOpenSettings={openSettings}
                  onAskAi={() => {
                    setDrawerOpen(false);
                    openAskAi();
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* One boundary for the whole content column. The settings page and the
            binary-document viewers are code-split; the markdown viewer is not,
            so the common case never suspends here. */}
        <Suspense fallback={<main className="min-w-0 flex-1" aria-busy />}>
          <main className="min-w-0 flex-1 pb-24 lg:pb-0 md:landscape:pb-0">
            {showSettings ? (
              <SettingsPage
                workspaces={workspaces}
                currentWorkspaceId={workspaceId}
                onRenameWorkspace={renameWorkspace}
                onDeleteWorkspace={deleteWorkspace}
                onClearStorage={clearAllStorage}
                saved={savedEntries}
                onOpenSaved={openSaved}
                onRemoveSaved={removeSaved}
                onClearSaved={() => {
                  setSaved([]);
                  markDirty();
                }}
                highlights={highlights}
                onRemoveHighlight={removeHighlight}
                onClearHighlights={() => {
                  setHighlights([]);
                  markDirty();
                }}
                onNavigate={openFromHome}
                files={files}
                onOpenWorkspace={openWorkspaceFromHome}
                theme={theme}
                onSetTheme={setTheme}
                readingMode={readingMode}
                onSetReadingMode={setReadingMode}
                readingFont={readingFont}
                onSetReadingFont={setReadingFont}
                onToggleArchiveFile={toggleArchiveFile}
              />
            ) : activeFile &&
              (activeFile.kind === "markdown" || activeFile.kind === "text" || !activeFile.kind) ? (
              <MarkdownViewer
                file={activeFile}
                prevFile={prevFile}
                nextFile={nextFile}
                onNav={navFromViewer}
                activeSubtopicId={activeHeadingId}
                highlightQuery={highlightQuery}
                onContentChange={handleContentChange}
                startInEditFileId={autoEditFileId}
                onStartInEditConsumed={consumeStartInEdit}
                nextReadingMin={nextReadingMinutes}
                isBookmarked={!!activePageSaved}
                onToggleBookmark={toggleActivePageSaved}
                highlights={activeFileHighlights}
                onAddHighlight={addHighlightToActive}
                onUpdateHighlight={updateHighlight}
                onRemoveHighlight={removeHighlight}
                onRepairHighlights={repairHighlights}
                saved={activeFileSaved}
                onToggleSaved={toggleSavedOnActive}
                onRemoveSaved={removeSaved}
                pendingSaved={pendingSaved?.fileId === activeFile.id ? pendingSaved : null}
                onSavedShown={clearPendingSaved}
                onHome={goHome}
                onShareFile={shareActiveFile}
                onAskAi={askAiFromSelection}
                readingMode={readingMode}
                workspaceId={workspaceId}
                workspaceRevision={workspaceRevision}
                workspaceFiles={files}
                workspaceName={workspaceNameRef.current}
                onOpenArtifact={openEmbeddedArtifact}
              />
            ) : activeFile ? (
              <DocumentViewer
                file={activeFile}
                isBookmarked={!!findSaved(saved, { fileId: activeFile.id, kind: "file" })}
                onToggleBookmark={toggleActiveDocumentSaved}
                prevFile={prevFile}
                nextFile={nextFile}
                onNavFile={navToFile}
              />
            ) : null}
          </main>
        </Suspense>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={SUPPORTED_ACCEPT}
        className="hidden"
        onChange={(e) => {
          handleFileInput(e.target.files);
          e.target.value = "";
        }}
      />
      {highlightsOnlyFileId &&
        (() => {
          const hlFile = files.find((f) => f.id === highlightsOnlyFileId);
          if (!hlFile) return null;
          const hlFileChunks = fileSubtopics(hlFile);
          const chunkOrder = new Map(hlFileChunks.map((c, i) => [c.id, i]));
          const fileHighlights = highlights
            .filter((h) => h.fileId === hlFile.id)
            .sort((a, b) => {
              const aChunkIndex = chunkOrder.get(a.subtopicId ?? "") ?? -1;
              const bChunkIndex = chunkOrder.get(b.subtopicId ?? "") ?? -1;
              if (aChunkIndex !== bChunkIndex) return aChunkIndex - bChunkIndex;
              return (a.start ?? 0) - (b.start ?? 0);
            });
          return (
            <Suspense fallback={null}>
              <HighlightsOnlyModal
                fileName={hlFile.name}
                highlights={fileHighlights}
                onClose={() => setHighlightsOnlyFileId(null)}
                onJump={(hl: Highlight) => {
                  setHighlightsOnlyFileId(null);
                  handleSelect(hl.fileId, hl.subtopicId || undefined);
                }}
                onRemove={removeHighlight}
              />
            </Suspense>
          );
        })()}

      {/* Mounted only once opened. The panel is a large component whose props
          are derived from every document in the workspace; keeping it out of
          the tree until it is asked for saves that work on every render. */}
      {aiOpen && (
        <Suspense fallback={null}>
          <AskAiPanel
            open
            onClose={closeAskAi}
            prefill={aiPrefill}
            initialSelection={null}
            activeFile={aiActiveFile}
            activeSection={aiActiveSection}
            files={aiFiles}
            onInsert={insertAiOutput}
            onCreateDoc={createAiDoc}
          />
        </Suspense>
      )}

      {dragOverlay}
      {shareDialog}
    </div>
  );
}

function Header({
  theme,
  onCycleTheme,
  onMenu,
  hideMenu,
  hideUpload,
  hideOnDesktop,
  onOpenPalette,
  hasFiles,
  onAddFiles,
  sidebarCollapsed,
  onToggleSidebar,
  saveStatus,
  onHome,
  workspaces = [],
  currentWorkspaceId,
  onSwitchWorkspace,
  onNewWorkspace,
  onImportWorkspace,
  onExportWorkspace,
  onShareWorkspace,
  onDeleteWorkspace,
  onOpenSettings,
}: {
  theme: Theme;
  onCycleTheme: () => void;
  onMenu: (() => void) | null;
  hideMenu?: boolean;
  hideUpload?: boolean;
  hideOnDesktop?: boolean;
  onOpenPalette: () => void;
  hasFiles: boolean;
  onAddFiles: () => void;
  sidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  saveStatus?: SaveStatus;
  onHome?: () => void;
  workspaces?: { id: string; name: string }[];
  currentWorkspaceId?: string | null;
  onSwitchWorkspace?: (id: string) => void;
  onNewWorkspace?: (name?: string) => void;
  onImportWorkspace?: (file: File) => void;
  onExportWorkspace?: () => void;
  onShareWorkspace?: () => void;
  onDeleteWorkspace?: (id: string) => void;
  onOpenSettings?: () => void;
}) {
  return (
    <header
      className={`app-surface z-(--z-nav) relative flex h-[3.75rem] items-center justify-between border-b border-border/60 px-3 md:px-5 ${
        hideOnDesktop ? "lg:hidden md:landscape:hidden" : ""
      }`}
    >
      <div className="flex items-center gap-2">
        {!hideMenu && (
          <button
            onClick={() => onMenu?.()}
            className="flex h-10 w-10 items-center justify-center rounded-xl transition-transform hover:bg-accent active:scale-95 lg:hidden md:landscape:hidden"
            aria-label="Menu"
          >
            <Menu className="h-4 w-4" />
          </button>
        )}
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className={`hidden h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition-all hover:bg-accent hover:text-foreground active:scale-95 md:portrait:hidden ${sidebarCollapsed ? "md:hidden" : "md:inline-flex"}`}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <Menu className="h-4 w-4" />
          </button>
        )}
        <button
          onClick={onHome}
          className="flex items-center gap-2 rounded-xl px-1.5 py-1 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Home"
          title="Home"
        >
          <BrandMark />
          <span className="text-sm font-semibold tracking-tight text-foreground">Localdox</span>
        </button>
      </div>

      {hasFiles && (
        <div className="absolute left-1/2 hidden -translate-x-1/2 items-center lg:flex md:landscape:flex">
          <button
            onClick={onOpenPalette}
            className="flex w-80 items-center gap-2 rounded-full border border-border/80 bg-muted/40 px-3.5 py-2 text-xs text-muted-foreground transition-colors hover:border-foreground/15 hover:bg-muted/70 hover:text-foreground"
          >
            <Search className="h-3.5 w-3.5" />
            <span>Search</span>
            <span className="ml-auto flex items-center gap-1">
              <kbd className="rounded-md border border-border bg-background px-1.5 py-0.5 font-mono text-[10px]">
                ⌘
              </kbd>
              <kbd className="rounded-md border border-border bg-background px-1.5 py-0.5 font-mono text-[10px]">
                K
              </kbd>
            </span>
          </button>
        </div>
      )}

      <div className="flex items-center gap-1.5">
        {hasFiles && (
          <button
            onClick={onOpenPalette}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:hidden md:landscape:hidden"
            aria-label="Search"
          >
            <Search className="h-4 w-4" />
          </button>
        )}

        {/* Workspace control lives in the header to the right of the search
            icon. Desktop/landscape get the dropdown pill; mobile/portrait get
            an icon that opens a bottom sheet with the same management options. */}
        {onSwitchWorkspace && (
          <>
            <div className="hidden items-center gap-2 lg:flex md:landscape:flex">
              <WorkspaceMenu
                workspaces={workspaces}
                currentId={currentWorkspaceId ?? null}
                onSwitch={onSwitchWorkspace}
                onNew={(name) => onNewWorkspace?.(name)}
                onDelete={(id) => onDeleteWorkspace?.(id)}
                onImport={(file) => onImportWorkspace?.(file)}
                onExport={() => onExportWorkspace?.()}
                onShare={() => onShareWorkspace?.()}
              />
            </div>
            <div className="flex items-center gap-2 lg:hidden md:landscape:hidden">
              <WorkspaceSheet
                workspaces={workspaces}
                currentId={currentWorkspaceId ?? null}
                onSwitch={onSwitchWorkspace}
                onNew={(name) => onNewWorkspace?.(name)}
                onDelete={(id) => onDeleteWorkspace?.(id)}
                onImport={(file) => onImportWorkspace?.(file)}
                onExport={() => onExportWorkspace?.()}
                onShare={() => onShareWorkspace?.()}
              />
            </div>
          </>
        )}
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Settings"
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </button>
        )}
      </div>
    </header>
  );
}
