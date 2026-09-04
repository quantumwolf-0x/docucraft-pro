import { useCallback, useEffect, useState } from "react";
import {
  Check,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
  ShieldAlert,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { PROVIDER_LIST, getProvider } from "@/lib/ai/registry";
import { getKey, setKey, removeKey, storageMode, listConfigured } from "@/lib/ai/keys";
import { loadAIConfig, saveAIConfig, type AIConfig } from "@/lib/ai/config";
import type { ProviderId } from "@/lib/ai/types";

// Self-contained AI settings: reads/writes keys.ts + config.ts directly so the
// Settings page needs no new prop plumbing.
export function AiSettings() {
  const [config, setConfig] = useState<AIConfig>(() => loadAIConfig());
  const [connected, setConnected] = useState<ProviderId[]>([]);
  const mode = storageMode();

  // Keep the default model pointed at a provider the user actually has a key
  // for. Any single key is enough — this makes a newly-added key immediately
  // usable without touching the model dropdown.
  const reconcile = useCallback(async () => {
    const ids = await listConfigured();
    setConnected(ids);
    setConfig((prev) => {
      const currentProvider = getProvider(prev.defaultProvider);
      const currentProviderKeyed = ids.includes(prev.defaultProvider);
      const modelBelongs = currentProvider?.models.some((m) => m.id === prev.defaultModel);
      if (currentProviderKeyed && modelBelongs) return prev;
      // Point the default at the first connected provider's first model.
      const target = ids.length ? getProvider(ids[0]) : undefined;
      if (!target) return prev;
      return saveAIConfig({ defaultProvider: target.id, defaultModel: target.models[0].id });
    });
  }, []);

  useEffect(() => {
    void reconcile();
  }, [reconcile]);

  const patchConfig = (patch: Partial<AIConfig>) => setConfig(saveAIConfig(patch));

  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-lg font-semibold">Ask AI</h2>
        <p className="text-sm text-muted-foreground">
          Connect your own AI provider with a personal API key. Localdox doesn&apos;t provide AI
          credits — every request uses your key and goes directly from your browser to the provider.
          Any one key is enough; add a second and it becomes an automatic fallback.
        </p>
      </div>

      {mode === "encrypted" ? (
        <div className="flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div className="text-sm">
            <div className="font-medium text-foreground">Keys are encrypted on this device</div>
            <p className="text-muted-foreground">
              Stored with WebCrypto (AES-GCM) in your browser&apos;s local database. Keys are
              decrypted only in memory while you use the app.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="text-sm">
            <div className="font-medium text-foreground">Encrypted storage unavailable</div>
            <p className="text-muted-foreground">
              This browser can&apos;t use secure storage, so keys are kept obfuscated in
              localStorage — this is less secure. Avoid entering keys on a shared device.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">API keys</h3>
        {PROVIDER_LIST.map((provider) => (
          <ProviderKeyRow key={provider.id} provider={provider} onChanged={reconcile} />
        ))}
      </div>

      <DefaultModel config={config} connected={connected} onChange={patchConfig} />
    </div>
  );
}

function ProviderKeyRow({
  provider,
  onChanged,
}: {
  provider: (typeof PROVIDER_LIST)[number];
  onChanged: () => void | Promise<void>;
}) {
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [status, setStatus] = useState<"idle" | "checking" | "valid" | "invalid">("idle");

  useEffect(() => {
    let alive = true;
    void getKey(provider.id).then((k) => {
      if (alive && k) {
        setSaved(true);
        setValue(k);
      }
    });
    return () => {
      alive = false;
    };
  }, [provider.id]);

  const onSave = async () => {
    setStatus("checking");
    const ok = await provider.validateKey(value.trim());
    if (ok) {
      await setKey(provider.id, value.trim());
      setSaved(true);
      setStatus("valid");
      await onChanged();
    } else {
      setStatus("invalid");
    }
  };

  const onRemove = async () => {
    await removeKey(provider.id);
    setSaved(false);
    setValue("");
    setStatus("idle");
    await onChanged();
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h4 className="font-medium text-foreground">{provider.label}</h4>
          {saved && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <Check className="h-3 w-3" /> Connected
            </span>
          )}
        </div>
        <a
          href={provider.keyUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          Get a key <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type={reveal ? "text" : "password"}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setStatus("idle");
            }}
            placeholder={`${provider.label} API key`}
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-md border border-border bg-background py-2 pl-3 pr-9 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10"
          />
          <button
            type="button"
            onClick={() => setReveal((r) => !r)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
            aria-label={reveal ? "Hide key" : "Show key"}
          >
            {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <button
          onClick={onSave}
          disabled={!value.trim() || status === "checking"}
          className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {status === "checking" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          {saved ? "Update" : "Save"}
        </button>
        {saved && (
          <button
            onClick={onRemove}
            className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            aria-label={`Remove ${provider.label} key`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {status === "valid" && (
        <p className="mt-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
          Key verified and saved.
        </p>
      )}
      {status === "invalid" && (
        <p className="mt-2 text-xs font-medium text-destructive">
          That key didn&apos;t validate. Check it and try again.
        </p>
      )}
    </div>
  );
}

function DefaultModel({
  config,
  connected,
  onChange,
}: {
  config: AIConfig;
  connected: ProviderId[];
  onChange: (patch: Partial<AIConfig>) => void;
}) {
  const allOptions = PROVIDER_LIST.flatMap((provider) =>
    provider.models.map((model) => ({ provider, model })),
  );
  const anyConnected = connected.length > 0;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">Default model</h3>
      <p className="text-sm text-muted-foreground">
        Used first for every Ask AI request. If its key runs out and another provider is connected,
        Ask AI falls back to that one automatically.
      </p>
      <select
        value={config.defaultModel}
        onChange={(e) => {
          const model = e.target.value;
          const provider = allOptions.find((o) => o.model.id === model)?.provider.id as
            | ProviderId
            | undefined;
          onChange({ defaultModel: model, ...(provider ? { defaultProvider: provider } : {}) });
        }}
        className="w-full max-w-sm rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10"
      >
        {PROVIDER_LIST.map((provider) => {
          const isConnected = connected.includes(provider.id);
          return (
            <optgroup
              key={provider.id}
              label={`${provider.label}${isConnected ? " — connected" : " — no key"}`}
            >
              {provider.models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                  {isConnected ? "" : " (add key)"}
                </option>
              ))}
            </optgroup>
          );
        })}
      </select>
      {!anyConnected && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          No API key connected yet — add one above to start using Ask AI.
        </p>
      )}
    </div>
  );
}
