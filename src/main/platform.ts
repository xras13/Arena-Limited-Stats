import os from 'node:os'
import path from 'node:path'

export interface HostInfo {
  platform: NodeJS.Platform
  env: Record<string, string | undefined>
  home: string
}

export function currentHost(): HostInfo {
  return { platform: process.platform, env: process.env, home: os.homedir() }
}

export function appDataDir(host: HostInfo = currentHost()): string {
  if (host.platform === 'win32') {
    const roaming =
      host.env.APPDATA ?? path.win32.join(host.env.USERPROFILE ?? host.home, 'AppData', 'Roaming')
    return path.win32.join(roaming, 'mtga-companion')
  }
  if (host.platform === 'darwin') {
    return path.posix.join(host.home, 'Library/Application Support/mtga-companion')
  }
  const xdg = host.env.XDG_CONFIG_HOME
  return path.posix.join(xdg && xdg.length > 0 ? xdg : path.posix.join(host.home, '.config'), 'mtga-companion')
}

export function appCacheDir(host: HostInfo = currentHost()): string {
  const base = appDataDir(host)
  return host.platform === 'win32' ? path.win32.join(base, 'cache') : path.posix.join(base, 'cache')
}

export function defaultLogPath(host: HostInfo = currentHost()): string {
  if (host.platform === 'win32') {
    const profile = host.env.USERPROFILE ?? host.home
    return path.win32.join(
      profile,
      'AppData',
      'LocalLow',
      'Wizards Of The Coast',
      'MTGA',
      'Player.log'
    )
  }
  return path.posix.join(host.home, 'Library/Logs/Wizards Of The Coast/MTGA/Player.log')
}

export function arenaRawDirs(host: HostInfo = currentHost()): string[] {
  if (host.platform === 'win32') {
    const programFiles = host.env.ProgramFiles ?? 'C:\\Program Files'
    const programFilesX86 = host.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)'
    const tail = ['MTGA_Data', 'Downloads', 'Raw']
    return [
      path.win32.join(programFiles, 'Wizards of the Coast', 'MTGA', ...tail),
      path.win32.join(programFilesX86, 'Wizards of the Coast', 'MTGA', ...tail),
      path.win32.join(programFilesX86, 'Steam', 'steamapps', 'common', 'MTGA', ...tail),
      path.win32.join(programFiles, 'Steam', 'steamapps', 'common', 'MTGA', ...tail),
      path.win32.join(programFiles, 'Epic Games', 'MagicTheGathering', ...tail)
    ]
  }
  if (host.platform === 'darwin') {
    return [
      path.posix.join(
        host.home,
        'Library/Application Support/Steam/steamapps/common/MTGA/MTGA_Data/Downloads/Raw'
      ),
      '/Applications/MTGA.app/Contents/Resources/Data/Downloads/Raw'
    ]
  }
  return []
}
