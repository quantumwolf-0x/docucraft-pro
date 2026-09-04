import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronDown,
  PlusCircle,
  Download,
  Upload,
  Check,
  FolderOpen,
  Users,
  Settings,
} from "lucide-react";

interface WorkspaceLite {
  id: string;
  name: string;
}

interface Props {
  workspaces: WorkspaceLite[];
  currentId: string | null;
  onSwitch: (id: string) => void;
  onNew: (name: string) => void;
  onDelete: (id: string) => void;
  onImport: (file: File) => void;
  onExport: () => void;
  onShare: () => void;
  /** "pill" = compact header trigger; "sidebar" = full-width name. */
  variant?: "pill" | "sidebar";
  /** Callback to open settings (typically rendered in sidebar) */
  onSettings?: () => void;
}

export function WorkspaceMenu({
  workspaces,
  currentId,
  onSwitch,
  onNew,
  onDelete,
  onImport,
  onExport,
  onShare,
  onSettings,
  variant = "pill",
}: Props) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const sidebar = variant === "sidebar";

  // The menu is portaled to <body> so it escapes every header/content stacking
  // context and can never be painted under a document panel. Because it lives
  // outside the normal flow, we position it manually from the trigger's rect
  // and keep it pinned as the page scrolls or resizes.
  const MENU_W = 280;
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const el = rootRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const desired = sidebar ? r.left : r.right - MENU_W; // sidebar left-aligns, pill right-aligns
      const left = Math.min(Math.max(8, desired), window.innerWidth - MENU_W - 8);

      if (sidebar) {
        // Pop upwards in the sidebar since it's at the bottom
        const bottom = window.innerHeight - r.top + 6;
        setPos({ bottom, left });
      } else {
        setPos({ top: r.bottom + 6, left });
      }
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, sidebar]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Reset the inline create field whenever the menu closes.
  useEffect(() => {
    if (!open) {
      setCreating(false);
      setNewName("");
    }
  }, [open]);

  const current = workspaces.find((w) => w.id === currentId);

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    onNew(name);
    setCreating(false);
    setNewName("");
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={`relative ${sidebar ? "min-w-0 flex-1 z-(--z-dropdown)" : ""}`}>
      {sidebar ? (
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
          title="Workspaces"
        >
          <FolderOpen className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">{current?.name ?? "Localdox"}</span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />
        </button>
      ) : (
        <button
          onClick={() => setOpen((o) => !o)}
          className="inline-flex h-8 max-w-xs items-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          title="Workspaces"
        >
          <FolderOpen className="h-4 w-4 shrink-0" />
          <span className="truncate">{current?.name ?? "Workspace"}</span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
        </button>
      )}

      {open &&
        pos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: "fixed",
              top: pos.top,
              bottom: pos.bottom,
              left: pos.left,
              width: MENU_W,
            }}
            className="z-(--z-dropdown) overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl"
          >
            <div className="max-h-[70vh] overflow-y-auto p-2">
              {current && (
                <div className="group relative mb-1 flex items-center justify-between rounded-xl bg-accent px-3 py-2 transition-colors hover:bg-accent/80">
                  <button
                    onClick={() => setOpen(false)}
                    className="min-w-0 flex-1 truncate text-left text-sm font-medium text-foreground"
                  >
                    {current.name}
                  </button>
                  <Check className="ml-2 h-4 w-4 shrink-0 text-foreground" />
                </div>
              )}

              {workspaces.length > 1 && (
                <div className="flex flex-col gap-0.5">
                  {workspaces
                    .filter((w) => w.id !== currentId)
                    .map((w) => (
                      <button
                        key={w.id}
                        onClick={() => {
                          onSwitch(w.id);
                          setOpen(false);
                        }}
                        className="truncate rounded-xl px-3 py-2 text-left text-sm font-medium text-foreground transition-colors hover:bg-accent"
                      >
                        {w.name}
                      </button>
                    ))}
                </div>
              )}

              {/* Creating a workspace is the same kind of act as switching to
                  one, so it sits in the list rather than only in the footer
                  strip, where it read as a tool rather than a destination. */}
              {!creating && (
                <button
                  onClick={() => {
                    setCreating(true);
                    setNewName("");
                  }}
                  className="mt-0.5 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <PlusCircle className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                  New workspace
                </button>
              )}
            </div>

            {creating && (
              <div className="border-t border-border p-2">
                <div className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1">
                  <input
                    autoFocus
                    type="text"
                    placeholder="Workspace name..."
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreate();
                      if (e.key === "Escape") {
                        setCreating(false);
                        setNewName("");
                      }
                    }}
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  />
                  <button
                    onClick={handleCreate}
                    disabled={!newName.trim()}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Save
                  </button>
                </div>
              </div>
            )}

            {/* New workspace lives in the list above, beside the workspaces it
                would join; this strip is for what you do *to* a workspace. */}
            <div className="flex border-t border-border bg-muted/50">
              <ActionButton icon={Upload} label="Import" onClick={() => fileRef.current?.click()} />
              <ActionButton
                icon={Download}
                label="Export"
                onClick={() => {
                  onExport();
                  setOpen(false);
                }}
              />
              <ActionButton
                icon={Users}
                label="Share"
                onClick={() => {
                  onShare();
                  setOpen(false);
                }}
              />
              {onSettings && (
                <ActionButton
                  icon={Settings}
                  label="Settings"
                  onClick={() => {
                    onSettings();
                    setOpen(false);
                  }}
                />
              )}
            </div>
          </div>,
          document.body,
        )}

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            onImport(f);
            setOpen(false);
          }
          e.target.value = "";
        }}
      />
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: any;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-1 flex-col items-center justify-center gap-1.5 py-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      <Icon className="h-4 w-4" strokeWidth={1.5} />
      {label}
    </button>
  );
}
