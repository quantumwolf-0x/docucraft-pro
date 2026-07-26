import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import gsap from "gsap";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeSlug from "rehype-slug";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import {
  Check,
  Copy,
  Link2,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronRight,
  Clock,
  Pencil,
  Eye,
  Info,
  AlertTriangle,
  Lightbulb,
  AlertOctagon,
  StickyNote,
  Tag,
  Trash2,
  X,
  ScrollText,
  Files,
  Sparkles,
  BookOpen,
  ChevronLeft,
  Star,
  Share,
  MoreHorizontal,
  Presentation,
  Crosshair,
} from "lucide-react";
import { Spotlight } from "./PresentationMode";
import type { MdFile } from "@/lib/markdown-utils";
import type { ReadingMode } from "@/lib/persistence";
import { slugify } from "@/lib/markdown-utils";
import { Mermaid } from "./Mermaid";
import { detectEmbed, EmbedFrame, isVideoUrl, VideoPlayer } from "@/lib/media-embeds";
import { Lightbox } from "./Lightbox";
import { HL_COLORS, hlGroup, type Highlight } from "@/lib/dom-highlighter";
import {
  getSelectionOffsets,
  buildRange,
  offsetFromPoint,
  firstTextRange,
  releaseTextIndex,
} from "@/lib/text-offsets";
import { locateInSource, caretTop } from "@/lib/source-locate";
import { splitIntoSubtopics, headingChunkMap } from "@/lib/markdown-utils";
import { InlineArtifact } from "./InlineArtifact";
import { InteractiveBlock } from "./InteractiveBlock";
import {
  artifactReference,
  isArtifactUrl,
  prepareWorkspaceEmbeds,
} from "@/lib/workspace-artifacts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ViewerHeader, HeaderTitle } from "./ViewerHeader";

interface Props {
  file: MdFile;
  prevFile: MdFile | null;
  nextFile: MdFile | null;
  onNav: (fileId: string, subtopicId: string | null) => void;
  activeSubtopicId: string | null;
  highlightQuery: string | null;
  onContentChange: (fileId: string, content: string) => void;
  nextReadingMin: number | null;
  isBookmarked: boolean;
  onToggleBookmark: () => void;
  highlights: Highlight[];
  onAddHighlight: (hl: Omit<Highlight, "id" | "fileId">) => void;
  onUpdateHighlight: (id: string, patch: Partial<Pick<Highlight, "color" | "label">>) => void;
  onRemoveHighlight: (id: string) => void;
  onHome?: () => void;
  workspaceId?: string | null;
  workspaceRevision?: string;
  workspaceFiles?: MdFile[];
  workspaceName?: string;
  onOpenArtifact?: (fileId: string, workspaceId: string) => void;
  onRemoveFile?: () => void;
  readingMode?: ReadingMode;
  onToggleReadingMode?: () => void;
  /** Open the Ask AI panel prefilled from the current selection. */
  onAskAi?: (prefill: { selection: string; actionId?: string }) => void;
}

const stripExt = (name: string) => name.replace(/\.(md|markdown|mdx|txt)$/i, "");

export function MarkdownViewer({
  file,
  prevFile,
  nextFile,
  onNav,
  activeSubtopicId,
  highlightQuery,
  onContentChange,
  nextReadingMin,
  isBookmarked,
  onToggleBookmark,
  highlights,
  onAddHighlight,
  onUpdateHighlight,
  onRemoveHighlight,
  onHome,
  workspaceId,
  workspaceRevision,
  workspaceFiles,
  workspaceName,
  onOpenArtifact,
  onRemoveFile,
  readingMode = "paginated",
  onToggleReadingMode,
  onAskAi,
}: Props) {
  const singleMode = readingMode === "single";
  const containerRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [showTop, setShowTop] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [presentMode, setPresentMode] = useState(false);
  const [draft, setDraft] = useState(file.content);

  useEffect(() => {
    const onFullscreenChange = () => {
      setPresentMode(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const togglePresentation = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(console.error);
    } else {
      document.exitFullscreen().catch(console.error);
    }
  };

  const allChunks = useMemo(
    () => file.subtopics || splitIntoSubtopics(file.content, file.name),
    [file.subtopics, file.content, file.name],
  );

  // A selected heading may be a nested ##/### that lives inside a # page rather
  // than being a page itself; resolve it to its parent # chunk id.
  const chunkForHeading = useMemo(() => headingChunkMap(file.content), [file.content]);

  const activeChunk = useMemo(() => {
    const targetId = (activeSubtopicId && chunkForHeading[activeSubtopicId]) || activeSubtopicId;
    return (
      allChunks.find((s) => s.id === targetId) ||
      allChunks[0] || { id: "preamble", title: stripExt(file.name), content: file.content }
    );
  }, [allChunks, activeSubtopicId, chunkForHeading, file.content, file.name]);

  const chunkIndex = allChunks.findIndex((s) => s.id === activeChunk.id);
  const isLastChunk = chunkIndex === allChunks.length - 1;
  const prevChunk = chunkIndex > 0 ? allChunks[chunkIndex - 1] : null;
  const nextChunk =
    chunkIndex >= 0 && chunkIndex < allChunks.length - 1 ? allChunks[chunkIndex + 1] : null;

  const renderContent = useMemo(() => {
    let content = activeChunk.content.replace(/^\s*(#{1,6})\s+[^\n]+(\n|$)/, "");

    // Strip leading horizontal rules (often left over when users separate sections with ---)
    while (true) {
      const next = content.replace(/^\s*(?:[-*_][ \t]*){3,}(?:\r?\n|$)/, "");
      if (next === content) break;
      content = next;
    }

    // Strip trailing horizontal rules
    while (true) {
      const next = content.replace(/(?:\r?\n|^)\s*(?:[-*_][ \t]*){3,}\s*$/, "");
      if (next === content) break;
      content = next;
    }

    return prepareWorkspaceEmbeds(content);
  }, [activeChunk.content]);

  // Single-page mode renders the whole document at once. Content is left intact
  // so every heading keeps its anchor id for in-page section navigation.
  const fullRender = useMemo(() => {
    return prepareWorkspaceEmbeds(file.content);
  }, [file.content]);

  const [lightbox, setLightbox] = useState<{ src: string; alt?: string } | null>(null);

  // Highlight menu: "create" from a fresh selection, or "edit" from clicking an
  // existing highlight. A single popover serves both. Detached from the live
  // Selection so typing a label doesn't dismiss it.
  const contentRef = useRef<HTMLDivElement>(null);
  type HlMenu =
    | {
        mode: "create";
        text: string;
        start: number;
        end: number;
        x: number;
        y: number;
        label: string;
      }
    | { mode: "edit"; hl: Highlight; x: number; y: number; label: string };
  const [menu, setMenu] = useState<HlMenu | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const openCreateMenu = (at?: { x: number; y: number }) => {
    // Offsets are relative to whatever is rendered in contentRef: the active
    // section in paged mode, the whole document in single mode. Both work.
    if (editMode || !contentRef.current) return;
    const sel = getSelectionOffsets(contentRef.current);
    if (!sel) return;
    const range = window.getSelection()?.getRangeAt(0);
    const r = range?.getBoundingClientRect();
    setMenu({
      mode: "create",
      text: sel.text,
      start: sel.start,
      end: sel.end,
      x: at ? at.x : r ? r.left + r.width / 2 : window.innerWidth / 2,
      y: at ? at.y : r ? r.top : 120,
      label: "",
    });
  };

  const openEditMenu = (hl: Highlight, x: number, y: number) => {
    setMenu({ mode: "edit", hl, x, y, label: hl.label ?? "" });
  };

  // "Inspect" — the reader's answer to DevTools' inspect element. Take the
  // rendered text under the pointer, find where it lives in the markdown
  // source, and drop the editor's caret on it, selected and scrolled into view.
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const [pendingSelect, setPendingSelect] = useState<{ start: number; end: number } | null>(null);
  const [inspectMissed, setInspectMissed] = useState(false);

  const inspect = (text: string) => {
    // Paged mode renders one section, so prefer a match inside that section —
    // a phrase repeated elsewhere shouldn't hijack the jump.
    const chunkStart = singleMode ? -1 : file.content.indexOf(activeChunk.content);
    const prefer =
      chunkStart >= 0 && !singleMode
        ? { from: chunkStart, to: chunkStart + activeChunk.content.length }
        : undefined;
    const span = locateInSource(file.content, text, prefer);

    setMenu(null);
    window.getSelection()?.removeAllRanges();
    setInspectMissed(!span);
    // The editor edits `draft`; make sure it starts from what's on screen.
    setDraft(file.content);
    setEditMode(true);
    setPendingSelect(span ?? { start: Math.max(0, chunkStart), end: Math.max(0, chunkStart) });
  };

  // Applied once the textarea has mounted with the new draft.
  useEffect(() => {
    if (!pendingSelect || !editMode) return;
    const ta = editorRef.current;
    if (!ta) return;
    const { start, end } = pendingSelect;
    setPendingSelect(null);
    ta.focus({ preventScroll: true });
    ta.setSelectionRange(start, end);
    ta.scrollTop = Math.max(0, caretTop(ta, start) - ta.clientHeight / 3);
    ta.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [pendingSelect, editMode, draft]);

  // The "couldn't find it" notice is per-jump, not sticky.
  useEffect(() => {
    if (!inspectMissed) return;
    const t = setTimeout(() => setInspectMissed(false), 6000);
    return () => clearTimeout(t);
  }, [inspectMissed]);

  // Right-click behaves like DevTools: it acts on what's under the pointer.
  // With nothing selected, select the block being pointed at first, so the
  // popover (and Inspect) has something concrete to work with.
  const onContextMenu = (e: React.MouseEvent) => {
    if (editMode || !contentRef.current) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      const el = (e.target as HTMLElement)?.closest(
        "p, li, h1, h2, h3, h4, h5, h6, td, th, blockquote, pre, figcaption",
      );
      if (!el || !contentRef.current.contains(el)) return;
      const range = document.createRange();
      range.selectNodeContents(el);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
    e.preventDefault();
    openCreateMenu({ x: e.clientX, y: e.clientY });
  };

  // Paint persistent highlights with the CSS Custom Highlight API — no DOM
  // mutation, so React re-renders never wipe them and cross-node selections
  // highlight correctly. Groups map to ::highlight(dc-hl-N) rules in the CSS.
  useEffect(() => {
    const container = contentRef.current;
    const CSSH = (typeof CSS !== "undefined" && (CSS as any).highlights) as
      Map<string, any> | undefined;
    if (!container || !CSSH || typeof (window as any).Highlight === "undefined") return;

    // Deferred to the next frame so adding a highlight doesn't repaint every
    // other one synchronously inside the same commit the reader is watching.
    const frame = requestAnimationFrame(() => {
      const groups: Record<string, Range[]> = {};
      for (const hl of highlights) {
        let range: Range | null;
        if (singleMode) {
          // Whole-doc view. Highlights made here carry no subtopicId and full-doc
          // offsets — use them directly. Section highlights (subtopicId set) have
          // offsets relative to their section, meaningless here, so anchor by text.
          range =
            !hl.subtopicId && typeof hl.start === "number" && typeof hl.end === "number"
              ? buildRange(container, hl.start, hl.end)
              : firstTextRange(container, hl.text);
        } else {
          if (hl.subtopicId && hl.subtopicId !== activeChunk.id) continue;
          range =
            typeof hl.start === "number" && typeof hl.end === "number"
              ? buildRange(container, hl.start, hl.end)
              : firstTextRange(container, hl.text);
        }
        if (!range || range.collapsed) continue;
        const g = hlGroup(hl.color);
        (groups[g] ||= []).push(range);
      }

      HL_COLORS.forEach((c) => CSSH.delete(hlGroup(c)));
      for (const [g, ranges] of Object.entries(groups)) {
        CSSH.set(g, new (window as any).Highlight(...ranges));
      }
    });

    return () => {
      cancelAnimationFrame(frame);
      HL_COLORS.forEach((c) => CSSH.delete(hlGroup(c)));
    };
  }, [highlights, activeChunk.id, renderContent, fullRender, editMode, singleMode]);

  // The offset index outlives this component's containers; drop it on unmount
  // so a stale document can't keep its text nodes (or its observer) alive.
  useEffect(() => releaseTextIndex, []);

  // Click inside the content: if the click lands on an existing highlight, open
  // its edit popover (CSS highlights aren't DOM nodes, so we hit-test offsets).
  const onContentClick = (e: React.MouseEvent) => {
    if (editMode || !contentRef.current) return;
    if (!highlights.length) return; // nothing to hit-test against
    if (!window.getSelection()?.isCollapsed) return; // a drag-select, not a click
    const off = offsetFromPoint(contentRef.current, e.clientX, e.clientY);
    if (off == null) return;
    // In single mode only whole-doc highlights carry offsets valid for this
    // container; section highlights are painted by text and aren't hit-testable.
    const hit = highlights.find(
      (h) =>
        (singleMode ? !h.subtopicId : !h.subtopicId || h.subtopicId === activeChunk.id) &&
        typeof h.start === "number" &&
        typeof h.end === "number" &&
        off >= h.start &&
        off < h.end,
    );
    if (hit) openEditMenu(hit, e.clientX, e.clientY);
  };

  // Close the menu on outside click / Escape (but keep it open while the reader
  // interacts with the popover itself).
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(null);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  useEffect(() => setMenu(null), [activeChunk.id, file.id, editMode]);

  useEffect(() => {
    setDraft(file.content);
    setEditMode(false);
  }, [file.id]);

  // Gentle fade/rise when switching documents — reads as a settle, not a flash.
  useEffect(() => {
    if (!containerRef.current) return;
    const ctx = gsap.fromTo(
      containerRef.current,
      { opacity: 0, y: 10 },
      {
        opacity: 1,
        y: 0,
        duration: 0.4,
        ease: "power2.out",
        // Leave no residual transform behind: any transform, even an identity
        // one, turns this element into the containing block for `position:
        // fixed` descendants, which would re-anchor the selection popover to
        // the scroller instead of the viewport.
        clearProps: "transform",
      },
    );
    return () => {
      ctx.kill();
    };
  }, [activeChunk.id, file.id]);

  // Autosave draft to parent
  useEffect(() => {
    if (!editMode) return;
    const t = setTimeout(() => onContentChange(file.id, draft), 400);
    return () => clearTimeout(t);
  }, [draft, editMode, file.id, onContentChange]);

  const scrollToTop = () => {
    if (presentMode && containerRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // Paginated: when a nested ##/### heading inside the page is selected, scroll
  // to its anchor; otherwise (page's own # or a page change) reset to top.
  // (Skipped in single mode, which scrolls within the whole-doc render below.)
  useEffect(() => {
    if (singleMode) return;
    const el =
      activeSubtopicId && activeSubtopicId !== activeChunk.id
        ? document.getElementById(activeSubtopicId)
        : null;
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    else scrollToTop();
  }, [activeChunk.id, activeSubtopicId, file.id, singleMode]);

  // Single-page: switching document scrolls to top; selecting a section from the
  // sidebar scrolls to that heading's anchor within the full document.
  useEffect(() => {
    if (!singleMode) return;
    const el = activeSubtopicId ? document.getElementById(activeSubtopicId) : null;
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    else scrollToTop();
  }, [singleMode, activeSubtopicId, file.id]);

  // Scrollspy, ambient progress, and earned completion. Completion is reported
  // by how far the reader has actually scrolled.
  useEffect(() => {
    const target = presentMode && containerRef.current ? containerRef.current : window;
    const onScroll = () => {
      const scrolled = presentMode && containerRef.current ? containerRef.current.scrollTop : window.scrollY;
      setShowTop(scrolled > 400);
    };
    onScroll();
    target.addEventListener("scroll", onScroll, { passive: true });
    return () => target.removeEventListener("scroll", onScroll);
  }, [file.id, activeChunk.id, editMode, presentMode]);

  // Save shortcut
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s" && editMode) {
        e.preventDefault();
        onContentChange(file.id, draft);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [draft, editMode, file.id, onContentChange]);

  const stats = useMemo(() => {
    const src = singleMode ? file.content : activeChunk.content;
    const words = src.trim().split(/\s+/).filter(Boolean).length;
    const readingMin = Math.max(1, Math.round(words / 220));
    return { words, readingMin };
  }, [singleMode, file.content, activeChunk.content]);

  // Search-query highlighting stays a lightweight React wrap. Persistent
  // highlights are painted via the CSS Custom Highlight API instead (see the
  // effect below) so they survive re-renders and span multiple elements.
  const highlightText = (text: string): any => {
    const q = highlightQuery?.trim();
    if (!q || !text) return text;
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const parts = text.split(new RegExp(`(${escaped})`, "gi"));
    return parts.map((p, i) =>
      p.toLowerCase() === q.toLowerCase() ? (
        <mark key={i} className="rounded bg-primary/25 px-0.5 text-foreground">
          {p}
        </mark>
      ) : (
        <span key={i}>{p}</span>
      ),
    );
  };

  const walkChildren = (children: any): any => {
    // With no active search there is nothing to wrap. Returning children
    // untouched avoids blanketing the document in <span>s — which bloated the
    // DOM and, worse, split it into thousands of extra text nodes that every
    // offset lookup then had to walk.
    if (!highlightQuery?.trim()) return children;
    if (typeof children === "string") return highlightText(children);
    if (Array.isArray(children))
      return children.map((c, i) => <span key={i}>{walkChildren(c)}</span>);
    return children;
  };

  const components = useMemo(
    () => ({
      h1: (p: any) => <HeadingLink as="h1" {...p} highlight={highlightText} />,
      h2: (p: any) => <HeadingLink as="h2" {...p} highlight={highlightText} />,
      h3: (p: any) => <HeadingLink as="h3" {...p} highlight={highlightText} />,
      h4: (p: any) => <HeadingLink as="h4" {...p} highlight={highlightText} />,
      h5: (p: any) => <HeadingLink as="h5" {...p} highlight={highlightText} />,
      h6: (p: any) => <HeadingLink as="h6" {...p} highlight={highlightText} />,
      p: (p: any) => {
        // Rich embed detection: a paragraph that is a single bare autolink.
        // Match on props.href rather than element type — the custom `a`
        // override makes the child's type the component, not the string "a".
        const kids = Array.isArray(p.children) ? p.children : [p.children];
        const solo = kids.filter((c: any) => !(typeof c === "string" && !c.trim()));
        const only = solo.length === 1 ? solo[0] : null;
        const href = only?.props?.href;
        const src = only?.props?.src;
        if (isArtifactUrl(src)) {
          return (
            <InlineArtifact
              reference={artifactReference(src)}
              currentWorkspaceId={workspaceId}
              workspaceRevision={workspaceRevision}
              currentWorkspaceFiles={workspaceFiles}
              currentWorkspaceName={workspaceName}
              onOpenArtifact={onOpenArtifact}
            />
          );
        }
        if (href) {
          const inner = only.props?.children;
          const text =
            typeof inner === "string" ? inner : Array.isArray(inner) ? inner.join("") : "";
          if (text === href || text === "") {
            const embed = detectEmbed(href);
            if (embed) return <EmbedFrame embed={embed} />;
            if (isVideoUrl(href)) return <VideoPlayer src={href} />;
          }
        }
        return <p {...p}>{walkChildren(p.children)}</p>;
      },
      blockquote: (p: any) => <Callout {...p} />,
      pre: (p: any) => <CodeBlock {...p} />,
      img: (p: any) => {
        if (isArtifactUrl(p.src)) {
          return (
            <InlineArtifact
              reference={artifactReference(p.src)}
              currentWorkspaceId={workspaceId}
              workspaceRevision={workspaceRevision}
              currentWorkspaceFiles={workspaceFiles}
              currentWorkspaceName={workspaceName}
              onOpenArtifact={onOpenArtifact}
            />
          );
        }
        // ![alt](clip.mp4) renders a player; a `title` that is an image URL
        // (![alt](clip.mp4 "thumb.jpg")) becomes the preview poster.
        if (p.src && isVideoUrl(p.src)) {
          const poster =
            typeof p.title === "string" && /\.(png|jpe?g|webp|gif|avif)(\?.*)?$/i.test(p.title)
              ? p.title
              : undefined;
          return <VideoPlayer src={p.src} poster={poster} />;
        }
        return (
          <img
            {...p}
            loading="lazy"
            onClick={() => setLightbox({ src: p.src, alt: p.alt })}
            className="cursor-zoom-in"
          />
        );
      },
      a: (p: any) => (
        <a {...p} target={p.href?.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
          {walkChildren(p.children)}
        </a>
      ),
      li: (p: any) => <li {...p}>{walkChildren(p.children)}</li>,
      table: (p: any) => (
        <div className="docs-table-wrap">
          <table {...p} />
        </div>
      ),
      td: (p: any) => <td {...p}>{walkChildren(p.children)}</td>,
      th: (p: any) => <th {...p}>{walkChildren(p.children)}</th>,
    }),
    // `highlights` is deliberately absent: nothing here reads it, and including
    // it rebuilt every renderer on each highlight change, re-rendering the whole
    // markdown tree (the entire document, in single-page mode).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      highlightQuery,
      workspaceId,
      workspaceRevision,
      workspaceFiles,
      workspaceName,
      onOpenArtifact,
    ],
  );

  return (
    <div className="flex h-full flex-col bg-background">
      {!presentMode && (
        <ViewerHeader
          nav={{
            onPrev: () =>
              singleMode
                ? prevFile && onNav(prevFile.id, null)
                : prevChunk && onNav(file.id, prevChunk.id),
            onNext: () =>
              singleMode
                ? nextFile && onNav(nextFile.id, null)
                : nextChunk && onNav(file.id, nextChunk.id),
            prevDisabled: singleMode ? !prevFile : !prevChunk,
            nextDisabled: singleMode ? !nextFile : !nextChunk,
            prevLabel: singleMode ? "Previous file" : "Previous section",
            nextLabel: singleMode ? "Next file" : "Next section",
          }}
          center={
            singleMode || allChunks.length <= 1 ? (
              <HeaderTitle icon={<BookOpen className="h-4 w-4" />} title={stripExt(file.name)} />
            ) : (
              <Select value={activeChunk.id} onValueChange={(val) => onNav(file.id, val)}>
                <SelectTrigger className="w-fit h-9 flex items-center gap-2 rounded-lg border border-border bg-transparent px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent/50 focus:ring-0 shadow-none">
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate max-w-40 sm:max-w-xs text-left">
                    {stripExt(file.name)}
                  </span>
                </SelectTrigger>
                <SelectContent className="max-w-[90vw] sm:max-w-md w-full">
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider sticky top-0 bg-popover z-10 border-b border-border/50 mb-1">
                    Sections
                  </div>
                  <div className="max-h-[40vh] overflow-y-auto pr-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] scrollbar-none">
                    {allChunks.map((chunk) => {
                      const words = chunk.content.trim().split(/\s+/).filter(Boolean).length;
                      const readingMin = Math.max(1, Math.round(words / 220));
                      return (
                        <SelectItem
                          key={chunk.id}
                          value={chunk.id}
                          className="cursor-pointer pl-2 pr-2 [&>span.absolute]:hidden"
                        >
                          <div className="flex w-full items-center justify-between gap-4">
                            <span className="truncate">
                              {chunk.title.length > 20
                                ? chunk.title.substring(0, 20) + "..."
                                : chunk.title}
                            </span>
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {readingMin} min
                            </span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </div>
                </SelectContent>
              </Select>
            )
          }
          actions={
            <>
              <button
                type="button"
                onClick={onToggleBookmark}
                aria-label={isBookmarked ? "Unstar" : "Star"}
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Star className={`h-4 w-4 ${isBookmarked ? "fill-gold text-gold" : ""}`} />
              </button>
              {!editMode && onToggleReadingMode && (
                <button
                  onClick={onToggleReadingMode}
                  title={
                    singleMode
                      ? "Paged: read one section at a time"
                      : "Single page: read the whole document"
                  }
                  className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <Files className="h-4 w-4" />
                </button>
              )}
              {!editMode && (
                <button
                  onClick={togglePresentation}
                  title="Present Mode (Fullscreen & Spotlight)"
                  className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <Presentation className="h-4 w-4" />
                </button>
              )}
              {!editMode && (
                <button
                  onClick={() => setEditMode(true)}
                  title="Edit document"
                  className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              )}
            </>
          }
        />
      )}
      <div ref={containerRef} className="relative flex-1 overflow-y-auto transition-colors duration-500">
      <Spotlight active={presentMode} />
      {presentMode && (
        <div className="fixed top-4 left-4 z-50 flex items-center gap-1 rounded-full border border-border/20 bg-background/30 p-1 backdrop-blur-md opacity-30 hover:opacity-100 transition-opacity">
          <button
            onClick={() => singleMode ? prevFile && onNav(prevFile.id, null) : prevChunk && onNav(file.id, prevChunk.id)}
            disabled={singleMode ? !prevFile : !prevChunk}
            className="flex h-8 w-8 items-center justify-center rounded-full text-foreground hover:bg-accent disabled:opacity-50 disabled:pointer-events-none"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={() => singleMode ? nextFile && onNav(nextFile.id, null) : nextChunk && onNav(file.id, nextChunk.id)}
            disabled={singleMode ? !nextFile : !nextChunk}
            className="flex h-8 w-8 items-center justify-center rounded-full text-foreground hover:bg-accent disabled:opacity-50 disabled:pointer-events-none"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      )}

      {menu &&
        !editMode &&
        // Portalled to <body> on purpose. The popover is positioned in viewport
        // coordinates, and any transformed ancestor (the GSAP entrance tween,
        // a backdrop-filter, a `will-change`) would silently become its
        // containing block and throw those coordinates off by the scroller's
        // height — which is what hid it entirely in single-page mode.
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-(--z-dropdown) w-64 -translate-x-1/2 rounded-lg border border-border bg-popover p-2 shadow-xl"
            style={{
              top: Math.min(Math.max(56, menu.y - 12), window.innerHeight - 24),
              left: Math.min(Math.max(132, menu.x), window.innerWidth - 132),
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {menu.mode === "create" ? "Highlight" : "Edit highlight"}
            </span>
            <button
              onClick={() => setMenu(null)}
              className="rounded p-0.5 text-muted-foreground hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {menu.mode === "create" && onAskAi && (
            <div className="mb-2 border-b border-border pb-2">
              <div className="mb-1.5 flex items-center gap-1 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Sparkles className="h-3 w-3" /> Ask AI
              </div>
              <div className="flex flex-wrap gap-1 px-1">
                {[
                  { label: "Ask AI", action: undefined },
                  { label: "Summarize", action: "summary" },
                  { label: "Explain", action: "explain" },
                  { label: "Notes", action: "notes" },
                  { label: "Mermaid", action: "mermaid" },
                  { label: "Rewrite", action: "rewrite" },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={() => {
                      onAskAi({ selection: menu.text, actionId: item.action });
                      window.getSelection()?.removeAllRanges();
                      setMenu(null);
                    }}
                    className="rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mb-2 flex items-center gap-1.5 px-1">
            {HL_COLORS.map((color) => {
              const active = menu.mode === "edit" && menu.hl.color === color;
              return (
                <button
                  key={color}
                  aria-label={`Highlight ${color}`}
                  className={`h-6 w-6 rounded-full transition-transform hover:scale-110 ${
                    active
                      ? "ring-2 ring-foreground ring-offset-1 ring-offset-popover"
                      : "border border-border/60"
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={() => {
                    if (menu.mode === "create") {
                      onAddHighlight({
                        text: menu.text,
                        color,
                        label: menu.label.trim() || undefined,
                        subtopicId: singleMode ? undefined : activeChunk.id,
                        start: menu.start,
                        end: menu.end,
                      });
                      window.getSelection()?.removeAllRanges();
                    } else {
                      onUpdateHighlight(menu.hl.id, { color });
                    }
                    setMenu(null);
                  }}
                />
              );
            })}
          </div>

          <div className="mb-2 flex items-center gap-1.5 rounded-md border border-border bg-background px-2">
            <Tag className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              value={menu.label}
              onChange={(e) => setMenu((m) => (m ? { ...m, label: e.target.value } : m))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (menu.mode === "create") {
                    onAddHighlight({
                      text: menu.text,
                      color: HL_COLORS[0],
                      label: menu.label.trim() || undefined,
                      subtopicId: singleMode ? undefined : activeChunk.id,
                      start: menu.start,
                      end: menu.end,
                    });
                    window.getSelection()?.removeAllRanges();
                  } else {
                    onUpdateHighlight(menu.hl.id, { label: menu.label.trim() || undefined });
                  }
                  setMenu(null);
                }
              }}
              placeholder="Add a label (optional)"
              className="w-full bg-transparent py-1.5 text-xs outline-none placeholder:text-muted-foreground"
            />
          </div>

          <button
            onClick={() => inspect(menu.mode === "create" ? menu.text : menu.hl.text)}
            title="Open the editor with this text selected"
            className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-border px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            <Crosshair className="h-3.5 w-3.5" /> Inspect in source
          </button>

          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                navigator.clipboard.writeText(menu.mode === "create" ? menu.text : menu.hl.text);
                setMenu(null);
              }}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <Copy className="h-3.5 w-3.5" /> Copy
            </button>
            {menu.mode === "edit" && (
              <button
                onClick={() => {
                  onRemoveHighlight(menu.hl.id);
                  setMenu(null);
                }}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" /> Remove
              </button>
            )}
            {menu.mode === "create" && (
              <button
                onClick={() => {
                  onAddHighlight({
                    text: menu.text,
                    color: HL_COLORS[0],
                    label: menu.label.trim() || undefined,
                    subtopicId: singleMode ? undefined : activeChunk.id,
                    start: menu.start,
                    end: menu.end,
                  });
                  window.getSelection()?.removeAllRanges();
                  setMenu(null);
                }}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-foreground px-2 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-90"
              >
                Highlight
              </button>
            )}
          </div>
          </div>,
          document.body,
        )}

      {lightbox && <Lightbox {...lightbox} onClose={() => setLightbox(null)} />}

      <div className={`mx-auto flex w-full max-w-4xl gap-8 px-6 py-10 md:px-10 md:py-16`}>
        <article
          onMouseUp={() => openCreateMenu()}
          onContextMenu={onContextMenu}
          className="docs-prose mx-auto min-w-0 flex-1"
        >
          {!singleMode && (
            <div className="mb-8">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl wrap-break-word mb-1">
                    {activeChunk.title}
                  </h1>
                  <span className="mt-0.5 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" /> ≈ {stats.readingMin} min read
                  </span>
                </div>
              </div>
            </div>
          )}

          {editMode ? (
            <div>
              {/* Sticky exit bar: leaving edit mode stays reachable no matter how
                  far the reader scrolls. Single-pane editor keeps typing smooth —
                  no live full-document re-render on every keystroke. */}
              <div className="sticky top-16 z-(--z-sticky) -mx-1 mb-4 flex items-center justify-between gap-3 rounded-lg border border-border bg-background/90 px-3 py-2 backdrop-blur">
                <span className="truncate text-xs font-medium text-muted-foreground">
                  Editing — changes save automatically
                </span>
                <button
                  onClick={() => setEditMode(false)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-90 active:scale-95"
                >
                  <Eye className="h-3.5 w-3.5" /> Done · Preview
                </button>
              </div>
              {inspectMissed && (
                <div className="mb-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-foreground">
                  Couldn't pin that text to a spot in the source — the editor is open at the start
                  of this section instead.
                </div>
              )}
              <textarea
                ref={editorRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                spellCheck={false}
                className="min-h-[70vh] w-full resize-y rounded-lg border border-border bg-muted/30 p-4 font-mono text-sm leading-relaxed outline-none focus:border-primary/50"
              />
            </div>
          ) : (
            <div
              key={singleMode ? "full" : activeChunk.id}
              ref={contentRef}
              onClick={onContentClick}
              className={presentMode ? "animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-forwards" : ""}
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath, remarkInteractiveBlockMeta]}
                rehypePlugins={[
                  rehypeSlug,
                  rehypeKatex,
                  [rehypeHighlight, { detect: true, ignoreMissing: true }],
                ]}
                components={components}
              >
                {singleMode ? fullRender : renderContent}
              </ReactMarkdown>
            </div>
          )}

          {/* Natural stopping point — quiet acknowledgement, clear next step.
              Only in paginated mode; single page shows the whole document. */}
          {!editMode && !singleMode && (
            <div className="mt-20 border-t border-border pt-10">
              <div className="flex flex-col items-center gap-6">
                <div className="w-full max-w-xl">
                  {nextChunk ? (
                    <button
                      onClick={() => onNav(file.id, nextChunk.id)}
                      className="group flex w-full min-w-0 items-center justify-between gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-6 text-left shadow-sm transition-all hover:border-primary/50 hover:shadow-md"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-bold uppercase tracking-wider text-primary/80">
                          Next
                        </span>
                        <span className="mt-1.5 block truncate text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                          {nextChunk.title}
                        </span>
                      </span>
                      <ArrowRight className="h-6 w-6 shrink-0 text-primary/70 transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                    </button>
                  ) : nextFile ? (
                    <button
                      onClick={() => onNav(nextFile.id, null)}
                      className="group flex w-full min-w-0 items-center justify-between gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-6 text-left shadow-sm transition-all hover:border-primary/50 hover:shadow-md"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-bold uppercase tracking-wider text-primary/80">
                          Next Chapter
                        </span>
                        <span className="mt-1.5 block truncate text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                          {stripExt(nextFile.name)}
                        </span>
                        {nextReadingMin != null && (
                          <span className="mt-1 block text-xs font-medium text-muted-foreground">
                            ≈ {nextReadingMin} min read
                          </span>
                        )}
                      </span>
                      <ArrowRight className="h-6 w-6 shrink-0 text-primary/70 transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                    </button>
                  ) : (
                    <div className="flex items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                      You've reached the end.
                    </div>
                  )}
                </div>

                {(prevChunk || prevFile) && (
                  <button
                    onClick={() =>
                      prevChunk
                        ? onNav(file.id, prevChunk.id)
                        : prevFile && onNav(prevFile.id, null)
                    }
                    className="group flex max-w-full items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <ArrowLeft className="h-4 w-4 shrink-0 transition-transform group-hover:-translate-x-1" />
                    <span className="truncate">
                      {prevChunk
                        ? `Previous: ${prevChunk.title}`
                        : `Previous Chapter: ${prevFile ? stripExt(prevFile.name) : ""}`}
                    </span>
                  </button>
                )}
              </div>
            </div>
          )}
        </article>
      </div>

      {showTop && (
        <button
          onClick={scrollToTop}
          aria-label="Back to top"
          className="fixed bottom-6 right-6 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background/80 shadow-lg backdrop-blur transition-all hover:bg-accent active:scale-90"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      )}
      </div>
    </div>
  );
}

function HeadingLink({ as: Tag, children, id, highlight, ...rest }: any) {
  const [copied, setCopied] = useState(false);
  const text = Array.isArray(children)
    ? children.map((c) => (typeof c === "string" ? c : "")).join("")
    : String(children ?? "");
  const finalId = id || slugify(text);
  return (
    <Tag id={finalId} {...rest} className="group scroll-mt-24">
      {typeof children === "string" ? (highlight?.(children) ?? children) : children}
      <button
        onClick={() => {
          const url = `${window.location.origin}${window.location.pathname}#${finalId}`;
          navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="ml-2 inline-flex items-center align-middle opacity-0 transition-opacity group-hover:opacity-100"
        aria-label="Copy link to heading"
      >
        {copied ? (
          <Check className="h-4 w-4 text-primary" />
        ) : (
          <Link2 className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
    </Tag>
  );
}

function CodeBlock({ children, ...rest }: any) {
  const ref = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);

  // Detect Mermaid
  const codeEl: any = Array.isArray(children) ? children[0] : children;
  const cls = codeEl?.props?.className ?? "";
  if (typeof cls === "string" && /language-mermaid/.test(cls)) {
    const raw = extractText(codeEl?.props?.children);
    return <Mermaid code={raw} />;
  }

  const encodedLang = /language-([\w+-]+)/.exec(cls)?.[1];
  const [lang, encodedMeta] = encodedLang?.split("--") ?? [];
  const meta =
    codeEl?.props?.node?.data?.meta ??
    codeEl?.props?.node?.meta ??
    encodedMeta?.replaceAll("-", " ") ??
    "";

  if (lang === "interactive-html" || lang === "interactive-react") {
    return (
      <InteractiveBlock
        kind={lang === "interactive-html" ? "html" : "react"}
        code={extractText(codeEl?.props?.children)}
        meta={meta}
      />
    );
  }

  return (
    <div className="group relative my-6">
      {/* {lang && (
        <div className="absolute left-3 top-2 z-10 rounded bg-background/60 px-1.5 py-0.5 text-xs font-mono uppercase tracking-wider text-muted-foreground backdrop-blur">
          {lang}
        </div>
      )} */}
      <button
        onClick={() => {
          const code = ref.current?.innerText ?? "";
          navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-md border border-border/50 bg-background/80 px-2 py-1 text-xs text-muted-foreground opacity-0 backdrop-blur transition-opacity hover:text-foreground group-hover:opacity-100"
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        {copied ? "Copied" : "Copy"}
      </button>
      <pre ref={ref} {...rest}>
        {children}
      </pre>
    </div>
  );
}

function extractText(node: any): string {
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (node?.props?.children) return extractText(node.props.children);
  return "";
}

// react-markdown exposes the code language to component overrides but not the
// fenced-code info string. Keep the interactive flags in the language token so
// `interactive-react preview`, `split`, and `playground` all survive parsing.
function remarkInteractiveBlockMeta() {
  return (tree: any) => {
    const walk = (node: any) => {
      if (node?.type === "code" && /^(interactive-html|interactive-react)$/.test(node.lang ?? "")) {
        const flags = String(node.meta ?? "")
          .toLowerCase()
          .split(/\s+/)
          .map((flag) => flag.replace(/[^a-z0-9]/g, ""))
          .filter(Boolean)
          .join("-");
        if (flags) node.lang = `${node.lang}--${flags}`;
      }
      node?.children?.forEach(walk);
    };
    walk(tree);
  };
}

const CALLOUT_MAP: Record<string, { icon: any; label: string; cls: string }> = {
  NOTE: {
    icon: StickyNote,
    label: "Note",
    cls: "border-sky-500/40 bg-sky-500/5 text-sky-700 dark:text-sky-300",
  },
  INFO: {
    icon: Info,
    label: "Info",
    cls: "border-sky-500/40 bg-sky-500/5 text-sky-700 dark:text-sky-300",
  },
  TIP: {
    icon: Lightbulb,
    label: "Tip",
    cls: "border-emerald-500/40 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300",
  },
  WARNING: {
    icon: AlertTriangle,
    label: "Warning",
    cls: "border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-300",
  },
  CAUTION: {
    icon: AlertTriangle,
    label: "Caution",
    cls: "border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-300",
  },
  DANGER: {
    icon: AlertOctagon,
    label: "Danger",
    cls: "border-rose-500/40 bg-rose-500/5 text-rose-700 dark:text-rose-300",
  },
  IMPORTANT: {
    icon: AlertOctagon,
    label: "Important",
    cls: "border-violet-500/40 bg-violet-500/5 text-violet-700 dark:text-violet-300",
  },
};

function Callout({ children, ...rest }: any) {
  // Detect leading [!TYPE] token in first paragraph
  const kids = Array.isArray(children) ? [...children] : [children];
  let type: string | null = null;

  for (let i = 0; i < kids.length; i++) {
    const c = kids[i];
    if (c?.type === "p" || c?.props) {
      const inner = c.props?.children;
      const text = extractText(inner);
      const m = /^\s*\[!(NOTE|INFO|TIP|WARNING|CAUTION|DANGER|IMPORTANT)\]\s*(.*)/is.exec(text);
      if (m) {
        type = m[1].toUpperCase();
        // Strip token: build a new child with remainder
        const remainder = m[2];
        kids[i] = remainder ? { ...c, props: { ...c.props, children: remainder } } : null;
        break;
      }
    }
    break;
  }

  if (!type) {
    return <blockquote {...rest}>{children}</blockquote>;
  }

  const cfg = CALLOUT_MAP[type];
  const Icon = cfg.icon;
  return (
    <div className={`my-5 rounded-lg border-l-4 border p-4 ${cfg.cls}`}>
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider">
        <Icon className="h-3.5 w-3.5" />
        {cfg.label}
      </div>
      <div className="[&>p:last-child]:mb-0 [&>p]:mb-2 text-foreground/90">
        {kids.filter(Boolean)}
      </div>
    </div>
  );
}
