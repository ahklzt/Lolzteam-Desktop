import { IPC } from '@lzt/shared'
import { ipcMain } from 'electron'
import { testTelegram } from '../services/telegram-alerts'

export const registerTelegramIpc = (): void => {
  ipcMain.handle(IPC.TELEGRAM_TEST, () => testTelegram())
}
