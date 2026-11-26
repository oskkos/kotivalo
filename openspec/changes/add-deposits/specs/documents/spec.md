## MODIFIED Requirements

### Requirement: Adding a document
An owner of a flat SHALL be able to add a document to it with *Lisää dokumentti*, on a page of its own, with:
- the file, from one button that opens the device's camera or files
- the kind, one of *Vuokrasopimus* (`lease`), *Tilinpäätös* (`financial_statement`), *Vastikeilmoitus* (`charge_notice`), *Pöytäkirja* (`minutes`) and *Muu* (`other`), *Muu* by default
- the name, required, at most 100 characters, prefilled from the file's name without its extension
- the date, required, today by default

For a lease the form SHALL also ask for its tenancy ("A lease's tenancy"). Opened from the Tenancy page's lease card ("The lease on the tenancy page"), the form SHALL open with *Vuokrasopimus* and that tenancy selected, and SHALL return to the Tenancy page when closed. A kind or tenancy in the address that the flat doesn't have SHALL be ignored, leaving the defaults. After saving, the owner SHALL land on the document's details page. A member SHALL NOT be able to add a document; the server SHALL refuse it with the reason `sharing_owner_only`. A flat the user has no access to SHALL be refused as not found.

#### Scenario: Adding a financial statement
- **WHEN** Annika, the owner of `Kuusikuja 3 B 12`, adds the PDF `tilinpaatos_2025.pdf` of 3 400 000 bytes as *Tilinpäätös* named `Tilinpäätös 2025` dated `2026-04-28`
- **THEN** the document's details page shows `Tilinpäätös 2025`, *Tilinpäätös*, `28.4.2026` and `tilinpaatos_2025.pdf`, and the documents page lists it under *Tilinpäätökset*

#### Scenario: The name is suggested from the file
- **WHEN** Annika chooses the file `Vastikkeet 2026.jpg` on the add page
- **THEN** the name field says `Vastikkeet 2026`, the kind is *Muu* and the date is today

#### Scenario: A document needs a name
- **WHEN** Annika empties the name and saves
- **THEN** the name field says that a name is needed, and nothing is stored

#### Scenario: Another flat's tenancy in the address is ignored
- **WHEN** Annika opens the add page of `Kuusikuja 3 B 12` with the kind `lease` and a tenancy of `Koivupolku 7 A 4` in the address
- **THEN** the form shows *Vuokrasopimus* with the flat's current tenancy preselected

#### Scenario: A member can't add a document
- **WHEN** Jussi, a member of `Kuusikuja 3 B 12`, sends a new document for it to the server
- **THEN** it is refused with the reason `sharing_owner_only`, and neither a document nor a file is stored

## ADDED Requirements

### Requirement: The lease on the tenancy page
The Tenancy page SHALL show, below the *Vakuus* card of the current tenancy, a *Vuokrasopimus* card listing the leases naming that tenancy ("A lease's tenancy"), newest first by date, each with its name, date and file type, opening its details page ("Document details"). Without one, the card SHALL say that the signed lease can be kept with the flat's documents. Owners SHALL see *Lisää vuokrasopimus*, opening the add document form with *Vuokrasopimus* and the tenancy selected ("Adding a document"). Members SHALL see the leases without the button.

#### Scenario: The current tenancy's lease
- **WHEN** `vuokrasopimus_aino.pdf`, named `Vuokrasopimus Aino K.` and dated `2025-02-12`, is a lease naming `Aino Koski`'s tenancy, and Annika opens the Tenancy page
- **THEN** the *Vuokrasopimus* card shows `Vuokrasopimus Aino K.`, `12.2.2025` and PDF, and selecting it opens the document's details page

#### Scenario: Adding the lease from the tenancy page
- **WHEN** `Aino Koski`'s tenancy has no lease, and Annika selects *Lisää vuokrasopimus* on the Tenancy page
- **THEN** the add document form opens with *Vuokrasopimus* and `Aino Koski`'s tenancy selected

#### Scenario: A lease of another tenancy isn't on the card
- **WHEN** the flat's only lease names `Pekka Virtanen`'s ended tenancy
- **THEN** the *Vuokrasopimus* card of `Aino Koski`'s tenancy lists no lease

#### Scenario: A member sees the lease but can't add one
- **WHEN** Jussi, a member of the flat, opens the Tenancy page
- **THEN** he sees `Vuokrasopimus Aino K.`, without *Lisää vuokrasopimus*
