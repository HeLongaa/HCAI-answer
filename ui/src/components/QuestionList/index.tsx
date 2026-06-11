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

import { FC, useState } from 'react';
import { Button, ListGroup } from 'react-bootstrap';
import { NavLink, useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { pathFactory } from '@/router/pathFactory';
import {
  Tag,
  Pagination,
  FormatTime,
  Empty,
  QueryGroup,
  QuestionListLoader,
  Icon,
  Avatar,
} from '@/components';
import * as Type from '@/common/interface';
import { useSkeletonControl } from '@/hooks';
import { formatCount, sortTagsForDisplay } from '@/utils';

import './index.scss';

export const QUESTION_ORDER_KEYS: Type.QuestionOrderBy[] = [
  'newest',
  'active',
  'unanswered',
  'recommend',
  'frequent',
  'score',
];
interface Props {
  source: 'questions' | 'tag' | 'linked';
  order?: Type.QuestionOrderBy;
  data;
  orderList?: Type.QuestionOrderBy[];
  isLoading: boolean;
  onRefresh?: () => Promise<any>;
}

const QuestionList: FC<Props> = ({
  source,
  order,
  data,
  orderList,
  isLoading = false,
  onRefresh,
}) => {
  const { t } = useTranslation('translation', { keyPrefix: 'question' });
  const navigate = useNavigate();
  const [urlSearchParams] = useSearchParams();
  const { isSkeletonShow } = useSkeletonControl(isLoading);
  const curOrder =
    order || urlSearchParams.get('order') || QUESTION_ORDER_KEYS[0];
  const curPage = Number(urlSearchParams.get('page')) || 1;
  const pageSize = 20;
  const count = data?.count || 0;
  const orderKeys = orderList || QUESTION_ORDER_KEYS;
  const pinData =
    source === 'questions'
      ? data?.list?.filter((v) => v.pin === 2).slice(0, 3)
      : [];
  const renderData = data?.list?.filter(
    (v) => pinData.findIndex((p) => p.id === v.id) === -1,
  );

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleNavigate = (href) => {
    navigate(href);
  };

  const handleRefresh = async () => {
    if (!onRefresh || isRefreshing) {
      return;
    }
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  const renderQuestionItem = (li, isPinned = false) => {
    const itemUrl = pathFactory.questionLanding(li.id, li.url_title);
    const activityTime = curOrder === 'active' ? li.operated_at : li.created_at;
    const isAccepted = Number(li.accepted_answer_id) >= 1;

    return (
      <ListGroup.Item
        key={li.id}
        action
        as="li"
        onClick={() => handleNavigate(itemUrl)}
        className={`question-list-row border-end-0 pointer ${
          li.featured ? 'question-list-row-featured' : 'border-start-0'
        }`}>
        <div className="question-list-grid">
          <Avatar
            avatar={li.operator?.avatar}
            size="48px"
            searchStr="s=96"
            className="question-list-mobile-avatar rounded-2"
            alt={li.operator?.display_name}
          />
          <div className="question-list-main">
            <h5 className="question-list-title text-wrap text-break">
              <NavLink
                className="question-list-title-link link-dark"
                onClick={(e) => e.stopPropagation()}
                to={itemUrl}>
                {li.featured ? (
                  <span className="question-featured-badge">精选</span>
                ) : null}
                {isPinned ? (
                  <Icon name="pin-angle-fill question-list-title-icon" />
                ) : null}
                <span>{li.title}</span>
                {li.status === 2 ? (
                  <span className="question-list-closed">[{t('closed')}]</span>
                ) : null}
              </NavLink>
            </h5>

            <div className="question-tags question-list-tags">
              {Array.isArray(li.tags)
                ? sortTagsForDisplay(li.tags).map((tag, index, arr) => {
                    return (
                      <Tag
                        key={tag.slug_name}
                        className={`${arr.length - 1 === index ? '' : 'me-1'}`}
                        data={tag}
                      />
                    );
                  })
                : null}
            </div>
          </div>

          <div
            className={`question-list-metric question-list-answer ${
              isAccepted ? 'question-list-answer-accepted' : ''
            }`}>
            <span className="question-list-mobile-label">{t('answers')}</span>
            <span>{formatCount(li.answer_count)}</span>
          </div>
          <div className="question-list-metric question-list-views">
            <span className="question-list-mobile-label">{t('views')}</span>
            <span>{formatCount(li.view_count)}</span>
          </div>
          <div className="question-list-activity">
            <span className="question-list-mobile-label">{t('activity')}</span>
            <FormatTime time={activityTime} className="text-secondary" />
          </div>
        </div>
      </ListGroup.Item>
    );
  };

  return (
    <div>
      <div className="question-list-header mb-3 d-flex flex-wrap justify-content-between">
        <h5 className="question-list-heading fs-5 text-nowrap mb-3 mb-md-0">
          {source === 'questions'
            ? t('all_questions')
            : source === 'linked'
              ? t('x_posts', { count })
              : t('x_questions', { count })}
        </h5>
        <div className="question-list-actions d-flex flex-wrap align-items-center gap-2">
          <div className="question-list-sort">
            <QueryGroup
              data={orderKeys}
              currentSort={curOrder}
              pathname={source === 'questions' ? '/questions' : ''}
              i18nKeyPrefix="question"
              maxBtnCount={source === 'tag' ? 3 : 4}
            />
          </div>
          {source === 'questions' ? (
            <Button
              as={NavLink as any}
              to="/questions/add"
              size="sm"
              className="question-list-create-post">
              <Icon name="plus-lg" />
              <span>发布帖子</span>
            </Button>
          ) : null}
          {onRefresh ? (
            <Button
              className="question-list-refresh"
              variant="outline-secondary"
              size="sm"
              disabled={isRefreshing}
              title={t('refresh')}
              aria-label={t('refresh')}
              onClick={handleRefresh}>
              <Icon
                name="arrow-clockwise"
                className={isRefreshing ? 'question-list-refreshing' : ''}
              />
            </Button>
          ) : null}
        </div>
      </div>
      <div className="question-list-table-head">
        <span>{t('questions')}</span>
        <span>{t('answers')}</span>
        <span>{t('views')}</span>
        <span>{t('activity')}</span>
      </div>
      <ListGroup className="question-list-dense question-list-view-card rounded-0">
        {isSkeletonShow ? (
          <QuestionListLoader />
        ) : (
          <>
            {pinData?.map((li) => renderQuestionItem(li, true))}
            {renderData?.map((li) => renderQuestionItem(li))}
          </>
        )}
      </ListGroup>
      {count <= 0 && !isLoading && <Empty />}
      <div className="mt-4 mb-2 d-flex justify-content-center">
        <Pagination
          currentPage={curPage}
          totalSize={count}
          pageSize={pageSize}
          pathname={source === 'questions' ? '/questions' : ''}
        />
      </div>
    </div>
  );
};
export default QuestionList;
