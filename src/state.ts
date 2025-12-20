import {Channel, type Unsub, type UnwrapMaybeTuple} from "./channel";
import type {FetchOptions} from "./fetch";
import {collectFormsInputs, configureInputInitialValuesListeners, InitValue, InputShape, LinkedState,} from "./form";
import {
  type CallbackInfo,
  type Destroyable,
  FetchDestroyable,
  PromiseDestroy,
  TimeoutDestroyable,
} from "./promiseDestroy";
import type {DestroyCb, EventSource} from "./types";
import {getByPath} from "./util/getByPath";
import {createId} from "./util/objectIdCounter";
import {setByPath} from "./util/setByPath";
import type {StandardSchemaV1} from "./util/standardSchema";
import {DestroyableSet} from "./util/strongOrWeakSet";
import {isDefined} from "./util/typeUtils";
import {schemaValidate, standardSchemaPathToString} from "./util/standardSchemaUtil";
import {ExtendedFormInput, OnErrorFn} from "./domBuilder";

function shallowEqual(a: unknown, b: unknown) {
  return a === b;
}

export interface ControllerOptions {
  name: string;
  weakRef: boolean;
}

type OnValidationFailure = (failure: StandardSchemaV1.FailureResult) => void;

export interface StateOptions<SchemaOutput = never> extends Partial<ControllerOptions> {
  // schema can be used by any state
  schema?: StandardSchemaV1<unknown, SchemaOutput>;
  // onValidateFailure can be used by any state
  onValidateFailure?: OnValidationFailure;
  // onError is used by FormState
  onError?: OnErrorFn;
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
  ) {
  }

  createController(options?: ControllerOptions) {
    const controller = new Controller(this, options);
    this.controllers.add(controller);
    return controller;
  }

  createState<Value>(initialValue: Value, options?: StateOptions<Value>): State<Value> {
    const state = new State(this, initialValue, options);
    this.controllers.add(state);
    return state;
  }

  createForm<IS extends InputShape, SchemaOutput = never>(
    inputShape: IS,
    initValuesOrLinkedState:
      | InitValue<IS, SchemaOutput>
      | LinkedState<IS, SchemaOutput>,
    options?: StateOptions<InitValue<IS, SchemaOutput>>
  ) {
    const form = new FormState(this, inputShape, initValuesOrLinkedState, options);
    this.controllers.add(form);
    return form;
  }

  destroy(): void {
    this.parent?.controllers.delete(this);
    this.controllers.destroy();
  }
}

export class Controller extends Context {
  public readonly options: ControllerOptions;
  private _destroyed = false;
  private readonly _stateId: string;
  private outputChannel?: Channel<ControllerDefaultEventShapes>;
  private registeredSources = new DestroyableSet<TimeoutDestroyable | FetchDestroyable<any>>();
  private onDestroyListeners = new DestroyableSet<Destroyable>();
  private linkedStates = new Set<LinkedController>();
  private eventSources: EventSource<any>[] = [];

  constructor(parent: Context, options?: Partial<ControllerOptions>) {
    super(parent, new DestroyableSet<Context>());
    const {name = "state", weakRef = false} = options ?? {};
    this.options = {name, weakRef};
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
      this.outputChannel.publish({type: "updateUi"});
    }
  }

  subscribe(cb: (events: UnwrapMaybeTuple<ControllerDefaultEventShapes>) => void): Unsub {
    if (this.destroyed) throw new Error(this.idTxt("Cannot subscribe to destroyed state"));
    return this.getOutputChannel().subscribe(cb);
  }

  addLinkedState<V extends Controller>(controller: V, options?: LinkControllerOptions): Unsub {
    const value = {controller, ...(options || {})};
    this.linkedStates.add(value);
    return () => this.linkedStates.delete(value);
  }

  onDestroy(target: Destroyable | DestroyCb): Unsub {
    if (typeof target === "function") {
      if (this.destroyed) {
        target();
        return () => {
        };
      }
      const info: CallbackInfo = {
        type: "function",
        destroy: target as unknown as () => void,
      };

      return this.onDestroyListeners.add(info);
    } else {
      if (this.destroyed) {
        target.destroy();
        return () => {
        };
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
    this.linkedStates.clear();
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
    listener: ((ev: HTMLElementEventMap[K]) => void) | EventListenerObject | null,
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
    const {timeoutMs, map, assertOk = true, ...fetchInit} = fetchOptions ?? {};
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

    const response = fetch(url, {...fetchInit, signal: abortController?.signal});
    const maybeOkResponse = assertOk
      ? response.then((response: Response): Response => {
        if ((typeof assertOk === "function" && assertOk(response) === false) || !response.ok) {
          throw {errorResponse: response};
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
  protected schema?: StandardSchemaV1<unknown, Value>;
  private onValidateFailure?: OnValidationFailure;

  constructor(parent: Context, initialValue: Value, options?: StateOptions<Value>) {
    super(parent, options);
    this.schema = options?.schema;
    this.onValidateFailure = options?.onValidateFailure;
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

  set(newObj: Value | ((cur: Value) => Value), onValidateFailure?: OnValidationFailure) {
    if (this.destroyed) throw new Error(this.idTxt("State destroyed. Cannot set() value"));
    const old = this.value;
    const finalObj: Value = typeof newObj === "function" ? (newObj as (cur: Value) => Value)(this.value) : newObj;
    if (shallowEqual(old, finalObj)) return;
    const setAndPublish = () => {
      this.value = finalObj;
      this.getOnChange().publish(finalObj, old);
    };
    if (this.schema) {
      schemaValidate(this.schema, finalObj, setAndPublish, (failure) => {
        this.onValidateFailure?.(failure);
        onValidateFailure?.(failure);
      })
    } else {
      setAndPublish();
    }
  }

  update(update: Value | Partial<Value> | ((cur: Value) => Value | Partial<Value>), onValidateFailure?: OnValidationFailure) {
    if (this.destroyed) throw new Error(this.idTxt("State destroyed. Cannot update() value"));
    const finalUpdate =
      typeof update === "function" ? (update as (cur: Value) => Value | Partial<Value>)(this.value) : update;
    this.set({...this.value, ...finalUpdate}, onValidateFailure);
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

export class FormState<
  IS extends InputShape,
  SchemaOutput = never
> extends State<InitValue<IS, SchemaOutput>> {
  constructor(
    parent: Context,
    inputShape: IS,
    initValuesOrLinkedState:
      | InitValue<IS, SchemaOutput>
      | LinkedState<IS, SchemaOutput>,
    options?: StateOptions<InitValue<IS, SchemaOutput>>
  ) {
    const inputs = collectFormsInputs(inputShape);
    const processValidationFailure: OnValidationFailure = failure => {
      let anyPathHadIssue = false
      const pathsWithIssue = new Set(failure.issues.map(issue => standardSchemaPathToString(issue.path)));
      for (const [inputPath, input] of inputs) {
        if (input instanceof ExtendedFormInput) {
          const hasIssue = pathsWithIssue.has(inputPath)
          if(hasIssue) {
            anyPathHadIssue = true
          }
          input.callOnErrors(!pathsWithIssue.has(inputPath))
        }
      }
      options?.onError?.({isOk: anyPathHadIssue && !pathsWithIssue.has("")})
    }
    if (initValuesOrLinkedState instanceof State) {
      // this state will contain values from inputs. copy initial values from linkedState
      const sourceValuesForInputs = initValuesOrLinkedState.get();
      const init = {};
      inputs.forEach(([path]) => setByPath(init, path, getByPath(sourceValuesForInputs, path)));
      // values for inputs copied, call super()
      // TODO: there should be onValidationFailure for super if schema has been set, based on the input fields
      super(parent, init as any, options);
      configureInputInitialValuesListeners(this, inputs);
      this.onValueChange((inputValueStateThatPassSchemaValidate) => {
        // linkedState.update validationFailure should call processValidationFailure
        initValuesOrLinkedState.update(inputValueStateThatPassSchemaValidate as any, processValidationFailure);
      });
    } else {
      // if state.schema is defined for this state, create additional state for input values.
      // TODO: update should include onValidationFailure, based on the input fields and their onError
      super(parent, initValuesOrLinkedState, options);
      if (this.schema) {
        const inputValuesState = this.createState(initValuesOrLinkedState, {name: "input values"});
        inputValuesState.onValueChange((newState) => {
          // this.update validationFailure should call processValidationFailure
          this.update(newState, processValidationFailure);
        });
        configureInputInitialValuesListeners(inputValuesState, inputs);
      } else {
        // input values are set directly to this state
        configureInputInitialValuesListeners(this, inputs);
      }
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
