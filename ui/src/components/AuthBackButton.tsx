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

import { FC, MouseEvent, memo } from 'react';
import { useNavigate } from 'react-router-dom';

import Icon from './Icon';

interface Props {
  fallbackTo?: string;
  mode?: 'history' | 'fallback';
}

const AuthBackButton: FC<Props> = ({ fallbackTo = '/', mode = 'history' }) => {
  const navigate = useNavigate();

  const handleClick = (evt: MouseEvent<HTMLButtonElement>) => {
    evt.preventDefault();
    if (mode === 'history' && window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(fallbackTo, { replace: true });
  };

  return (
    <button
      type="button"
      className="auth-back-button"
      aria-label="返回"
      onClick={handleClick}>
      <Icon name="arrow-left-short" />
      <span>返回</span>
    </button>
  );
};

export default memo(AuthBackButton);
