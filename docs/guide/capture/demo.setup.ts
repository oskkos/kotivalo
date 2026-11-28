// The demo accounts: Annika Kotivalo and her co-owner Jussi Laine, with
// flats, a tenancy, charges, rent payments, entries and a document, all
// filled in through the app's own forms with the e2e helpers (English, the
// helpers' language) and then switched to Finnish. Their signed-in states are
// saved for the capture scripts (design.md, decision 5).
import { existsSync, mkdirSync } from 'node:fs'
import { expect, test, type Browser, type Page } from '@playwright/test'
import { pdfFile, addDocument } from '../../../e2e/support/documents'
import { addFlat, card, flatId } from '../../../e2e/support/flats'
import {
  addFinancingCharge,
  openAmounts,
  setAmount,
  setTreatment,
} from '../../../e2e/support/amounts'
import {
  currentTenancyId,
  openRentMonth,
  recordPayment,
} from '../../../e2e/support/rent-payments'
import {
  invitationCard,
  invite,
  openSharing,
} from '../../../e2e/support/sharing'
import { signIn, waitForHydration } from '../../../e2e/support/sign-in'
import { addFee, addTenant, changeRent } from '../../../e2e/support/tenancies'
import { logEntry } from '../../../e2e/support/transactions'
import { addUsageCharge } from '../../../e2e/support/usage-charges'
import {
  aino,
  ANNIKA_EMAIL,
  eero,
  JUSSI_EMAIL,
  koivukatu,
  LAST_YEAR,
  paidMonths,
  satamakatu,
  THIS_YEAR,
  typed,
} from './demo.ts'
import { ANNIKA, AUTH_DIR, JUSSI } from './paths.ts'

async function switchToFinnish(page: Page): Promise<void> {
  await page.goto('/account')
  await waitForHydration(page)
  await page
    .getByRole('group', { name: /^(Language|Kieli)$/ })
    .getByRole('button', { name: 'Suomi' })
    .click()
  await expect(
    page.getByRole('heading', { level: 1, name: 'Tili' }),
  ).toBeVisible()
}

/**
 * Whether the saved states still sign in to a database that has the demo
 * data (a local rerun). Codes are limited to 5 an hour per address, so a
 * rerun reuses the sessions rather than signing in again.
 */
async function savedStatesWork(browser: Browser): Promise<boolean> {
  if (!existsSync(ANNIKA) || !existsSync(JUSSI)) {
    return false
  }
  const context = await browser.newContext({ storageState: ANNIKA })
  const page = await context.newPage()
  const baseURL = test.info().project.use.baseURL ?? ''
  await page.goto(`${baseURL}/`)
  await waitForHydration(page)
  const works =
    !page.url().includes('/sign-in') &&
    (await card(page, koivukatu.streetAddress).count()) > 0
  await context.close()
  return works
}

test('The demo accounts and their data', async ({ page, browser }) => {
  test.setTimeout(600_000)
  mkdirSync(AUTH_DIR, { recursive: true })
  if (await savedStatesWork(browser)) {
    return
  }

  // Both accounts are signed in first. A rerun on a local database that has
  // the demo data signs in to the same accounts and adds nothing.
  await signIn(page, ANNIKA_EMAIL, 'Annika Kotivalo')
  const jussi = await browser.newPage({ locale: 'en-US' })
  await signIn(jussi, JUSSI_EMAIL, 'Jussi Laine')
  if ((await card(page, koivukatu.streetAddress).count()) === 0) {
    await fillInDemoData(page, jussi)
  }

  // Both accounts in Finnish, and their states saved.
  await switchToFinnish(page)
  await page.context().storageState({ path: ANNIKA })
  await switchToFinnish(jussi)
  await jussi.context().storageState({ path: JUSSI })
  await jussi.close()
})

async function fillInDemoData(page: Page, jussi: Page): Promise<void> {
  // Annika's first flat, owned since the start of last year.
  await addFlat(page, {
    ...koivukatu,
    ownedSince: typed(LAST_YEAR, 1, 1),
  })
  const id = await flatId(page, koivukatu.streetAddress)

  // Jussi is invited, accepts, and the shares become equal in July last year.
  await openSharing(page, id)
  await invite(page, JUSSI_EMAIL)
  await jussi.goto('/')
  await waitForHydration(jussi)
  await invitationCard(jussi).getByRole('button', { name: 'Accept' }).click()
  await expect(card(jussi, koivukatu.streetAddress)).toBeVisible()
  await openSharing(page, id)
  await page.getByRole('button', { name: 'Change ownership' }).click()
  await page.getByRole('button', { name: 'Equal shares' }).click()
  await page.getByRole('textbox', { name: 'From' }).fill(typed(LAST_YEAR, 7, 1))
  await page.getByRole('button', { name: 'Save ownership change' }).click()
  await expect(
    page.getByText('You 50% · Jussi Laine 50%').first(),
  ).toBeVisible()

  // The tenancy since last April: rent 890 €, 910 € from January.
  await addTenant(page, id, {
    ...aino,
    contractMade: typed(LAST_YEAR, 3, 15),
    start: typed(LAST_YEAR, 4, 1),
    rent: '890',
    dueDay: '5',
    deposit: '1780',
    occupants: '1',
  })
  await changeRent(page, '910', typed(THIS_YEAR, 1, 1))
  await addFee(page, {
    kind: 'Parking space',
    amount: '25',
    from: typed(LAST_YEAR, 4, 1),
  })

  // The housing company's charges and the water charge.
  await openAmounts(page, id)
  await setAmount(page, 'Maintenance charge', '215', typed(LAST_YEAR, 1, 1))
  await addFinancingCharge(page, 'Putkiremontti', '86', typed(LAST_YEAR, 1, 1))
  await setTreatment(page, 'Placed in reserve', typed(LAST_YEAR, 1, 1))
  await addUsageCharge(page, id, {
    kind: 'Water charge',
    amount: '22',
    from: typed(LAST_YEAR, 4, 1),
  })

  // The rent has been paid on the 5th since April.
  const tenancy = await currentTenancyId(page, id)
  for (const { month, paidOn } of paidMonths()) {
    await openRentMonth(page, id, tenancy, month)
    await recordPayment(page, { paidOn })
  }

  // Entries and a document.
  await logEntry(page, id, {
    category: 'Insurance',
    amount: '96',
    date: typed(LAST_YEAR, 1, 15),
    note: 'Kotivakuutus',
  })
  await logEntry(page, id, {
    category: 'Annual repair',
    amount: '420',
    date: typed(LAST_YEAR, 5, 12),
    note: 'Keittiön hana ja hanan asennus',
  })
  await addDocument(page, id, {
    file: pdfFile('vuokrasopimus.pdf'),
    kind: 'Lease',
    name: 'Vuokrasopimus Aino Koski',
    date: typed(LAST_YEAR, 3, 15),
  })

  // The second flat: Annika's alone, with a tenancy that ended last year and
  // a deposit not yet returned.
  await addFlat(page, { ...satamakatu, ownedSince: typed(LAST_YEAR, 1, 1) })
  const second = await flatId(page, satamakatu.streetAddress)
  await addTenant(page, second, {
    ...eero,
    contractMade: typed(LAST_YEAR, 1, 20),
    start: typed(LAST_YEAR, 2, 1),
    rent: '640',
    deposit: '1280',
    ending: {
      by: 'Tenant',
      noticeDate: typed(LAST_YEAR, 11, 1),
      lastDay: typed(LAST_YEAR, 12, 31),
    },
  })
}
