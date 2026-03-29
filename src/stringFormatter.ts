// sprintf-builder.ts
// TypeScript sprintf builder that accepts an object of formatters.
// Usage:
//   const { sprintf, listFormats } = createSprintf({ q: (v,s)=>`"${String(v)}"` })
//   sprintf("%s %q", "hello", "world")

export type FormatSpec = {
  key?: string // named key when using %(key)TYPE
  width?: number
  precision?: number
  raw?: string
  type: string
}

export type FormatHandler = (value: any, spec: FormatSpec) => any

export type FormatterMap = Record<string, FormatHandler>

/** Default handlers */
const defaultFormatters: FormatterMap = {
  s: (v, spec) => {
    let s = String(v ?? '')
    if (spec.precision !== undefined) s = s.slice(0, spec.precision)
    return pad(s, spec.width)
  },
  d: (v, spec) => {
    const n = Number(v)
    const s = Number.isFinite(n) ? String(Math.trunc(n)) : 'NaN'
    return pad(s, spec.width)
  },
  f: (v, spec) => {
    const n = Number(v)
    if (!Number.isFinite(n)) return pad(String(n), spec.width)
    const prec = spec.precision !== undefined ? spec.precision : 6
    const s = n.toFixed(prec)
    return pad(s, spec.width)
  },
  j: (v) => {
    try {
      return JSON.stringify(v)
    } catch {
      return String(v)
    }
  },
}

function pad(s: string, width?: number) {
  if (width === undefined || width <= s.length) return s
  return ' '.repeat(width - s.length) + s
}

function isPlainObject(v: any): v is Record<string, any> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

/**
 * createSprintf
 * @param customFormatters - object of custom handlers keyed by format name (letters only)
 * @returns { sprintf, registerFormat, unregisterFormat, listFormats }
 */
export function createFormatter(customFormatters: FormatterMap = {}) {
  // Validate keys and build registry (local to this builder)
  const registry = new Map<string, FormatHandler>()

  // helper to add map into registry (throws on invalid key)
  const addMap = (map: FormatterMap) => {
    for (const k of Object.keys(map)) {
      if (!/^[A-Za-z]+$/.test(k)) {
        throw new Error(`format key must be letters only: "${k}"`)
      }
      registry.set(k, map[k])
    }
  }

  // load defaults first, then custom overrides/extends
  addMap(defaultFormatters)
  addMap(customFormatters)

  /**
   * sprintf
   * - positional: %s %d %f ...
   * - named: %(name)s
   * - width and precision: %8.2f or %.3s
   * - type: one or more letters (must exist in registry)
   */
  function sprintf(format: string, ...args: any[]): string {
    let argIndex = 0
    let previousWasNamedArg = false

    const tokenRE =
      /%(\(([^)]+)\))?(?:(\d+)(?=(?:\.[0-9]+)?[A-Za-z][A-Za-z0-9]*))?(?:\.([0-9]+))?([A-Za-z][A-Za-z0-9]*)/g

    const result = format.replace(tokenRE, (match, _paren, name, widthStr, precStr, type) => {
      const spec: FormatSpec = {
        key: name,
        width: widthStr ? parseInt(widthStr, 10) : undefined,
        precision: precStr ? parseInt(precStr, 10) : undefined,
        raw: match,
        type,
      }

      let value: any
      if (name) {
        value = args[0] !== undefined && isPlainObject(args[argIndex]) ? args[argIndex][name] : undefined
        previousWasNamedArg = true
      } else {
        if (previousWasNamedArg) {
          argIndex++
          previousWasNamedArg = false
        }
        value = args[argIndex++]
      }

      const handler = registry.get(type)
      if (!handler) {
        // unknown token: return raw to make debugging visible
        return match
      }

      try {
        return String(handler(value, spec))
      } catch {
        return pad(String(value ?? ''), spec.width)
      }
    })

    return result
  }

  return sprintf
}
