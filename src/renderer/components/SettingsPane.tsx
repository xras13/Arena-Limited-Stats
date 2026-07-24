import { useEffect, useState } from 'react'
import type { Settings } from '../../shared/types'

const FORMATS = ['', 'PremierDraft', 'TradDraft', 'QuickDraft', 'PickTwoDraft', 'Sealed', 'TradSealed']

export function SettingsPane(): React.JSX.Element {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [connected, setConnected] = useState<boolean | null>(null)
  const [connecting, setConnecting] = useState(false)

  useEffect(() => {
    void window.companion.getSettings().then(setSettings)
    void window.companion.seventeenStatus().then(setConnected)
  }, [])

  const connect = async (): Promise<void> => {
    setConnecting(true)
    try {
      setConnected(await window.companion.seventeenConnect())
    } finally {
      setConnecting(false)
    }
  }

  if (!settings) return <div className="settings" />

  const patch = (p: Partial<Settings>): void => {
    setSettings({ ...settings, ...p })
    void window.companion.setSettings(p)
  }

  return (
    <div className="settings">
      <label>
        Overlay opacity — {Math.round(settings.opacity * 100)}%
        <input
          type="range"
          min={0.4}
          max={1}
          step={0.02}
          value={settings.opacity}
          onChange={(e) => patch({ opacity: Number(e.target.value) })}
        />
      </label>

      <label>
        17lands ratings format
        <select
          value={settings.formatOverride ?? ''}
          onChange={(e) => patch({ formatOverride: e.target.value || undefined })}
        >
          {FORMATS.map((f) => (
            <option key={f} value={f}>
              {f === '' ? 'Auto (match event)' : f}
            </option>
          ))}
        </select>
      </label>

      <label>
        17lands account
        <button
          onClick={() => void connect()}
          disabled={connecting || connected === true}
          style={{
            padding: '6px 10px',
            borderRadius: 5,
            border: '1px solid var(--border)',
            background: 'var(--bg-raised)',
            color: connected ? '#8fca8f' : 'var(--text)',
            cursor: connected ? 'default' : 'pointer'
          }}
        >
          {connected === null
            ? 'Checking…'
            : connected
              ? '✓ Connected — showing your win% / play%'
              : connecting
                ? 'Waiting for login…'
                : 'Connect 17lands account'}
        </button>
      </label>

      <div className="hint">
        Ratings and card data are fetched from 17lands.com and cached for 24 hours. Auto mode
        matches the event's format and falls back to Premier Draft when the sample is too small.
        <br />
        <br />
        Personal stats use unofficial endpoints from your logged-in 17lands session and may stop
        working if 17lands changes their site; the rest of the app is unaffected.
      </div>
    </div>
  )
}
