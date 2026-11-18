// /sign-in: the email step, then the code step, in one page.
import { useState } from 'react'
import { CodeStep } from './CodeStep'
import { EmailStep } from './EmailStep'

type Step =
  | { name: 'email'; email: string }
  | { name: 'code'; email: string; sentAt: number }

interface Props {
  /** Defaults to a full page load of `/`, so it renders in the account's language. */
  onSignedIn?: () => void
}

export function SignInPage({
  onSignedIn = () => {
    window.location.assign('/')
  },
}: Props) {
  const [step, setStep] = useState<Step>({ name: 'email', email: '' })

  if (step.name === 'email') {
    return (
      <EmailStep
        defaultEmail={step.email}
        onSent={(email) => {
          setStep({ name: 'code', email, sentAt: Date.now() })
        }}
      />
    )
  }
  return (
    <CodeStep
      key={step.sentAt}
      email={step.email}
      sentAt={step.sentAt}
      onResent={(sentAt) => {
        setStep({ ...step, sentAt })
      }}
      onChangeEmail={() => {
        setStep({ name: 'email', email: step.email })
      }}
      onSignedIn={onSignedIn}
    />
  )
}
