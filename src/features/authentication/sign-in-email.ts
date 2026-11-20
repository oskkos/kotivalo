// The email that carries a sign-in code (Design canvas: SignInCodeEmail).
import { m } from '#/paraglide/messages.js'
import type { Locale } from '#/paraglide/runtime.js'
import { SIGN_IN_CODE } from '#/server/auth/auth'
import type { EmailMessage } from '#/server/email/email'
import { renderEmail } from '#/server/email/layout'

/**
 * The code is in the subject too, so it shows in the notification and phones
 * can offer it for autofill.
 */
export function signInCodeEmail(options: {
  to: string
  code: string
  locale: Locale
  /** The app's origin, for the logo. */
  appUrl: string
}): EmailMessage {
  const { to, code, locale, appUrl } = options
  return renderEmail({
    to,
    locale,
    appUrl,
    subject: m.sign_in_email_subject({ code }, { locale }),
    heading: m.sign_in_email_heading({}, { locale }),
    paragraphs: [
      m.sign_in_email_intro({}, { locale }),
      { code },
      m.sign_in_email_validity(
        { minutes: SIGN_IN_CODE.validSeconds / 60 },
        { locale },
      ),
      m.sign_in_email_ignore({}, { locale }),
    ],
  })
}
