// Map rendered text back to its position in the markdown source — the
// "Inspect" half of the reader. The CSS Custom Highlight API gives us offsets
// into the *rendered* DOM (see text-offsets.ts), but the editor is a textarea
// over the raw markdown, where `**bold**`, `[text](url)` and heading markers
// all shift the offsets. So we project the source down to the plain text a
// reader actually sees, keeping a per-character index back into the source,
// then search that projection for the selected text.

export interface SourceSpan {
  start: number;
  end: number;
}

interface Projection {
  /** Plain text as the reader sees it. */
  text: string;
  /** map[i] = index in the original source of text[i]. */
  map: number[];
}

const BLOCK_LEAD = /^(?:\s*(?:>\s?)*)(?:#{1,6}\s+|(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?)?/;
const TABLE_SEPARATOR = /^\s*\|?(?:\s*:?-{2,}:?\s*\|)+\s*:?-{2,}:?\s*\|?\s*$/;

const isWordChar = (c: string | undefined) => !!c && /[A-Za-z0-9]/.test(c);

/** Index of the `]` that closes the `[` at `open`, or -1. */
function matchBracket(line: string, open: number): number {
  let depth = 0;
  for (let i = open; i < line.length; i++) {
    if (line[i] === "\\") {
      i++;
      continue;
    }
    if (line[i] === "[") depth++;
    else if (line[i] === "]") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Strip markdown syntax from `src`, recording where every surviving character
 * came from. Inline code and fenced blocks keep their contents (they render as
 * text); images, link targets and emphasis markers are dropped.
 */
function project(src: string): Projection {
  const chars: string[] = [];
  const map: number[] = [];
  const push = (ch: string, idx: number) => {
    chars.push(ch);
    map.push(idx);
  };

  const inline = (line: string, from: number, to: number, base: number) => {
    let k = from;
    while (k < to) {
      const ch = line[k];
      const idx = base + k;

      if (ch === "\\" && k + 1 < to) {
        push(line[k + 1], base + k + 1);
        k += 2;
        continue;
      }

      // `code` — contents render, backticks don't.
      if (ch === "`") {
        const close = line.indexOf("`", k + 1);
        if (close !== -1 && close < to) {
          for (let m = k + 1; m < close; m++) push(line[m], base + m);
          k = close + 1;
          continue;
        }
        k++;
        continue;
      }

      // ![alt](url) renders as an image — no text at all.
      if (ch === "!" && line[k + 1] === "[") {
        const close = matchBracket(line, k + 1);
        const paren = close !== -1 && line[close + 1] === "(" ? line.indexOf(")", close + 1) : -1;
        if (paren !== -1) {
          k = paren + 1;
          continue;
        }
        k++;
        continue;
      }

      // [text](url) / [text][ref] — keep the text, drop the target.
      if (ch === "[") {
        const close = matchBracket(line, k);
        if (close !== -1 && close < to) {
          const after = line[close + 1];
          let skipTo = close + 1;
          if (after === "(") {
            const paren = line.indexOf(")", close + 1);
            if (paren !== -1) skipTo = paren + 1;
          } else if (after === "[") {
            const ref = line.indexOf("]", close + 2);
            if (ref !== -1) skipTo = ref + 1;
          }
          inline(line, k + 1, close, base);
          k = skipTo;
          continue;
        }
        k++;
        continue;
      }

      // Emphasis / strikethrough delimiters.
      if (ch === "*" || ch === "~") {
        k++;
        continue;
      }
      // `_` is only a delimiter at a word boundary — snake_case must survive.
      if (ch === "_") {
        if (isWordChar(line[k - 1]) && isWordChar(line[k + 1])) push("_", idx);
        k++;
        continue;
      }
      // Table cell walls read as a gap between cells.
      if (ch === "|") {
        push(" ", idx);
        k++;
        continue;
      }

      push(ch, idx);
      k++;
    }
  };

  let pos = 0;
  let inFence = false;
  for (const line of src.split("\n")) {
    const base = pos;
    pos += line.length + 1;

    if (/^\s*(?:```|~~~)/.test(line)) {
      inFence = !inFence;
      push("\n", base + line.length);
      continue;
    }
    if (inFence) {
      for (let m = 0; m < line.length; m++) push(line[m], base + m);
      push("\n", base + line.length);
      continue;
    }
    if (TABLE_SEPARATOR.test(line)) {
      push("\n", base + line.length);
      continue;
    }

    const lead = BLOCK_LEAD.exec(line);
    inline(line, lead ? lead[0].length : 0, line.length, base);
    push("\n", base + line.length);
  }

  return { text: chars.join(""), map };
}

/** Whitespace-collapsed copy of `text`, with a map back into `text`. */
function compact(text: string): Projection {
  const chars: string[] = [];
  const map: number[] = [];
  let space = true; // leading whitespace is dropped
  for (let i = 0; i < text.length; i++) {
    const ws = /\s/.test(text[i]);
    if (ws) {
      if (!space) {
        chars.push(" ");
        map.push(i);
        space = true;
      }
      continue;
    }
    chars.push(text[i]);
    map.push(i);
    space = false;
  }
  while (chars.length && chars[chars.length - 1] === " ") {
    chars.pop();
    map.pop();
  }
  return { text: chars.join(""), map };
}

// Projecting the whole document on every right-click is wasteful; readers
// inspect the same document many times in a row.
let cacheKey: string | null = null;
let cacheValue: { proj: Projection; flat: Projection } | null = null;

function projectionOf(src: string) {
  if (cacheKey === src && cacheValue) return cacheValue;
  const proj = project(src);
  cacheValue = { proj, flat: compact(proj.text) };
  cacheKey = src;
  return cacheValue;
}

/**
 * Find `selection` (text copied out of the rendered document) in the markdown
 * `source`. `prefer` narrows the search to a source range first — the section
 * currently on screen — so a phrase repeated across the document resolves to
 * the copy the reader is actually looking at.
 */
export function locateInSource(
  source: string,
  selection: string,
  prefer?: { from: number; to: number },
): SourceSpan | null {
  const needle = compact(selection).text;
  if (!needle) return null;

  const { proj, flat } = projectionOf(source);

  // Flat index -> source index, and back, so `prefer` can be applied.
  const toSource = (flatIdx: number) => proj.map[flat.map[flatIdx]];
  const spanFor = (flatStart: number, len: number): SourceSpan => {
    const start = toSource(flatStart);
    const end = toSource(flatStart + len - 1) + 1;
    return { start: Math.min(start, end), end: Math.max(start, end) };
  };

  const search = (hay: string): number => {
    if (prefer) {
      let lo = -1;
      let hi = -1;
      for (let i = 0; i < flat.map.length; i++) {
        const s = toSource(i);
        if (s >= prefer.from && s < prefer.to) {
          if (lo === -1) lo = i;
          hi = i;
        }
      }
      if (lo !== -1) {
        const local = flat.text.slice(lo, hi + 1).indexOf(hay);
        if (local !== -1) return lo + local;
      }
    }
    return flat.text.indexOf(hay);
  };

  const exact = search(needle);
  if (exact !== -1) return spanFor(exact, needle.length);

  // Selections that cross a rendered boundary we didn't model (a table row, a
  // stripped heading) won't match whole. Anchor on the longest prefix that does
  // — the reader still lands on the right line.
  for (let len = Math.min(needle.length, 120); len >= 12; len = Math.floor(len * 0.7)) {
    const partial = needle.slice(0, len);
    const at = search(partial);
    if (at !== -1) return spanFor(at, partial.length);
  }

  // Last resort: the first word long enough to be distinctive.
  const word = needle.split(" ").find((w) => w.length >= 4);
  if (word) {
    const at = search(word);
    if (at !== -1) return spanFor(at, word.length);
  }
  return null;
}

/**
 * Pixel offset of `index` inside a textarea, measured by mirroring its text in
 * a hidden div with the same box metrics. Line-height arithmetic is wrong the
 * moment a line wraps, which markdown paragraphs always do.
 */
export function caretTop(ta: HTMLTextAreaElement, index: number): number {
  const cs = getComputedStyle(ta);
  const mirror = document.createElement("div");
  const marker = document.createElement("span");

  for (const prop of [
    "fontFamily",
    "fontSize",
    "fontWeight",
    "fontStyle",
    "letterSpacing",
    "lineHeight",
    "textTransform",
    "wordSpacing",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "borderTopWidth",
    "borderRightWidth",
    "borderBottomWidth",
    "borderLeftWidth",
    "boxSizing",
    "tabSize",
  ] as const) {
    mirror.style[prop] = cs[prop];
  }
  mirror.style.position = "absolute";
  mirror.style.visibility = "hidden";
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.overflowWrap = "break-word";
  mirror.style.width = `${ta.clientWidth}px`;
  mirror.style.top = "0";
  mirror.style.left = "-9999px";

  mirror.textContent = ta.value.slice(0, index);
  marker.textContent = ta.value.slice(index, index + 1) || ".";
  mirror.appendChild(marker);
  document.body.appendChild(mirror);
  const top = marker.offsetTop;
  document.body.removeChild(mirror);
  return top;
}
