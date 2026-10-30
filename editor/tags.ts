import type { Note } from '../src/lib/storage'

export const TAG_COLORS = ['gray', 'red', 'orange', 'green', 'blue', 'purple'] as const
export type TagColor = typeof TAG_COLORS[number]

export function setTagColor(note: Note, tagName: string, color: TagColor): Note {
  return { ...note, tags: note.tags.map((tag) => tag.name === tagName ? { ...tag, color } : tag) }
}
