// ---------- types ----------
type Path = string | Array<string | number>

// Split a dot-string literal into tuple of string segments
type SplitDot<S extends string> = S extends '' ? [] : S extends `${infer H}.${infer R}` ? [H, ...SplitDot<R>] : [S]

// Recursively resolve the path tuple against object type T
type PathValueFromTuple<T, TP extends readonly any[]> = TP extends []
  ? T
  : TP extends [infer H, ...infer R]
    ? H extends keyof T
      ? PathValueFromTuple<T[H], R>
      : H extends number // numeric string like "0"
        ? T extends readonly (infer Item)[]
          ? PathValueFromTuple<Item, R>
          : unknown
        : H extends number
          ? T extends readonly (infer Item2)[]
            ? PathValueFromTuple<Item2, R>
            : unknown
          : unknown
    : unknown

// Public PathValue: use tuple inference when possible
type PathValue<T, P extends Path> = P extends readonly any[]
  ? PathValueFromTuple<T, P>
  : P extends string
    ? PathValueFromTuple<T, SplitDot<P>>
    : unknown

// ---------- runtime: getByPath ----------

/**
 * Get a value from an object without mutating it.
 * - path can be dot-string "a.b.0.c" or an array ["a","b",0,"c"].
 * - returns undefined if any intermediate is null/undefined.
 *
 * Typed: when you pass a tuple/array literal (as const), TypeScript infers the return type.
 */
export function getByPath<T, P extends Path>(obj: T, path: P): PathValue<T, P> | undefined {
  if (obj == null) return undefined

  let segments: (string | number)[]
  if (Array.isArray(path)) {
    segments = (path as Array<string | number>).map((p) => (typeof p === 'string' && /^\d+$/.test(p) ? Number(p) : p))
  } else if (typeof path === 'string') {
    if (path === '') return obj as any
    segments = path.split('.').map((seg) => (/^\d+$/.test(seg) ? Number(seg) : seg))
  } else {
    return undefined as any
  }

  let cur: any = obj
  for (const seg of segments) {
    if (cur == null) return undefined as any
    cur = cur[seg as any]
  }
  return cur as PathValue<T, P>
}
