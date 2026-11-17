import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { cloudflare } from '@cloudflare/vite-plugin'
import { paraglideVitePlugin } from '@inlang/paraglide-js'

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    // Options in project.inlang/paraglide.config.ts.
    paraglideVitePlugin({ project: './project.inlang' }),
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    tanstackStart({
      // Keep test files next to routes without making them routes.
      router: { routeFileIgnorePattern: '\\.test\\.' },
    }),
    viteReact(),
  ],
})
