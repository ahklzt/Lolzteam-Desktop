import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const COUNT = 12

const urls = []
for (let i = 1; i <= COUNT; i++) {
  const png = readFileSync(resolve(__dirname, `../build/app-icons/icon${i}.png`))
  urls.push(`data:image/png;base64,${png.toString('base64')}`)
}

const out = resolve(__dirname, '../../../packages/shared/src/app-icons-data.ts')
mkdirSync(dirname(out), { recursive: true })
const body =
  '// Автогенерация: apps/desktop/scripts/gen-app-icons.mjs. Не редактировать вручную.\n' +
  '// data-URL 12 иконок приложения (256×256): окно/трей (main) и превью выбора (renderer).\n' +
  'export const APP_ICON_DATA_URLS: string[] = [\n' +
  urls.map((u) => `  "${u}",`).join('\n') +
  '\n];\n'
writeFileSync(out, body)
console.log('app-icons-data.ts written:', urls.length, 'icons')
