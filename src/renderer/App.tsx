import { useEffect, useState } from 'react'
import type { ViewModel } from '../shared/types'
import { PackView } from './components/PackView'
import { SealedPoolView } from './components/SealedPoolView'
import { SettingsPane } from './components/SettingsPane'

export function App(): React.JSX.Element {
  const [vm, setVm] = useState<ViewModel>({ kind: 'idle', message: 'Connecting…' })
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    const unsubscribe = window.companion.onViewModel(setVm)
    void window.companion.refresh()
    return unsubscribe
  }, [])

  const context =
    vm.kind === 'idle'
      ? 'Arena Limited Stats'
      : `${vm.set} · ${vm.format}${vm.kind === 'pack' ? ` · P${vm.pack}P${vm.pick}` : ''}`
  const source = vm.kind !== 'idle' && vm.ratingsSource !== vm.format ? `data: ${vm.ratingsSource}` : ''

  return (
    <div className="app">
      <div className="titlebar">
        <span className="context">{context}</span>
        <span className="source">{source}</span>
        <span className="spacer" />
        <button
          className={showSettings ? 'active' : ''}
          title="Settings"
          onClick={() => setShowSettings((v) => !v)}
        >
          ⚙
        </button>
        <button title="Quit Arena Limited Stats" onClick={() => window.close()}>
          ✕
        </button>
      </div>
      <div className="content">
        {showSettings ? (
          <SettingsPane />
        ) : vm.kind === 'idle' ? (
          <div className="idle">{vm.message}</div>
        ) : vm.kind === 'pack' ? (
          <PackView vm={vm} />
        ) : (
          <SealedPoolView vm={vm} />
        )}
      </div>
    </div>
  )
}
