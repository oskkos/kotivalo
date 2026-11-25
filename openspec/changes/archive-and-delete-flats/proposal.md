## Why

A flat added by mistake can't be removed, and a flat that was sold or no longer needs tracking stays on the flats list, in this month's rent summary and in the new entry form for good (#64). Earlier tax years may still depend on its data, and co-owners and former owners may need it for their own taxes. So there have to be two separate actions: archiving, which only hides the flat, and deleting, which removes it for good where nobody else depends on it.

## What Changes

- **Archiving a flat** (*Arkistoi asunto*, in the flat details page's menu, below the other actions):
  - Per user: it hides the flat only from the user's own flats list, this month's rent summary and the new entry form's flat choice. Other people's lists don't change. Anyone with access may archive, members too. Decided 25.11.2026 on the design canvas.
  - A confirmation says that the data stays, other people aren't affected and the flat can be restored. Afterwards the user lands on the flats list with a notice.
  - Nothing else changes: the flat keeps its access, roles, data and links, it still counts towards the 100-flat limit, and the year summary (#34) will include it.
- **Archived flats on the flats list:** a collapsed section *Arkistoidut asunnot (n)* at the end of the list, which opens to show the archived flats' cards. A user whose flats are all archived sees the first-run explanation and the section.
- **Restoring:** an archived flat's details page shows a band *Arkistoitu D.M.YYYY* with *Palauta listalle*. The menu has *Palauta listalle* in place of *Arkistoi asunto*.
- **Deleting a flat** (*Poista asunto*, in red at the end of the menu, for owners only):
  - Allowed only for an owner who owns 100 % now, when nobody else has ever had a share above 0 % in the flat's ownership history. Otherwise it is refused with a new reason, `property_delete_other_owners`, and the dialog names the other owners and offers archiving instead. Former owners need their period's data for their taxes (CONCEPT.md §4.4). Decided 25.11.2026.
  - Removes everything: access and invitations, ownership periods, charges, financing charges and the treatment, usage charges, tenancies with their rents, occupants and tenant fees, rent payments, entries and receipts, including the receipt files in storage. Members lose their access.
  - A flat without data (no tenancies, charges, treatment, usage charges or entries) is deleted after a plain confirmation. A flat with data shows what is removed, with counts, and names the members who lose access. *Poista pysyvästi* stays disabled until the street address is typed. Decided 25.11.2026: a flat with data may be deleted, not only archived, because users have to be able to delete their own data (account deletion #85 needs the same).
  - Afterwards the user lands on the flats list with a notice.
- **A notice after navigating** (snackbar): a shared component that the flats list shows after archiving and deleting. Nothing like it exists yet.

Not in this change:
- What a former owner sees of a flat (#88). Archiving doesn't change access or roles, so #88 doesn't depend on it.
- The year summary (#34).
- Deleting the whole account (#85).
- Cleaning up receipt files left in storage when deleting them fails after the rows are gone. They are logged (see design.md).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `properties`: new requirements "Archiving a flat", "Archived flats on the flats list", "Restoring an archived flat", "Deleting a flat" and "Confirming the deletion of a flat". Changed requirements: "Listing flats" and "First run without flats" (archived flats left out of the list, with the section at the end), and "The flat details page" (the band and the new menu items).
- `rent-payments`: "The rent summary on the flats list" leaves the user's archived flats out.
- `transactions`: "New entry from the bottom bar" leaves the user's archived flats out of the flat choice.

## Impact

- **Tables:** `property_access` gets a nullable `archived_at` column (`instant()`), set per user. Nothing else is added. Deleting relies on the existing `ON DELETE CASCADE` from `properties` (verified with a Workers test).
- **Code:**
  - `features/properties/`:
    - Repository methods to archive, restore and list archived flats, a deletion summary and the delete itself. `listForUser` leaves archived flats out.
    - Server functions `archiveProperty`, `restoreProperty`, `getPropertyDeletion` and `deleteProperty`, which deletes the receipt files from storage after the rows.
    - The archive and delete dialogs, the band on the details page and the archived section on the list.
  - `components/`: the notice after navigating.
  - The rent summary and the new entry options read through `listForUser`, so they leave archived flats out without changes of their own (covered by tests).
- **Logs:** `property.archived`, `property.restored`, `property.deleted` (ids only), `property.receipt_file_delete_failed` at `error`.
- **UI:** Design canvas section *Asunnon arkistointi ja poisto (#64)*: `AsuntoPoisto` (menu), `AsuntoPoistoJasen` (member's menu), `ArkistoiVahvista`, `AsunnotArkistoidut`, `AsuntoArkistoitu`, `PoistaTyhja`, `PoistaVahvista` and `PoistaEiVoi`. The blocked dialog on the canvas also shows the other owner's share and period; the spec names only the other owners, which is enough to explain the refusal.
- **Messages:** menu items, dialogs, band, section and notices in fi, sv and en, and the reason `property_delete_other_owners`. *Arkistoida* is checked against the term bank with the translate skill.
