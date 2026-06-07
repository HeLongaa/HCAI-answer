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

import { FC, memo, useEffect, useState } from 'react';
import { Spinner } from 'react-bootstrap';

import { Icon } from '@/components';
import { usePageTags } from '@/hooks';
import { getAiSubscriptionPurchase } from '@/services';
import type {
  AiSubscriptionModelRate,
  AiSubscriptionPlan,
  AiSubscriptionPurchase,
} from '@/common/interface';

import './index.scss';

const formatQuota = (value?: number) => {
  if (value === -1) {
    return '无限制';
  }
  return Number(value || 0).toLocaleString();
};

const formatPrice = (value?: number) => {
  const price = Number(value || 0);
  return price % 1 === 0 ? String(price) : price.toFixed(2).replace(/0+$/, '');
};

const getRate = (rates: AiSubscriptionModelRate[], siteModelID: string) =>
  rates.find((rate) => rate.site_model_id === siteModelID)?.consume_rate || 1;

const PlanCard = ({
  plan,
  current,
  rates,
}: {
  plan: AiSubscriptionPlan;
  current: boolean;
  rates: AiSubscriptionModelRate[];
}) => {
  const models = plan.available_model_ids;
  const topModels = models.slice(0, 4).join('、') || '暂无可用模型';
  const freePlan =
    Number(plan.monthly_price || 0) <= 0 ||
    plan.plan_id.toLowerCase() === 'free' ||
    plan.name.toLowerCase() === 'free';
  const disabled = current || !plan.purchase_url;

  return (
    <article className="hcai-plan-card">
      <div className="hcai-plan-main">
        <h2>{plan.name}</h2>
        <p>{plan.task_description || '适合对应等级的日常和专业任务'}</p>
      </div>

      <div className="hcai-plan-price">
        <strong>¥{formatPrice(plan.monthly_price)}</strong>
        <span>/月</span>
      </div>

      <div className="hcai-plan-quota">
        <span>{formatQuota(plan.chat_points)} 点/月</span>
        <span>{formatQuota(plan.image_quota)} 张生图/月</span>
        <span>{formatQuota(plan.video_daily_quota)} 次视频/日</span>
        <span>{formatQuota(plan.video_quota)} 次视频/月</span>
      </div>

      <button
        type="button"
        disabled={freePlan || disabled}
        onClick={() => {
          if (plan.purchase_url) {
            window.open(plan.purchase_url, '_blank', 'noopener,noreferrer');
          }
        }}>
        {freePlan ? '默认套餐' : current ? '已订阅' : `获取 ${plan.name} ↗`}
      </button>

      <div className="hcai-plan-feature-title">
        <Icon name="stars" />
        <span>{plan.name} 包含：</span>
      </div>

      <ul>
        <li>每月 {formatQuota(plan.chat_points)} 聊天点数</li>
        <li>每月 {formatQuota(plan.image_quota)} 张图片生成</li>
        <li>每日 {formatQuota(plan.video_daily_quota)} 次视频生成</li>
        <li>每月 {formatQuota(plan.video_quota)} 次视频生成</li>
        <li>可用模型：{topModels}</li>
        <li>订阅费用： ¥{formatPrice(plan.monthly_price)}/月</li>
        <li>按模型消耗系数灵活扣减额度</li>
        <li>{plan.task_description || '适合对应等级的日常和专业任务'}</li>
      </ul>

      <div className="hcai-plan-foot">
        可用模型：
        {models.length > 0
          ? models
              .map((model) => `${model}(${getRate(rates, model)}点)`)
              .join('、')
          : '暂无可用模型'}
      </div>
    </article>
  );
};

const Subscription: FC = () => {
  const [data, setData] = useState<AiSubscriptionPurchase | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  usePageTags({
    title: '订阅购买',
  });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const resp = await getAiSubscriptionPurchase();
        setData(resp);
      } catch (err: any) {
        setError(err?.msg || '订阅信息加载失败');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const plans = data?.plans || [];
  const rates = data?.consume_rates || [];

  return (
    <main className="hcai-subscription-page">
      <header className="hcai-subscription-page-head">
        <div>
          <h1>订阅购买</h1>
          <p>额度按自然月统计，聊天点数、生图和视频额度独立计算。</p>
        </div>
        <span>购买进行订阅兑换即可生效</span>
      </header>

      {loading ? (
        <div className="hcai-subscription-page-state">
          <Spinner animation="border" />
        </div>
      ) : error ? (
        <div className="hcai-subscription-page-state error">{error}</div>
      ) : (
        <>
          <section className="hcai-plan-grid">
            {plans.map((plan) => (
              <PlanCard
                key={plan.plan_id}
                plan={plan}
                current={plan.plan_id === data?.current_plan_id}
                rates={rates}
              />
            ))}
          </section>

          <section className="hcai-rate-panel">
            <h2>模型消耗系数</h2>
            <div className="hcai-rate-grid">
              {rates.map((rate) => (
                <div key={rate.site_model_id}>
                  <strong>{rate.site_model_id}</strong>
                  <em>{rate.consume_rate} 点/次</em>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
};

export default memo(Subscription);
