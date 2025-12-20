import {ExtendedFormInput} from "./domBuilder";
import {isDefined, isInstanceOfAny} from "./util/typeUtils";
import {getByPath} from "./util/getByPath";
import {copyAndSet} from "./util/setByPath";
import {State} from "./state";
import {schemaValidate} from "./util/standardSchemaUtil";

type InputElement = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement

// An Input leaf is a DOM element or your ExtendedFormInput wrapper
type InputLeaf = InputElement | ExtendedFormInput<InputElement>;

// Recursive InputShape: leaf | array | object map
export type InputShape =
  | InputLeaf
  | InputShape[] // array of recursive shape
  | { [key: string]: InputShape };

type InitFromInputShape<T> =
  T extends InputLeaf ? string :
    T extends readonly (infer U)[] ? InitFromInputShape<U>[] :
      T extends object ? { [K in keyof T]: InitFromInputShape<T[K]> } :
        never;

type HasSchema<S> = [S] extends [never] ? false : true;

export type InitValue<
  IS extends InputShape,
  SchemaOutput
> =
  HasSchema<SchemaOutput> extends true
    ? SchemaOutput
    : InitFromInputShape<IS>;

export type LinkedState<
  IS extends InputShape,
  SchemaOutput
> =
  State<
    Partial<InitValue<IS, SchemaOutput>> & Record<string, any>
  >;


export type PathTuple = [path: string, input: InputElement | ExtendedFormInput<InputElement>];
const htmlFormInputClasses = [HTMLInputElement, HTMLSelectElement, HTMLTextAreaElement]

export function collectFormsInputs(root: unknown): PathTuple[] {
  const out: PathTuple[] = [];

  function visit(node: any, pathParts: (string | number)[]) {
    if (!isDefined(node)) return;

    if (isInstanceOfAny(node, htmlFormInputClasses) || node instanceof ExtendedFormInput && isInstanceOfAny(node.node, htmlFormInputClasses)) {
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

// convenience to read raw value
export function readRaw(node: Node): string {
  const anyNode = node as any;
  if ("value" in anyNode && typeof anyNode.value === "string") return anyNode.value;
  return String((node as Element).textContent ?? "");
}

export function configureInputInitialValuesListeners(inputState: State<any>, inputs: PathTuple[]) {
  for (const [path, input] of inputs) {
    const stateValue = inputState.get();
    const inputValue = getByPath(stateValue, path);
    const extendedFormInput = input instanceof ExtendedFormInput ? input : undefined
    const node = input instanceof ExtendedFormInput ? input.node : input
    // set init value to nodes
    if (node instanceof HTMLInputElement || node instanceof HTMLSelectElement || node instanceof HTMLTextAreaElement) {
      node.name = path
      node.value = inputValue as any
    }
    inputState.addDomEvent(path, node, extendedFormInput?.event || "change", (ev: Event) => {
      const value = readRaw(node);

      const setValue = () => {
        const newState = copyAndSet(inputState.get(), path, value);
        inputState.set(newState);
      };

      if (extendedFormInput && extendedFormInput.schema && extendedFormInput.onErrors) {
        schemaValidate(extendedFormInput.schema, value, () => {
          extendedFormInput.callOnErrors(false)
          setValue()
        }, () => {
          extendedFormInput.callOnErrors(true);
        });
      } else {
        setValue();
      }
    });
  }
}

