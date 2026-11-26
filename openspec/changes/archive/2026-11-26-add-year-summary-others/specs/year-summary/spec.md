## MODIFIED Requirements

### Requirement: The year summary page
A signed-in user SHALL be able to open the year summary page `/year-summary` from Taxes in the bottom bar. It SHALL show one year at a time, chosen with previous and next year buttons ("The year the summary opens on"), with the year in the URL (`?year=2025`). It SHALL show the user's own share unless another person or the whole flats are chosen ("Choosing whose figures"). For the own share, the page SHALL show a card for each flat in the summary ("Flats in the year summary"), in address order. Each card SHALL show the address, the housing company's name and Business ID or that they are missing, the user's share, row 2.1 and the sum of rows 2.2–2.5 ("Form 7H rows of the own share"), and a chip for each check ("Checks in the year summary"). Selecting a card SHALL open the flat's form 7H page for the same year. Flats the user can see but which are not in the summary SHALL be named in a "Not included" note, with the reason that the user had no share in them that year. The note SHALL also say that loan interest is not on form 7H and that improvements are not counted yet. For the current year the heading SHALL name the months counted so far, e.g. "tammi–marras". When no flat is in the summary, the page SHALL say that the user had no ownership share in any flat that year, and still offer the selector when the year has owners to choose.

#### Scenario: The cards of the flats owned in the year
- **WHEN** Annika owns 5000 basis points of `Kuusikuja 3 B 12` and `Rantatie 15 C 21`, and opens Taxes and the year 2025
- **THEN** the page shows a card for each flat with its row 2.1 and the sum of rows 2.2–2.5 of her share, and selecting `Kuusikuja 3 B 12` opens `/year-summary/<its id>?year=2025`

#### Scenario: A flat without a share is named, not summarised
- **WHEN** Annika also sees `Hallilantie 12 B 8` with a share of 0 basis points all of 2025
- **THEN** the page has no card for `Hallilantie 12 B 8`, and the "Not included" note names it

#### Scenario: No share in any flat
- **WHEN** Jussi, a member of `Kuusikuja 3 B 12` without a share, opens Taxes for 2025, and Annika owned all of it that year
- **THEN** the page says he had no ownership share in any flat that year, shows no cards, and offers the selector with Annika and the whole flats

#### Scenario: Moving to the previous year
- **WHEN** Annika has owned `Kuusikuja 3 B 12` since `2024-05-01`, and selects the previous year on 2025
- **THEN** the page shows 2024 with the card of `Kuusikuja 3 B 12`, and the URL has `?year=2024`

### Requirement: The year the summary opens on
Without a year in the URL, the year summary SHALL open on the previous year from January to June and on the current year from July to December, in Finland's time. The years SHALL range from the first year in which the chosen holder had a share above 0 in a flat the user has access to, up to the current year: the user for the own share, the chosen person for another owner, and any owner for the whole flats. When the own share has no years, the years SHALL be those of the whole flats, so a member without a share can still move between years. Before the first of them the previous year button SHALL be disabled, and on the current year the next year button. When the year it would open on is before the first year, the summary SHALL open on the first year. A year outside the range in the URL SHALL open the nearest year in the range.

**No Playwright test:** the opening year depends on today's date, which a browser test can't set for the server; Vitest covers it with a fixed today.

#### Scenario: In spring the previous year opens
- **WHEN** today is `2026-03-15`, and Annika has owned a flat since `2024-05-01`
- **THEN** the summary opens on 2025, with the years 2024 to 2026

#### Scenario: From July the current year opens
- **WHEN** today is `2026-07-01`
- **THEN** the summary opens on 2026

#### Scenario: A first share this year
- **WHEN** today is `2026-03-15`, and Annika's first share starts on `2026-02-01`
- **THEN** the summary opens on 2026, with 2026 as the only year

#### Scenario: The years of another owner
- **WHEN** today is `2026-03-15`, Annika has owned `Kuusikuja 3 B 12` since `2022-06-12`, and Mikko's 5000 basis points of it start on `2025-03-01`
- **THEN** Mikko's figures have the years 2025 to 2026, and the whole flats the years 2022 to 2026

#### Scenario: A member without a share moves between years
- **WHEN** today is `2026-03-15`, and Jussi, a member without a share, sees `Kuusikuja 3 B 12`, owned by Annika since `2022-06-12`
- **THEN** his own share opens on 2025, with the years 2022 to 2026

### Requirement: The form 7H page of a flat
Everyone with access to a flat SHALL be able to open its form 7H page `/year-summary/$propertyId?year=…` from the year summary, for the own share, for another owner (`&person=<user id>`, "Another owner's figures") or for the whole flat (`&person=whole`, "The whole flat's page"). For the own share and another owner, the page SHALL show:
- the flat's address and the year, and whose share it is
- the checks of the flat ("Checks in the year summary")
- the flat details form 7H asks for ("Flat details for form 7H"), with that person's share
- rows 2.1–2.5 of that person's share ("Form 7H rows of the own share"), each with its number, the row name used on form 7H, its parts and its amount
- under row 2.3, when it is above 0, a note that deducting income-recognised capital charges has not always been accepted in case law (CONCEPT.md §4.3)
- the Not on form 7H card ("The Not on form 7H card")
- a note that the figures are counted by payment date with the share on each date, and that they should be checked before filing

Each value SHALL have a copy button ("Copying form 7H values"). Back SHALL return to the year summary of the same year and the same choice of person. The page SHALL NOT show the bottom bar. A user without access to the flat SHALL see that the flat was not found. When the person had no share that year, the page SHALL say so and show no rows.

#### Scenario: The rows of a flat
- **WHEN** Annika owns 10000 basis points of `Kuusikuja 3 B 12` from `2026-01-01`, the rent of 89000 cents is paid on `2026-02-03`, the maintenance charge is 20000 cents a month from `2026-01-01`, and she opens its form 7H page for the current year
- **THEN** row 2.1 shows `890,00 €` and row 2.2 the maintenance charges of the months so far, and Back returns to `/year-summary` with the same year

#### Scenario: The case law note under row 2.3
- **WHEN** the flat's financing charge is income-recognised, and row 2.3 is above 0
- **THEN** the page shows the note on case law under row 2.3

#### Scenario: A flat the user can't see
- **WHEN** Jussi opens the form 7H page of a flat he has no access to
- **THEN** he sees that the flat was not found

#### Scenario: A flat without a share that year
- **WHEN** Jussi, a member of `Kuusikuja 3 B 12` without a share, opens its form 7H page for his own share
- **THEN** he sees that he had no ownership share in the flat that year, and no rows

## ADDED Requirements

### Requirement: Choosing whose figures
The year summary SHALL have a *Kenen luvut* selector under the year when the year has at least one owner other than the user. Without one, every flat in the summary is the user's alone and the whole flats equal the own share, so the selector SHALL NOT be shown, unless another person or the whole flats are chosen: then it SHALL be shown, so the user can return to their own share. The selector SHALL open a sheet with:
- *Oma osuutesi*, the default, with the number of flats in the own summary
- every other person who had a share above 0 on at least one day of the year, up to today in the current year, in a flat the user has access to, archived flats included, with the number of such flats. A person whose share ended during the year is listed too. A chosen person without a share in the year SHALL be listed with 0 flats, so the choice stays marked.
- *Koko asunnot (100 %)*, with the number of flats in the whole flats ("The whole flats")

Names SHALL be shown in their stored form, never inflected. The choice SHALL be in the URL, `?person=<user id>` or `?person=whole`, and SHALL be kept when moving to another year, to a flat's form 7H page and back. Choosing *Oma osuutesi* SHALL remove `person` from the URL. A person in the URL who has no share that year in the user's flats SHALL show that they had no ownership share in the flats the user sees that year. A `person` that is no owner of any of the user's flats in any year SHALL open the own share.

#### Scenario: The sheet lists the year's owners
- **WHEN** Annika and Mikko own 5000 basis points each of `Kuusikuja 3 B 12` in 2025, Jussi owned 5000 basis points of `Koivupolku 7 A 4` until `2025-06-30`, and Annika opens the selector on 2025
- **THEN** the sheet lists *Oma osuutesi*, Mikko with 1 flat, Jussi with 1 flat and *Koko asunnot (100 %)*, with *Oma osuutesi* chosen

#### Scenario: No selector for a sole owner
- **WHEN** Annika alone owns all her flats in 2025
- **THEN** the year summary of 2025 shows no selector

#### Scenario: The choice follows the year and the flat
- **WHEN** Annika has chosen Mikko on 2025, moves to 2024, opens `Kuusikuja 3 B 12` and selects Back
- **THEN** the URLs are `/year-summary?year=2024&person=<Mikko's id>`, `/year-summary/<its id>?year=2024&person=<Mikko's id>` and again the first

#### Scenario: A person without a share that year
- **WHEN** Annika has chosen Jussi, whose 5000 basis points of `Koivupolku 7 A 4` ended on `2025-06-30`, and moves to 2026
- **THEN** the page says that Jussi had no ownership share in the flats she sees in 2026, shows no cards, and offers the selector with Jussi chosen

#### Scenario: An unknown person in the URL
- **WHEN** Annika opens `/year-summary?year=2025&person=someone-else`, and that id owns none of her flats
- **THEN** the page shows her own share

### Requirement: Another owner's figures
Everyone with access to a flat SHALL be able to see the year summary and the form 7H page of every other person who had a share in it, also a member with a 0 % share. The figures SHALL be computed exactly as the own share's ("Form 7H rows of the own share", "Shares on the cash basis", "Checks in the year summary"), with that person's share in place of the user's. They SHALL cover only the flats the user has access to. The page SHALL say that, and that the person may have other rental flats to report. The cards SHALL show the person's share. The "Not included" note SHALL name the user's other flats, with the reason that the person had no share in them that year. The form 7H page SHALL name the person and keep the copy buttons. A person's figures SHALL never include a flat the user has no access to.

#### Scenario: A co-owner's cards
- **WHEN** Annika and Mikko own 5000 basis points each of `Kuusikuja 3 B 12` in 2025, the rent of 89000 cents is paid on `2025-02-03`, Annika alone owns `Koivupolku 7 A 4`, and Annika chooses Mikko on 2025
- **THEN** the page shows one card, `Kuusikuja 3 B 12` with share 50 % and row 2.1 `445,00 €`, the note that only the flats she sees are counted, and the "Not included" note names `Koivupolku 7 A 4`

#### Scenario: A member sees an owner's figures
- **WHEN** Jussi, a member of `Kuusikuja 3 B 12` with a 0 % share, chooses Annika, who owns 10000 basis points of it
- **THEN** he sees the card of `Kuusikuja 3 B 12` with Annika's share and figures

#### Scenario: A flat the user can't see is not counted
- **WHEN** Mikko also owns `Pyynikintie 5 A 3`, which Annika has no access to, and Annika chooses Mikko
- **THEN** her page has no card for `Pyynikintie 5 A 3`, and its address is nowhere on the page

#### Scenario: A co-owner's form 7H page
- **WHEN** Annika opens `Kuusikuja 3 B 12` with Mikko chosen
- **THEN** the form 7H page names Mikko, shows his share of 50 % and his rows, each with a copy button

### Requirement: The whole flats
With *Koko asunnot (100 %)* chosen, the year summary SHALL show a card for each flat the user has access to, archived flats included, that had an owner with a share above 0 on at least one day of the year, up to today in the current year. Flats in which the user's own share is 0 % are included too. The figures SHALL be computed as the own share's, with the sum of all owners' shares on each date in place of the user's, which is 100 % whenever the flat is owned. Each card SHALL show the owners with their shares at the end of the year, or at the end of their period, instead of the user's share. The page SHALL say that the figures are not reported as such, because each owner reports their own share on form 7H. The share changed check SHALL NOT be shown for the whole flat.

#### Scenario: The whole flats include a flat without the own share
- **WHEN** Annika and Mikko own 5000 basis points each of `Kuusikuja 3 B 12` in 2025, Annika has a 0 % share of `Hallilantie 12 B 8`, which Mikko owns alone, and Annika chooses *Koko asunnot (100 %)* on 2025
- **THEN** the page shows cards for both flats, `Kuusikuja 3 B 12` with "Annika 50 % · Mikko Virtanen 50 %", and the note that the figures are not reported as such

#### Scenario: The whole flat counts every owner's share
- **WHEN** `Kuusikuja 3 B 12` is owned by Annika and Mikko at 5000 basis points each, and the rent of 89000 cents is paid on `2025-02-03`
- **THEN** its whole flat row 2.1 counts `890,00 €` for that payment

#### Scenario: An owner change in the middle of the year
- **WHEN** Jussi owned 5000 basis points of `Koivupolku 7 A 4` until `2025-06-30`, Annika the other 5000 and all of it from `2025-07-01`
- **THEN** the whole flat card shows "Annika 100 % · Jussi Laine 50 %", and no share changed chip

### Requirement: The whole flat's page
The form 7H page of a flat with `person=whole` SHALL show the flat as a whole for checking, not for filing. It SHALL show:
- the flat's address, the year and that it is the whole flat at 100 %
- a note that the figures are not reported as such
- the checks of the flat, without the share changed check
- an *Omistajat* card with each owner who had a share in the year: their name, their share at the end of the year or of their period, and their row 2.1, each opening that owner's form 7H page (`person=<their id>`, or no `person` for the user)
- rows 2.1–2.5 at 100 %, with their parts, without copy buttons
- the Not on form 7H card

It SHALL NOT show the flat details card or any copy button. Back SHALL return to the whole flats of the same year.

#### Scenario: The whole flat's rows and owners
- **WHEN** Annika and Mikko own 5000 basis points each of `Kuusikuja 3 B 12` in 2025, the rent of 89000 cents is paid on `2025-02-03`, and Annika opens it with *Koko asunnot (100 %)* chosen
- **THEN** the page shows the owners Annika and Mikko Virtanen at 50 % each, row 2.1 at 100 %, and no copy button

#### Scenario: Opening an owner from the whole flat
- **WHEN** Annika selects Mikko Virtanen in the *Omistajat* card
- **THEN** his form 7H page of the flat opens with `person=<Mikko's id>` and the same year
