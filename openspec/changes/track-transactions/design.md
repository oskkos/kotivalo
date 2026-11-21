## Context

Flats have owners, access, and rent and charges as periods (#31). What the periods don't cover is still missing: the one-off income and expenses a landlord pays or receives, and their receipts. The year summary (#34) will add these entries to the computed rent and charges to produce each owner's form 7H figures.

The pieces this change builds on already exist:
- `FileStorage` with `newFileKey()` (`src/server/files/storage.ts`, R2 in `platform/`)
- `checkUpload()`, which recognises JPEG, PNG, WebP and PDF by their first bytes, up to 10 MB
- `fileResponse()` with safe headers
- owner checks through `sharing.roleOf()`
- the first ownership start, which the amount forms already use as the earliest date

The Design canvas rows "Kirjaukset ja kuitit" and "Alapalkki ja uusi kirjaus" show the screens and carry the decisions taken with the user. #23 is settled there: no Payee, and deductibility follows from the category.

## Goals / Non-Goals

**Goals:**
- Entries as plain rows that can be edited and deleted (not periods), each with a category that decides its form 7H row.
- One receipt per entry, stored only when the entry is saved, served only after an access check.
- A storage quota per user that keeps R2 within its free tier.
- The bottom navigation bar, with New entry in the middle.

**Non-Goals:**
- The year summary and its per-owner split (#34): this change only gives each category its row.
- Recurring entries. Rent and charges are periods; other monthly expenses are rare and can come later on the same period model.
- Several receipts per entry, receipt text recognition, or image editing (rotation, cropping).
- Depreciation of improvements and furniture (10 years, 25 %), the flat-rate furniture deduction, and travel calculated per kilometre. They go into "Muut kulut" in form 7H, but each needs rules of its own. Until then an owner can log the year's amount as Other expense.
- The former owner's view, and deleting a flat (#64), which will also have to delete its receipt files.

## Decisions

### Categories map to form 7H rows

Form 7H (instructions updated 4.2.2026) has one income row and four expense rows, all for the owner's own share:

| Row | Finnish                                     | Filled from                                    |
| --- | ------------------------------------------- | ---------------------------------------------- |
| 2.1 | Oma osuutesi bruttovuokratuloista / vuosi   | rent (periods) + income entries                |
| 2.2 | Hoitovastikkeet ja vesimaksut / vuosi       | maintenance charge (periods) + `water_charge`  |
| 2.3 | Yhtiön tulouttamat pääomavastikkeet / vuosi | income-recognised financing charge (periods)   |
| 2.4 | Vuosikorjauskulut / vuosi                   | `annual_repair`                                |
| 2.5 | Muut kulut / vuosi                          | `insurance`, `other_expense`                   |

The categories, with their codes:

| Type    | Code                   | fi                | 7H  | Hint (fi, short)                                                                |
| ------- | ---------------------- | ----------------- | --- | ------------------------------------------------------------------------------- |
| income  | `tenant_water_charge`  | Vesimaksut        | 2.1 | Vuokralaisen maksamat vesimaksut ovat vuokratuloa.                              |
| income  | `other_income`         | Muu tulo          | 2.1 | Esim. autopaikan vuokra tai korvaus vahingosta. Vuokra lasketaan vuokran summasta. |
| expense | `annual_repair`        | Vuosikorjaus      | 2.4 | Kunnossapito vuokrauksen aikana, vähennetään maksuvuonna. Perusparannus ei ole vuosikorjaus. |
| expense | `water_charge`         | Vesimaksut        | 2.2 | Taloyhtiölle maksetut vesimaksut ovat vähennyskelpoisia.                        |
| expense | `insurance`            | Vakuutus          | 2.5 | Vuokranantajan vakuutusmaksut ovat vähennyskelpoisia.                           |
| expense | `other_expense`        | Muu meno          | 2.5 | Esim. vuokrailmoitus, välityspalkkio tai matkat asunnolle.                      |

All income categories are taxable and all expense categories deductible. The category therefore decides the "deductible" chip, and #23 needs no per-entry flag.

The codes, rows and hints live in `features/transactions/categories.ts` as one table, a pure module that the year summary will import. The Swedish and English names follow the 7H forms (sv: "Kostnader för årliga reparationer", "Övriga kostnader"; en: "Expenses for annual repairs", "Other costs"), and their terms go through the translate skill.

- **Why so few:** form 7H has only four expense rows. More categories would be labels that the summary collapses anyway.
- **Not categories:**
  - rent and the maintenance and financing charges, which come from the periods
  - one-off charges from the housing company, which follow the capital charge rule (deductible only if income-recognised). The financing charge treatment periods already model that rule; a one-off charge category would need its own treatment.
- *Alternative: let the user mark deductibility.* That would make wrong figures easy, and the Tax Administration decides deductibility by the kind of cost, not case by case.
- **Uncertain:** the Tax Administration's online return (OmaVero) has no numbered form. Its pages name "Hoitovastikkeet ja vesimaksut", "Yhtiön tulouttamat pääomavastikkeet" and "Muut kulut", but no separate annual repairs field was found. The year summary (#34) settles how 2.4 is shown, with #16.

### Two tables

```
transactions: id(), property_id → properties (cascade), type ('income' | 'expense'),
              category (text enum of the codes above), amount cents() (> 0),
              date isoDate(), note text (nullable), created_by → user,
              created_at instant(), updated_at instant()
              index (property_id, date)
receipts:     id(), transaction_id → transactions (cascade, unique), key text,
              content_type text, size integer, filename text, uploaded_by → user,
              created_at instant()
              index (uploaded_by)
```

- **Positive amount plus type,** rather than a signed amount. The 7H rows sum positive figures, and the UI adds the sign.
- **The category is a text enum** in Drizzle, not a lookup table. The list is code, because each category has rules.
- **`receipts` is its own table** (CONCEPT.md §5.2) with a unique `transaction_id`. One receipt per entry is enforced, and several can come later without a migration of `transactions`.
- **`uploaded_by` is on the receipt,** separate from who logged the entry. The quota counts who stored the file.
- **`filename`** is the name the browser gave, trimmed to 100 characters. It is used only in `Content-Disposition` (which `fileResponse()` escapes) and on screen. The storage key never derives from it.
- **Users are never deleted** today, so the user references don't cascade. Account deletion (#77) will decide what happens to entries of shared flats.

### The receipt is uploaded with the save

The form sends one `multipart/form-data` request with the entry fields and the optional file. A TanStack Start POST server function can take `FormData`. Its `inputValidator` reads the fields with the same Zod schema as the form, and takes the file as `Blob`.

On the server, in order:
1. session, access and owner role, and the date rules against the first ownership start
2. `checkUpload()` on the bytes
3. the quota check
4. `storage.put()`
5. the database writes with `atomically()`

If the database write fails, the stored file is deleted at once, and the error is logged. On edit:
- a new receipt is put first, then the rows are updated
- the old file is deleted after the database succeeds
- a failure to delete an old file is logged at `error`, because it leaves an orphan

- *Alternative: upload the file first (on selection), then save the entry referencing it.* The progress would be quicker to show. But a form that is never saved leaves orphan files, and those need a cleanup job and count against the quota with nothing to show for it.
- **Size:** a resized photo is about 0.3–1 MB and a PDF at most 10 MB. That is well within Workers' request limits and the free plan's CPU time, because the Worker only checks the first bytes and streams the bytes to R2.

### Images are resized in the browser

`features/transactions/resize-image.ts`:
- draws the image into a canvas no larger than 2000 px on the long edge
- exports it as JPEG at quality 0.85

This was decided in #9 (CONCEPT.md §6). The Worker can't resize images on the free plan.

- **PDFs and small images:** PDFs are sent as they are. An image already within 2000 px and under 1.5 MB is also sent as it is, to avoid recompressing.
- **Failures:** an image the browser can't decode gives the field reason `receipt_unreadable`, and nothing is sent.
- **EXIF:** exporting from a canvas drops the EXIF data, including GPS. That is a privacy gain.
- **HEIC:** iOS hands a JPEG to `accept="image/*"`. This is to be checked on a device (CONCEPT.md §6).
- **Testing:** the function is tested in the component project with a stubbed canvas, and in Playwright with a real 4000 × 3000 JPEG.

### Serving receipts

A server route `GET /api/receipts/$receiptId` (`?download=1` for an attachment):
- reads the session
- finds the receipt with its entry's flat, and checks access with the same repository query as the pages
- streams `storage.get(key)` through `fileResponse()`

A missing session, a missing receipt and no access all answer 404, so the address reveals nothing. The CSRF middleware covers only server functions; this route is a GET with no side effects, so it needs none.

The service worker already ignores `/api/*`, so receipts are never cached in the browser, and `fileResponse()` sets `no-store`.

### Storage quota

`src/server/files/quota.ts`:
- `STORAGE_QUOTA = { bytes: 500 * 1024 * 1024, files: 1000 }`
- a pure `checkQuota(usage, incomingBytes)`

The receipts repository gives `usage(userId)`, a sum and count over `receipts.uploaded_by`. Attachments (#30) will add theirs to the same usage.

- **Parallel uploads:** two uploads at the same moment can pass the check together and exceed the quota by one file. That is acceptable for an abuse limit. The quota keeps a misused account from filling R2, which has no spending cap once billing is on; it is not an exact accounting.
- **Per user, not per flat,** so co-owners don't block each other, and a user can't escape the limit by adding flats (flats are limited separately).

### Who may do what

All reads (the Entries page, details, receipts) need access to the flat. Writes need the owner role, checked on the server with `sharing.roleOf()`, the same as amounts and ownership. Refusals reuse `property_not_found` and `sharing_owner_only`.

Any owner may edit or delete any entry of the flat. Owners share the flat's books, and the amounts have the same rule. "Logged by" stays the original author after an edit; there is no edit history.

### Routes

- `/properties/$propertyId/transactions`: the Entries page, `?year=2025` for an earlier year
- `/properties/$propertyId/transactions/$transactionId`: the details page
- `/properties/$propertyId/transactions/$transactionId/edit`: the edit form, with Delete
- `/transactions/new`: the new entry form
  - `?propertyId=…` (from the Entries page) fixes the flat and hides the choice
  - without it (from the bottom bar), the form lists the owned flats

Before saving, the form is the same component in both cases. The last flat used is remembered in `localStorage` (`kotivalo_last_entry_property`) as a convenience, wrapped in try/catch; a wrong or missing value falls back to the first owned flat.

### The bottom bar

`src/components/BottomNav.tsx`, an MUI `BottomNavigation` with:
- Flats and Account as links
- the middle New entry as a round accent button labelled for screen readers

It sets `aria-current="page"` on the current item. The flats list (`/`) and `/account` render it. Other pages don't, so forms keep the whole screen and their close button.

At the same time:
- the account button leaves the flats list header
- the account page's back button goes

Statistics and Taxes are added when their pages exist. Large screens (#74) may turn it into a side rail later.

### Logging

At info, with ids only (no amounts, notes or file names):
- `transaction.created` (`propertyId`, `transactionId`, `type`, `category`, `hasReceipt`)
- `transaction.updated` (with `receiptChange`: `none | added | replaced | removed`)
- `transaction.deleted`
- `receipt.downloaded` is not logged, because reads aren't

At warn:
- `transaction.quota_exceeded` (`userId` comes from the context)
- `receipt.refused` (`problem`)

At error, `receipt.delete_failed` (`key` is not personal data).

## Risks / Trade-offs

- **[Orphan files when a delete fails after the database succeeded]** → They are logged at `error`, so they raise an issue. They are rare, and a later cleanup can compare R2 keys with `receipts.key`.
- **[Deleting a flat would leave its receipt files]** → Flats can't be deleted yet; #64 must delete the files first. This is noted in that issue.
- **[A large PDF on a slow mobile connection]** → The save button shows progress. A timeout shows the `network` alert, and nothing is half-saved, because the database write comes after the upload.
- **[The 7H categories may need changes after expert review (#16)]** → Categories are codes with rows in one module. Renaming a row or adding a category is a code change; changing an existing code needs a migration of stored values, so codes describe the cost, not the row number.
- **[Browser resizing quality differs between devices]** → Quality 0.85 at 2000 px keeps receipt text readable. The original is not kept.

## Migration Plan

- One migration adds both tables; nothing existing changes. It runs before the new code is deployed, as always, and the previous version ignores the new tables.
- Rollback: deploy the previous version. The tables stay empty or unused.

## Open Questions

- Whether OmaVero has a separate annual repairs field (row 2.4) or puts repairs in "Muut kulut". This doesn't affect what is stored, only how #34 groups it.
- HEIC from iPhones in practice (CONCEPT.md §6): to check on a device once this is deployed.
