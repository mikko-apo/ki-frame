import type { Unsub } from "../channel";
import type { Destroyable } from "../promiseDestroy";

export class StrongOrWeakSet<T extends object> implements Destroyable {
  private items?: Set<T | WeakRef<T>>;
  public coerce?: "weak" | "strong";

  constructor(mode?: "weak" | "strong") {
    this.coerce = mode;
  }

  public *all() {
    if (this.items) {
      for (const i of this.items) {
        if (i instanceof WeakRef) {
          const deref = i.deref();
          if (deref === undefined) {
            this.items.delete(i);
          } else {
            yield deref;
          }
        } else {
          yield i;
        }
      }
    }
  }

  add(item: T, itemMode = this.coerce): Unsub {
    const weakRef = new WeakRef(item);
    const unsub = () => {
      const deref = weakRef.deref();
      if (deref) {
        this.delete(deref);
      }
    };
    for (const i of this.all()) {
      if (i === item) {
        return unsub;
      }
    }
    const newItem = itemMode === "weak" ? weakRef : item;
    if (!this.items) {
      this.items = new Set<T | WeakRef<T>>();
    }
    this.items.add(newItem);
    return unsub;
  }

  delete(item: T): void {
    if (this.items) {
      for (const i of this.items) {
        if (i instanceof WeakRef) {
          const deref = i.deref();
          if (deref === undefined || deref === item) {
            this.items.delete(i);
          }
        } else {
          if (i === item) {
            this.items.delete(i);
          }
        }
      }
      if (this.items.size === 0) {
        this.destroy();
      }
    }
  }

  destroy(): void {
    if (this.items) {
      this.items.clear();
      this.items = undefined;
    }
  }
}

export class DestroyableSet<T extends Destroyable> extends StrongOrWeakSet<T> {
  override destroy() {
    for (const destroyable of this.all()) {
      try {
        destroyable.destroy();
      } catch (err) {
        console.error(`Error in destroying item`, err);
      }
    }
    super.destroy();
  }
}
