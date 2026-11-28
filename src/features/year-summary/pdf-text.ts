/** The characters Windows-1252 (WinAnsi) has above 0x7F outside Latin-1. */
const WIN_ANSI_EXTRA = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ')

/** Letters with no decomposition into a base letter and a mark. */
const BASE_LETTERS: ReadonlyMap<string, string> = new Map([
  ['Ł', 'L'],
  ['ł', 'l'],
  ['Đ', 'D'],
  ['đ', 'd'],
  ['Ħ', 'H'],
  ['ħ', 'h'],
  ['ı', 'i'],
])

const COMBINING_MARKS = /[̀-ͯ]/g

function inFont(char: string): boolean {
  const code = char.codePointAt(0) ?? 0
  return (
    char === '\n' ||
    (code >= 0x20 && code <= 0x7e) ||
    (code >= 0xa0 && code <= 0xff) ||
    WIN_ANSI_EXTRA.has(char)
  )
}

function replacement(char: string): string {
  if (char === '→') {
    return '–'
  }
  // The minus sign of a negative amount, e.g. a loss in Finnish.
  if (char === '\u2212') {
    return '-'
  }
  const mapped = BASE_LETTERS.get(char)
  if (mapped !== undefined) {
    return mapped
  }
  const base = char.normalize('NFD').replace(COMBINING_MARKS, '')
  return base.length === 1 && inFont(base) ? base : '?'
}

/**
 * Text as the PDF's standard font can show it: characters it has are kept, the
 * arrow becomes a dash, the minus sign a hyphen, a letter with a mark outside the font loses the mark,
 * and anything else becomes a question mark.
 */
export function pdfText(text: string): string {
  return Array.from(text, (char) =>
    inFont(char) ? char : replacement(char),
  ).join('')
}
