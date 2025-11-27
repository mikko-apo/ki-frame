import { Channel, type Unsub } from "./channel";
import type { Destroyable, EventListenerInfo, EventSource, State } from "./types";
import { createId } from "./util";

type ChangeCb<T> = (obj: T, old: T) => void;
type DestroyCb = () => void;

function shallowEqual(a: unknown, b: unknown) {
  return a === b;
}

export function createState<Value>(initialValue: Value, options?: { name?: string; weakRef?: boolean }): State<Value> {
  const { name = "state", weakRef = false } = options ?? {};
  const stateId = createId(name);
  let value: Value = initialValue;
  let destroyed = false;

  const onChange = new Channel<[Value, Value]>(`${stateId}-onChange`);
  const onDestroy = new Channel<[]>(`${stateId}-onDestroy`);
  const destroyables = new Set<Destroyable>();
  const notifyChange = (newV: Value, oldV: Value) => onChange.publish(newV, oldV);

  const idTxt = (txt: string) => `${stateId}: ${txt}`;
  const eventListeners: EventListenerInfo<any>[] = [];
  const eventSources: EventSource<any>[] = [];
  const state: State<Value> = {
    describe() {
      return {
        eventListeners,
        name: stateId,
      };
    },
    get() {
      if (destroyed) throw new Error(idTxt("State destroyed. Cannot get value"));
      return value;
    },

    set(newObj: Value) {
      if (destroyed) throw new Error(idTxt("State destroyed. Cannot set value"));
      const old = value;
      if (shallowEqual(old, newObj)) return;
      value = newObj;
      notifyChange(value, old);
    },

    modify(fn: (cur: Value) => Value) {
      if (destroyed) throw new Error(idTxt("State destroyed. Cannot modify"));
      const next = fn(value);
      state.set(next);
    },

    refresh() {
      notifyChange(value, value);
    },

    onValueChange(cb: ChangeCb<Value>): Unsub {
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

    addToDestroy(target: Destroyable): Unsub {
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
    ): void {
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
    }
  };
  return state;
}
