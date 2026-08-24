import { app, BrowserWindow, ipcMain } from 'electron'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { DraftStore } from './log/draft-store'
import { LogParser } from './log/parser'
import { defaultLogPath, LogTailer } from './log/tailer'
import { buildViewModel } from './view-model'
import { createOverlayWindow } from './overlay-window'
import { getSettings, updateSettings } from './settings'
import type { StoredSettings } from './settings'
import * as seventeen from './data/personal'
import type { PersonalStatsLookup } from './data/join'

let overlay: BrowserWindow | null = null
const store = new DraftStore()

let personalSet: string | null = null
let personalStats: seventeen.PersonalStatsMap | null = null
let personalLoading = false

async function ensurePersonalStats(): Promise<PersonalStatsLookup | undefined> {
  const set = store.getState().set
  if (!set) return undefined
  if (personalSet === set && personalStats) {
    const stats = personalStats
    return (name) => stats.get(seventeen.normalizeName(name))
  }
  if (!personalLoading && personalSet !== set) {
    personalLoading = true
    void (async () => {
      try {
        if (await seventeen.isConnected()) {
          personalStats = await seventeen.getPersonalStats(set)
          personalSet = set
          void pushViewModel()
        }
      } catch (err) {
        console.warn('[17lands personal]', err)
      } finally {
        personalLoading = false
      }
    })()
  }
  return undefined
}

let building = false
let dirty = false

async function pushViewModel(): Promise<void> {
  if (building) {
    dirty = true
    return
  }
  building = true
  try {
    do {
      dirty = false
      const personal = await ensurePersonalStats()
      const vm = await buildViewModel(store.getState(), personal, getSettings().formatOverride)
      overlay?.webContents.send('view-model', vm)
    } while (dirty)
  } catch (err) {
    console.error('[view-model]', err)
  } finally {
    building = false
  }
}

function startTailing(logPath: string): LogTailer {
  const parser = new LogParser()
  const tailer = new LogTailer(logPath)
  tailer.on('line', (line: string) => {
    for (const event of parser.feedLine(line)) store.apply(event)
  })
  tailer.on('reset', () => store.apply({ type: 'LogReset' }))
  tailer.on('error', (err: Error) => console.error('[tailer]', err))
  store.onChange(() => void pushViewModel())
  tailer.start(true)
  return tailer
}

function startSimulation(fixturePath: string): void {
  const simPath = path.join(os.tmpdir(), `arena-limited-stats-sim-${Date.now()}.log`)
  fs.writeFileSync(simPath, '')
  startTailing(simPath)

  const lines = fs.readFileSync(fixturePath, 'utf8').split(/\r?\n/)
  let cursor = 0
  const timer = setInterval(() => {
    if (cursor >= lines.length) {
      clearInterval(timer)
      console.log('[simulate] fixture fully replayed')
      return
    }
    const batch = lines.slice(cursor, cursor + 1000)
    cursor += 1000
    fs.appendFileSync(simPath, batch.join('\n') + '\n')
  }, 400)
}

app.whenReady().then(() => {
  app.dock?.hide()

  ipcMain.handle('get-settings', () => getSettings())
  ipcMain.handle('set-settings', (_e, patch: Partial<StoredSettings>) => {
    const next = updateSettings(patch)
    if (typeof patch.opacity === 'number') overlay?.setOpacity(next.opacity)
    if (patch.formatOverride !== undefined) void pushViewModel()
    return next
  })
  ipcMain.handle('refresh', () => pushViewModel())
  ipcMain.handle('seventeen-status', () => seventeen.isConnected())
  ipcMain.handle('seventeen-connect', async () => {
    const ok = await seventeen.connect()
    if (ok) {
      personalSet = null
      personalStats = null
      void pushViewModel()
    }
    return ok
  })

  overlay = createOverlayWindow()
  overlay.webContents.on('did-finish-load', () => void pushViewModel())

  const simulateIndex = process.argv.indexOf('--simulate')
  if (simulateIndex !== -1 && process.argv[simulateIndex + 1]) {
    startSimulation(path.resolve(process.argv[simulateIndex + 1]))
  } else {
    startTailing(getSettings().logPath ?? defaultLogPath())
  }
})

app.on('window-all-closed', () => {
  app.quit()
})
