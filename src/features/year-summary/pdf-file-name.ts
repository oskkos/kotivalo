// The year summary PDF's file name (openspec: year-summary, "Downloading the
// year summary as a PDF"): the app and the year summary in the user's
// language, the year, then another owner's name or the whole flats.
import { m } from '#/paraglide/messages.js'
import { pdfText } from './pdf-text'
import type { HolderView } from './view'

/** Lower case letters and digits only, words joined by hyphens. */
export function slug(text: string): string {
  return pdfText(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** `kotivalo-vuosiyhteenveto-2025.pdf`, with the holder after the year. */
export function pdfFileName(holder: HolderView, year: number): string {
  const parts = [m.pdf_file_stem(), String(year)]
  if (holder.kind === 'whole') {
    parts.push(m.pdf_file_whole())
  } else if (holder.kind === 'person') {
    parts.push(slug(holder.name))
  }
  return `${parts.filter((part) => part !== '').join('-')}.pdf`
}
