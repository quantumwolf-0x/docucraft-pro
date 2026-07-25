import { createFileRoute } from "@tanstack/react-router";
import { DocsApp } from "@/components/docs/DocsApp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Localdox - AI Docs reader" },
      {
        name: "description",
        content:
          "Drop markdown files to instantly render a beautifully navigable documentation site with search, sidebar, and syntax highlighting.",
      },
      { property: "og:title", content: "Localdox" },
      { property: "og:description", content: "Turn markdown files into a polished documentation experience." },
      { name: "theme-color", content: "#ffffff", media: "(prefers-color-scheme: light)" },
      { name: "theme-color", content: "#09090b", media: "(prefers-color-scheme: dark)" },
      { property: "og:image", content: "https://localdox.web.app/og-image.jpg" },
      { name: "twitter:image", content: "https://localdox.web.app/og-image.jpg" },
    ],
  }),
  component: DocsApp,
});
