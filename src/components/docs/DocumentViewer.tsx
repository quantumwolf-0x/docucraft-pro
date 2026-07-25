import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Filter,
  Maximize,
  Minimize,
  Presentation,
  Search,
  Star,
  Trash2,
  ZoomIn,
  ZoomOut,
  RotateCw,
  RefreshCw,
} from "lucide-react";
import type { MdFile } from "@/lib/markdown-utils";
import {
  dataUrlToArrayBuffer,
  dataUrlToBlob,
  fileLabel,
  getDocumentKind,
  googleUrl,
} from "@/lib/document-utils";
import { ViewerHeader, HeaderTitle, type ViewerNav } from "./ViewerHeader";

interface Props {
  file: MdFile;
  isBookmarked?: boolean;
  onToggleBookmark?: () => void;
  onRemoveFile?: () => void;
  /** Sibling files, so the shared header's prev/next can move between files. */
  prevFile?: MdFile | null;
  nextFile?: MdFile | null;
  onNavFile?: (fileId: string) => void;
  /** Rendered inside markdown content: strip all chrome, show only the content. */
  embedded?: boolean;
}
interface GoogleProps extends Props {
  isSlides: boolean;
}

/** File-level prev/next for the shared header — used by every non-deck viewer. */
function useFileNav({
  prevFile,
  nextFile,
  onNavFile,
}: Pick<Props, "prevFile" | "nextFile" | "onNavFile">): ViewerNav {
  return {
    onPrev: () => prevFile && onNavFile?.(prevFile.id),
    onNext: () => nextFile && onNavFile?.(nextFile.id),
    prevDisabled: !prevFile || !onNavFile,
    nextDisabled: !nextFile || !onNavFile,
    prevLabel: "Previous file",
    nextLabel: "Next file",
  };
}

export function DocumentViewer(props: Props) {
  const { file } = props;
  const kind = file.kind ?? getDocumentKind(file.name, file.mimeType);
  if (kind === "pdf") return <PdfViewer {...props} />;
  if (kind === "docx") return <DocxViewer {...props} />;
  if (kind === "spreadsheet" || kind === "csv") return <SpreadsheetViewer {...props} />;
  if (kind === "json") return <JsonViewer {...props} />;
  if (kind === "presentation") return <PresentationViewer {...props} />;
  if (kind === "image") return <ImageViewer {...props} />;
  if (kind === "google-doc" || kind === "google-slide")
    return <GoogleViewer {...props} isSlides={kind === "google-slide"} />;
  return <UnknownViewer {...props} />;
}

function ViewerFrame({
  file,
  children,
  action,
  icon,
  isBookmarked,
  onToggleBookmark,
  prevFile,
  nextFile,
  onNavFile,
}: {
  file: MdFile;
  children: React.ReactNode;
  action?: React.ReactNode;
  /** File-type glyph shown in the header chip; defaults to a generic document. */
  icon?: React.ReactNode;
  isBookmarked?: boolean;
  onToggleBookmark?: () => void;
} & Pick<Props, "prevFile" | "nextFile" | "onNavFile">) {
  const nav = useFileNav({ prevFile, nextFile, onNavFile });
  return (
    <section className="min-h-[calc(100dvh-4rem)] bg-background">
      <ViewerHeader
        nav={nav}
        center={<HeaderTitle icon={icon ?? <FileText className="h-4 w-4" />} title={file.name} />}
        actions={
          <>
            {onToggleBookmark && (
              <button
                type="button"
                onClick={onToggleBookmark}
                title={isBookmarked ? "Unstar" : "Star"}
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <Star className={`h-4 w-4 ${isBookmarked ? "fill-gold text-gold" : ""}`} />
              </button>
            )}
            {action}
          </>
        }
      />
      {children}
    </section>
  );
}

function PdfViewer({ file, isBookmarked, onToggleBookmark, prevFile, nextFile, onNavFile }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const blob = dataUrlToBlob(file.data, "application/pdf");
    if (!blob) return;
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file.data]);
  return (
    <ViewerFrame
      file={file}
      isBookmarked={isBookmarked}
      onToggleBookmark={onToggleBookmark}
      prevFile={prevFile}
      nextFile={nextFile}
      onNavFile={onNavFile}
    >
      {url ? (
        <iframe
          title={`Preview ${file.name}`}
          src={url}
          className="h-[calc(100dvh-7.5rem)] w-full bg-muted"
        />
      ) : (
        <Loading label="Preparing PDF preview" />
      )}
    </ViewerFrame>
  );
}

function DocxViewer({
  file,
  isBookmarked,
  onToggleBookmark,
  prevFile,
  nextFile,
  onNavFile,
}: Props) {
  const [html, setHtml] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    const buffer = dataUrlToArrayBuffer(file.data);
    if (!buffer) {
      setError("This Word file is missing its document data.");
      return;
    }
    void (async () => {
      try {
        const module = (await import("mammoth/mammoth.browser")) as unknown as {
          default?: MammothBrowser;
        } & MammothBrowser;
        const mammoth = module.default ?? module;
        const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
        if (alive) setHtml(result.value);
      } catch {
        if (alive) setError("This Word document could not be read in the browser.");
      }
    })();
    return () => {
      alive = false;
    };
  }, [file.data]);
  return (
    <ViewerFrame
      file={file}
      isBookmarked={isBookmarked}
      onToggleBookmark={onToggleBookmark}
      prevFile={prevFile}
      nextFile={nextFile}
      onNavFile={onNavFile}
    >
      {error ? (
        <ErrorState message={error} />
      ) : !html ? (
        <Loading label="Formatting Word document" />
      ) : (
        <article
          className="docx-prose mx-auto max-w-4xl px-5 py-10 md:px-10"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
    </ViewerFrame>
  );
}

interface MammothBrowser {
  convertToHtml(input: { arrayBuffer: ArrayBuffer }): Promise<{ value: string }>;
}

type SheetData = { name: string; rows: string[][] };
function SpreadsheetViewer({
  file,
  isBookmarked,
  onToggleBookmark,
  prevFile,
  nextFile,
  onNavFile,
}: Props) {
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [active, setActive] = useState(0);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ column: number; direction: 1 | -1 } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    try {
      const kind = file.kind ?? getDocumentKind(file.name, file.mimeType);
      const workbook =
        kind === "csv"
          ? XLSX.read(file.content, { type: "string" })
          : XLSX.read(dataUrlToArrayBuffer(file.data), { type: "array" });
      const next = workbook.SheetNames.map((name) => ({
        name,
        rows: (
          XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, defval: "" }) as unknown[][]
        ).map((row) => row.map((value) => String(value ?? ""))),
      }));
      setSheets(next);
      setActive(0);
      setError("");
    } catch {
      setError("This spreadsheet could not be read.");
    }
  }, [file.content, file.data, file.kind, file.mimeType, file.name]);
  const sheet = sheets[active];
  const headers = sheet?.rows[0] ?? [];
  const rows = useMemo(() => {
    const source = (sheet?.rows.slice(1) ?? []).filter(
      (row) => !query || row.some((cell) => cell.toLowerCase().includes(query.toLowerCase())),
    );
    return sort
      ? [...source].sort(
          (a, b) =>
            a[sort.column].localeCompare(b[sort.column], undefined, { numeric: true }) *
            sort.direction,
        )
      : source;
  }, [sheet, query, sort]);
  return (
    <ViewerFrame
      file={file}
      isBookmarked={isBookmarked}
      onToggleBookmark={onToggleBookmark}
      prevFile={prevFile}
      nextFile={nextFile}
      onNavFile={onNavFile}
    >
      {error ? (
        <ErrorState message={error} />
      ) : !sheet ? (
        <Loading label="Loading spreadsheet" />
      ) : (
        <div className="p-3 md:p-6">
          <div className="mx-auto max-w-7xl overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="flex flex-wrap items-center gap-3 border-b border-border bg-muted/30 px-3 py-2.5">
              <div className="relative min-w-56 flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search cells"
                  className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Filter className="h-3.5 w-3.5" /> {rows.length} rows
              </span>
            </div>
            {sheets.length > 1 && (
              <div className="flex gap-1 overflow-x-auto border-b border-border px-2 pt-2">
                {sheets.map((item, index) => (
                  <button
                    key={item.name}
                    onClick={() => {
                      setActive(index);
                      setSort(null);
                    }}
                    className={`shrink-0 rounded-t-md px-3 py-2 text-xs font-semibold ${active === index ? "bg-background text-primary shadow-[0_-1px_0_var(--color-border)]" : "text-muted-foreground hover:bg-accent"}`}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            )}
            <div className="max-h-[calc(100dvh-15rem)] overflow-auto">
              <table className="spreadsheet-table w-full border-collapse text-left text-sm">
                <thead>
                  <tr>
                    <th className="sticky left-0 top-0 z-20 w-12 bg-muted px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                      #
                    </th>
                    {headers.map((header, column) => (
                      <th
                        key={`${header}-${column}`}
                        onClick={() =>
                          setSort((previous) =>
                            previous?.column === column
                              ? { column, direction: previous.direction === 1 ? -1 : 1 }
                              : { column, direction: 1 },
                          )
                        }
                        className="sticky top-0 z-10 cursor-pointer whitespace-nowrap bg-muted px-3 py-2 text-xs font-semibold text-foreground hover:bg-accent"
                      >
                        {header || `Column ${column + 1}`}
                        {sort?.column === column ? (
                          <span className="ml-1 text-primary">
                            {sort.direction === 1 ? "↑" : "↓"}
                          </span>
                        ) : null}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rowIndex) => (
                    <tr key={`${rowIndex}-${row.join("-")}`}>
                      <td className="sticky left-0 z-10 bg-card px-3 py-2 text-right text-xs text-muted-foreground">
                        {rowIndex + 1}
                      </td>
                      {headers.map((_, column) => (
                        <td
                          key={column}
                          className="whitespace-nowrap border-t border-border px-3 py-2 text-foreground/85"
                        >
                          {row[column]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </ViewerFrame>
  );
}

function JsonViewer({
  file,
  isBookmarked,
  onToggleBookmark,
  prevFile,
  nextFile,
  onNavFile,
}: Props) {
  const [query, setQuery] = useState("");
  const formatted = useMemo(() => {
    try {
      return JSON.stringify(JSON.parse(file.content), null, 2);
    } catch {
      return file.content;
    }
  }, [file.content]);
  const lines = formatted.split("\n");
  return (
    <ViewerFrame
      file={file}
      isBookmarked={isBookmarked}
      onToggleBookmark={onToggleBookmark}
      prevFile={prevFile}
      nextFile={nextFile}
      onNavFile={onNavFile}
    >
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-8">
        <div className="relative mb-4 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find in JSON"
            className="w-full rounded-md border border-border bg-card py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <pre className="max-h-[calc(100dvh-13rem)] overflow-auto rounded-xl border border-border bg-[#101722] p-4 text-sm leading-6 text-slate-200">
          <code>
            {lines.map((line, index) => (
              <div
                key={index}
                className={
                  query && line.toLowerCase().includes(query.toLowerCase()) ? "bg-amber-300/20" : ""
                }
              >
                <span className="mr-5 inline-block w-7 select-none text-right text-slate-500">
                  {index + 1}
                </span>
                {line}
              </div>
            ))}
          </code>
        </pre>
      </div>
    </ViewerFrame>
  );
}

type Slide = { number: number; title: string; text: string };
function PresentationViewer({ file, isBookmarked, onToggleBookmark, embedded }: Props) {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [current, setCurrent] = useState(0);
  const [error, setError] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  useEffect(() => {
    setSlides([]);
    setCurrent(0);
    setError("");
    const buffer = dataUrlToArrayBuffer(file.data);
    if (!buffer) {
      setError(
        "This presentation was saved before binary previews were available. Remove it and upload the original .ppt or .pptx file again.",
      );
      return;
    }
    void (async () => {
      try {
        const zip = await JSZip.loadAsync(buffer);
        const paths = Object.keys(zip.files)
          .filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path))
          .sort((a, b) => Number(a.match(/\d+/)?.[0]) - Number(b.match(/\d+/)?.[0]));
        if (!paths.length) throw new Error("legacy");
        const next = await Promise.all(
          paths.map(async (path, index) => {
            const xml = await zip.file(path)!.async("string");
            const values = [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)]
              .map((match) => decodeXml(match[1]).trim())
              .filter(Boolean);
            return {
              number: index + 1,
              title: values[0] || `Slide ${index + 1}`,
              text: values.slice(1).join("\n"),
            };
          }),
        );
        setSlides(next);
        setCurrent(0);
      } catch {
        // Binary .ppt files do not share the OOXML slide tree used by PPTX.
        // Preserve their readable text as a deck so the same slide controls
        // remain useful instead of dropping the reader into a download-only flow.
        const legacySlides = extractLegacyPptSlides(buffer);
        if (legacySlides.length) {
          setSlides(legacySlides);
          setCurrent(0);
        } else {
          setError("This PowerPoint file does not contain readable slide text.");
        }
      }
    })();
  }, [file.id, file.data]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") setCurrent((value) => Math.min(value + 1, slides.length - 1));
      if (event.key === "ArrowLeft") setCurrent((value) => Math.max(value - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [slides.length]);
  const slide = slides[current];
  const goPrev = () => setCurrent((value) => Math.max(value - 1, 0));
  const goNext = () => setCurrent((value) => Math.min(value + 1, slides.length - 1));
  const slideEl = slide && (
    <article className="presentation-slide">
      <div className="absolute inset-0 opacity-90 [background:radial-gradient(circle_at_85%_12%,#45b7e8_0,transparent_32%),radial-gradient(circle_at_12%_90%,#6c5ce7_0,transparent_42%),linear-gradient(135deg,#ffffff_0%,#edf3fb_100%)]" />
      <div className="relative flex h-full flex-col justify-center p-[8%] text-slate-900">
        <div className="mb-5 h-1.5 w-14 rounded-full bg-sky-500" />
        <h1 className="max-w-3xl text-3xl font-bold leading-tight tracking-tight md:text-6xl">
          {slide.title}
        </h1>
        {slide.text && (
          <p className="mt-7 max-w-2xl whitespace-pre-line text-sm leading-relaxed text-slate-600 md:text-xl">
            {slide.text}
          </p>
        )}
      </div>
    </article>
  );

  // Embedded in markdown: reading-only. No header, no rail, no fullscreen —
  // just the slide and two swipe buttons.
  if (embedded) {
    return (
      <section
        ref={containerRef}
        className="presentation-shell relative bg-background text-foreground"
      >
        {error ? (
          <ErrorState message={error} />
        ) : !slide ? (
          <Loading label="Building presentation" />
        ) : (
          <div className="relative flex items-center justify-center overflow-hidden p-4 md:p-8">
            {slideEl}
            {slides.length > 1 && (
              <>
                <button
                  onClick={goPrev}
                  disabled={current === 0}
                  aria-label="Previous slide"
                  className="deck-nav left-3"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={goNext}
                  disabled={current === slides.length - 1}
                  aria-label="Next slide"
                  className="deck-nav right-3"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            )}
          </div>
        )}
      </section>
    );
  }

  return (
    <section
      ref={containerRef}
      className="presentation-shell min-h-[calc(100dvh-4rem)] bg-background text-foreground"
    >
      <ViewerHeader
        nav={{
          onPrev: goPrev,
          onNext: goNext,
          prevDisabled: current <= 0,
          nextDisabled: current >= slides.length - 1,
          prevLabel: "Previous slide",
          nextLabel: "Next slide",
        }}
        center={<HeaderTitle icon={<Presentation className="h-4 w-4" />} title={file.name} />}
        actions={
          <>
            {slides.length > 0 && (
              <span className="min-w-12 text-center text-xs text-muted-foreground tabular-nums">
                {current + 1} / {slides.length}
              </span>
            )}
            {onToggleBookmark && (
              <button
                type="button"
                onClick={onToggleBookmark}
                title={isBookmarked ? "Unstar" : "Star"}
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <Star className={`h-4 w-4 ${isBookmarked ? "fill-gold text-gold" : ""}`} />
              </button>
            )}
            <button
              onClick={toggleFullscreen}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </button>
          </>
        }
      />
      {error ? (
        <ErrorState message={error} />
      ) : !slide ? (
        <Loading label="Building presentation" />
      ) : (
        <div className="flex min-h-[calc(100dvh-7.5rem)] flex-col">
          <div className="relative flex flex-1 items-center justify-center overflow-hidden p-4 md:p-8">
            {slideEl}
          </div>
          <div className="presentation-rail">
            {slides.map((item, index) => (
              <button
                key={item.number}
                onClick={() => setCurrent(index)}
                className={`presentation-thumb ${current === index ? "is-active" : ""}`}
                aria-label={`Show slide ${item.number}`}
              >
                <span className="text-xs text-muted-foreground">{item.number}</span>
                <span className="presentation-thumb-card">
                  <strong>{item.title}</strong>
                  <small>{item.text}</small>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function GoogleViewer({
  file,
  isSlides,
  isBookmarked,
  onToggleBookmark,
  prevFile,
  nextFile,
  onNavFile,
}: GoogleProps) {
  const url = googleUrl(file.content);
  const preview = url?.replace(/\/edit(?:\?.*)?$/, "/preview");
  return (
    <ViewerFrame
      file={file}
      isBookmarked={isBookmarked}
      onToggleBookmark={onToggleBookmark}
      prevFile={prevFile}
      nextFile={nextFile}
      onNavFile={onNavFile}
    >
      {preview ? (
        <iframe
          title={`Google ${isSlides ? "Slides" : "Doc"} ${file.name}`}
          src={preview}
          className="h-[calc(100dvh-7.5rem)] w-full bg-white"
          allowFullScreen
        />
      ) : (
        <ErrorState
          message={`Add a shared Google ${isSlides ? "Slides" : "Docs"} link to this .${isSlides ? "gslides" : "gdoc"} file to preview it here.`}
        />
      )}
    </ViewerFrame>
  );
}
function ImageViewer({
  file,
  isBookmarked,
  onToggleBookmark,
  prevFile,
  nextFile,
  onNavFile,
}: Props) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [broken, setBroken] = useState(false);
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  // Prefer the stored data URL; fall back to inline text (data:/http) so legacy
  // saves and linked images still render. SVG, GIF, WebP, AVIF, etc. all ride
  // the browser's native <img> decoder — no format-specific handling needed.
  const src =
    file.data || (/^(data:|https?:)/.test(file.content.trim()) ? file.content.trim() : "");

  const reset = () => {
    setZoom(1);
    setRotation(0);
    setOffset({ x: 0, y: 0 });
  };
  useEffect(reset, [file.id]);

  const clampZoom = (value: number) => Math.min(8, Math.max(0.1, value));
  const zoomBy = (factor: number) =>
    setZoom((z) => {
      const next = clampZoom(z * factor);
      if (next === 1) setOffset({ x: 0, y: 0 });
      return next;
    });

  const onWheel = (event: React.WheelEvent) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    zoomBy(event.deltaY < 0 ? 1.1 : 0.9);
  };
  const onPointerDown = (event: React.PointerEvent) => {
    if (zoom <= 1) return;
    (event.target as Element).setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y };
  };
  const onPointerMove = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    setOffset({ x: drag.ox + (event.clientX - drag.x), y: drag.oy + (event.clientY - drag.y) });
  };
  const onPointerUp = () => {
    dragRef.current = null;
  };

  return (
    <div ref={containerRef} className="bg-background">
      <ViewerFrame
        file={file}
        isBookmarked={isBookmarked}
        onToggleBookmark={onToggleBookmark}
        prevFile={prevFile}
        nextFile={nextFile}
        onNavFile={onNavFile}
        action={
          <div className="flex items-center gap-1">
            <IconBtn
              label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              onClick={toggleFullscreen}
              disabled={!src || broken}
            >
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </IconBtn>
          </div>
        }
      >
        {!src ? (
          <ErrorState message="This image is missing its data. Remove it and upload the file again." />
        ) : broken ? (
          <ErrorState message="This image could not be decoded by the browser." />
        ) : (
          <div
            onWheel={onWheel}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            className="image-canvas flex min-h-[calc(100dvh-7.5rem)] items-center justify-center overflow-hidden p-4 md:p-8"
            style={{ cursor: zoom > 1 ? (dragRef.current ? "grabbing" : "grab") : "default" }}
          >
            <img
              src={src}
              alt={file.name}
              draggable={false}
              onLoad={(e) =>
                setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })
              }
              onError={() => setBroken(true)}
              className="max-h-full max-w-full select-none rounded-md shadow-lg"
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                transition: dragRef.current ? "none" : "transform 0.12s ease-out",
              }}
            />
          </div>
        )}
        {natural && src && !broken && (
          <div className="pointer-events-none fixed bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full border border-border bg-background/90 px-3 py-1 text-xs font-medium tabular-nums text-muted-foreground backdrop-blur">
            {natural.w} × {natural.h}
          </div>
        )}
      </ViewerFrame>
    </div>
  );
}

function IconBtn({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

function UnknownViewer({
  file,
  isBookmarked,
  onToggleBookmark,
  prevFile,
  nextFile,
  onNavFile,
}: Props) {
  return (
    <ViewerFrame
      file={file}
      isBookmarked={isBookmarked}
      onToggleBookmark={onToggleBookmark}
      prevFile={prevFile}
      nextFile={nextFile}
      onNavFile={onNavFile}
    >
      <ErrorState message="This file was uploaded successfully, but this browser does not have a previewer for its format yet." />
    </ViewerFrame>
  );
}
function Loading({ label, dark = false }: { label: string; dark?: boolean }) {
  return (
    <div
      className={`flex min-h-[55vh] items-center justify-center text-sm ${dark ? "text-white/60" : "text-muted-foreground"}`}
    >
      <span className="mr-3 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      {label}
    </div>
  );
}
function ErrorState({ message, dark = false }: { message: string; dark?: boolean }) {
  return (
    <div
      className={`flex min-h-[55vh] items-center justify-center px-6 text-center text-sm ${dark ? "text-white/65" : "text-muted-foreground"}`}
    >
      {message}
    </div>
  );
}
function decodeXml(value: string) {
  const el = new DOMParser().parseFromString(`<span>${value}</span>`, "text/html").body;
  return el.textContent ?? value;
}

function extractLegacyPptSlides(buffer: ArrayBuffer): Slide[] {
  const bytes = new Uint8Array(buffer);
  const strings: string[] = [];
  let current = "";
  for (let index = 0; index + 1 < bytes.length; index += 2) {
    const code = bytes[index] | (bytes[index + 1] << 8);
    if (code >= 32 && code < 0xfffd) {
      current += String.fromCharCode(code);
    } else {
      if (current.trim().length > 3) strings.push(current.trim());
      current = "";
    }
  }
  if (current.trim().length > 3) strings.push(current.trim());
  return strings
    .filter((text, index, all) => all.indexOf(text) === index)
    .slice(0, 80)
    .map((text, index) => ({
      number: index + 1,
      title: text.split(/\r?\n/)[0].slice(0, 120) || `Slide ${index + 1}`,
      text: text.split(/\r?\n/).slice(1).join("\n").slice(0, 1800),
    }));
}
