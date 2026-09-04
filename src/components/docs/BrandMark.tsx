import { cn } from "@/lib/utils";

/** Arc-space mark: ink tile with a single ember rail. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative inline-flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-[9px] bg-foreground text-[11px] font-semibold tracking-tight text-background",
        className,
      )}
      aria-hidden
    >
      <span className="absolute inset-y-1.5 left-[3px] w-[2.5px] rounded-full bg-[var(--gold)]" />
      <span className="translate-x-[1px]">L</span>
    </span>
  );
}
