import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    {
      name: 'resolve-nodenext-js-to-ts',
      enforce: 'pre',
      async resolveId(source, importer) {
        if (!importer || !source.startsWith('.') || !source.endsWith('.js')) {
          return null
        }
        const asTs = source.replace(/\.js$/, '.ts')
        const resolved = await this.resolve(asTs, importer, { skipSelf: true })
        return resolved ?? null
      },
    },
  ],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    restoreMocks: true,
  },
})
