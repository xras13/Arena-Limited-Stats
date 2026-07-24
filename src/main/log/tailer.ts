import { EventEmitter } from 'node:events'
import fs from 'node:fs'
import path from 'node:path'

export interface LogTailerEvents {
  line: (line: string) => void
  reset: () => void
  error: (err: Error) => void
}

/**
 * Tails Arena's Player.log with byte-offset incremental reads.
 *
 * Watches the parent directory rather than the file: Arena truncates/replaces
 * the file on launch, and a directory watch survives the inode swap.
 * A shrink (size < offset) means rotation/truncation -> emit 'reset' and
 * re-read from the start so a draft in progress is recovered.
 */
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

  /** @param catchUp when true (default), reads the existing file content first. */
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
    // macOS FSEvents does not report in-place appends (Arena keeps the file
    // open and writes without touching directory entries), so the watcher
    // above only catches rotation. A stat poll is the dependable signal;
    // readNew() returns immediately when the size is unchanged.
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
        return // file missing (Arena not installed / mid-rotation); keep watching
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

export function defaultLogPath(): string {
  return path.join(
    process.env.HOME ?? '',
    'Library/Logs/Wizards Of The Coast/MTGA/Player.log'
  )
}
