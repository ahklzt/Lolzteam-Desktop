import { IPC, type CheckerSteamInput } from '@lzt/shared'
import { ipcMain } from 'electron'
import { checkSteamAccount } from '../services/checker-steam'

export const registerCheckerIpc = (): void => {
  ipcMain.handle(IPC.CHECKER_STEAM, (_e, { input }: { input: CheckerSteamInput }) =>
    checkSteamAccount(input),
  )
}
