// This month's rent status on a flat's card on the flats list (Design
// canvas: Asunnot · vuokran tila; openspec: rent-payments, "The rent status
// on a flat's card"), the same row as the details page's rent card.
import { cardStatusText } from './labels'
import type { RentMonth } from './status'
import { StatusChip } from './StatusChip'

export function CardRentChip(props: { row: RentMonth }) {
  return (
    <StatusChip
      status={props.row.status}
      text={cardStatusText(props.row.status)}
      small
    />
  )
}
