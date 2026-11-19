// Numbers typed by people: "48,5", "48.5" and "1 200" all parse, also with
// no-break spaces. Stored as integers scaled by the number of decimals, like
// money in cents.

/**
 * The value in units of 10^-decimals (`parseDecimal('48,5', 1)` = 485), or
 * undefined if the text is not a non-negative number with at most that many
 * decimals.
 */
export function parseDecimal(
  text: string,
  decimals: number,
): number | undefined {
  const normalized = text.replace(/\s/g, '').replace(',', '.')
  const match = /^(\d+)(?:\.(\d*))?$/.exec(normalized)
  if (!match) {
    return undefined
  }
  const [, whole = '', fraction = ''] = match
  if (fraction.length > decimals) {
    return undefined
  }
  const value = Number(whole + fraction.padEnd(decimals, '0'))
  return Number.isSafeInteger(value) ? value : undefined
}
