import { useEffect, useRef, useState } from "react";
import { ChevronDown, Plus, Download, Upload, Trash2, Check, FolderOpen, Share } from "lucide-react";

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

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-8 max-w-[180px] items-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        title="Workspaces"
      >
        <FolderOpen className="h-4 w-4 shrink-0" />
        <span className="truncate">{current?.name ?? "Workspace"}</span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-64 overflow-hidden rounded-lg border border-border bg-popover shadow-xl">
          <div className="max-h-56 overflow-y-auto p-1">
            {workspaces.map((w) => (
              <div
                key={w.id}
                className="group flex items-center gap-1 rounded-md hover:bg-accent"
              >
                <button
                  onClick={() => {
                    onSwitch(w.id);
                    setOpen(false);
                  }}
                  className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left text-sm"
                >
                  <Check
                    className={`h-3.5 w-3.5 shrink-0 ${w.id === currentId ? "text-primary" : "opacity-0"}`}
                  />
                  <span className="truncate">{w.name}</span>
                </button>
                {workspaces.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(w.id);
                    }}
                    className="mr-1 rounded p-1 opacity-0 transition-opacity group-hover:opacity-100"
                    aria-label={`Delete ${w.name}`}
                    title="Delete workspace"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                  </button>
                )}
              </div>
            ))}
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

          <div className="grid grid-cols-4 gap-1 border-t border-border p-1">
            {!creating && (
              <ActionButton
                icon={Plus}
                label="New"
                onClick={() => {
                  setCreating(true);
                  setNewName("");
                }}
              />
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
              icon={Share}
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
  icon: typeof Plus;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 rounded-md px-1 py-2 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
