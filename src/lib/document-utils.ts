import type { DocumentKind, MdFile } from "./markdown-utils";

const kindByExtension: Record<string, DocumentKind> = {
  md: "markdown",
  markdown: "markdown",
  mdx: "markdown",
  txt: "text",
  docx: "docx",
  pdf: "pdf",
  xlsx: "spreadsheet",
  xls: "spreadsheet",
  csv: "csv",
  json: "json",
  ppt: "presentation",
  pptx: "presentation",
  gdoc: "google-doc",
  gsheets: "spreadsheet",
  gsheet: "spreadsheet",
  gslides: "google-slide",
  url: "text",
  html: "html",
  htm: "html",
  png: "image",
  jpg: "image",
  jpeg: "image",
  webp: "image",
  gif: "image",
  svg: "image",
  avif: "image",
  mp4: "video",
  webm: "video",
  mov: "video",
  m4v: "video",
  mp3: "audio",
  wav: "audio",
  ogg: "audio",
  m4a: "audio",
};

// Keep the picker open to every file type. The viewer routes known formats to
// rich previews and preserves unknown binary uploads for future support.
export const SUPPORTED_ACCEPT = "*/*";

export function fileExtension(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

export function getDocumentKind(name: string, mimeType = ""): DocumentKind {
  const extension = fileExtension(name);
  if (kindByExtension[extension]) return kindByExtension[extension];
  if (mimeType.includes("pdf")) return "pdf";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return "spreadsheet";
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return "presentation";
  if (mimeType.includes("wordprocessing") || mimeType.includes("word")) return "docx";
  if (mimeType.includes("json")) return "json";
  if (mimeType.startsWith("text/")) return "text";
  return "unknown";
}

export function isTextKind(kind: DocumentKind) {
  return ["markdown", "text", "csv", "json", "google-doc", "google-slide", "html"].includes(kind);
}

function dataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file"));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

export async function importDocumentFile(file: File): Promise<MdFile> {
  let kind = getDocumentKind(file.name, file.type);
  const content = isTextKind(kind) ? await file.text() : "";
  const linkedGoogleFile = googleUrl(content);
  if (linkedGoogleFile && kind === "text") {
    kind = linkedGoogleFile.includes("/presentation/") ? "google-slide" : "google-doc";
  }
  const data = isTextKind(kind) ? undefined : await dataUrl(file);
  const id = `${file.name}-${crypto.randomUUID().slice(0, 8)}`;
  return {
    id,
    name: file.name,
    content,
    data,
    mimeType: file.type,
    size: file.size,
    addedAt: Date.now(),
    kind,
    // Structure is derived on demand by `fileSubtopics`. Parsing it during an
    // upload delayed every file in the batch behind a scan of its own text.
  };
}

export function dataUrlToArrayBuffer(data?: string): ArrayBuffer | null {
  if (!data) return null;
  const encoded = data.slice(data.indexOf(",") + 1);
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export function dataUrlToBlob(data?: string, fallbackType = "application/octet-stream") {
  const buffer = dataUrlToArrayBuffer(data);
  if (!buffer) return null;
  const type = data?.match(/^data:([^;,]+)/)?.[1] || fallbackType;
  return new Blob([buffer], { type });
}

export function googleUrl(content: string): string | null {
  const url = content.match(/https?:\/\/docs\.google\.com\/[^\s"\\]+/i)?.[0];
  if (url) return url.replace(/\\u0026/g, "&");
  try {
    const parsed = JSON.parse(content);
    const value = parsed.url || parsed.doc_url || parsed.resourceUrl;
    return typeof value === "string" && value.includes("docs.google.com") ? value : null;
  } catch {
    return null;
  }
}

export function fileLabel(kind: DocumentKind) {
  return (
    {
      markdown: "Markdown",
      text: "Text",
      docx: "Word",
      pdf: "PDF",
      spreadsheet: "Excel",
      csv: "CSV",
      json: "JSON",
      presentation: "Presentation",
      "google-doc": "Google Doc",
      "google-slide": "Google Slides",
      image: "Image",
      video: "Video",
      audio: "Audio",
      html: "HTML",
      unknown: "File",
    } as const
  )[kind];
}
