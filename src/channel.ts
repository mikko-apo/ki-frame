// utils

import type { Destroyable } from "./promiseDestroy";
import { createId } from "./util/objectIdCounter";

type MaybeTuple<T> = T extends any[] ? T : T extends void ? [] : [T];
export type UnwrapMaybeTuple<M> = M extends readonly (infer U)[] ? U : M;
type SubscriberFor<P extends any[]> = (...args: P) => void | Promise<void>;
export type Unsub = () => void;

/**
 * Channel<P>
 * - P is a parameter tuple (e.g. [string, number] or [{id:number}])
 * - subscribers may be sync or async (return void or Promise<void>)
 */
export class Channel<P extends any[] = []> implements Destroyable {
  readonly id: string;
  private subs = new Set<SubscriberFor<P>>();
  private idTxt = (txt: string) => `${this.id}: ${txt}`;

  constructor(name: string) {
    this.id = createId(name);
  }

  subscribe(fn: SubscriberFor<P>): Unsub {
    this.subs.add(fn);
    return () => {
      this.unsubscribe(fn);
    };
  }

  subscribeFn(): (fn: SubscriberFor<P>) => Unsub {
    return (fn) => this.subscribe(fn);
  }

  // subscribe once: handler auto-unsubscribe after first invocation
  once(fn: SubscriberFor<P>): Unsub {
    const unsub = () => this.unsubscribe(wrapper);
    const wrapper: SubscriberFor<P> = (...args) => {
      unsub();
      fn(...args);
    };
    this.subs.add(wrapper);
    return unsub;
  }

  unsubscribe(fn: SubscriberFor<P>): void {
    this.subs.delete(fn);
  }

  // synchronous publish — invokes handlers and doesn't wait for Promises
  publish(...args: P): void {
    for (const fn of Array.from(this.subs)) {
      // call and intentionally ignore returned Promise
      try {
        fn(...args);
      } catch (err) {
        console.error(this.idTxt(`Error in channel.publish() for '${this.id}':`), err);
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

  public destroy(): void {
    for (const ch of this.map.values()) ch.destroy();
    this.map.clear();
  }
}
