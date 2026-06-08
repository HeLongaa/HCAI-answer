import {
  useEffect,
  useMemo,
  useState,
  useRef,
  useCallback,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import type {
  AgentMessage,
  AgentRound,
  ResponsesOutputItem,
  TaskRecord,
} from '../types';
import {
  deleteAgentRoundFromConversation,
  editOutputs,
  getActiveAgentRounds,
  getAgentBranchLeafId,
  getAgentSiblingRounds,
  getCachedImage,
  ensureImageCached,
  regenerateAgentAssistantMessage,
  remapAgentRoundMentionsForPathChange,
  removeMultipleTasks,
  removeTask,
  reuseConfig,
  useStore,
} from '../store';
import { getPromptMentionParts } from '../lib/promptImageMentions';
import {
  copyTextToClipboard,
  getClipboardFailureMessage,
} from '../lib/clipboard';
import {
  collectWebSearchCalls,
  getAgentRoundOutputItems,
  getWebSearchStatusForCalls,
  type AgentWebSearchStatus,
} from '../lib/agentWebSearch';
import { createMaskPreviewDataUrl } from '../lib/canvasImage';
import {
  downloadImageEntriesAsZip,
  downloadImageIds,
  getImageZipEntries,
} from '../lib/downloadImages';
import TaskCard from './TaskCard';
import ViewportTooltip from './ViewportTooltip';
import MarkdownRenderer from './MarkdownRenderer';
import {
  TrashIcon,
  DownloadIcon,
  EditIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FavoriteIcon,
  CloseIcon,
  CopyIcon,
  RefreshIcon,
  ArrowDownIcon,
} from './icons';

function AgentActionButton({
  tooltip,
  className,
  disabled = false,
  onClick,
  onMouseDown,
  children,
}: {
  tooltip: string;
  className: string;
  disabled?: boolean;
  onClick?: (e: ReactMouseEvent<HTMLButtonElement>) => void;
  onMouseDown?: (e: ReactMouseEvent<HTMLButtonElement>) => void;
  children: ReactNode;
}) {
  const [tooltipVisible, setTooltipVisible] = useState(false);

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setTooltipVisible(true)}
      onMouseLeave={() => setTooltipVisible(false)}
      onFocus={() => setTooltipVisible(true)}
      onBlur={() => setTooltipVisible(false)}>
      <button
        type="button"
        className={className}
        disabled={disabled}
        aria-label={tooltip}
        onClick={(e) => {
          setTooltipVisible(false);
          onClick?.(e);
        }}
        onMouseDown={(e) => {
          setTooltipVisible(false);
          onMouseDown?.(e);
        }}>
        {children}
      </button>
      <ViewportTooltip visible={tooltipVisible} className="whitespace-nowrap">
        {tooltip}
      </ViewportTooltip>
    </span>
  );
}

function ChatImageThumb({
  imageId,
  imageIndex,
  maskImageId,
}: {
  imageId: string;
  imageIndex: number;
  maskImageId?: string | null;
}) {
  const [src, setSrc] = useState<string>(() => getCachedImage(imageId) || '');
  const setLightboxImageId = useStore((s) => s.setLightboxImageId);

  useEffect(() => {
    let cancelled = false;

    if (maskImageId) {
      Promise.all([ensureImageCached(imageId), ensureImageCached(maskImageId)])
        .then(async ([baseUrl, maskUrl]) => {
          if (!baseUrl || !maskUrl) return baseUrl || '';
          return createMaskPreviewDataUrl(baseUrl, maskUrl);
        })
        .then((url) => {
          if (!cancelled && url) setSrc(url);
        })
        .catch(() => {
          if (!cancelled) setSrc(getCachedImage(imageId) || '');
        });
      return () => {
        cancelled = true;
      };
    }

    const cached = getCachedImage(imageId);
    if (cached) {
      setSrc(cached);
      return () => {
        cancelled = true;
      };
    }
    ensureImageCached(imageId).then((url) => {
      if (!cancelled && url) setSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [imageId, maskImageId]);

  return (
    <div
      className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-lg shadow-sm cursor-pointer transition-opacity hover:opacity-90 ${
        maskImageId
          ? 'border-2 border-blue-500'
          : 'border border-gray-200 dark:border-white/[0.08]'
      }`}
      onClick={() => setLightboxImageId(imageId, [imageId])}>
      {src ? (
        <img src={src} className="h-full w-full object-cover" alt="" />
      ) : (
        <div className="h-full w-full bg-gray-100 dark:bg-white/[0.04]" />
      )}
      {maskImageId && (
        <span className="absolute left-1 top-1 z-10 rounded bg-blue-500/90 px-1.5 py-0.5 text-[8px] font-bold leading-none tracking-wider text-white backdrop-blur-sm pointer-events-none">
          MASK
        </span>
      )}
      <span className="absolute bottom-1 left-1 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-black/55 text-[9px] font-semibold text-white backdrop-blur-sm pointer-events-none">
        {imageIndex + 1}
      </span>
    </div>
  );
}

function AgentStreamingCursor() {
  return (
    <span
      aria-label="正在生成"
      className="ml-1 inline-block h-2 w-2 animate-pulse rounded-full bg-blue-500 align-baseline dark:bg-blue-400"
    />
  );
}

const AGENT_STOPPED_MESSAGE = '已停止生成。';

function AgentWebSearchInlineStatus({
  status,
}: {
  status: AgentWebSearchStatus;
}) {
  return (
    <span className="inline-flex text-sm font-medium text-gray-500 dark:text-gray-400">
      <span
        className={
          status.completed ? undefined : 'agent-web-search-running-text'
        }>
        {status.text}
      </span>
    </span>
  );
}

function AgentWebSearchStatusLines({
  statuses,
}: {
  statuses: AgentWebSearchStatus[];
}) {
  if (statuses.length === 0) return null;
  return (
    <div className="mb-2 space-y-1">
      {statuses.map((status, index) => (
        <div key={`${status.text}-${index}`}>
          <AgentWebSearchInlineStatus status={status} />
        </div>
      ))}
    </div>
  );
}

type AgentAssistantBlock =
  | { type: 'web-search'; status: AgentWebSearchStatus; key: string }
  | { type: 'batch-params'; status: AgentWebSearchStatus; key: string }
  | { type: 'image-task'; task: TaskRecord; key: string }
  | { type: 'deleted-image-task'; taskId: string; key: string }
  | { type: 'text'; key: string; content?: string };

interface AgentRoundTaskSlot {
  taskId: string;
  task: TaskRecord | null;
}

function isAgentRoundInterrupted(round: AgentRound | null) {
  return round?.status === 'error' && round.error === AGENT_STOPPED_MESSAGE;
}

function markToolStatusStopped(
  status: AgentWebSearchStatus,
): AgentWebSearchStatus {
  if (status.completed) return status;
  return { text: status.text.replace(/^正在/, '已停止'), completed: true };
}

function getImageTaskForOutputItem(
  item: ResponsesOutputItem,
  tasksForRound: TaskRecord[],
) {
  if (item.type !== 'image_generation_call') return null;
  return (
    tasksForRound.find(
      (task) => task.agentToolCallId && task.agentToolCallId === item.id,
    ) ?? null
  );
}

function getBatchImageTasksForOutputItem(
  item: ResponsesOutputItem,
  tasksForRound: TaskRecord[],
) {
  if (
    item.type !== 'function_call' ||
    item.name !== 'generate_image_batch' ||
    !item.call_id
  )
    return [];
  return tasksForRound.filter((task) => task.agentBatchCallId === item.call_id);
}

function getTextFromOutputItem(item: ResponsesOutputItem) {
  if (item.type !== 'message') return '';
  return (item.content ?? [])
    .map((part) => (typeof part.text === 'string' ? part.text : ''))
    .filter(Boolean)
    .join('\n')
    .trim();
}

function getAgentAssistantBlocks(
  round: AgentRound | null,
  taskSlots: AgentRoundTaskSlot[],
  allTasks: TaskRecord[],
  hasText: boolean,
): AgentAssistantBlock[] {
  const outputItems = getAgentRoundOutputItems(round, allTasks);
  const tasksForRound = taskSlots
    .map((slot) => slot.task)
    .filter(Boolean) as TaskRecord[];
  const roundInterrupted = isAgentRoundInterrupted(round);
  if (outputItems.length === 0) {
    return [
      ...(hasText ? [{ type: 'text' as const, key: 'text:fallback' }] : []),
      ...taskSlots.map((slot) =>
        slot.task
          ? {
              type: 'image-task' as const,
              task: slot.task,
              key: `image:${slot.task.id}`,
            }
          : {
              type: 'deleted-image-task' as const,
              taskId: slot.taskId,
              key: `deleted-image:${slot.taskId}`,
            },
      ),
    ];
  }

  const blocks: AgentAssistantBlock[] = [];
  const renderedTaskIds = new Set<string>();
  let renderedTextBlocks = 0;
  let webSearchGroup: ResponsesOutputItem[] = [];

  const flushWebSearchGroup = () => {
    if (webSearchGroup.length === 0) return;
    const status = getWebSearchStatusForCalls(
      collectWebSearchCalls(webSearchGroup),
    );
    if (status)
      blocks.push({
        type: 'web-search',
        status: roundInterrupted ? markToolStatusStopped(status) : status,
        key: `web-search:${blocks.length}:${webSearchGroup.map((item) => item.id).join(':')}`,
      });
    webSearchGroup = [];
  };

  for (const item of outputItems) {
    if (item.type === 'web_search_call') {
      webSearchGroup.push(item);
      continue;
    }

    flushWebSearchGroup();

    const imageTask = getImageTaskForOutputItem(item, tasksForRound);
    if (imageTask && !renderedTaskIds.has(imageTask.id)) {
      renderedTaskIds.add(imageTask.id);
      blocks.push({
        type: 'image-task',
        task: imageTask,
        key: `image:${imageTask.id}`,
      });
      continue;
    }

    const batchImageTasks = getBatchImageTasksForOutputItem(
      item,
      tasksForRound,
    );
    if (batchImageTasks.length > 0) {
      for (const task of batchImageTasks) {
        if (renderedTaskIds.has(task.id)) continue;
        renderedTaskIds.add(task.id);
        blocks.push({ type: 'image-task', task, key: `image:${task.id}` });
      }
      continue;
    }

    if (
      (round?.status === 'running' || roundInterrupted) &&
      item.type === 'function_call' &&
      item.name === 'generate_image_batch'
    ) {
      blocks.push({
        type: 'batch-params',
        status: roundInterrupted
          ? markToolStatusStopped({
              text: '正在填写并发图像生成参数',
              completed: false,
            })
          : { text: '正在填写并发图像生成参数', completed: false },
        key: `batch-params:${item.call_id ?? item.id ?? blocks.length}`,
      });
      continue;
    }

    if (item.type === 'message') {
      const content = getTextFromOutputItem(item);
      if (content) {
        renderedTextBlocks += 1;
        blocks.push({
          type: 'text',
          key: `text:${item.id ?? blocks.length}`,
          content,
        });
      }
    }
  }

  flushWebSearchGroup();

  if (hasText && renderedTextBlocks === 0)
    blocks.push({ type: 'text', key: 'text:fallback' });
  for (const slot of taskSlots) {
    if (slot.task) {
      if (!renderedTaskIds.has(slot.task.id))
        blocks.push({
          type: 'image-task',
          task: slot.task,
          key: `image:${slot.task.id}`,
        });
    } else {
      blocks.push({
        type: 'deleted-image-task',
        taskId: slot.taskId,
        key: `deleted-image:${slot.taskId}`,
      });
    }
  }
  return blocks;
}

function getAgentAssistantCopyContent(
  fallbackContent: string,
  blocks: AgentAssistantBlock[],
) {
  if (!blocks.some((block) => block.type !== 'text')) return fallbackContent;

  const parts = blocks
    .filter(
      (block): block is Extract<AgentAssistantBlock, { type: 'text' }> =>
        block.type === 'text',
    )
    .map((block) => block.content ?? '')
    .map((content) => content.trim())
    .filter(Boolean);

  return parts.length > 0 ? parts.join('\n\n') : fallbackContent;
}

function getRoundTasks(round: AgentRound | null, tasks: TaskRecord[]) {
  if (!round) return [];
  return round.outputTaskIds.map(
    (taskId) => tasks.find((task) => task.id === taskId) ?? null,
  );
}

function getRoundTaskSlots(
  round: AgentRound | null,
  tasks: TaskRecord[],
): AgentRoundTaskSlot[] {
  if (!round) return [];
  return round.outputTaskIds.map((taskId) => ({
    taskId,
    task: tasks.find((task) => task.id === taskId) ?? null,
  }));
}

export default function AgentWorkspace() {
  const conversations = useStore((s) => s.agentConversations);
  const conversationsLoaded = useStore((s) => s.agentConversationsLoaded);
  const activeConversationId = useStore((s) => s.activeAgentConversationId);
  const createConversation = useStore((s) => s.createAgentConversation);
  const setActiveConversationId = useStore(
    (s) => s.setActiveAgentConversationId,
  );
  const appMode = useStore((s) => s.appMode);
  const tasks = useStore((s) => s.tasks);
  const setConfirmDialog = useStore((s) => s.setConfirmDialog);
  const setDetailTaskId = useStore((s) => s.setDetailTaskId);
  const setPrompt = useStore((s) => s.setPrompt);
  const setInputImages = useStore((s) => s.setInputImages);
  const setMaskDraft = useStore((s) => s.setMaskDraft);
  const clearMaskDraft = useStore((s) => s.clearMaskDraft);
  const setAppMode = useStore((s) => s.setAppMode);
  const agentEditingRoundId = useStore((s) => s.agentEditingRoundId);
  const setAgentEditingRoundId = useStore((s) => s.setAgentEditingRoundId);
  const setActiveAgentRoundId = useStore((s) => s.setActiveAgentRoundId);
  const showToast = useStore((s) => s.showToast);
  const openFavoritePicker = useStore((s) => s.openFavoritePicker);
  const conversation =
    conversations.find((item) => item.id === activeConversationId) ?? null;

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef(new Map<string, HTMLElement>());
  const [scrollTargetRoundId, setScrollTargetRoundId] = useState<string | null>(
    null,
  );
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(true);
  const autoScrollStateRef = useRef<{
    conversationId: string | null;
    lastUserMessageSignature: string | null;
  }>({ conversationId: null, lastUserMessageSignature: null });
  const errorCopyPointerDownRef = useRef<{ x: number; y: number } | null>(null);

  const updateIsScrolledToBottom = useCallback(() => {
    const scrollContainer = scrollContainerRef.current;
    if (appMode !== 'agent' || !scrollContainer) {
      setIsScrolledToBottom(true);
      return;
    }

    const distanceFromBottom =
      scrollContainer.scrollHeight -
      scrollContainer.scrollTop -
      scrollContainer.clientHeight;
    setIsScrolledToBottom(distanceFromBottom <= 64);
  }, [appMode]);

  const scrollToAgentBottom = useCallback(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;
    scrollContainer.scrollTo({
      top: scrollContainer.scrollHeight,
      behavior: 'smooth',
    });
  }, []);

  const jumpToAgentBottom = useCallback(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;
    scrollContainer.scrollTop = scrollContainer.scrollHeight;
    setIsScrolledToBottom(
      scrollContainer.scrollHeight -
        scrollContainer.scrollTop -
        scrollContainer.clientHeight <=
        64,
    );
  }, []);

  useEffect(() => {
    if (appMode !== 'agent') return;

    document.documentElement.classList.add('agent-no-pull-refresh');
    return () =>
      document.documentElement.classList.remove('agent-no-pull-refresh');
  }, [appMode]);

  useEffect(() => {
    if (appMode !== 'agent') return;

    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    let ticking = false;

    const handleScroll = () => {
      if (ticking) return;

      window.requestAnimationFrame(() => {
        updateIsScrolledToBottom();
        ticking = false;
      });
      ticking = true;
    };

    const initialFrame = window.requestAnimationFrame(updateIsScrolledToBottom);
    const visualViewport = window.visualViewport;
    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', updateIsScrolledToBottom);
    visualViewport?.addEventListener('resize', updateIsScrolledToBottom);

    return () => {
      window.cancelAnimationFrame(initialFrame);
      scrollContainer.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', updateIsScrolledToBottom);
      visualViewport?.removeEventListener('resize', updateIsScrolledToBottom);
    };
  }, [appMode, updateIsScrolledToBottom]);

  useEffect(() => {
    if (appMode !== 'agent') return;
    if (!conversationsLoaded) return;

    if (conversations.length === 0) {
      createConversation();
    } else if (!conversation) {
      const latest = [...conversations].sort(
        (a, b) => b.updatedAt - a.updatedAt,
      )[0];
      if (latest && latest.messages.length === 0) {
        setActiveConversationId(latest.id);
      } else {
        createConversation();
      }
    }
  }, [
    appMode,
    conversationsLoaded,
    conversations,
    conversation,
    createConversation,
    setActiveConversationId,
  ]);

  const activeRounds = useMemo(
    () => (conversation ? getActiveAgentRounds(conversation) : []),
    [conversation],
  );

  const activeMessages = useMemo(() => {
    if (!conversation) return [];
    const messages: AgentMessage[] = [];
    for (const round of activeRounds) {
      const userMessage = conversation.messages.find(
        (message) => message.id === round.userMessageId,
      );
      if (userMessage) messages.push(userMessage);
      const assistantMessage = round.assistantMessageId
        ? conversation.messages.find(
            (message) => message.id === round.assistantMessageId,
          )
        : conversation.messages.find(
            (message) =>
              message.roundId === round.id && message.role === 'assistant',
          );
      if (assistantMessage) messages.push(assistantMessage);
    }
    return messages;
  }, [activeRounds, conversation]);

  useEffect(() => {
    const conversationId = conversation?.id ?? null;
    const lastMessage = activeMessages[activeMessages.length - 1] ?? null;
    const lastUserMessageSignature =
      lastMessage?.role === 'user'
        ? `${lastMessage.id}:${lastMessage.createdAt}:${lastMessage.content}`
        : null;
    const previous = autoScrollStateRef.current;
    const shouldScroll =
      appMode === 'agent' &&
      previous.conversationId === conversationId &&
      lastMessage?.role === 'user' &&
      lastUserMessageSignature != null &&
      previous.lastUserMessageSignature !== lastUserMessageSignature;

    autoScrollStateRef.current = { conversationId, lastUserMessageSignature };
    if (!shouldScroll) return;

    const firstFrame = window.requestAnimationFrame(() => {
      jumpToAgentBottom();
      window.requestAnimationFrame(jumpToAgentBottom);
    });
    return () => window.cancelAnimationFrame(firstFrame);
  }, [
    activeMessages,
    appMode,
    conversation?.id,
    jumpToAgentBottom,
  ]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(updateIsScrolledToBottom);
    return () => window.cancelAnimationFrame(frame);
  }, [activeMessages, activeRounds, updateIsScrolledToBottom]);

  useEffect(() => {
    if (!scrollTargetRoundId) return;
    const id = window.requestAnimationFrame(() => {
      messageRefs.current
        .get(scrollTargetRoundId)
        ?.scrollIntoView({ block: 'center' });
      setScrollTargetRoundId(null);
    });
    return () => window.cancelAnimationFrame(id);
  }, [activeMessages, scrollTargetRoundId]);

  const handleSwitchBranch = (round: AgentRound, direction: -1 | 1) => {
    if (!conversation) return;
    const siblings = getAgentSiblingRounds(conversation, round);
    if (siblings.length <= 1) return;
    const currentIndex = siblings.findIndex((item) => item.id === round.id);
    const nextRound =
      siblings[(currentIndex + direction + siblings.length) % siblings.length];
    const nextLeafId = getAgentBranchLeafId(conversation, nextRound.id);
    setActiveAgentRoundId(conversation.id, nextLeafId);
    setAgentEditingRoundId(null);
    setScrollTargetRoundId(nextRound.id);
  };

  const handleDeleteMessage = (message: AgentMessage, round: AgentRound) => {
    const isUserMessage = message.role === 'user';
    const existingTaskIds = new Set(tasks.map((task) => task.id));
    const assistantTaskIds = isUserMessage
      ? []
      : Array.from(
          new Set([
            ...(message.outputTaskIds ?? []),
            ...round.outputTaskIds,
            ...tasks
              .filter(
                (task) =>
                  task.agentMessageId === message.id ||
                  task.agentRoundId === round.id,
              )
              .map((task) => task.id),
          ]),
        ).filter((taskId) => existingTaskIds.has(taskId));
    setConfirmDialog({
      title: isUserMessage ? '删除轮次' : '删除消息',
      message: isUserMessage
        ? '确定要删除这轮任务吗？这会删除这条消息和它的输出，后续消息会被保留。'
        : '确定要删除这条消息吗？这会同时删除这条回复生成的图片。',
      action: async () => {
        if (isUserMessage) {
          if (round.outputTaskIds.length > 0)
            await removeMultipleTasks(round.outputTaskIds);

          useStore.setState((state) => {
            const targetConversationId = conversation?.id;
            let oldActivePath: AgentRound[] = [];
            let newActivePath: AgentRound[] = [];
            const agentConversations = state.agentConversations.map((item) => {
              if (item.id !== targetConversationId) return item;
              oldActivePath = getActiveAgentRounds(item);
              const nextConversation = deleteAgentRoundFromConversation(
                item,
                round.id,
              );
              newActivePath = getActiveAgentRounds(nextConversation);
              return nextConversation;
            });
            const draft = targetConversationId
              ? state.agentInputDrafts[targetConversationId]
              : null;
            const remappedDraft = draft
              ? {
                  ...draft,
                  prompt: remapAgentRoundMentionsForPathChange(
                    draft.prompt,
                    oldActivePath,
                    newActivePath,
                  ),
                }
              : null;
            const agentInputDrafts =
              targetConversationId && remappedDraft
                ? {
                    ...state.agentInputDrafts,
                    [targetConversationId]: remappedDraft,
                  }
                : state.agentInputDrafts;
            const shouldRemapVisibleInput =
              targetConversationId &&
              state.activeAgentConversationId === targetConversationId &&
              state.appMode === 'agent';
            return {
              agentConversations,
              agentInputDrafts,
              ...(shouldRemapVisibleInput
                ? {
                    prompt: remapAgentRoundMentionsForPathChange(
                      state.prompt,
                      oldActivePath,
                      newActivePath,
                    ),
                  }
                : {}),
              agentEditingRoundId:
                state.agentEditingRoundId === round.id
                  ? null
                  : state.agentEditingRoundId,
            };
          });
          return;
        }

        if (assistantTaskIds.length > 0)
          await removeMultipleTasks(assistantTaskIds);

        useStore.setState((state) => ({
          agentConversations: state.agentConversations.map((item) =>
            item.id === conversation?.id
              ? {
                  ...item,
                  updatedAt: Date.now(),
                  rounds: item.rounds.map((candidate) =>
                    candidate.id === round.id &&
                    candidate.assistantMessageId === message.id
                      ? { ...candidate, assistantMessageId: undefined }
                      : candidate,
                  ),
                  messages: item.messages.filter(
                    (candidate) => candidate.id !== message.id,
                  ),
                }
              : item,
          ),
          agentEditingRoundId: state.agentEditingRoundId,
        }));
      },
    });
  };

  const handleReuse = (task: TaskRecord) => {
    setConfirmDialog({
      title: '切换到画廊模式？',
      message:
        '复用参数会应用到画廊输入区。切换到画廊模式后，当前 Agent 对话仍会保留。',
      confirmText: '切换并复用',
      cancelText: '取消',
      action: () => {
        setAppMode('gallery');
        void reuseConfig(task);
      },
    });
  };

  const handleEditRoundMessage = async (round: AgentRound, content: string) => {
    setAgentEditingRoundId(round.id);
    clearMaskDraft();

    const inputImages = await Promise.all(
      round.inputImageIds.map(async (id) => ({
        id,
        dataUrl: (await ensureImageCached(id)) || '',
      })),
    );
    setInputImages(inputImages);
    const maskTargetImageId =
      round.maskTargetImageId ??
      (round.maskImageId ? round.inputImageIds[0] : null);
    if (
      maskTargetImageId &&
      round.maskImageId &&
      inputImages.some((img) => img.id === maskTargetImageId)
    ) {
      const maskDataUrl = await ensureImageCached(round.maskImageId);
      if (maskDataUrl) {
        setMaskDraft({
          targetImageId: maskTargetImageId,
          maskDataUrl,
          updatedAt: Date.now(),
        });
      }
    }
    setPrompt(content);
  };

  const handleCopyMessage = async (
    content: string,
    successMessage = '提示词已复制',
    failureMessage = '复制提示词失败',
  ) => {
    try {
      await copyTextToClipboard(content);
      showToast(successMessage, 'success');
    } catch (err) {
      showToast(getClipboardFailureMessage(failureMessage, err), 'error');
    }
  };

  const handleErrorCopyPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    errorCopyPointerDownRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleErrorCopyClick = (
    e: ReactMouseEvent<HTMLDivElement>,
    content: string,
  ) => {
    e.stopPropagation();

    const pointerDown = errorCopyPointerDownRef.current;
    errorCopyPointerDownRef.current = null;
    if (
      pointerDown &&
      Math.hypot(e.clientX - pointerDown.x, e.clientY - pointerDown.y) > 4
    )
      return;

    const selection = window.getSelection();
    if (selection && !selection.isCollapsed && selection.toString().trim()) {
      const target = e.currentTarget;
      if (
        (selection.anchorNode && target.contains(selection.anchorNode)) ||
        (selection.focusNode && target.contains(selection.focusNode))
      )
        return;
    }

    void handleCopyMessage(content, '完整报错已复制', '复制完整报错失败');
  };

  return (
    <>
      <div className="hcai-agent-content-row">
        {/* Center Chat Area */}
        <section className="min-w-0 min-h-0 flex-1 flex flex-col relative">
          <div
            ref={scrollContainerRef}
            className="hcai-agent-message-list flex-1 space-y-4 overflow-y-auto overscroll-contain pb-[calc(var(--input-bar-clearance,12rem)+1.5rem)] px-1 lg:px-4 custom-scrollbar">
            {!conversation ? (
              <div className="py-20 text-center text-gray-400">
                <p className="mb-3">还没有 Agent 对话</p>
                <button
                  type="button"
                  onClick={createConversation}
                  className="rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 transition-colors">
                  创建对话
                </button>
              </div>
            ) : (
              (() => {
                if (activeMessages.length === 0) {
                  return (
                    <div className="py-20 text-center text-gray-400">
                      <p className="mb-2">开始新的 Agent 对话</p>
                      <p className="text-xs">
                        在底部输入框发送消息即可创建第一轮对话。
                      </p>
                    </div>
                  );
                }

                const renderedMessages = activeMessages.map((message) => {
                  const round = conversation.rounds.find(
                    (item) => item.id === message.roundId,
                  );
                  const isAssistant = message.role === 'assistant';
                  const isStreamingAssistant =
                    isAssistant && round?.status === 'running';
                  const isEditing =
                    !isAssistant && round?.id === agentEditingRoundId;
                  const siblingRounds =
                    !isAssistant && round
                      ? getAgentSiblingRounds(conversation, round)
                      : [];
                  const siblingIndex = round
                    ? siblingRounds.findIndex((item) => item.id === round.id)
                    : -1;
                  const hasBranches = siblingRounds.length > 1;
                  const taskSlotsForRound = isAssistant
                    ? getRoundTaskSlots(round ?? null, tasks)
                    : [];
                  const tasksForRound = taskSlotsForRound
                    .map((slot) => slot.task)
                    .filter(Boolean) as TaskRecord[];
                  const favoriteTasksForRound = tasksForRound.filter(
                    (task) => (task.outputImages?.length ?? 0) > 0,
                  );
                  const hasRoundFavoriteTasks =
                    favoriteTasksForRound.length > 0;
                  const allRoundTasksFavorited =
                    hasRoundFavoriteTasks &&
                    favoriteTasksForRound.every((task) => task.isFavorite);
                  const assistantBlocks = isAssistant
                    ? getAgentAssistantBlocks(
                        round ?? null,
                        taskSlotsForRound,
                        tasks,
                        Boolean(message.content.trim()),
                      )
                    : [];
                  const inputImagesForRound = (round?.inputImageIds || []).map(
                    (id) => ({ id, dataUrl: '' }),
                  );
                  const parts = getPromptMentionParts(
                    message.content,
                    inputImagesForRound,
                  );
                  return (
                    <article
                      key={message.id}
                      ref={(node) => {
                        if (!isAssistant && node)
                          messageRefs.current.set(message.roundId, node);
                        else if (!isAssistant)
                          messageRefs.current.delete(message.roundId);
                      }}
                      className={`hcai-message hcai-agent-chat-message group mb-6 ${isAssistant ? 'assistant' : 'user'}`}>
                      <div className="hcai-message-avatar">
                        {isAssistant ? 'AI' : '我'}
                      </div>
                      <div className="hcai-message-body">
                        <div className="hcai-message-meta">
                          <span>{isAssistant ? 'Agent' : '用户'}</span>
                          <em>第 {round?.index ?? '?'} 轮</em>
                        </div>

                        <div
                          className={`hcai-message-content hcai-agent-message-content ${
                            isEditing
                              ? 'ring-2 ring-blue-500/50 dark:ring-blue-400/50'
                              : ''
                          }`}>
                          {message.role === 'user' &&
                            round &&
                            round.inputImageIds.length > 0 && (
                              <div
                                className="flex gap-2 mb-3 overflow-x-auto pb-1"
                                onClick={(e) => e.stopPropagation()}>
                                {round.inputImageIds.map(
                                  (imgId, imageIndex) => (
                                    <ChatImageThumb
                                      key={imgId}
                                      imageId={imgId}
                                      imageIndex={imageIndex}
                                      maskImageId={
                                        imgId ===
                                        (round.maskTargetImageId ??
                                          round.inputImageIds[0])
                                          ? round.maskImageId
                                          : null
                                      }
                                    />
                                  ),
                                )}
                              </div>
                            )}

                          {round?.status === 'error' &&
                          isAssistant &&
                          message.content.startsWith('请求失败：') ? (
                            <div
                              data-selectable-text
                              className="-m-2 flex cursor-copy select-text flex-col rounded-xl p-2 transition-colors hover:bg-red-50/60 dark:hover:bg-red-500/5"
                              title="点击复制完整报错"
                              onPointerDown={handleErrorCopyPointerDown}
                              onClick={(e) =>
                                handleErrorCopyClick(e, message.content)
                              }>
                              {(() => {
                                const content = message.content.replace(
                                  /^请求失败：/,
                                  '',
                                );
                                const [mainErr, ...hints] =
                                  content.split('\n提示：');
                                return (
                                  <>
                                    <div className="flex items-start gap-2 text-red-500 dark:text-red-400">
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 20 20"
                                        fill="currentColor"
                                        className="w-[18px] h-[18px] mt-[1.5px] flex-shrink-0">
                                        <path
                                          fillRule="evenodd"
                                          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
                                          clipRule="evenodd"
                                        />
                                      </svg>
                                      <div className="whitespace-pre-wrap text-[14px] leading-relaxed break-words font-medium">
                                        {mainErr}
                                      </div>
                                    </div>
                                    {hints.length > 0 && (
                                      <div className="pl-[26px] mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed text-gray-500 dark:text-gray-400 break-words opacity-90">
                                        <span className="font-medium">
                                          提示：
                                        </span>
                                        {hints.join('\n提示：')}
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          ) : (
                            <div
                              data-selectable-text
                              className={`text-[15px] leading-relaxed text-gray-800 dark:text-gray-100 ${!isAssistant ? 'select-text' : ''}`}>
                              {isAssistant ? (
                                <>
                                  {assistantBlocks.length > 0 ? (
                                    assistantBlocks.map((block, index) => {
                                      if (block.type === 'web-search')
                                        return (
                                          <AgentWebSearchStatusLines
                                            key={block.key}
                                            statuses={[block.status]}
                                          />
                                        );
                                      if (block.type === 'text')
                                        return (
                                          <div
                                            key={block.key}
                                            className={
                                              index > 0 ? 'mt-3' : undefined
                                            }>
                                            <MarkdownRenderer
                                              content={
                                                block.content ?? message.content
                                              }
                                              streaming={isStreamingAssistant}
                                            />
                                          </div>
                                        );
                                      if (block.type === 'batch-params') {
                                        return (
                                          <div
                                            key={block.key}
                                            className={
                                              index > 0 ? 'mt-3' : undefined
                                            }>
                                            <AgentWebSearchInlineStatus
                                              status={block.status}
                                            />
                                          </div>
                                        );
                                      }
                                      if (block.type === 'deleted-image-task') {
                                        return (
                                          <div
                                            key={block.key}
                                            className="mt-4 w-full min-w-[16rem] max-w-sm rounded-xl bg-gray-50/50 dark:bg-white/[0.02] border border-dashed border-gray-200 dark:border-white/[0.08] p-4 flex min-h-[120px] flex-col items-center justify-center text-gray-400 dark:text-gray-500"
                                            onClick={(e) =>
                                              e.stopPropagation()
                                            }>
                                            <TrashIcon className="w-6 h-6 mb-2 opacity-50" />
                                            <span className="text-xs">
                                              [Image Removed]
                                            </span>
                                          </div>
                                        );
                                      }
                                      return (
                                        <div
                                          key={block.key}
                                          className="mt-4 max-w-sm"
                                          onClick={(e) => e.stopPropagation()}>
                                          <TaskCard
                                            task={block.task}
                                            disableSwipe={true}
                                            onClick={() =>
                                              setDetailTaskId(block.task.id)
                                            }
                                            onReuse={() =>
                                              handleReuse(block.task)
                                            }
                                            onEditOutputs={() =>
                                              editOutputs(block.task)
                                            }
                                            onDelete={() =>
                                              setConfirmDialog({
                                                title: '删除任务',
                                                message:
                                                  '确定要删除这个任务吗？',
                                                action: () =>
                                                  removeTask(block.task),
                                              })
                                            }
                                          />
                                        </div>
                                      );
                                    })
                                  ) : isStreamingAssistant ? (
                                    <AgentStreamingCursor />
                                  ) : null}
                                </>
                              ) : parts.some(
                                  (part) => part.type === 'mention',
                                ) ? (
                                <div className="whitespace-pre-wrap break-words">
                                  {parts.map((part, i) =>
                                    part.type === 'text' ? (
                                      <span key={i}>{part.text}</span>
                                    ) : (
                                      <span
                                        key={i}
                                        className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-blue-100/50 text-blue-700 dark:bg-blue-500/30 dark:text-blue-300 text-xs font-medium mx-0.5 align-baseline">
                                        {part.text}
                                      </span>
                                    ),
                                  )}
                                </div>
                              ) : (
                                <MarkdownRenderer
                                  content={parts[0]?.text ?? ''}
                                />
                              )}
                            </div>
                          )}
                        </div>

                        {!isStreamingAssistant && (
                          <div
                            className={`hcai-message-actions hcai-agent-message-actions transition-opacity duration-200 ${isEditing || hasBranches ? 'opacity-100' : 'opacity-100 lg:opacity-0 lg:group-hover:opacity-100'}`}
                            onClick={(e) => e.stopPropagation()}>
                            <div className="flex min-w-0 items-center gap-2">
                              {isEditing && (
                                <div className="inline-flex items-center rounded-md bg-blue-100 px-2 py-1 text-xs text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
                                  <span className="truncate">正在编辑</span>
                                  <AgentActionButton
                                    tooltip="取消编辑"
                                    className="ml-1 -mr-1 p-0.5 rounded-full hover:bg-blue-200 dark:hover:bg-blue-500/40 transition-colors"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPrompt('');
                                      setInputImages([]);
                                      clearMaskDraft();
                                      setAgentEditingRoundId(null);
                                    }}>
                                    <CloseIcon className="w-3 h-3" />
                                  </AgentActionButton>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2 ml-auto text-gray-400">
                              {!isAssistant &&
                                round &&
                                hasBranches &&
                                siblingIndex >= 0 && (
                                  <div className="inline-flex items-center text-sm font-bold text-gray-400 dark:text-gray-500 mr-1">
                                    <AgentActionButton
                                      tooltip="上一分支"
                                      className="p-1 rounded-md hover:bg-gray-200/50 dark:hover:bg-white/10 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                                      onClick={() =>
                                        handleSwitchBranch(round, -1)
                                      }>
                                      <ChevronLeftIcon className="w-4 h-4" />
                                    </AgentActionButton>
                                    <span className="px-1 tabular-nums tracking-widest">
                                      {siblingIndex + 1}/{siblingRounds.length}
                                    </span>
                                    <AgentActionButton
                                      tooltip="下一分支"
                                      className="p-1 rounded-md hover:bg-gray-200/50 dark:hover:bg-white/10 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                                      onClick={() =>
                                        handleSwitchBranch(round, 1)
                                      }>
                                      <ChevronRightIcon className="w-4 h-4" />
                                    </AgentActionButton>
                                  </div>
                                )}
                              {isAssistant ? (
                                <>
                                  <AgentActionButton
                                    tooltip="复制输出文本"
                                    className={`p-1.5 rounded-md transition-colors ${message.content.trim() ? 'text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:text-gray-200 dark:hover:bg-white/[0.06]' : 'text-gray-300 dark:text-gray-600 opacity-50 cursor-not-allowed'}`}
                                    disabled={!message.content.trim()}
                                    onClick={() => {
                                      void handleCopyMessage(
                                        getAgentAssistantCopyContent(
                                          message.content,
                                          assistantBlocks,
                                        ),
                                        '输出文本已复制',
                                        '复制输出文本失败',
                                      );
                                    }}>
                                    <CopyIcon className="w-4 h-4" />
                                  </AgentActionButton>
                                  <AgentActionButton
                                    tooltip="重新生成"
                                    className="p-1.5 rounded-md text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors"
                                    onClick={() => {
                                      if (conversation && round)
                                        void regenerateAgentAssistantMessage(
                                          conversation.id,
                                          round.id,
                                        );
                                    }}>
                                    <RefreshIcon className="w-4 h-4" />
                                  </AgentActionButton>
                                  <AgentActionButton
                                    tooltip={
                                      allRoundTasksFavorited
                                        ? '编辑收藏夹'
                                        : '收藏所有图片'
                                    }
                                    className={`p-1.5 rounded-md transition-colors ${hasRoundFavoriteTasks ? (allRoundTasksFavorited ? 'text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-500/10' : 'text-gray-400 hover:text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-500/10') : 'text-gray-300 dark:text-gray-600 opacity-50 cursor-not-allowed'}`}
                                    disabled={!hasRoundFavoriteTasks}
                                    onClick={() => {
                                      if (!hasRoundFavoriteTasks) return;
                                      openFavoritePicker(
                                        favoriteTasksForRound.map(
                                          (task) => task.id,
                                        ),
                                      );
                                    }}>
                                    <FavoriteIcon
                                      className="w-4 h-4"
                                      filled={allRoundTasksFavorited}
                                    />
                                  </AgentActionButton>
                                  <AgentActionButton
                                    tooltip="下载所有图片"
                                    className={`p-1.5 rounded-md transition-colors ${getRoundTasks(round ?? null, tasks).filter(Boolean).length > 0 ? 'text-gray-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-500/10' : 'text-gray-300 dark:text-gray-600 opacity-50 cursor-not-allowed'}`}
                                    disabled={
                                      getRoundTasks(
                                        round ?? null,
                                        tasks,
                                      ).filter(Boolean).length === 0
                                    }
                                    onClick={async () => {
                                      const imageIds = tasksForRound.flatMap(
                                        (t) => t.outputImages || [],
                                      );
                                      if (imageIds.length === 0) return;
                                      try {
                                        const roundIndex = round?.index ?? 0;
                                        const fileNameBase =
                                          'agent-round-' + roundIndex;
                                        const settings =
                                          useStore.getState().settings;
                                        const { successCount, failCount } =
                                          settings.zipDownloadRoutes.includes(
                                            'agent-round-all',
                                          )
                                            ? await downloadImageEntriesAsZip(
                                                getImageZipEntries(
                                                  imageIds,
                                                  fileNameBase,
                                                ),
                                                fileNameBase,
                                              )
                                            : await downloadImageIds(
                                                imageIds,
                                                fileNameBase,
                                              );
                                        if (successCount === 0) {
                                          useStore
                                            .getState()
                                            .showToast('下载失败', 'error');
                                        } else if (failCount > 0) {
                                          useStore
                                            .getState()
                                            .showToast(
                                              '部分下载失败：成功 ' +
                                                successCount +
                                                '，失败 ' +
                                                failCount,
                                              'error',
                                            );
                                        } else {
                                          useStore
                                            .getState()
                                            .showToast(
                                              successCount > 1
                                                ? '下载成功：' +
                                                    successCount +
                                                    ' 张图片'
                                                : '下载成功',
                                              'success',
                                            );
                                        }
                                      } catch (err) {
                                        console.error(err);
                                        useStore
                                          .getState()
                                          .showToast('下载失败', 'error');
                                      }
                                    }}>
                                    <DownloadIcon className="w-4 h-4" />
                                  </AgentActionButton>
                                  <AgentActionButton
                                    tooltip="删除消息"
                                    className="p-1.5 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-md transition-colors"
                                    onClick={() => {
                                      if (round)
                                        handleDeleteMessage(message, round);
                                    }}>
                                    <TrashIcon className="w-4 h-4" />
                                  </AgentActionButton>
                                </>
                              ) : (
                                <>
                                  <AgentActionButton
                                    tooltip="复制提示词"
                                    className="p-1.5 rounded-md hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-white/[0.04] transition-colors"
                                    onClick={() => {
                                      void handleCopyMessage(message.content);
                                    }}>
                                    <CopyIcon className="w-4 h-4" />
                                  </AgentActionButton>
                                  <AgentActionButton
                                    tooltip="编辑"
                                    className="p-1.5 rounded-md hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-white/[0.04] transition-colors"
                                    onClick={() => {
                                      if (round)
                                        void handleEditRoundMessage(
                                          round,
                                          message.content,
                                        );
                                    }}>
                                    <EditIcon className="w-4 h-4" />
                                  </AgentActionButton>
                                  <AgentActionButton
                                    tooltip="删除"
                                    className="p-1.5 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors"
                                    onClick={() => {
                                      if (round)
                                        handleDeleteMessage(message, round);
                                    }}>
                                    <TrashIcon className="w-4 h-4" />
                                  </AgentActionButton>
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </article>
                  );
                });

                const runningRounds = activeRounds.filter(
                  (round) =>
                    round.status === 'running' &&
                    !conversation.messages.some(
                      (message) =>
                        message.roundId === round.id &&
                        message.role === 'assistant',
                    ),
                );

                return (
                  <>
                    {renderedMessages}
                    {runningRounds.map((round) => (
                      <article
                        key={`running-${round.id}`}
                        className="hcai-message hcai-agent-chat-message assistant mb-6">
                        <div className="hcai-message-avatar">AI</div>
                        <div className="hcai-message-body">
                          <div className="hcai-message-meta">
                            <span>Agent</span>
                            <em>第 {round.index} 轮</em>
                          </div>
                          <div className="hcai-message-content hcai-agent-message-content">
                            <span className="inline-flex items-center gap-1.5">
                              <span>正在生成回复</span>
                              <span className="flex gap-1">
                                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:150ms]" />
                                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:300ms]" />
                              </span>
                            </span>
                          </div>
                        </div>
                      </article>
                    ))}
                  </>
                );
              })()
            )}
            <div ref={bottomSentinelRef} aria-hidden="true" />
          </div>

          <button
            onClick={scrollToAgentBottom}
            className={`hcai-agent-scroll-bottom-button ${
              !isScrolledToBottom && activeMessages.length > 0
                ? 'is-visible'
                : ''
            }`}
            aria-label="滚动到底部">
            <ArrowDownIcon className="h-5 w-5" />
          </button>
        </section>
      </div>
    </>
  );
}
