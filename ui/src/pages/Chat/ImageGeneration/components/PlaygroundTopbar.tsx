import { useStore } from '../store'
import Select from './Select'
import ViewportTooltip from './ViewportTooltip'
import { useTooltip } from '../hooks/useTooltip'
import { ChevronLeftIcon, CollectionManageIcon, EditIcon, FavoriteIcon } from './icons'
import PlaygroundToolbarControls from './PlaygroundToolbarControls'

type PlaygroundTopbarMode = 'gallery' | 'agent'

interface Props {
  mode: PlaygroundTopbarMode
}

export default function PlaygroundTopbar({ mode }: Props) {
  const searchQuery = useStore((s) => s.searchQuery)
  const setSearchQuery = useStore((s) => s.setSearchQuery)
  const filterStatus = useStore((s) => s.filterStatus)
  const setFilterStatus = useStore((s) => s.setFilterStatus)
  const filterFavorite = useStore((s) => s.filterFavorite)
  const setFilterFavorite = useStore((s) => s.setFilterFavorite)
  const activeFavoriteCollectionId = useStore((s) => s.activeFavoriteCollectionId)
  const setActiveFavoriteCollectionId = useStore((s) => s.setActiveFavoriteCollectionId)
  const openManageCollectionsModal = useStore((s) => s.openManageCollectionsModal)
  const createConversation = useStore((s) => s.createAgentConversation)
  const newConversationTooltip = useTooltip()
  const inCollectionOverview = filterFavorite && !activeFavoriteCollectionId
  const isGallery = mode === 'gallery'

  const handleFavoriteClick = () => {
    if (activeFavoriteCollectionId) {
      setActiveFavoriteCollectionId(null)
      return
    }
    setFilterFavorite(!filterFavorite)
  }

  return (
    <div
      data-no-drag-select
      className={`hcai-playground-topbar hcai-playground-topbar-${mode}`}
    >
      <div className="hcai-playground-topbar-leading">
        {isGallery ? (
          <>
            <button
              onClick={handleFavoriteClick}
              className={`hcai-playground-toolbar-button p-2.5 rounded-xl border transition-all ${
                filterFavorite
                  ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-500/10 text-yellow-500'
                  : 'border-gray-200 dark:border-white/[0.08] bg-white dark:bg-gray-900 text-gray-400 hover:bg-gray-50 dark:hover:bg-white/[0.06]'
              }`}
              title={activeFavoriteCollectionId ? '返回收藏夹' : filterFavorite ? '退出收藏夹视图' : '收藏夹'}
            >
              {activeFavoriteCollectionId ? <ChevronLeftIcon className="w-5 h-5" /> : <FavoriteIcon filled={filterFavorite} className="w-5 h-5" />}
            </button>
            {inCollectionOverview && (
              <button
                onClick={openManageCollectionsModal}
                className="hcai-playground-toolbar-button p-2.5 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-gray-900 text-gray-400 hover:bg-gray-50 dark:hover:bg-white/[0.06] transition-all"
                title="管理收藏夹"
              >
                <CollectionManageIcon className="w-5 h-5" />
              </button>
            )}
            {!inCollectionOverview && (
              <div className="hcai-playground-status-wrap relative">
                <Select
                  value={filterStatus}
                  onChange={(val) => setFilterStatus(val as any)}
                  options={[
                    { label: '全部状态', value: 'all' },
                    { label: '已完成', value: 'done' },
                    { label: '生成中', value: 'running' },
                    { label: '失败', value: 'error' },
                  ]}
                  className="hcai-playground-status-select px-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-white/[0.06] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition"
                />
              </div>
            )}
          </>
        ) : (
          <div className="relative" {...newConversationTooltip.handlers}>
            <button
              type="button"
              className="hcai-playground-icon-button p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
              aria-label="新对话"
              onClick={createConversation}
            >
              <EditIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <ViewportTooltip visible={newConversationTooltip.visible} className="whitespace-nowrap">
              新对话
            </ViewportTooltip>
          </div>
        )}
      </div>

      <div className="hcai-playground-topbar-search relative">
        {isGallery && (
          <>
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              type="text"
              placeholder={inCollectionOverview ? '搜索收藏夹名称...' : '搜索提示词、参数...'}
              className="hcai-playground-search-input w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition"
            />
          </>
        )}
      </div>

      <PlaygroundToolbarControls />
    </div>
  )
}
