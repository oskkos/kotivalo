// The format values are copied in for MyTax (openspec: year-summary,
// "Copying form 7H values"): the same in every language, so what is pasted
// doesn't depend on the display language. Pure.

/** Cents as digits with a decimal comma and two decimals: 489500 → `4895,00`. */
export function amountForCopy(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  return `${sign}${String(Math.trunc(abs / 100))},${String(abs % 100).padStart(2, '0')}`
}

/** Basis points as a percentage without the sign: 5000 → `50`, 3333 → `33,33`. */
export function shareForCopy(basisPoints: number): string {
  const whole = Math.trunc(basisPoints / 100)
  const hundredths = String(basisPoints % 100).padStart(2, '0')
  const decimals = hundredths.replace(/0+$/, '')
  return decimals === '' ? String(whole) : `${String(whole)},${decimals}`
}
