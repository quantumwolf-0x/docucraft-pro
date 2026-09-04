import { useState, useEffect } from "react";
import {
  Trash2,
  AlertTriangle,
  Star,
  Folder,
  Database,
  ArrowRight,
  Palette,
  Check,
  ArrowLeft,
  ScrollText,
  Files,
  Sparkles,
  Archive,
  RefreshCw,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { AiSettings } from "./ai/AiSettings";
import type { Highlight } from "@/lib/dom-highlighter";
import type { MdFile } from "@/lib/markdown-utils";
import type { ThemePref, ReadingMode, ReadingFont } from "@/lib/persistence";
import { savedTypeLabel, type SavedEntry, type SavedItem } from "@/lib/saved-items";
import { STORAGE_QUOTA_FRACTION, formatBytes } from "@/lib/storage-limits";

export interface SettingsPageProps {
  workspaces: { id: string; name: string }[];
  currentWorkspaceId: string | null;
  onRenameWorkspace: (id: string, name: string) => void;
  onDeleteWorkspace: (id: string) => void;
  onClearStorage: () => void;
  saved: SavedEntry[];
  onOpenSaved: (item: SavedItem) => void;
  onRemoveSaved: (id: string) => void;
  onClearSaved: () => void;
  highlights: Highlight[];
  onRemoveHighlight: (id: string) => void;
  onClearHighlights: () => void;
  onNavigate: (fileId: string, subtopicId?: string) => void;
  files: MdFile[];
  onOpenWorkspace: (id: string) => void;
  theme: ThemePref;
  onSetTheme: (theme: ThemePref) => void;
  readingMode: ReadingMode;
  onSetReadingMode: (mode: ReadingMode) => void;
  readingFont: ReadingFont;
  onSetReadingFont: (font: ReadingFont) => void;
  onToggleArchiveFile: (id: string) => void;
}

export function SettingsPage({
  workspaces,
  currentWorkspaceId,
  onRenameWorkspace,
  onDeleteWorkspace,
  onClearStorage,
  saved,
  onOpenSaved,
  onRemoveSaved,
  onClearSaved,
  highlights,
  onRemoveHighlight,
  onClearHighlights,
  onNavigate,
  files,
  onOpenWorkspace,
  theme,
  onSetTheme,
  readingMode,
  onSetReadingMode,
  readingFont,
  onSetReadingFont,
  onToggleArchiveFile,
}: SettingsPageProps) {
  const [activeTab, setActiveTab] = useState<
    "appearance" | "ai" | "workspace" | "storage" | "archive"
  >("appearance");

  const tabs = [
    { id: "appearance", label: "Appearance", icon: Palette },
    { id: "ai", label: "Ask AI", icon: Sparkles },
    { id: "workspace", label: "Workspace", icon: Folder },
    { id: "archive", label: "Archive", icon: Archive },
    { id: "storage", label: "Storage", icon: Database },
  ] as const;

  return (
    <div className="mx-auto w-full max-w-3xl p-6 md:p-12">
      <div className="mb-10 flex items-center gap-4">
        <Link
          to="/"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Go back home"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-foreground">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Reading, workspaces, and data on this device.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-8">
        <nav className="grid grid-cols-5 gap-1.5 overflow-x-auto rounded-2xl border border-border/80 bg-card/70 p-1.5 pb-1.5 scrollbar-hide sm:flex sm:flex-row">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex min-h-11 flex-col items-center justify-center gap-1.5 rounded-xl p-2.5 transition-colors sm:min-w-24 ${
                  active
                    ? "bg-foreground text-background font-medium"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground font-medium"
                }`}
                title={tab.label}
                aria-label={tab.label}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="text-xs leading-none tracking-wide">{tab.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="min-w-0">
          {activeTab === "appearance" && (
            <AppearanceSettings
              theme={theme}
              onSetTheme={onSetTheme}
              readingMode={readingMode}
              onSetReadingMode={onSetReadingMode}
              readingFont={readingFont}
              onSetReadingFont={onSetReadingFont}
            />
          )}
          {activeTab === "ai" && <AiSettings />}
          {activeTab === "workspace" && (
            <div className="flex flex-col gap-12">
              <WorkspaceSettings
                workspaces={workspaces}
                currentWorkspaceId={currentWorkspaceId}
                onRename={onRenameWorkspace}
                onDelete={onDeleteWorkspace}
                onOpenWorkspace={onOpenWorkspace}
              />
              <SavedSettings
                saved={saved}
                onOpen={onOpenSaved}
                onRemove={onRemoveSaved}
                onClearAll={onClearSaved}
              />
              <HighlightSettings
                highlights={highlights}
                files={files}
                onRemove={onRemoveHighlight}
                onClearAll={onClearHighlights}
                onNavigate={onNavigate}
              />
            </div>
          )}
          {activeTab === "storage" && <StorageSettings onClearStorage={onClearStorage} />}
          {activeTab === "archive" && (
            <ArchiveSettings files={files} onUnarchive={onToggleArchiveFile} />
          )}
        </div>
      </div>
    </div>
  );
}

// Swatch previews approximate each theme so the picker reads at a glance; the
// applied theme itself is driven by the CSS token sets in styles.css.
const READER_THEME_META: {
  id: ThemePref;
  label: string;
  hint: string;
  bg: string;
  fg: string;
  muted: string;
  accent: string;
}[] = [
  {
    id: "light",
    label: "Light",
    hint: "Bright, high contrast",
    bg: "#f4f5f8",
    fg: "#1a1d27",
    muted: "#667085",
    accent: "#e07a45",
  },
  {
    id: "sepia",
    label: "Sepia",
    hint: "Warm paper, easy on the eyes",
    bg: "#f4ecd8",
    fg: "#4a3f35",
    muted: "#8a7a68",
    accent: "#a8562f",
  },
  {
    id: "dark",
    label: "Dark",
    hint: "Balanced slate for night reading",
    bg: "#1a1e2a",
    fg: "#eceef2",
    muted: "#9aa3b2",
    accent: "#e07a45",
  },
  {
    id: "nord",
    label: "Nord",
    hint: "Cool blue-grey, low glare",
    bg: "#2e3440",
    fg: "#eceff4",
    muted: "#a9b3c4",
    accent: "#88c0d0",
  },
  {
    id: "black",
    label: "Black",
    hint: "True black for OLED screens",
    bg: "#000000",
    fg: "#e8e8e8",
    muted: "#b3b3b3",
    accent: "#cfcfcf",
  },
];

// Explicit font stacks so each preview shows its own face regardless of the
// currently applied reading font.
const READING_FONT_META: { id: ReadingFont; label: string; hint: string; family: string }[] = [
  {
    id: "system",
    label: "System",
    hint: "Your device's native font (default)",
    family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  {
    id: "serif",
    label: "Source Serif",
    hint: "Warm literary serif",
    family: '"Source Serif 4", ui-serif, Georgia, serif',
  },
  {
    id: "newsreader",
    label: "Newsreader",
    hint: "Elegant editorial serif",
    family: '"Newsreader", ui-serif, Georgia, serif',
  },
  {
    id: "sans",
    label: "Inter",
    hint: "Clean modern sans",
    family: '"Inter", ui-sans-serif, system-ui, sans-serif',
  },
  {
    id: "hyperlegible",
    label: "Atkinson Hyperlegible",
    hint: "Maximum legibility",
    family: '"Atkinson Hyperlegible", ui-sans-serif, sans-serif',
  },
];

const READING_MODE_META: { id: ReadingMode; label: string; hint: string; icon: typeof Files }[] = [
  {
    id: "paginated",
    label: "Paged sections",
    hint: "One section per page, with prev / next",
    icon: Files,
  },
  {
    id: "single",
    label: "Single page",
    hint: "The whole document on one scroll",
    icon: ScrollText,
  },
];

function AppearanceSettings({
  theme,
  onSetTheme,
  readingMode,
  onSetReadingMode,
  readingFont,
  onSetReadingFont,
}: {
  theme: ThemePref;
  onSetTheme: (theme: ThemePref) => void;
  readingMode: ReadingMode;
  onSetReadingMode: (mode: ReadingMode) => void;
  readingFont: ReadingFont;
  onSetReadingFont: (font: ReadingFont) => void;
}) {
  return (
    <div className="space-y-12">
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Reader theme</h2>
          <p className="text-sm text-muted-foreground">
            Choose the background that&apos;s most comfortable for extended reading. Text, links,
            tables, borders and selection all adapt automatically with WCAG-compliant contrast.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {READER_THEME_META.map((t) => {
            const active = theme === t.id;
            return (
              <button
                key={t.id}
                onClick={() => onSetTheme(t.id)}
                aria-pressed={active}
                className={`group relative overflow-hidden rounded-xl border text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
                  active ? "border-primary ring-2 ring-primary/40" : "border-border"
                }`}
              >
                {/* Mini reading preview rendered in the theme's own colors. */}
                <div className="p-4" style={{ backgroundColor: t.bg, color: t.fg }}>
                  <div
                    className="text-sm font-semibold"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    Aa — Reading
                  </div>
                  <div
                    className="mt-1 text-xs leading-snug"
                    style={{ fontFamily: "var(--font-body)" }}
                  >
                    The quick brown fox jumps over the lazy dog.
                  </div>
                  <div className="mt-2 flex items-center gap-1.5">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: t.accent }}
                    />
                    <span className="text-xs" style={{ color: t.muted }}>
                      link · secondary
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-border bg-card px-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">{t.label}</div>
                    <div className="truncate text-xs text-muted-foreground">{t.hint}</div>
                  </div>
                  {active && (
                    <span className="ml-2 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="h-3 w-3" />
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Reading font</h2>
          <p className="text-sm text-muted-foreground">
            The typeface used for document body text and headings.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {READING_FONT_META.map((f) => {
            const active = readingFont === f.id;
            return (
              <button
                key={f.id}
                onClick={() => onSetReadingFont(f.id)}
                aria-pressed={active}
                className={`flex items-center justify-between gap-4 rounded-xl border bg-card p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
                  active ? "border-primary ring-2 ring-primary/40" : "border-border"
                }`}
              >
                <div className="min-w-0">
                  <div
                    className="truncate text-2xl leading-tight text-foreground"
                    style={{ fontFamily: f.family }}
                  >
                    Ag
                  </div>
                  <div className="mt-1 text-sm font-medium text-foreground">{f.label}</div>
                  <div className="truncate text-xs text-muted-foreground">{f.hint}</div>
                </div>
                {active && (
                  <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-3 w-3" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Document layout</h2>
          <p className="text-sm text-muted-foreground">
            Read a document section by section, or all at once on a single page. You can also switch
            from the toolbar while reading.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {READING_MODE_META.map((m) => {
            const active = readingMode === m.id;
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                onClick={() => onSetReadingMode(m.id)}
                aria-pressed={active}
                className={`flex items-center gap-3 rounded-xl border bg-card p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
                  active ? "border-primary ring-2 ring-primary/40" : "border-border"
                }`}
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-foreground">{m.label}</div>
                  <div className="text-xs text-muted-foreground">{m.hint}</div>
                </div>
                {active && (
                  <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-3 w-3" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function WorkspaceSettings({
  workspaces,
  currentWorkspaceId,
  onRename,
  onDelete,
  onOpenWorkspace,
}: {
  workspaces: { id: string; name: string }[];
  currentWorkspaceId: string | null;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onOpenWorkspace: (id: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Workspaces</h2>
        <p className="text-sm text-muted-foreground">Manage all your workspaces.</p>
      </div>

      <div className="space-y-4">
        {workspaces.map((ws) => (
          <WorkspaceItemRow
            key={ws.id}
            workspace={ws}
            isCurrent={ws.id === currentWorkspaceId}
            onRename={onRename}
            onDelete={onDelete}
            onOpen={onOpenWorkspace}
            canDelete={workspaces.length > 1}
          />
        ))}
      </div>
    </div>
  );
}

function WorkspaceItemRow({ workspace, isCurrent, onRename, onDelete, onOpen, canDelete }: any) {
  const [renameValue, setRenameValue] = useState(workspace.name);
  const isDirty = renameValue.trim() !== workspace.name;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Folder className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground">
            {workspace.name}{" "}
            {isCurrent && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">(Current)</span>
            )}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {!isCurrent && (
            <button
              onClick={() => onOpen(workspace.id)}
              className="rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
            >
              Open
            </button>
          )}
          <button
            onClick={() => {
              if (window.confirm(`Delete workspace "${workspace.name}"?`)) {
                onDelete(workspace.id);
              }
            }}
            disabled={isCurrent || !canDelete}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-30 transition-colors"
            title={
              isCurrent
                ? "Cannot delete the active workspace"
                : !canDelete
                  ? "Cannot delete your only workspace"
                  : "Delete workspace"
            }
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex gap-3">
        <input
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10"
          placeholder="Rename workspace"
        />
        <button
          onClick={() => {
            if (renameValue.trim()) onRename(workspace.id, renameValue.trim());
          }}
          disabled={!isDirty || !renameValue.trim()}
          className="rounded-md bg-foreground px-4 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </div>
  );
}

function StorageSettings({ onClearStorage }: { onClearStorage: () => void }) {
  const [usage, setUsage] = useState<number | null>(null);
  const [quota, setQuota] = useState<number | null>(null);

  useEffect(() => {
    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then((estimate) => {
        setUsage(estimate.usage || 0);
        setQuota(estimate.quota || 0);
      });
    }
  }, []);

  const cap = quota != null ? Math.floor(quota * STORAGE_QUOTA_FRACTION) : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Local Storage</h2>
        <p className="text-sm text-muted-foreground">Manage your browser's local storage data.</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h3 className="text-sm font-medium text-foreground">Storage Usage</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {usage !== null && quota !== null ? (
            <>
              Using <strong className="text-foreground">{formatBytes(usage)}</strong> of available{" "}
              <strong className="text-foreground">{formatBytes(quota / 20)}</strong>
            </>
          ) : (
            "Calculating..."
          )}
        </p>
      </div>

      <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 shadow-sm">
        <div className="flex flex-col items-start gap-4 sm:flex-row">
          <div className="rounded-full bg-destructive/10 p-2 text-destructive shrink-0">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-destructive">Clear All Storage</h3>
            <p className="mt-1 text-sm text-destructive/80">
              This will permanently delete all workspaces, files, highlights, bookmarks, and
              preferences from this browser. This action cannot be undone.
            </p>
            <button
              onClick={() => {
                if (
                  window.confirm(
                    "Are you absolutely sure you want to clear ALL data on this device?",
                  )
                ) {
                  onClearStorage();
                }
              }}
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground transition-opacity hover:opacity-90"
            >
              <Trash2 className="h-4 w-4" />
              Clear Everything
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SavedSettings({
  saved,
  onOpen,
  onRemove,
  onClearAll,
}: {
  saved: SavedEntry[];
  onOpen: (item: SavedItem) => void;
  onRemove: (id: string) => void;
  onClearAll: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Saved</h2>
          <p className="text-sm text-muted-foreground">
            Documents, sections, tables, code blocks and quotes you starred.
          </p>
        </div>
        {saved.length > 0 && (
          <button
            onClick={() => {
              if (window.confirm("Clear all saved items?")) onClearAll();
            }}
            className="text-sm font-medium text-destructive hover:underline"
          >
            Clear All
          </button>
        )}
      </div>

      {saved.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          You haven't saved anything yet.
        </div>
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border bg-card shadow-sm">
          {saved.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-accent/50"
            >
              <button
                onClick={() => onOpen(item)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
                title={item.text || item.title}
              >
                <div className="shrink-0 rounded bg-primary/10 p-1.5 text-primary">
                  <Star className="h-4 w-4 fill-gold text-gold" />
                </div>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-foreground transition-colors hover:text-primary">
                    {item.title}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {savedTypeLabel(item)} · {item.fileName}
                    {item.orphaned ? " · no longer in the document" : ""}
                  </span>
                </span>
              </button>
              <button
                onClick={() => onRemove(item.id)}
                className="shrink-0 rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                aria-label="Remove saved item"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HighlightSettings({
  highlights,
  files,
  onRemove,
  onClearAll,
  onNavigate,
}: {
  highlights: Highlight[];
  files: MdFile[];
  onRemove: (id: string) => void;
  onClearAll: () => void;
  onNavigate: (fileId: string, subtopicId?: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Highlights</h2>
          <p className="text-sm text-muted-foreground">Manage your text highlights and notes.</p>
        </div>
        {highlights.length > 0 && (
          <button
            onClick={() => {
              if (window.confirm("Clear all highlights?")) onClearAll();
            }}
            className="text-sm font-medium text-destructive hover:underline"
          >
            Clear All
          </button>
        )}
      </div>

      {highlights.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          You haven't made any highlights yet.
        </div>
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border bg-card shadow-sm">
          {highlights.map((h) => {
            const file = files.find((f) => f.id === h.fileId);
            return (
              <div key={h.id} className="group p-4 transition-colors hover:bg-accent/50">
                <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
                  <div className="min-w-0 flex-1 w-full">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: h.color }} />
                      <span className="text-xs font-medium text-muted-foreground truncate">
                        {file?.name.replace(/\.(md|markdown|mdx|txt)$/i, "") || "Unknown file"}
                      </span>
                    </div>
                    <blockquote className="border-l-2 border-border pl-3 text-sm italic text-foreground/80 mb-2">
                      "{h.text}"
                    </blockquote>
                    {h.label && (
                      <div className="inline-block rounded-md bg-accent px-2 py-1 text-xs font-medium text-foreground">
                        {h.label}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-100 sm:opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => onNavigate(h.fileId, h.subtopicId)}
                      className="rounded-md p-2 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                      title="Go to highlight"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onRemove(h.id)}
                      className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      title="Remove highlight"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ArchiveSettings({
  files,
  onUnarchive,
}: {
  files: MdFile[];
  onUnarchive: (id: string) => void;
}) {
  const archivedFiles = files.filter((f) => f.isArchived);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Archived Files</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Files that have been archived are hidden from the sidebar but can still be unarchived or
          used as embedded resources.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {archivedFiles.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center shadow-sm">
            <Archive className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
            <h3 className="font-semibold text-foreground">No archived files</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Files you archive will appear here.
            </p>
          </div>
        ) : (
          archivedFiles.map((file) => (
            <div
              key={file.id}
              className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 shadow-sm"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <Archive className="h-5 w-5 text-primary" strokeWidth={1.5} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold text-foreground">{file.name}</h3>
                  <p className="truncate text-xs text-muted-foreground">Archived Document</p>
                </div>
              </div>
              <button
                onClick={() => onUnarchive(file.id)}
                className="flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary active:scale-95"
                title="Unarchive file"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Unarchive
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
