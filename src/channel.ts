// utils
import type { Destroyable } from "./types";

type MaybeTuple<T> = T extends any[] ? T : T extends void ? [] : [T];
type SubscriberFor<P extends any[]> = (...args: P) => void | Promise<void>;
export type Unsub = () => void;

/**
 * Channel<P>
 * - P is a parameter tuple (e.g. [string, number] or [{id:number}])
 * - subscribers may be sync or async (return void or Promise<void>)
 */
export class Channel<P extends any[] = []> implements Destroyable {
  readonly name: string;
  private subs = new Set<SubscriberFor<P>>();

  constructor(name: string) {
    this.name = name;
  }

  subscribe(fn: SubscriberFor<P>): Unsub {
    this.subs.add(fn);
    return () => {
      this.subs.delete(fn);
    };
  }

  subscribeFn(): (fn: SubscriberFor<P>) => Unsub {
    return (fn) => this.subscribe(fn);
  }

  // subscribe once: handler auto-unsubscribe after first invocation
  once(fn: SubscriberFor<P>): Unsub {
    const wrapper: SubscriberFor<P> = (...args) => {
      try {
        const r = fn(...args);
        // If handler returns Promise, ensure unsubscribe happens immediately (before awaiting)
        return r instanceof Promise
          ? r.finally(() => this.subs.delete(wrapper))
          : (this.subs.delete(wrapper), undefined);
      } finally {
        // In case fn throws synchronously
        this.subs.delete(wrapper);
      }
    };
    this.subs.add(wrapper);
    return () => this.subs.delete(wrapper);
  }

  unsubscribe(fn: SubscriberFor<P>): void {
    this.subs.delete(fn);
  }

  // synchronous publish — invokes handlers and doesn't wait for Promises
  publish(...args: P): void {
    console.log(`channel ${this.name} publish`, this.subs);
    for (const fn of Array.from(this.subs)) {
      // call and intentionally ignore returned Promise
      try {
        console.log(`channel ${this.name} publish calling fn`, fn);
        fn(...args);
        console.log(`channel ${this.name} publish returned`);
      } catch (err) {
        console.error(`Error in channel.publish() for '${this.name}':`, err);
      }
    }
  }

  // asynchronous publish — waits for all subscribers; rejects if any rejects
  async publishAsync(...args: P): Promise<void> {
    const promises = Array.from(this.subs).map(async (fn) => fn(...args));
    const settled = await Promise.allSettled(promises);
    const rejections = settled.filter((s) => s.status === "rejected") as PromiseRejectedResult[];
    if (rejections.length) {
      const err = new Error(`${rejections.length} subscriber(s) failed`);
      // Attach individual rejection reasons for inspection
      (err as any).details = rejections.map((r) => r.reason);
      throw err;
    }
  }

  destroy(): void {
    this.subs.clear();
  }
}

/**
 * ChannelRegistry<Spec>
 * - Spec: record of name -> parameter spec
 *    Spec[name] can be:
 *      - a tuple type (e.g. [string, number])
 *      - a single type (e.g. { id:number }) which will be normalized to [T]
 *      - void to represent no-args
 *
 * Examples:
 *   type Spec = {
 *     info: {id:number; msg:string}       // single param => normalized to [{id:number;msg:string}]
 *     update: [string, number]           // multi-param
 *     tick: void                         // no-arg
 *   }
 */
export class ChannelRegistry<Spec extends Record<string, any>> implements Destroyable {
  private map = new Map<keyof Spec, Channel<Spec[keyof Spec]>>();

  get<K extends keyof Spec>(name: K): Channel<MaybeTuple<Spec[K]>> {
    let ch = this.map.get(name) as Channel<MaybeTuple<Spec[K]>> | undefined;
    if (!ch) {
      ch = new Channel<MaybeTuple<Spec[K]>>(String(name));
      this.map.set(name, ch);
    }
    return ch;
  }

  subscribe<K extends keyof Spec>(name: K, fn: SubscriberFor<MaybeTuple<Spec[K]>>): Unsub {
    return this.get(name).subscribe(fn);
  }

  once<K extends keyof Spec>(name: K, fn: SubscriberFor<MaybeTuple<Spec[K]>>): Unsub {
    return this.get(name).once(fn);
  }

  subscribeFnForType<K extends keyof Spec>(name: K): (fn: SubscriberFor<MaybeTuple<Spec[K]>>) => Unsub {
    return (fn) => this.subscribe(name, fn);
  }

  unsubscribe<K extends keyof Spec>(name: K, fn: SubscriberFor<MaybeTuple<Spec[K]>>): void {
    this.get(name).unsubscribe(fn);
  }

  publish<K extends keyof Spec>(name: K, ...args: MaybeTuple<Spec[K]>): void {
    const ch = this.map.get(name);
    if (!ch) return;
    (ch as Channel<MaybeTuple<Spec[K]>>).publish(...args);
  }

  async publishAsync<K extends keyof Spec>(name: K, ...args: MaybeTuple<Spec[K]>): Promise<void> {
    const ch = this.map.get(name);
    if (!ch) return;
    await (ch as Channel<MaybeTuple<Spec[K]>>).publishAsync(...args);
  }

  // clear either a single channel or everything
  clear(name: keyof Spec): void {
    const ch = this.map.get(name);
    ch?.destroy();
    this.map.delete(name);
  }

  public destroy(): void {
    for (const ch of this.map.values()) ch.destroy();
    this.map.clear();
  }
}
