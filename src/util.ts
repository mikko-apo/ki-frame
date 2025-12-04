let runningId = 0;

export function createId(id: string) {
  return `${id}-${runningId++}`;
}

/** mutates the target **/
export function setByPath(obj: any, path: string | Array<string | number>, value: any): void {
  if (typeof path === "string") {
    path = path.split(".").map((seg) => {
      // convert "0", "1", "2" to numbers for array paths
      return /^[0-9]+$/.test(seg) ? Number(seg) : seg;
    });
  }

  if (path.length === 0) return;

  let cur = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];

    // missing → create container
    if (cur[key] == null) {
      // if next key is a number -> create array
      const nextKey = path[i + 1];
      cur[key] = typeof nextKey === "number" ? [] : {};
    }

    cur = cur[key];
  }

  const lastKey = path[path.length - 1];
  cur[lastKey] = value;
}

type PathSegment = string | number;
type Path = string | PathSegment[];
/** immutable setByPath **/
export function copyAndSet<T = any>(obj: any, path: Path, value: any): T {
  // Normalize path to array of segments, convert numeric-looking strings -> numbers
  const segments: PathSegment[] = Array.isArray(path)
    ? path.map((p) => (typeof p === "string" && /^\d+$/.test(p) ? Number(p) : p))
    : path === ""
      ? []
      : path.split(".").map((seg) => (/^\d+$/.test(seg) ? Number(seg) : seg));

  if (segments.length === 0) return value;

  // Walk the original object collecting parents (may include undefined/primitives)
  const parents: any[] = [];
  let cur = obj;
  parents.push(cur);
  for (const seg of segments) {
    cur = cur !== null && typeof cur === "object" ? cur[seg as any] : undefined;
    parents.push(cur);
  }

  // Reconstruct from the bottom up without mutating originals
  let newChild: any = value;

  for (let i = segments.length - 1; i >= 0; i--) {
    const key = segments[i];
    const origParent = parents[i];

    let newParent: any;

    if (Array.isArray(origParent)) {
      // copy existing array
      newParent = origParent.slice();
    } else if (origParent !== null && typeof origParent === "object") {
      // copy existing object
      newParent = { ...origParent };
    } else {
      // original parent missing or primitive — create container based on whether key is index
      newParent = typeof key === "number" ? [] : {};
    }

    // If we are setting into an array and index > length, ensure holes exist
    if (Array.isArray(newParent) && typeof key === "number") {
      if (key >= newParent.length) {
        newParent.length = key + 1;
      }
    }

    newParent[key as any] = newChild;
    newChild = newParent;
  }

  return newChild as T;
}

export function isDefined<T>(item: T | null | undefined): item is T {
  return item !== undefined && item !== null;
}
