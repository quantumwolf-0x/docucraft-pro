import { useEffect, useRef, useState } from "react";
import { ChevronDown, PlusCircle, Download, Upload, Trash2, Check, FolderOpen, Users, Layers } from "lucide-react";

interface WorkspaceLite {
  id: string;
  name: string;
  docCount?: number;
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
  /** "pill" = compact header trigger; "sidebar" = full-width logo + name + doc count. */
  variant?: "pill" | "sidebar";
  /** Number of docs in the current workspace — shown by the sidebar variant. */
  docCount?: number;
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
  variant = "pill",
  docCount = 0,
}: Props) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
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

  const sidebar = variant === "sidebar";

  return (
    <div ref={rootRef} className={`relative ${sidebar ? "min-w-0 flex-1 z-50" : ""}`}>
      {sidebar ? (
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center rounded-lg px-2 py-1.5 text-left bg-background transition-colors hover:bg-accent"
          title="Workspaces"
        >
          <span className="min-w-0">
            <span className="flex min-w-0 items-center gap-1">
              <span className="truncate text-sm font-semibold text-foreground">
                {current?.name ?? "Workspace"}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground opacity-70" />
            </span>
          </span>
        </button>
      ) : (
        <button
          onClick={() => setOpen((o) => !o)}
          className="inline-flex h-8 max-w-[180px] items-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          title="Workspaces"
        >
          <FolderOpen className="h-4 w-4 shrink-0" />
          <span className="truncate">{current?.name ?? "Workspace"}</span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
        </button>
      )}

      {open && (
        <div
          className={`absolute top-full z-50 mt-1.5 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl ${
            sidebar ? "left-0 w-[280px]" : "right-0 w-[280px]"
          }`}
        >
          <div className="max-h-[70vh] overflow-y-auto p-2">
            {current && (
              <div className="group relative mb-2 flex items-center justify-between rounded-xl bg-accent p-2 transition-colors hover:bg-accent/80">
                <button
                  onClick={() => setOpen(false)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-background">
                    <Layers className="h-4 w-4 text-foreground" strokeWidth={1.5} />
                  </div>
                  <div className="flex flex-col items-start min-w-0">
                    <span className="truncate text-sm font-medium text-foreground">
                      {current.name}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {current.docCount ?? 0} docs
                    </span>
                  </div>
                </button>
                <Check className="mr-2 h-4 w-4 shrink-0 text-foreground" />
              </div>
            )}

            {workspaces.length > 1 && (
              <div className="flex flex-col gap-0.5">
                  {workspaces
                    .filter((w) => w.id !== currentId)
                    .map((w) => (
                      <div
                        key={w.id}
                        className="group relative flex items-center rounded-xl p-2 transition-colors hover:bg-accent"
                      >
                        <button
                          onClick={() => {
                            onSwitch(w.id);
                            setOpen(false);
                          }}
                          className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]">
                            <FolderOpen className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                          </div>
                          <div className="flex flex-col items-start min-w-0">
                            <span className="truncate text-sm font-medium text-foreground">
                              {w.name}
                            </span>
                            <span className="truncate text-xs text-muted-foreground">
                              {w.docCount ?? 0} docs
                            </span>
                          </div>
                        </button>
                      </div>
                    ))}
              </div>
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

          <div className="flex border-t border-border bg-muted/50">
            {!creating && (
              <>
                <ActionButton
                  icon={PlusCircle}
                  label="New"
                  onClick={() => {
                    setCreating(true);
                    setNewName("");
                  }}
                />
              </>
            )}
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
          </div>
        </div>
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
