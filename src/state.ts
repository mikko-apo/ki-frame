import { Channel, type Unsub, type UnwrapMaybeTuple } from "./channel";
import type { ErrorResponse, FetchOptions } from "./fetch";
import { collectFormsInputs, type PathTuple, readRaw, type StateFromInputTree } from "./form";
import {
  type CallbackInfo,
  type Destroyable,
  FetchDestroyable,
  PromiseDestroy,
  TimeoutDestroyable,
} from "./promiseDestroy";
import type { DestroyCb, EventSource } from "./types";
import { createId } from "./util/objectIdCounter";
import { copyAndSet } from "./util/setByPath";
import { DestroyableSet } from "./util/strongOrWeakSet";
import { isDefined } from "./util/typeUtils";

function shallowEqual(a: unknown, b: unknown) {
  return a === b;
}

export interface StateOptions {
  name?: string;
  weakRef?: boolean;
}

type ControllerDefaultEventShapes = [Readonly<{ type: "updateUi" }>];

type EventInfo = {
  process: boolean;
  passthrough: boolean;
};

type LinkControllerOptions = {
  events?: {
    updateUi?: boolean | EventInfo;
    valueChange?: boolean | EventInfo;
    destroy?: boolean | EventInfo;
  };
};

interface LinkedController extends LinkControllerOptions {
  controller: Controller;
}

export class Context implements Destroyable {
  constructor(
    public readonly parent?: Context,
    public readonly controllers = new DestroyableSet<Context>("weak"),
  ) {}

  createController(options?: StateOptions) {
    const controller = new Controller(this, options);
    this.controllers.add(controller);
    return controller;
  }

  createState<Value>(initialValue: Value, options?: StateOptions): State<Value> {
    const state = new State(this, initialValue, options);
    this.controllers.add(state);
    return state;
  }

  createForm<T extends Record<string, any>>(
    t: T,
    init: StateFromInputTree<T>,
    options?: {
      validate?: (value: StateFromInputTree<T>) => boolean;
    } & StateOptions,
  ): FormState<T> {
    const form = new FormState(this, t, init, options);
    this.controllers.add(form);
    return form;
  }

  destroy(): void {
    this.parent?.controllers.delete(this);
    this.controllers.destroy();
  }
}

export class Controller extends Context {
  private options: Required<StateOptions>;
  private _destroyed = false;
  private readonly _stateId: string;
  private outputChannel?: Channel<ControllerDefaultEventShapes>;
  private registeredSources = new DestroyableSet<TimeoutDestroyable | FetchDestroyable<any>>();
  private onDestroyListeners = new DestroyableSet<Destroyable>();
  private linkedStates = new Set<LinkedController>();
  private eventSources: EventSource<any>[] = [];

  constructor(parent: Context, options?: StateOptions) {
    super(parent, new DestroyableSet<Context>());
    const { name = "state", weakRef = false } = options ?? {};
    this.options = { name, weakRef };
    this._stateId = createId(name);
  }

  private getOutputChannel() {
    if (!isDefined(this.outputChannel)) {
      this.outputChannel = new Channel<ControllerDefaultEventShapes>(`${this.stateId}-onChange`);
    }
    return this.outputChannel;
  }

  get stateId() {
    return this._stateId;
  }

  get destroyed(): boolean {
    return this._destroyed;
  }

  idTxt(txt: string) {
    return `${this.stateId}: ${txt}`;
  }

  describe() {
    return {
      name: this.stateId,
    };
  }

  updateUi() {
    if (this.outputChannel) {
      this.outputChannel.publish({ type: "updateUi" });
    }
  }

  subscribe(cb: (events: UnwrapMaybeTuple<ControllerDefaultEventShapes>) => void): Unsub {
    if (this.destroyed) throw new Error(this.idTxt("Cannot subscribe to destroyed state"));
    return this.getOutputChannel().subscribe(cb);
  }

  addLinkedState<V extends Controller>(controller: V, options?: LinkControllerOptions) {
    this.linkedStates.add({ controller, ...(options || {}) });
  }

  onDestroy(target: Destroyable | DestroyCb): Unsub {
    if (typeof target === "function") {
      if (this.destroyed) {
        target();
        return () => {};
      }
      const info: CallbackInfo = {
        type: "function",
        destroy: target as unknown as () => void,
      };

      return this.onDestroyListeners.add(info);
    } else {
      if (this.destroyed) {
        target.destroy();
        return () => {};
      }
      return this.onDestroyListeners.add(target);
    }
  }

  /** Notify onDestroy() subscribers and call .destroy() for all attached states.
   * For an attached state also removes the state from parent.
   * Safe to call multiple times.
   **/
  override destroy() {
    super.destroy();
    if (this.destroyed) return;
    this._destroyed = true;
    // Go through linked states
    for (const linkedState of Array.from(this.linkedStates)) {
      if (!isDefined(linkedState?.events?.destroy) || linkedState.events.destroy) {
        linkedState.controller.destroy();
      }
    }
    // registered registeredSources & subcribed functions
    this.registeredSources.destroy();
    this.onDestroyListeners.destroy();
    for (const es of this.eventSources) {
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
    // Clear subscribers to help GC
    this.outputChannel?.destroy();
    this.eventSources.length = 0;
  }

  addDomEvent<K extends keyof HTMLElementEventMap>(
    name: string,
    node: Node,
    type: K,
    listener: (ev: HTMLElementEventMap[K]) => void | EventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ): Unsub {
    node.addEventListener(type, listener as EventListenerOrEventListenerObject | null, options);
    const unsub = () => node.removeEventListener(type, listener as EventListenerOrEventListenerObject | null, options);
    if (this.options.weakRef) {
      this.eventSources.push({
        name: `${name}: <${node.nodeName}>.${type} -> ${this.stateId}`,
        type: "dom",
        source: new WeakRef(node),
        weakRefUnsub: new WeakRef(unsub),
      });
    } else {
      this.eventSources.push({
        name: `${name}: <${node.nodeName}>.${type} -> ${this.stateId}`,
        type: "dom",
        source: new WeakRef(node),
        unsub,
      });
    }
    return unsub;
  }

  timeout(fn: Unsub, at = 0): Unsub {
    const unregisterDestroyableAndCallItsDestroy = this.registeredSources.add(
      new TimeoutDestroyable(() => {
        unregisterDestroyableAndCallItsDestroy();
        fn();
      }, at),
    );
    return unregisterDestroyableAndCallItsDestroy;
  }

  fetch<T>(
    url: string,
    fetchOptions?: FetchOptions & {
      map?: (res: Promise<Response>) => T | Promise<T>;
    },
  ): PromiseDestroy<T> | PromiseDestroy<Response> {
    const { timeoutMs, map, assertOk = true, ...fetchInit } = fetchOptions ?? {};
    const createAbortController = (destroy: Unsub): [AbortController, Unsub] => {
      const abortController = new AbortController();
      const destroyAbortController = () => {
        timeoutUnsub();
        abortController.abort();
        destroy();
      };
      const timeoutUnsub = this.timeout(destroyAbortController, timeoutMs);
      return [abortController, destroyAbortController];
    };

    const [abortController, destroyAbortController] = isDefined(timeoutMs)
      ? createAbortController(() => unregisterDestroyableAndCallItsDestroy())
      : [];

    const response = fetch(url, { ...fetchInit, signal: abortController?.signal });
    const maybeOkResponse = assertOk
      ? response.then((response: Response): Response => {
          if ((typeof assertOk === "function" && assertOk(response) === false) || !response.ok) {
            const cause: ErrorResponse = { errorResponse: response };
            throw cause;
          }
          return response;
        })
      : response;

    // destroy() is called when state.destroy() has been called
    // destroy() is called when timer aborts
    const unregisterDestroyableAndCallItsDestroy = this.registeredSources.add(
      new FetchDestroyable(url, timeoutMs, maybeOkResponse, () => {
        unregisterDestroyableAndCallItsDestroy();
        destroyAbortController?.();
      }),
    );
    // destroy() is called when promise has completed
    maybeOkResponse.finally(unregisterDestroyableAndCallItsDestroy);

    // destroy is called when returned destroy has been called by fetch's caller
    if (map) {
      const mappedPromise: Promise<T> = (async () => {
        return map(maybeOkResponse);
      })();
      return new PromiseDestroy(mappedPromise, unregisterDestroyableAndCallItsDestroy);
    }
    return new PromiseDestroy(maybeOkResponse, unregisterDestroyableAndCallItsDestroy);
  }
}

export class State<Value> extends Controller {
  public value: Value;
  private onChange?: Channel<[Readonly<Value>, Readonly<Value>]>;

  constructor(parent: Context, initialValue: Value, options?: StateOptions) {
    super(parent, options);
    this.value = initialValue;
  }

  get() {
    if (this.destroyed) throw new Error(this.idTxt("State destroyed. Cannot get value"));
    return this.value;
  }

  private getOnChange() {
    if (!isDefined(this.onChange)) {
      this.onChange = new Channel<[Readonly<Value>, Readonly<Value>]>(`${this.stateId}-onChange`);
    }
    return this.onChange;
  }

  set(newObj: Value) {
    if (this.destroyed) throw new Error(this.idTxt("State destroyed. Cannot set value"));
    const old = this.value;
    if (shallowEqual(old, newObj)) return;
    this.value = newObj;
    this.getOnChange().publish(newObj, old);
  }

  modify(fn: (cur: Value) => Value) {
    if (this.destroyed) throw new Error(this.idTxt("State destroyed. Cannot modify"));
    const next = fn(this.value);
    this.set(next);
  }

  onValueChange(cb: (obj: Value, old: Value) => void): Unsub {
    if (this.destroyed) throw new Error(this.idTxt("Cannot subscribe to destroyed state"));
    return this.getOnChange().subscribe(cb);
  }

  override destroy() {
    super.destroy();
    this.onChange?.destroy();
  }
}

export class FormState<T extends Record<string, any>> extends State<StateFromInputTree<T>> {
  constructor(
    parent: Context,
    t: T,
    init: StateFromInputTree<T>,
    options?: { validate?: (value: StateFromInputTree<T>) => boolean } & StateOptions,
  ) {
    const { validate, ...stateOptions } = options || {};
    super(parent, init, stateOptions);
    const inputs = collectFormsInputs(t);
    if (validate) {
      const validInputValuesState = this.createState(init, { name: "valid input values" });
      validInputValuesState.onValueChange((newState) => {
        if (!validate(newState)) {
          return;
        }
        this.set(newState);
      });
      this.attachListeners(validInputValuesState, inputs);
    } else {
      this.attachListeners(this, inputs);
    }
  }

  private attachListeners(inputState: State<StateFromInputTree<T>>, inputs: PathTuple[]) {
    for (const [path, input] of inputs) {
      inputState.addDomEvent(path, input.node, input.key, (ev: Event) => {
        const value = input.map ? input.map(readRaw(input.node)) : readRaw(input.node);
        if (input.validate && !input.validate(value, input.node, ev)) {
          return;
        }
        const newState = copyAndSet(inputState.get(), path, value);
        inputState.set(newState);
      });
    }
  }

  onsubmit(
    root: Node,
    listener: (ev: HTMLElementEventMap["submit"]) => void,
    options?: boolean | AddEventListenerOptions,
  ): Unsub {
    return this.addDomEvent(
      "submit",
      root,
      "submit",
      (ev) => {
        ev.preventDefault();
        listener(ev);
      },
      options,
    );
  }
}
