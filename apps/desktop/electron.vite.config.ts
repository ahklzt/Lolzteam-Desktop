import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

const SHARED = '@lzt/shared'
const sharedEntry = resolve('../../packages/shared/src/index.ts')

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: [SHARED] })],
    resolve: {
      alias: {
        '@main': resolve('src/main'),
        [SHARED]: sharedEntry,
      },
    },
    build: {
      rollupOptions: {
        input: { index: resolve('src/main/index.ts') },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin({ exclude: [SHARED] })],
    resolve: {
      alias: {
        [SHARED]: sharedEntry,
      },
    },
    build: {
      rollupOptions: {
        input: { index: resolve('src/preload/index.ts') },
        output: { format: 'cjs', entryFileNames: '[name].js' },
      },
    },
  },
  renderer: {
    root: resolve('src/renderer'),
    plugins: [react()],
    resolve: {
      alias: {
        '~': resolve('src/renderer'),
        '~styles': resolve('src/renderer/styles'),
        [SHARED]: sharedEntry,
      },
    },
    css: {
      preprocessorOptions: {
        scss: {
          api: 'modern-compiler',
          additionalData: '@use "~styles/variables" as *;\n@use "~styles/mixins" as *;\n',
          loadPaths: [resolve('src/renderer')],
        },
      },
    },
    build: {
      rollupOptions: {
        input: { index: resolve('src/renderer/index.html') },
      },
    },
  },
})
