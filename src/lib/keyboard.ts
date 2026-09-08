// Shared keyboard-shortcut helpers.

/**
 * True when a key event should be left to the focused editable element.
 * Undo/redo and select-all all mean something different inside a text field,
 * and the markdown editor is a plain <textarea> relying on native undo.
 */
export function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  const tag = el.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || el.isContentEditable;
}

/** True on macOS, where the shortcut modifier is Cmd rather than Ctrl. */
export const isMac =
  typeof navigator !== "undefined" &&
  /mac|iphone|ipad|ipod/i.test(navigator.platform || navigator.userAgent);

/** "⌘" on macOS, "Ctrl" elsewhere — for rendering shortcut hints. */
export const modKeyLabel = isMac ? "⌘" : "Ctrl+";

/** True when the platform's shortcut modifier is held (Cmd on macOS, Ctrl elsewhere). */
export const hasModKey = (e: KeyboardEvent) => (isMac ? e.metaKey : e.ctrlKey);
