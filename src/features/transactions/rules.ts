// Date rules for entries (openspec: transactions), checked by the form and
// again on the server against today in Finland and the flat's first
// ownership start. Pure.
import type { IsoDate } from '#/lib/dates'

export type TransactionDateProblem =
  'transaction_date_in_future' | 'transaction_date_before_ownership'

export function validateTransactionDate(
  date: IsoDate,
  limits: { today: IsoDate; ownershipStart: IsoDate },
): TransactionDateProblem | undefined {
  if (date > limits.today) {
    return 'transaction_date_in_future'
  }
  if (date < limits.ownershipStart) {
    return 'transaction_date_before_ownership'
  }
  return undefined
}
