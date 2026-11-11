type Listener = () => void

const listeners = new Set<Listener>()

export function subscribeLocalChanges(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function emitLocalChange(): void {
  for (const listener of listeners) {
    listener()
  }
}
