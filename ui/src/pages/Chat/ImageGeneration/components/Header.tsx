import { useEffect, useState } from 'react';
import { hasAnyImageAgentThinkingModel, useStore } from '../store';
import { useVersionCheck } from '../hooks/useVersionCheck';
import { useFavoriteCollectionTitle } from './FavoriteCollections';
import PlaygroundToolbarControls from './PlaygroundToolbarControls';

export default function Header() {
  const appMode = useStore((s) => s.appMode);
  const setAppMode = useStore((s) => s.setAppMode);
  const systemImageModels = useStore((s) => s.systemImageModels);
  const systemImageModelsLoading = useStore((s) => s.systemImageModelsLoading);
  const systemImageModelsError = useStore((s) => s.systemImageModelsError);
  const filterFavorite = useStore((s) => s.filterFavorite);
  const activeFavoriteCollectionId = useStore(
    (s) => s.activeFavoriteCollectionId,
  );
  const favoriteCollectionTitle = useFavoriteCollectionTitle();
  const showFavoriteCollectionTitle =
    appMode === 'gallery' && Boolean(activeFavoriteCollectionId);
  const hasAgentThinkingModel =
    hasAnyImageAgentThinkingModel(systemImageModels);
  const agentDisabled = systemImageModelsLoading || !hasAgentThinkingModel;
  const agentTitle = systemImageModelsLoading
    ? '图片模型正在加载'
    : systemImageModelsError || '暂无可用 Agent 思考模型，请联系管理员配置';
  const { hasUpdate, latestRelease, dismiss } = useVersionCheck();
  const [scrollDirection, setScrollDirection] = useState<'up' | 'down'>('up');

  useEffect(() => {
    if (appMode === 'agent') {
      setScrollDirection('up');
      return;
    }

    let lastScrollY = window.scrollY;
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          if (currentScrollY < 20) {
            setScrollDirection('up');
          } else if (currentScrollY > lastScrollY + 10) {
            setScrollDirection('down');
          } else if (currentScrollY < lastScrollY - 10) {
            setScrollDirection('up');
          }
          lastScrollY = currentScrollY;
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [appMode]);

  return (
    <>
      <header
        data-no-drag-select
        className="safe-area-top fixed top-0 left-0 right-0 z-40 translate-y-0 bg-white/80 dark:bg-gray-950/80 backdrop-blur border-b border-gray-200 dark:border-white/[0.08] transition-transform duration-300 ease-in-out">
        <div className="safe-area-x safe-header-inner max-w-7xl mx-auto flex items-center justify-between relative">
          <div className="flex-1 min-w-0 pr-2 flex items-center gap-2">
            <h1 className="inline-flex min-w-0 items-start relative mr-2">
              {showFavoriteCollectionTitle ? (
                <>
                  <span
                    className="min-w-0 truncate text-[17px] font-bold tracking-tight text-gray-800 dark:text-gray-100 sm:hidden"
                    title={favoriteCollectionTitle}>
                    {favoriteCollectionTitle}
                  </span>
                  <span className="hcai-playground-title hidden text-lg font-bold tracking-tight text-gray-800 transition-colors dark:text-gray-100 sm:inline">
                    图片生成
                  </span>
                </>
              ) : (
                <span className="hcai-playground-title text-[17px] sm:text-lg font-bold tracking-tight text-gray-800 transition-colors dark:text-gray-100">
                  图片生成
                </span>
              )}
              {hasUpdate && latestRelease && (
                <a
                  href={latestRelease.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={dismiss}
                  className="absolute -right-1 -top-1 translate-x-full -translate-y-1/4 px-1 py-0.5 rounded-[4px] border border-red-500/30 text-[9px] font-black bg-red-500 text-white hover:bg-red-600 transition-all animate-fade-in leading-none shadow-sm"
                  title={`新版本 ${latestRelease.tag}`}>
                  NEW
                </a>
              )}
            </h1>
          </div>
          {showFavoriteCollectionTitle && (
            <div className="absolute left-1/2 top-1/2 hidden max-w-[30%] -translate-x-1/2 -translate-y-1/2 sm:flex">
              <div
                className="truncate rounded px-2 py-1 text-sm font-semibold text-gray-700 dark:text-gray-300"
                title={favoriteCollectionTitle}>
                {favoriteCollectionTitle}
              </div>
            </div>
          )}
          <PlaygroundToolbarControls />
        </div>
        <div
          className={`safe-area-x sm:hidden overflow-hidden transition-all duration-300 ease-in-out ${appMode === 'gallery' && scrollDirection === 'down' ? 'max-h-0 opacity-0 pb-0' : 'max-h-20 opacity-100 pb-2'}`}>
          <div className="grid grid-cols-2 gap-1 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-100/70 dark:bg-white/[0.04] p-1 mx-2">
            <button
              type="button"
              onClick={() => setAppMode('gallery')}
              className={`px-4 py-1.5 rounded-lg text-sm transition-colors ${appMode === 'gallery' ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm font-medium' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'}`}>
              画廊
            </button>
            <button
              type="button"
              disabled={agentDisabled}
              title={agentDisabled ? agentTitle : 'Agent'}
              aria-disabled={agentDisabled}
              onClick={() => setAppMode('agent')}
              className={`px-4 py-1.5 rounded-lg text-sm transition-colors ${agentDisabled ? 'cursor-not-allowed opacity-45 text-gray-400 dark:text-gray-600' : appMode === 'agent' ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm font-medium' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'}`}>
              Agent
            </button>
          </div>
        </div>
      </header>

      <div
        className="safe-area-top invisible pointer-events-none max-h-[500px] opacity-100 transition-all duration-300 ease-in-out"
        aria-hidden="true">
        <div className="safe-header-inner" />
        <div
          className={`safe-area-x sm:hidden overflow-hidden transition-all duration-300 ease-in-out ${appMode === 'gallery' && scrollDirection === 'down' ? 'max-h-0 pb-0' : 'max-h-20 pb-2'}`}>
          <div className="p-1">
            <div className="py-1.5 text-sm">占位</div>
          </div>
        </div>
      </div>
    </>
  );
}
