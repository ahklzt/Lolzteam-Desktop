import { createRequire } from 'node:module'
import { IPC, type UpdateStatus } from '@lzt/shared'
import { app, ipcMain } from 'electron'
import log from 'electron-log/main'
import { getMainWindow } from './window/main-window'
import { getCachedSettings, onSettingsChange } from './settings/settings-store'

type UpdateInfo = { version: string; releaseNotes?: unknown }
type ProgressInfo = { percent: number; transferred: number; total: number }

type AutoUpdater = {
  logger: unknown
  autoDownload: boolean
  autoInstallOnAppQuit: boolean
  allowPrerelease: boolean
  on(event: 'checking-for-update', cb: () => void): void
  on(event: 'update-available', cb: (info: UpdateInfo) => void): void
  on(event: 'update-not-available', cb: () => void): void
  on(event: 'download-progress', cb: (p: ProgressInfo) => void): void
  on(event: 'update-downloaded', cb: (info: UpdateInfo) => void): void
  on(event: 'error', cb: (err: unknown) => void): void
  checkForUpdates(): Promise<unknown>
  downloadUpdate(): Promise<unknown>
  quitAndInstall(): void
}

const emit = (status: UpdateStatus): void => {
  getMainWindow()?.webContents.send(IPC.UPDATE_STATUS, status)
}

const loadAutoUpdater = (): AutoUpdater | null => {
  try {
    const req = createRequire(import.meta.url)
    const mod = req('electron-updater') as {
      autoUpdater?: AutoUpdater
      default?: { autoUpdater?: AutoUpdater }
    }
    return mod.autoUpdater ?? mod.default?.autoUpdater ?? null
  } catch (err) {
    log.warn('[updater] electron-updater недоступен', err)
    return null
  }
}

let wired = false

const wireEvents = (autoUpdater: AutoUpdater): void => {
  if (wired) return
  wired = true

  autoUpdater.logger = log
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => emit({ state: 'checking' }))
  autoUpdater.on('update-available', (info) =>
    emit({
      state: 'available',
      version: info.version,
      notes: typeof info.releaseNotes === 'string' ? info.releaseNotes : null,
    }),
  )
  autoUpdater.on('update-not-available', () => emit({ state: 'not-available' }))
  autoUpdater.on('download-progress', (p) =>
    emit({
      state: 'downloading',
      percent: Math.round(p.percent),
      transferred: p.transferred,
      total: p.total,
    }),
  )
  autoUpdater.on('update-downloaded', (info) =>
    emit({ state: 'downloaded', version: info.version }),
  )
  autoUpdater.on('error', (err) =>
    emit({ state: 'error', message: err instanceof Error ? err.message : String(err) }),
  )
}

export const registerUpdaterIpc = (): void => {
  if (!app.isPackaged) {
    ipcMain.handle(IPC.UPDATE_CHECK, () => {})
    ipcMain.handle(IPC.UPDATE_DOWNLOAD, () => {})
    ipcMain.handle(IPC.UPDATE_INSTALL, () => {})
    return
  }

  const autoUpdater = loadAutoUpdater()
  if (!autoUpdater) {
    ipcMain.handle(IPC.UPDATE_CHECK, () =>
      emit({ state: 'error', message: 'Модуль обновлений не установлен' }),
    )
    ipcMain.handle(IPC.UPDATE_DOWNLOAD, () => {})
    ipcMain.handle(IPC.UPDATE_INSTALL, () => {})
    return
  }

  wireEvents(autoUpdater)

  const applyUpdaterSettings = (): void => {
    const s = getCachedSettings()
    autoUpdater.autoDownload = s?.autoUpdate ?? true
    autoUpdater.allowPrerelease = s?.betaUpdates ?? false
  }
  applyUpdaterSettings()
  onSettingsChange(() => applyUpdaterSettings())

  ipcMain.handle(IPC.UPDATE_CHECK, async () => {
    try {
      await autoUpdater.checkForUpdates()
    } catch (err) {
      log.error('[updater] check failed', err)
    }
  })

  ipcMain.handle(IPC.UPDATE_DOWNLOAD, async () => {
    try {
      await autoUpdater.downloadUpdate()
    } catch (err) {
      log.error('[updater] download failed', err)
      emit({ state: 'error', message: err instanceof Error ? err.message : String(err) })
    }
  })

  ipcMain.handle(IPC.UPDATE_INSTALL, () => {
    autoUpdater.quitAndInstall()
  })

  setTimeout(() => {
    void autoUpdater
      .checkForUpdates()
      .catch((err) => log.error('[updater] initial check failed', err))
  }, 3000)
}
