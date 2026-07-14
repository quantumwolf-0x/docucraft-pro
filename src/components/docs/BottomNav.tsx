import { Home, Bookmark, Plus, Settings, FolderOpen, Trash2, CheckCircle2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "../ui/sheet";
import { useState, useRef, useEffect } from "react";

// Assuming we pass in what we need
export function BottomNav({
  workspaces,
  currentWorkspaceId,
  onSwitchWorkspace,
  onNewWorkspace,
  bookmarks,
  onSelectBookmark,
  onRemoveBookmark,
  onHome,
  onUpload,
  onSettings
}: any) {
  const currentWorkspace = workspaces.find((w: any) => w.id === currentWorkspaceId);

  // Workspace Creation State
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [wsSheetOpen, setWsSheetOpen] = useState(false);

  const handleCreate = () => {
    if (newName.trim()) {
      onNewWorkspace(newName.trim());
      setIsCreating(false);
      setNewName("");
      // Don't auto-close the sheet immediately so they see it appear, or close it:
      setWsSheetOpen(false);
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-between border-t border-border bg-background/80 px-6 backdrop-blur-lg lg:hidden">
      
      {/* 1. Home */}
      <button onClick={onHome} className="flex flex-col items-center justify-center gap-1 text-muted-foreground transition-colors hover:text-foreground">
        <Home className="h-5 w-5" />
        <span className="text-[10px] font-medium">Home</span>
      </button>

      {/* 2. Bookmarks (Bottom Sheet) */}
      <Sheet>
        <SheetTrigger asChild>
          <button className="flex flex-col items-center justify-center gap-1 text-muted-foreground transition-colors hover:text-foreground">
            <Bookmark className="h-5 w-5" />
            <span className="text-[10px] font-medium">Bookmarks</span>
          </button>
        </SheetTrigger>
        <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Bookmarks</SheetTitle>
          </SheetHeader>
          <div className="mt-6 flex flex-col gap-3">
            {bookmarks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No bookmarks yet.</p>
            ) : (
              bookmarks.map((bm: any) => (
                <div key={`${bm.fileId}-${bm.subtopicId}`} className="group flex items-center justify-between rounded-lg border p-3">
                  <button
                    onClick={() => onSelectBookmark(bm.fileId, bm.subtopicId)}
                    className="flex-1 text-left text-sm hover:underline"
                  >
                    {bm.name}
                  </button>
                  <button
                    onClick={() => onRemoveBookmark(bm.fileId, bm.subtopicId)}
                    className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity p-2"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* 3. Upload CTA */}
      <button 
        onClick={onUpload}
        className="flex h-12 w-12 -translate-y-4 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* 4. Settings */}
      <button onClick={onSettings} className="flex flex-col items-center justify-center gap-1 text-muted-foreground transition-colors hover:text-foreground">
        <Settings className="h-5 w-5" />
        <span className="text-[10px] font-medium">Settings</span>
      </button>

      {/* 5. Workspace (Bottom Sheet) */}
      <Sheet open={wsSheetOpen} onOpenChange={setWsSheetOpen}>
        <SheetTrigger asChild>
          <button className="flex flex-col items-center justify-center gap-1 text-muted-foreground transition-colors hover:text-foreground">
            <FolderOpen className="h-5 w-5" />
            <span className="text-[10px] font-medium">Workspace</span>
          </button>
        </SheetTrigger>
        <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Workspaces</SheetTitle>
          </SheetHeader>
          <div className="mt-4 flex flex-col gap-2">
            {workspaces.map((ws: any) => (
              <button
                key={ws.id}
                onClick={() => {
                  onSwitchWorkspace(ws.id);
                  setWsSheetOpen(false);
                }}
                className={`flex items-center justify-between rounded-lg p-3 text-sm font-medium transition-colors ${
                  ws.id === currentWorkspaceId
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                {ws.name}
                {ws.id === currentWorkspaceId && <CheckCircle2 className="h-4 w-4 text-primary" />}
              </button>
            ))}
            
            {/* Create inline input */}
            <div className="mt-2">
              {isCreating ? (
                <div className="flex items-center gap-2 rounded-lg border border-border bg-background p-2">
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
                    className="flex-1 bg-transparent px-2 text-sm font-medium outline-none placeholder:font-normal"
                  />
                  <button
                    onClick={handleCreate}
                    disabled={!newName.trim()}
                    className="text-primary hover:text-primary/80 disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-5 w-5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsCreating(true)}
                  className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border p-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                >
                  <Plus className="h-4 w-4" />
                  New Workspace
                </button>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

    </nav>
  );
}
