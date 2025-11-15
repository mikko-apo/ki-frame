export interface State<T extends any> {
  get(): T;

  set(newObj: T): void;

  modify(fn: (cur: T) => T): void;

  /** Trigger onChange() for all subscribers. Useful for initial paint. **/
  refresh(): void;

  /** Called whenever the state object changes. Returns an unsubscribe function. */
  onChange(cb: (obj: T, old: T) => void): () => void;

  /** Notify onDestroy() subscribers and call .destroy() for all attached states.
   * For an attached state also removes the state from parent.
   * Safe to call multiple times.
   **/
  destroy(): void;

  /** Called when destroy() is invoked. Returns an unsubscribe function. */
  onDestroy(cb: () => void): () => void;

  /** Create an attached state which will be destroyed when this state is destroyed. */
  createAttachedState<U>(initial: U, name?: string): State<U>;
}

type ChangeCb<T> = (obj: T, old: T) => void;
type DestroyCb = () => void;

function shallowEqual(a: any, b: any) {
  return a === b;
}

let nextUnnamedId = 0;

export function createState<T>(initialStateObject: T): State<T> {
  let value: T = initialStateObject;
  let destroyed = false;

  const changeSubscribers = new Set<ChangeCb<T>>();
  const destroySubscribers = new Set<DestroyCb>();
  const attachedStates = new Map<string, State<any>>();

  function notifyChange(newV: T, oldV: T) {
    for (const cb of Array.from(changeSubscribers)) {
      try {
        cb(newV, oldV);
      } catch (err) {
        console.error("Error in onChange handler:", err);
      }
    }
  }

  function notifyDestroy() {
    for (const cb of Array.from(destroySubscribers)) {
      try {
        cb();
      } catch (err) {
        console.error("Error in onDestroy handler:", err);
      }
    }
  }

  return {
    get() {
      return value;
    },

    set(newObj: T) {
      if (destroyed) throw new Error("State destroyed. Cannot set value");
      const old = value;
      if (shallowEqual(old, newObj)) return;
      value = newObj;
      notifyChange(value, old);
    },

    modify(fn: (cur: T) => T) {
      if (destroyed) throw new Error("State destroyed. Cannot modify");
      const next = fn(value);
      this.set(next);
    },

    refresh() {
      notifyChange(value, value)
    },

    onChange(cb: ChangeCb<T>) {
      if (destroyed) throw new Error("Cannot subscribe to destroyed state");
      changeSubscribers.add(cb);
      return () => changeSubscribers.delete(cb);
    },

    destroy() {
      if (destroyed) return;
      destroyed = true;

      // Destroy attachedStates (make a copy first)
      for (const [name, dep] of Array.from(attachedStates.entries())) {
        try {
          dep.destroy();
        } catch (err) {
          console.error(`Error destroying attached state "${name}":`, err);
        }
        attachedStates.delete(name);
      }

      // Notify destroy subscribers
      notifyDestroy();

      // Clear subscribers to help GC
      changeSubscribers.clear();
      destroySubscribers.clear();
    },

    onDestroy(cb: DestroyCb) {
      if (destroyed) {
        // If already destroyed, call immediately (consistent behavior) and return no-op unsubscribe.
        try {
          cb();
        } catch (err) {
          console.error("Error in immediate onDestroy callback:", err);
        }
        return () => {
        };
      }
      destroySubscribers.add(cb);
      return () => destroySubscribers.delete(cb);
    },

    createAttachedState<U>(initial: U, name?: string): State<U> {
      if (destroyed) throw new Error("State destroyed. Cannot attach new state");
      const key = name ?? `state_${++nextUnnamedId}`;
      if (attachedStates.has(key)) throw new Error(`Attached state with name "${key}" already exists`);
      const newState = createState(initial);

      // When attached state is destroyed directly, remove it from parent's map to avoid memory leaks.
      newState.onDestroy(() => {
        attachedStates.delete(key);
      });

      attachedStates.set(key, newState);
      return newState;
    },
  };
}
