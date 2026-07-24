import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { LogTailer } from '../src/main/log/tailer'

function waitFor(cond: () => boolean, timeoutMs = 3000): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = Date.now()
    const timer = setInterval(() => {
      if (cond()) {
        clearInterval(timer)
        resolve()
      } else if (Date.now() - started > timeoutMs) {
        clearInterval(timer)
        reject(new Error('condition not met in time'))
      }
    }, 10)
  })
}

describe('LogTailer', () => {
  let dir: string
  let tailer: LogTailer | null = null

  afterEach(() => {
    tailer?.stop()
    tailer = null
    fs.rmSync(dir, { recursive: true, force: true })
  })

  function setup(initial: string): string {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tailer-test-'))
    const file = path.join(dir, 'Player.log')
    fs.writeFileSync(file, initial)
    return file
  }

  it('sees appends even when fs.watch reports nothing (poll fallback)', async () => {
    const file = setup('old line\n')
    const lines: string[] = []
    tailer = new LogTailer(file, 25)
    tailer.on('line', (l: string) => lines.push(l))
    tailer.start(false) // skip catch-up; only new writes count

    // Append via a kept-open fd the way Arena does — no directory entry change
    const fd = fs.openSync(file, 'a')
    fs.writeSync(fd, 'first\nsecond\n')
    fs.closeSync(fd)

    await waitFor(() => lines.length >= 2)
    expect(lines).toEqual(['first', 'second'])
  })

  it('replays existing content when catch-up is on', async () => {
    const file = setup('a\nb\n')
    const lines: string[] = []
    tailer = new LogTailer(file, 25)
    tailer.on('line', (l: string) => lines.push(l))
    tailer.start(true)
    await waitFor(() => lines.length >= 2)
    expect(lines).toEqual(['a', 'b'])
  })

  it('emits reset and re-reads from the start on truncation', async () => {
    const file = setup('first session line\nanother line\n')
    const lines: string[] = []
    let resets = 0
    tailer = new LogTailer(file, 25)
    tailer.on('line', (l: string) => lines.push(l))
    tailer.on('reset', () => resets++)
    tailer.start(true)
    await waitFor(() => lines.length >= 2)

    fs.writeFileSync(file, 'fresh\n') // rotation: replaced with a smaller file
    await waitFor(() => resets >= 1 && lines.includes('fresh'))
    expect(lines).toEqual(['first session line', 'another line', 'fresh'])
  })
})
