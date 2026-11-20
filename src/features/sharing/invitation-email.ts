// The email that invites someone to a flat (Design canvas: KutsuEmail). It
// names the inviter and the invited address but not the flat: the address is
// shown after signing in, so less personal data goes to the email provider.
import { m } from '#/paraglide/messages.js'
import type { Locale } from '#/paraglide/runtime.js'
import type { EmailMessage } from '#/server/email/email'
import { renderEmail } from '#/server/email/layout'

/** How long an invitation can be accepted (spec: "Accepting a flat invitation"). */
export const INVITATION_VALID_DAYS = 30

export function invitationEmail(options: {
  to: string
  inviterName: string
  /**
   * The inviter's verified address, shown next to the name so the reader
   * can tell who sent it: anyone can choose any name.
   */
  inviterEmail: string
  /** Where "Open Kotivalo" leads: the app's origin. */
  appUrl: string
  locale: Locale
  /** Makes a retried send safe. */
  invitationId: string
}): EmailMessage {
  const { to, inviterName: inviter, appUrl, locale } = options
  return renderEmail({
    to,
    locale,
    // No name in the subject: it is the line a phishing attempt would use.
    subject: m.invitation_email_subject({}, { locale }),
    heading: m.invitation_email_heading({}, { locale }),
    paragraphs: [
      m.invitation_email_intro(
        { inviter, inviterEmail: options.inviterEmail },
        { locale },
      ),
      m.invitation_email_sign_in({ email: to }, { locale }),
      m.invitation_email_validity({ days: INVITATION_VALID_DAYS }, { locale }),
      m.invitation_email_ignore({}, { locale }),
    ],
    action: { label: m.invitation_email_action({}, { locale }), url: appUrl },
    idempotencyKey: `invitation-${options.invitationId}`,
  })
}
