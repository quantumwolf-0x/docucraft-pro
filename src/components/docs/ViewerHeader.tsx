import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * The one header every viewer shares. Layout is fixed for all file types:
 *   [prev] [next]   <center>   ...spacer...   <actions>
 *
 * Only two things change per file type:
 *  - `center`: a section dropdown for markdown, or an icon + filename otherwise.
 *  - `actions`: the right-side controls (download, fullscreen, edit, …).
 *
 * The prev/next buttons are always rendered. What they *do* is the caller's
 * concern — next slide for a deck, next section for markdown, next file for a
 * PDF/image — but they look and sit the same everywhere.
 */
export interface ViewerNav {
  onPrev: () => void;
  onNext: () => void;
  prevDisabled?: boolean;
  nextDisabled?: boolean;
  prevLabel?: string;
  nextLabel?: string;
}

export function ViewerHeader({
  nav,
  center,
  actions,
}: {
  nav: ViewerNav;
  center: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="app-surface sticky top-0 z-(--z-sticky) flex h-14 shrink-0 items-center gap-2 border-b border-border/50 px-4 md:px-7">
      <div className="flex shrink-0 items-center gap-1">
        <HeaderNavButton
          onClick={nav.onPrev}
          disabled={nav.prevDisabled}
          label={nav.prevLabel ?? "Previous"}
        >
          <ChevronLeft className="h-4 w-4" />
        </HeaderNavButton>
        <HeaderNavButton
          onClick={nav.onNext}
          disabled={nav.nextDisabled}
          label={nav.nextLabel ?? "Next"}
        >
          <ChevronRight className="h-4 w-4" />
        </HeaderNavButton>
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-2">{center}</div>
      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </div>
  );
}

function HeaderNavButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50 disabled:pointer-events-none"
    >
      {children}
    </button>
  );
}

/** Default center: file-type icon in a soft chip + the file name. */
export function HeaderTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{title}</div>
    </>
  );
}
