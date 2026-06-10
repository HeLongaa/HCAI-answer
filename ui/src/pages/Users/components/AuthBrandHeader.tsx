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

import { brandingStore, siteInfoStore } from '@/stores';

interface Props {
  subtitle?: string;
  title: string;
}

const AuthBrandHeader: FC<Props> = ({ title, subtitle }) => {
  const siteInfo = siteInfoStore((state) => state.siteInfo);
  const brandingInfo = brandingStore((state) => state.branding);
  const siteName = siteInfo.name || 'HCAI';
  const brandIcon =
    brandingInfo.square_icon ||
    brandingInfo.mobile_logo ||
    brandingInfo.logo ||
    brandingInfo.favicon;

  return (
    <div className="auth-card-header">
      <div className="auth-brand-mark" aria-hidden="true">
        {brandIcon ? (
          <img src={brandIcon} alt="" />
        ) : (
          <span>{siteName.slice(0, 1).toUpperCase()}</span>
        )}
      </div>
      <h1 className="auth-title mb-0">{title}</h1>
      {subtitle ? <p className="auth-subtitle">{subtitle}</p> : null}
    </div>
  );
};

export default memo(AuthBrandHeader);
