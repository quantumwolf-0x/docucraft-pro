import { useEffect, useMemo, useRef, useState } from "react";
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
  Clock,
  ListTree,
  Pencil,
  Eye,
  Info,
  AlertTriangle,
  Lightbulb,
  AlertOctagon,
  StickyNote,
} from "lucide-react";
import type { MdFile, MdHeading } from "@/lib/markdown-utils";
import { slugify, flattenHeadings } from "@/lib/markdown-utils";
import { Mermaid } from "./Mermaid";
import { detectEmbed, EmbedFrame } from "@/lib/media-embeds";
import { Lightbox } from "./Lightbox";

interface Props {
  file: MdFile;
  prevFile: MdFile | null;
  nextFile: MdFile | null;
  onNavFile: (id: string) => void;
  onActiveHeading: (id: string | null) => void;
  scrollTargetId: string | null;
  highlightQuery: string | null;
  onContentChange: (fileId: string, content: string) => void;
  focusMode: boolean;
}

export function MarkdownViewer({
  file,
  prevFile,
  nextFile,
  onNavFile,
  onActiveHeading,
  scrollTargetId,
  highlightQuery,
  onContentChange,
  focusMode,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [showTop, setShowTop] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState(file.content);
  const [lightbox, setLightbox] = useState<{ src: string; alt?: string } | null>(null);

  useEffect(() => {
    setDraft(file.content);
    setEditMode(false);
  }, [file.id]);

  // Autosave draft to parent
  useEffect(() => {
    if (!editMode) return;
    const t = setTimeout(() => onContentChange(file.id, draft), 400);
    return () => clearTimeout(t);
  }, [draft, editMode, file.id, onContentChange]);

  // Scroll to target
  useEffect(() => {
    if (!scrollTargetId) return;
    const el = document.getElementById(scrollTargetId);
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top: y, behavior: "smooth" });
      el.classList.add("docs-flash");
      setTimeout(() => el.classList.remove("docs-flash"), 1600);
    }
  }, [scrollTargetId, file.id]);

  useEffect(() => {
    if (!scrollTargetId) window.scrollTo({ top: 0 });
  }, [file.id, scrollTargetId]);

  // Scrollspy + progress
  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const scrolled = window.scrollY;
      const max = doc.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? (scrolled / max) * 100 : 0);
      setShowTop(scrolled > 400);

      const headings = containerRef.current?.querySelectorAll<HTMLElement>(
        "h1, h2, h3, h4, h5, h6",
      );
      if (!headings) return;
      let current: string | null = null;
      for (const h of Array.from(headings)) {
        if (h.getBoundingClientRect().top < 120) current = h.id;
        else break;
      }
      onActiveHeading(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [file.id, onActiveHeading, editMode]);

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
    const words = file.content.trim().split(/\s+/).filter(Boolean).length;
    const readingMin = Math.max(1, Math.round(words / 220));
    return { words, readingMin };
  }, [file.content]);

  const highlightRegex = useMemo(() => {
    if (!highlightQuery) return null;
    const escaped = highlightQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(${escaped})`, "gi");
  }, [highlightQuery]);

  const highlightText = (text: string) => {
    if (!highlightRegex) return text;
    const parts = text.split(highlightRegex);
    return parts.map((p, i) =>
      highlightRegex.test(p) ? (
        <mark key={i} className="rounded bg-primary/25 px-0.5 text-foreground">
          {p}
        </mark>
      ) : (
        <span key={i}>{p}</span>
      ),
    );
  };

  const walkChildren = (children: any): any => {
    if (typeof children === "string") return highlightText(children);
    if (Array.isArray(children)) return children.map((c, i) => <span key={i}>{walkChildren(c)}</span>);
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
        // Rich embed detection: paragraph containing a single autolink
        const kids = Array.isArray(p.children) ? p.children : [p.children];
        const solo = kids.filter((c: any) => !(typeof c === "string" && !c.trim()));
        if (solo.length === 1 && solo[0]?.type === "a") {
          const href = solo[0].props?.href;
          const inner = solo[0].props?.children;
          const text = typeof inner === "string" ? inner : Array.isArray(inner) ? inner.join("") : "";
          if (href && (text === href || text === "")) {
            const embed = detectEmbed(href);
            if (embed) return <EmbedFrame embed={embed} />;
          }
        }
        return <p {...p}>{walkChildren(p.children)}</p>;
      },
      blockquote: (p: any) => <Callout {...p} />,
      pre: (p: any) => <CodeBlock {...p} />,
      img: (p: any) => (
        <img
          {...p}
          loading="lazy"
          onClick={() => setLightbox({ src: p.src, alt: p.alt })}
          className="cursor-zoom-in"
        />
      ),
      a: (p: any) => (
        <a {...p} target={p.href?.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
          {walkChildren(p.children)}
        </a>
      ),
      li: (p: any) => <li {...p}>{walkChildren(p.children)}</li>,
      td: (p: any) => <td {...p}>{walkChildren(p.children)}</td>,
      th: (p: any) => <th {...p}>{walkChildren(p.children)}</th>,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [highlightRegex],
  );

  const flatHeadings = flattenHeadings(file.headings);

  return (
    <>
      <div
        className="fixed left-0 right-0 top-16 z-40 h-0.5 bg-primary/80 transition-transform origin-left"
        style={{ transform: `scaleX(${progress / 100})` }}
      />

      {lightbox && <Lightbox {...lightbox} onClose={() => setLightbox(null)} />}

      <div className={`mx-auto flex w-full ${focusMode ? "max-w-3xl" : "max-w-6xl"} gap-8 px-6 py-10 md:px-10 md:py-16`}>
        <article
          ref={containerRef}
          className={`docs-prose min-w-0 flex-1 ${focusMode ? "mx-auto max-w-3xl" : ""}`}
        >
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {file.name}
              </div>
              <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {stats.readingMin} min read
                </span>
                <span>·</span>
                <span>{stats.words.toLocaleString()} words</span>
              </div>
            </div>
            <button
              onClick={() => setEditMode((e) => !e)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              {editMode ? (
                <>
                  <Eye className="h-3.5 w-3.5" /> Preview
                </>
              ) : (
                <>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </>
              )}
            </button>
          </div>

          {editMode ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                spellCheck={false}
                className="min-h-[70vh] w-full resize-y rounded-lg border border-border bg-muted/30 p-4 font-mono text-[13px] leading-relaxed outline-none focus:border-primary/50"
              />
              <div className="rounded-lg border border-border bg-background p-6">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[
                    rehypeSlug,
                    rehypeKatex,
                    [rehypeHighlight, { detect: true, ignoreMissing: true }],
                  ]}
                  components={components}
                >
                  {draft}
                </ReactMarkdown>
              </div>
            </div>
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[
                rehypeSlug,
                rehypeKatex,
                [rehypeHighlight, { detect: true, ignoreMissing: true }],
              ]}
              components={components}
            >
              {file.content}
            </ReactMarkdown>
          )}

          {!editMode && (
            <nav className="mt-16 grid grid-cols-1 gap-3 border-t border-border pt-8 sm:grid-cols-2">
              {prevFile ? (
                <button
                  onClick={() => onNavFile(prevFile.id)}
                  className="group flex flex-col items-start gap-1 rounded-lg border border-border p-4 text-left transition-colors hover:border-primary/50 hover:bg-accent/50"
                >
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <ArrowLeft className="h-3 w-3" /> Previous
                  </span>
                  <span className="text-sm font-medium text-foreground">{prevFile.name}</span>
                </button>
              ) : (
                <div />
              )}
              {nextFile ? (
                <button
                  onClick={() => onNavFile(nextFile.id)}
                  className="group flex flex-col items-end gap-1 rounded-lg border border-border p-4 text-right transition-colors hover:border-primary/50 hover:bg-accent/50 sm:col-start-2"
                >
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    Next <ArrowRight className="h-3 w-3" />
                  </span>
                  <span className="text-sm font-medium text-foreground">{nextFile.name}</span>
                </button>
              ) : null}
            </nav>
          )}
        </article>

        {/* Right side ToC */}
        {!focusMode && !editMode && flatHeadings.length > 2 && (
          <aside className="sticky top-24 hidden h-[calc(100dvh-8rem)] w-56 shrink-0 overflow-y-auto text-sm xl:block">
            <div className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <ListTree className="h-3 w-3" /> On this page
            </div>
            <ul className="space-y-1">
              {flatHeadings.map((h) => (
                <TocLink key={h.id} h={h} />
              ))}
            </ul>
          </aside>
        )}
      </div>

      {showTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Back to top"
          className="fixed bottom-6 right-6 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background/80 shadow-lg backdrop-blur transition-all hover:bg-accent"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      )}
    </>
  );
}

function TocLink({ h }: { h: MdHeading }) {
  return (
    <li>
      <a
        href={`#${h.id}`}
        onClick={(e) => {
          e.preventDefault();
          const el = document.getElementById(h.id);
          if (el) {
            const y = el.getBoundingClientRect().top + window.scrollY - 80;
            window.scrollTo({ top: y, behavior: "smooth" });
            history.replaceState(null, "", `#${h.id}`);
          }
        }}
        className="block truncate text-muted-foreground transition-colors hover:text-foreground"
        style={{ paddingLeft: `${(h.level - 1) * 10}px`, fontSize: h.level > 2 ? 12 : 13 }}
      >
        {h.text}
      </a>
    </li>
  );
}

function HeadingLink({
  as: Tag,
  children,
  id,
  highlight,
  ...rest
}: any) {
  const [copied, setCopied] = useState(false);
  const text = Array.isArray(children)
    ? children.map((c) => (typeof c === "string" ? c : "")).join("")
    : String(children ?? "");
  const finalId = id || slugify(text);
  return (
    <Tag id={finalId} {...rest} className="group scroll-mt-24">
      {typeof children === "string" ? highlight?.(children) ?? children : children}
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

  const lang = /language-([\w+-]+)/.exec(cls)?.[1];

  return (
    <div className="group relative my-6">
      {lang && (
        <div className="absolute left-3 top-2 z-10 rounded bg-background/60 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground backdrop-blur">
          {lang}
        </div>
      )}
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

const CALLOUT_MAP: Record<string, { icon: any; label: string; cls: string }> = {
  NOTE: { icon: StickyNote, label: "Note", cls: "border-sky-500/40 bg-sky-500/5 text-sky-700 dark:text-sky-300" },
  INFO: { icon: Info, label: "Info", cls: "border-sky-500/40 bg-sky-500/5 text-sky-700 dark:text-sky-300" },
  TIP: { icon: Lightbulb, label: "Tip", cls: "border-emerald-500/40 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300" },
  WARNING: { icon: AlertTriangle, label: "Warning", cls: "border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-300" },
  CAUTION: { icon: AlertTriangle, label: "Caution", cls: "border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-300" },
  DANGER: { icon: AlertOctagon, label: "Danger", cls: "border-rose-500/40 bg-rose-500/5 text-rose-700 dark:text-rose-300" },
  IMPORTANT: { icon: AlertOctagon, label: "Important", cls: "border-violet-500/40 bg-violet-500/5 text-violet-700 dark:text-violet-300" },
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
