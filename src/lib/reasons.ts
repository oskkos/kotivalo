// Why something failed, as a code: validation errors from Zod schemas and
// expected failures from server functions. Schemas and server functions
// return codes, never text, so the UI shows every error in the user's
// language through Paraglide (CLAUDE.md, "Forms and validation").
import { m } from '#/paraglide/messages.js'

/** Errors shown under the field they belong to. */
export type FieldReason =
  | 'email_invalid'
  | 'code_invalid'
  | 'code_wrong'
  | 'text_too_long'
  | 'street_address_required'
  | 'postcode_invalid'
  | 'city_required'
  | 'room_count_required'
  | 'name_required'
  | 'name_too_long'
  | 'name_invalid'
  | 'invitation_already_member'
  | 'invitation_already_pending'
  | 'date_invalid'
  | 'ownership_date_in_future'
  | 'ownership_date_too_early'
  | 'ownership_date_too_late'
  | 'ownership_share_invalid'
  | 'ownership_shares_total'
  | 'ownership_no_owner'
  | 'floor_area_invalid'
  | 'amount_invalid'
  | 'amount_date_not_month_start'
  | 'amount_date_before_ownership'
  | 'amount_date_too_early'
  | 'treatment_required'
  | 'transaction_amount_invalid'
  | 'transaction_category_invalid'
  | 'transaction_date_in_future'
  | 'transaction_date_before_ownership'
  | 'transaction_note_too_long'
  | 'receipt_unsupported_type'
  | 'receipt_too_large'
  | 'receipt_unreadable'
  | 'tenant_name_required'
  | 'tenant_name_too_long'
  | 'tenant_phone_too_long'
  | 'tenancy_overlaps'
  | 'tenancy_start_before_ownership'
  | 'tenancy_contract_made_in_future'
  | 'tenancy_end_before_start'
  | 'tenancy_due_day_invalid'
  | 'tenancy_notice_in_future'
  | 'tenancy_notice_before_start'
  | 'tenancy_end_before_notice'
  | 'tenancy_end_before_notice_period'
  | 'tenancy_end_after_term'
  | 'tenancy_fixed_term_notice'
  | 'rent_payment_amount_invalid'
  | 'rent_payment_date_in_future'

/** Errors about the whole action, shown as an alert with a title. */
export type AlertReason =
  | 'code_expired'
  | 'code_attempts_used'
  | 'limit_reached'
  | 'email_quota'
  | 'email_busy'
  | 'email_failed'
  | 'property_not_found'
  | 'property_limit_reached'
  | 'invitation_not_found'
  | 'invitation_limit_reached'
  | 'invitation_daily_limit_reached'
  | 'invitation_email_quota'
  | 'invitation_email_failed'
  | 'sharing_owner_only'
  | 'ownership_nothing_to_undo'
  | 'ownership_invalid'
  | 'amount_nothing_to_undo'
  | 'treatment_nothing_to_undo'
  | 'transaction_not_found'
  | 'storage_quota_full'
  | 'tenancy_not_found'
  | 'tenancy_already_ending'
  | 'tenancy_not_ending'
  | 'tenancy_already_ended'
  | 'tenancy_cancel_later_tenancy'
  | 'tenancy_correction_conflicts_ending'
  | 'tenancy_already_started'
  | 'tenancy_has_payments_outside'
  | 'tenancy_has_payments'
  | 'rent_payment_month_outside_tenancy'
  | 'rent_payment_not_found'
  /** The amounts changed since they were read; the page reloads them. */
  | 'amount_changed'
  /** A request never reached the server: offline or cancelled. */
  | 'network'
  /** A request failed in a way the app doesn't expect (a server error). */
  | 'unexpected'

export type Reason = FieldReason | AlertReason

export interface ReasonText {
  /** Set for alerts. */
  title?: string
  text: string
}

// Static keys: Paraglide's no-dynamic-message-access rule holds, and
// messages.test.ts checks every key exists in every language.
const texts: Record<Reason, () => ReasonText> = {
  email_invalid: () => ({ text: m.reason_email_invalid() }),
  code_invalid: () => ({ text: m.reason_code_invalid() }),
  code_wrong: () => ({ text: m.reason_code_wrong() }),
  text_too_long: () => ({ text: m.reason_text_too_long() }),
  street_address_required: () => ({ text: m.reason_street_address_required() }),
  postcode_invalid: () => ({ text: m.reason_postcode_invalid() }),
  city_required: () => ({ text: m.reason_city_required() }),
  room_count_required: () => ({ text: m.reason_room_count_required() }),
  name_required: () => ({ text: m.reason_name_required() }),
  name_too_long: () => ({ text: m.reason_name_too_long() }),
  name_invalid: () => ({ text: m.reason_name_invalid() }),
  invitation_already_member: () => ({
    text: m.reason_invitation_already_member(),
  }),
  invitation_already_pending: () => ({
    text: m.reason_invitation_already_pending(),
  }),
  date_invalid: () => ({ text: m.reason_date_invalid() }),
  ownership_date_in_future: () => ({
    text: m.reason_ownership_date_in_future(),
  }),
  ownership_date_too_early: () => ({
    text: m.reason_ownership_date_too_early(),
  }),
  ownership_date_too_late: () => ({ text: m.reason_ownership_date_too_late() }),
  ownership_share_invalid: () => ({ text: m.reason_ownership_share_invalid() }),
  ownership_shares_total: () => ({ text: m.reason_ownership_shares_total() }),
  ownership_no_owner: () => ({ text: m.reason_ownership_no_owner() }),
  floor_area_invalid: () => ({ text: m.reason_floor_area_invalid() }),
  amount_invalid: () => ({ text: m.reason_amount_invalid() }),
  amount_date_not_month_start: () => ({
    text: m.reason_amount_date_not_month_start(),
  }),
  amount_date_before_ownership: () => ({
    text: m.reason_amount_date_before_ownership(),
  }),
  amount_date_too_early: () => ({ text: m.reason_amount_date_too_early() }),
  treatment_required: () => ({ text: m.reason_treatment_required() }),
  transaction_amount_invalid: () => ({
    text: m.reason_transaction_amount_invalid(),
  }),
  transaction_category_invalid: () => ({
    text: m.reason_transaction_category_invalid(),
  }),
  transaction_date_in_future: () => ({
    text: m.reason_transaction_date_in_future(),
  }),
  transaction_date_before_ownership: () => ({
    text: m.reason_transaction_date_before_ownership(),
  }),
  transaction_note_too_long: () => ({
    text: m.reason_transaction_note_too_long(),
  }),
  receipt_unsupported_type: () => ({
    text: m.reason_receipt_unsupported_type(),
  }),
  receipt_too_large: () => ({ text: m.reason_receipt_too_large() }),
  receipt_unreadable: () => ({ text: m.reason_receipt_unreadable() }),
  tenant_name_required: () => ({ text: m.reason_tenant_name_required() }),
  tenant_name_too_long: () => ({ text: m.reason_tenant_name_too_long() }),
  tenant_phone_too_long: () => ({ text: m.reason_tenant_phone_too_long() }),
  tenancy_overlaps: () => ({ text: m.reason_tenancy_overlaps() }),
  tenancy_start_before_ownership: () => ({
    text: m.reason_tenancy_start_before_ownership(),
  }),
  tenancy_contract_made_in_future: () => ({
    text: m.reason_tenancy_contract_made_in_future(),
  }),
  tenancy_end_before_start: () => ({
    text: m.reason_tenancy_end_before_start(),
  }),
  tenancy_due_day_invalid: () => ({ text: m.reason_tenancy_due_day_invalid() }),
  tenancy_notice_in_future: () => ({
    text: m.reason_tenancy_notice_in_future(),
  }),
  tenancy_notice_before_start: () => ({
    text: m.reason_tenancy_notice_before_start(),
  }),
  tenancy_end_before_notice: () => ({
    text: m.reason_tenancy_end_before_notice(),
  }),
  tenancy_end_before_notice_period: () => ({
    text: m.reason_tenancy_end_before_notice_period(),
  }),
  tenancy_end_after_term: () => ({ text: m.reason_tenancy_end_after_term() }),
  tenancy_fixed_term_notice: () => ({
    text: m.reason_tenancy_fixed_term_notice(),
  }),
  code_expired: () => ({
    title: m.reason_code_expired_title(),
    text: m.reason_code_expired(),
  }),
  code_attempts_used: () => ({
    title: m.reason_code_attempts_used_title(),
    text: m.reason_code_attempts_used(),
  }),
  limit_reached: () => ({
    title: m.reason_limit_reached_title(),
    text: m.reason_limit_reached(),
  }),
  email_quota: () => ({
    title: m.reason_email_quota_title(),
    text: m.reason_email_quota(),
  }),
  email_busy: () => ({
    title: m.reason_email_busy_title(),
    text: m.reason_email_busy(),
  }),
  email_failed: () => ({
    title: m.reason_email_failed_title(),
    text: m.reason_email_failed(),
  }),
  property_not_found: () => ({
    title: m.reason_property_not_found_title(),
    text: m.reason_property_not_found(),
  }),
  property_limit_reached: () => ({
    title: m.reason_property_limit_reached_title(),
    text: m.reason_property_limit_reached(),
  }),
  invitation_not_found: () => ({
    title: m.reason_invitation_not_found_title(),
    text: m.reason_invitation_not_found(),
  }),
  invitation_limit_reached: () => ({
    title: m.reason_invitation_limit_reached_title(),
    text: m.reason_invitation_limit_reached(),
  }),
  invitation_daily_limit_reached: () => ({
    title: m.reason_invitation_daily_limit_reached_title(),
    text: m.reason_invitation_daily_limit_reached(),
  }),
  invitation_email_quota: () => ({
    title: m.reason_invitation_email_quota_title(),
    text: m.reason_invitation_email_quota(),
  }),
  invitation_email_failed: () => ({
    title: m.reason_invitation_email_failed_title(),
    text: m.reason_invitation_email_failed(),
  }),
  sharing_owner_only: () => ({
    title: m.reason_sharing_owner_only_title(),
    text: m.reason_sharing_owner_only(),
  }),
  ownership_nothing_to_undo: () => ({
    title: m.reason_ownership_nothing_to_undo_title(),
    text: m.reason_ownership_nothing_to_undo(),
  }),
  ownership_invalid: () => ({
    title: m.reason_ownership_invalid_title(),
    text: m.reason_ownership_invalid(),
  }),
  amount_nothing_to_undo: () => ({
    title: m.reason_amount_nothing_to_undo_title(),
    text: m.reason_amount_nothing_to_undo(),
  }),
  treatment_nothing_to_undo: () => ({
    title: m.reason_treatment_nothing_to_undo_title(),
    text: m.reason_treatment_nothing_to_undo(),
  }),
  transaction_not_found: () => ({
    title: m.reason_transaction_not_found_title(),
    text: m.reason_transaction_not_found(),
  }),
  storage_quota_full: () => ({
    title: m.reason_storage_quota_full_title(),
    text: m.reason_storage_quota_full(),
  }),
  tenancy_not_found: () => ({
    title: m.reason_tenancy_not_found_title(),
    text: m.reason_tenancy_not_found(),
  }),
  tenancy_already_ending: () => ({
    title: m.reason_tenancy_already_ending_title(),
    text: m.reason_tenancy_already_ending(),
  }),
  tenancy_not_ending: () => ({
    title: m.reason_tenancy_not_ending_title(),
    text: m.reason_tenancy_not_ending(),
  }),
  tenancy_already_ended: () => ({
    title: m.reason_tenancy_already_ended_title(),
    text: m.reason_tenancy_already_ended(),
  }),
  tenancy_cancel_later_tenancy: () => ({
    title: m.reason_tenancy_cancel_later_tenancy_title(),
    text: m.reason_tenancy_cancel_later_tenancy(),
  }),
  tenancy_already_started: () => ({
    title: m.reason_tenancy_already_started_title(),
    text: m.reason_tenancy_already_started(),
  }),
  tenancy_correction_conflicts_ending: () => ({
    title: m.reason_tenancy_correction_conflicts_ending_title(),
    text: m.reason_tenancy_correction_conflicts_ending(),
  }),
  tenancy_has_payments_outside: () => ({
    title: m.reason_tenancy_has_payments_outside_title(),
    text: m.reason_tenancy_has_payments_outside(),
  }),
  tenancy_has_payments: () => ({
    title: m.reason_tenancy_has_payments_title(),
    text: m.reason_tenancy_has_payments(),
  }),
  rent_payment_amount_invalid: () => ({
    text: m.reason_rent_payment_amount_invalid(),
  }),
  rent_payment_date_in_future: () => ({
    text: m.reason_rent_payment_date_in_future(),
  }),
  rent_payment_month_outside_tenancy: () => ({
    title: m.reason_rent_payment_month_outside_tenancy_title(),
    text: m.reason_rent_payment_month_outside_tenancy(),
  }),
  rent_payment_not_found: () => ({
    title: m.reason_rent_payment_not_found_title(),
    text: m.reason_rent_payment_not_found(),
  }),
  amount_changed: () => ({
    title: m.reason_amount_changed_title(),
    text: m.reason_amount_changed(),
  }),
  network: () => ({
    title: m.reason_network_title(),
    text: m.reason_network(),
  }),
  unexpected: () => ({
    title: m.reason_unexpected_title(),
    text: m.reason_unexpected(),
  }),
}

export function isReason(value: unknown): value is Reason {
  return typeof value === 'string' && Object.hasOwn(texts, value)
}

/** The text for a reason, in the current language. */
export function reasonText(reason: Reason): ReasonText {
  return texts[reason]()
}
