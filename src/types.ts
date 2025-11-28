import type {Unsub} from "./channel";

export interface Destroyable {
  destroy(): void;
}

export interface EventListenerInfo<K extends keyof HTMLElementEventMap> {
  name: string;
  weakRef: WeakRef<{
    node: Node;
    type: K;
    listener: EventListenerOrEventListenerObject | null;
    options?: boolean | AddEventListenerOptions;
  }>;
}

export type EventSource<T extends object> =
  | ({ type: "dom" } & EventSourceBase<Node>)
  | ({ type: "fn" } & EventSourceBase<T>);

interface EventSourceBase<T extends object> {
  name?: string;
  unsub?: Unsub;
  weakRefUnsub?: WeakRef<Unsub>;
  source?: WeakRef<T>;
}

export interface Controller extends Destroyable {
  getId(): string;

  isDestroyed(): boolean;

  describe(): {
    name: string;
    eventListeners: EventListenerInfo<any>[];
  };

  /** Trigger onChange() for all subscribers. Useful for initial paint. **/
  refresh(): void;

  /** Called whenever the state object changes. Returns an unsubscribe function. */
  onValueChange(cb: () => void): Unsub;

  destroy(): void;

  /** Called when destroy() is invoked. Returns an unsubscribe function. */
  onDestroy(cb: () => void): Unsub;

  /** If parent.destroy() is called, parent will call childState.destroy() */
  addToDestroy(target: Destroyable): Unsub;

  addToParentDestroy<T>(parent: State<T>): Unsub;

  addDomEvent<K extends keyof HTMLElementEventMap>(
    name: string,
    node: Node,
    type: K,
    listener: (ev: HTMLElementEventMap[K]) => any,
    options?: boolean | AddEventListenerOptions,
  ): void;

  //  remove(node: Node): void
  //  onDestroyRemove<T extends Node>(node: T): T
}

export interface State<T> extends Controller {
  get(): T;

  set(newObj: T): void;

  modify(fn: (cur: T) => T): void;

  /** Called whenever the state object changes. Returns an unsubscribe function. */
  onValueChange(cb: (obj: T, old: T) => void): Unsub;
}

export class WrappedNode {
  private _node: Node;

  constructor(node: Node) {
    this._node = node;
  }

  public get node(): Node {
    return this._node;
  }
}
