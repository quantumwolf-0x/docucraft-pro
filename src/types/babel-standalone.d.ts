declare module "@babel/standalone" {
  interface TransformOptions {
    filename?: string;
    presets?: unknown[];
    plugins?: unknown[];
    sourceMaps?: boolean;
  }

  export function transform(code: string, options?: TransformOptions): { code: string };
}
