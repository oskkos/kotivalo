## MODIFIED Requirements

### Requirement: Storage quota for receipts
Each user SHALL be able to store up to 500 MB and up to 1,000 files of receipts and documents ("Storage quota for documents") together, counted from the files they uploaded. The quota SHALL be checked before a file is stored, from the sizes recorded in the database. A receipt that would exceed it SHALL be refused with the reason `storage_quota_full`, nothing SHALL be stored, and the user SHALL be able to save the entry without the receipt.

**No Playwright test:** reaching the quota needs 500 MB or 1,000 stored files; Workers tests cover the check with recorded sizes, and a component test shows the message.

#### Scenario: A receipt over the file count is refused
- **WHEN** a user who has uploaded 1,000 receipts sends a new entry with a receipt
- **THEN** it is refused with the reason `storage_quota_full`, and neither the entry nor a file is stored

#### Scenario: A receipt over the size is refused
- **WHEN** a user whose receipts take 524 000 000 bytes sends a new entry with a 500 000-byte receipt
- **THEN** it is refused with the reason `storage_quota_full`

#### Scenario: Another owner's files don't count
- **WHEN** Jussi has uploaded 1,000 receipts for `Kuusikuja 3 B 12` and Annika, who has uploaded none, attaches a receipt to an entry of the same flat
- **THEN** the receipt is stored

#### Scenario: Documents count towards the receipt quota
- **WHEN** a user has uploaded 400 receipts and 600 documents, and sends a new entry with a receipt
- **THEN** it is refused with the reason `storage_quota_full`, and neither the entry nor a file is stored
