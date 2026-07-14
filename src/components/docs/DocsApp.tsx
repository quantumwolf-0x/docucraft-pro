import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, Navigate } from "@tanstack/react-router";
import gsap from "gsap";
import {
  BookOpen,
  Menu,
  Moon,
  Sun,
  X,
  Search,
  Plus,
  Monitor,
  PanelLeftClose,
  PanelLeftOpen,
  Undo2,
  Home,
} from "lucide-react";

import { Sidebar } from "./Sidebar";
import { MarkdownViewer } from "./MarkdownViewer";
import { CommandPalette } from "./CommandPalette";
import { WorkspaceMenu } from "./WorkspaceMenu";
import { HomePage } from "./HomePage";
import { SettingsPage } from "./SettingsPage";
import { MobileBottomNav } from "./MobileBottomNav";
import type { MdFile, MdChunk } from "@/lib/markdown-utils";
import type { Highlight } from "@/lib/dom-highlighter";
import { parseHeadings, readingMinutes, splitIntoSubtopics } from "@/lib/markdown-utils";
import { useReadingProgress, pickResume } from "@/lib/reading-progress";
import { toast } from "sonner";
import {
  persistence,
  loadPrefs,
  savePrefs,
  newWorkspaceRecord,
  serializeWorkspace,
  parseWorkspaceImport,
  type WorkspaceRecord,
  type SaveStatus,
  type ThemePref,
} from "@/lib/persistence";

type Theme = ThemePref;

const SIDEBAR_MIN = 220;
const SIDEBAR_MAX = 480;
const SIDEBAR_DEFAULT = 288;
const SIDEBAR_WIDTH_KEY = "docucraft:sidebarWidth";

const clampWidth = (w: number) => Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, w));

function loadSidebarWidth(): number {
  if (typeof localStorage === "undefined") return SIDEBAR_DEFAULT;
  const v = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY));
  return v >= SIDEBAR_MIN && v <= SIDEBAR_MAX ? v : SIDEBAR_DEFAULT;
}

interface WorkspaceLite {
  id: string;
  name: string;
}

export function DocsApp() {
  const [files, setFiles] = useState<MdFile[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null);
  const [scrollTarget, setScrollTarget] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => loadPrefs().theme);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(loadSidebarWidth);
  const [highlightQuery, setHighlightQuery] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Persistence-facing state.
  const [booting, setBooting] = useState(true);
  const [workspaces, setWorkspaces] = useState<WorkspaceLite[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [highlights, setHighlights] = useState<Highlight[]>([]);

  // Home page + personalization.
  const location = useLocation();
  const navigate = useNavigate();
  const showHome = location.pathname === "/";
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
  const snapshotRef = useRef({ files, activeFileId, expanded, sidebarCollapsed, bookmarks, highlights });
  snapshotRef.current = { files, activeFileId, expanded, sidebarCollapsed, bookmarks, highlights };
  const scrollRef = useRef(0);
  const workspaceIdRef = useRef<string | null>(null);
  const workspaceNameRef = useRef("My workspace");
  const createdAtRef = useRef(Date.now());
  const hydratedRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoredFlash = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { map: progress, recordScroll, touch } = useReadingProgress();

  useEffect(() => {
    widthRef.current = sidebarWidth;
  }, [sidebarWidth]);

  // Collapse/expand the desktop sidebar; the main column is flex-1, so animating
  // the sidebar width lets content reflow frame-by-frame rather than snapping.
  // Width is driven imperatively so a re-render can't clobber the tween.
  useEffect(() => {
    const wrap = sidebarWrapRef.current;
    if (!wrap) return;
    const target = sidebarCollapsed ? 0 : widthRef.current;
    if (firstCollapseRun.current) {
      gsap.set(wrap, { width: target });
      firstCollapseRun.current = false;
    } else {
      gsap.to(wrap, { width: target, duration: 0.45, ease: "power3.inOut" });
    }
    if (sidebarInnerRef.current) {
      gsap.to(sidebarInnerRef.current, {
        opacity: sidebarCollapsed ? 0 : 1,
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
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const isDark = theme === "dark" || (theme === "system" && mq.matches);
      document.documentElement.classList.toggle("dark", isDark);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);

  useEffect(() => {
    savePrefs({ theme });
  }, [theme]);

  // ---- persistence core ----

  const buildRecord = useCallback((): WorkspaceRecord => {
    const s = snapshotRef.current;
    return {
      id: workspaceIdRef.current ?? crypto.randomUUID(),
      name: workspaceNameRef.current,
      createdAt: createdAtRef.current,
      updatedAt: Date.now(),
      files: s.files.map((f) => ({ id: f.id, name: f.name, content: f.content })),
      bookmarks: s.bookmarks,
      highlights: s.highlights,
      ui: {
        activeFileId: s.activeFileId,
        expanded: s.expanded,
        sidebarCollapsed: s.sidebarCollapsed,
        scrollTop: scrollRef.current,
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
    const parsed: MdFile[] = ws.files.map((f) => ({
      id: f.id,
      name: f.name,
      content: f.content,
      headings: parseHeadings(f.content, f.id),
      subtopics: splitIntoSubtopics(f.content, f.name),
    }));
    setFiles(parsed);
    setActiveFileId(ws.ui?.activeFileId ?? parsed[0]?.id ?? null);
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
    setWorkspaces(list.map((w) => ({ id: w.id, name: w.name })));
  }, []);

  // Restore the previous session on first load.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const prefs = loadPrefs();
        setUserName(prefs.name);
        firstVisitRef.current = !prefs.name;
        const list = await persistence.listWorkspaces().catch(() => [] as WorkspaceRecord[]);
        if (list.length === 0) {
          if (!alive) return;
          setWorkspaces([]);
          setWorkspaceId(null);
          workspaceIdRef.current = null;
          setSaveStatus("idle");
        } else {
          const ws = list.find((w) => w.id === prefs.lastWorkspaceId) ?? list[0];
          if (!alive) return;
          list.sort((a, b) => a.createdAt - b.createdAt);
          setWorkspaces(list.map((w) => ({ id: w.id, name: w.name })));
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
      scrollTimer.current = setTimeout(() => void persistNow(true), 1200);
    };
    const flush = () => {
      if (hydratedRef.current) void persistNow(true);
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
      const total = fileList.length;
      if (total === 0) return;
      
      const toastId = toast.loading(`Uploading ${total} file${total > 1 ? "s" : ""}...`);
      
      try {
        let loaded = 0;
        const parsed: MdFile[] = await Promise.all(
          fileList.map(async (f) => {
            const content = await f.text();
            loaded++;
            toast.loading(`Uploading ${total} file${total > 1 ? "s" : ""}... ${Math.round((loaded / total) * 100)}%`, { id: toastId });
            const id = `${f.name}-${crypto.randomUUID().slice(0, 8)}`;
            return { id, name: f.name, content, headings: parseHeadings(content, id), subtopics: splitIntoSubtopics(content, f.name) };
          }),
        );

        const nextFiles = [...snapshotRef.current.files, ...parsed];
        const resumeName = snapshotRef.current.activeFileId
          ? null
          : pickResume(parsed.map((f) => f.name), progress);
        const resume = resumeName ? parsed.find((f) => f.name === resumeName) : null;
        const nextActiveFileId = snapshotRef.current.activeFileId ?? (resume ?? parsed[0])?.id ?? null;

        if (!workspaceIdRef.current) {
          const id = crypto.randomUUID();
          workspaceIdRef.current = id;
          workspaceNameRef.current = "My workspace";
          createdAtRef.current = Date.now();
          setWorkspaceId(id);
          setWorkspaces([{ id, name: workspaceNameRef.current }]);
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

        toast.success(`Successfully uploaded ${total} file${total > 1 ? "s" : ""}!`, { id: toastId });
        navigate({ to: "/md-reader" }); // Uploading takes you straight into reading.
      } catch {
        setSaveStatus("idle");
        toast.error("Could not upload the selected file(s). Please try again.", { id: toastId });
      }
    },
    [buildRecord, navigate, progress],
  );

  const handleFileInput = useCallback((list: FileList | null) => {
    if (!list) return;
    const picked = Array.from(list).filter((f) => /\.(md|markdown|mdx|txt)$/i.test(f.name));
    if (picked.length) addFiles(picked);
  }, [addFiles]);

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
  const activeIdx = activeFile ? files.findIndex((f) => f.id === activeFile.id) : -1;
  const prevFile = activeIdx > 0 ? files[activeIdx - 1] : null;
  const nextFile = activeIdx >= 0 && activeIdx < files.length - 1 ? files[activeIdx + 1] : null;

  const handleSelect = (fileId: string, headingId?: string, query?: string) => {
    setActiveFileId(fileId);
    if (query !== undefined) setHighlightQuery(query || null);
    
    let targetHeadingId = headingId;
    if (!targetHeadingId) {
       const file = files.find(f => f.id === fileId);
       const subs = file?.subtopics || (file ? splitIntoSubtopics(file.content, file.name) : []);
       targetHeadingId = subs?.[0]?.id || "preamble";
    }
    setActiveHeadingId(targetHeadingId);
    
    if (location.pathname !== "/md-reader") {
      navigate({ to: "/md-reader" });
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

  const renameFile = useCallback(
    (id: string, newName: string) => {
      setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, name: newName } : f)));
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
            !(hl.end <= p.start || hl.start >= p.end)
        );
        const withoutOverlaps = prev.filter((p) => !overlaps.includes(p));
        return [
          ...withoutOverlaps,
          { id: crypto.randomUUID(), fileId, ...hl },
        ];
      });
      markDirty();
    },
    [markDirty],
  );

  const updateHighlight = useCallback(
    (id: string, patch: Partial<{ color: string; label: string }>) => {
      setHighlights((prev) =>
        prev.map((h) => (h.id === id ? { ...h, ...patch } : h)),
      );
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
      setBookmarks((prev) =>
        prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id],
      );
      markDirty();
    },
    [markDirty],
  );

  const submitName = useCallback((name: string) => {
    const clean = name.trim();
    if (!clean) return;
    savePrefs({ name: clean });
    setUserName(clean);
    // If the current workspace still has the generic default name, personalize it.
    const currentId = workspaceIdRef.current;
    if (currentId && /^(my workspace|workspace \d+)$/i.test(workspaceNameRef.current)) {
      const personalized = `${clean}'s Workspace`;
      workspaceNameRef.current = personalized;
      void (async () => {
        const ws = await persistence.getWorkspace(currentId);
        if (ws) {
          ws.name = personalized;
          await persistence.putWorkspace(ws);
          await refreshWorkspaceList();
        }
      })();
    }
  }, [refreshWorkspaceList]);

  const openFromHome = useCallback(
    async (fileId: string, subtopicId?: string) => {
      const file = files.find((item) => item.id === fileId);
      if (!file) return;

      const chunks = file.subtopics || splitIntoSubtopics(file.content, file.name);
      const targetSubtopicId = subtopicId ?? chunks[0]?.id ?? "preamble";

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

      navigate({ to: "/md-reader" });
    },
    [buildRecord, files, navigate],
  );

  const handleContentChange = useCallback(
    (fileId: string, content: string) => {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileId ? { ...f, content, headings: parseHeadings(content, fileId), subtopics: splitIntoSubtopics(content, f.name) } : f,
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

  useEffect(() => {
    if (activeFile) touch(activeFile.name);
  }, [activeFileId, activeFile, touch]);

  const cycleTheme = () =>
    setTheme((t) => (t === "dark" ? "light" : "dark"));

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

  const newWorkspace = useCallback(async (name?: string) => {
    await persistNow(true);
    const ws = newWorkspaceRecord(name || `Workspace ${workspaces.length + 1}`);
    await persistence.putWorkspace(ws);
    await refreshWorkspaceList();
    hydrateWorkspace(ws);
    savePrefs({ lastWorkspaceId: ws.id });
  }, [persistNow, refreshWorkspaceList, hydrateWorkspace, workspaces.length]);

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
      setWorkspaces(list.map((w) => ({ id: w.id, name: w.name })));
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
      alert("Some data could not be cleared. Close DocuCraft in other tabs and try again.");
    }
  }, []);

  // ---- home page data ----
  const workspaceFileItems = files.map((file) => ({
    id: file.id,
    name: file.name,
    minutes: readingMinutes(file.content),
  }));

  const workspaceItems = workspaces.map((w) => ({
    id: w.id,
    name: w.name,
    current: w.id === workspaceId,
  }));

  const bookmarkItems = bookmarks
    .map((b) => {
      const [fId, sId] = b.split("#");
      const file = files.find((f) => f.id === fId);
      if (!file) return null;
      const subs = file.subtopics || splitIntoSubtopics(file.content, file.name);
      const sub = subs.find((s) => s.id === sId);
      if (!sub) return null;
      return { fileId: fId, subtopicId: sId, name: sub.title };
    })
    .filter(Boolean) as { fileId: string; subtopicId: string; name: string }[];

  const goHome = useCallback(() => navigate({ to: "/" }), [navigate]);
  const openSettings = useCallback(() => navigate({ to: "/settings" }), [navigate]);

  const openWorkspaceFromHome = useCallback(
    async (id: string) => {
      if (id !== workspaceIdRef.current) await switchWorkspace(id);
      navigate({ to: "/md-reader" });
    },
    [switchWorkspace, navigate],
  );

  const createWorkspaceFromDock = useCallback(async () => {
    await newWorkspace();
    navigate({ to: "/md-reader" });
  }, [navigate, newWorkspace]);

  const workspaceMenu = (
    <WorkspaceMenu
      workspaces={workspaces}
      currentId={workspaceId}
      onSwitch={switchWorkspace}
      onNew={newWorkspace}
      onImport={importWorkspace}
      onExport={exportWorkspace}
      onDelete={deleteWorkspace}
      onRename={renameWorkspace}
    />
  );

  useEffect(() => {
    if (!showHome && !showSettings && files.length === 0 && !booting) {
      navigate({ to: "/", replace: true });
    }
  }, [showHome, showSettings, files.length, booting, navigate]);

  const dragOverlay = globalDrag ? (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm border-4 border-dashed border-primary transition-all duration-300">
      <div className="rounded-3xl bg-card p-10 shadow-2xl flex flex-col items-center gap-6 animate-in fade-in zoom-in duration-300">
        <Upload className="h-16 w-16 text-primary animate-bounce" />
        <div className="text-center">
          <h2 className="text-3xl font-bold text-foreground">Drop files to upload</h2>
          <p className="mt-2 text-base text-muted-foreground">Your Markdown files will be instantly imported.</p>
        </div>
      </div>
    </div>
  ) : null;

  if (booting) {
    return <div className="min-h-dvh bg-background" />;
  }

  if (showHome) {
    return (
      <div className="min-h-dvh bg-background">
        <Header
          theme={theme}
          onCycleTheme={cycleTheme}
          onMenu={null}
          hideMenu
          hideUpload
          onOpenPalette={() => setPaletteOpen(true)}
          hasFiles={files.length > 0}
          onAddFiles={() => inputRef.current?.click()}
          saveStatus={saveStatus}
          workspaceMenu={workspaceMenu}
          onHome={goHome}
        />
        <CommandPalette
          files={files}
          open={paletteOpen}
          onOpenChange={setPaletteOpen}
          onSelect={openFromHome}
        />
        <HomePage
          userName={userName}
          onSubmitName={submitName}
          files={workspaceFileItems}
          workspaces={workspaceItems}
          onOpenFile={openFromHome}
          onOpenWorkspace={openWorkspaceFromHome}
          onUpload={() => inputRef.current?.click()}
          onFilesDrop={handleFileInput}
        />
        <div className="pb-24 pt-8 text-center text-xs text-muted-foreground lg:pb-8 md:landscape:pb-8">
          Built with ❤️ by Janardhan
        </div>
        <MobileBottomNav
          workspaces={workspaces}
          currentWorkspaceId={workspaceId}
          bookmarks={bookmarkItems}
          settingsOpen={showSettings}
          onHome={goHome}
          onOpenSettings={openSettings}
          onUpload={() => inputRef.current?.click()}
          onOpenBookmark={openFromHome}
          onOpenWorkspace={openWorkspaceFromHome}
          onNewWorkspace={createWorkspaceFromDock}
          isHome={true}
        />
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".md,.markdown,.mdx,.txt,text/markdown"
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


  if (files.length === 0 && !showSettings) {
    return <div className="min-h-dvh bg-background" />;
  }

  return (
    <div className="min-h-dvh bg-background">
      <Header
        theme={theme}
        onCycleTheme={cycleTheme}
        onMenu={() => setDrawerOpen(true)}
        onOpenPalette={() => setPaletteOpen(true)}
        hasFiles
        onAddFiles={() => inputRef.current?.click()}
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={toggleSidebar}
        saveStatus={saveStatus}
        workspaceMenu={workspaceMenu}
        onHome={goHome}
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
          className="sticky top-16 hidden h-[calc(100dvh-4rem)] shrink-0 overflow-hidden border-r border-border md:block md:portrait:hidden"
        >
          <div ref={sidebarInnerRef} className="h-full" style={{ width: sidebarWidth }}>
            <Sidebar
              files={files}
              activeFileId={activeFileId}
              activeHeadingId={activeHeadingId}
              progress={progress}
              expanded={expanded}
              onToggleFile={toggleFile}
              onSelect={handleSelect}
              onAddFiles={() => inputRef.current?.click()}
              onRemoveFile={removeFile}
              onRenameFile={renameFile}
              bookmarks={bookmarkItems}
              currentWorkspaceName={workspaceNameRef.current}
              canDeleteWorkspace={workspaces.length > 1}
              onRenameCurrentWorkspace={renameWorkspace}
              onDeleteCurrentWorkspace={deleteWorkspace}
              onClearStorage={clearAllStorage}
              highlights={highlights}
              onRemoveBookmark={toggleBookmark}
              onRemoveHighlight={removeHighlight}
            />
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
              className="group absolute right-0 top-0 z-20 h-full w-1.5 cursor-col-resize"
            >
              <span className="absolute right-0 top-0 h-full w-px bg-transparent transition-colors group-hover:bg-primary/50" />
            </div>
          )}
        </div>

        {drawerOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div
              className="absolute inset-0 bg-foreground/20 backdrop-blur-sm"
              onClick={() => setDrawerOpen(false)}
            />
            <div className="absolute left-0 top-0 h-full w-80 max-w-[85vw] border-r border-border bg-background shadow-2xl animate-in slide-in-from-left duration-200">
              <div className="flex h-14 items-center justify-between border-b border-border px-4">
                <span className="text-sm font-semibold">Documentation</span>
                <button onClick={() => setDrawerOpen(false)} aria-label="Close">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="h-[calc(100%-3.5rem)]">
                <Sidebar
                  files={files}
                  activeFileId={activeFileId}
                  activeHeadingId={activeHeadingId}
                  progress={progress}
                  expanded={expanded}
                  onToggleFile={toggleFile}
                  onSelect={handleSelect}
                  onAddFiles={() => inputRef.current?.click()}
                  onRemoveFile={removeFile}
                  onRenameFile={renameFile}
                  bookmarks={bookmarkItems}
                  currentWorkspaceName={workspaceNameRef.current}
                  canDeleteWorkspace={workspaces.length > 1}
                  onRenameCurrentWorkspace={renameWorkspace}
                  onDeleteCurrentWorkspace={deleteWorkspace}
                  onClearStorage={clearAllStorage}
                  highlights={highlights}
                  onRemoveBookmark={toggleBookmark}
                  onRemoveHighlight={removeHighlight}
                />
              </div>
            </div>
          </div>
        )}

        <main className="min-w-0 flex-1 pb-24 lg:pb-0 md:landscape:pb-0">
          {showSettings ? (
            <SettingsPage
              theme={theme}
              onThemeChange={setTheme}
              workspaces={workspaces}
              currentWorkspaceId={workspaceId}
              onRenameWorkspace={renameWorkspace}
              onDeleteWorkspace={deleteWorkspace}
              onClearStorage={clearAllStorage}
              bookmarks={bookmarkItems}
              onRemoveBookmark={toggleBookmark}
              onClearBookmarks={() => { setBookmarks([]); markDirty(); }}
              highlights={highlights}
              onRemoveHighlight={removeHighlight}
              onClearHighlights={() => { setHighlights([]); markDirty(); }}
              onNavigate={openFromHome}
              files={files}
              onOpenWorkspace={openWorkspaceFromHome}
            />
          ) : activeFile && (
            <MarkdownViewer
              file={activeFile}
              prevFile={prevFile}
              nextFile={nextFile}
              onNav={(fId, sId) => handleSelect(fId, sId || undefined)}
              activeSubtopicId={activeHeadingId}
              highlightQuery={highlightQuery}
              onContentChange={handleContentChange}
              nextReadingMin={nextReadingMin}
              isBookmarked={!!activeFile && !!activeHeadingId && bookmarks.includes(`${activeFile.id}#${activeHeadingId}`)}
              onToggleBookmark={() => activeFile && activeHeadingId && toggleBookmark(activeFile.id, activeHeadingId)}
              highlights={highlights.filter((h) => h.fileId === activeFile.id)}
              onAddHighlight={(hl) => addHighlight(hl, activeFile.id)}
              onUpdateHighlight={updateHighlight}
              onRemoveHighlight={removeHighlight}
              onHome={goHome}
            />
          )}
        </main>
      </div>

      <MobileBottomNav
        workspaces={workspaces}
        currentWorkspaceId={workspaceId}
        bookmarks={bookmarkItems}
        settingsOpen={showSettings}
        onHome={goHome}
        onOpenSettings={openSettings}
        onUpload={() => inputRef.current?.click()}
        onOpenBookmark={openFromHome}
        onOpenWorkspace={openWorkspaceFromHome}
        onNewWorkspace={createWorkspaceFromDock}
      />

      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".md,.markdown,.mdx,.txt,text/markdown"
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

function Header({
  theme,
  onCycleTheme,
  onMenu,
  hideMenu,
  hideUpload,
  onOpenPalette,
  hasFiles,
  onAddFiles,
  sidebarCollapsed,
  onToggleSidebar,
  saveStatus,
  workspaceMenu,
  onHome,
}: {
  theme: Theme;
  onCycleTheme: () => void;
  onMenu: (() => void) | null;
  hideMenu?: boolean;
  hideUpload?: boolean;
  onOpenPalette: () => void;
  hasFiles: boolean;
  onAddFiles: () => void;
  sidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  saveStatus?: SaveStatus;
  workspaceMenu?: React.ReactNode;
  onHome?: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md md:px-6">
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
          className="hidden rounded-md p-2 text-muted-foreground transition-all hover:bg-accent hover:text-foreground active:scale-90 md:inline-flex md:portrait:hidden"
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
        <span className="text-sm font-semibold tracking-tight text-foreground">
          Markdown Docs
        </span>
      </button>

      {hasFiles && (
        <div className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 lg:flex">
          <button
            onClick={onOpenPalette}
            className="flex w-[400px] items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            <Search className="h-3.5 w-3.5" />
            <span>Search documentation…</span>
            <span className="ml-auto flex items-center gap-1">
              <kbd className="rounded border border-border bg-background px-1 py-0.5 font-mono text-[10px]">
                ⌘
              </kbd>
              <kbd className="rounded border border-border bg-background px-1 py-0.5 font-mono text-[10px]">
                K
              </kbd>
            </span>
          </button>
        </div>
      )}

      <div className="ml-auto flex items-center gap-2">
        {hasFiles && (
          <>
            <button
              onClick={onOpenPalette}
              className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:hidden"
              aria-label="Search"
            >
              <Search className="h-4 w-4" />
            </button>
            {!hideUpload && (
              <div className="hidden md:landscape:block lg:block">
                <button
                  onClick={onAddFiles}
                  className="flex h-8 w-8 items-center justify-center gap-1.5 rounded-md bg-primary text-primary-foreground shadow transition-colors hover:bg-primary/90 sm:w-auto sm:px-3"
                  aria-label="Add files"
                  title="Add files"
                >
                  <Plus className="h-4 w-4 shrink-0" />
                  <span className="hidden text-sm font-medium sm:inline">Upload</span>
                </button>
              </div>
            )}
          </>
        )}
        <div className="hidden md:landscape:block lg:block">{workspaceMenu}</div>
      </div>
    </header>
  );
}
