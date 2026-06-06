import { useStore } from '../store'
import { useTooltip } from '../hooks/useTooltip'
import ViewportTooltip from './ViewportTooltip'
import { SettingsIcon } from './icons'

interface Props {
  className?: string
}

export default function PlaygroundToolbarControls({ className = '' }: Props) {
  const appMode = useStore((s) => s.appMode)
  const setAppMode = useStore((s) => s.setAppMode)
  const setShowSettings = useStore((s) => s.setShowSettings)
  const settingsTooltip = useTooltip()

  return (
    <>
      <div className={`hcai-playground-toolbar-controls flex shrink-0 items-center gap-2 ${className}`}>
        <div className="hcai-playground-mode-switch hidden items-center rounded-xl border border-gray-200 bg-gray-100/70 p-1 dark:border-white/[0.08] dark:bg-white/[0.04] sm:flex">
          <button
            type="button"
            onClick={() => setAppMode('gallery')}
            className={`px-4 py-1.5 rounded-lg text-sm transition-colors ${appMode === 'gallery' ? 'is-active bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm font-medium' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'}`}
          >
            画廊
          </button>
          <button
            type="button"
            onClick={() => setAppMode('agent')}
            className={`px-4 py-1.5 rounded-lg text-sm transition-colors ${appMode === 'agent' ? 'is-active bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm font-medium' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'}`}
          >
            Agent
          </button>
        </div>
        <div className="relative" {...settingsTooltip.handlers}>
          <button
            onClick={() => setShowSettings(true)}
            className="hcai-playground-icon-button p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
            aria-label="设置"
          >
            <SettingsIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <ViewportTooltip visible={settingsTooltip.visible} className="whitespace-nowrap">
            设置
          </ViewportTooltip>
        </div>
      </div>
    </>
  )
}
