## Why

A former owner whose access was removed loses everything today, their own ownership period's form 7H figures included. They still have to report the rent of the year they sold or gave away their share (CONCEPT.md §4.4: "they still see the data for their period of ownership for their own taxes"). #88 asked what such a person sees; #123 is the year summary for their period.

The answers, decided with the user on 28.11.2026:
- **What they see:** the year summary only.
- **Tenants:** only those of their own period.
- **For how long:** until the flat is deleted.

## What Changes

- **A former owner:**
  - Defined as a user with no access to a flat who had a share above 0 % in it on some day.
  - This happens when the access is removed in an ownership change, or by removing a member or a member leaving.
  - A former owner who kept their access (now a member) is unchanged.
- **The flat is in their year summary only:**
  - the own share's cards, the flat's form 7H page and the PDF, in the years of their share
  - nothing on the flats list or the entry form, and no flat pages
- **Only their own figures:**
  - The flat is not in their whole flats, and not in another person's figures or the *Kenen luvut* sheet.
  - It is not named under "Not included".
  - A `person` choice on its form 7H page opens their own share.
- **Tenants of their own period:**
  - On a former owner's form 7H page and in their PDF, the tenant, the tenancy period and the PDF's tenancy list cover only the days they owned a share.
  - Names of tenants who moved in after the sale are not shown.
- **Read-only form 7H page:**
  - a note that they no longer own the flat and see only their own period
  - no Add buttons for missing housing company details, and no links to the rent payments or the charge amounts
  - the copy buttons stay
- **The ownership change form:** the remove-access hint says that the person still sees their own period in the year summary.
- **How long:** as long as the flat exists. Deleting a flat that had another owner is already refused (#64), so in practice this is for good.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `year-summary`:
  - "Flats in the year summary" and "The form 7H page of a flat" cover a former owner.
  - New requirements: "A former owner's year summary" and "Tenants in a former owner's period".
- `ownership`: "Changing a flat's ownership" says what a person whose access is removed keeps.
- `sharing`: "Removing access to a flat" and "Leaving a shared flat" make the same exception for a user who had a share.

## Impact

- **Tables:** none. A former owner is computed from `ownership_periods` and `property_access`. One index is added, `ownership_periods (user_id)`, so finding a user's former flats doesn't scan the table (a migration with only `CREATE INDEX`).
- **Server:**
  - a repository read of the flats the user formerly owned, without access
  - `year-summary.server.ts`: the access check includes those flats, for the own share only
  - the fixed number of queries grows by one, and stays fixed
- **Calculation:** `summary.ts` clips the flat details' tenancies to the holder's days with a share, when asked. This is a pure addition with unit tests.
- **UI screens:**
  - the form 7H page (`FlatTaxPage.tsx`): a note, and no Add buttons or links for a former owner
  - the ownership change form's hint
  - Design canvas: no screen for these. They follow the existing *Verot7H* screen with the note band of another owner's page (*Verot7HMuutos*).
- **Messages:** fi, sv and en for the note and the hint. The term bank may get *entinen omistaja* (former owner).
