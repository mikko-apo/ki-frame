import { Channel, type Unsub } from "./channel";
import type { Destroyable, State } from "./types";

type ChangeCb<T> = (obj: T, old: T) => void;
type DestroyCb = () => void;

function shallowEqual(a: unknown, b: unknown) {
  return a === b;
}

export function createState<Value>(initialStateObject: Value): State<Value> {
  let value: Value = initialStateObject;
  let destroyed = false;

  const onChange = new Channel<[Value, Value]>("onChange");
  const onDestroy = new Channel<[]>("onDestroy");
  const destroyables = new Set<Destroyable>();

  const notifyChange = (newV: Value, oldV: Value) => onChange.publish(newV, oldV);
  const state: State<Value> = {
    get() {
      if (destroyed) throw new Error("State destroyed. Cannot get value");
      return value;
    },

    set(newObj: Value) {
      if (destroyed) throw new Error("State destroyed. Cannot set value");
      const old = value;
      if (shallowEqual(old, newObj)) return;
      value = newObj;
      notifyChange(value, old);
    },

    modify(fn: (cur: Value) => Value) {
      if (destroyed) throw new Error("State destroyed. Cannot modify");
      const next = fn(value);
      state.set(next);
    },

    refresh() {
      notifyChange(value, value);
    },

    onChange(cb: ChangeCb<Value>): Unsub {
      if (destroyed) throw new Error("Cannot subscribe to destroyed state");
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
          console.error(`Error in state.destroy()`, err);
        }
      }
      // Clear subscribers to help GC
      destroyables.clear();
      onChange.destroy();
      onDestroy.destroy();
    },
  };
  return state;
}
