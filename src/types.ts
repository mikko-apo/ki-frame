import type { Unsub } from "./channel";

export interface Destroyable {
  destroy(): void;
}

export interface State<T> extends Destroyable {
  get(): T;

  set(newObj: T): void;

  modify(fn: (cur: T) => T): void;

  /** Trigger onChange() for all subscribers. Useful for initial paint. **/
  refresh(): void;

  /** Called whenever the state object changes. Returns an unsubscribe function. */
  onChange(cb: (obj: T, old: T) => void): Unsub;

  destroy(): void;

  /** Called when destroy() is invoked. Returns an unsubscribe function. */
  onDestroy(cb: () => void): Unsub;

  /** If parent.destroy() is called, parent will call childState.destroy() */
  addToDestroy(target: Destroyable): Unsub;

  addToParentDestroy<T>(parent: State<T>): Unsub;
}
