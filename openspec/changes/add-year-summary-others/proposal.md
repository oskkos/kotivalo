## Why

The year summary shows only the signed-in user's own share (#34). Flats are often co-owned, and one spouse usually fills in both returns, so the other owner's figures have to be worked out by hand. The whole flat at 100 % is needed for checking the totals against the housing company's papers (#122).

## What Changes

- **Whose figures:** a *Kenen luvut* selector on the year summary, under the year. It opens a sheet with:
  - *Oma osuutesi*, the default
  - every other person who had a share above 0 in the year in a flat the user has access to, including one whose share ended during the year
  - *Koko asunnot (100 %)*

  The choice is in the URL (`?person=<user id>` or `?person=whole`) and is kept when moving between years and to a flat's form 7H page and back. The selector is shown only when the year has another owner. Without one, the whole flats equal the own share.
- **Who may see another owner's figures:** everyone with access to the flat, also a member with a 0 % share. They already see the flat's entries and its ownership history.
- **Another owner's figures:**
  - the same cards and the same calculation as the own share, for that person
  - only the flats the user has access to, with a note that the person may have other rental flats to report
  - the form 7H page with the copy buttons, named for that person
- **Whole flats (100 %):**
  - every flat the user has access to that had an owner in the year, also the ones where the user's own share is 0 %; archived flats are included
  - the figures at 100 %
  - a note that they are not reported as such
  - on the flat's page:
    - no copy buttons and no form 7H flat details
    - an *Omistajat* card listing each owner's share and row 2.1, linking to that owner's form 7H page
- **Names:** always in the basic form (*Mikko Virtanen*, *Osuus: Mikko Virtanen*), because Finnish inflection of arbitrary names can't be done right in code.
- **Not changed:** the own share's figures, checks and copying.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `year-summary`:
  - **Modified requirements:**
    - "The year summary page", which no longer shows only the own share
    - "The year the summary opens on", where the years follow the chosen person
    - "The form 7H page of a flat", which gets a person or the whole flat
  - **New requirements:**
    - choosing whose figures
    - another owner's figures
    - the whole flats
    - the whole flat's page

## Impact

- **Tables:** none. The ownership repository gets a read of the owners' names for a list of flats.
- **Screens:**
  - the year summary page (`YearSummaryPage.tsx`) and a flat's form 7H page (`FlatTaxPage.tsx`)
  - Design canvas section *Vuosiyhteenveto muille omistajille ja koko asunnoille (#122)*:
    - [selector open](https://claude.ai/artifact/DGX1pDjibhPqZjLUjm8jTb#artboard-VerotHenkiloValinta)
    - [another owner](https://claude.ai/artifact/DGX1pDjibhPqZjLUjm8jTb#artboard-VerotHenkilo)
    - [whole flats](https://claude.ai/artifact/DGX1pDjibhPqZjLUjm8jTb#artboard-VerotKoko)
    - [form 7H for another owner](https://claude.ai/artifact/DGX1pDjibhPqZjLUjm8jTb#artboard-Verot7HHenkilo)
    - [whole flat](https://claude.ai/artifact/DGX1pDjibhPqZjLUjm8jTb#artboard-Verot7HKoko)
- **Code:**
  - `features/year-summary/summary.ts`: the calculation gets a holder, a user or the whole flat, in place of the user id
  - `year-summary.server.ts`, `functions.ts`, `schemas.ts`, `view.ts`
  - both routes (`person` in the search)
  - `ownership.repository.server.ts` (names)
  - messages in fi, sv and en
- **Privacy:** the year summary now sends co-owners' user ids and names to the browser. Everyone with access to a flat already sees them on its Ownership and sharing page.
- **Dependencies:** none.
