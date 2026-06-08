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

import { FC } from 'react';
import { Nav } from 'react-bootstrap';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import classNames from 'classnames';

import { aiControlStore, siteInfoStore, brandingStore } from '@/stores';
import { Icon, PluginRender } from '@/components';
import { PluginType } from '@/utils/pluginKit';
import request from '@/utils/request';
import { sortTagsForDisplay } from '@/utils';
import { useQueryTags } from '@/services';
import { pathFactory } from '@/router/pathFactory';

import './index.scss';

interface IProps {
  showBrand?: boolean;
}

const Index: FC<IProps> = ({ showBrand = true }) => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { ai_enabled } = aiControlStore();
  const siteInfo = siteInfoStore((state) => state.siteInfo);
  const brandingInfo = brandingStore((state) => state.branding);
  const { data: tags } = useQueryTags({
    page: 1,
    page_size: 100,
    query_cond: 'popular',
  });
  const navigate = useNavigate();
  const activeTag = decodeURIComponent(
    pathname.match(/^\/tags\/([^/]+)/)?.[1] || '',
  );
  const tagList = tags?.list;
  const sidebarTags = sortTagsForDisplay(Array.isArray(tagList) ? tagList : []);

  return (
    <Nav variant="pills" className="flex-column" id="sideNav">
      {showBrand && (
        <NavLink to="/" className="side-nav-site-brand">
          {brandingInfo.mobile_logo || brandingInfo.logo ? (
            <img
              className="side-nav-brand-logo"
              src={brandingInfo.mobile_logo || brandingInfo.logo}
              alt={siteInfo.name}
            />
          ) : (
            <span className="side-nav-brand-mark">
              {siteInfo.name.slice(0, 1)}
            </span>
          )}
          <span className="side-nav-brand-name">{siteInfo.name}</span>
        </NavLink>
      )}

      <NavLink
        to="/questions"
        className={({ isActive }) =>
          isActive || pathname === '/' ? 'nav-link active' : 'nav-link'
        }>
        <Icon name="question-circle-fill" className="me-2" />
        <span>{t('header.nav.question')}</span>
      </NavLink>

      {ai_enabled && (
        <NavLink
          to="/ai-assistant"
          className={() =>
            pathname === '/ai-assistant' ? 'nav-link active' : 'nav-link'
          }>
          <Icon name="chat-square-text-fill" className="me-2" />
          <span>{t('ai_assistant', { keyPrefix: 'page_title' })}</span>
        </NavLink>
      )}

      <NavLink
        to="/tags"
        className={() =>
          pathname === '/tags' ? 'nav-link active' : 'nav-link'
        }>
        <Icon name="tags-fill" className="me-2" />
        <span>{t('header.nav.tag')}</span>
      </NavLink>

      {sidebarTags.length > 0 ? (
        <div className="side-nav-tag-list" aria-label={t('header.nav.tag')}>
          {sidebarTags.map((tag) => (
            <NavLink
              to={pathFactory.tagLanding(tag.slug_name)}
              className={classNames('nav-link side-nav-tag-link', {
                active: activeTag === tag.slug_name,
                'side-nav-tag-reserved': tag.reserved,
              })}
              key={tag.slug_name}>
              <span className="side-nav-tag-name">
                {tag.reserved && <span className="side-nav-tag-reserved-dot" />}
                {tag.display_name}
              </span>
              <span className="side-nav-tag-count">{tag.question_count}</span>
            </NavLink>
          ))}
        </div>
      ) : null}

      <NavLink to="/users" className="nav-link">
        <Icon name="people-fill" className="me-2" />
        <span>{t('header.nav.user')}</span>
      </NavLink>

      <NavLink to="/leaderboard" className="nav-link">
        <Icon name="trophy-fill" className="me-2" />
        <span>排行榜</span>
      </NavLink>

      <NavLink to="/badges" className="nav-link">
        <Icon name="award-fill" className="me-2" />
        <span>{t('header.nav.badges')}</span>
      </NavLink>

      <PluginRender
        slug_name="quick_links"
        type={PluginType.Sidebar}
        request={request}
        navigate={navigate}
      />
    </Nav>
  );
};

export default Index;
