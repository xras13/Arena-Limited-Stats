import { describe, expect, it } from 'vitest'
import {
  appCacheDir,
  appDataDir,
  arenaRawDirs,
  defaultLogPath,
  type HostInfo
} from '../src/main/platform'

const windows: HostInfo = {
  platform: 'win32',
  env: {
    APPDATA: 'C:\\Users\\Tester\\AppData\\Roaming',
    USERPROFILE: 'C:\\Users\\Tester',
    ProgramFiles: 'C:\\Program Files',
    'ProgramFiles(x86)': 'C:\\Program Files (x86)'
  },
  home: 'C:\\Users\\Tester'
}

const mac: HostInfo = { platform: 'darwin', env: {}, home: '/Users/tester' }

describe('platform paths — Windows', () => {
  it('puts app data under %APPDATA%', () => {
    expect(appDataDir(windows)).toBe('C:\\Users\\Tester\\AppData\\Roaming\\mtga-companion')
    expect(appCacheDir(windows)).toBe('C:\\Users\\Tester\\AppData\\Roaming\\mtga-companion\\cache')
  })

  it('derives AppData\\Roaming from the profile when APPDATA is unset', () => {
    const noAppData: HostInfo = { ...windows, env: { USERPROFILE: 'C:\\Users\\Tester' } }
    expect(appDataDir(noAppData)).toBe('C:\\Users\\Tester\\AppData\\Roaming\\mtga-companion')
  })

  it('finds Arena\'s log in LocalLow, where Unity writes it', () => {
    expect(defaultLogPath(windows)).toBe(
      'C:\\Users\\Tester\\AppData\\LocalLow\\Wizards Of The Coast\\MTGA\\Player.log'
    )
  })

  it('covers standalone, Steam and Epic install locations', () => {
    const dirs = arenaRawDirs(windows)
    expect(dirs[0]).toBe(
      'C:\\Program Files\\Wizards of the Coast\\MTGA\\MTGA_Data\\Downloads\\Raw'
    )
    expect(dirs).toContain(
      'C:\\Program Files (x86)\\Steam\\steamapps\\common\\MTGA\\MTGA_Data\\Downloads\\Raw'
    )
    expect(dirs).toContain(
      'C:\\Program Files\\Epic Games\\MagicTheGathering\\MTGA_Data\\Downloads\\Raw'
    )
    expect(dirs.every((d) => d.includes('\\') && !d.includes('/'))).toBe(true)
  })

  it('honours relocated Program Files', () => {
    const dDrive: HostInfo = { ...windows, env: { ...windows.env, ProgramFiles: 'D:\\Games' } }
    expect(arenaRawDirs(dDrive)[0]).toBe(
      'D:\\Games\\Wizards of the Coast\\MTGA\\MTGA_Data\\Downloads\\Raw'
    )
  })
})

describe('platform paths — macOS (unchanged from before the Windows port)', () => {
  it('keeps the original cache location so existing caches still load', () => {
    expect(appCacheDir(mac)).toBe(
      '/Users/tester/Library/Application Support/mtga-companion/cache'
    )
  })

  it('keeps the original log and Arena install paths', () => {
    expect(defaultLogPath(mac)).toBe(
      '/Users/tester/Library/Logs/Wizards Of The Coast/MTGA/Player.log'
    )
    expect(arenaRawDirs(mac)).toEqual([
      '/Users/tester/Library/Application Support/Steam/steamapps/common/MTGA/MTGA_Data/Downloads/Raw',
      '/Applications/MTGA.app/Contents/Resources/Data/Downloads/Raw'
    ])
  })
})

describe('platform paths — other', () => {
  it('does not throw on Linux and reports no Arena install', () => {
    const linux: HostInfo = { platform: 'linux', env: {}, home: '/home/tester' }
    expect(appCacheDir(linux)).toBe('/home/tester/.config/mtga-companion/cache')
    expect(arenaRawDirs(linux)).toEqual([])
  })
})
