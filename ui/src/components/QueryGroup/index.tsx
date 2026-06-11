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
import { ButtonGroup, Button, Dropdown } from 'react-bootstrap';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import classNames from 'classnames';

import { REACT_BASE_PATH } from '@/router/alias';
import { floppyNavigation } from '@/utils';

import './index.scss';

interface Props {
  data;
  i18nKeyPrefix: string;
  currentSort: string;
  sortKey?: string;
  className?: string;
  pathname?: string;
  wrapClassName?: string;
  maxBtnCount?: number;
}
const Index: FC<Props> = ({
  data = [],
  currentSort = '',
  sortKey = 'order',
  i18nKeyPrefix = '',
  className = '',
  pathname = '',
  wrapClassName = '',
  maxBtnCount = 3,
}) => {
  const [searchParams, setUrlSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const { t } = useTranslation('translation', {
    keyPrefix: i18nKeyPrefix,
  });

  const getSortKey = (btn) => (typeof btn === 'string' ? btn : btn?.sort || '');
  const getNameKey = (btn) =>
    typeof btn === 'string' ? btn : btn?.name || btn?.sort || '';
  const translateName = (name: string) =>
    t(name, {
      defaultValue: name,
    });

  const handleParams = (order): string => {
    searchParams.delete('page');
    searchParams.set(sortKey, order);
    const searchStr = searchParams.toString();
    return `?${searchStr}`;
  };

  const handleClick = (e, type) => {
    const str = handleParams(type);
    if (floppyNavigation.shouldProcessLinkClick(e)) {
      e.preventDefault();
      if (pathname) {
        navigate(`${pathname}${str}`);
      } else {
        setUrlSearchParams(str);
      }
    }
  };
  const moreBtnData = data.length > 4 ? data.slice(maxBtnCount) : [];
  const normalBtnData = data.length > 4 ? data.slice(0, maxBtnCount) : data;
  const currentBtn = moreBtnData.find((btn) => {
    return getSortKey(btn) === currentSort;
  });
  const currentItem = data.find((btn) => {
    return getSortKey(btn) === currentSort;
  });
  const currentName =
    getNameKey(currentItem) || getNameKey(data[0]) || currentSort || 'more';

  return (
    <>
      <ButtonGroup size="sm" className={classNames('md-show', wrapClassName)}>
        {normalBtnData.map((btn) => {
          const key = getSortKey(btn);
          const name = getNameKey(btn);
          return (
            <Button
              key={key}
              variant="outline-secondary"
              active={currentSort === key}
              className={classNames('text-capitalize fit-content', className)}
              href={
                pathname
                  ? `${REACT_BASE_PATH}${pathname}${handleParams(key)}`
                  : handleParams(key)
              }
              onClick={(evt) => handleClick(evt, key)}>
              {translateName(name)}
            </Button>
          );
        })}
        {moreBtnData.length > 0 && (
          <Dropdown
            as={ButtonGroup}
            align="end"
            drop="down"
            className="question-filter-dropdown">
            <Dropdown.Toggle
              size="sm"
              variant={currentBtn ? 'secondary' : 'outline-secondary'}>
              {currentBtn
                ? translateName(getNameKey(currentBtn))
                : translateName('more')}
            </Dropdown.Toggle>
            <Dropdown.Menu
              renderOnMount
              popperConfig={{
                strategy: 'fixed',
                modifiers: [
                  { name: 'flip', enabled: false },
                  { name: 'preventOverflow', enabled: false },
                ],
              }}>
              {moreBtnData.map((btn) => {
                const key = getSortKey(btn);
                const name = getNameKey(btn);
                return (
                  <Dropdown.Item
                    as="a"
                    key={key}
                    active={currentSort === key}
                    className={classNames('text-capitalize', className)}
                    href={
                      pathname
                        ? `${REACT_BASE_PATH}${pathname}${handleParams(key)}`
                        : handleParams(key)
                    }
                    onClick={(evt) => handleClick(evt, key)}>
                    {translateName(name)}
                  </Dropdown.Item>
                );
              })}
            </Dropdown.Menu>
          </Dropdown>
        )}
      </ButtonGroup>
      <Dropdown
        align="end"
        drop="down"
        className={classNames(
          'md-hide question-filter-dropdown',
          wrapClassName,
        )}>
        <Dropdown.Toggle size="sm" variant="outline-secondary">
          {translateName(currentName)}
        </Dropdown.Toggle>
        <Dropdown.Menu
          renderOnMount
          popperConfig={{
            strategy: 'fixed',
            modifiers: [
              { name: 'flip', enabled: false },
              { name: 'preventOverflow', enabled: false },
            ],
          }}>
          {data.map((btn) => {
            const key = getSortKey(btn);
            const name = getNameKey(btn);
            return (
              <Dropdown.Item
                as="a"
                key={key}
                active={currentSort === key}
                className={classNames('text-capitalize', className)}
                href={
                  pathname
                    ? `${REACT_BASE_PATH}${pathname}${handleParams(key)}`
                    : handleParams(key)
                }
                onClick={(evt) => handleClick(evt, key)}>
                {translateName(name)}
              </Dropdown.Item>
            );
          })}
        </Dropdown.Menu>
      </Dropdown>
    </>
  );
};

export default memo(Index);
