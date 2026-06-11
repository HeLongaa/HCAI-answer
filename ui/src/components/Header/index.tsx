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

import { CSSProperties, FC, memo, useState, useEffect, useRef } from 'react';
import { Navbar, Nav } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import {
  Link,
  NavLink,
  useLocation,
  useMatch,
  useNavigate,
} from 'react-router-dom';

import classnames from 'classnames';

import { userCenter, floppyNavigation, isLight, Storage } from '@/utils';
import { CHAT_WORKSPACE_STORAGE_KEY } from '@/common/constants';
import {
  loggedUserInfoStore,
  siteInfoStore,
  brandingStore,
  loginSettingStore,
  themeSettingStore,
  sideNavStore,
} from '@/stores';
import { logout, useQueryNotificationStatus } from '@/services';
import {
  AiSubscriptionPill,
  CommunityPointsPill,
  Icon,
  MobileSideNav,
} from '@/components';

import NavItems from './components/NavItems';

import './index.scss';

const publicHomeMainSlogan = '让贡献被看见，让价值被奖励。';
const publicHomeSlogans = [
  '不会写代码、不会写提示词、不会拆需求，都不妨碍你把想法做出来。',
  '你是否因为不会使用 AI 而感到焦虑？',
  '你是否知道 AI 很强，却不知道它能帮你做什么？',
  '你是否收藏了很多 AI 工具，却从来没有真正用起来？',
  '你是否试过很多 AI 产品，最后还是回到原来的工作方式？',
  '你是否觉得 AI 很热闹，但离自己的业务很远？',
  '你是否担心别人已经用 AI 提效，而自己还停在原地？',
  '你是否每天都听到 AI，却不知道第一步该从哪里开始？',
  '你是否想用 AI 提高效率，却不知道适合自己的场景是什么？',
  '你是否觉得 AI 工具越来越多，但真正好用的很少？',
  '你是否缺的不是 AI，而是一个能帮你落地的人？',
];
const publicHomeRollingSlogans = [
  ...publicHomeSlogans,
  ...publicHomeSlogans,
].map((text, index) => ({
  id: `${index}-${text}`,
  text,
}));

const Header: FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, clear: clearUserStore } = loggedUserInfoStore();
  const { t } = useTranslation();
  const siteInfo = siteInfoStore((state) => state.siteInfo);
  const brandingInfo = brandingStore((state) => state.branding);
  const loginSetting = loginSettingStore((state) => state.login);
  const { updateReview } = sideNavStore();
  const { data: redDot } = useQueryNotificationStatus();
  const [showMobileSideNav, setShowMobileSideNav] = useState(false);
  const [showHeaderSearch, setShowHeaderSearch] = useState(false);
  const [headerSearch, setHeaderSearch] = useState('');
  const headerSearchRef = useRef<HTMLDivElement>(null);
  /**
   * Automatically append `tag` information when creating a question
   */
  const tagMatch = useMatch('/tags/:slugName');
  let askUrl = '/questions/add';
  if (tagMatch && tagMatch.params.slugName) {
    askUrl = `${askUrl}?tags=${encodeURIComponent(tagMatch.params.slugName)}`;
  }

  useEffect(() => {
    updateReview({
      can_revision: Boolean(redDot?.can_revision),
      revision: Number(redDot?.revision),
    });
  }, [redDot]);

  const handleLogout = async (evt) => {
    evt.preventDefault();
    await logout();
    clearUserStore();
    window.location.replace(window.location.href);
  };

  useEffect(() => {
    setShowMobileSideNav(false);
    setShowHeaderSearch(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!showHeaderSearch) {
      return undefined;
    }

    const handleClickOutside = (evt: PointerEvent) => {
      if (
        evt.target instanceof Element &&
        evt.target.closest('.header-search-popover, .header-search-trigger')
      ) {
        return;
      }
      setShowHeaderSearch(false);
    };

    const handleEscape = (evt: KeyboardEvent) => {
      if (evt.key === 'Escape') {
        setShowHeaderSearch(false);
      }
    };

    document.addEventListener('pointerdown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showHeaderSearch]);

  const handleHeaderSearch = (evt) => {
    evt.preventDefault();
    const keyword = headerSearch.trim();
    if (!keyword) {
      return;
    }
    setShowHeaderSearch(false);
    navigate(`/search?q=${encodeURIComponent(keyword)}`);
  };

  const isUserSideNavPage =
    location.pathname === '/users' ||
    location.pathname.startsWith('/users/settings') ||
    location.pathname.startsWith('/users/notifications') ||
    /^\/users\/[^/]+(\/(answers|questions|bookmarks|reputation|badges|votes))?$/.test(
      location.pathname,
    );
  const isQuestionSideNavPage =
    location.pathname.startsWith('/questions') ||
    location.pathname.startsWith('/linked') ||
    location.pathname.startsWith('/posts/');
  const isTaskPage = location.pathname.startsWith('/tasks');
  const isInspirationPage = location.pathname.startsWith('/inspirations');
  const isCommunityPage =
    isQuestionSideNavPage ||
    location.pathname.startsWith('/search') ||
    location.pathname.startsWith('/tags') ||
    isUserSideNavPage ||
    location.pathname.startsWith('/leaderboard') ||
    location.pathname.startsWith('/badges') ||
    location.pathname.startsWith('/review');
  const isSubscriptionPage = location.pathname === '/subscription';
  const isPublicHomePage = !user?.username && location.pathname === '/';
  const isChatPage = Boolean(user?.username) && location.pathname === '/';
  const isLegalPage =
    location.pathname === '/tos' || location.pathname === '/privacy';
  const isPublicLegalPage = !user?.username && isLegalPage;
  const isAiAssistantSideNavPage =
    location.pathname.startsWith('/ai-assistant');
  const showAiSubscriptionPill = isChatPage || isSubscriptionPage;
  const isSideNavPage =
    isChatPage ||
    isSubscriptionPage ||
    isTaskPage ||
    isInspirationPage ||
    isCommunityPage ||
    isAiAssistantSideNavPage ||
    location.pathname.startsWith('/admin');
  const isAuthFlowPage =
    location.pathname === '/users/login' ||
    location.pathname === '/users/register' ||
    location.pathname === '/users/logout' ||
    location.pathname === '/users/account-recovery' ||
    location.pathname === '/users/change-email' ||
    location.pathname === '/users/password-reset' ||
    location.pathname.startsWith('/users/account-activation') ||
    location.pathname === '/users/confirm-new-email' ||
    location.pathname === '/users/confirm-email' ||
    location.pathname === '/users/auth-landing' ||
    location.pathname === '/users/account-suspended' ||
    location.pathname.startsWith('/user-center/');

  let navbarStyle = 'theme-light';
  let themeMode = 'light';
  const storedChatWorkspace = Storage.get(CHAT_WORKSPACE_STORAGE_KEY);
  const workbenchPath =
    storedChatWorkspace === 'image' || storedChatWorkspace === 'video'
      ? `/?workspace=${storedChatWorkspace}`
      : '/';
  const { theme, theme_config, layout } = themeSettingStore((_) => _);
  if (theme_config?.[theme]?.navbar_style) {
    // const color = theme_config[theme].navbar_style.startsWith('#')
    themeMode = isLight(theme_config[theme].navbar_style) ? 'light' : 'dark';
    navbarStyle = `theme-${themeMode}`;
  }

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1199.9) {
        setShowMobileSideNav(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  if (isAuthFlowPage || isPublicLegalPage) {
    return null;
  }

  return (
    <Navbar
      data-bs-theme="light"
      expand="xl"
      className={classnames('sticky-top', navbarStyle, 'liquid-header', {
        'mobile-side-nav-open': showMobileSideNav,
        'public-home-header': isPublicHomePage,
      })}
      style={
        {
          '--an-navbar-accent': theme_config[theme].navbar_style,
        } as CSSProperties
      }
      id="header">
      <div
        className={classnames(
          'w-100 d-flex align-items-center header-shell',
          layout === 'Fixed-width' ? 'container-xxl fixed-width' : '',
        )}>
        <Navbar.Toggle
          className={classnames('answer-navBar me-2 d-lg-none', {
            'd-none': !isSideNavPage,
          })}
          onClick={() => {
            setShowMobileSideNav(!showMobileSideNav);
          }}
        />

        <Navbar.Brand
          to={isPublicHomePage ? '/' : workbenchPath}
          as={Link}
          className={classnames('lh-1 me-0 me-sm-5 p-0 nav-text', {
            'side-nav-brand-hidden': isSideNavPage,
            'brand-has-logo': brandingInfo.logo || brandingInfo.mobile_logo,
          })}>
          {brandingInfo.logo || brandingInfo.mobile_logo ? (
            <img
              className="logo"
              src={brandingInfo.mobile_logo || brandingInfo.logo}
              alt={siteInfo.name}
            />
          ) : (
            <span>{siteInfo.name}</span>
          )}
        </Navbar.Brand>

        {isPublicHomePage && (
          <section className="hcai-home-slogans" aria-label="HCAI 宣传标语">
            <strong>{publicHomeMainSlogan}</strong>
            <div className="hcai-slogan-marquee" aria-label="HCAI 用户痛点">
              <div className="hcai-slogan-track">
                {publicHomeRollingSlogans.map((slogan) => (
                  <span key={slogan.id}>{slogan.text}</span>
                ))}
              </div>
            </div>
            <Link
              className="hcai-slogan-action"
              onClick={() => floppyNavigation.storageLoginRedirect()}
              to={userCenter.getLoginUrl()}>
              开始体验
              <Icon name="arrow-right-short" />
            </Link>
          </section>
        )}

        <div
          className="header-center d-none d-lg-flex mx-auto"
          ref={headerSearchRef}>
          {!isPublicHomePage && !isPublicLegalPage && (
            <div
              className="header-segmented-nav"
              aria-label="Primary navigation">
              <NavLink
                to={workbenchPath}
                end
                className={classnames('segment-item', {
                  active: location.pathname === '/',
                })}>
                工作台
              </NavLink>
              <NavLink
                to="/questions"
                className={classnames('segment-item', {
                  active: isCommunityPage,
                })}>
                社区
              </NavLink>
              <NavLink
                to="/tasks"
                className={classnames('segment-item', {
                  active: isTaskPage,
                })}>
                任务广场
              </NavLink>
              <NavLink
                to="/inspirations"
                className={classnames('segment-item', {
                  active: isInspirationPage,
                })}>
                灵感库
              </NavLink>
            </div>
          )}

          {showHeaderSearch && (
            <form
              className="header-search-popover"
              onSubmit={handleHeaderSearch}>
              <Icon name="search" className="header-search-icon" />
              <input
                value={headerSearch}
                onChange={(evt) => setHeaderSearch(evt.target.value)}
                className="header-search-input"
                placeholder="搜索社区内容"
                type="search"
              />
              <button type="submit" className="header-search-submit">
                搜索
              </button>
            </form>
          )}
        </div>

        {/* pc nav */}
        {user?.username ? (
          <Nav className="d-flex align-items-center flex-nowrap flex-row ms-auto">
            {showAiSubscriptionPill ? (
              <Nav.Item className="me-2 header-quota-pill-item">
                <AiSubscriptionPill />
              </Nav.Item>
            ) : null}
            {isCommunityPage || isTaskPage || isInspirationPage ? (
              <Nav.Item className="me-2 header-quota-pill-item">
                <CommunityPointsPill />
              </Nav.Item>
            ) : null}

            <Nav.Item className="me-2 d-block d-xl-none">
              <NavLink
                to={askUrl}
                className="d-block icon-link nav-link text-center">
                <Icon name="plus-lg" className="lh-1 fs-4" />
              </NavLink>
            </Nav.Item>

            <Nav.Item className="me-2 d-none d-xl-block">
              <NavLink
                to={askUrl}
                title={t('btns.create')}
                className="icon-link nav-link d-flex align-items-center justify-content-center p-0">
                <Icon name="plus-lg" className="lh-1 fs-4" />
              </NavLink>
            </Nav.Item>

            <Nav.Item className="me-2 d-block">
              <button
                type="button"
                aria-label="搜索"
                onClick={() => setShowHeaderSearch((show) => !show)}
                className={classnames(
                  'p-0 btn-no-border icon-link nav-link d-flex align-items-center justify-content-center',
                  'header-search-trigger',
                  {
                    active: showHeaderSearch || location.pathname === '/search',
                  },
                )}>
                <Icon name="search" className="lh-1 fs-4" />
              </button>
            </Nav.Item>

            <NavItems redDot={redDot} userInfo={user} logOut={handleLogout} />
          </Nav>
        ) : isPublicHomePage ? null : (
          <div className="header-auth-actions ms-auto">
            <Link
              className="me-2 btn btn-link an-header-login"
              onClick={() => floppyNavigation.storageLoginRedirect()}
              to={userCenter.getLoginUrl()}>
              {t('btns.login')}
            </Link>
            {loginSetting.allow_new_registrations && (
              <Link
                className="btn btn-primary an-header-primary"
                to={userCenter.getSignUpUrl()}>
                {t('btns.signup')}
              </Link>
            )}
          </div>
        )}
      </div>

      {showHeaderSearch && (
        <form
          className="header-search-popover header-search-popover-mobile d-lg-none"
          onSubmit={handleHeaderSearch}>
          <Icon name="search" className="header-search-icon" />
          <input
            value={headerSearch}
            onChange={(evt) => setHeaderSearch(evt.target.value)}
            className="header-search-input"
            placeholder="搜索社区内容"
            type="search"
          />
          <button type="submit" className="header-search-submit">
            搜索
          </button>
        </form>
      )}

      {isSideNavPage && (
        <MobileSideNav show={showMobileSideNav} onHide={setShowMobileSideNav} />
      )}
    </Navbar>
  );
};

export default memo(Header);
