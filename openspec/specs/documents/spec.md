# documents Specification

## Purpose
TBD - created by archiving change add-flat-documents. Update Purpose after archive.
## Requirements
### Requirement: Adding a document
An owner of a flat SHALL be able to add a document to it with *Lisää dokumentti*, on a page of its own, with:
- the file, from one button that opens the device's camera or files
- the kind, one of *Vuokrasopimus* (`lease`), *Tilinpäätös* (`financial_statement`), *Vastikeilmoitus* (`charge_notice`), *Pöytäkirja* (`minutes`) and *Muu* (`other`), *Muu* by default
- the name, required, at most 100 characters, prefilled from the file's name without its extension
- the date, required, today by default

For a lease the form SHALL also ask for its tenancy ("A lease's tenancy"). After saving, the owner SHALL land on the document's details page. A member SHALL NOT be able to add a document; the server SHALL refuse it with the reason `sharing_owner_only`. A flat the user has no access to SHALL be refused as not found.

#### Scenario: Adding a financial statement
- **WHEN** Annika, the owner of `Kuusikuja 3 B 12`, adds the PDF `tilinpaatos_2025.pdf` of 3 400 000 bytes as *Tilinpäätös* named `Tilinpäätös 2025` dated `2026-04-28`
- **THEN** the document's details page shows `Tilinpäätös 2025`, *Tilinpäätös*, `28.4.2026` and `tilinpaatos_2025.pdf`, and the documents page lists it under *Tilinpäätökset*

#### Scenario: The name is suggested from the file
- **WHEN** Annika chooses the file `Vastikkeet 2026.jpg` on the add page
- **THEN** the name field says `Vastikkeet 2026`, the kind is *Muu* and the date is today

#### Scenario: A document needs a name
- **WHEN** Annika empties the name and saves
- **THEN** the name field says that a name is needed, and nothing is stored

#### Scenario: A member can't add a document
- **WHEN** Jussi, a member of `Kuusikuja 3 B 12`, sends a new document for it to the server
- **THEN** it is refused with the reason `sharing_owner_only`, and neither a document nor a file is stored

### Requirement: Document files
A document's file SHALL be a JPEG, PNG or WebP image or a PDF of at most 10 MB, chosen as for receipts ("Attaching a receipt"). Images SHALL be resized in the browser before upload so that their long edge is at most 2000 px; PDFs SHALL be sent as they are. The server SHALL check the type from the file's first bytes and store the file under a generated key. A file of another type SHALL be refused with the reason `document_unsupported_type`, and a file over 10 MB with `document_too_large`; nothing SHALL be stored then.

#### Scenario: A photo is resized before upload
- **WHEN** Annika adds a 4000 × 3000 JPEG photo of a charge notice
- **THEN** the stored file is an image with a long edge of at most 2000 px

#### Scenario: A PDF is stored as it is
- **WHEN** Annika adds a 300 kB PDF
- **THEN** the stored file is that PDF, byte for byte

#### Scenario: A file that isn't an image or a PDF is refused
- **WHEN** an owner sends a document with a text file renamed `sopimus.pdf` to the server
- **THEN** it is refused with the reason `document_unsupported_type`, and neither a document nor a file is stored

#### Scenario: A file over 10 MB is refused
- **WHEN** an owner sends a document with an 11 MB PDF to the server
- **THEN** it is refused with the reason `document_too_large`, and neither a document nor a file is stored

### Requirement: A lease's tenancy
A document of the kind *Vuokrasopimus* SHALL be able to name one tenancy of the same flat. The form SHALL offer the flat's tenancies, the current one first and preselected, then the others newest first, and *Ei vuokrasuhdetta*. A document of another kind SHALL have no tenancy; changing a lease to another kind SHALL remove its tenancy. A tenancy of another flat, or one that doesn't exist, SHALL be refused with the reason `tenancy_not_found`. When the lease's tenancy is removed ("Removing a tenancy that hasn't started"), the document SHALL stay with the flat without a tenancy.

#### Scenario: A lease names its tenancy
- **WHEN** `Aino Koski` rents `Kuusikuja 3 B 12` from `2025-03-01`, and Annika adds `vuokrasopimus_aino.pdf` as *Vuokrasopimus*
- **THEN** the form preselects Aino Koski's tenancy, and the document's details page shows "Vuokrasuhde: Aino Koski"

#### Scenario: Another flat's tenancy is refused
- **WHEN** an owner sends a lease for `Kuusikuja 3 B 12` naming a tenancy of `Koivupolku 7 A 4`
- **THEN** it is refused with the reason `tenancy_not_found`, and nothing is stored

#### Scenario: A lease stays when its tenancy is removed
- **WHEN** `Mikko Lehtinen`'s tenancy starts on `2027-01-01`, it has a lease document, and Annika removes the tenancy on `2026-11-25`
- **THEN** the lease is still on the documents page, without a tenancy

### Requirement: The documents page
Everyone with access to a flat SHALL be able to open its documents page from the *Dokumentit* section of the details page or the menu ("The flat details page"). It SHALL list the documents grouped by kind in the order lease, financial statement, charge notice, minutes, other, under the headings *Vuokrasopimukset*, *Tilinpäätökset*, *Vastikeilmoitukset*, *Pöytäkirjat* and *Muut*, newest first by date within a kind, each with its name, kind, date and file size, opening its details. Kinds without documents SHALL be left out. Filter buttons *Kaikki* and one per kind that has documents SHALL show only that kind. A flat without documents SHALL show an explanation of what documents are for instead. Owners SHALL see *Lisää dokumentti* and how much of their storage quota their receipts and documents use, across all flats ("Storage quota for documents"). Members SHALL see the documents with a note that only owners add and delete them.

#### Scenario: Documents are grouped by kind, newest first
- **WHEN** the flat has the financial statements `Tilinpäätös 2024` dated `2025-04-30` and `Tilinpäätös 2025` dated `2026-04-28`, and the minutes `Yhtiökokous 2026` dated `2026-05-15`
- **THEN** the page shows *Tilinpäätökset* with `Tilinpäätös 2025` before `Tilinpäätös 2024`, then *Pöytäkirjat* with `Yhtiökokous 2026`, and no other headings

#### Scenario: Filtering by kind
- **WHEN** the page lists financial statements and minutes, and the user selects *Pöytäkirjat*
- **THEN** only `Yhtiökokous 2026` is shown

#### Scenario: A flat without documents
- **WHEN** an owner opens the documents page of a flat without documents
- **THEN** the page explains what documents are for and shows *Lisää dokumentti*

#### Scenario: An owner sees their storage use
- **WHEN** Annika's receipts take 30 000 000 bytes and Annika's documents 12 000 000 bytes, across all the flats
- **THEN** the page says that 42 MB of 500 MB is used

#### Scenario: A member sees the documents but can't add
- **WHEN** Jussi, a member of the flat, opens its documents page
- **THEN** Jussi sees its documents, no *Lisää dokumentti* and no storage use, and a note that only owners add and delete documents

#### Scenario: Another user can't open the documents page
- **WHEN** a user without access opens the documents page of `Kuusikuja 3 B 12`
- **THEN** they see that the flat was not found

### Requirement: Document details
Selecting a document SHALL open its details page with a preview (the image, or a PDF's file type), its name, kind and date, the file's name and size, who added it and on which day, and for a lease its tenancy, if it has one. Everyone with access SHALL get Download; owners SHALL also get Edit and *Poista dokumentti*. A document that doesn't exist, or one of a flat the user has no access to, SHALL show that the document was not found.

#### Scenario: An owner opens a document
- **WHEN** Annika opens `Tilinpäätös 2025`, which Annika added on `2026-05-02`
- **THEN** the page shows `Tilinpäätös 2025`, *Tilinpäätös*, `28.4.2026`, `tilinpaatos_2025.pdf`, "Sinä, 2.5.2026", Download, Edit and *Poista dokumentti*

#### Scenario: A member opens a document
- **WHEN** Jussi, a member of the flat, opens `Tilinpäätös 2025`, which Annika added
- **THEN** the page shows "Annika, 2.5.2026" and Download, and no Edit or *Poista dokumentti*

#### Scenario: A deleted document is not found
- **WHEN** a user opens the address of a document that has been deleted
- **THEN** the page shows that the document was not found

### Requirement: Viewing and downloading a document
Everyone with access to a flat SHALL be able to open and download its documents' files. A file SHALL be served by the app only after checking that the user has access to the document's flat, inline for viewing and as an attachment for downloading, under the file name it was uploaded with. An image SHALL open full screen from the details page; a PDF SHALL open in the browser's own viewer. A user without access, or a visitor who is not signed in, SHALL get a not-found response.

#### Scenario: A member downloads a document
- **WHEN** Jussi, a member of the flat, selects Download on `Tilinpäätös 2025`
- **THEN** Jussi gets the file as an attachment named `tilinpaatos_2025.pdf`

#### Scenario: A user without access can't open a document's file
- **WHEN** a signed-in user with no access to the flat requests the address of one of its documents' files
- **THEN** the response is 404 and contains no file

#### Scenario: Opening an image document full screen
- **WHEN** a user selects the image preview on the details page of `Vastikkeet 2026`
- **THEN** the image opens full screen, with Close and Download

### Requirement: Editing a document
An owner SHALL be able to edit a document's kind, name, date and, for a lease, its tenancy, with the same rules as adding one. The file SHALL NOT be changed; a wrong file is deleted and added again. Editing a document that no longer exists SHALL be refused with the reason `document_not_found`. A member SHALL NOT be able to edit; the server SHALL refuse it with the reason `sharing_owner_only`.

#### Scenario: Renaming a document
- **WHEN** Annika changes the name of `Tilinpäätös 2025` to `Tilinpäätös ja toimintakertomus 2025` and saves
- **THEN** the details page shows the new name, and the file is unchanged

#### Scenario: Changing a lease to another kind removes its tenancy
- **WHEN** Annika changes a lease that names Aino Koski's tenancy to *Muu* and saves
- **THEN** the document is *Muu* and has no tenancy

#### Scenario: Editing a deleted document is refused
- **WHEN** another owner has deleted a document, and Annika then saves changes to it
- **THEN** it is refused with the reason `document_not_found`

#### Scenario: A member can't edit a document
- **WHEN** Jussi, a member of the flat, sends a change to one of its documents to the server
- **THEN** it is refused with the reason `sharing_owner_only`, and nothing changes

### Requirement: Deleting a document
An owner SHALL be able to delete a document with *Poista dokumentti* on its details page, after a confirmation that names it and says that it is deleted for everyone with access to the flat and can't be undone. Deleting SHALL remove the document, then its file from storage; a file that can't be deleted SHALL be logged and SHALL NOT fail the deletion. Afterwards the owner SHALL land on the documents page. A member SHALL NOT be able to delete; the server SHALL refuse it with the reason `sharing_owner_only`.

#### Scenario: Deleting a document and its file
- **WHEN** Annika deletes `Tilinpäätös 2025` and confirms
- **THEN** Annika lands on the documents page without `Tilinpäätös 2025`, and its file is no longer in storage

#### Scenario: Cancelling keeps the document
- **WHEN** Annika selects *Poista dokumentti* and then Cancel
- **THEN** the details page stays open and the document is unchanged

#### Scenario: A member can't delete a document
- **WHEN** Jussi, a member of the flat, sends deleting one of its documents to the server
- **THEN** it is refused with the reason `sharing_owner_only`, and nothing changes

### Requirement: Storage quota for documents
Documents and receipts SHALL share each user's storage quota of 500 MB and 1,000 files, counted from the files the user uploaded ("Storage quota for receipts"). The quota SHALL be checked before a file is stored and again in the write, from the sizes recorded in the database. A document that would exceed it SHALL be refused with the reason `storage_quota_full`, and nothing SHALL be stored.

**No Playwright test:** reaching the quota needs 500 MB or 1,000 stored files; Workers tests cover the check with recorded sizes, and a component test shows the message.

#### Scenario: Receipts and documents count together
- **WHEN** a user has uploaded 600 receipts and 400 documents, and adds another document
- **THEN** it is refused with the reason `storage_quota_full`, and neither a document nor a file is stored

#### Scenario: A document over the size is refused
- **WHEN** a user whose receipts take 300 000 000 bytes and documents 224 000 000 bytes adds a 500 000-byte document
- **THEN** it is refused with the reason `storage_quota_full`

#### Scenario: Another owner's documents don't count
- **WHEN** Jussi has uploaded 1,000 documents for `Kuusikuja 3 B 12` and Annika, who has uploaded none, adds a document to the same flat
- **THEN** the document is stored

