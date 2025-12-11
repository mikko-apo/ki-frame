import type { Unsub } from "./channel";
import { type Context, State, type StateOptions } from "./state";
import { copyAndSet } from "./util";

class FormsInput<N extends Node, K extends keyof HTMLElementEventMap, V = string> {
  constructor(
    public node: N,
    public key: K,
    public map?: (value: string) => V,
    public validate?: (value: V, node: N, ev: HTMLElementEventMap[K]) => boolean,
  ) {}
}

// ---------- MapReturn: prefer explicit `.map`, then FormsInput's V, then string ----------
type MapReturn<T> =
  // object-literal with a `.map` function (highest priority for direct literals)
  T extends { map: (v: string) => infer R }
    ? R
    : // if T is already a FormsInput generic, extract V
      T extends FormsInput<any, any, infer V>
      ? V
      : // fallback
        string;

// ---------- Recursive mapping: InputTree -> State shape ----------
export type StateFromInputTree<T> =
  // leaf node
  T extends FormsInput<any, any, any>
    ? MapReturn<T>
    : // recursive object
      { [K in keyof T]: StateFromInputTree<T[K]> };

export function formEvent<N extends Node, K extends keyof HTMLElementEventMap, V = string>(
  node: N,
  key: K,
  map: (value: string) => V,
  validate?: (value: V, node: N, ev: HTMLElementEventMap[K]) => boolean,
) {
  return new FormsInput(node, key, map, validate);
}

type PathTuple = [path: string, input: FormsInput<any, any, any>];

function collectFormsInputs(root: unknown): PathTuple[] {
  const out: PathTuple[] = [];

  function visit(node: any, pathParts: (string | number)[]) {
    if (node == null) return;

    if (node instanceof FormsInput) {
      // join path parts into dotted path; numbers become indices
      const path = pathParts.map((p) => String(p)).join(".");
      out.push([path, node]);
      return;
    }

    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) {
        visit(node[i], [...pathParts, i]);
      }
      return;
    }

    if (typeof node === "object") {
      for (const key of Object.keys(node)) {
        visit((node as any)[key], [...pathParts, key]);
      }
      return;
    }

    // primitives: ignore
  }

  visit(root, []);
  return out;
}

export function formInput<N extends Node, K extends keyof HTMLElementEventMap, V = string>(
  node: N,
  key: K,
  map: (value: string) => V,
  validate?: (value: V, node: N, ev: HTMLElementEventMap[K]) => boolean,
) {
  return new FormsInput(node, key, map, validate);
}

// convenience to read raw value
function readRaw(node: Node): string {
  const anyNode = node as any;
  if ("value" in anyNode && typeof anyNode.value === "string") return anyNode.value;
  return String((node as Element).textContent ?? "");
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
    this.attachListeners(inputs, validate);
  }

  private attachListeners(inputs: PathTuple[], validate?: (value: StateFromInputTree<T>) => boolean) {
    for (const [path, input] of inputs) {
      this.addDomEvent(path, input.node, input.key, (ev: Event) => {
        const value = input.map ? input.map(readRaw(input.node)) : readRaw(input.node);
        console.log(`dom event ${path} ${input.key} value ${value}`);
        if (input.validate && !input.validate(value, input.node, ev)) {
          console.log(`Validating ${input.key} value ${value}: false`);
          return;
        }
        const newState = copyAndSet(this.get(), path, value);
        if (validate && !validate(newState)) {
          console.log(`Validating state: false`, newState);
          return;
        }
        this.set(newState);
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
