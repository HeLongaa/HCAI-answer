/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import {
  ChangeEvent,
  ClipboardEvent,
  FC,
  FormEvent,
  useCallback,
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Modal, Spinner } from 'react-bootstrap';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import dayjs from 'dayjs';
import { v4 as uuidv4 } from 'uuid';

import { Avatar, Icon, htmlRender } from '@/components';
import { CHAT_WORKSPACE_STORAGE_KEY } from '@/common/constants';
import { usePageTags } from '@/hooks';
import {
  getAiChatModels,
  getAiSubscriptionOverview,
  getConversationDetail,
  getConversationList,
  deleteConversationRecord,
  markdownToHtml,
  redeemAiSubscriptionCode,
  switchConversationBranch,
} from '@/services';
import { brandingStore, loggedUserInfoStore, siteInfoStore } from '@/stores';
import requestAi, { cancelCurrentRequest } from '@/utils/requestAi';
import Storage from '@/utils/storage';
import type {
  AiChatModel,
  AiSubscriptionOverview,
  ConversationDetailItem,
  ConversationListItem,
} from '@/common/interface';

import ImageGenerationWorkspace from './ImageGenerationWorkspace';
import VideoGenerationWorkspace from './VideoGenerationWorkspace';
import './index.scss';

const navItems = [
  { icon: 'pencil-square', label: '聊天', action: 'new' },
  { icon: 'image', label: '图片生成', action: 'image' },
  { icon: 'camera-reels', label: '视频生成', action: 'video' },
  { icon: 'credit-card-2-front', label: '订阅管理', action: 'subscription' },
  { icon: 'stars', label: '订阅兑换', action: 'redeem' },
];

type ChatWorkspace = 'chat' | 'image' | 'video';

const getStoredWorkspace = () =>
  Storage.get(CHAT_WORKSPACE_STORAGE_KEY) === 'image' ||
  Storage.get(CHAT_WORKSPACE_STORAGE_KEY) === 'video'
    ? (Storage.get(CHAT_WORKSPACE_STORAGE_KEY) as ChatWorkspace)
    : 'chat';

const getWorkspaceFromSearchParams = (params: URLSearchParams) =>
  params.get('workspace') === 'image' || params.get('workspace') === 'video'
    ? (params.get('workspace') as ChatWorkspace)
    : undefined;

const formatQuota = (value?: number) => {
  if (value === -1) {
    return '无限制';
  }
  return Number(value || 0).toLocaleString();
};

const formatDateTime = (value?: number) => {
  if (!value) {
    return '-';
  }
  return dayjs(value * 1000).format('YYYY/M/D HH:mm:ss');
};

const formatSubscriptionDateTime = (value?: number) => {
  if (!value) {
    return '永久';
  }
  return formatDateTime(value);
};

const getProgressWidth = (used = 0, total = 0) => {
  if (total <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(100, (used / total) * 100));
};

const getModelName = (model?: AiChatModel) => {
  if (!model) {
    return '选择模型';
  }
  return model.display_name || model.site_model_id;
};

const maxPromptImages = 4;
const maxPromptImageSize = 5 * 1024 * 1024;
const maxPromptFiles = 5;
const maxPromptFileSize = 10 * 1024 * 1024;
const supportedBinaryFileExtensions = ['pdf', 'docx', 'xlsx', 'pptx'];
const reasoningEffortOptions = [
  { value: '', label: '自动' },
  { value: 'high', label: '高' },
  { value: 'medium', label: '中' },
  { value: 'low', label: '低' },
];

const getReasoningEffortLabel = (value?: string) =>
  reasoningEffortOptions.find((option) => option.value === value)?.label ||
  '自动';

const supportsReasoningModel = (model?: AiChatModel) =>
  /\b(gpt|o\d|o-|o_)/i.test(
    `${model?.site_model_id || ''} ${model?.display_name || ''}`,
  );

interface PromptImage {
  id: string;
  name: string;
  url: string;
}

interface PromptFile {
  id: string;
  name: string;
  type: string;
  size: number;
  content: string;
  data?: string;
}

interface MessageBranchState {
  active: number;
  responses: ConversationDetailItem[];
}

const readFileAsDataURL = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const readFileAsText = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });

const isTextLikeFile = (file: File) => {
  if (file.type.startsWith('text/')) {
    return true;
  }
  return /\.(csv|json|md|markdown|txt|log|yaml|yml|xml|html|css|scss|js|jsx|ts|tsx|go|py|java|rb|php|rs|sql|sh|env)$/i.test(
    file.name,
  );
};

const getFileExtension = (name: string) =>
  name.split('.').pop()?.toLowerCase() || '';

const isSupportedBinaryFile = (file: File) =>
  supportedBinaryFileExtensions.includes(getFileExtension(file.name));

const isSupportedPromptFile = (file: File) =>
  isTextLikeFile(file) || isSupportedBinaryFile(file);

const escapeHtml = (text: string) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const renderPlainTextAsHtml = (text: string) =>
  escapeHtml(text).replace(/\n/g, '<br />');

const removeHtmlBlankLines = (html: string) =>
  html
    .replace(/<p>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>/gi, '')
    .replace(/(?:<br\s*\/?>\s*){2,}/gi, '<br />');

const normalizeMessageContent = (text: string) =>
  text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const ChatMessageContent: FC<{ content: string; markdown: boolean }> = memo(
  ({ content, markdown }) => {
    const contentRef = useRef<HTMLDivElement>(null);
    const [html, setHtml] = useState('');
    const normalizedContent = useMemo(
      () => normalizeMessageContent(content),
      [content],
    );

    useEffect(() => {
      let cancelled = false;

      if (!normalizedContent) {
        setHtml('');
        return undefined;
      }

      if (!markdown) {
        setHtml(renderPlainTextAsHtml(normalizedContent));
        return undefined;
      }

      setHtml(renderPlainTextAsHtml(normalizedContent));
      markdownToHtml(normalizedContent)
        .then((resp) => {
          if (!cancelled) {
            setHtml(
              removeHtmlBlankLines(
                resp || renderPlainTextAsHtml(normalizedContent),
              ),
            );
          }
        })
        .catch(() => {
          if (!cancelled) {
            setHtml(renderPlainTextAsHtml(normalizedContent));
          }
        });

      return () => {
        cancelled = true;
      };
    }, [normalizedContent, markdown]);

    useEffect(() => {
      if (markdown && html) {
        htmlRender(contentRef.current, {
          copyText: '复制代码',
          copySuccessText: '已复制',
        });
      }
    }, [html, markdown]);

    return (
      <div
        ref={contentRef}
        className={`hcai-message-rendered ${markdown ? 'fmt text-break text-wrap' : ''}`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  },
);

const Chat: FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const siteInfo = siteInfoStore((state) => state.siteInfo);
  const brandingInfo = brandingStore((state) => state.branding);
  const loggedUser = loggedUserInfoStore((state) => state.user);
  const [conversationsOpen, setConversationsOpen] = useState(true);
  const [activeWorkspace, setActiveWorkspace] = useState<ChatWorkspace>(
    () => getWorkspaceFromSearchParams(searchParams) || getStoredWorkspace(),
  );
  const [subscriptionOpen, setSubscriptionOpen] = useState(false);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState('');
  const [subscription, setSubscription] =
    useState<AiSubscriptionOverview | null>(null);
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [redeemCode, setRedeemCode] = useState('');
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [redeemError, setRedeemError] = useState('');
  const [redeemSuccess, setRedeemSuccess] = useState('');
  const [models, setModels] = useState<AiChatModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [selectedModelID, setSelectedModelID] = useState('');
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [reasoningMenuModelID, setReasoningMenuModelID] = useState('');
  const [conversationList, setConversationList] = useState<
    ConversationListItem[]
  >([]);
  const [conversationID, setConversationID] = useState('');
  const [messages, setMessages] = useState<ConversationDetailItem[]>([]);
  const [messageBranches, setMessageBranches] = useState<
    Record<string, MessageBranchState>
  >({});
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [chatError, setChatError] = useState('');
  const [copiedMessageKey, setCopiedMessageKey] = useState('');
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [promptImages, setPromptImages] = useState<PromptImage[]>([]);
  const [promptFiles, setPromptFiles] = useState<PromptFile[]>([]);
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [modelReasoningEfforts, setModelReasoningEfforts] = useState<
    Record<string, string>
  >({});
  const modelMenuRef = useRef<HTMLDivElement | null>(null);
  const attachmentMenuRef = useRef<HTMLDivElement | null>(null);
  const workspaceRef = useRef<HTMLElement | null>(null);
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const scrollBottomFrameRef = useRef<number | null>(null);
  const scrollBottomTimerRefs = useRef<number[]>([]);
  const scrollVisibilityFrameRef = useRef<number | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const selectedModel = useMemo(
    () => models.find((model) => model.site_model_id === selectedModelID),
    [models, selectedModelID],
  );
  const selectedModelSupportsVision = Boolean(selectedModel?.supports_vision);
  const selectedModelSupportsReasoning = supportsReasoningModel(selectedModel);
  const selectedReasoningEffort = selectedModelID
    ? modelReasoningEfforts[selectedModelID] || ''
    : '';
  const siteIcon =
    brandingInfo.square_icon ||
    brandingInfo.favicon ||
    brandingInfo.mobile_logo ||
    brandingInfo.logo;

  const switchWorkspace = useCallback(
    (workspace: ChatWorkspace) => {
      setActiveWorkspace(workspace);
      const nextSearchParams = new URLSearchParams(window.location.search);
      if (workspace === 'image' || workspace === 'video') {
        Storage.set(CHAT_WORKSPACE_STORAGE_KEY, workspace);
        nextSearchParams.set('workspace', workspace);
      } else {
        Storage.remove(CHAT_WORKSPACE_STORAGE_KEY);
        nextSearchParams.delete('workspace');
      }
      setSearchParams(nextSearchParams, { replace: true });
    },
    [setSearchParams],
  );

  usePageTags({
    title: 'HCAI-Chat',
  });

  const refreshSubscription = async () => {
    const data = await getAiSubscriptionOverview();
    setSubscription(data);
  };

  const refreshConversations = async () => {
    const data = await getConversationList({ page: 1, page_size: 30 });
    setConversationList(data.list || []);
  };

  const applyConversationRecords = (records: ConversationDetailItem[]) => {
    const nextMessages: ConversationDetailItem[] = [];
    const nextBranches: Record<string, MessageBranchState> = {};
    records.forEach((record) => {
      if (record.role === 'assistant' && record.parent_message_id) {
        const branch = nextBranches[record.parent_message_id] || {
          active: 0,
          responses: [],
        };
        branch.responses.push(record);
        if (record.active) {
          branch.active = branch.responses.length - 1;
        }
        nextBranches[record.parent_message_id] = branch;
        return;
      }
      nextMessages.push(record);
    });
    setMessages(nextMessages);
    setMessageBranches(nextBranches);
  };

  const scrollMessagesToBottom = useCallback(
    (behavior: ScrollBehavior = 'auto') => {
      if (scrollBottomFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollBottomFrameRef.current);
        scrollBottomFrameRef.current = null;
      }
      scrollBottomTimerRefs.current.forEach((timer) => {
        window.clearTimeout(timer);
      });
      scrollBottomTimerRefs.current = [];

      const scroll = () => {
        const container = workspaceRef.current;
        if (container) {
          container.scrollTo({
            top: container.scrollHeight,
            behavior,
          });
        } else {
          messageEndRef.current?.scrollIntoView({
            block: 'end',
            behavior,
          });
        }
        setShowScrollToBottom((visible) => (visible ? false : visible));
      };

      scrollBottomFrameRef.current = window.requestAnimationFrame(() => {
        scrollBottomFrameRef.current = null;
        scroll();
      });
      if (behavior === 'auto') {
        scrollBottomTimerRefs.current = [
          window.setTimeout(scroll, 160),
          window.setTimeout(scroll, 420),
        ];
      }
    },
    [],
  );

  const updateScrollToBottomVisibility = useCallback(() => {
    if (scrollVisibilityFrameRef.current !== null) {
      return;
    }

    scrollVisibilityFrameRef.current = window.requestAnimationFrame(() => {
      scrollVisibilityFrameRef.current = null;
      const container = workspaceRef.current;
      if (!container) {
        setShowScrollToBottom(false);
        return;
      }
      const distanceFromBottom =
        container.scrollHeight - container.clientHeight - container.scrollTop;
      const shouldShow = messages.length > 0 && distanceFromBottom > 72;
      setShowScrollToBottom((visible) =>
        visible === shouldShow ? visible : shouldShow,
      );
    });
  }, [messages.length]);

  const refreshModels = async () => {
    setModelsLoading(true);
    try {
      const data = await getAiChatModels();
      setModels(data || []);
      setSelectedModelID(
        (current) => current || data?.[0]?.site_model_id || '',
      );
    } finally {
      setModelsLoading(false);
    }
  };

  const openSubscription = async () => {
    setSubscriptionOpen(true);
    setSubscriptionLoading(true);
    setSubscriptionError('');
    try {
      await refreshSubscription();
    } catch (err: any) {
      setSubscriptionError(err?.msg || '订阅信息加载失败');
    } finally {
      setSubscriptionLoading(false);
    }
  };

  const openRedeem = () => {
    setRedeemError('');
    setRedeemSuccess('');
    setRedeemOpen(true);
  };

  const startNewConversation = () => {
    if (isGenerating) {
      cancelCurrentRequest();
    }
    switchWorkspace('chat');
    setConversationID('');
    setMessages([]);
    setMessageBranches({});
    setPrompt('');
    setPromptImages([]);
    setPromptFiles([]);
    setAttachmentMenuOpen(false);
    setChatError('');
    setIsGenerating(false);
  };

  const loadConversation = async (id: string) => {
    if (isGenerating) {
      cancelCurrentRequest();
      setIsGenerating(false);
    }
    setChatError('');
    setConversationID(id);
    setMessageBranches({});
    const data = await getConversationDetail(id);
    applyConversationRecords(data.records || []);
    scrollMessagesToBottom();
  };

  const handleLoadConversation = async (id: string) => {
    switchWorkspace('chat');
    await loadConversation(id);
  };

  const refreshCurrentConversation = async (id = conversationID) => {
    if (!id) {
      return;
    }
    const data = await getConversationDetail(id);
    applyConversationRecords(data.records || []);
  };

  useEffect(() => {
    refreshModels();
    refreshSubscription().catch(() => undefined);
    refreshConversations().catch(() => undefined);
  }, []);

  useEffect(() => {
    const urlWorkspace = getWorkspaceFromSearchParams(searchParams);
    if (urlWorkspace) {
      Storage.set(CHAT_WORKSPACE_STORAGE_KEY, urlWorkspace);
      setActiveWorkspace(urlWorkspace);
      return;
    }

    const storedWorkspace = getStoredWorkspace();
    if (storedWorkspace === 'image' || storedWorkspace === 'video') {
      const nextSearchParams = new URLSearchParams(searchParams);
      nextSearchParams.set('workspace', storedWorkspace);
      setSearchParams(nextSearchParams, { replace: true });
      setActiveWorkspace(storedWorkspace);
      return;
    }

    setActiveWorkspace('chat');
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!modelMenuOpen && !attachmentMenuOpen) {
      return undefined;
    }
    const handlePointerDown = (evt: PointerEvent) => {
      if (
        attachmentMenuRef.current &&
        !attachmentMenuRef.current.contains(evt.target as Node)
      ) {
        setAttachmentMenuOpen(false);
      }
      if (
        modelMenuRef.current &&
        !modelMenuRef.current.contains(evt.target as Node)
      ) {
        setModelMenuOpen(false);
        setReasoningMenuModelID('');
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [attachmentMenuOpen, modelMenuOpen]);

  useEffect(() => {
    if (messages.length > 0) {
      scrollMessagesToBottom();
    }
  }, [
    conversationID,
    isGenerating,
    messageBranches,
    messages,
    scrollMessagesToBottom,
  ]);

  useEffect(() => {
    const container = workspaceRef.current;
    updateScrollToBottomVisibility();
    container?.addEventListener('scroll', updateScrollToBottomVisibility, {
      passive: true,
    });
    window.addEventListener('resize', updateScrollToBottomVisibility);
    return () => {
      container?.removeEventListener('scroll', updateScrollToBottomVisibility);
      window.removeEventListener('resize', updateScrollToBottomVisibility);
      if (scrollVisibilityFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollVisibilityFrameRef.current);
        scrollVisibilityFrameRef.current = null;
      }
    };
  }, [updateScrollToBottomVisibility]);

  useEffect(() => {
    return () => {
      if (scrollBottomFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollBottomFrameRef.current);
        scrollBottomFrameRef.current = null;
      }
      scrollBottomTimerRefs.current.forEach((timer) => {
        window.clearTimeout(timer);
      });
      scrollBottomTimerRefs.current = [];
    };
  }, []);

  useEffect(() => {
    if (!messages.length || !messageListRef.current) {
      return undefined;
    }
    const resizeObserver = new ResizeObserver(() => {
      scrollMessagesToBottom();
    });
    resizeObserver.observe(messageListRef.current);
    return () => {
      resizeObserver.disconnect();
    };
  }, [messages.length, scrollMessagesToBottom]);

  useEffect(() => {
    const handleOpenSubscription = () => {
      openSubscription();
    };
    const handleOpenRedeem = () => {
      openRedeem();
    };
    const handleStartNewConversation = () => {
      startNewConversation();
    };
    const handleOpenImageGeneration = () => {
      switchWorkspace('image');
    };
    const handleOpenVideoGeneration = () => {
      switchWorkspace('video');
    };
    const handleLoadConversationFromNav = (evt: Event) => {
      const conversationId = (evt as CustomEvent<{ conversation_id?: string }>)
        .detail?.conversation_id;
      if (conversationId) {
        handleLoadConversation(conversationId).catch(() => undefined);
      }
    };
    window.addEventListener('hcai-open-subscription', handleOpenSubscription);
    window.addEventListener('hcai-open-redeem', handleOpenRedeem);
    window.addEventListener(
      'hcai-start-new-conversation',
      handleStartNewConversation,
    );
    window.addEventListener(
      'hcai-open-image-generation',
      handleOpenImageGeneration,
    );
    window.addEventListener(
      'hcai-open-video-generation',
      handleOpenVideoGeneration,
    );
    window.addEventListener(
      'hcai-load-conversation',
      handleLoadConversationFromNav,
    );
    return () => {
      window.removeEventListener(
        'hcai-open-subscription',
        handleOpenSubscription,
      );
      window.removeEventListener('hcai-open-redeem', handleOpenRedeem);
      window.removeEventListener(
        'hcai-start-new-conversation',
        handleStartNewConversation,
      );
      window.removeEventListener(
        'hcai-open-image-generation',
        handleOpenImageGeneration,
      );
      window.removeEventListener(
        'hcai-open-video-generation',
        handleOpenVideoGeneration,
      );
      window.removeEventListener(
        'hcai-load-conversation',
        handleLoadConversationFromNav,
      );
    };
  }, [switchWorkspace]);

  const handleNavAction = (action: string) => {
    if (action === 'new') {
      startNewConversation();
    }
    if (action === 'image') {
      switchWorkspace('image');
    }
    if (action === 'video') {
      switchWorkspace('video');
    }
    if (action === 'subscription') {
      openSubscription();
    }
    if (action === 'redeem') {
      openRedeem();
    }
  };

  const getMessageKey = (item: ConversationDetailItem) =>
    item.message_id ||
    `${item.chat_completion_id}-${item.role}-${item.created_at}`;

  const findMessageIndex = (target: ConversationDetailItem) =>
    messages.findIndex((item) => getMessageKey(item) === getMessageKey(target));

  const writeClipboardText = async (text: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // Fall back for browsers that deny async clipboard permission.
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);
    return copied;
  };

  const copyMessage = async (item: ConversationDetailItem) => {
    const key = getMessageKey(item);
    const copied = await writeClipboardText(item.content);
    if (!copied) {
      setChatError('复制失败，请检查浏览器剪贴板权限');
      return;
    }
    setCopiedMessageKey(key);
    window.setTimeout(() => {
      setCopiedMessageKey((current) => (current === key ? '' : current));
    }, 1200);
  };

  const deleteMessage = async (
    item: ConversationDetailItem,
    branchKey?: string,
    branchIndex?: number,
  ) => {
    if (item.message_id && conversationID) {
      try {
        await deleteConversationRecord({
          conversation_id: conversationID,
          message_id: item.message_id,
        });
        await refreshCurrentConversation();
        return;
      } catch (err: any) {
        setChatError(err?.msg || '删除失败，请稍后重试');
        return;
      }
    }
    if (branchKey && typeof branchIndex === 'number') {
      setMessageBranches((prev) => {
        const branch = prev[branchKey];
        if (!branch) {
          return prev;
        }
        const responses = branch.responses.filter(
          (_, index) => index !== branchIndex,
        );
        const next = { ...prev };
        if (responses.length === 0) {
          delete next[branchKey];
          return next;
        }
        next[branchKey] = {
          responses,
          active: Math.min(branch.active, responses.length - 1),
        };
        return next;
      });
      return;
    }

    const index = findMessageIndex(item);
    if (index < 0) {
      return;
    }
    if (item.role === 'user') {
      setMessageBranches((prev) => {
        const next = { ...prev };
        delete next[getMessageKey(item)];
        return next;
      });
      setMessages((prev) =>
        prev.filter((message, messageIndex) => {
          if (messageIndex === index) {
            return false;
          }
          return !(
            messageIndex === index + 1 &&
            prev[messageIndex]?.role === 'assistant'
          );
        }),
      );
      return;
    }
    setMessages((prev) =>
      prev.filter((message) => getMessageKey(message) !== getMessageKey(item)),
    );
  };

  const switchBranch = async (branchKey: string, direction: -1 | 1) => {
    const branch = messageBranches[branchKey];
    if (!branch) {
      return;
    }
    const nextActive =
      (branch.active + direction + branch.responses.length) %
      branch.responses.length;
    const targetMessageID = branch.responses[nextActive]?.message_id || '';
    setMessageBranches((prev) => {
      return {
        ...prev,
        [branchKey]: {
          ...branch,
          active: nextActive,
        },
      };
    });
    if (conversationID && targetMessageID) {
      try {
        await switchConversationBranch({
          conversation_id: conversationID,
          parent_message_id: branchKey,
          message_id: targetMessageID,
        });
      } catch (err: any) {
        setChatError(err?.msg || '分支切换保存失败');
        refreshCurrentConversation().catch(() => undefined);
      }
    }
  };

  const appendAssistantChunk = (chatCompletionID: string, content = '') => {
    setMessages((prev) => {
      const updated = [...prev];
      const lastMessage = updated[updated.length - 1];
      if (lastMessage?.role === 'assistant') {
        const isSameMessage =
          lastMessage.chat_completion_id === chatCompletionID;
        const isPendingMessage =
          lastMessage.content === '' && !lastMessage.message_id;
        if (!isSameMessage && !isPendingMessage) {
          updated.push({
            chat_completion_id: chatCompletionID,
            role: 'assistant',
            content,
            helpful: 0,
            unhelpful: 0,
            created_at: Math.floor(Date.now() / 1000),
          });
          return updated;
        }
        updated[updated.length - 1] = {
          ...lastMessage,
          chat_completion_id: chatCompletionID,
          content: `${lastMessage.content}${content}`,
        };
        return updated;
      }
      updated.push({
        chat_completion_id: chatCompletionID,
        role: 'assistant',
        content,
        helpful: 0,
        unhelpful: 0,
        created_at: Math.floor(Date.now() / 1000),
      });
      return updated;
    });
  };

  const addPromptImageFiles = async (files: File[]) => {
    const imageFiles = files.filter((file) => file.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      return;
    }
    if (!selectedModelSupportsVision) {
      setChatError('当前模型不支持图片理解，请切换支持图片理解的模型');
      return;
    }
    if (promptImages.length + imageFiles.length > maxPromptImages) {
      setChatError(`最多只能添加 ${maxPromptImages} 张图片`);
      return;
    }
    const oversized = imageFiles.find((file) => file.size > maxPromptImageSize);
    if (oversized) {
      setChatError('单张图片不能超过 5MB');
      return;
    }
    try {
      const images = await Promise.all(
        imageFiles.map(async (file) => ({
          id: `${file.name}-${file.lastModified}-${Math.random()
            .toString(36)
            .slice(2)}`,
          name: file.name,
          url: await readFileAsDataURL(file),
        })),
      );
      setPromptImages((prev) => [...prev, ...images]);
      setChatError('');
    } catch {
      setChatError('图片读取失败，请重新选择');
    }
  };

  const handlePromptPaste = (evt: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(evt.clipboardData?.files || []);
    if (files.some((file) => file.type.startsWith('image/'))) {
      evt.preventDefault();
      addPromptImageFiles(files).catch(() => {
        setChatError('图片读取失败，请重新粘贴');
      });
    }
  };

  const handleImageSelect = (evt: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(evt.target.files || []);
    evt.target.value = '';
    addPromptImageFiles(files).catch(() => {
      setChatError('图片读取失败，请重新选择');
    });
  };

  const addPromptTextFiles = async (files: File[]) => {
    if (files.length === 0) {
      return;
    }
    const unsupportedFile = files.find((file) => !isSupportedPromptFile(file));
    if (unsupportedFile) {
      setChatError('支持文本文件、PDF、Word、Excel、PPT');
      return;
    }
    if (promptFiles.length + files.length > maxPromptFiles) {
      setChatError(`最多只能添加 ${maxPromptFiles} 个文件`);
      return;
    }
    const oversized = files.find((file) => file.size > maxPromptFileSize);
    if (oversized) {
      setChatError('单个文件不能超过 10MB');
      return;
    }
    try {
      const nextFiles = await Promise.all(
        files.map(async (file) => {
          const isTextFile = isTextLikeFile(file);
          return {
            id: `${file.name}-${file.lastModified}-${Math.random()
              .toString(36)
              .slice(2)}`,
            name: file.name,
            type: file.type || 'application/octet-stream',
            size: file.size,
            content: isTextFile ? await readFileAsText(file) : '',
            data: isTextFile ? undefined : await readFileAsDataURL(file),
          };
        }),
      );
      setPromptFiles((prev) => [...prev, ...nextFiles]);
      setChatError('');
    } catch {
      setChatError('文件读取失败，请重新选择');
    }
  };

  const handleFileSelect = (evt: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(evt.target.files || []);
    evt.target.value = '';
    addPromptTextFiles(files).catch(() => {
      setChatError('文件读取失败，请重新选择');
    });
  };

  const removePromptImage = (id: string) => {
    setPromptImages((prev) => prev.filter((image) => image.id !== id));
  };

  const removePromptFile = (id: string) => {
    setPromptFiles((prev) => prev.filter((file) => file.id !== id));
  };

  const resendUserMessage = async (item: ConversationDetailItem) => {
    if (isGenerating || !selectedModelID) {
      return;
    }
    if (item.images?.length && !selectedModelSupportsVision) {
      setChatError('当前模型不支持图片理解，请切换支持图片理解的模型');
      return;
    }
    const userIndex = findMessageIndex(item);
    if (userIndex < 0) {
      return;
    }
    const branchKey = getMessageKey(item);
    const currentConversationID = conversationID || uuidv4();
    const existingAssistant =
      messages[userIndex + 1]?.role === 'assistant'
        ? messages[userIndex + 1]
        : null;
    const nextResponse: ConversationDetailItem = {
      chat_completion_id: `branch-${Date.now()}`,
      role: 'assistant',
      content: '',
      helpful: 0,
      unhelpful: 0,
      created_at: Math.floor(Date.now() / 1000),
    };
    const currentBranch = messageBranches[branchKey];
    const nextResponses = currentBranch
      ? [...currentBranch.responses]
      : existingAssistant
        ? [existingAssistant]
        : [];
    nextResponses.push(nextResponse);
    const activeIndex = nextResponses.length - 1;
    setConversationID(currentConversationID);
    setChatError('');
    setIsGenerating(true);
    setMessageBranches((prev) => {
      return {
        ...prev,
        [branchKey]: {
          responses: nextResponses,
          active: activeIndex,
        },
      };
    });

    await requestAi('/answer/api/v1/chat/completions', {
      body: JSON.stringify({
        conversation_id: currentConversationID,
        model: selectedModelID,
        branch_parent_message_id: item.message_id || '',
        messages: [
          {
            role: 'user',
            content: item.content,
            images: (item.images || []).map((image) => ({ url: image })),
            files: (item.files || []).map((file) => ({
              name: file.name,
              type: file.type || 'text/plain',
              size: file.size || 0,
              content: file.content || '',
            })),
          },
        ],
        reasoning_effort:
          selectedModelSupportsReasoning && selectedReasoningEffort
            ? selectedReasoningEffort
            : undefined,
        stream: true,
      }),
      onMessage: (res) => {
        const chunk = res?.choices?.[0]?.delta?.content;
        if (!chunk) {
          return;
        }
        setMessageBranches((prev) => {
          const branch = prev[branchKey];
          if (!branch) {
            return prev;
          }
          const responses = [...branch.responses];
          responses[activeIndex] = {
            ...responses[activeIndex],
            chat_completion_id: res.chat_completion_id,
            content: `${responses[activeIndex]?.content || ''}${chunk}`,
          };
          return {
            ...prev,
            [branchKey]: {
              ...branch,
              responses,
              active: activeIndex,
            },
          };
        });
      },
      onError: (error: any) => {
        const message = error?.msg || '重发失败，请稍后重试';
        setMessageBranches((prev) => {
          const branch = prev[branchKey];
          if (!branch) {
            return prev;
          }
          const responses = [...branch.responses];
          responses[activeIndex] = {
            ...responses[activeIndex],
            content: message,
          };
          return {
            ...prev,
            [branchKey]: {
              ...branch,
              responses,
              active: activeIndex,
            },
          };
        });
        setChatError(message);
      },
      onComplete: () => {
        setIsGenerating(false);
        refreshConversations().catch(() => undefined);
        refreshSubscription().catch(() => undefined);
      },
    }).catch((err) => {
      setIsGenerating(false);
      if (err) {
        setChatError(err?.msg || '重发失败，请稍后重试');
      }
    });
  };

  const sendMessage = async (message: string) => {
    const content = message.trim();
    const images = promptImages;
    const files = promptFiles;
    if (
      (!content && images.length === 0 && files.length === 0) ||
      isGenerating
    ) {
      return;
    }
    if (!selectedModelID) {
      setChatError('请先选择可用模型');
      return;
    }
    if (images.length > 0 && !selectedModelSupportsVision) {
      setChatError('当前模型不支持图片理解，请切换支持图片理解的模型');
      return;
    }
    const currentConversationID = conversationID || uuidv4();
    const userMessageID = `local-${Date.now()}`;
    const assistantMessageID = `pending-${Date.now()}`;
    setConversationID(currentConversationID);
    setPrompt('');
    setPromptImages([]);
    setPromptFiles([]);
    setAttachmentMenuOpen(false);
    setChatError('');
    setIsGenerating(true);
    setMessages((prev) => [
      ...prev,
      {
        chat_completion_id: userMessageID,
        role: 'user',
        content,
        images: images.map((image) => image.url),
        files: files.map((file) => ({
          name: file.name,
          type: file.type,
          size: file.size,
        })),
        helpful: 0,
        unhelpful: 0,
        created_at: Math.floor(Date.now() / 1000),
      },
      {
        chat_completion_id: assistantMessageID,
        role: 'assistant',
        content: '',
        helpful: 0,
        unhelpful: 0,
        created_at: Math.floor(Date.now() / 1000),
      },
    ]);

    await requestAi('/answer/api/v1/chat/completions', {
      body: JSON.stringify({
        conversation_id: currentConversationID,
        model: selectedModelID,
        messages: [
          {
            role: 'user',
            content,
            images: images.map((image) => ({ url: image.url })),
            files: files.map((file) => ({
              name: file.name,
              type: file.type,
              size: file.size,
              content: file.content,
              data: file.data,
            })),
          },
        ],
        reasoning_effort:
          selectedModelSupportsReasoning && selectedReasoningEffort
            ? selectedReasoningEffort
            : undefined,
        stream: true,
      }),
      onMessage: (res) => {
        const chunk = res?.choices?.[0]?.delta?.content;
        const role = res?.choices?.[0]?.delta?.role;
        if (role === 'assistant' || chunk) {
          appendAssistantChunk(res.chat_completion_id, chunk || '');
        }
      },
      onError: (error: any) => {
        const errorMessage = error?.msg || '发送失败，请稍后重试';
        appendAssistantChunk(assistantMessageID, errorMessage);
        setChatError(errorMessage);
      },
      onComplete: () => {
        setIsGenerating(false);
        refreshConversations().catch(() => undefined);
        refreshSubscription().catch(() => undefined);
      },
    }).catch((err) => {
      setIsGenerating(false);
      if (err) {
        setChatError(err?.msg || '发送失败，请稍后重试');
      }
    });
  };

  const handleSubmit = (evt: FormEvent) => {
    evt.preventDefault();
    sendMessage(prompt);
  };

  const handleRedeemSubmit = async (evt: FormEvent) => {
    evt.preventDefault();
    const code = redeemCode.trim();
    if (!code) {
      setRedeemError('请输入兑换码');
      return;
    }
    setRedeemLoading(true);
    setRedeemError('');
    setRedeemSuccess('');
    try {
      const resp = await redeemAiSubscriptionCode({ code });
      setRedeemSuccess(
        `${resp.plan_name} 兑换成功，到期时间 ${formatDateTime(
          resp.expires_at,
        )}`,
      );
      setRedeemCode('');
      await refreshSubscription();
      window.dispatchEvent(new CustomEvent('hcai-subscription-updated'));
      await refreshModels();
    } catch (err: any) {
      setRedeemError(err?.msg || '兑换失败');
    } finally {
      setRedeemLoading(false);
    }
  };

  const handleCancel = () => {
    if (cancelCurrentRequest()) {
      setIsGenerating(false);
    }
  };

  const goSubscriptionPurchase = () => {
    setSubscriptionOpen(false);
    navigate('/subscription');
  };

  const renderMessage = (
    item: ConversationDetailItem,
    options?: {
      branchKey?: string;
      branchIndex?: number;
      branchCount?: number;
    },
  ) => {
    const messageKey = getMessageKey(item);
    const isUser = item.role === 'user';
    const isStreamingAssistant = !isUser && isGenerating && !item.message_id;
    const isPendingAssistant = isStreamingAssistant && item.content === '';
    return (
      <article className={`hcai-message ${item.role}`} key={messageKey}>
        <div className="hcai-message-avatar">
          {isUser ? (
            <Avatar
              avatar={loggedUser.avatar}
              size="34px"
              searchStr="s=68"
              alt={loggedUser.display_name || loggedUser.username}
            />
          ) : siteIcon ? (
            <img src={siteIcon} alt={siteInfo.name} />
          ) : (
            siteInfo.name.slice(0, 1)
          )}
        </div>
        <div className="hcai-message-body">
          <div className="hcai-message-meta">
            <span>
              {isUser
                ? loggedUser.display_name || loggedUser.username
                : getModelName(selectedModel)}
            </span>
          </div>
          <div className="hcai-message-content">
            {isPendingAssistant ? (
              <div className="hcai-message-pending">
                <Spinner size="sm" animation="border" />
                <span>正在生成</span>
              </div>
            ) : (
              <ChatMessageContent
                content={item.content}
                markdown={!isUser && !isStreamingAssistant}
              />
            )}
            {item.images?.length ? (
              <div className="hcai-message-images">
                {item.images.map((image, index) => (
                  <img
                    src={image}
                    alt={`uploaded-${index + 1}`}
                    key={`${messageKey}-${image.slice(0, 80)}`}
                  />
                ))}
              </div>
            ) : null}
            {item.files?.length ? (
              <div className="hcai-message-files">
                {item.files.map((file) => (
                  <span key={`${messageKey}-${file.name}`}>
                    <Icon name="file-earmark-text" />
                    {file.name}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          {!isPendingAssistant ? (
            <div className="hcai-message-actions">
              <button
                type="button"
                aria-label="复制消息"
                title="复制"
                onClick={() => copyMessage(item)}>
                <Icon
                  name={
                    copiedMessageKey === messageKey ? 'check2' : 'clipboard'
                  }
                />
              </button>
              {isUser ? (
                <button
                  type="button"
                  aria-label="重发消息"
                  title="重发"
                  disabled={isGenerating}
                  onClick={() => resendUserMessage(item)}>
                  <Icon name="arrow-repeat" />
                </button>
              ) : null}
              <button
                type="button"
                aria-label="删除消息"
                title="删除"
                disabled={isGenerating}
                onClick={() =>
                  deleteMessage(item, options?.branchKey, options?.branchIndex)
                }>
                <Icon name="trash" />
              </button>
              {!isUser &&
              options?.branchKey &&
              (options.branchCount || 0) > 1 ? (
                <div className="hcai-branch-switch">
                  <button
                    type="button"
                    aria-label="上一条分支"
                    onClick={() => switchBranch(options.branchKey || '', -1)}>
                    <Icon name="chevron-left" />
                  </button>
                  <span>
                    {(options.branchIndex || 0) + 1}/{options.branchCount}
                  </span>
                  <button
                    type="button"
                    aria-label="下一条分支"
                    onClick={() => switchBranch(options.branchKey || '', 1)}>
                    <Icon name="chevron-right" />
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </article>
    );
  };

  return (
    <div className={`hcai-chat-shell hcai-chat-page-${activeWorkspace}`}>
      <aside className="hcai-chat-sidebar" aria-label="HCAI-Chat navigation">
        <Link to="/" className="hcai-chat-site-brand">
          {brandingInfo.mobile_logo || brandingInfo.logo ? (
            <img
              className="hcai-chat-site-logo"
              src={brandingInfo.mobile_logo || brandingInfo.logo}
              alt={siteInfo.name}
            />
          ) : (
            <span className="hcai-chat-site-mark">
              {siteInfo.name.slice(0, 1)}
            </span>
          )}
          <span className="hcai-chat-site-name">{siteInfo.name}</span>
        </Link>

        <nav className="hcai-chat-nav">
          {navItems.map((item) => (
            <button
              type="button"
              className={
                (item.action === 'new' &&
                  activeWorkspace === 'chat' &&
                  !conversationID) ||
                (item.action === 'image' && activeWorkspace === 'image') ||
                (item.action === 'video' && activeWorkspace === 'video')
                  ? 'active'
                  : ''
              }
              key={item.label}
              onClick={() => handleNavAction(item.action)}>
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {activeWorkspace === 'chat' ? (
          <div className="hcai-chat-sidebar-section">
            <button
              type="button"
              className="hcai-chat-sidebar-toggle"
              aria-expanded={conversationsOpen}
              aria-controls="hcai-chat-conversations"
              onClick={() => setConversationsOpen((open) => !open)}>
              <Icon
                name={conversationsOpen ? 'chevron-down' : 'chevron-right'}
              />
              <span>对话</span>
            </button>
            {conversationsOpen ? (
              <div
                id="hcai-chat-conversations"
                className="hcai-conversation-list">
                <span className="hcai-chat-time">最近对话</span>
                {conversationList.length > 0 ? (
                  conversationList.map((item) => (
                    <button
                      type="button"
                      className={
                        item.conversation_id === conversationID
                          ? 'hcai-conversation-item active'
                          : 'hcai-conversation-item'
                      }
                      key={item.conversation_id}
                      onClick={() =>
                        handleLoadConversation(item.conversation_id)
                      }>
                      {item.topic}
                    </button>
                  ))
                ) : (
                  <span className="hcai-chat-empty">暂无对话</span>
                )}
              </div>
            ) : null}
          </div>
        ) : (
          <div
            id={
              activeWorkspace === 'image'
                ? 'hcai-sidebar-image-tasks'
                : 'hcai-sidebar-video-tasks'
            }
            className="hcai-chat-sidebar-section hcai-chat-sidebar-task-section"
          />
        )}
      </aside>

      <div className="hcai-chat-page">
        <main className="hcai-chat-main">
          {activeWorkspace === 'image' ? (
            <ImageGenerationWorkspace
              subscription={subscription}
              onRefreshSubscription={refreshSubscription}
              onOpenSubscription={openSubscription}
            />
          ) : activeWorkspace === 'video' ? (
            <VideoGenerationWorkspace
              subscription={subscription}
              onRefreshSubscription={refreshSubscription}
              onOpenSubscription={openSubscription}
            />
          ) : (
            <section
              ref={messages.length > 0 ? workspaceRef : undefined}
              className={
                messages.length > 0
                  ? 'hcai-chat-workspace active'
                  : 'hcai-chat-hero'
              }>
              {messages.length > 0 ? (
                <div className="hcai-message-list" ref={messageListRef}>
                  {messages.map((item, index) => {
                    if (
                      item.role === 'assistant' &&
                      messages[index - 1]?.role === 'user' &&
                      messageBranches[getMessageKey(messages[index - 1])]
                    ) {
                      return null;
                    }
                    if (item.role !== 'user') {
                      return renderMessage(item);
                    }
                    const branchKey = getMessageKey(item);
                    const branch = messageBranches[branchKey];
                    const activeBranch = branch?.responses[branch.active];
                    return (
                      <div className="hcai-message-turn" key={branchKey}>
                        {renderMessage(item)}
                        {activeBranch
                          ? renderMessage(activeBranch, {
                              branchKey,
                              branchIndex: branch.active,
                              branchCount: branch.responses.length,
                            })
                          : null}
                      </div>
                    );
                  })}
                  <div className="hcai-message-end" ref={messageEndRef} />
                </div>
              ) : (
                <div className="hcai-chat-title">
                  <span className="hcai-chat-logo">
                    {siteIcon ? (
                      <img src={siteIcon} alt={siteInfo.name} />
                    ) : (
                      siteInfo.name.slice(0, 1)
                    )}
                  </span>
                  <h1>HCAI-CHAT</h1>
                </div>
              )}
            </section>
          )}

          {activeWorkspace === 'chat' && showScrollToBottom ? (
            <button
              type="button"
              className="hcai-scroll-bottom"
              aria-label="回到底部"
              title="回到底部"
              onClick={() => scrollMessagesToBottom('smooth')}>
              <Icon name="chevron-down" />
            </button>
          ) : null}

          {activeWorkspace === 'chat' ? (
            <form className="hcai-prompt-card" onSubmit={handleSubmit}>
              <textarea
                value={prompt}
                placeholder="有什么我能帮您的吗?"
                aria-label="聊天输入"
                rows={1}
                disabled={isGenerating}
                onChange={(evt) => setPrompt(evt.target.value)}
                onPaste={handlePromptPaste}
                onKeyDown={(evt) => {
                  if (evt.key === 'Enter' && !evt.shiftKey) {
                    evt.preventDefault();
                    sendMessage(prompt);
                  }
                }}
              />
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hcai-image-input"
                onChange={handleImageSelect}
              />
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".txt,.md,.markdown,.csv,.json,.log,.yaml,.yml,.xml,.html,.css,.scss,.js,.jsx,.ts,.tsx,.go,.py,.java,.rb,.php,.rs,.sql,.sh,.env,.pdf,.docx,.xlsx,.pptx,text/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                className="hcai-image-input"
                onChange={handleFileSelect}
              />
              {promptImages.length > 0 ? (
                <div className="hcai-prompt-images">
                  {promptImages.map((image) => (
                    <div className="hcai-prompt-image" key={image.id}>
                      <img src={image.url} alt={image.name || '上传图片'} />
                      <button
                        type="button"
                        aria-label="移除图片"
                        onClick={() => removePromptImage(image.id)}>
                        <Icon name="x" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
              {promptFiles.length > 0 ? (
                <div className="hcai-prompt-files">
                  {promptFiles.map((file) => (
                    <div className="hcai-prompt-file" key={file.id}>
                      <Icon name="file-earmark-text" />
                      <span>{file.name}</span>
                      <button
                        type="button"
                        aria-label="移除文件"
                        onClick={() => removePromptFile(file.id)}>
                        <Icon name="x" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
              {chatError ? (
                <div className="hcai-chat-error">{chatError}</div>
              ) : null}
              <div className="hcai-prompt-tools">
                <div className="hcai-prompt-left">
                  <div className="hcai-attachment-menu" ref={attachmentMenuRef}>
                    <button
                      type="button"
                      aria-label="添加附件"
                      title="添加附件"
                      disabled={isGenerating}
                      onClick={() => setAttachmentMenuOpen((open) => !open)}>
                      <Icon name="plus-lg" />
                    </button>
                    {attachmentMenuOpen ? (
                      <div className="hcai-attachment-options">
                        <button
                          type="button"
                          disabled={!selectedModelSupportsVision}
                          onClick={() => {
                            setAttachmentMenuOpen(false);
                            imageInputRef.current?.click();
                          }}>
                          <Icon name="image" />
                          <span>上传图片</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAttachmentMenuOpen(false);
                            fileInputRef.current?.click();
                          }}>
                          <Icon name="paperclip" />
                          <span>上传文件</span>
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="hcai-prompt-right">
                  <div className="hcai-model-menu" ref={modelMenuRef}>
                    <button
                      type="button"
                      className="hcai-model-select"
                      disabled={modelsLoading || models.length === 0}
                      onClick={() => {
                        setModelMenuOpen((open) => {
                          if (open) {
                            setReasoningMenuModelID('');
                          }
                          return !open;
                        });
                      }}>
                      <span>
                        {modelsLoading
                          ? '加载模型...'
                          : getModelName(selectedModel)}
                      </span>
                      {selectedModelSupportsReasoning ? (
                        <em>
                          {getReasoningEffortLabel(selectedReasoningEffort)}
                        </em>
                      ) : null}
                      <Icon name="chevron-down" />
                    </button>
                    {modelMenuOpen ? (
                      <div className="hcai-model-options">
                        {models.map((model) => {
                          const modelSupportsReasoning =
                            supportsReasoningModel(model);
                          const modelReasoningEffort =
                            modelReasoningEfforts[model.site_model_id] || '';
                          const reasoningMenuShown =
                            reasoningMenuModelID === model.site_model_id;
                          return (
                            <div
                              className={
                                model.site_model_id === selectedModelID
                                  ? 'hcai-model-option active'
                                  : 'hcai-model-option'
                              }
                              key={model.site_model_id}>
                              <button
                                type="button"
                                className="hcai-model-option-main"
                                onClick={() => {
                                  setSelectedModelID(model.site_model_id);
                                  setReasoningMenuModelID('');
                                }}>
                                <strong>{getModelName(model)}</strong>
                              </button>
                              {modelSupportsReasoning ? (
                                <div className="hcai-model-reasoning-menu">
                                  <button
                                    type="button"
                                    className={
                                      reasoningMenuShown
                                        ? 'hcai-model-reasoning-toggle active'
                                        : 'hcai-model-reasoning-toggle'
                                    }
                                    aria-haspopup="true"
                                    aria-expanded={reasoningMenuShown}
                                    aria-label={`${getModelName(model)} 思考长度`}
                                    onClick={() => {
                                      setReasoningMenuModelID((current) =>
                                        current === model.site_model_id
                                          ? ''
                                          : model.site_model_id,
                                      );
                                    }}>
                                    <span>
                                      思考{' '}
                                      {getReasoningEffortLabel(
                                        modelReasoningEffort,
                                      )}
                                    </span>
                                    <Icon name="chevron-down" />
                                  </button>
                                  {reasoningMenuShown ? (
                                    <div className="hcai-model-reasoning-popover">
                                      {reasoningEffortOptions.map((option) => (
                                        <button
                                          type="button"
                                          className={
                                            modelReasoningEffort ===
                                            option.value
                                              ? 'active'
                                              : ''
                                          }
                                          key={option.value || 'auto'}
                                          onClick={() => {
                                            setModelReasoningEfforts(
                                              (prev) => ({
                                                ...prev,
                                                [model.site_model_id]:
                                                  option.value,
                                              }),
                                            );
                                            setReasoningMenuModelID('');
                                          }}>
                                          {option.label}
                                        </button>
                                      ))}
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                  <button
                    type={isGenerating ? 'button' : 'submit'}
                    aria-label={isGenerating ? '停止生成' : '发送消息'}
                    className="send"
                    title={isGenerating ? '停止生成' : '发送'}
                    onClick={isGenerating ? handleCancel : undefined}
                    disabled={
                      !isGenerating &&
                      ((!prompt.trim() &&
                        promptImages.length === 0 &&
                        promptFiles.length === 0) ||
                        !selectedModelID)
                    }>
                    <Icon name={isGenerating ? 'stop-fill' : 'arrow-up'} />
                  </button>
                </div>
              </div>
            </form>
          ) : null}
        </main>
      </div>

      <Modal
        show={subscriptionOpen}
        onHide={() => setSubscriptionOpen(false)}
        centered
        dialogClassName="hcai-subscription-dialog">
        <Modal.Body>
          <button
            type="button"
            className="hcai-subscription-close"
            aria-label="关闭"
            onClick={() => setSubscriptionOpen(false)}>
            <Icon name="x-lg" />
          </button>
          <div className="hcai-subscription-head">
            <h2>订阅管理</h2>
            <p>查看当前订阅和本月用量</p>
          </div>

          {subscriptionLoading ? (
            <div className="hcai-subscription-loading">
              <Spinner animation="border" />
            </div>
          ) : subscriptionError ? (
            <div className="hcai-subscription-error">{subscriptionError}</div>
          ) : subscription ? (
            <>
              <div className="hcai-subscription-stats">
                <div>
                  <span>订阅类型</span>
                  <strong>{subscription.plan_name}</strong>
                </div>
                <div>
                  <span>订阅到期时间</span>
                  <strong>
                    {formatSubscriptionDateTime(subscription.expires_at)}
                  </strong>
                </div>
              </div>

              <div className="hcai-subscription-usage">
                <div className="hcai-subscription-usage-row">
                  <div>
                    <span>本月用量</span>
                    <strong>
                      {subscription.chat_points === -1
                        ? '无限制'
                        : `${formatQuota(
                            subscription.chat_points_remaining,
                          )} 剩余`}
                    </strong>
                  </div>
                  <div className="hcai-subscription-progress">
                    <span
                      style={{
                        width: `${getProgressWidth(
                          subscription.chat_points_used,
                          subscription.chat_points,
                        )}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="hcai-subscription-usage-row">
                  <div>
                    <span>本月生图</span>
                    <strong>
                      已生成 {formatQuota(subscription.image_quota_used)} 张 /{' '}
                      {formatQuota(subscription.image_quota)}
                    </strong>
                  </div>
                  <div className="hcai-subscription-progress">
                    <span
                      style={{
                        width: `${getProgressWidth(
                          subscription.image_quota_used,
                          subscription.image_quota,
                        )}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="hcai-subscription-usage-row">
                  <div>
                    <span>今日视频</span>
                    <strong>
                      已生成 {formatQuota(subscription.video_daily_used)} 次 /{' '}
                      {formatQuota(subscription.video_daily_quota)}
                    </strong>
                  </div>
                  <div className="hcai-subscription-progress">
                    <span
                      style={{
                        width: `${getProgressWidth(
                          subscription.video_daily_used,
                          subscription.video_daily_quota,
                        )}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="hcai-subscription-usage-row">
                  <div>
                    <span>本月视频</span>
                    <strong>
                      已生成 {formatQuota(subscription.video_quota_used)} 次 /{' '}
                      {formatQuota(subscription.video_quota)}
                    </strong>
                  </div>
                  <div className="hcai-subscription-progress">
                    <span
                      style={{
                        width: `${getProgressWidth(
                          subscription.video_quota_used,
                          subscription.video_quota,
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="hcai-subscription-detail">
                <div>
                  <h3>可用模型</h3>
                  <div className="hcai-subscription-models">
                    {subscription.available_models.length > 0 ? (
                      subscription.available_models.map((model) => (
                        <span key={model}>{model}</span>
                      ))
                    ) : (
                      <em>暂无可用模型</em>
                    )}
                  </div>
                </div>
                <div>
                  <h3>模型消耗系数</h3>
                  <div className="hcai-subscription-rates">
                    {subscription.consume_rates.map((rate) => (
                      <div key={rate.site_model_id}>
                        <span>{rate.site_model_id}</span>
                        <strong>{rate.consume_rate} 点/次</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="hcai-subscription-period">
                本月额度周期： {formatDateTime(subscription.period_start)} -{' '}
                {formatSubscriptionDateTime(subscription.period_end)}
              </div>
              <button
                type="button"
                className="hcai-subscription-buy"
                onClick={goSubscriptionPurchase}>
                购买/升级订阅
              </button>
            </>
          ) : null}
        </Modal.Body>
      </Modal>

      <Modal
        show={redeemOpen}
        onHide={() => setRedeemOpen(false)}
        centered
        dialogClassName="hcai-redeem-dialog">
        <Modal.Body>
          <button
            type="button"
            className="hcai-subscription-close"
            aria-label="关闭"
            onClick={() => setRedeemOpen(false)}
            disabled={redeemLoading}>
            <Icon name="x-lg" />
          </button>
          <div className="hcai-subscription-head">
            <h2>订阅兑换</h2>
            <p>输入授权码兑换对应订阅</p>
          </div>

          <form className="hcai-redeem-form" onSubmit={handleRedeemSubmit}>
            <label htmlFor="hcai-redeem-code">授权码</label>
            <input
              id="hcai-redeem-code"
              value={redeemCode}
              placeholder="PLUS-XXXX-XXXX-XXXX-XXXX"
              disabled={redeemLoading}
              onChange={(evt) => setRedeemCode(evt.target.value)}
            />
            {redeemError ? (
              <div className="hcai-redeem-message error">{redeemError}</div>
            ) : null}
            {redeemSuccess ? (
              <div className="hcai-redeem-message success">{redeemSuccess}</div>
            ) : null}
            <button
              type="submit"
              className="hcai-redeem-submit"
              disabled={redeemLoading}>
              {redeemLoading ? '兑换中...' : '立即兑换'}
            </button>
          </form>
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default memo(Chat);
