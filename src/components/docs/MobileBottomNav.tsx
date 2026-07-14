import { useState } from "react";
import { Bookmark, FolderOpen, Home, Plus, Settings, Upload, CheckCircle2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

interface WorkspaceItem {
  id: string;
  name: string;
}

interface BookmarkItem {
  fileId: string;
  subtopicId: string;
  name: string;
}

interface Props {
  workspaces: WorkspaceItem[];
  currentWorkspaceId: string | null;
  bookmarks: BookmarkItem[];
  settingsOpen: boolean;
  onHome: () => void;
  onOpenSettings: () => void;
  onUpload: () => void;
  onOpenBookmark: (fileId: string, subtopicId: string) => void;
  onOpenWorkspace: (workspaceId: string) => void;
  onNewWorkspace: () => void;
  isHome?: boolean;
}

export function MobileBottomNav({
  workspaces,
  currentWorkspaceId,
  bookmarks,
  settingsOpen,
  onHome,
  onOpenSettings,
  onUpload,
  onOpenBookmark,
  onOpenWorkspace,
  onNewWorkspace,
  isHome = false,
}: Props) {
  const [bookmarksOpen, setBookmarksOpen] = useState(false);
  const [workspacesOpen, setWorkspacesOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const handleCreate = () => {
    if (newName.trim()) {
      // We pass the new name up
      onNewWorkspace(newName.trim());
      setIsCreating(false);
      setNewName("");
      setWorkspacesOpen(false);
    }
  };
  const currentWorkspace = workspaces.find((workspace) => workspace.id === currentWorkspaceId);

  return (
    <>
      <nav
        aria-label="Primary navigation"
        className="fixed inset-x-0 bottom-0 z-40 flex h-16 w-full items-center justify-around border-t border-border bg-background/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden md:landscape:hidden"
      >
        <DockButton icon={Home} label="Home" onClick={onHome} active={isHome && !settingsOpen && !bookmarksOpen && !workspacesOpen} />
        <DockButton icon={Bookmark} label="Bookmarks" onClick={() => setBookmarksOpen(true)} active={bookmarksOpen} />

        <DockButton icon={Plus} label="Add" onClick={onUpload} />

        <DockButton icon={Settings} label="Settings" onClick={onOpenSettings} active={settingsOpen} />
        <DockButton icon={FolderOpen} label="Workspace" onClick={() => setWorkspacesOpen(true)} active={workspacesOpen} />
      </nav>

      <Sheet open={bookmarksOpen} onOpenChange={setBookmarksOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[85dvh] rounded-t-3xl px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-8 lg:hidden md:landscape:hidden"
        >
          <SheetHeader className="text-left">
            <SheetTitle>Bookmarks</SheetTitle>
          </SheetHeader>
          <div className="mt-6 flex flex-col gap-3 overflow-y-auto pb-4">
            {bookmarks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No bookmarks yet.</p>
            ) : (
              bookmarks.map((bm) => (
                <div key={`${bm.fileId}-${bm.subtopicId}`} className="group flex items-center justify-between rounded-xl border p-4 transition-colors hover:border-primary/40">
                  <button
                    onClick={() => {
                      onOpenBookmark(bm.fileId, bm.subtopicId);
                      setBookmarksOpen(false);
                    }}
                    className="flex-1 text-left text-sm font-medium hover:underline"
                  >
                    {bm.name}
                  </button>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={workspacesOpen} onOpenChange={(open) => {
        setWorkspacesOpen(open);
        if (!open) {
          setIsCreating(false);
          setNewName("");
        }
      }}>
        <SheetContent
          side="bottom"
          className="max-h-[78dvh] rounded-t-3xl px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-8 lg:hidden md:landscape:hidden"
        >
          <SheetHeader className="text-left">
            <SheetTitle>Your workspaces</SheetTitle>
            <p className="text-sm text-muted-foreground">
              {currentWorkspace
                ? `Currently in ${currentWorkspace.name}.`
                : "Choose where to work."}
            </p>
          </SheetHeader>
          <div className="mt-6 space-y-2 overflow-y-auto pb-2">
            {workspaces.map((workspace) => {
              const current = workspace.id === currentWorkspaceId;
              return (
                <button
                  key={workspace.id}
                  type="button"
                  onClick={() => {
                    setWorkspacesOpen(false);
                    onOpenWorkspace(workspace.id);
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    current
                      ? "border-primary/40 bg-primary/5"
                      : "border-border bg-card hover:border-primary/40 hover:bg-accent"
                  }`}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background">
                    {workspace.name.trim().charAt(0).toUpperCase() || "W"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {workspace.name}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {current ? "Current workspace" : "Open workspace"}
                    </span>
                  </span>
                  {current && (
                    <span className="h-2.5 w-2.5 rounded-full bg-primary" aria-label="Current" />
                  )}
                </button>
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
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function DockButton({
  icon: Icon,
  label,
  onClick,
  active = false,
  badge,
}: {
  icon: typeof Home;
  label: string;
  onClick: () => void;
  active?: boolean;
  badge?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex min-w-12 flex-col items-center gap-1 rounded-xl px-2 py-1 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
        active ? "text-primary" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon className="h-5 w-5" />
      <span>{label}</span>
      {badge && (
        <span className="absolute right-1 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </button>
  );
}
