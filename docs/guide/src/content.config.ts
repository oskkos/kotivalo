import { defineCollection } from 'astro:content'
import { z } from 'astro/zod'
import { docsLoader } from '@astrojs/starlight/loaders'
import { docsSchema } from '@astrojs/starlight/schema'

// A page lists the spec requirements it describes, each with a hash of the
// requirement's text. `pnpm guide:check` compares them with the specs; the
// list is never rendered (spec: "Guide pages cite their requirements").
const requirement = z.object({
  spec: z.string(),
  name: z.string(),
  hash: z.string().regex(/^[0-9a-f]{12}$/),
})

export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema({
      extend: z.object({ requirements: z.array(requirement).min(1) }),
    }),
  }),
}
