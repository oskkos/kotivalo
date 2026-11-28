// The demo data's dates and names. Everything is fictional: the people, the
// addresses and the Business ID. Dates are computed from today, because the
// server reads the real clock (design.md, decision 4).

/** dd/mm/yyyy, as the English forms take it. */
export function typed(year: number, month: number, day: number): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(day)}/${pad(month)}/${String(year)}`
}

const now = new Date()
export const THIS_YEAR = now.getFullYear()
export const LAST_YEAR = THIS_YEAR - 1

/** The months with a rent payment on the demo flat, as `YYYY-MM`. */
export function paidMonths(): { month: string; paidOn: string }[] {
  const months: { month: string; paidOn: string }[] = []
  // From April of last year to the month before this one.
  for (let year = LAST_YEAR; year <= THIS_YEAR; year += 1) {
    for (let month = year === LAST_YEAR ? 4 : 1; month <= 12; month += 1) {
      const isBeforeThisMonth = year < THIS_YEAR || month < now.getMonth() + 1
      if (!isBeforeThisMonth) {
        continue
      }
      months.push({
        month: `${String(year)}-${String(month).padStart(2, '0')}`,
        paidOn: typed(year, month, 5),
      })
    }
  }
  return months
}

export const koivukatu = {
  streetAddress: 'Koivukatu 8 A 14',
  postcode: '33100',
  city: 'Tampere',
  rooms: '2 rooms',
  floorArea: '48,5',
  housingCompanyName: 'As Oy Koivukatu 8',
  // A valid check digit, fictional; checked not to be a company's
  // (tasks.md, 10.3).
  businessId: '1234567-1',
  apartmentNumber: 'A 14',
}

export const satamakatu = {
  streetAddress: 'Satamakatu 2 C 5',
  postcode: '20100',
  city: 'Turku',
  rooms: '1 room',
  floorArea: '31',
}

export const aino = {
  name: 'Aino Koski',
  phone: '040 123 4567',
  email: 'aino.koski@example.com',
}

export const eero = {
  name: 'Eero Virtanen',
  phone: '050 765 4321',
  email: 'eero.virtanen@example.com',
}

/** A short address for a new demo account, unique to the run. */
export function newAddress(name: string): string {
  return `${name}.${Date.now().toString(36)}@example.com`
}

export const ANNIKA_EMAIL = 'annika.kotivalo@example.com'
export const JUSSI_EMAIL = 'jussi.laine@example.com'
