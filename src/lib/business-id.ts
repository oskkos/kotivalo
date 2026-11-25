// The Finnish Business ID (Y-tunnus): seven digits, a hyphen and a check
// digit, e.g. "2345678-0".
const WEIGHTS = [7, 9, 10, 5, 8, 4, 2]

/** Whether the text is a Business ID in its strict form with a matching check digit. */
export function isValidBusinessId(text: string): boolean {
  if (!/^\d{7}-\d$/.test(text)) {
    return false
  }
  const sum = WEIGHTS.reduce(
    (total, weight, index) => total + weight * Number(text[index]),
    0,
  )
  const remainder = sum % 11
  if (remainder === 1) {
    return false
  }
  const check = remainder === 0 ? 0 : 11 - remainder
  return check === Number(text[8])
}
