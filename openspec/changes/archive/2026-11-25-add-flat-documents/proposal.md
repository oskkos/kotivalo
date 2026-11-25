## Why

A landlord keeps papers for each flat that aren't income or expense entries: the signed lease, the housing company's financial statements and annual report, charge notices (*vastikeilmoitukset*), meeting minutes and other papers such as a property manager's certificate (#114). Today they live in email and folders outside the app, so the flat's co-owners can't see them, and they get lost when someone needs them at tax time. Receipts (#32) only fit entries, and #93 planned a tenancy-only attachment table. One place for a flat's documents is built here, first, so #93 can keep the signed lease in it instead of building its own file storage.

## What Changes

- **Documents of a flat** (*Dokumentit*): a file with a kind, a name and a date, kept with the flat. Each document has one of five fixed kinds: *Vuokrasopimus* (lease), *Tilinpäätös* (financial statement), *Vastikeilmoitus* (charge notice), *Pöytäkirja* (minutes) and *Muu* (other). Decided 25.11.2026 on the design canvas.
- **Who:** everyone with access to the flat sees and downloads its documents. Only owners add, edit and delete them, as with entries; the server refuses a member with `sharing_owner_only`. Decided 25.11.2026. What a former owner sees is left to #88.
- **Adding a document** (owners), on its own page: the file, from one button that opens the camera or files as for receipts, the kind (default *Muu*), the name, prefilled from the file name, and the date, default today. For a lease the form also asks for the tenancy, chosen from the flat's tenancies, current one first, or none.
  - The files are the same as receipts: JPEG, PNG, WebP or PDF, up to 10 MB, recognised from the first bytes. Images are resized in the browser.
  - New reasons: `document_unsupported_type`, `document_too_large`, `document_unreadable` (an image the browser can't redraw) and `document_not_found`.
- **The documents page:** documents grouped by kind in the fixed order, newest first within each kind, with filter buttons for the kinds. A flat without documents gets an explanation instead. Owners get *Lisää dokumentti* and a line saying how much of their storage quota they use.
- **Document details:** a preview (the image, or the PDF's file type), name, kind, date, file name and size, who added it and when, and for a lease its tenancy. Everyone gets Download. An image opens full screen and a PDF in the browser's viewer, as receipts do. Owners also get Edit and Delete.
- **Editing** changes the kind, the name, the date and the lease's tenancy, never the file: a wrong file is deleted and added again. **Deleting** asks for a confirmation, then removes the row and the file from storage.
- **On the flat details page:** a *Dokumentit* section below the latest entries shows the three latest documents by date, *Kaikki (n)* and, for owners, *Lisää dokumentti*. The menu gets *Dokumentit* for everyone.
- **Storage quota:** documents and receipts share each user's quota of 500 MB and 1,000 files, counted for the uploader. The `storage_quota_full` message changes to speak of receipts and documents.
- **Deleting a flat** removes its documents and their files. Documents count as data in the confirmation, which lists how many there are.
- **A lease's tenancy:** if its tenancy is removed (only a tenancy that hasn't started can be), the lease stays with the flat without a tenancy.

Not in this change:
- The deposit, and showing the lease on the Tenancy page (#93).
- What a former owner sees (#88).
- Folders, versions, text recognition, uploading several files at once, sharing a document outside the flat, and retention rules (#77).

## Capabilities

### New Capabilities

- `documents`: a flat's documents, covering adding, the documents page, details, viewing and downloading, editing, deleting, a lease's tenancy and the storage quota for documents.

### Modified Capabilities

- `properties`:
  - "The flat details page" gets the *Dokumentit* section and the menu item.
  - "Deleting a flat" also removes documents and their files.
  - "Confirming the deletion of a flat" counts documents as data and lists them.
- `transactions`: "Storage quota for receipts" counts documents and receipts together.

## Impact

- **Tables:**
  - A new `property_documents` table:
    - `property_id`, `ON DELETE CASCADE`
    - `tenancy_id`, nullable, `ON DELETE SET NULL`
    - `kind`, `name`, `date`, `key`, `content_type`, `size`, `filename`, `uploaded_by`, `created_at` and `updated_at`
  - It replaces the `attachments` row of the CONCEPT.md data model draft, which had only a `tenancy_id`. CONCEPT.md changes in this change.
  - It goes into the flat deletion cascade test (`CHILD_TABLES`).
- **Code:**
  - `features/documents/`:
    - The repository, with the quota checked inside the write as for receipts.
    - Server functions; adding takes FormData so the file travels with the document.
    - The pages and the form.
    - A file route `/api/documents/$documentId`, which checks access before `fileResponse()`.
  - **Quota:** the storage usage query moves into a shared statement builder that counts receipts and documents together. The receipt write uses it too.
  - **Shared with receipts:** the browser-side image resize and the full-screen image viewer move out of `features/transactions/` so documents can use them.
  - `features/properties/`: the details page section, the menu item, and in the deletion summary and file keys the documents.
- **Logs:**
  - `info`: `document.added`, `document.changed`, `document.deleted`
  - `warn`: `document.refused` and `document.quota_exceeded`
  - `error`: `document.file_delete_failed`
  - Ids only, never names or file names.
- **UI:**
  - The screens are in the Design canvas section *Asunnon dokumentit (#114)*:
    - `DokumentitKortti` (details page section), `Dokumentit` (documents page), `DokumentitTyhja`, `DokumentitJasen`
    - `DokumenttiLisaa`, `DokumenttiVuokrasopimus`, `DokumenttiTilaTaynna`
    - `DokumenttiTiedot`, `DokumenttiMuokkaa`, `DokumenttiPoista`
  - The canvas's add form shows two file buttons (*Ota kuva*, *Valitse tiedosto*). The app uses the receipt field's single button, which opens the camera or files, for one pattern across the app. The canvas is updated with the proposal.
- **Messages and terms:**
  - Messages for the pages, form, dialogs, kinds and reasons in fi, sv and en.
  - In the term bank, the term `attachment` (*liite*, "a file kept with a tenancy") is replaced by `document` (*dokumentti* / *dokument* / *document*, a file kept with a flat).
  - The words for the kinds (*vuokrasopimus*, *tilinpäätös*, *vastikeilmoitus*, *pöytäkirja*) are checked with the translate skill.
- **#93** shrinks to the deposit, and links the lease from the Tenancy page to this table. Its issue has already been updated.
