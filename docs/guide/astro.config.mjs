// @ts-check
import { defineConfig } from 'astro/config'
import starlight from '@astrojs/starlight'

// The guide's site (openspec/changes/add-user-guide, design.md, decisions 1
// and 7). Finnish is the root language; Swedish and English are ready for
// their own pages.
export default defineConfig({
  site: 'https://ohje.kotivalo.app',
  integrations: [
    starlight({
      title: 'Kotivalo – Käyttöohje',
      logo: { src: './src/assets/logo.svg', alt: 'Kotivalo' },
      favicon: '/favicon.svg',
      defaultLocale: 'root',
      locales: {
        root: { label: 'Suomi', lang: 'fi' },
        sv: { label: 'Svenska', lang: 'sv' },
        en: { label: 'English', lang: 'en' },
      },
      customCss: [
        '@fontsource-variable/nunito/index.css',
        './src/styles/theme.css',
      ],
      sidebar: [
        { label: 'Käyttöohje', items: [{ autogenerate: { directory: '.' } }] },
      ],
    }),
  ],
})
