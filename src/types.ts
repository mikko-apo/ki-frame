import type { Unsub } from "./channel";
import type { FetchOptions } from "./fetch";
import type { PromiseDestroy } from "./promiseDestroy";

export interface Destroyable {
  destroy(): void;
}

export interface TimeoutInfo extends Destroyable {
  type: "timeout";
  at: number;
}

export interface FetchInfo extends Destroyable {
  type: "fetch";
  url: string;
}

export type Destroyables = Destroyable | TimeoutInfo | FetchInfo;

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
  addToDestroy(target: Destroyables): Unsub;

  addToParentDestroy<T>(parent: State<T>): Unsub;

  addDomEvent<K extends keyof HTMLElementEventMap>(
    name: string,
    node: EventTarget,
    type: K,
    listener: (ev: HTMLElementEventMap[K]) => any,
    options?: boolean | AddEventListenerOptions,
  ): Unsub;

  //  remove(node: Node): void
  //  onDestroyRemove<T extends Node>(node: T): T

  timeout(fn: Unsub, at?: number): Unsub;

  fetch(url: string, fetchOptions?: FetchOptions): PromiseDestroy<Response>;

  fetch<T>(
    url: string,
    fetchOptions?: FetchOptions & {
      map: (response: Promise<Response>) => T | Promise<T>;
    },
  ): PromiseDestroy<T>;
}

export interface State<T> extends Controller {
  get(): T;

  set(newObj: T): void;

  modify(fn: (cur: Readonly<T>) => T): void;

  /** Called whenever the state object changes. Returns an unsubscribe function. */
  onValueChange(cb: (obj: Readonly<T>, old: Readonly<T>) => void): Unsub;
}

export interface FormState<T> extends State<T> {
  onSubmit(
    root: EventTarget,
    listener: (ev: HTMLElementEventMap["submit"]) => void,
    options?: boolean | AddEventListenerOptions,
  ): Unsub;
}

/**
 * Extended dom node APIs can create objects that extend from this class. node() returns the underlying dom node object
 */
export class WrappedNode {
  private _node: Node;

  constructor(node: Node) {
    this._node = node;
  }

  public get node(): Node {
    return this._node;
  }
}
