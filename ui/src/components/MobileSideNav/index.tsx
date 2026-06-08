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

import { useCallback, useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';

import classNames from 'classnames';

import { SideNav, AdminSideNav, Icon } from '@/components';
import { CHAT_WORKSPACE_STORAGE_KEY } from '@/common/constants';
import type { ConversationListItem } from '@/common/interface';
import { getConversationList } from '@/services';
import { siteInfoStore } from '@/stores';
import { Storage } from '@/utils';

import './index.scss';

const chatNavItems = [
  { icon: 'pencil-square', label: '聊天', active: true },
  { icon: 'image', label: '图片生成' },
  { icon: 'camera-reels', label: '视频生成' },
  { icon: 'credit-card-2-front', label: '订阅管理' },
  { icon: 'stars', label: '订阅兑换' },
];

const MobileSideNav = ({ show, onHide }) => {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const isAdmin = pathname.includes('/admin');
  const isChat = pathname === '/';
  const isImageWorkspace =
    isChat && new URLSearchParams(search).get('workspace') === 'image';
  const isVideoWorkspace =
    isChat && new URLSearchParams(search).get('workspace') === 'video';
  const isUserSideNavPage =
    pathname === '/users' ||
    pathname.startsWith('/users/settings') ||
    pathname.startsWith('/users/notifications') ||
    /^\/users\/[^/]+(\/(answers|questions|bookmarks|reputation|badges|votes))?$/.test(
      pathname,
    );
  const isQuestionSideNavPage =
    pathname.startsWith('/questions') ||
    pathname.startsWith('/linked') ||
    pathname.startsWith('/posts/');
  const isCommunityPage =
    isQuestionSideNavPage ||
    pathname.startsWith('/search') ||
    pathname.startsWith('/tags') ||
    isUserSideNavPage ||
    pathname.startsWith('/leaderboard') ||
    pathname.startsWith('/badges') ||
    pathname.startsWith('/review');
  const isTaskPage = pathname.startsWith('/tasks');
  const siteInfo = siteInfoStore((state) => state.siteInfo);
  const storedChatWorkspace = Storage.get(CHAT_WORKSPACE_STORAGE_KEY);
  const workbenchPath =
    storedChatWorkspace === 'image' || storedChatWorkspace === 'video'
      ? `/?workspace=${storedChatWorkspace}`
      : '/';
  const [conversationsOpen, setConversationsOpen] = useState(true);
  const [conversationList, setConversationList] = useState<
    ConversationListItem[]
  >([]);
  const [conversationID, setConversationID] = useState('');

  const closeSideNav = useCallback(() => onHide(false), [onHide]);
  const startNewConversation = () => {
    window.dispatchEvent(new CustomEvent('hcai-start-new-conversation'));
    closeSideNav();
  };
  const openImageGeneration = () => {
    window.dispatchEvent(new CustomEvent('hcai-open-image-generation'));
    closeSideNav();
  };
  const openVideoGeneration = () => {
    window.dispatchEvent(new CustomEvent('hcai-open-video-generation'));
    closeSideNav();
  };
  const loadConversation = (id: string) => {
    window.dispatchEvent(
      new CustomEvent('hcai-load-conversation', {
        detail: { conversation_id: id },
      }),
    );
    setConversationID(id);
    closeSideNav();
  };
  const openSubscription = () => {
    window.dispatchEvent(new CustomEvent('hcai-open-subscription'));
    closeSideNav();
  };
  const openRedeem = () => {
    window.dispatchEvent(new CustomEvent('hcai-open-redeem'));
    closeSideNav();
  };
  const goSubscriptionPurchase = () => {
    closeSideNav();
    navigate('/subscription');
  };

  useEffect(() => {
    if (!show || !isChat) {
      return;
    }
    getConversationList({ page: 1, page_size: 30 })
      .then((data) => {
        setConversationList(data.list || []);
      })
      .catch(() => {
        setConversationList([]);
      });
  }, [isChat, show]);

  useEffect(() => {
    const handleCloseMobileSideNav = () => closeSideNav();
    window.addEventListener(
      'hcai-close-mobile-side-nav',
      handleCloseMobileSideNav,
    );
    return () => {
      window.removeEventListener(
        'hcai-close-mobile-side-nav',
        handleCloseMobileSideNav,
      );
    };
  }, [closeSideNav]);

  return (
    <>
      <button
        type="button"
        className={classNames('mobile-side-nav-scrim', { show })}
        aria-hidden={!show}
        tabIndex={show ? 0 : -1}
        onClick={closeSideNav}
      />

      <aside
        id="mobileSideNav"
        aria-hidden={!show}
        className={classNames('px-3 py-4', { show })}>
        <NavLink
          to={workbenchPath}
          className="mobile-side-site-brand"
          onClick={closeSideNav}>
          {siteInfo.name}
        </NavLink>

        <div className="mobile-page-switch" aria-label="页面切换">
          <NavLink
            to={workbenchPath}
            end
            onClick={closeSideNav}
            className={pathname === '/' ? 'active' : ''}>
            工作台
          </NavLink>
          <NavLink
            to="/questions"
            onClick={closeSideNav}
            className={isCommunityPage ? 'active' : ''}>
            社区
          </NavLink>
          <NavLink
            to="/tasks"
            onClick={closeSideNav}
            className={isTaskPage ? 'active' : ''}>
            任务
          </NavLink>
        </div>
        <button
          type="button"
          className="mobile-upgrade-switch"
          onClick={goSubscriptionPurchase}>
          <Icon name="music-note-beamed" />
          <span>升级套餐</span>
        </button>

        {isChat ? (
          <div className="mobile-chat-nav" aria-label="HCAI-Chat navigation">
            <nav className="mobile-chat-nav-main">
              {chatNavItems.map((item) => (
                <button
                  type="button"
                  className={
                    (item.label === '聊天' &&
                      !isImageWorkspace &&
                      !isVideoWorkspace) ||
                    (item.label === '图片生成' && isImageWorkspace) ||
                    (item.label === '视频生成' && isVideoWorkspace)
                      ? 'active'
                      : ''
                  }
                  key={item.label}
                  onClick={() => {
                    if (item.label === '聊天') {
                      startNewConversation();
                    }
                    if (item.label === '图片生成') {
                      openImageGeneration();
                    }
                    if (item.label === '视频生成') {
                      openVideoGeneration();
                    }
                    if (item.label === '订阅管理') {
                      openSubscription();
                    }
                    if (item.label === '订阅兑换') {
                      openRedeem();
                    }
                  }}>
                  <Icon name={item.icon} />
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>

            {isImageWorkspace || isVideoWorkspace ? (
              <div
                id={
                  isImageWorkspace
                    ? 'hcai-mobile-sidenav-image-tasks'
                    : 'hcai-mobile-sidenav-video-tasks'
                }
                className="mobile-chat-section mobile-workspace-task-section"
              />
            ) : (
              <div className="mobile-chat-section">
                <button
                  type="button"
                  className="mobile-chat-section-toggle"
                  aria-expanded={conversationsOpen}
                  aria-controls="mobile-chat-conversations"
                  onClick={() => setConversationsOpen((open) => !open)}>
                  <Icon
                    name={conversationsOpen ? 'chevron-down' : 'chevron-right'}
                  />
                  <span>对话</span>
                </button>
                {conversationsOpen ? (
                  <div
                    id="mobile-chat-conversations"
                    className="mobile-chat-conversation-list">
                    <span className="mobile-chat-time">过去 7 天</span>
                    {conversationList.length > 0 ? (
                      conversationList.map((item) => (
                        <button
                          type="button"
                          className={classNames('mobile-chat-item', {
                            active: item.conversation_id === conversationID,
                          })}
                          key={item.conversation_id}
                          onClick={() =>
                            loadConversation(item.conversation_id)
                          }>
                          {item.topic}
                        </button>
                      ))
                    ) : (
                      <span className="mobile-chat-empty">暂无对话</span>
                    )}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        ) : isAdmin ? (
          <AdminSideNav showBrand={false} />
        ) : (
          <SideNav showBrand={false} />
        )}
      </aside>
    </>
  );
};

export default MobileSideNav;
