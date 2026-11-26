// D1 refuses a statement with more than 100 bound parameters, so a read by a
// list of ids that can grow with the data (every tenancy of the user's flats)
// runs in chunks. Portable: another database just gets fewer, bigger chunks
// it doesn't need.

/** Ids per chunk, below D1's 100 bound parameters with room for the rest. */
export const MAX_IDS_PER_QUERY = 90

/**
 * Runs `read` on the ids in chunks of at most `MAX_IDS_PER_QUERY` and joins
 * the rows in chunk order. The rows of one id all come from the same chunk,
 * so an order by id-related columns holds within each id.
 */
export async function inChunks<Row>(
  ids: readonly string[],
  read: (chunk: string[]) => Promise<Row[]>,
): Promise<Row[]> {
  const chunks: string[][] = []
  for (let i = 0; i < ids.length; i += MAX_IDS_PER_QUERY) {
    chunks.push(ids.slice(i, i + MAX_IDS_PER_QUERY))
  }
  return (await Promise.all(chunks.map(read))).flat()
}
