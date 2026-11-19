import { m } from '#/paraglide/messages.js'
import type { RoomCount } from './property'

// Static keys for Paraglide's no-dynamic-message-access rule.
const labels: Record<RoomCount, () => string> = {
  1: () => m.room_count_1(),
  2: () => m.room_count_2(),
  3: () => m.room_count_3(),
  4: () => m.room_count_4(),
}

/** "Yksiö", "Kaksio", "Kolmio" or "4h+" in Finnish. */
export function roomCountLabel(count: RoomCount): string {
  return labels[count]()
}
