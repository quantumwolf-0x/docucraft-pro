import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { applyDeviceTier } from "@/lib/device-tier";
import { BrandMark } from "@/components/docs/BrandMark";

// Mermaid loads each diagram type (flowchart, ERD, etc.) in a separate Vite
// chunk. After a deployment, an already-open tab can still reference a chunk
// from the previous release. Vite emits this event for that failed import;
// reload once to fetch the current app shell and its matching asset manifest.
if (typeof window !== "undefined") {
  window.addEventListener("vite:preloadError", (event) => {
    event.preventDefault();

    const payload = (event as Event & { payload?: unknown }).payload;
    const failure = payload instanceof Error ? payload.message : String(payload ?? "unknown");
    const reloadKey = "localdox:preload-error";

    // Do not get caught in a reload loop if the new release has a real asset
    // configuration problem rather than a stale browser cache.
    if (sessionStorage.getItem(reloadKey) === failure) return;

    sessionStorage.setItem(reloadKey, failure);
    window.location.reload();
  });
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <BrandMark className="mx-auto h-10 w-10 rounded-[12px] text-sm" />
        <h1 className="mt-6 text-6xl font-semibold tracking-[-0.05em] text-foreground">404</h1>
        <h2 className="mt-3 text-lg font-medium text-foreground">This page isn't here</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          The page you're looking for doesn't exist, or it moved.
        </p>
        <div className="mt-7">
          <Link
            to="/"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-foreground px-5 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    console.error("Root component error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-foreground px-5 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-input bg-background px-5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      { title: "Localdox" },
      { name: "description", content: "Localdox" },
      { name: "author", content: "Localdox" },
      { property: "og:title", content: "Localdox" },
      { property: "og:description", content: "Localdox" },
      { name: "theme-color", content: "#f4f5f8", media: "(prefers-color-scheme: light)" },
      { name: "theme-color", content: "#1a1e2a", media: "(prefers-color-scheme: dark)" },
      { property: "og:image", content: "https://localdox.web.app/og-image.jpg" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://localdox.web.app/og-image.jpg" },
      { name: "twitter:site", content: "@Localdox" },
    ],
    links: [
      {
        rel: "icon",
        type: "image/svg+xml",
        href: "/favicon.svg",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

import { Toaster } from "@/components/ui/sonner";

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  // Tag <html> with what this device can afford to composite, before anything
  // translucent is on screen. See `src/lib/device-tier.ts`.
  useEffect(applyDeviceTier, []);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <Toaster />
    </QueryClientProvider>
  );
}
