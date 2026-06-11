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

import { FC, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { usePageTags } from '@/hooks';
import { Empty } from '@/components';
import {
  getReviewInspirations,
  getReviewTasks,
  getReviewType,
} from '@/services';
import type * as Type from '@/common/interface';

import {
  ReviewType,
  FlagContent,
  SuggestContent,
  QueuedContent,
  TaskContent,
  InspirationContent,
} from './components';
import './index.scss';

const reviewTypeOrder = [
  'task_request',
  'task_in_progress',
  'task_submission',
  'inspiration',
  'inspiration_report',
  'queued_post',
  'flagged_post',
  'suggested_post_edit',
];

const reviewTypeLabels: Record<string, string> = {
  task_request: '待审核需求',
  task_in_progress: '进行中需求',
  task_submission: '待验收任务',
  inspiration: '灵感审核',
  inspiration_report: '灵感举报',
  queued_post: '排队内容',
  flagged_post: '举报内容',
  suggested_post_edit: '建议编辑',
};

const Index: FC = () => {
  const [urlSearch, setUrlSearchParams] = useSearchParams();
  const searchType = urlSearch.get('type');
  const { t } = useTranslation('translation', { keyPrefix: 'page_review' });
  const [reviewTypeList, setReviewTypeList] = useState<Type.ReviewTypeItem[]>();
  const [currentReviewType, setCurrentReviewType] = useState('');
  const [isEmpty, setIsEmpty] = useState(false);

  const fetchReviewType = async (changeReviewType: boolean) => {
    try {
      const [
        legacyReviewResult,
        taskRequestResult,
        taskInProgressResult,
        taskSubmissionResult,
        inspirationReviewResult,
        inspirationReportResult,
      ] = await Promise.allSettled([
        getReviewType(),
        getReviewTasks({ page: 1, page_size: 1, status: 'pending_review' }),
        getReviewTasks({ page: 1, page_size: 1, status: 'in_progress' }),
        getReviewTasks({ page: 1, page_size: 1, status: 'submitted' }),
        getReviewInspirations({
          page: 1,
          page_size: 1,
          status: 'pending_review',
        }),
        getReviewInspirations({
          page: 1,
          page_size: 1,
          status: 'reported',
        }),
      ]);
      const legacyReviewTypes =
        legacyReviewResult.status === 'fulfilled'
          ? legacyReviewResult.value
          : [];
      const taskRequestCount =
        taskRequestResult.status === 'fulfilled'
          ? taskRequestResult.value?.count || 0
          : 0;
      const taskInProgressCount =
        taskInProgressResult.status === 'fulfilled'
          ? taskInProgressResult.value?.count || 0
          : 0;
      const taskSubmissionCount =
        taskSubmissionResult.status === 'fulfilled'
          ? taskSubmissionResult.value?.count || 0
          : 0;
      const inspirationReviewCount =
        inspirationReviewResult.status === 'fulfilled'
          ? inspirationReviewResult.value?.count || 0
          : 0;
      const inspirationReportCount =
        inspirationReportResult.status === 'fulfilled'
          ? inspirationReportResult.value?.count || 0
          : 0;
      const legacyAmountByName = new Map(
        legacyReviewTypes.map((item) => [item.name, item.todo_amount]),
      );
      const nextReviewTypes = reviewTypeOrder.map((name) => ({
        name,
        label: reviewTypeLabels[name],
        todo_amount:
          name === 'task_request'
            ? taskRequestCount
            : name === 'task_in_progress'
              ? taskInProgressCount
              : name === 'task_submission'
                ? taskSubmissionCount
                : name === 'inspiration'
                  ? inspirationReviewCount
                  : name === 'inspiration_report'
                    ? inspirationReportCount
                    : legacyAmountByName.get(name) || 0,
      }));
      const nextType = searchType
        ? nextReviewTypes.find((item) => item.name === searchType)?.name
        : undefined;
      const fallbackType =
        nextReviewTypes.find((item) => item.todo_amount > 0)?.name ||
        nextReviewTypes[0]?.name ||
        '';
      const selectedType =
        nextType ||
        (changeReviewType || !currentReviewType
          ? fallbackType
          : currentReviewType);
      const selectedItem = nextReviewTypes.find(
        (item) => item.name === selectedType,
      );

      setCurrentReviewType(selectedType);
      setIsEmpty((selectedItem?.todo_amount || 0) <= 0);
      setReviewTypeList(nextReviewTypes);
    } catch (ex) {
      console.error('getReviewType error: ', ex);
    }
  };

  const handleTypeChange = (name) => {
    urlSearch.set('type', name);
    setUrlSearchParams(urlSearch);
    setCurrentReviewType(name);
    const selectedItem = reviewTypeList?.find((item) => item.name === name);
    setIsEmpty((selectedItem?.todo_amount || 0) <= 0);
  };

  useEffect(() => {
    fetchReviewType(true);
  }, []);

  usePageTags({
    title: t('review'),
  });

  return (
    <div className="review-page py-4 mb-5">
      <h3 className="mb-3">{t('review')}</h3>
      <ReviewType
        list={reviewTypeList}
        checked={currentReviewType}
        callback={handleTypeChange}
      />
      <div className="review-page-main">
        {currentReviewType === 'task_request' && (
          <TaskContent
            status="pending_review"
            refreshCount={() => fetchReviewType(false)}
          />
        )}

        {currentReviewType === 'task_in_progress' && (
          <TaskContent
            status="in_progress"
            refreshCount={() => fetchReviewType(false)}
          />
        )}

        {currentReviewType === 'task_submission' && (
          <TaskContent
            status="submitted"
            refreshCount={() => fetchReviewType(false)}
          />
        )}

        {currentReviewType === 'inspiration' && (
          <InspirationContent
            status="pending_review"
            refreshCount={() => fetchReviewType(false)}
          />
        )}

        {currentReviewType === 'inspiration_report' && (
          <InspirationContent
            status="reported"
            refreshCount={() => fetchReviewType(false)}
          />
        )}

        {currentReviewType === 'suggested_post_edit' && (
          <SuggestContent refreshCount={() => fetchReviewType(false)} />
        )}

        {currentReviewType === 'flagged_post' && (
          <FlagContent refreshCount={() => fetchReviewType(false)} />
        )}

        {currentReviewType === 'queued_post' && (
          <QueuedContent refreshCount={() => fetchReviewType(false)} />
        )}
        {isEmpty && <Empty>{t('empty')}</Empty>}
      </div>
    </div>
  );
};

export default Index;
