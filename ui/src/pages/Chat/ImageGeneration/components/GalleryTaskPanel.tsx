import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ALL_FAVORITES_COLLECTION_ID,
  getTaskFavoriteCollectionIds,
  useStore,
} from '../store';
import type { TaskRecord, TaskStatus } from '../types';

const taskDotClass: Record<TaskStatus, string> = {
  running: 'generating',
  done: 'completed',
  error: 'failed',
};

function getTaskMeta(task: TaskRecord) {
  if (task.status === 'error' && task.error) return task.error;
  const model =
    task.apiModel ||
    task.apiProfileName ||
    task.params.output_format.toUpperCase();
  return `${model} · ${task.params.size} · ${task.params.n} 张`;
}

export default function GalleryTaskPanel() {
  const appMode = useStore((s) => s.appMode);
  const tasks = useStore((s) => s.tasks);
  const filterStatus = useStore((s) => s.filterStatus);
  const filterFavorite = useStore((s) => s.filterFavorite);
  const activeFavoriteCollectionId = useStore(
    (s) => s.activeFavoriteCollectionId,
  );
  const detailTaskId = useStore((s) => s.detailTaskId);
  const setDetailTaskId = useStore((s) => s.setDetailTaskId);
  const [query, setQuery] = useState('');
  const [sidebarHost, setSidebarHost] = useState<Element | null>(null);
  const [mobileSideNavHost, setMobileSideNavHost] = useState<Element | null>(
    null,
  );

  const filteredTasks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...tasks]
      .sort((a, b) => b.createdAt - a.createdAt)
      .filter((task) => {
        if (filterFavorite) {
          if (!task.isFavorite) return false;
          if (
            activeFavoriteCollectionId &&
            activeFavoriteCollectionId !== ALL_FAVORITES_COLLECTION_ID &&
            !getTaskFavoriteCollectionIds(task).includes(
              activeFavoriteCollectionId,
            )
          ) {
            return false;
          }
        }
        if (filterStatus !== 'all' && task.status !== filterStatus)
          return false;
        if (!q) return true;
        return (
          task.prompt.toLowerCase().includes(q) ||
          JSON.stringify(task.params).toLowerCase().includes(q)
        );
      });
  }, [activeFavoriteCollectionId, filterFavorite, filterStatus, query, tasks]);

  useEffect(() => {
    let frame = 0;
    let cancelled = false;

    const resolveSidebarHost = () => {
      if (cancelled) return;
      const host = document.querySelector('#hcai-sidebar-image-tasks');
      setSidebarHost(host);
      if (!host) frame = window.requestAnimationFrame(resolveSidebarHost);
    };

    resolveSidebarHost();
    return () => {
      cancelled = true;
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [appMode]);

  useEffect(() => {
    let frame = 0;
    let cancelled = false;

    const resolveMobileSideNavHost = () => {
      if (cancelled) return;
      const host = document.querySelector('#hcai-mobile-sidenav-image-tasks');
      setMobileSideNavHost(host);
      if (!host) frame = window.requestAnimationFrame(resolveMobileSideNavHost);
    };

    resolveMobileSideNavHost();
    return () => {
      cancelled = true;
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [appMode]);

  if (appMode !== 'gallery') return null;

  const selectTask = (id: string, closePanel = false) => {
    setDetailTaskId(id);
    if (closePanel) {
      window.dispatchEvent(new CustomEvent('hcai-close-mobile-side-nav'));
    }
  };

  const renderPanel = (closePanel = false) => (
    <div className="hcai-task-panel hcai-gallery-task-panel">
      <div className="hcai-task-head">
        <span>任务队列</span>
        <strong>{tasks.length}</strong>
      </div>
      <div className="hcai-agent-conversation-search-wrap">
        <svg
          aria-hidden="true"
          className="hcai-agent-conversation-search-icon"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索任务..."
          className="hcai-agent-conversation-search"
        />
      </div>
      <div className="hcai-task-list">
        {filteredTasks.length > 0 ? (
          filteredTasks.map((task) => (
            <div
              key={task.id}
              className={`hcai-task-item ${task.id === detailTaskId ? 'active' : ''}`}>
              <button
                type="button"
                className="hcai-task-select"
                onClick={() => selectTask(task.id, closePanel)}>
                <span
                  className={`hcai-task-dot ${taskDotClass[task.status]}`}
                />
                <div className="hcai-task-body">
                  <strong>{task.prompt || '未命名任务'}</strong>
                  <span>{getTaskMeta(task)}</span>
                </div>
              </button>
            </div>
          ))
        ) : (
          <span className="hcai-task-empty">暂无任务</span>
        )}
      </div>
    </div>
  );

  return (
    <>
      {sidebarHost ? createPortal(renderPanel(false), sidebarHost) : null}
      {mobileSideNavHost
        ? createPortal(renderPanel(true), mobileSideNavHost)
        : null}
    </>
  );
}
