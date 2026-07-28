import { Tdata, convertFromTdata, convertToTdata } from '@mtcute/convert'
import { readStringSession } from '@mtcute/node/utils.js'
import type { StringSessionData } from '@mtcute/node/utils.js'

export type TdataSession = string | StringSessionData

export const MAX_ACCOUNTS = 3

export const toSessionData = (session: TdataSession): StringSessionData =>
  typeof session === 'string' ? readStringSession(session) : session

interface ReadLogger {
  info: (msg: string) => void
  warn: (msg: string) => void
}

export const readExistingSessions = async (
  tdataDir: string,
  log?: ReadLogger,
): Promise<StringSessionData[]> => {
  try {
    const tdata = await Tdata.open({ path: tdataDir, ignoreVersion: true })
    const order = tdata.keyData.order
    log?.info(`[telegram] tdata opened: ${order.length} account(s) in order`)
    const sessions: StringSessionData[] = []
    for (const idx of order) {
      try {
        sessions.push(await convertFromTdata(tdata, idx))
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        log?.warn(`[telegram] failed to read tdata account #${idx}: ${msg}`)
      }
    }
    return sessions
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log?.warn(`[telegram] could not open existing tdata (will overwrite): ${msg}`)
    return []
  }
}

export const mergeSessions = (
  incoming: StringSessionData,
  existing: StringSessionData[],
  max = MAX_ACCOUNTS,
): StringSessionData[] => {
  const incomingId = incoming.self?.userId ?? null
  const kept =
    incomingId === null ? existing : existing.filter((s) => s.self?.userId !== incomingId)
  const merged = [incoming, ...kept]
  return max > 0 ? merged.slice(0, max) : merged
}

export const writeTdata = async (
  sessions: TdataSession | TdataSession[],
  tdataDir: string,
): Promise<void> => {
  await convertToTdata(sessions, { path: tdataDir })
}
