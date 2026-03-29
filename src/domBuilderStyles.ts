// applyDomStyleWithArrays.ts
import type * as CSSType from 'csstype'
import { isDefined } from './util/typeUtils'

export type CssClass = string | CssClass[]

export function setClass(element: HTMLElement, argValue: CssClass) {
  const classList = element.classList
  const visit = (argValue: CssClass) => {
    if (Array.isArray(argValue)) {
      argValue.forEach((arg) => visit(arg))
    } else {
      classList.add(...argValue.split(' '))
    }
  }
  visit(argValue)
}

/**
 * Allowed value types: string | number | Array<string|number>
 */
type StyleValue = string | number | Array<string | number>
//export type StyleObject = CSS.Properties<string | number | Array<string | number>>;
export type StyleObject = (CSSType.Properties | StylesObject) | StyleObject[]

export function styles(...inputs: StyleObject[]): StylesObject {
  const flat: CSSType.Properties = {}

  for (const input of Array.from(inputs).flat()) {
    if (input instanceof StylesObject) {
      Object.assign(flat, input.styles)
    } else {
      Object.assign(flat, input)
    }
  }
  return new StylesObject(flat)
}

export class StylesObject {
  constructor(public readonly styles: CSSType.Properties) {}
}
/**
 * Set of properties that should get a "px" suffix when given a bare number.
 * Extend as needed for your project.
 */
const UNIT_PX_PROPS = new Set([
  // common layout/size props
  'width',
  'height',
  'top',
  'left',
  'right',
  'bottom',
  'minWidth',
  'minHeight',
  'maxWidth',
  'maxHeight',
  'margin',
  'marginTop',
  'marginBottom',
  'marginLeft',
  'marginRight',
  'padding',
  'paddingTop',
  'paddingBottom',
  'paddingLeft',
  'paddingRight',
  'gap',
  'rowGap',
  'columnGap',
  'fontSize',
  'borderWidth',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderRadius',
  'outlineWidth',
  'letterSpacing',
  'lineHeight',
])

/** Converts a single primitive value to string, adding "px" for numeric unit props */
function convertPrimitiveValue(prop: string, val: string | number): string {
  if (val === null || val === undefined) return ''
  if (typeof val === 'number') {
    // If prop is a custom property (`--foo`) we DO NOT add px automatically.
    if (prop.startsWith('--')) return String(val)
    // If property expects px-ish units, add "px". Otherwise use number as-is (e.g., opacity).
    if (UNIT_PX_PROPS.has(prop)) return `${val}px`
    // Some numeric-valued CSS props are allowed numbers (lineHeight, zIndex etc.)
    return String(val)
  }
  return String(val)
}

/** Flattens one level of nested arrays and converts each primitive to string */
function convertArrayValue(prop: string, arr: Array<string | number | Array<string | number>>): string {
  const flat: Array<string | number> = []
  for (const v of arr) {
    if (Array.isArray(v)) {
      for (const vv of v) flat.push(vv)
    } else {
      flat.push(v)
    }
  }
  // map each primitive to its string representation (with px if necessary)
  const parts = flat.map((p) => convertPrimitiveValue(prop, p))
  // join with comma and a space — matches how CSS accepts multiple values (fallbacks, multi-values).
  return parts.join(', ')
}

/**
 * Apply a csstype-style object to an HTMLElement, supporting array values.
 *
 * - Custom properties (keys starting with `--`) are set with `style.setProperty`.
 * - Array values are flattened one level and joined with `, `.
 * - Numeric values for unitful properties get "px".
 */
export function setStyle(el: HTMLElement, ...inputs: StyleObject[]) {
  for (const style of inputs) {
    for (const key in style) {
      // Skip prototype keys, ensure own property
      if (!Object.prototype.hasOwnProperty.call(style, key)) continue
      const raw = style[key as keyof StyleObject] as unknown as StyleValue | undefined
      if (isDefined(raw)) {
        // Handle CSS custom properties separately
        if (key.startsWith('--')) {
          if (Array.isArray(raw)) {
            const val = convertArrayValue(key, raw as any)
            el.style.setProperty(key, val)
          } else {
            const val = convertPrimitiveValue(key, raw as any)
            el.style.setProperty(key, val)
          }
          continue
        }

        // Standard camelCase style key assignment
        // If the value is array -> convert to comma-joined string
        let finalValue: string
        if (Array.isArray(raw)) {
          finalValue = convertArrayValue(key, raw as any)
        } else {
          finalValue = convertPrimitiveValue(key, raw as any)
        }

        ;(el.style as any)[key] = finalValue
      }
    }
  }
}
