import { Channel, type Unsub, type UnwrapMaybeTuple } from './channel'
import type { ErrorResponse, FetchOptions } from './fetch'
import { collectFormsInputs, type PathTuple, readRaw, type StateFromInputTree } from './form'
import {
  type CallbackInfo,
  type Destroyable,
  FetchDestroyable,
  PromiseDestroy,
  TimeoutDestroyable,
} from './promiseDestroy'
import type { DestroyCb, EventSource } from './types'
import { getByPath } from './util/getByPath'
import { getId } from './util/objectIdCounter'
import { copyAndSet, setByPath } from './util/setByPath'
import { DestroyableSet } from './util/strongOrWeakSet'
import { isDefined } from './util/typeUtils'

function shallowEqual(a: unknown, b: unknown) {
  return a === b
}

export interface StateOptions {
  name?: string
  weakRef?: boolean
}

type ControllerDefaultEventShapes = [Readonly<{ type: 'updateUi' }>]

type EventInfo = {
  process: boolean
  passthrough: boolean
}

type LinkControllerOptions = {
  events?: {
    updateUi?: boolean | EventInfo
    valueChange?: boolean | EventInfo
    destroy?: boolean | EventInfo
  }
}

interface LinkedController extends LinkControllerOptions {
  controller: Controller
}

export class Context implements Destroyable {
  public parent?: Context
  constructor(public readonly controllers = new DestroyableSet<Context>('weak')) {}

  createController() {
    const controller = new Controller()
    controller.parent = this
    this.controllers.add(controller)
    return controller
  }
  createState<ValueOrInput, Value>(params: {
    value: Value
    reducer: (source: ValueOrInput, cur: Value) => Value | typeof State.Never
  }): State<ValueOrInput, Value>
  createState<Value>(params?: StateParams<Value, Value>): State<Value>
  createState<Value>(): State<Value, Value | undefined>
  createState<ValueOrInput, Value>(params?: StateParams<ValueOrInput, Value>): State<ValueOrInput, Value> {
    const state = new State(params)
    state.parent = this
    this.controllers.add(state)
    return state
  }

  createForm<T extends Record<string, any>, Linked extends StateFromInputTree<T> = StateFromInputTree<T>>(
    t: T,
    initValuesOrLinkedState: StateFromInputTree<T> | State<Linked, Linked>,
    options?: {
      validate?: (value: StateFromInputTree<T>) => boolean
    }
  ): FormState<T> {
    const form = new FormState(t, initValuesOrLinkedState, options)
    form.parent = this
    this.controllers.add(form)
    return form
  }

  destroy(): void {
    this.parent?.controllers.delete(this)
    this.controllers.destroy()
  }
}

export class Controller extends Context {
  public options: Required<StateOptions> = { name: 'controller', weakRef: false }
  private _destroyed = false
  private outputChannel?: Channel<ControllerDefaultEventShapes>
  private registeredSources = new DestroyableSet<TimeoutDestroyable | FetchDestroyable<any>>()
  private onDestroyListeners = new DestroyableSet<Destroyable>()
  private linkedStates = new Set<LinkedController>()
  private eventSources: EventSource<any>[] = []
  private id = getId()

  constructor() {
    super()
  }

  private getOutputChannel() {
    if (!isDefined(this.outputChannel)) {
      this.outputChannel = new Channel<ControllerDefaultEventShapes>(`${this.stateId}-onChange`)
    }
    return this.outputChannel
  }

  get stateId() {
    return `${this.options.name}-${this.id}`
  }

  get destroyed(): boolean {
    return this._destroyed
  }

  idTxt(txt: string) {
    return `${this.stateId}: ${txt}`
  }

  describe() {
    return {
      name: this.stateId,
    }
  }

  updateUi() {
    if (this.outputChannel) {
      this.outputChannel.publish({ type: 'updateUi' })
    }
  }

  subscribe(cb: (events: UnwrapMaybeTuple<ControllerDefaultEventShapes>) => void): Unsub {
    if (this.destroyed) throw new Error(this.idTxt('Cannot subscribe to destroyed state'))
    return this.getOutputChannel().subscribe(cb)
  }

  addLinkedState<V extends Controller>(controller: V, options?: LinkControllerOptions): Unsub {
    const value = { controller, ...(options || {}) }
    this.linkedStates.add(value)
    return () => this.linkedStates.delete(value)
  }

  onDestroy(target: Destroyable | DestroyCb): Unsub {
    if (typeof target === 'function') {
      if (this.destroyed) {
        target()
        return () => {}
      }
      const info: CallbackInfo = {
        type: 'function',
        destroy: target as unknown as () => void,
      }

      return this.onDestroyListeners.add(info)
    } else {
      if (this.destroyed) {
        target.destroy()
        return () => {}
      }
      return this.onDestroyListeners.add(target)
    }
  }

  /** Notify onDestroy() subscribers and call .destroy() for all attached states.
   * For an attached state also removes the state from parent.
   * Safe to call multiple times.
   **/
  override destroy() {
    super.destroy()
    if (this.destroyed) return
    this._destroyed = true
    // Go through linked states
    for (const linkedState of Array.from(this.linkedStates)) {
      if (!isDefined(linkedState?.events?.destroy) || linkedState.events.destroy) {
        linkedState.controller.destroy()
      }
    }
    this.linkedStates.clear()
    // registered registeredSources & subcribed functions
    this.registeredSources.destroy()
    this.onDestroyListeners.destroy()
    for (const es of this.eventSources) {
      if (es.weakRefUnsub) {
        const unsub = es.weakRefUnsub.deref()
        if (unsub) unsub()
        es.weakRefUnsub = undefined
      }
      if (es.unsub) {
        es.unsub()
      }
      es.source = undefined
    }
    // Clear subscribers to help GC
    this.outputChannel?.destroy()
    this.eventSources.length = 0
  }

  addDomEvent<K extends keyof HTMLElementEventMap>(
    name: string,
    node: Node,
    type: K,
    listener: ((ev: HTMLElementEventMap[K]) => void) | EventListenerObject | null,
    options?: boolean | AddEventListenerOptions
  ): Unsub {
    node.addEventListener(type, listener as EventListenerOrEventListenerObject | null, options)
    const unsub = () => node.removeEventListener(type, listener as EventListenerOrEventListenerObject | null, options)
    if (this.options.weakRef) {
      this.eventSources.push({
        name: `${name}: <${node.nodeName}>.${type} -> ${this.stateId}`,
        type: 'dom',
        source: new WeakRef(node),
        weakRefUnsub: new WeakRef(unsub),
      })
    } else {
      this.eventSources.push({
        name: `${name}: <${node.nodeName}>.${type} -> ${this.stateId}`,
        type: 'dom',
        source: new WeakRef(node),
        unsub,
      })
    }
    return unsub
  }

  timeout(fn: Unsub, at = 0): Unsub {
    const unregisterDestroyableAndCallItsDestroy = this.registeredSources.add(
      new TimeoutDestroyable(() => {
        unregisterDestroyableAndCallItsDestroy()
        fn()
      }, at)
    )
    return unregisterDestroyableAndCallItsDestroy
  }

  fetch<T>(
    url: string,
    fetchOptions?: FetchOptions & {
      map?: (res: Promise<Response>) => T | Promise<T>
    }
  ): PromiseDestroy<T> | PromiseDestroy<Response> {
    const { timeoutMs, map, assertOk = true, ...fetchInit } = fetchOptions ?? {}
    const createAbortController = (destroy: Unsub): [AbortController, Unsub] => {
      const abortController = new AbortController()
      const destroyAbortController = () => {
        timeoutUnsub()
        abortController.abort()
        destroy()
      }
      const timeoutUnsub = this.timeout(destroyAbortController, timeoutMs)
      return [abortController, destroyAbortController]
    }

    const [abortController, destroyAbortController] = isDefined(timeoutMs)
      ? createAbortController(() => unregisterDestroyableAndCallItsDestroy())
      : []

    const response = fetch(url, {
      ...fetchInit,
      signal: abortController?.signal,
    })
    const maybeOkResponse = assertOk
      ? response.then((response: Response): Response => {
          if ((typeof assertOk === 'function' && assertOk(response) === false) || !response.ok) {
            const cause: ErrorResponse = { errorResponse: response }
            throw cause
          }
          return response
        })
      : response

    // destroy() is called when state.destroy() has been called
    // destroy() is called when timer aborts
    const unregisterDestroyableAndCallItsDestroy = this.registeredSources.add(
      new FetchDestroyable(url, timeoutMs, maybeOkResponse, () => {
        unregisterDestroyableAndCallItsDestroy()
        destroyAbortController?.()
      })
    )
    // destroy() is called when promise has completed
    maybeOkResponse.finally(unregisterDestroyableAndCallItsDestroy)

    // destroy is called when returned destroy has been called by fetch's caller
    if (map) {
      const mappedPromise: Promise<T> = (async () => {
        return map(maybeOkResponse)
      })()
      return new PromiseDestroy(mappedPromise, unregisterDestroyableAndCallItsDestroy)
    }
    return new PromiseDestroy(maybeOkResponse, unregisterDestroyableAndCallItsDestroy)
  }
}
type StateReducer<Input, Value> = (obj: Input, cur: Value) => Value | typeof State.Never

export interface StateParams<ValueOrInput, Value = ValueOrInput> {
  value?: Value
  reducer?: StateReducer<ValueOrInput, Value>
  name?: string
  parent?: Context
  debounce?: boolean
}

export type OnValueChangeParams = { noInit?: boolean }

export interface StateListener<Value> {
  onValueChange(cb: (obj: Value, old?: Value) => void, params?: OnValueChangeParams): Unsub
}

export class State<ValueOrInput, Value = ValueOrInput> extends Controller implements StateListener<Value> {
  public static readonly Never = Symbol('WritableState.Never')
  private value?: Value
  private mapFn?: (source: ValueOrInput, cur: Value) => Value | typeof State.Never
  private onChange?: Channel<[Readonly<Value>, Readonly<Value>]>

  constructor(params?: StateParams<ValueOrInput, Value>) {
    super()
    this.options.name = params?.name ?? 'state'
    this.value = params?.value
    this.parent = params?.parent
    this.mapFn = params?.reducer
  }

  get(): Value {
    if (this.destroyed) throw new Error(this.idTxt('State destroyed. Cannot get value'))
    return this.value as Value
  }

  private getOnChange() {
    if (!isDefined(this.onChange)) {
      this.onChange = new Channel<[Readonly<Value>, Readonly<Value>]>(`${this.stateId}-onChange`)
    }
    return this.onChange
  }

  set(newObj: ValueOrInput | typeof State.Never | ((cur: Value) => ValueOrInput | typeof State.Never)) {
    if (this.destroyed) throw new Error(this.idTxt('State destroyed. Cannot set() value'))
    const old = this.value
    const finalObj: Value | ValueOrInput | typeof State.Never =
      typeof newObj === 'function'
        ? (newObj as (cur: Value) => ValueOrInput | typeof State.Never)(this.value as Value)
        : newObj
    if (finalObj === State.Never) return
    const value = this.mapFn ? this.mapFn(finalObj as ValueOrInput, this.value as Value) : finalObj
    if (value !== State.Never && !shallowEqual(old, finalObj)) {
      this.value = value as Value
      this.getOnChange().publish(this.value, old ? old : (finalObj as any as Value))
    }
  }

  update(
    update: Value | typeof State.Never | Partial<Value> | ((cur: Value) => Value | Partial<Value> | typeof State.Never)
  ) {
    if (this.destroyed) throw new Error(this.idTxt('State destroyed. Cannot update() value'))
    if (this.value === undefined) throw new Error(this.idTxt('State is undefined. Can not update() value'))
    if (typeof this.value !== 'object') throw new Error(this.idTxt('State is not an object. Can not update() value'))
    if (this.mapFn !== undefined)
      throw new Error(this.idTxt("State({reducer:fn()}) function is defined. Don't call state.update()"))
    const finalUpdate =
      typeof update === 'function' ? (update as (cur: Value) => Value | Partial<Value>)(this.value) : update
    if (finalUpdate === State.Never) return
    this.set({ ...(this.value as ValueOrInput), ...finalUpdate })
  }

  onValueChange(cb: (obj: Value, old?: Value) => void, params?: OnValueChangeParams): Unsub {
    if (this.destroyed) throw new Error(this.idTxt('Cannot subscribe to destroyed state'))
    const unsub = this.getOnChange().subscribe(cb)
    if (isDefined(this.value) && !params?.noInit) {
      cb(this.value as any as Value, this.value)
    }
    return unsub
  }

  override destroy() {
    super.destroy()
    this.onChange?.destroy()
  }

  map<NewValue>(
    map: StateReducer<Value, NewValue>,
    params: Omit<StateParams<Value, NewValue>, 'reducer'> = {}
  ): State<Value, NewValue> {
    const state = new State({ ...params, reducer: map })
    this.onValueChange((obj) => {
      state.set(obj)
    })
    return state
  }
}

export class FormState<
  T extends Record<string, any>,
  Linked extends StateFromInputTree<T> = StateFromInputTree<T>,
> extends State<StateFromInputTree<T>, StateFromInputTree<T>> {
  constructor(
    t: T,
    initValuesOrLinkedState: StateFromInputTree<T> | State<Linked, Linked>,
    options?: {
      validate?: (value: StateFromInputTree<T>) => boolean
    }
  ) {
    const { validate } = options || {}
    const inputs = collectFormsInputs(t)
    if (initValuesOrLinkedState instanceof State) {
      const initState = initValuesOrLinkedState.get()
      const init = {}
      inputs.forEach(([path]) => setByPath(init, path, getByPath(initState, path)))
      super(init as StateFromInputTree<T>)
      this.configureInputs(this, inputs)
      this.onValueChange((newState) => {
        if (validate && !validate(newState)) {
          return
        }
        initValuesOrLinkedState.update(newState)
      })
    } else {
      super(initValuesOrLinkedState)
      if (validate) {
        const validInputValuesState = this.createState({ value: initValuesOrLinkedState })
        validInputValuesState.options.name = 'valid input values'
        validInputValuesState.onValueChange((newState) => {
          if (!validate(newState)) {
            return
          }
          this.set(newState)
        })
        this.configureInputs(validInputValuesState, inputs)
      } else {
        this.configureInputs(this, inputs)
      }
    }
  }

  private configureInputs(inputState: State<StateFromInputTree<T>, StateFromInputTree<T>>, inputs: PathTuple[]) {
    for (const [path, input] of inputs) {
      const state = inputState.get()
      const value = getByPath(state, path)
      if (input.node instanceof HTMLInputElement) {
        input.node.value = value as any
      }
      inputState.addDomEvent(path, input.node, input.key, (ev: Event) => {
        const value = input.map ? input.map(readRaw(input.node)) : readRaw(input.node)
        if (input.validate && !input.validate(value, input.node, ev)) {
          return
        }
        const newState = copyAndSet(inputState.get(), path, value)
        inputState.set(newState)
      })
    }
  }

  onsubmit(
    root: Node,
    listener: (ev: HTMLElementEventMap['submit']) => void,
    options?: boolean | AddEventListenerOptions
  ): Unsub {
    return this.addDomEvent(
      'submit',
      root,
      'submit',
      (ev) => {
        ev.preventDefault()
        listener(ev)
      },
      options
    )
  }
}
