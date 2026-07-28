import { constants, access, writeFile } from 'node:fs/promises'
import { join, parse } from 'node:path'
import { fileExists as sharedFileExists } from '../_shared/fs'

export const fileExists = sharedFileExists

export const resolveTelegramExe = (folder: string): string => join(folder, 'Telegram.exe')

export const ensurePortableMarker = async (folder: string): Promise<void> => {
  const marker = join(folder, 'tportable.tdat')
  if (await sharedFileExists(marker)) return
  await writeFile(marker, '')
}

export const getTdataDir = async (folder: string): Promise<string> => {
  if (!folder || !folder.trim()) {
    throw new Error('Путь к папке Telegram пуст')
  }
  const parsed = parse(folder)
  if (folder === parsed.root) {
    throw new Error('Папка Telegram не должна быть корнем диска — используйте отдельную папку')
  }
  await access(folder, constants.W_OK)
  return join(folder, 'tdata')
}
