import { useCallback, useMemo, useReducer } from "react";

// Undo/redo over a single piece of state, held as past/present/future stacks.
//
// The whole history lives in one reducer rather than in refs alongside a
// useState, so every transition is a pure function of the previous history.
// Refs mutated inside a state updater would double-push under StrictMode's
// double-invoked updaters, quietly corrupting the stack in development.

export interface History<T> {
  past: T[];
  present: T;
  future: T[];
}

type Updater<T> = T | ((prev: T) => T);

type Action<T> =
  | { type: "set"; next: Updater<T>; limit: number }
  | { type: "amend"; next: Updater<T> }
  | { type: "reset"; next: T }
  | { type: "undo" }
  | { type: "redo" };

const apply = <T>(next: Updater<T>, prev: T): T =>
  typeof next === "function" ? (next as (p: T) => T)(prev) : next;

/** Exported for tests; the hook below is a thin wrapper over this. */
export function reducer<T>(state: History<T>, action: Action<T>): History<T> {
  switch (action.type) {
    case "set": {
      const present = apply(action.next, state.present);
      // A no-op write shouldn't cost an undo step.
      if (Object.is(present, state.present)) return state;
      const past = [...state.past, state.present];
      // Bound the stack; a long reading session shouldn't grow it forever.
      if (past.length > action.limit) past.splice(0, past.length - action.limit);
      return { past, present, future: [] };
    }
    // A correction the user didn't make (re-anchoring a highlight after the
    // document was edited) updates the present without becoming an undo step —
    // pressing undo should walk back the reader's own actions, nothing else.
    case "amend": {
      const present = apply(action.next, state.present);
      if (Object.is(present, state.present)) return state;
      return { ...state, present };
    }
    // Loading a different document replaces the state outright — its history
    // belongs to the old document and must not be undoable into this one.
    case "reset":
      return { past: [], present: action.next, future: [] };
    case "undo": {
      if (!state.past.length) return state;
      const present = state.past[state.past.length - 1];
      return {
        past: state.past.slice(0, -1),
        present,
        future: [state.present, ...state.future],
      };
    }
    case "redo": {
      if (!state.future.length) return state;
      const [present, ...future] = state.future;
      return { past: [...state.past, state.present], present, future };
    }
  }
}

export interface HistoryState<T> {
  state: T;
  /** Record a new value as an undoable step. Accepts a value or an updater. */
  set: (next: Updater<T>) => void;
  /** Update the value without adding an undo step (automatic corrections). */
  amend: (next: Updater<T>) => void;
  /** Replace the value and discard the history (document/workspace swap). */
  reset: (next: T) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function useHistory<T>(initial: T, limit = 100): HistoryState<T> {
  const [history, dispatch] = useReducer(reducer<T>, {
    past: [],
    present: initial,
    future: [],
  } as History<T>);

  const set = useCallback((next: Updater<T>) => dispatch({ type: "set", next, limit }), [limit]);
  const amend = useCallback((next: Updater<T>) => dispatch({ type: "amend", next }), []);
  const reset = useCallback((next: T) => dispatch({ type: "reset", next }), []);
  const undo = useCallback(() => dispatch({ type: "undo" }), []);
  const redo = useCallback(() => dispatch({ type: "redo" }), []);

  return useMemo(
    () => ({
      state: history.present,
      set,
      amend,
      reset,
      undo,
      redo,
      canUndo: history.past.length > 0,
      canRedo: history.future.length > 0,
    }),
    [history, set, amend, reset, undo, redo],
  );
}
