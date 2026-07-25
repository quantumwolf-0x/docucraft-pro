import { useState } from "react";
import { FolderOpen, Plus, Upload, Download, Share, CheckCircle2, Trash2, Layers, Check, PlusCircle, Users } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

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
            {(() => {
              const current = workspaces.find((w) => w.id === currentId);
              return (
                <>
                  {current && (
                    <div className="group relative mb-2 flex items-center justify-between rounded-xl bg-accent p-2 transition-colors hover:bg-accent/80">
                      <button
                        onClick={() => {
                          setOpen(false);
                          onSwitch(current.id);
                        }}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-none"
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
                              className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-none"
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

            <div className="flex border-t border-border bg-muted/50 mt-4 rounded-xl overflow-hidden">
              {!isCreating && (
                <>
                  <ActionButton
                    icon={PlusCircle}
                    label="New"
                    onClick={() => {
                      setIsCreating(true);
                      setNewName("");
                    }}
                  />
                </>
              )}
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
        </SheetContent>
      </Sheet>
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
