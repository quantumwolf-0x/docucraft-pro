import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, Navigate } from "@tanstack/react-router";
import gsap from "gsap";
import {
  BookOpen,
  Menu,
  X,
  Search,
  Plus,
  Monitor,
  PanelLeftClose,
  PanelLeftOpen,
  Undo2,
  Home,
  Upload,
  Settings,
} from "lucide-react";

import { Sidebar, DEFAULT_VIEW, type SidebarView } from "./Sidebar";
import { MarkdownViewer } from "./MarkdownViewer";
import { DocumentViewer } from "./DocumentViewer";
import { CommandPalette } from "./CommandPalette";
import { SettingsPage } from "./SettingsPage";
import { WorkspaceMenu } from "./WorkspaceMenu";
import { WorkspaceSheet } from "./WorkspaceSheet";
import { HighlightsOnlyModal } from "./HighlightsOnlyModal";
import { AskAiPanel, type AskAiPrefill } from "./ai/AskAiPanel";
import type { MdFile, MdChunk } from "@/lib/markdown-utils";
import type { Highlight } from "@/lib/dom-highlighter";
import { parseHeadings, readingMinutes, splitIntoSubtopics } from "@/lib/markdown-utils";
import { getDocumentKind, importDocumentFile, SUPPORTED_ACCEPT } from "@/lib/document-utils";
import { clearArtifactResolutionCache } from "@/lib/workspace-artifacts";
import { toast } from "sonner";
import {
  persistence,
  loadPrefs,
  savePrefs,
  newWorkspaceRecord,
  serializeWorkspace,
  parseWorkspaceImport,
  isDarkTheme,
  type WorkspaceRecord,
  type SaveStatus,
  type ThemePref,
  type ReadingMode,
  type ReadingFont,
} from "@/lib/persistence";
import { compressAndEncode, decodeAndDecompress } from "@/lib/share";
import { MAX_UPLOAD_BYTES, getMaxStorageBytes, formatBytes } from "@/lib/storage-limits";

type Theme = ThemePref;

const SIDEBAR_MIN = 220;
const SIDEBAR_MAX = 480;
const SIDEBAR_DEFAULT = 288;
const SIDEBAR_WIDTH_KEY = "localdox:sidebarWidth";

const clampWidth = (w: number) => Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, w));

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

export function DocsApp() {
  const [files, setFiles] = useState<MdFile[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
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
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  // File whose highlights are shown in isolation via the "Show highlights only"
  // menu item; null when the modal is closed.
  const [highlightsOnlyFileId, setHighlightsOnlyFileId] = useState<string | null>(null);
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
    activeFileId,
    expanded,
    sidebarCollapsed,
    bookmarks,
    highlights,
    recentFileIds,
  });
  snapshotRef.current = {
    files,
    activeFileId,
    expanded,
    sidebarCollapsed,
    bookmarks,
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
  useEffect(() => {
    const wrap = sidebarWrapRef.current;
    if (!wrap) return;
    const target = sidebarCollapsed ? 56 : widthRef.current;
    if (firstCollapseRun.current) {
      gsap.set(wrap, { width: target });
      if (sidebarInnerRef.current)
        gsap.set(sidebarInnerRef.current, {
          autoAlpha: sidebarCollapsed ? 0 : 1,
          x: sidebarCollapsed ? -16 : 0,
        });
      firstCollapseRun.current = false;
    } else {
      gsap.to(wrap, { width: target, duration: 0.45, ease: "power3.inOut" });
    }
    if (sidebarInnerRef.current) {
      gsap.to(sidebarInnerRef.current, {
        // autoAlpha (opacity + visibility) so the hidden full sidebar drops out
        // of hit-testing — plain opacity:0 stays clickable and its Search / Add
        // Files buttons fire through the collapsed icon rail.
        autoAlpha: sidebarCollapsed ? 0 : 1,
        x: sidebarCollapsed ? -16 : 0,
        duration: sidebarCollapsed ? 0.25 : 0.4,
        ease: "power2.out",
      });
    }
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
  useEffect(() => {
    const root = document.documentElement;
    if (readingFont === "system") root.removeAttribute("data-font");
    else root.setAttribute("data-font", readingFont);
  }, [readingFont]);

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
        kind: f.kind,
      })),
      bookmarks: s.bookmarks,
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

  const persistNow = useCallback(
    async (silent: boolean) => {
      if (!workspaceIdRef.current) return;
      try {
        await persistence.putWorkspace(buildRecord());
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
    setSaveStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void persistNow(false), 700);
  }, [persistNow]);

  const hydrateWorkspace = useCallback((ws: WorkspaceRecord) => {
    let parsed: MdFile[] = ws.files.map((f) => ({
      id: f.id,
      name: f.name,
      content: f.content,
      data: f.data,
      mimeType: f.mimeType,
      size: f.size,
      kind: f.kind ?? getDocumentKind(f.name, f.mimeType),
      headings:
        getDocumentKind(f.name, f.mimeType) === "markdown" ||
        getDocumentKind(f.name, f.mimeType) === "text"
          ? parseHeadings(f.content, f.id)
          : [],
      subtopics:
        getDocumentKind(f.name, f.mimeType) === "markdown" ||
        getDocumentKind(f.name, f.mimeType) === "text"
          ? splitIntoSubtopics(f.content, f.name)
          : [],
    }));

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
    setActiveFileId(ws.ui?.activeFileId ?? parsed[0]?.id ?? null);
    setRecentFileIds(ws.ui?.recentFileIds ?? []);
    setExpanded(ws.ui?.expanded ?? {});
    setSidebarCollapsed(!!ws.ui?.sidebarCollapsed);
    setBookmarks(ws.bookmarks ?? []);
    setHighlights((ws.highlights ?? []).filter((h) => typeof h.text === "string"));
    setWorkspaceId(ws.id);
    workspaceIdRef.current = ws.id;
    workspaceNameRef.current = ws.name;
    createdAtRef.current = ws.createdAt ?? Date.now();
    const st = ws.ui?.scrollTop ?? 0;
    scrollRef.current = st;
    // Restore the exact scroll after the document has painted. Runs after the
    // viewer's own mount effects, so it wins.
    setTimeout(() => window.scrollTo({ top: st }), 350);
    setSaveStatus("restored");
    if (restoredFlash.current) clearTimeout(restoredFlash.current);
    restoredFlash.current = setTimeout(
      () => setSaveStatus((s) => (s === "restored" ? "saved" : s)),
      2500,
    );
  }, []);

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
        if (window.location.hash.startsWith("#share=")) {
          try {
            let json = "";
            const keyOrData = window.location.hash.replace("#share=", "");
            // Support legacy encoded strings (they typically don't look like short keys,
            // but we can just try fetching it. If it fails, fallback to decodeAndDecompress)
            if (keyOrData.length < 50) {
              const res = await fetch(`https://bytebin.lucko.me/${keyOrData}`);
              if (!res.ok) throw new Error("Failed to fetch from bytebin");
              json = await res.text();
            } else {
              json = await decodeAndDecompress(keyOrData);
            }

            const ws = parseWorkspaceImport(json);
            ws.id = crypto.randomUUID();
            ws.name = `${ws.name} (Shared)`;
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

  // Persist scroll position (silently) and flush on tab hide / unload.
  useEffect(() => {
    const onScroll = () => {
      scrollRef.current = window.scrollY;
      if (!hydratedRef.current) return;
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
      scrollTimer.current = setTimeout(() => {
        void persistNow(true);
      }, 1200);
    };
    const flush = () => {
      if (!hydratedRef.current) return;
      void persistNow(true);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("beforeunload", flush);
    return () => {
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

        const nextFiles = [...snapshotRef.current.files, ...parsed];
        // Keep the currently open file if one is open; otherwise open the first
        // of the just-uploaded batch.
        const nextActiveFileId = snapshotRef.current.activeFileId ?? parsed[0]?.id ?? null;

        if (!workspaceIdRef.current) {
          const id = crypto.randomUUID();
          workspaceIdRef.current = id;
          workspaceNameRef.current = "My workspace";
          createdAtRef.current = Date.now();
          setWorkspaceId(id);
          setWorkspaces([{ id, name: workspaceNameRef.current, docCount: 1 }]);
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

        toast.success(`Successfully uploaded ${total} file${total > 1 ? "s" : ""}!`, {
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

  const activeFile = files.find((f) => f.id === activeFileId) ?? null;
  activeFileNameRef.current = activeFile?.name ?? null;
  readingModeRef.current = readingMode;
  const workspaceRevision = files
    .map((file) => `${file.id}:${file.name}:${file.content.length}:${file.data?.length ?? 0}`)
    .join("|");
  const activeIdx = activeFile ? files.findIndex((f) => f.id === activeFile.id) : -1;
  const prevFile = activeIdx > 0 ? files[activeIdx - 1] : null;
  const nextFile = activeIdx >= 0 && activeIdx < files.length - 1 ? files[activeIdx + 1] : null;

  const handleSelect = (fileId: string, headingId?: string, query?: string) => {
    setActiveFileId(fileId);
    if (query !== undefined) setHighlightQuery(query || null);

    let targetHeadingId = headingId;
    if (!targetHeadingId) {
      const file = files.find((f) => f.id === fileId);
      const subs = file?.subtopics || (file ? splitIntoSubtopics(file.content, file.name) : []);
      targetHeadingId = subs?.[0]?.id || "preamble";
    }
    setActiveHeadingId(targetHeadingId);

    if (location.pathname !== "/") {
      navigate({ to: "/" });
    }

    setDrawerOpen(false);
    markDirty();
  };

  const removeFile = (id: string) => {
    const index = files.findIndex((f) => f.id === id);
    const fileToRestore = files[index];
    const activeWas = activeFileId;

    if (!fileToRestore) return;

    setFiles((prev) => prev.filter((f) => f.id !== id));
    if (activeFileId === id) {
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
  };

  const toggleArchiveFile = useCallback(
    (id: string) => {
      setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, isArchived: !f.isArchived } : f)));
      markDirty();
    },
    [markDirty],
  );

  const downloadFile = useCallback(
    (id: string) => {
      const file = files.find((f) => f.id === id);
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
    },
    [files],
  );

  const renameFile = useCallback(
    (id: string, newName: string) => {
      setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, name: newName } : f)));
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

  const toggleBookmark = useCallback(
    (fileId: string, subtopicId: string) => {
      const id = `${fileId}#${subtopicId}`;
      setBookmarks((prev) => (prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]));
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
      const file = files.find((item) => item.id === fileId);
      if (!file) return;

      const chunks = file.subtopics || splitIntoSubtopics(file.content, file.name);
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
    [buildRecord, files, navigate],
  );

  const handleContentChange = useCallback(
    (fileId: string, content: string) => {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileId
            ? {
                ...f,
                content,
                headings: parseHeadings(content, fileId),
                subtopics: splitIntoSubtopics(content, f.name),
              }
            : f,
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

  const newWorkspace = useCallback(
    async (name?: string) => {
      const finalName = name || window.prompt("Enter new workspace name:");
      if (!finalName) return;
      await persistNow(true);
      const ws = newWorkspaceRecord(finalName);
      await persistence.putWorkspace(ws);
      await refreshWorkspaceList();
      hydrateWorkspace(ws);
      savePrefs({ lastWorkspaceId: ws.id });
    },
    [persistNow, refreshWorkspaceList, hydrateWorkspace, workspaces.length],
  );

  const importWorkspace = useCallback(
    async (file: File) => {
      try {
        const ws = parseWorkspaceImport(await file.text());
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
    [persistNow, refreshWorkspaceList, hydrateWorkspace],
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
      const rec = buildRecord();
      const json = serializeWorkspace(rec);
      const res = await fetch("https://bytebin.lucko.me/post", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: json,
      });
      if (!res.ok) throw new Error("Failed to upload workspace to pastebin");
      const data = await res.json();
      const url = `${window.location.origin}${window.location.pathname}#share=${data.key}`;
      await navigator.clipboard.writeText(url);
      toast.success("Workspace link copied to clipboard!", { id: "share-workspace" });
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate share link. Workspace might be too large.", {
        id: "share-workspace",
      });
    }
  }, [buildRecord]);

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
      ws.name = newName;
      await persistence.putWorkspace(ws);
      if (id === workspaceIdRef.current) {
        workspaceNameRef.current = newName;
      }
      await refreshWorkspaceList();
    },
    [refreshWorkspaceList],
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

  const bookmarkItems = bookmarks
    .map((b) => {
      const [fId, sId] = b.split("#");
      const file = files.find((f) => f.id === fId);
      if (!file) return null;
      if (sId === "root") {
        return { fileId: fId, subtopicId: sId, name: file.name };
      }
      const subs = file.subtopics || splitIntoSubtopics(file.content, file.name);
      const sub = subs.find((s) => s.id === sId);
      if (!sub) return null;
      return { fileId: fId, subtopicId: sId, name: sub.title };
    })
    .filter(Boolean) as { fileId: string; subtopicId: string; name: string }[];

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
        headings: parseHeadings(content, id),
        subtopics: splitIntoSubtopics(content, name),
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
    <div className="fixed inset-0 z-(--z-overlay) flex items-center justify-center bg-background/80 backdrop-blur-sm border-4 border-dashed border-primary transition-all duration-300">
      <div className="rounded-3xl bg-card p-10 shadow-2xl flex flex-col items-center gap-6 animate-in fade-in zoom-in duration-300">
        <Upload className="h-16 w-16 text-primary animate-bounce" />
        <div className="text-center">
          <h2 className="text-3xl font-bold text-foreground">Drop files to upload</h2>
          <p className="mt-2 text-base text-muted-foreground">
            Documents, spreadsheets, PDFs, and presentations are ready to preview.
          </p>
        </div>
      </div>
    </div>
  ) : null;

  if (booting) {
    return <div className="min-h-dvh bg-background" />;
  }

  if (files.length === 0 && !showSettings) {
    return (
      <div className="min-h-dvh bg-background">
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
        />
        <CommandPalette
          files={files}
          open={paletteOpen}
          onOpenChange={setPaletteOpen}
          onSelect={openFromHome}
        />
        <div className="flex min-h-[calc(100dvh-4rem)] flex-col items-center justify-center gap-6 px-6 text-center">
          <Upload className="h-14 w-14 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Drop files to view and edit</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              We support Markdown, PDFs, Spreadsheets, Presentations, Images, and more!
            </p>
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Upload files
          </button>
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
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background">
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

      <CommandPalette
        files={files}
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onSelect={handleSelect}
      />

      <div className="flex">
        <div
          ref={sidebarWrapRef}
          className="sticky top-0 hidden h-dvh shrink-0 border-r border-border bg-background md:block md:portrait:hidden"
        >
          <div ref={sidebarInnerRef} className="h-full" style={{ width: sidebarWidth }}>
            <Sidebar
              files={files}
              activeFileId={activeFileId}
              activeHeadingId={activeHeadingId}
              recentFileIds={recentFileIds}
              expanded={expanded}
              onToggleFile={toggleFile}
              onSelect={handleSelect}
              onAddFiles={() => inputRef.current?.click()}
              onRemoveFile={removeFile}
              onArchiveFile={toggleArchiveFile}
              onDownloadFile={downloadFile}
              onRenameFile={renameFile}
              onReorderFile={reorderFile}
              onSortByName={sortFilesByName}
              view={sidebarView}
              onView={setSidebarView}
              bookmarks={bookmarkItems}
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
              onRemoveBookmark={toggleBookmark}
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
            className="absolute inset-y-0 left-0 flex w-14 flex-col items-center gap-4 border-r border-border bg-background py-3 z-20 transition-opacity duration-200"
            style={{
              opacity: sidebarCollapsed ? 1 : 0,
              pointerEvents: sidebarCollapsed ? "auto" : "none",
            }}
          >
            <button
              onClick={() => setSidebarCollapsed(false)}
              className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Expand sidebar"
              title="Expand sidebar"
            >
              <Menu className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPaletteOpen(true)}
              className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Search docs or ask AI"
              title="Search docs or ask AI"
            >
              <Search className="h-4 w-4" />
            </button>
            <button
              onClick={() => inputRef.current?.click()}
              className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Upload files"
              title="Upload files"
            >
              <Plus className="h-4 w-4" />
            </button>
            <div className="flex-1" />
            <button
              onClick={openSettings}
              className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
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
            <div className="absolute left-0 top-0 h-full w-80 max-w-[85vw] border-r border-border bg-background shadow-2xl animate-in slide-in-from-left duration-200">
              <div className="flex h-14 items-center justify-between border-b border-border px-4">
                <span className="text-sm font-semibold truncate px-1">
                  {workspaceNameRef.current || "Workspace"}
                </span>
                <button onClick={() => setDrawerOpen(false)} aria-label="Close">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="h-[calc(100%-3.5rem)]">
                <Sidebar
                  files={files}
                  activeFileId={activeFileId}
                  activeHeadingId={activeHeadingId}
                  recentFileIds={recentFileIds}
                  expanded={expanded}
                  onToggleFile={toggleFile}
                  onSelect={handleSelect}
                  onAddFiles={() => inputRef.current?.click()}
                  onRemoveFile={removeFile}
                  onArchiveFile={toggleArchiveFile}
                  onDownloadFile={downloadFile}
                  onRenameFile={renameFile}
                  onReorderFile={reorderFile}
                  onSortByName={sortFilesByName}
                  view={sidebarView}
                  onView={setSidebarView}
                  bookmarks={bookmarkItems}
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
                  onRemoveBookmark={toggleBookmark}
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

        <main className="min-w-0 flex-1 pb-24 lg:pb-0 md:landscape:pb-0">
          {showSettings ? (
            <SettingsPage
              workspaces={workspaces}
              currentWorkspaceId={workspaceId}
              onRenameWorkspace={renameWorkspace}
              onDeleteWorkspace={deleteWorkspace}
              onClearStorage={clearAllStorage}
              bookmarks={bookmarkItems}
              onRemoveBookmark={toggleBookmark}
              onClearBookmarks={() => {
                setBookmarks([]);
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
              onNav={(fId, sId) => handleSelect(fId, sId || undefined)}
              activeSubtopicId={activeHeadingId}
              highlightQuery={highlightQuery}
              onContentChange={handleContentChange}
              nextReadingMin={nextReadingMin}
              isBookmarked={
                !!activeFile && bookmarks.includes(`${activeFile.id}#${activeHeadingId || "root"}`)
              }
              onToggleBookmark={() =>
                activeFile && toggleBookmark(activeFile.id, activeHeadingId || "root")
              }
              highlights={highlights.filter((h) => h.fileId === activeFile.id)}
              onAddHighlight={(hl) => addHighlight(hl, activeFile.id)}
              onUpdateHighlight={updateHighlight}
              onRemoveHighlight={removeHighlight}
              onHome={goHome}
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
              isBookmarked={bookmarks.includes(`${activeFile.id}#root`)}
              onToggleBookmark={() => toggleBookmark(activeFile.id, "root")}
              prevFile={prevFile}
              nextFile={nextFile}
              onNavFile={(fId) => handleSelect(fId, undefined)}
            />
          ) : null}
        </main>
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
          const hlFileChunks = hlFile.subtopics || splitIntoSubtopics(hlFile.content, hlFile.name);
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
            <HighlightsOnlyModal
              fileName={hlFile.name}
              highlights={fileHighlights}
              onClose={() => setHighlightsOnlyFileId(null)}
              onJump={(hl) => {
                setHighlightsOnlyFileId(null);
                handleSelect(hl.fileId, hl.subtopicId || undefined);
              }}
              onRemove={removeHighlight}
            />
          );
        })()}

      {(() => {
        const subs =
          activeFile?.subtopics ||
          (activeFile ? splitIntoSubtopics(activeFile.content, activeFile.name) : []);
        const section = subs.find((s) => s.id === activeHeadingId) ?? null;
        return (
          <AskAiPanel
            open={aiOpen}
            onClose={() => setAiOpen(false)}
            prefill={aiPrefill}
            initialSelection={null}
            activeFile={
              activeFile
                ? { id: activeFile.id, name: activeFile.name, content: activeFile.content }
                : null
            }
            activeSection={section ? { title: section.title, content: section.content } : null}
            files={files.map((f) => ({ id: f.id, name: f.name, content: f.content }))}
            onInsert={insertAiOutput}
            onCreateDoc={createAiDoc}
          />
        );
      })()}

      {dragOverlay}
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
}) {
  return (
    <header
      className={`z-(--z-nav) flex h-16 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-md md:px-6 relative ${
        hideOnDesktop ? "lg:hidden md:landscape:hidden" : ""
      }`}
    >
      <div className="flex items-center gap-3">
        {!hideMenu && (
          <button
            onClick={() => onMenu?.()}
            className="rounded-md p-2 transition-transform hover:bg-accent active:scale-90 lg:hidden md:landscape:hidden"
            aria-label="Menu"
          >
            <Menu className="h-4 w-4" />
          </button>
        )}
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className={`hidden rounded-md p-2 text-muted-foreground transition-all hover:bg-accent hover:text-foreground active:scale-90 md:portrait:hidden ${sidebarCollapsed ? "md:hidden" : "md:inline-flex"}`}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <Menu className="h-4 w-4" />
          </button>
        )}
        <button
          onClick={onHome}
          className="flex items-center gap-2 rounded-md px-1 py-1 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Home"
          title="Home"
        >
          <span className="text-sm font-semibold tracking-tight text-foreground">Localdox</span>
        </button>
      </div>

      {hasFiles && (
        <div className="absolute left-1/2 -translate-x-1/2 hidden lg:flex md:landscape:flex items-center">
          <button
            onClick={onOpenPalette}
            className="w-80 items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground flex"
          >
            <Search className="h-3.5 w-3.5" />
            <span>Search...</span>
            <span className="ml-auto flex items-center gap-1">
              <kbd className="rounded border border-border bg-background px-1 py-0.5 font-mono text-xs">
                ⌘
              </kbd>
              <kbd className="rounded border border-border bg-background px-1 py-0.5 font-mono text-xs">
                K
              </kbd>
            </span>
          </button>
        </div>
      )}

      <div className="flex items-center gap-3">
        {hasFiles && (
          <button
            onClick={onOpenPalette}
            className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:hidden md:landscape:hidden"
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
      </div>
    </header>
  );
}
