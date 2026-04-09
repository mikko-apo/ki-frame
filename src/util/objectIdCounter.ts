let runningId = 0

export function getId() {
  return runningId++
}

export function createId(id: string) {
  return `${id}-${getId()}`
}
