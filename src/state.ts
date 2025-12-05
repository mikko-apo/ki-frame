import { Channel, type Unsub } from "./channel";
import type { ErrorResponse, FetchOptions } from "./fetch";
import { PromiseDestroy } from "./promiseDestroy";
import type { Controller, Destroyables, EventListenerInfo, EventSource, FetchInfo, State, TimeoutInfo } from "./types";
import { createId } from "./util";

type ChangeCb<T> = (obj: Readonly<T>, old: T) => void;
type DestroyCb = () => void;
export type ResponseMapper<T> = (response: Promise<Response>) => T;

function shallowEqual(a: unknown, b: unknown) {
  return a === b;
}

export interface StateOptions {
  name?: string;
  weakRef?: boolean;
}

export function createController(options?: StateOptions): Controller {
  const { name = "state", weakRef = false } = options ?? {};
  const stateId = createId(name);
  const getId = () => stateId;
  let destroyed = false;

  const onChange = new Channel<[]>(`${stateId}-onChange`);
  const onDestroy = new Channel<[]>(`${stateId}-onDestroy`);
  const destroyables = new Set<Destroyables>();
  const notifyChange = () => onChange.publish();

  const idTxt = (txt: string) => `${stateId}: ${txt}`;
  const eventListeners: EventListenerInfo<any>[] = [];
  const eventSources: EventSource<any>[] = [];
  const state: Controller = {
    getId,

    isDestroyed(): boolean {
      return destroyed;
    },

    describe() {
      return {
        eventListeners,
        name: stateId,
      };
    },

    refresh() {
      notifyChange();
    },

    onValueChange(cb: Unsub): Unsub {
      if (destroyed) throw new Error(idTxt("Cannot subscribe to destroyed state"));
      return onChange.subscribe(cb);
    },
    onDestroy(cb: DestroyCb): Unsub {
      if (destroyed) {
        // If already destroyed, call immediately (consistent behavior) and return no-op unsubscribe.
        cb();
        return () => {};
      }
      return onDestroy.subscribe(cb);
    },

    addToDestroy(target: Destroyables): Unsub {
      if (destroyed) {
        target.destroy();
        return () => {};
      }
      destroyables.add(target);
      return () => destroyables.delete(target);
    },
    addToParentDestroy<T>(parent: State<T>): Unsub {
      return state.onDestroy(parent.addToDestroy(state));
    },

    /** Notify onDestroy() subscribers and call .destroy() for all attached states.
     * For an attached state also removes the state from parent.
     * Safe to call multiple times.
     **/
    destroy() {
      if (destroyed) return;
      destroyed = true;
      // Notify own destroy subscribers
      onDestroy.publish();
      for (const destroyable of Array.from(destroyables)) {
        try {
          destroyable.destroy();
        } catch (err) {
          console.error(idTxt(`Error in state.destroy()`), err);
        }
      }
      // Clear subscribers to help GC
      destroyables.clear();
      onChange.destroy();
      onDestroy.destroy();
      for (const es of eventSources) {
        if (es.weakRefUnsub) {
          const unsub = es.weakRefUnsub.deref();
          if (unsub) unsub();
          es.weakRefUnsub = undefined;
        }
        if (es.unsub) {
          es.unsub();
        }
        es.source = undefined;
      }
    },

    addDomEvent<K extends keyof HTMLElementEventMap>(
      name: string,
      node: Node,
      type: K,
      listener: (ev: HTMLElementEventMap[K]) => void | EventListenerObject | null,
      options?: boolean | AddEventListenerOptions,
    ): Unsub {
      node.addEventListener(type, listener as EventListenerOrEventListenerObject | null, options);
      const unsub = () =>
        node.removeEventListener(type, listener as EventListenerOrEventListenerObject | null, options);
      if (weakRef) {
        eventSources.push({
          name: `${name}: <${node.nodeName}>.${type} -> ${stateId}`,
          type: "dom",
          source: new WeakRef(node),
          weakRefUnsub: new WeakRef(unsub),
        });
      } else {
        eventSources.push({
          name: `${name}: <${node.nodeName}>.${type} -> ${stateId}`,
          type: "dom",
          source: new WeakRef(node),
          unsub,
        });
      }
      return unsub;
    },
    timeout(fn: Unsub, at = 0): Unsub {
      const id = setTimeout(() => {
        destroy();
        fn();
      }, at);
      const destroy = () => {
        clearTimeout(id);
        destroyables.delete(info);
      };
      const info: TimeoutInfo = {
        type: "timeout",
        at: at + Date.now(),
        destroy,
      };
      state.addToDestroy(info);
      return destroy;
    },
    fetch<T>(
      url: string,
      fetchOptions?: FetchOptions & {
        map?: (res: Promise<Response>) => T | Promise<T>;
      },
    ): PromiseDestroy<T> | PromiseDestroy<Response> {
      const { timeoutMs, map, assertOk = true, ...fetchInit } = fetchOptions ?? {};
      const controller = new AbortController();

      const response = fetch(url, { ...fetchInit, signal: controller.signal });
      const maybeOkResponse = assertOk
        ? response.then((response: Response): Response => {
            if ((typeof assertOk === "function" && assertOk(response) === false) || !response.ok) {
              const cause: ErrorResponse = { errorResponse: response };
              throw cause;
            }
            return response;
          })
        : response;

      // destroy is called when:
      // - returned destroy has been called by fetch's caller
      // - promise has completed
      // - clear timer
      // - state.destroy() has been called
      const destroy = () => {
        controller.abort();
        timeoutUnsub?.();
        destroyables.delete(info);
      };
      const timeoutUnsub = fetchOptions?.timeoutMs ? state.timeout(destroy, fetchOptions.timeoutMs) : undefined;
      const info: FetchInfo = { type: "fetch", url, destroy };
      state.addToDestroy(info);
      maybeOkResponse.finally(destroy);

      if (map) {
        const mappedPromise: Promise<T> = (async () => {
          return map(maybeOkResponse);
        })();
        return new PromiseDestroy(mappedPromise, destroy);
      }
      return new PromiseDestroy(maybeOkResponse, destroy);
    },
  };
  return state;
}

export function createState<Value>(initialValue?: Value, options?: StateOptions): State<Value> {
  const controller = createController(options);
  let value: Value = initialValue as Value;

  const onChange = new Channel<[Value, Value]>(`${controller.getId()}-onChange`);
  const notifyChange = (newV: Value, oldV: Value) => onChange.publish(newV, oldV);

  const idTxt = (txt: string) => `${controller.getId()}: ${txt}`;
  const state: State<Value> = {
    ...controller,
    get() {
      if (controller.isDestroyed()) throw new Error(idTxt("State destroyed. Cannot get value"));
      return value;
    },

    set(newObj: Value) {
      if (controller.isDestroyed()) throw new Error(idTxt("State destroyed. Cannot set value"));
      const old = value;
      if (shallowEqual(old, newObj)) return;
      value = newObj;
      notifyChange(value, old);
    },

    modify(fn: (cur: Readonly<Value>) => Value) {
      if (controller.isDestroyed()) throw new Error(idTxt("State destroyed. Cannot modify"));
      const next = fn(value);
      state.set(next);
    },

    refresh() {
      notifyChange(value, value);
    },

    onValueChange(cb: ChangeCb<Value>): Unsub {
      if (controller.isDestroyed()) throw new Error(idTxt("Cannot subscribe to destroyed state"));
      return onChange.subscribe(cb);
    },
  };
  return state;
}
