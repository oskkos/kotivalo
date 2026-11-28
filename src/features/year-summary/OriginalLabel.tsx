// A label with the Finnish original of its tax term in brackets after it
// (openspec: year-summary, "Finnish originals of tax terms"). Nothing is added
// in Finnish.
import type { WithOriginal } from './original-text'

export function OriginalLabel(props: { label: WithOriginal }) {
  const { text, original } = props.label
  return (
    <>
      {text}
      {original === null ? null : (
        <span
          style={{ fontWeight: 700, opacity: 0.8 }}
        >{` (${original})`}</span>
      )}
    </>
  )
}
