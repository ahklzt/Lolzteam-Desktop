import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DEFAULT_ICON_ID = 1

const src = resolve(__dirname, `../build/app-icons/icon${DEFAULT_ICON_ID}.png`)
const dst = resolve(__dirname, '../build/icon.png')
const icoDst = resolve(__dirname, '../build/icon.ico')

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

const ico = Buffer.alloc(22 + png.length)
ico.writeUInt16LE(0, 0)
ico.writeUInt16LE(1, 2)
ico.writeUInt16LE(1, 4)
ico.writeUInt8(width >= 256 ? 0 : width, 6)
ico.writeUInt8(height >= 256 ? 0 : height, 7)
ico.writeUInt8(0, 8)
ico.writeUInt8(0, 9)
ico.writeUInt16LE(1, 10)
ico.writeUInt16LE(32, 12)
ico.writeUInt32LE(png.length, 14)
ico.writeUInt32LE(22, 18)
png.copy(ico, 22)
writeFileSync(icoDst, ico)

console.log(
  `build icon: icon${DEFAULT_ICON_ID}.png ${width}x${height} -> build/icon.png + build/icon.ico`,
)
