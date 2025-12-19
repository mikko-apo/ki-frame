import type { Unsub } from "./channel";

export type DestroyCb = () => void;

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

/**
 * Extended dom node APIs can create objects that extend from this class. node() returns the underlying dom node object
 */
export class WrappedNode<T extends Node> {
  constructor(public readonly node: T) {
  }
}
