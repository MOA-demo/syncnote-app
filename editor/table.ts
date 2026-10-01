export function insertTable(rows = 3, cols = 3): string {
  const rowCount = Math.max(1, Math.floor(Number.isFinite(rows) ? rows : 3))
  const colCount = Math.max(1, Math.floor(Number.isFinite(cols) ? cols : 3))
  const line = (cells: string[]) => `| ${cells.join(' | ')} |`
  const header = line(Array.from({ length: colCount }, (_, index) => `항목 ${index + 1}`))
  const separator = line(Array.from({ length: colCount }, () => '---'))
  const emptyRow = line(Array.from({ length: colCount }, () => ' '))
  return [header, separator, ...Array.from({ length: rowCount }, () => emptyRow)].join('\n')
}

export function isTableCommand(line: string): boolean {
  return line.trim() === '/표'
}
