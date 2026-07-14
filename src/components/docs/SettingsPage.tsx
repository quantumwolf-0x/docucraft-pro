import { useState, useEffect } from "react";
import { Trash2, AlertTriangle, Bookmark, Highlighter, Folder, Database, ArrowRight, Palette, Sun, Moon, Monitor, ArrowLeft } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { Highlight } from "@/lib/dom-highlighter";
import type { MdFile } from "@/lib/markdown-utils";

export interface SettingsPageProps {
  theme: "light" | "dark" | "system";
  onThemeChange: (theme: "light" | "dark" | "system") => void;
  workspaces: { id: string; name: string }[];
  currentWorkspaceId: string | null;
  onRenameWorkspace: (id: string, name: string) => void;
  onDeleteWorkspace: (id: string) => void;
  onClearStorage: () => void;
  bookmarks: { fileId: string; subtopicId: string; name: string }[];
  onRemoveBookmark: (fileId: string, subtopicId: string) => void;
  onClearBookmarks: () => void;
  highlights: Highlight[];
  onRemoveHighlight: (id: string) => void;
  onClearHighlights: () => void;
  onNavigate: (fileId: string, subtopicId?: string) => void;
  files: MdFile[];
  onOpenWorkspace: (id: string) => void;
}

export function SettingsPage({
  theme,
  onThemeChange,
  workspaces,
  currentWorkspaceId,
  onRenameWorkspace,
  onDeleteWorkspace,
  onClearStorage,
  bookmarks,
  onRemoveBookmark,
  onClearBookmarks,
  highlights,
  onRemoveHighlight,
  onClearHighlights,
  onNavigate,
  files,
  onOpenWorkspace,
}: SettingsPageProps) {
  const [activeTab, setActiveTab] = useState<"theme" | "workspace" | "storage">("theme");

  const tabs = [
    { id: "theme", label: "Theme", icon: Palette },
    { id: "workspace", label: "Workspace", icon: Folder },
    { id: "storage", label: "Storage", icon: Database },
  ] as const;

  return (
    <div className="mx-auto w-full max-w-4xl p-6 md:p-10">
      <div className="mb-8 flex items-center gap-4">
        <Link 
          to="/"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Go back home"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your workspaces, data, and preferences.</p>
        </div>
      </div>

      <div className="flex flex-col gap-8">
        <nav className="grid grid-cols-5 gap-2 overflow-x-auto pb-2 scrollbar-hide sm:flex sm:flex-row">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center justify-center gap-1.5 rounded-lg p-2.5 transition-colors sm:min-w-[80px] ${
                  active 
                    ? "bg-primary/10 text-primary font-semibold" 
                    : "text-muted-foreground hover:bg-accent hover:text-foreground font-medium"
                }`}
                title={tab.label}
                aria-label={tab.label}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="text-[10px] leading-none tracking-wide">
                  {tab.label}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="min-w-0">
          {activeTab === "theme" && (
            <AppearanceSettings theme={theme} onThemeChange={onThemeChange} />
          )}
          {activeTab === "workspace" && (
            <div className="flex flex-col gap-12">
              <WorkspaceSettings
                workspaces={workspaces}
                currentWorkspaceId={currentWorkspaceId}
                onRename={onRenameWorkspace}
                onDelete={onDeleteWorkspace}
                onOpenWorkspace={onOpenWorkspace}
              />
              <BookmarkSettings
                bookmarks={bookmarks}
                onRemove={onRemoveBookmark}
                onClearAll={onClearBookmarks}
                onNavigate={onNavigate}
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
          {activeTab === "storage" && (
            <StorageSettings onClearStorage={onClearStorage} />
          )}
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
            {workspace.name} {isCurrent && <span className="ml-2 text-xs font-normal text-muted-foreground">(Current)</span>}
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
            title={isCurrent ? "Cannot delete the active workspace" : (!canDelete ? "Cannot delete your only workspace" : "Delete workspace")}
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

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

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
              Using <strong className="text-foreground">{formatBytes(usage)}</strong> of available <strong className="text-foreground">{formatBytes(quota)}</strong>
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
              This will permanently delete all workspaces, files, highlights, bookmarks, and preferences from this browser. This action cannot be undone.
            </p>
            <button
              onClick={() => {
                if (window.confirm("Are you absolutely sure you want to clear ALL data on this device?")) {
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

function BookmarkSettings({
  bookmarks,
  onRemove,
  onClearAll,
  onNavigate,
}: {
  bookmarks: { fileId: string; subtopicId: string; name: string }[];
  onRemove: (fileId: string, subtopicId: string) => void;
  onClearAll: () => void;
  onNavigate: (fileId: string, subtopicId?: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Bookmarks</h2>
          <p className="text-sm text-muted-foreground">Manage your saved chapters and topics.</p>
        </div>
        {bookmarks.length > 0 && (
          <button
            onClick={() => {
              if (window.confirm("Clear all bookmarks?")) onClearAll();
            }}
            className="text-sm font-medium text-destructive hover:underline"
          >
            Clear All
          </button>
        )}
      </div>

      {bookmarks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          You haven't added any bookmarks yet.
        </div>
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border bg-card shadow-sm">
          {bookmarks.map((b) => (
            <div key={`${b.fileId}-${b.subtopicId}`} className="flex items-center justify-between p-4 transition-colors hover:bg-accent/50">
              <button
                onClick={() => onNavigate(b.fileId, b.subtopicId)}
                className="flex items-center gap-3 text-left"
              >
                <div className="rounded bg-primary/10 p-1.5 text-primary">
                  <Bookmark className="h-4 w-4" />
                </div>
                <span className="text-sm font-medium text-foreground hover:text-primary transition-colors">
                  {b.name}
                </span>
              </button>
              <button
                onClick={() => onRemove(b.fileId, b.subtopicId)}
                className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                aria-label="Remove bookmark"
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
            const file = files.find(f => f.id === h.fileId);
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

function AppearanceSettings({ theme, onThemeChange }: { theme: "light" | "dark" | "system"; onThemeChange: (theme: "light" | "dark" | "system") => void }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Appearance</h2>
        <p className="text-sm text-muted-foreground">Customize the look and feel of the application.</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h3 className="text-sm font-medium text-foreground">Theme</h3>
        <p className="mb-4 mt-1 text-sm text-muted-foreground">Select your preferred color theme.</p>
        
        <div className="flex flex-col gap-4 sm:flex-row">
          <button
            onClick={() => onThemeChange("light")}
            className={`flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border-2 p-4 transition-all hover:bg-accent ${theme === "light" ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground"}`}
          >
            <Sun className="h-6 w-6" />
            <span className="text-sm font-medium">Light</span>
          </button>
          
          <button
            onClick={() => onThemeChange("dark")}
            className={`flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border-2 p-4 transition-all hover:bg-accent ${theme === "dark" ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground"}`}
          >
            <Moon className="h-6 w-6" />
            <span className="text-sm font-medium">Dark</span>
          </button>

          <button
            onClick={() => onThemeChange("system")}
            className={`flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border-2 p-4 transition-all hover:bg-accent ${theme === "system" ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground"}`}
          >
            <Monitor className="h-6 w-6" />
            <span className="text-sm font-medium">System</span>
          </button>
        </div>
      </div>
    </div>
  );
}
