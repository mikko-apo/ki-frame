export function isDefined<T>(item: T | null | undefined): item is T {
  return item !== undefined && item !== null;
}

export function typedKeys<T extends object>(obj: T): (keyof T)[] {
  return Object.keys(obj) as (keyof T)[];
}

export function typedEntries<T extends object>(obj: T): [keyof T, T[keyof T]][] {
  return Object.entries(obj) as [keyof T, T[keyof T]][];
}

export type StrictOptional<T> = {
  [K in keyof T]?: Exclude<T[K], undefined>;
};
