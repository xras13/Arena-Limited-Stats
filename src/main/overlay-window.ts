import { BrowserWindow, shell } from 'electron'
import path from 'node:path'
import { getSettings, updateSettings } from './settings'

export function createOverlayWindow(): BrowserWindow {
  const settings = getSettings()
  const bounds = settings.bounds

  const win = new BrowserWindow({
    width: bounds?.width ?? 390,
    height: bounds?.height ?? 640,
    x: bounds?.x,
    y: bounds?.y,
    minWidth: 320,
    minHeight: 380,
    frame: false,
    resizable: true,
    fullscreenable: false,
    show: false,
    backgroundColor: '#16181d',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: false
    }
  })

  // Float above the Arena window, including macOS fullscreen spaces
  win.setAlwaysOnTop(true, 'screen-saver')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  win.setOpacity(settings.opacity)

  win.once('ready-to-show', () => {
    console.log('[overlay] ready-to-show, showing window')
    win.show()
  })
  win.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error(`[overlay] did-fail-load ${code} ${desc} ${url}`)
  })
  win.webContents.on('render-process-gone', (_e, details) => {
    console.error('[overlay] renderer gone:', details.reason)
  })

  const saveBounds = (): void => {
    updateSettings({ bounds: win.getBounds() })
  }
  win.on('moved', saveBounds)
  win.on('resized', saveBounds)

  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  return win
}
