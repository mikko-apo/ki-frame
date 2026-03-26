import type { Destroyable } from './promiseDestroy'
import type { State } from './state'
import { WrappedNode } from './types'
import { isDefined } from './util/typeUtils'

export type ComponentNodeTree = {
  [key: string]: Node | WrappedNode<Node> | ComponentNodeTree
}

type SetTextParams<T> = {
  [K in keyof T]?: T[K] extends Node | WrappedNode<Node>
    ? string | null | undefined
    : T[K] extends ComponentNodeTree
      ? SetTextParams<T[K]>
      : never
}

// -----------------------
// infer TRoot as a Node
// -----------------------
// - If nodes has { root: R }:
//    - if R is WrappedNode<U> and U extends Node -> TRoot = U
//    - else if R extends Node -> TRoot = R
//    - else -> TRoot = undefined
// - If nodes has no root -> TRoot = undefined
type InferRootFromNodes<TNodes> = TNodes extends { root: infer R }
  ? R extends WrappedNode<infer U>
    ? U extends Node
      ? U
      : undefined
    : R extends Node
      ? R
      : undefined
  : undefined

type SafeTextTag =
  | 'DIV'
  | 'SPAN'
  | 'P'
  | 'H1'
  | 'H2'
  | 'H3'
  | 'H4'
  | 'H5'
  | 'H6'
  | 'A'
  | 'STRONG'
  | 'EM'
  | 'CODE'
  | 'PRE'
  | 'LI'
  | 'DT'
  | 'DD'
  | 'TD'
  | 'TH'
  | 'CAPTION'
  | 'SECTION'
  | 'ARTICLE'
  | 'HEADER'
  | 'FOOTER'
  | 'MAIN'
  | 'NAV'
  | 'ASIDE'
  | 'LABEL'
  | 'LEGEND'
  | 'B'

const SAFE_TEXT_TAGS = new Set<SafeTextTag>([
  // Core text
  'DIV',
  'SPAN',
  'P',

  // Headings
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',

  // Inline
  'A',
  'STRONG',
  'EM',
  'CODE',
  'PRE',

  // Lists
  'LI',
  'DT',
  'DD',

  // Tables (cell-level only)
  'TD',
  'TH',
  'CAPTION',

  // Semantic containers
  'SECTION',
  'ARTICLE',
  'HEADER',
  'FOOTER',
  'MAIN',
  'NAV',
  'ASIDE',

  // Labels
  'LABEL',
  'LEGEND',

  // Style
  'B',
])

export function isSafeTextHTMLElement(node: Node): node is HTMLElement & { tagName: SafeTextTag } {
  return node.nodeType === Node.ELEMENT_NODE && SAFE_TEXT_TAGS.has((node as Element).tagName as SafeTextTag)
}

function setTextToNode(key: string, target: HTMLElement | Node, paramValue: unknown) {
  if (target.nodeType === Node.TEXT_NODE || isSafeTextHTMLElement(target)) {
    target.textContent = paramValue === null ? '' : String(paramValue)
  } else {
    throw new Error(
      `Node '${key}' node: ${target.nodeName} tag: '${(target as any).tagName}' does not support .textContent in a meaningful way`
    )
  }
}

function setTextRecursive(nodes: ComponentNodeTree, vals?: any) {
  if (!vals) return

  for (const key of Object.keys(vals)) {
    const paramValue = vals[key]
    const target = (nodes as any)[key]
    if (!isDefined(target)) {
      throw new Error(`Cannot set node text for node '${key}'`)
    }

    if (paramValue !== undefined) {
      if (target instanceof Node) {
        setTextToNode(key, target, paramValue)
        target.textContent = paramValue === null ? '' : paramValue.toString()
      } else if (target instanceof WrappedNode) {
        setTextToNode(key, target.node, paramValue)
      } else if (typeof paramValue === 'object') {
        setTextRecursive(target as ComponentNodeTree, paramValue)
      } else {
        throw new Error("Key '" + key + "' should be an object")
      }
    }
  }
}

function setFieldsToUndefined(obj: any) {
  if (isDefined(obj)) {
    for (const key of Object.keys(obj)) {
      obj[key] = undefined
    }
  }
}

type FunctionsTree = {
  [key: string]: ((...args: any[]) => any) | FunctionsTree
}
export type StateTree = {
  [key: string]: State<any> | StateTree
}
export type ComponentTree = {
  [key: string]: Component<any> | ComponentTree
}
type FunctionsFor<P> = P extends { functions: infer F } ? F : undefined
type StatesFor<P> = P extends { states: infer S } ? S : undefined

type ComponentParams<
  TFunctions extends FunctionsTree | undefined = undefined,
  TStates extends StateTree | undefined = undefined,
> = {
  name?: string
  functions?: TFunctions
  states?: TStates
  destroy?: Destroyable[]
  components?: ComponentTree
}

export class Component<
  TNodes extends ComponentNodeTree,
  TRoot extends Node | undefined = InferRootFromNodes<TNodes>,
  TParams extends ComponentParams<any, any> | undefined = undefined,
>
  extends WrappedNode<TRoot>
  implements Destroyable
{
  constructor(
    public readonly nodes: TNodes,
    private params?: TParams
  ) {
    super((nodes as any).root)
  }

  setText(values: SetTextParams<TNodes>) {
    setTextRecursive(this.nodes, values)
  }

  public get functions() {
    return this?.params?.functions as FunctionsFor<TParams>
  }

  public get states() {
    return this?.params?.states as StatesFor<TParams>
  }

  public get components() {
    return this?.params?.states as StatesFor<TParams>
  }

  public addName(n: string) {
    if (this.params?.name) {
      this.params.name = `${this.params?.name}:${n}`
    } else {
      this.params = { ...this.params, name: n } as any
    }
  }

  destroy(): void {
    if (this.params?.destroy) {
      for (const destroy of Array.from(this.params?.destroy)) {
        destroy.destroy()
      }
    }
    setFieldsToUndefined(this.params)
    setFieldsToUndefined(this.nodes)
  }
}
