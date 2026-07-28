import { IPC, type ModeratorSettings, type SettingsSnapshot } from '@lzt/shared'
import { BrowserWindow, ipcMain } from 'electron'
import log from 'electron-log/main'
import { resolveEffectiveLocale } from '../settings/locale'
import {
  getSettings,
  onSettingsChange,
  resetSettings,
  setSettings,
} from '../settings/settings-store'

const respond = (settings: ModeratorSettings): SettingsSnapshot => ({
  settings,
  effectiveLocale: resolveEffectiveLocale(settings.locale),
})

export const registerSettingsIpc = (): void => {
  const applyErrorReports = (settings: ModeratorSettings): void => {
    log.transports.file.level = settings.errorReports ? 'info' : 'warn'
  }
  void getSettings().then(applyErrorReports)

  ipcMain.handle(IPC.SETTINGS_GET, async () => respond(await getSettings()))

  ipcMain.handle(IPC.SETTINGS_SET, async (_e, patch: Partial<ModeratorSettings>) =>
    respond(await setSettings(patch ?? {})),
  )

  ipcMain.handle(IPC.SETTINGS_RESET, async () => respond(await resetSettings()))

  onSettingsChange((settings) => {
    applyErrorReports(settings)
    const payload = respond(settings)
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send(IPC.SETTINGS_CHANGED, payload)
    }
  })
}
