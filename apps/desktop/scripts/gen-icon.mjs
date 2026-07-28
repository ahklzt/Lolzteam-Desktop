import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SIZE = 256

const radius = 56
const bg = [0, 186, 120, 255]
const fg = [255, 255, 255, 255]

const check = [
  [70, 132],
  [112, 174],
  [186, 90],
]
const strokeW = 22

const distToSeg = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  const cx = ax + t * dx
  const cy = ay + t * dy
  return Math.hypot(px - cx, py - cy)
}

const insideRoundRect = (x, y) => {
  const r = radius
  if (x >= r && x <= SIZE - r) return y >= 0 && y < SIZE
  if (y >= r && y <= SIZE - r) return x >= 0 && x < SIZE
  const cx = x < r ? r : SIZE - r
  const cy = y < r ? r : SIZE - r
  return Math.hypot(x - cx, y - cy) <= r
}

const onCheck = (x, y) => {
  for (let i = 0; i < check.length - 1; i++) {
    const [ax, ay] = check[i]
    const [bx, by] = check[i + 1]
    if (distToSeg(x, y, ax, ay, bx, by) <= strokeW / 2) return true
  }
  return false
}

const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE)
let o = 0
for (let y = 0; y < SIZE; y++) {
  raw[o++] = 0
  for (let x = 0; x < SIZE; x++) {
    let px = [0, 0, 0, 0]
    if (insideRoundRect(x, y)) px = onCheck(x, y) ? fg : bg
    raw[o++] = px[0]
    raw[o++] = px[1]
    raw[o++] = px[2]
    raw[o++] = px[3]
  }
}

const crcTable = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
const crc32 = (buf) => {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

const chunk = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(SIZE, 0)
ihdr.writeUInt32BE(SIZE, 4)
ihdr[8] = 8
ihdr[9] = 6
ihdr[10] = 0
ihdr[11] = 0
ihdr[12] = 0

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
])

const iconPath = resolve(__dirname, '../build/icon.png')
mkdirSync(dirname(iconPath), { recursive: true })
writeFileSync(iconPath, png)

const dataUrl = `data:image/png;base64,${png.toString('base64')}`
const tsPath = resolve(__dirname, '../src/main/window/icon-data.ts')
mkdirSync(dirname(tsPath), { recursive: true })
writeFileSync(
  tsPath,
  `// Автогенерация: scripts/gen-icon.mjs. Не редактировать вручную.\nexport const APP_ICON_DATA_URL = '${dataUrl}'\n`,
)

console.log('icon.png:', png.length, 'bytes; icon-data.ts written')
