import { useEffect, useMemo, useState, type ComponentPropsWithoutRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { MdFile } from "@/lib/markdown-utils";
import { dataUrlToBlob, getDocumentKind } from "@/lib/document-utils";
import { DocumentViewer } from "./DocumentViewer";
import {
  prepareWorkspaceEmbeds,
  resolveWorkspaceArtifact,
  artifactReference,
  isArtifactUrl,
  type ResolvedArtifact,
} from "@/lib/workspace-artifacts";

interface Props {
  reference: string;
  currentWorkspaceId?: string | null;
  workspaceRevision?: string;
  currentWorkspaceFiles?: MdFile[];
  currentWorkspaceName?: string;
  depth?: number;
  ancestors?: string[];
  onOpenArtifact?: (fileId: string, workspaceId: string) => void;
}

export function InlineArtifact({
  reference,
  currentWorkspaceId,
  workspaceRevision,
  currentWorkspaceFiles,
  currentWorkspaceName,
  depth = 0,
  ancestors = [],
  onOpenArtifact,
}: Props) {
  const [artifact, setArtifact] = useState<ResolvedArtifact | null>();

  useEffect(() => {
    let alive = true;
    setArtifact(undefined);
    void resolveWorkspaceArtifact(
      reference,
      currentWorkspaceId,
      workspaceRevision,
      currentWorkspaceFiles,
      currentWorkspaceName,
    ).then((result) => alive && setArtifact(result));
    return () => {
      alive = false;
    };
  }, [
    reference,
    currentWorkspaceId,
    workspaceRevision,
    currentWorkspaceFiles,
    currentWorkspaceName,
  ]);

  const objectUrl = useObjectUrl(artifact?.file);
  if (artifact === undefined) return <div className="artifact-loading">Loading {reference}…</div>;
  if (!artifact)
    return (
      <div className="artifact-error">
        Couldn’t find <strong>{reference}</strong> in this workspace.
      </div>
    );

  const { file } = artifact;
  const kind = file.kind ?? getDocumentKind(file.name, file.mimeType);
  const isPresentation = kind === "presentation";

  // Reading-only embed: no header, footer, or controls — just the content.
  return (
    <section className="not-prose my-6">
      <div
        className={
          isPresentation
            ? "presentation-embed-viewport overflow-hidden rounded-xl border border-border"
            : "artifact-viewport overflow-hidden rounded-xl border border-border"
        }
      >
        {renderArtifact(file, objectUrl, {
          currentWorkspaceId,
          workspaceRevision,
          depth,
          ancestors,
          onOpenArtifact,
        })}
      </div>
    </section>
  );
}

function renderArtifact(file: MdFile, objectUrl: string | null, context: Omit<Props, "reference">) {
  const kind = file.kind ?? getDocumentKind(file.name, file.mimeType);
  if (kind === "image")
    return <img src={objectUrl ?? file.data} alt={file.name} className="artifact-image" />;
  if (kind === "video")
    return <video src={objectUrl ?? file.data} controls className="artifact-media" />;
  if (kind === "audio")
    return <audio src={objectUrl ?? file.data} controls className="w-full px-4 py-6" />;
  if (kind === "html")
    return <iframe title={file.name} srcDoc={file.content} sandbox="" className="artifact-html" />;
  if (kind === "markdown" || kind === "text") {
    if ((context.depth ?? 0) >= 4 || (context.ancestors ?? []).includes(file.id))
      return (
        <div className="artifact-error">
          Nested Markdown stopped here to prevent a circular embed.
        </div>
      );
    return <EmbeddedMarkdown file={file} {...context} />;
  }
  return <DocumentViewer file={file} embedded />;
}

function EmbeddedMarkdown({
  file,
  currentWorkspaceId,
  workspaceRevision,
  currentWorkspaceFiles,
  currentWorkspaceName,
  depth = 0,
  ancestors = [],
  onOpenArtifact,
}: { file: MdFile } & Omit<Props, "reference">) {
  const content = useMemo(() => prepareWorkspaceEmbeds(file.content), [file.content]);
  return (
    <article className="artifact-markdown docs-prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          img: (props: ComponentPropsWithoutRef<"img">) =>
            isArtifactUrl(props.src) ? (
              <InlineArtifact
                reference={artifactReference(props.src)}
                currentWorkspaceId={currentWorkspaceId}
                workspaceRevision={workspaceRevision}
                currentWorkspaceFiles={currentWorkspaceFiles}
                currentWorkspaceName={currentWorkspaceName}
                depth={depth + 1}
                ancestors={[...ancestors, file.id]}
                onOpenArtifact={onOpenArtifact}
              />
            ) : (
              <img {...props} loading="lazy" />
            ),
          a: (props: ComponentPropsWithoutRef<"a">) => (
            <a
              {...props}
              target={props.href?.startsWith("http") ? "_blank" : undefined}
              rel="noreferrer"
            />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </article>
  );
}

function useObjectUrl(file?: MdFile) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }
    const blob = file.data
      ? dataUrlToBlob(file.data)
      : new Blob([file.content], { type: file.mimeType || "text/plain" });
    if (!blob) {
      setUrl(null);
      return;
    }
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url;
}
