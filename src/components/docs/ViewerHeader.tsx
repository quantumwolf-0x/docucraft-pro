import { ChevronLeft, ChevronRight } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useHideOnScroll } from "@/hooks/use-hide-on-scroll";

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
  // Phones give up a seventh of the screen to this bar. It slides away while
  // the reader is heading down the document and comes straight back on the
  // first upward scroll, so the controls are always one gesture away without
  // being permanently in the way. Desktop has the room; it keeps the header
  // pinned.
  const isMobile = useIsMobile();
  const headerRef = useHideOnScroll<HTMLDivElement>(isMobile);

  return (
    <div
      ref={headerRef}
      className="app-surface sticky top-0 z-(--z-sticky) mx-2 mt-2 flex h-12 shrink-0 items-center gap-2 rounded-2xl border border-border/70 px-2 transition-transform duration-300 ease-out will-change-transform md:mx-4 md:px-3"
    >
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
      className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
    >
      {children}
    </button>
  );
}

/** Default center: file-type icon in a soft chip + the file name. */
export function HeaderTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground/70">
        {icon}
      </div>
      <div className="min-w-0 flex-1 truncate text-sm font-medium tracking-tight text-foreground">
        {title}
      </div>
    </>
  );
}
