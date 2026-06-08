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

import * as Type from '@/common/interface';

interface IProps {
  list: Type.ReviewTypeItem[] | undefined;
  checked: string;
  callback: (type: string) => void;
}

const Index: FC<IProps> = ({ list, checked, callback }) => {
  return (
    <div className="review-type-switch" aria-label="审核类型">
      {list?.map((item) => {
        const active = checked === item.name;
        return (
          <button
            key={item.name}
            type="button"
            className="review-type-switch-item"
            aria-pressed={active}
            data-active={active}
            onClick={() => callback(item.name)}>
            <span>{item.label}</span>
            <span className="review-type-switch-count">{item.todo_amount}</span>
          </button>
        );
      })}
    </div>
  );
};

export default Index;
