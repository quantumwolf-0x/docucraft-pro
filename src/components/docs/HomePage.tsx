import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Clock, FileText, FolderOpen, Upload } from "lucide-react";

export interface WorkspaceFileItem {
  id: string;
  name: string;
  minutes: number;
}

export interface WorkspaceItem {
  id: string;
  name: string;
  current: boolean;
}

interface Props {
  userName: string | null;
  onSubmitName: (name: string) => void;
  files: WorkspaceFileItem[];
  workspaces: WorkspaceItem[];
  onOpenFile: (fileId: string, subtopicId?: string) => void;
  onOpenWorkspace: (workspaceId: string) => void;
  onUpload: () => void;
  onFilesDrop?: (files: FileList) => void;
}

const stripExt = (name: string) => name.replace(/\.(md|markdown|mdx|txt)$/i, "");

export function HomePage({
  userName,
  onSubmitName,
  files,
  workspaces,
  onOpenFile,
  onOpenWorkspace,
  onUpload,
  onFilesDrop,
}: Props) {
  const [draft, setDraft] = useState("");
  const [showModal, setShowModal] = useState(!userName);
  const [drag, setDrag] = useState(false);

  useEffect(() => {
    if (!userName) setShowModal(true);
  }, [userName]);



  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = draft.trim();
    if (!value) return;
    onSubmitName(value);
    setShowModal(false);
  };

  const displayName = userName ?? "there";

  return (
    <>
      <main className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-4xl flex-col px-6 pb-8 pt-14 md:px-10 md:pt-20">
        <header className="max-w-2xl">
          <h1 className="mt-3 text-2xl font-bold tracking-[-0.04em] text-foreground md:text-4xl">
            Welcome, {displayName}.
          </h1>
        </header>

        <div
          className="mt-10"
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            if (e.dataTransfer.files.length > 0) onFilesDrop?.(e.dataTransfer.files);
          }}
        >
          <button
            onClick={onUpload}
            className={`group relative flex w-full overflow-hidden rounded-2xl border p-5 text-left shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
              drag
                ? "border-primary bg-primary text-primary-foreground ring-4 ring-primary/15"
                : "border-foreground/10 bg-foreground text-background"
            }`}
          >
            <span className="pointer-events-none absolute -right-7 -top-10 h-32 w-32 rounded-full border border-background/15" />
            <span className="pointer-events-none absolute right-12 top-10 h-16 w-16 rounded-full border border-background/10" />
            <span className="relative flex min-w-0 flex-1 items-center gap-4">
              <span className="rounded-xl bg-background/10 p-3 text-background ring-1 ring-inset ring-background/15 transition-transform duration-200 group-hover:scale-105">
                <Upload className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-base font-semibold">Add something to read</span>
                <span className="mt-1 block text-sm text-background/65">
                  Drop Markdown files here or choose them from your computer.
                </span>
              </span>
            </span>
            <span className="relative ml-4 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-background text-foreground transition-transform duration-200 group-hover:translate-x-1">
              <ArrowRight className="h-4 w-4" />
            </span>
          </button>
        </div>



        <section className="mt-12">
          <div className="mb-4 flex items-baseline justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-foreground">Documents</h2>
              {/* <p className="mt-1 text-sm text-muted-foreground">
                Files in your current workspace.
              </p> */}
            </div>
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {files.length}
            </span>
          </div>

          {files.length > 0 && (
            <div
              className="-my-4 flex snap-x gap-3 overflow-x-auto py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              aria-label="Documents"
            >
              {files.map((item) => (
                  <button
                    key={`file-${item.id}`}
                    onClick={() => onOpenFile(item.id)}
                    className="group flex aspect-square w-36 shrink-0 snap-start flex-col justify-between rounded-xl border border-border bg-card p-3.5 text-left shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:w-40"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex items-end justify-between gap-2">
                      <span className="min-w-0">
                        <span className="line-clamp-2 text-sm font-semibold leading-snug text-foreground group-hover:text-primary">
                          {stripExt(item.name)}
                        </span>
                        <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          {item.minutes} min read
                        </span>
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                    </div>
                  </button>
              ))}
            </div>
          )}
        </section>
      </main>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-background p-6 shadow-2xl">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Welcome
            </div>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground">
              What do we call you?
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              We&apos;ll remember it on this device to personalize your reading.
            </p>
            <form className="mt-5 flex gap-2" onSubmit={submit}>
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Your name"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary/60 focus:ring-2 focus:ring-primary/10"
              />
              <button
                type="submit"
                disabled={!draft.trim()}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                Continue
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
