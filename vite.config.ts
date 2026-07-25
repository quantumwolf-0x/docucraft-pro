import { defineConfig } from 'vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import tsConfigPaths from 'vite-tsconfig-paths';
import { nitro } from 'nitro/vite';
import path from 'path';

export default defineConfig({
  plugins: [
    tanstackStart({
      server: { entry: "server" },
      // Generate TanStack Start's client-only HTML shell for Firebase Hosting.
      spa: {
        enabled: true,
        prerender: {
          crawlLinks: true,
        },
      },
    }),
    viteReact(),
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    nitro({ preset: 'node-server' })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  },
  optimizeDeps: {
    include: ["mermaid"],
  },
});
