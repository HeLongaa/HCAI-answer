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

import { FC, memo } from 'react';
import { Link } from 'react-router-dom';

import { Icon } from '@/components';
import { usePageTags } from '@/hooks';
import { floppyNavigation, userCenter } from '@/utils';
import { loggedUserInfoStore, siteInfoStore } from '@/stores';
import Chat from '@/pages/Chat';
import homeChatImage from '@/assets/images/home/home-chat.png';
import homeImageImage from '@/assets/images/home/home-image.png';
import homePointsImage from '@/assets/images/home/home-points.png';
import homeTaskImage from '@/assets/images/home/home-task.png';
import homeVideoImage from '@/assets/images/home/home-video.png';

import './index.scss';

const featureItems = [
  {
    icon: 'chat-dots',
    title: '智能对话',
    description: '多模型对话，代码生成，问题解答',
  },
  {
    icon: 'image',
    title: '图片生成',
    description: '文生图，表情包，风景图，创意无限',
  },
  {
    icon: 'play-btn',
    title: '视频生成',
    description: '文本生成视频，模板丰富，一键创作',
  },
  {
    icon: 'clipboard-check',
    title: '任务广场',
    description: '提交需求，领取任务，赚取积分',
  },
  {
    icon: 'coin',
    title: '积分系统',
    description: '完成任务获取积分，兑换更多权益',
  },
];

const benefitItems = [
  {
    icon: 'cpu',
    title: '多模型支持',
    description: '支持 GPT-5.5、DeepSeek-V4 Pro、Grok 等多种先进模型',
  },
  {
    icon: 'shield-check',
    title: '安全可靠',
    description: '企业级安全保障，数据加密保护',
  },
  {
    icon: 'rocket-takeoff',
    title: '高效便捷',
    description: '简单易用，快速上手，提升工作效率',
  },
  {
    icon: 'gift',
    title: '积分激励',
    description: '完成任务获取积分，兑换更多权益',
  },
  {
    icon: 'grid-3x3-gap',
    title: '多场景应用',
    description: '适用于测试、开发、运营等多种场景',
  },
];

const Home: FC = () => {
  const loggedUser = loggedUserInfoStore((state) => state.user);
  const siteInfo = siteInfoStore((state) => state.siteInfo);
  const siteName = siteInfo.name || 'HCAI';

  usePageTags({
    title: siteName,
    description:
      siteInfo.description || 'HCAI 是面向创作、协作和任务落地的 AI 工作台。',
  });

  if (loggedUser.access_token) {
    return <Chat />;
  }

  return (
    <main className="hcai-public-home">
      <section className="hcai-home-hero">
        <div className="hcai-home-copy">
          <h1>
            <span>AI</span> 创作平台
          </h1>
          <p>智能对话 · 图片生成 · 视频创作 · 任务管理 · 积分激励</p>

          <div className="hcai-home-feature-list">
            {featureItems.map((item) => (
              <article key={item.title}>
                <span>
                  <Icon name={item.icon} />
                </span>
                <div>
                  <h2>{item.title}</h2>
                  <p>{item.description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="hcai-home-preview" aria-label="HCAI 产品预览">
          <img
            className="hcai-product-shot hcai-product-shot-chat"
            src={homeChatImage}
            alt="HCAI 智能对话工作台"
          />
          <img
            className="hcai-product-shot hcai-product-shot-image"
            src={homeImageImage}
            alt="HCAI 图片生成画廊"
          />
          <img
            className="hcai-product-shot hcai-product-shot-video"
            src={homeVideoImage}
            alt="HCAI 视频生成工作台"
          />
          <img
            className="hcai-product-shot hcai-product-shot-task"
            src={homeTaskImage}
            alt="HCAI 任务广场"
          />
          <img
            className="hcai-product-shot hcai-product-shot-points"
            src={homePointsImage}
            alt="HCAI 积分系统"
          />
        </div>
      </section>

      <div className="hcai-home-cta">
        <Link
          className="hcai-home-cta-button"
          onClick={() => floppyNavigation.storageLoginRedirect()}
          to={userCenter.getLoginUrl()}>
          开始体验
          <Icon name="arrow-right-short" />
        </Link>
      </div>

      <section className="hcai-home-benefits" aria-label="HCAI 平台优势">
        {benefitItems.map((item) => (
          <article key={item.title}>
            <Icon name={item.icon} />
            <div>
              <h2>{item.title}</h2>
              <p>{item.description}</p>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
};

export default memo(Home);
