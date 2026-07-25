import { useState } from "react";
import { FolderOpen, Plus, Upload, Download, Share, CheckCircle2, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

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

/**
 * Mobile / portrait-tablet workspace control: an icon in the header that opens
 * a bottom sheet with the workspace picker plus management actions (new,
 * import, export, share, delete). Desktop/landscape use WorkspaceMenu instead.
 */
export function WorkspaceSheet({
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
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const current = workspaces.find((workspace) => workspace.id === currentId);

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    onNew(name);
    setIsCreating(false);
    setNewName("");
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-8 items-center justify-center rounded-md border border-border bg-background px-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        title="Workspaces"
        aria-label="Workspaces"
      >
        <FolderOpen className="h-4 w-4 shrink-0" />
      </button>

      <Sheet
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setIsCreating(false);
            setNewName("");
          }
        }}
      >
        <SheetContent
          side="bottom"
          className="max-h-[78dvh] rounded-t-3xl px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-8 lg:hidden md:landscape:hidden"
        >
          <SheetHeader className="text-left">
            <SheetTitle>Your workspaces</SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-2 overflow-y-auto pb-2">
            {workspaces.map((workspace) => {
              const isCurrent = workspace.id === currentId;
              return (
                <div
                  key={workspace.id}
                  className={`group flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition-colors ${
                    isCurrent
                      ? "border-primary/40 bg-primary/5"
                      : "border-border bg-card hover:border-primary/40 hover:bg-accent"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      onSwitch(workspace.id);
                    }}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-none"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background">
                      {workspace.name.trim().charAt(0).toUpperCase() || "W"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">
                        {workspace.name}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {isCurrent ? "Current workspace" : "Open workspace"}
                      </span>
                    </span>
                  </button>
                  {isCurrent ? (
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary" aria-label="Current" />
                  ) : (
                    <button
                      type="button"
                      onClick={() => onDelete(workspace.id)}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
                      aria-label={`Delete ${workspace.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            })}

            {isCreating ? (
              <div className="flex w-full items-center gap-2 rounded-xl border border-primary/50 bg-primary/5 p-2">
                <input
                  type="text"
                  autoFocus
                  placeholder="Workspace name..."
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreate();
                    if (e.key === "Escape") {
                      setIsCreating(false);
                      setNewName("");
                    }
                  }}
                  className="flex-1 bg-transparent px-2 text-sm font-semibold text-foreground outline-none placeholder:font-normal"
                />
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={!newName.trim()}
                  className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
                  aria-label="Confirm new workspace"
                >
                  <CheckCircle2 className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsCreating(true)}
                className="flex w-full items-center gap-3 rounded-xl border border-dashed border-primary/45 px-4 py-3.5 text-left text-sm font-semibold text-primary transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Plus className="h-5 w-5" />
                </span>
                Create workspace
              </button>
            )}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = "application/json,.json";
                  input.onchange = (e) => {
                    const f = (e.target as HTMLInputElement).files?.[0];
                    if (f) onImport(f);
                    setOpen(false);
                  };
                  input.click();
                }}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Upload className="h-4 w-4" />
                Import
              </button>
              <button
                type="button"
                onClick={() => {
                  onExport();
                  setOpen(false);
                }}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Download className="h-4 w-4" />
                Export
              </button>
              <button
                type="button"
                onClick={() => {
                  onShare();
                  setOpen(false);
                }}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Share className="h-4 w-4" />
                Share
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
