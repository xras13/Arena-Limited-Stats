import { contextBridge, ipcRenderer } from 'electron'
import type { Settings, ViewModel } from '../shared/types'

export interface CompanionApi {
  onViewModel: (cb: (vm: ViewModel) => void) => () => void
  getSettings: () => Promise<Settings>
  setSettings: (patch: Partial<Settings>) => Promise<Settings>
  refresh: () => Promise<void>
  seventeenStatus: () => Promise<boolean>
  seventeenConnect: () => Promise<boolean>
}

const api: CompanionApi = {
  onViewModel(cb) {
    const listener = (_e: unknown, vm: ViewModel): void => cb(vm)
    ipcRenderer.on('view-model', listener)
    return () => ipcRenderer.removeListener('view-model', listener)
  },
  getSettings: () => ipcRenderer.invoke('get-settings'),
  setSettings: (patch) => ipcRenderer.invoke('set-settings', patch),
  refresh: () => ipcRenderer.invoke('refresh'),
  seventeenStatus: () => ipcRenderer.invoke('seventeen-status'),
  seventeenConnect: () => ipcRenderer.invoke('seventeen-connect')
}

contextBridge.exposeInMainWorld('companion', api)
