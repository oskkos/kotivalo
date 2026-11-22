import { expect, test, type Page } from '@playwright/test'
import { addFlat, card, flatId, kuusikuja } from './support/flats'
import {
  currentTenancyId,
  openRentMonth,
  recordPayment,
} from './support/rent-payments'
import { ownerWithFlat } from './support/sharing'
import { waitForHydration } from './support/sign-in'
import { addTenant, aino } from './support/tenancies'

// The browser's language is English, so the app is in English. Months are
// relative to today, so the tests don't age; with the rent due on the 1st,
// this month is late except on the 1st, when it is due today.

const today = new Date()
const thisYear = today.getFullYear()
const dd = (n: number) => String(n).padStart(2, '0')
const thisMonth = `${String(thisYear)}-${dd(today.getMonth() + 1)}`
const monthName = today.toLocaleString('en-GB', { month: 'long' })
const firstDay = today.getDate() === 1
const lastYear = {
  contractMade: `01/12/${String(thisYear - 2)}`,
  start: `01/01/${String(thisYear - 1)}`,
  dueDay: '1',
}

async function openList(page: Page) {
  await page.goto('/')
  await waitForHydration(page)
}

test.describe('The rent summary on the flats list', () => {
  test("The summary adds up this month's rent of every flat", async ({
    page,
  }) => {
    const kuusikujaId = await ownerWithFlat(page)
    await addTenant(page, kuusikujaId, { ...aino, ...lastYear })

    const koivupolku = {
      ...kuusikuja,
      streetAddress: 'Koivupolku 7 A 4',
      rooms: '1 room',
      floorArea: '32',
      ownedSince: '12/06/2022',
    }
    await addFlat(page, koivupolku)
    const koivupolkuId = await flatId(page, koivupolku.streetAddress)
    await addTenant(page, koivupolkuId, {
      name: 'Ville Niemi',
      ...lastYear,
      rent: '640',
    })
    await openRentMonth(
      page,
      koivupolkuId,
      await currentTenancyId(page, koivupolkuId),
      thisMonth,
    )
    await recordPayment(page, {})

    await addFlat(page, {
      ...kuusikuja,
      streetAddress: 'Rantatie 15 C 21',
      ownedSince: '12/06/2022',
    })

    await openList(page)
    const summary = page.getByRole('region', { name: `${monthName} rent` })
    await expect(summary).toContainText('€640.00 / €1,530.00 received')
    await expect(summary).toContainText(
      firstDay ? /received$/ : /Rent late for 1 flat$/,
    )
    await expect(card(page, 'Koivupolku 7 A 4')).toContainText('Paid')
    await expect(card(page, 'Rantatie 15 C 21')).toContainText('Vacant')
  })
})

test.describe("The rent status on a flat's card", () => {
  test('A late month shows on the card', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await addTenant(page, id, { ...aino, ...lastYear })
    await openList(page)
    const flat = card(page, kuusikuja.streetAddress)
    await expect(flat).toContainText('Let')
    await expect(flat).toContainText('Aino Koski')
    await expect(flat).toContainText(firstDay ? /Due/ : /\d+ days? late/)
  })
})
