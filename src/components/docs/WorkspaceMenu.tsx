import { useEffect, useRef, useState } from "react";
import { ChevronDown, Plus, Download, Upload, Trash2, Check, FolderOpen } from "lucide-react";

interface WorkspaceLite {
  id: string;
  name: string;
}

interface Props {
  workspaces: WorkspaceLite[];
  currentId: string | null;
  onSwitch: (id: string) => void;
  onNew: () => void;
  onImport: (file: File) => void;
  onExport: () => void;
  onDelete: (id: string) => void;
}

export function WorkspaceMenu({
  workspaces,
  currentId,
  onSwitch,
  onNew,
  onImport,
  onExport,
  onDelete,
}: Props) {
  const [open, setOpen] = useState(false);
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

  const current = workspaces.find((w) => w.id === currentId);

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex max-w-[180px] items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        title="Workspaces"
      >
        <FolderOpen className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{current?.name ?? "Workspace"}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-64 overflow-hidden rounded-lg border border-border bg-popover shadow-xl">
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
                    onClick={() => onDelete(w.id)}
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

          <div className="border-t border-border p-1">
            <MenuItem
              icon={<Plus className="h-3.5 w-3.5" />}
              label="New workspace"
              onClick={() => {
                onNew();
                setOpen(false);
              }}
            />
            <MenuItem
              icon={<Upload className="h-3.5 w-3.5" />}
              label="Import workspace…"
              onClick={() => fileRef.current?.click()}
            />
            <MenuItem
              icon={<Download className="h-3.5 w-3.5" />}
              label="Export current"
              onClick={() => {
                onExport();
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
          if (f) onImport(f);
          e.target.value = "";
          setOpen(false);
        }}
      />
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      {icon}
      {label}
    </button>
  );
}
