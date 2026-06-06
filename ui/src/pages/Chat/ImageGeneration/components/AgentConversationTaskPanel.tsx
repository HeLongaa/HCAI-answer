import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../store';

function formatTime(value: number) {
  const date = new Date(value);
  const now = new Date();
  const sameYear = date.getFullYear() === now.getFullYear();
  const formatter = new Intl.DateTimeFormat('zh-CN', {
    ...(sameYear ? {} : { year: 'numeric' }),
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return formatter.format(date).replace(/\//g, '-');
}

function getConversationSearchText(conversation: {
  title: string;
  messages: Array<{ content: string }>;
  rounds: Array<{ prompt: string }>;
}) {
  return [
    conversation.title,
    ...conversation.messages.map((message) => message.content),
    ...conversation.rounds.map((round) => round.prompt),
  ]
    .join('\n')
    .toLocaleLowerCase();
}

export default function AgentConversationTaskPanel() {
  const appMode = useStore((s) => s.appMode);
  const conversations = useStore((s) => s.agentConversations);
  const activeConversationId = useStore((s) => s.activeAgentConversationId);
  const setActiveConversationId = useStore(
    (s) => s.setActiveAgentConversationId,
  );
  const [query, setQuery] = useState('');
  const [sidebarHost, setSidebarHost] = useState<Element | null>(null);
  const [mobileSideNavHost, setMobileSideNavHost] = useState<Element | null>(
    null,
  );

  const sortedConversations = useMemo(
    () => [...conversations].sort((a, b) => b.updatedAt - a.updatedAt),
    [conversations],
  );

  const filteredConversations = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return sortedConversations;
    return sortedConversations.filter((conversation) =>
      getConversationSearchText(conversation).includes(normalizedQuery),
    );
  }, [query, sortedConversations]);

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

  if (appMode !== 'agent') return null;

  const selectConversation = (id: string, closePanel = false) => {
    setActiveConversationId(id);
    if (closePanel) {
      window.dispatchEvent(new CustomEvent('hcai-close-mobile-side-nav'));
    }
  };

  const renderPanel = (closePanel = false) => (
    <div className="hcai-task-panel hcai-agent-conversation-task-panel">
      <div className="hcai-task-head">
        <span>任务队列</span>
        <strong>{conversations.length}</strong>
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
          placeholder="搜索聊天..."
          className="hcai-agent-conversation-search"
        />
      </div>
      <div className="hcai-task-list">
        {filteredConversations.length > 0 ? (
          filteredConversations.map((conversation) => (
            <div
              key={conversation.id}
              className={`hcai-task-item ${conversation.id === activeConversationId ? 'active' : ''}`}>
              <button
                type="button"
                className="hcai-task-select"
                onClick={() => selectConversation(conversation.id, closePanel)}>
                <span className="hcai-task-dot completed" />
                <div className="hcai-task-body">
                  <strong>{conversation.title || '新对话'}</strong>
                  <span>{formatTime(conversation.updatedAt)}</span>
                </div>
              </button>
            </div>
          ))
        ) : (
          <span className="hcai-task-empty">暂无对话</span>
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
