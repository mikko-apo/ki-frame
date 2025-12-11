import type { Unsub } from "./channel";

export interface Destroyable {
  destroy(): void;
}

export interface FetchInfo extends Destroyable {
  type: "fetch";
  url: string;
}

export interface CallbackInfo extends Destroyable {
  type: "function";
}
/**
 * Util class for returning a promise and destroy() function
 */
export class PromiseDestroy<T> implements Promise<T>, Destroyable {
  constructor(
    /** underlying promise holding the response value */
    readonly promise: Promise<T>,
    /** cleanup / destroy function preserved across maps */
    public readonly destroy: () => void = () => {},
  ) {}

  /**
   * Promise.then implementation. Can be used to map the response to another value
   *
   * - Delegates to the internal `response` promise.
   * - Returns a NEW FetchReturn whose `response` is the mapped promise.
   * - If no handlers are provided, returns `this` (typed via cast).
   */
  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null,
  ): Promise<TResult1 | TResult2> {
    // If neither handler present, nothing to map — return this as-is.
    if (!onfulfilled && !onrejected) {
      return this.promise as unknown as PromiseDestroy<TResult1 | TResult2>;
    }

    return this.promise.then(onfulfilled, onrejected);
  }

  catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null,
  ): Promise<T | TResult> {
    if (!onrejected) {
      return this as unknown as PromiseDestroy<T | TResult>;
    }

    return this.promise.catch(onrejected);
  }

  finally(onfinally?: (() => void) | undefined | null): Promise<T> {
    return this.promise.finally(onfinally);
  }

  get [Symbol.toStringTag](): string {
    return PromiseDestroy.name;
  }

  /**
   * Optional: explicit toString which mirrors Object.prototype.toString
   */
  toString(): string {
    return Object.prototype.toString.call(this);
  }
}

export class TimeoutDestroyable implements Destroyable {
  readonly at = Date.now() + (this.timeout ?? 0);
  private readonly id = setTimeout(this.fn, this.timeout);

  constructor(
    public readonly fn: Unsub,
    public readonly timeout?: number,
  ) {}

  destroy(): void {
    clearTimeout(this.id);
  }
}

export class FetchDestroyable<T> extends PromiseDestroy<T> {
  constructor(
    public readonly url: string,
    public readonly timeoutMs: number | undefined,
    public readonly promise: Promise<T>,
    public readonly destroy: Unsub,
  ) {
    super(promise, destroy);
  }
}
