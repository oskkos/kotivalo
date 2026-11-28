// The Finnish original of a tax term's label (openspec: year-summary,
// "Finnish originals of tax terms"): in Swedish and English the form 7H page
// and the PDF show the words MyTax's Finnish pages use after the label.
import { getLocale, type Locale } from '#/paraglide/runtime.js'

/**
 * A Finnish label as an original in brackets: lower case at the start, and a
 * bracket inside it a comma, so that "Rahoitusvastikkeet (rahastoitu)" is
 * shown as "(rahoitusvastikkeet, rahastoitu)" and never a bracket in a bracket.
 */
export function originalText(fi: string) {
  const lowered = fi.charAt(0).toLocaleLowerCase('fi-FI') + fi.slice(1)
  return lowered.replace(/\s*\(([^)]*)\)/g, ', $1')
}

/** A label with its original, which is null in Finnish. */
export interface WithOriginal {
  text: string
  original: string | null
}

/** `label` in the current language with the Finnish `fi()` as its original. */
export function withOriginal(
  label: string,
  fi: () => string,
  locale: Locale = getLocale(),
): WithOriginal {
  return { text: label, original: locale === 'fi' ? null : originalText(fi()) }
}

/** One string, "Label (original)", for text that has no markup, e.g. the PDF. */
export function labelWithOriginal(item: WithOriginal) {
  return item.original === null ? item.text : `${item.text} (${item.original})`
}
