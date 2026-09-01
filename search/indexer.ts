import type { Note } from '../src/lib/storage'

const index = new Map<string, Set<string>>()

function tokenize(value: string): string[] {
  return value.toLocaleLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean)
}

export function rebuildIndex(notes: Note[]): void {
  index.clear()
  notes.forEach(addToIndex)
}

export function addToIndex(note: Note): void {
  index.set(note.id, new Set(tokenize(`${note.title} ${note.body}`)))
}

export function search(query: string): string[] {
  const terms = tokenize(query)
  return [...index.entries()]
    .filter(([, tokens]) => terms.every((term) => [...tokens].some((token) => token.startsWith(term))))
    .map(([id]) => id)
}
