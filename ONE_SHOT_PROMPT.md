# DocuCraft Pro — One-Shot Build Prompt

> Paste this entire document to an AI coding agent to reproduce the app end-to-end.
> Build a **local-first, backend-free documentation reader & workspace** called
> **DocuCraft Pro** (internal brand string: *Localdox*). Everything runs in the
> browser. No server, no login, no database on a backend — all data lives in the
> user's own browser (IndexedDB + localStorage). Miss nothing below.

---

## 1. Product summary

A single-page web app where a user drops in files of **any kind** and reads,
annotates, organizes, and asks AI about them. It renders Markdown beautifully,
previews binary formats (PDF, PPTX, DOCX, XLSX, images, video, audio), and keeps
everything organized into **workspaces** that persist across reloads with zero
setup. It is offline-capable, private by default, and shareable by link.

**Core promise:** upload anything → read it instantly → annotate it → find it
again → optionally ask AI about it — all with nothing stored outside the browser.

---

## 2. Tech stack (use exactly this)

- **Framework:** TanStack Start + TanStack React Router (file-based routes),
  React 18, TypeScript.
- **Build:** Vite. Package manager: bun (npm-compatible).
- **Styling:** Tailwind CSS v4 (`@tailwindcss/vite`), CSS custom-property theme
  tokens. Radix UI primitives + shadcn-style `components/ui/*`. `lucide-react`
  icons. `class-variance-authority` + `clsx` + a `cn()` helper.
- **Animation:** GSAP (sidebar collapse tween, content fade/rise on nav).
- **Markdown:** `react-markdown` + `remark-gfm` + `remark-math` +
  `rehype-slug` + `rehype-highlight` (highlight.js) + `rehype-katex` (KaTeX CSS).
- **Binary parsing (all client-side, lazy-imported):**
  - `xlsx` (SheetJS) — spreadsheets & CSV.
  - `jszip` — unzip `.pptx` to read slide XML.
  - `mammoth` (`mammoth/mammoth.browser`) — `.docx` → HTML.
  - Native `<iframe>` blob preview — PDF.
  - `@babel/standalone` — compile live React code blocks in-browser.
- **Fonts:** `@fontsource` — Inter, Source Serif 4, Newsreader,
  Atkinson Hyperlegible, JetBrains Mono.
- **Misc:** `sonner` (toasts), `cmdk` (command palette), `date-fns`,
  `github-slugger` (heading ids that match rehype-slug exactly),
  `embla-carousel-react`, `input-otp`.

Deploy target is static hosting (Firebase Hosting / Cloudflare in this repo).

---

## 3. Data model & persistence (local-first, Excalidraw-style)

**No backend.** Funnel all IndexedDB access through one `persistence` module so
UI never touches the DB directly.

- **IndexedDB** (`DB_NAME = "localdox"`, store `workspaces`, keyed by `id`):
  the primary store. Holds full **WorkspaceRecord** objects.
- **localStorage:** lightweight prefs only — theme, last-opened workspace id,
  reader name, reading mode, reading font, sidebar width
  (`localdox:sidebarWidth`), reading progress (`localdox:reading:v1`), recent
  searches (`docs-recent-searches`), AI config (`localdox:ai-config`), AI keys
  (`localdox:ai-key:*`).

```ts
interface PersistedFile {
  id: string; name: string; content: string;
  data?: string;          // data-URL of original bytes for binary files
  mimeType?: string; size?: number; addedAt?: number;
  kind?: DocumentKind;
}
interface WorkspaceRecord {
  id: string; name: string; createdAt: number; updatedAt: number;
  files: PersistedFile[];
  bookmarks: string[];              // "fileId#subtopicId" (or "fileId#root")
  highlights?: Highlight[];
  ui: { activeFileId: string|null; expanded: Record<string,boolean>;
        sidebarCollapsed: boolean; scrollTop: number; fileOrder?: string[]; };
}
type SaveStatus = "idle" | "saving" | "saved" | "restored";
```

**Persistence behavior — implement all of it:**
- **Autosave with debounce.** Every user mutation calls `markDirty()`: sets
  status `"saving"`, then writes to IndexedDB after a **700ms** pause. Show the
  save status in the UI.
- **Scroll position is persisted** silently (debounced ~1200ms) and **flushed on
  tab hide (`visibilitychange`) and `beforeunload`**. On reload, restore exact
  `scrollTop` after paint (~350ms delay so it wins over mount effects).
- **Session restore on first load:** open last-used workspace (`lastWorkspaceId`)
  or the first one; hydrate files, active file, expanded state, sidebar,
  bookmarks, highlights, scroll. Flash status `"restored"` for ~2.5s then
  `"saved"`.
- `snapshotRef` mirror of state so the debounced async save always writes the
  latest values without being recreated each render.
- Derive `DocumentKind` on hydrate; parse markdown headings/subtopics lazily.

---

## 4. Uploading — "upload anything"

The file picker uses `accept="*/*"`. **Every file type is accepted.** Known
formats route to rich previews; unknown binaries are preserved (stored as data
URL) with a friendly "no previewer yet" message — never rejected.

Implement **three upload paths**, all going through one `addFiles(File[])`:
1. **Click** the Upload button / "Add more files" (hidden `<input type=file multiple>`).
2. **Drag & drop anywhere on the window.** Global `dragover`/`drop` listeners.
   Show a full-screen **drop overlay** ("Drop files to upload", bouncing icon,
   dashed border) while dragging files.
3. **Bottom-dock upload** on mobile.

Upload rules & functionality:
- **Empty files upload fine** (empty content string is valid — never block).
- **Multi-file upload** with a live progress toast (`Uploading N files… 47%`),
  success/error toasts via `sonner`.
- On import, read text formats with `file.text()`; read binary formats as a
  **data URL** (`FileReader.readAsDataURL`) so originals survive reloads and
  re-embeds. Compute `id`, `size`, `addedAt`, `mimeType`, `kind`.
- For markdown/text, precompute `headings` (tree) and `subtopics` (chunks).
- Detect **Google Docs/Slides links** pasted into `.txt`/`.url`/`.gdoc`/`.gslides`
  files and route to an embedded Google preview.
- After upload, auto-navigate into the reader; pick a "resume" file from reading
  progress if nothing is active. If no workspace exists yet, create
  "My workspace" automatically.

### DocumentKind detection
Map by extension first, then MIME sniffing. Kinds:
`markdown | text | docx | pdf | spreadsheet | csv | json | presentation |
google-doc | google-slide | image | video | audio | html | unknown`.

Extensions covered: `md/markdown/mdx`, `txt`, `docx`, `pdf`, `xlsx/xls`, `csv`,
`json`, `ppt/pptx`, `gdoc/gsheet(s)/gslides`, `url`, `html/htm`,
`png/jpg/jpeg/webp/gif/svg/avif`, `mp4/webm/mov/m4v`, `mp3/wav/ogg/m4a`.

---

## 5. Document viewers (one per kind, client-side only)

A `DocumentViewer` dispatches on `kind`. All share a `ViewerFrame` header (file
name, kind label, bookmark toggle, optional action). Text/markdown files use the
separate `MarkdownViewer` (§6).

- **PDF:** convert data URL → Blob → object URL → `<iframe>` preview + Download
  button. Revoke URL on unmount.
- **DOCX (Word):** lazy-import `mammoth`, convert arraybuffer → HTML, render in a
  `.docx-prose` article. Graceful error states.
- **Spreadsheet / CSV:** parse with SheetJS. Show a data grid with:
  - **Sheet tabs** (multi-sheet workbooks),
  - **Search box** filtering rows (case-insensitive across all cells),
  - **Click-a-column-header to sort** (toggle asc/desc, numeric-aware, ↑/↓ arrow),
  - sticky header + sticky row-number column, live "N rows" count.
- **JSON:** pretty-print; **find box** highlights matching lines; line numbers.
- **Presentation (PPT/PPTX) — embeddable deck viewer:**
  - Unzip `.pptx` with JSZip, read `ppt/slides/slideN.xml`, extract `<a:t>` text
    runs → title + body per slide.
  - **Legacy binary `.ppt` fallback:** scan UTF-16 strings out of the raw bytes
    and reconstruct up to 80 readable slides so old decks still show.
  - Slide stage with gradient background, **prev/next arrows**, **←/→ keyboard
    nav**, slide counter `n / total`, a **thumbnail rail**, **fullscreen** toggle
    (`requestFullscreen`), and a bookmark toggle.
  - An **`embedded` mode** (no chrome, just slide + two nav buttons) used when a
    deck is embedded inside a markdown document (see §7).
- **Image:** native `<img>` (handles SVG/GIF/WebP/AVIF). Full viewer controls:
  **zoom in/out** (buttons + Ctrl/⌘-scroll wheel, clamp 0.1–8×), **rotate 90°**,
  **pan/drag** when zoomed, **reset view**, **Download**, live **natural
  dimensions** badge (`W × H`), broken-image + missing-data states.
- **Google Doc / Slides:** rewrite the share URL to `/preview` and embed via
  `<iframe allowFullScreen>`. Prompt to add a link if missing.
- **Unknown:** "uploaded successfully, no previewer for this format yet"
  (file is still stored & downloadable).

---

## 6. Markdown reader (the centerpiece)

Rendered with react-markdown + the plugin chain above. Supports full **GFM**
(tables, task lists, strikethrough, autolinks), **math** via KaTeX
(`$…$`, `$$…$$`), and **syntax highlighting** with auto language detection.

Custom renderers & features:
- **Headings** get slug ids (github-slugger, matching the ToC/search exactly),
  a hover **"copy link to heading"** button (copies `…#slug`).
- **Code blocks:** hover **Copy** button with copied-state check. Fenced
  ```mermaid``` renders a live **Mermaid diagram**. Special fences
  ```interactive-html``` / ```interactive-react``` render live sandboxed demos
  (see §8).
- **Callouts / admonitions:** GitHub-style `> [!NOTE|INFO|TIP|WARNING|CAUTION|
  DANGER|IMPORTANT]` blockquotes render as colored, icon-labeled callout boxes.
- **Rich media auto-embeds** — a paragraph that is a single bare link becomes an
  embed. Providers: **YouTube, Vimeo, Loom, CodeSandbox, StackBlitz, CodePen,
  GitHub Gist, Google Drive**. Direct video files (`.mp4/.webm/.mov/…`) render a
  native `<video>` player (with optional poster via image title). Images open in
  a **lightbox** on click (`cursor-zoom-in`, lazy-loaded).
- **Two reading layouts** (user pref + toolbar toggle):
  - **Paged sections** — split the doc on H1/H2 into "subtopics"/chapters; read
    one section per page with a big **Next** card + **Previous** link and
    "≈ N min read" estimate; auto-scroll to top on section change; end-of-doc
    "You've reached the end." Cross-file **Next Chapter** when a section ends.
  - **Single page** — whole document on one scroll; sidebar section clicks
    smooth-scroll to the heading anchor.
- **Reading-time estimate** (~220 wpm), word count.
- **Inline editor:** a **Pencil** toggles edit mode → a monospace `<textarea>`
  with **autosave (400ms debounce)** and **⌘/Ctrl-S** save; sticky "Editing —
  changes save automatically" bar with "Done · Preview". Editing re-parses
  headings/subtopics live.
- **Back-to-top** floating button after scrolling 400px.
- **Bookmark toggle** on the current section/chapter.

### Highlighting (annotation)
- Select text → a **highlight popover** appears with: **5 color swatches**, an
  optional **label/tag** input, **Copy**, and **Highlight** (or, when editing an
  existing one, **Remove**). Also an **Ask AI** row (Ask/Summarize/Explain/
  Notes/Mermaid/Rewrite) that opens the AI panel seeded with the selection.
- Highlights are painted with the **CSS Custom Highlight API**
  (`CSS.highlights` + `window.Highlight`), grouped by color into
  `::highlight(dc-hl-N)` rules — **no DOM mutation**, so React re-renders and
  cross-node selections never break them.
- Offsets are stored **relative to a subtopic** (start/end char offsets) so they
  reattach on reload. Clicking an existing highlight hit-tests by offset and
  reopens its edit popover. New overlapping highlights replace the ones they
  cover. Highlight creation is offered in **paged mode** only.
- All highlights are listed & manageable in Settings and the sidebar library.

---

## 7. Cross-document embedding (embed anything inside anything)

Let a markdown document **embed another workspace file inline** — including a
**PPT deck rendered right inside the doc**, a PDF, an image, a spreadsheet, etc.

Two ergonomic Markdown syntaxes, normalized to a reserved artifact URL:
```
![[Deck.pptx]]            → embeds Deck.pptx from the current workspace
@[file](Report.pdf)       → same, alt form
![[Other Workspace/Deck.pptx]]  → resolve across workspaces by "Workspace/File"
```
- A preprocessing pass (`prepareWorkspaceEmbeds`) rewrites these to a custom
  image URL prefix `https://workspace-artifact.local/…` that survives
  react-markdown's URL sanitizer but never hits the network (intercepted by the
  custom `img`/`p` renderers before an `<img>` is created).
- `resolveWorkspaceArtifact` looks up the file by name in the current workspace,
  else `Workspace/File` globally across all IndexedDB workspaces (cached).
- `InlineArtifact` renders the resolved file with the appropriate viewer (deck
  in **embedded** mode, PDF/image/sheet inline, etc.) plus an "open full" action
  that navigates to it (switching workspace if needed).
- A tiny `ViewerRegistry` makes "add another embeddable type" a one-line change.

---

## 8. Interactive live code blocks

Fenced ```interactive-html``` and ```interactive-react``` blocks render **live,
runnable, sandboxed** previews. Flags in the info string: `preview` (default
render-only), `split` (source + preview, **resizable** panes), `playground`
(editable source, live re-run).

- Rendered in a **sandboxed `<iframe sandbox="allow-scripts">`** with a strict
  CSP; `postMessage` bridge for boot/height/error events; auto-resize to content.
- Dangerous APIs are **hard-disabled** inside the frame (`fetch`, `eval`,
  `Function`, `open`, storage, cookies, geolocation, media) — they throw.
- **React blocks** are compiled in-browser with lazily-loaded `@babel/standalone`
  (TypeScript + JSX presets); React/hooks are injected (no `import` statements).
  Served via a dedicated `/interactive-runtime` route.
- **Lazy mount:** an `IntersectionObserver` only compiles/mounts a demo as it
  nears the viewport, so a doc can hold many demos cheaply.
- Theme-synced (light/dark) via a `MutationObserver` on `<html class>`.
- Inline error panel shows compile/runtime errors with stack.

---

## 9. Search, sort, filter, group, organize

- **Command palette (⌘/Ctrl-K)** — full-text search across **all files**:
  matches file names, headings, and body lines; **snippet previews** with the
  query highlighted; results **grouped by file**, ranked (headings > filename >
  body); **keyboard nav** (↑↓ / ↵ / Esc); **recent searches** persisted
  (removable). Selecting a hit navigates to the file+heading and carries the
  query so it's highlighted in the reader.
- **Sidebar file list** with per-file expand/collapse of subtopics, active-item
  indicator, reading-minutes / kind badge, and a per-file **⋮ menu**
  (Rename, Delete, Move Up, Move Down).
- **Sort:** Manual (drag/move order), Name, Date added, Size — each **asc/desc**.
- **Filter:** All files, or by any present **DocumentKind** (PDF, Markdown,
  Image, …). Empty-state "No files match this filter."
- **Group:** None, or **by type** (headed sections).
- **Manual reorder:** Move Up / Move Down (drag order persisted as
  `ui.fileOrder`); disabled while a sort/filter/group view transform is active.
- **Sort-by-name** quick action. Mobile gets a compact **chips row** for
  Sort/Filter/Group.
- **Rename / delete files.** Delete shows an **Undo** toast (6s) that restores
  the file at its original index.
- **Resizable sidebar** (drag handle, clamp 220–480px, double-click resets to
  288px, width persisted) and **collapsible sidebar** (GSAP width tween).

---

## 10. Bookmarks & library

- **Bookmark** any section/chapter (markdown) or whole file (binary). Stored as
  `fileId#subtopicId` (or `#root`). Toggle from the reader header, viewer header,
  or presentation toolbar.
- **Bookmarks sheet** (sidebar "Library" → Bookmarks) lists all bookmarks;
  click to jump, hover to remove.
- Settings has full **Bookmarks** and **Highlights** managers: list, jump-to,
  remove one, **Clear All** (with confirm). Highlights show color swatch, source
  file, quoted text, and label.

---

## 11. Workspaces (multi-project organization)

- Multiple named workspaces; each is an isolated set of files + annotations + UI
  state. **Workspace picker** in the header (desktop) / bottom dock (mobile).
- **New / Rename / Delete / Switch** workspace. Deleting the last one recreates a
  default "My workspace". Switching flushes the current one first.
- **Export workspace** → downloads a `localdox-workspace` **JSON** file
  (`{format, version, workspace}`), filename slugified.
- **Import workspace** → parse JSON, sanitize, assign a **new id** (never clobber),
  add and open it. Invalid files are rejected with a message.
- **Share workspace by link:** serialize → POST to a pastebin
  (`bytebin.lucko.me`) → build `…#share=<key>` URL → **copy to clipboard**
  ("link copied" toast). On load, a `#share=…` hash is fetched (or decoded via
  compress/decompress fallback), imported as a fresh "(Shared)" workspace, and
  the hash is cleared.
- A "New Folder" menu entry exists but shows a "coming in a future update"
  notice (virtual FS is experimental — keep as a stub, do not fake it).

---

## 12. Ask AI (bring-your-own-key, private)

Optional AI assistant. **No server** — the browser calls the provider directly
with the user's own key.

- **Providers:** OpenAI (`gpt-4o-mini` default, `gpt-4o`, `gpt-4.1-mini`,
  `gpt-4.1`) and Google **Gemini** (`gemini-2.0-flash`, `-flash-lite`,
  `1.5-flash`, `1.5-pro`). A **provider registry** makes adding a provider a
  one-file change. Non-secret config (default provider+model) in its own
  localStorage key.
- **Key storage:** encrypted at rest via a WebCrypto **crypto-store** when
  available; otherwise an **obfuscated localStorage fallback** with a visible
  "less secure" warning. Decrypted keys live only in an in-memory session cache,
  never logged. Keys never leave the browser except to the chosen provider.
- **Streaming** responses (SSE) into the panel, with **Stop/abort**.
- **Context selector:** **Selection**, **This doc** (section vs whole doc, action
  decides), or **Documents** (multi-select across the workspace). Shows "Context
  sent: …" scope label; token-aware trimming.
- **Action catalog**, grouped:
  - *Generate:* Notes, Summary, Key points, TL;DR, **Mermaid diagram**,
    Action items (checkbox list), Study notes (with self-test questions).
  - *Explain:* Explain, Simplify, Answer a question (freeform input).
  - *Rewrite:* Improve writing, Rewrite (style note), Expand, Shorten, Fix grammar.
- **Freeform ask** box (Enter to send, Shift+Enter newline).
- Output actions: **Copy**, **Insert into doc**, **New document** (creates a
  markdown file from the answer, auto-named).
- Quick actions from the highlight popover pre-run an action on the selection.
- No key → a "Connect an AI provider" empty state linking to Settings.

---

## 13. Settings page (`/settings`, tabbed)

Tabs: **Appearance · Ask AI · Workspace · Storage.**

- **Appearance:**
  - **5 reader themes** with live mini-previews and WCAG-checked token palettes:
    **Light, Sepia, Dark, Nord, Black (true-black/OLED).** Applied via
    `data-theme` on `<html>`; dark-based themes also toggle `.dark` so
    code/KaTeX/Mermaid dark rules apply.
  - **5 reading fonts:** System (default), Source Serif 4, Newsreader, Inter,
    Atkinson Hyperlegible — each with a live specimen. Applied via `data-font`.
  - **Document layout:** Paged sections vs Single page.
- **Ask AI:** manage provider, model, and per-provider API keys (add/remove),
  storage-mode indicator.
- **Workspace:** rename/delete/open workspaces; **Bookmarks** & **Highlights**
  managers.
- **Storage:** live **usage/quota** via `navigator.storage.estimate()`, and a
  destructive **"Clear All Storage"** (double-confirm) that wipes IndexedDB +
  localStorage + sessionStorage and reloads. Copy must warn it's irreversible.

---

## 14. Personalization & niceties

- **First-visit name prompt** (asked once, remembered) for a personalized
  greeting; never re-asks after set or skipped.
- **Reading progress** ("continue reading"): timestamp per file in
  `localdox:reading:v1`; used to resume the most-recently-read file after upload.
- **Toasts** for every meaningful action (upload, delete+undo, share, import).
- **Save-status** indicator (idle/saving/saved/restored) in the header.
- Smooth **GSAP** transitions (content fade/rise on nav; sidebar collapse).

---

## 15. Responsive & accessibility

- Full **desktop / tablet (landscape & portrait) / mobile** layouts.
- **Mobile bottom nav dock:** Home, Upload, Bookmarks, Workspace switch/manage,
  Settings; a slide-in left drawer for the sidebar on small screens.
- Keyboard: ⌘/Ctrl-K search, ⌘/Ctrl-S save, ←/→ slides, Esc closes overlays,
  ↑↓/↵ palette nav.
- ARIA labels/roles on all controls; focus rings; reduced visual noise.
- Respects light/dark; WCAG-compliant contrast in every theme.

---

## 16. Privacy & guarantees (state these in the UI)

- **Everything stays in the browser.** No account, no backend storage. Files,
  annotations, and AI keys live only on the user's device.
- The **only** network calls are: (a) provider AI APIs with the user's own key,
  (b) optional workspace share upload/fetch (explicit user action), (c)
  third-party media embeds the user includes. Nothing else phones home.
- Interactive code runs in a locked-down sandbox with dangerous APIs disabled.

---

## 17. Routes

- `/` — the reader app (`DocsApp`): header, sidebar, viewer/markdown pane,
  command palette, bottom nav, drop overlay, hidden file input. Empty state =
  upload prompt.
- `/settings` — the tabbed settings page.
- `/interactive-runtime` — sandbox host page for live React blocks.

---

**Deliver the whole thing.** Local-first, zero-backend, upload-anything,
read-anything, embed-anything, annotate-anything, find-anything, ask-AI-about-
anything. Every capability above must work.
