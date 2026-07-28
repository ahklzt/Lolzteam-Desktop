import { copyFileSync, existsSync, mkdirSync, readFileSync, unlinkSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DEFAULT_ICON_ID = 1

const src = resolve(__dirname, `../build/app-icons/icon${DEFAULT_ICON_ID}.png`)
const dst = resolve(__dirname, '../build/icon.png')
const legacyIco = resolve(__dirname, '../build/icon.ico')

if (!existsSync(src)) {
  console.error(`icon_source_missing: ${src}`)
  process.exit(1)
}

const png = readFileSync(src)
if (png.length < 33 || png.readUInt32BE(0) !== 0x89504e47) {
  console.error(`icon_source_not_png: ${src}`)
  process.exit(1)
}

const width = png.readUInt32BE(16)
const height = png.readUInt32BE(20)
if (width !== height || width < 256) {
  console.error(`icon_source_size_invalid: ${width}x${height}`)
  process.exit(1)
}

mkdirSync(dirname(dst), { recursive: true })
copyFileSync(src, dst)
if (existsSync(legacyIco)) unlinkSync(legacyIco)

console.log(`build icon: icon${DEFAULT_ICON_ID}.png ${width}x${height} -> build/icon.png`)
