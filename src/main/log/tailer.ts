import { EventEmitter } from 'node:events'
import fs from 'node:fs'
import path from 'node:path'

export interface LogTailerEvents {
  line: (line: string) => void
  reset: () => void
  error: (err: Error) => void
}

export class LogTailer extends EventEmitter {
  private offset = 0
  private watcher: fs.FSWatcher | null = null
  private pollTimer: NodeJS.Timeout | null = null
  private pending = ''
  private reading = false
  private readQueued = false
  private debounceTimer: NodeJS.Timeout | null = null

  constructor(
    private readonly filePath: string,
    private readonly pollIntervalMs = 1000
  ) {
    super()
  }

  start(catchUp = true): void {
    if (!catchUp) {
      try {
        this.offset = fs.statSync(this.filePath).size
      } catch {
        this.offset = 0
      }
    }
    const dir = path.dirname(this.filePath)
    const base = path.basename(this.filePath)
    this.watcher = fs.watch(dir, (_eventType, filename) => {
      if (filename && filename !== base) return
      this.scheduleRead()
    })
    this.pollTimer = setInterval(() => void this.readNew(), this.pollIntervalMs)
    this.scheduleRead()
  }

  stop(): void {
    this.watcher?.close()
    this.watcher = null
    if (this.pollTimer) clearInterval(this.pollTimer)
    if (this.debounceTimer) clearTimeout(this.debounceTimer)
  }

  private scheduleRead(): void {
    if (this.debounceTimer) return
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null
      void this.readNew()
    }, 250)
  }

  private async readNew(): Promise<void> {
    if (this.reading) {
      this.readQueued = true
      return
    }
    this.reading = true
    try {
      let stat: fs.Stats
      try {
        stat = await fs.promises.stat(this.filePath)
      } catch {
        return
      }

      if (stat.size < this.offset) {
        this.offset = 0
        this.pending = ''
        this.emit('reset')
      }
      if (stat.size === this.offset) return

      const stream = fs.createReadStream(this.filePath, {
        start: this.offset,
        end: stat.size - 1,
        encoding: 'utf8'
      })
      for await (const chunk of stream) {
        this.pending += chunk
        let newlineIndex: number
        while ((newlineIndex = this.pending.indexOf('\n')) !== -1) {
          const line = this.pending.slice(0, newlineIndex)
          this.pending = this.pending.slice(newlineIndex + 1)
          this.emit('line', line)
        }
      }
      this.offset = stat.size
    } catch (err) {
      this.emit('error', err instanceof Error ? err : new Error(String(err)))
    } finally {
      this.reading = false
      if (this.readQueued) {
        this.readQueued = false
        void this.readNew()
      }
    }
  }
}

export { defaultLogPath } from '../platform'
