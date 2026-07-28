import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export const killProcesses = async (imageNames: readonly string[]): Promise<void> => {
  if (process.platform !== 'win32') return
  for (const name of imageNames) {
    try {
      await execFileAsync('taskkill', ['/F', '/IM', name], { windowsHide: true })
    } catch {
    }
  }
}

export const waitForExit = async (imageName: string, timeoutMs = 5000): Promise<void> => {
  if (process.platform !== 'win32') return
  const needle = imageName.toLowerCase()
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const { stdout } = await execFileAsync(
        'tasklist',
        ['/FI', `IMAGENAME eq ${imageName}`, '/NH'],
        { windowsHide: true },
      )
      if (!stdout.toLowerCase().includes(needle)) return
    } catch {
      return
    }
    await new Promise((r) => setTimeout(r, 250))
  }
}
