import { DC_MAPPING_PROD } from '@mtcute/convert'
import type { StringSessionData } from '@mtcute/node/utils.js'

const hexToBytes = (hex: string): Uint8Array => {
  if (hex.length % 2 !== 0) throw new Error('hex string has odd length')
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) {
    const byte = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
    if (Number.isNaN(byte)) throw new Error(`invalid hex at offset ${i * 2}`)
    out[i] = byte
  }
  return out
}

export const buildOfflineSession = (params: {
  authKeyHex: string
  dcId: number
  userId: number | null
}): StringSessionData => {
  const dcs = DC_MAPPING_PROD[params.dcId]
  if (!dcs) throw new Error(`Неизвестный DC id: ${params.dcId}`)
  const authKey = hexToBytes(params.authKeyHex)
  if (authKey.length !== 256) {
    throw new Error(`auth_key должен быть 256 байт, получено ${authKey.length}`)
  }
  const self =
    params.userId !== null
      ? { userId: params.userId, isBot: false, isPremium: false, usernames: [] }
      : undefined
  return {
    version: 3,
    primaryDcs: dcs,
    authKey,
    self,
  }
}
