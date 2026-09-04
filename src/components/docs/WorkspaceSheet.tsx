import { useState } from "react";
import { FolderOpen, Upload, Download, Check, PlusCircle, Users } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";

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

      <BottomSheet
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setIsCreating(false);
            setNewName("");
          }
        }}
        title="Your workspaces"
        className="max-h-[78dvh] lg:hidden md:landscape:hidden"
      >
        <div className="space-y-2 pb-2">
          {(() => {
            const current = workspaces.find((w) => w.id === currentId);
            return (
              <>
                {current && (
                  <div className="group relative mb-1 flex items-center justify-between rounded-xl bg-accent px-3 py-2.5 transition-colors hover:bg-accent/80">
                    <button
                      onClick={() => {
                        setOpen(false);
                        onSwitch(current.id);
                      }}
                      className="min-w-0 flex-1 truncate text-left text-sm font-medium text-foreground focus-visible:outline-none"
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
                          className="truncate rounded-xl px-3 py-2.5 text-left text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none"
                        >
                          {w.name}
                        </button>
                      ))}
                  </div>
                )}

                {/* Creating a workspace belongs beside the workspaces it would
                    join, not only in the action strip below. */}
                {!isCreating && (
                  <button
                    onClick={() => {
                      setIsCreating(true);
                      setNewName("");
                    }}
                    className="mt-0.5 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none"
                  >
                    <PlusCircle className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                    New workspace
                  </button>
                )}
              </>
            );
          })()}

          {isCreating && (
            <div className="border-t border-border pt-4">
              <div className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1">
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
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
                <button
                  type="button"
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

          {/* New workspace lives in the list above; this strip is for what you
              do *to* a workspace. */}
          <div className="flex border-t border-border bg-muted/50 mt-4 rounded-xl overflow-hidden">
            <ActionButton
              icon={Upload}
              label="Import"
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
            />
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
      </BottomSheet>
    </>
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
