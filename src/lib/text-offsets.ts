// Character-offset helpers for the CSS Custom Highlight API.
//
// Highlights are stored as [start,end] character offsets within a page's
// rendered content container. This survives re-renders (no DOM mutation) and
// handles selections that span multiple elements — the text-match approach
// could only wrap text inside a single node.
//
// Everything here runs off a cached index of the container's text nodes.
// Rebuilding that index per call meant a full TreeWalker pass on every mouseup,
// every click, and once per highlight per repaint — O(highlights x document),
// which is what made single-page mode crawl. The index is built once per
// container and invalidated by a MutationObserver, so lookups are a map hit or
// a binary search.

interface TextIndex {
  nodes: Text[];
  /** starts[i] = character offset of nodes[i] from the start of the container. */
  starts: number[];
  /** nodes[i] -> i, so a Selection's node resolves without scanning. */
  order: Map<Text, number>;
  total: number;
  /** Full text content, built lazily (only firstTextRange needs it). */
  text: string | null;
}

// One content container is live at a time, so a single slot beats a WeakMap
// (a WeakMap whose value holds an observer on the key would pin the key alive).
let cachedEl: HTMLElement | null = null;
let cachedIndex: TextIndex | null = null;
let observer: MutationObserver | null = null;

function build(container: HTMLElement): TextIndex {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
  const nodes: Text[] = [];
  const starts: number[] = [];
  const order = new Map<Text, number>();
  let acc = 0;
  let n: Node | null;
  while ((n = walker.nextNode())) {
    const t = n as Text;
    order.set(t, nodes.length);
    starts.push(acc);
    nodes.push(t);
    acc += t.length;
  }
  return { nodes, starts, order, total: acc, text: null };
}

function getIndex(container: HTMLElement): TextIndex {
  if (cachedEl !== container) {
    // New container (mode switch, section change, document swap). Re-arm the
    // observer so async content — Mermaid, embeds — invalidates the index too.
    observer?.disconnect();
    observer = new MutationObserver(() => {
      cachedIndex = null;
    });
    observer.observe(container, { childList: true, subtree: true, characterData: true });
    cachedEl = container;
    cachedIndex = null;
  }
  if (!cachedIndex) cachedIndex = build(container);
  return cachedIndex;
}

/** Drop the cached index — call when the container is about to be torn down. */
export function releaseTextIndex() {
  observer?.disconnect();
  observer = null;
  cachedEl = null;
  cachedIndex = null;
}

/** Index of the last text node starting at or before `offset`. */
function nodeAt(idx: TextIndex, offset: number): { node: Text; local: number } | null {
  if (!idx.nodes.length) return null;
  let lo = 0;
  let hi = idx.nodes.length - 1;
  let ans = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (idx.starts[mid] <= offset) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  const node = idx.nodes[ans];
  return { node, local: Math.max(0, Math.min(offset - idx.starts[ans], node.length)) };
}

/** Offset of (node, nodeOffset) measured in characters from the start of container. */
function pointToOffset(container: HTMLElement, node: Node, nodeOffset: number): number | null {
  const idx = getIndex(container);
  const i = node.nodeType === Node.TEXT_NODE ? idx.order.get(node as Text) : undefined;
  if (i !== undefined) return idx.starts[i] + nodeOffset;

  // The point may sit on an element node (e.g. between children); approximate by
  // summing text length of everything before it.
  if (node.nodeType === Node.ELEMENT_NODE) {
    const range = document.createRange();
    range.selectNodeContents(container);
    try {
      range.setEnd(node, nodeOffset);
      return range.toString().length;
    } catch {
      return null;
    }
  }
  return null;
}

/** Selection start/end as character offsets within container, or null. */
export function getSelectionOffsets(
  container: HTMLElement,
): { start: number; end: number; text: string } | null {
  const sel = window.getSelection();
  // Cheap guards first — a plain click fires mouseup too, and must not pay for
  // an index lookup.
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) return null;
  const start = pointToOffset(container, range.startContainer, range.startOffset);
  const end = pointToOffset(container, range.endContainer, range.endOffset);
  if (start == null || end == null || start === end) return null;
  return { start: Math.min(start, end), end: Math.max(start, end), text: sel.toString() };
}

/** Rebuild a DOM Range for the given character offsets within container. */
export function buildRange(container: HTMLElement, start: number, end: number): Range | null {
  const idx = getIndex(container);
  if (start >= end || start < 0 || start > idx.total) return null;
  const a = nodeAt(idx, start);
  const b = nodeAt(idx, Math.min(end, idx.total));
  if (!a || !b) return null;
  const range = document.createRange();
  try {
    range.setStart(a.node, a.local);
    range.setEnd(b.node, b.local);
    return range.collapsed ? null : range;
  } catch {
    return null;
  }
}

/** Character offset under a screen point (for click-to-edit hit testing). */
export function offsetFromPoint(container: HTMLElement, x: number, y: number): number | null {
  const doc = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  };
  if (doc.caretRangeFromPoint) {
    const r = doc.caretRangeFromPoint(x, y);
    if (!r) return null;
    return pointToOffset(container, r.startContainer, r.startOffset);
  }
  if (doc.caretPositionFromPoint) {
    const p = doc.caretPositionFromPoint(x, y);
    if (!p) return null;
    return pointToOffset(container, p.offsetNode, p.offset);
  }
  return null;
}

/** Fallback range for legacy highlights that only stored text (no offsets). */
export function firstTextRange(container: HTMLElement, text: string): Range | null {
  const needle = text.trim();
  if (!needle) return null;
  const idx = getIndex(container);
  // Cached with the index — legacy highlights would otherwise rebuild the
  // container's full text string once each, on every repaint.
  if (idx.text == null) idx.text = idx.nodes.map((n) => n.data).join("");
  const at = idx.text.toLowerCase().indexOf(needle.toLowerCase());
  if (at === -1) return null;
  return buildRange(container, at, at + needle.length);
}
