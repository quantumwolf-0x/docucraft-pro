import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import * as React from "react";

type RunMessage = {
  type: "docucraft:interactive-run";
  id: string;
  code: string;
  theme: "light" | "dark";
};

const MESSAGE = "docucraft:interactive";

// This route is only ever loaded inside a sandboxed iframe. Keeping the runtime
// in its own route means React is bundled normally while authored code remains
// in the iframe's opaque origin, outside the documentation application.
export const Route = createFileRoute("/interactive-runtime")({
  component: InteractiveRuntime,
});

function InteractiveRuntime() {
  const mountRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<Root | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const post = (payload: Record<string, unknown>) => {
      window.parent.postMessage({ type: MESSAGE, ...payload }, "*");
    };

    const reportHeight = () => {
      const height = Math.ceil(document.documentElement.scrollHeight);
      post({ event: "height", height });
    };
    const observer = new ResizeObserver(reportHeight);
    observer.observe(document.documentElement);

    const onError = (event: ErrorEvent) => {
      post({
        event: "error",
        message: event.message || "The interactive component stopped unexpectedly.",
        stack: event.error?.stack,
      });
    };
    window.addEventListener("error", onError);

    const onMessage = (event: MessageEvent<RunMessage>) => {
      if (event.source !== window.parent || event.data?.type !== "docucraft:interactive-run")
        return;
      setTheme(event.data.theme);
      if (!mountRef.current) return;

      try {
        rootRef.current?.unmount();
        mountRef.current.replaceChildren();
        rootRef.current = createRoot(mountRef.current);
        const Component = evaluateComponent(event.data.code);
        rootRef.current.render(
          <RuntimeBoundary
            onError={(error) =>
              post({ event: "error", message: error.message, stack: error.stack })
            }
          >
            <Component />
          </RuntimeBoundary>,
        );
        post({ event: "ready", id: event.data.id });
        requestAnimationFrame(reportHeight);
      } catch (error) {
        const err = toError(error);
        post({ event: "error", message: err.message, stack: err.stack });
      }
    };

    window.addEventListener("message", onMessage);
    post({ event: "booted" });
    return () => {
      observer.disconnect();
      window.removeEventListener("error", onError);
      window.removeEventListener("message", onMessage);
      rootRef.current?.unmount();
    };
  }, []);

  return (
    <main data-theme={theme} className="interactive-runtime-page">
      <div ref={mountRef} />
      <style>{RUNTIME_CSS}</style>
    </main>
  );
}

class RuntimeBoundary extends React.Component<
  { children: React.ReactNode; onError: (error: Error) => void },
  { error: Error | null }
> {
  state = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    this.props.onError(error);
  }

  render() {
    if (this.state.error) return null;
    return this.props.children;
  }
}

function evaluateComponent(code: string): React.ComponentType {
  // Keep references to the execution primitive private, then remove dangerous
  // globals before authored code runs. Sandbox flags also provide the real
  // security boundary: no same-origin, navigation, popups, or parent access.
  const UnsafeFunction = Function;
  const deny = () => {
    throw new Error("This API is disabled inside interactive documentation blocks.");
  };
  const denyProperty = (name: string) => {
    try {
      Object.defineProperty(window, name, { configurable: true, get: deny, set: deny });
    } catch {
      // Browsers already deny several of these APIs in an opaque-origin frame.
    }
  };

  window.open = deny as typeof window.open;
  window.fetch = deny as typeof window.fetch;
  window.eval = deny as typeof window.eval;
  Object.defineProperty(window, "Function", { configurable: true, value: deny });
  [
    "localStorage",
    "sessionStorage",
    "indexedDB",
    "caches",
    "Notification",
    "Clipboard",
    "showOpenFilePicker",
    "showSaveFilePicker",
  ].forEach(denyProperty);
  try {
    Object.defineProperty(document, "cookie", { configurable: true, get: deny, set: deny });
  } catch {
    // Non-configurable browser implementations are still opaque-origin scoped.
  }
  if (navigator.mediaDevices) {
    navigator.mediaDevices.getUserMedia = deny as typeof navigator.mediaDevices.getUserMedia;
  }
  if ("geolocation" in navigator) {
    Object.defineProperty(navigator.geolocation, "getCurrentPosition", {
      configurable: true,
      value: deny,
    });
  }

  const module = { exports: {} as Record<string, unknown> };
  const runner = UnsafeFunction(
    "React",
    "useState",
    "useEffect",
    "useLayoutEffect",
    "useMemo",
    "useCallback",
    "useRef",
    "useReducer",
    "useContext",
    "module",
    "exports",
    `'use strict';\n${code}\nreturn module.exports.default || exports.default;`,
  );
  const component = runner(
    React,
    React.useState,
    React.useEffect,
    React.useLayoutEffect,
    React.useMemo,
    React.useCallback,
    React.useRef,
    React.useReducer,
    React.useContext,
    module,
    module.exports,
  );
  if (typeof component !== "function") {
    throw new Error("React blocks must export a default function component.");
  }
  return component as React.ComponentType;
}

function toError(value: unknown) {
  return value instanceof Error ? value : new Error(String(value));
}

const RUNTIME_CSS = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  html, body, #root { min-height: 100%; margin: 0; }
  body { overflow-x: hidden; }
  .interactive-runtime-page {
    min-height: 100%; padding: 18px; color: #172033; background: #ffffff;
    font: 15px/1.5 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  .interactive-runtime-page[data-theme="dark"] { color-scheme: dark; color: #edf2ff; background: #151b2b; }
  .interactive-runtime-page button, .interactive-runtime-page input, .interactive-runtime-page select, .interactive-runtime-page textarea { font: inherit; }
  .interactive-runtime-page button { cursor: pointer; }
`;
