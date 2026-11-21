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
