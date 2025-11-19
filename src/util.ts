let runningId = 0;

export function createId(id: string) {
  return `${id}-${runningId++}`;
}
