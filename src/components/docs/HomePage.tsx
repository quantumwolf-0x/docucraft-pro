import { useEffect, useState } from "react";
import { ArrowRight, Clock, FileText, Upload } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { BrandMark } from "./BrandMark";

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
  const workspaceName = workspaces.find((w) => w.current)?.name || "Workspace";

  return (
    <>
      <main className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-3xl flex-col px-6 pb-16 pt-16 md:px-10 md:pt-24">
        <header>
          <div className="flex items-center gap-2.5 text-muted-foreground">
            <BrandMark className="h-6 w-6 rounded-[8px] text-[10px]" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em]">Library</p>
          </div>
          <h1 className="mt-5 text-[2.15rem] font-semibold leading-[1.12] tracking-[-0.045em] text-foreground md:text-5xl">
            Welcome, {displayName}.
          </h1>
          <p className="mt-3 max-w-md text-[15px] leading-relaxed text-muted-foreground">
            Your documents stay on this device. Open one, or drop more into the workspace.
          </p>
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
            className={`group relative flex w-full items-center justify-between overflow-hidden rounded-2xl border px-5 py-5 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
              drag
                ? "border-[var(--gold)] bg-[color-mix(in_oklab,var(--gold)_12%,var(--card))] ring-4 ring-[color-mix(in_oklab,var(--gold)_18%,transparent)]"
                : "border-border/80 bg-card/80 shadow-[0_1px_0_color-mix(in_oklab,white_70%,transparent),0_12px_32px_color-mix(in_oklab,var(--foreground)_5%,transparent)] hover:-translate-y-0.5 hover:border-foreground/15"
            }`}
          >
            <span className="relative flex min-w-0 flex-1 items-center gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
                <Upload className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold tracking-tight">
                  Add files to this workspace
                </span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  Drop documents, spreadsheets, PDFs, or presentations.
                </span>
              </span>
            </span>
            <ArrowRight className="relative ml-4 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5" />
          </button>
        </div>

        <section className="mt-14">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div className="min-w-0">
              <h2 className="truncate text-xl font-semibold tracking-tight text-foreground md:text-2xl">
                {workspaceName}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {files.length} {files.length === 1 ? "document" : "documents"}
              </p>
            </div>
            <button
              onClick={() => {
                const cw = workspaces.find((w) => w.current);
                if (cw) onOpenWorkspace(cw.id);
              }}
              className="group mb-0.5 flex shrink-0 items-center gap-1.5 text-sm font-medium text-foreground/70 transition-colors hover:text-foreground"
            >
              View all
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>

          {files.length > 0 && (
            <div className="flex flex-col gap-2">
              {files.map((item) => (
                <button
                  key={`file-${item.id}`}
                  onClick={() => onOpenFile(item.id)}
                  className="group flex items-center justify-between rounded-2xl border border-transparent bg-card/60 px-3 py-3 text-left transition-all duration-200 hover:border-border hover:bg-card hover:shadow-[0_8px_24px_color-mix(in_oklab,var(--foreground)_5%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground/70">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-[15px] font-medium tracking-tight text-foreground">
                        {stripExt(item.name)}
                      </h3>
                      <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        {item.minutes} min read
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="ml-4 h-4 w-4 shrink-0 text-muted-foreground/0 transition-all group-hover:text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
        </section>
      </main>

      <Modal
        open={showModal}
        onOpenChange={() => {
          /* Name is required — keep the modal open until the form is submitted. */
        }}
        size="sm"
        showClose={false}
        bodyClassName="p-7"
      >
        <BrandMark className="mb-4" />
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Welcome
        </div>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
          What do we call you?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          We&apos;ll remember it on this device to personalize your reading.
        </p>
        <form className="mt-6 flex gap-2" onSubmit={submit}>
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Your name"
            className="h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm outline-none transition-colors focus:border-foreground/25 focus:ring-2 focus:ring-ring/30"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            Continue
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>
      </Modal>
    </>
  );
}
