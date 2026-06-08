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

import { FC, useEffect, useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import cloneDeep from 'lodash/cloneDeep';

import { AccordionNav, Icon } from '@/components';
import type { MenuItem } from '@/components/AccordionNav';
import { ADMIN_NAV_MENUS } from '@/common/constants';
import { useQueryPlugins } from '@/services';
import { brandingStore, interfaceStore, siteInfoStore } from '@/stores';

interface IProps {
  showBrand?: boolean;
}

const AdminSideNav: FC<IProps> = ({ showBrand = true }) => {
  const { t } = useTranslation('translation', { keyPrefix: 'btns' });
  const interfaceLang = interfaceStore((_) => _.interface.language);
  const siteInfo = siteInfoStore((state) => state.siteInfo);
  const brandingInfo = brandingStore((state) => state.branding);
  const { data: configurablePlugins, mutate: updateConfigurablePlugins } =
    useQueryPlugins({
      status: 'active',
      have_config: true,
    });

  const menus = useMemo(() => {
    const nextMenus = cloneDeep(ADMIN_NAV_MENUS) as MenuItem[];
    if (configurablePlugins && configurablePlugins.length > 0) {
      nextMenus.forEach((item) => {
        if (item.name === 'plugins' && item.children) {
          item.children = [
            ...item.children,
            ...configurablePlugins.map(
              (plugin): MenuItem => ({
                name: plugin.slug_name,
                displayName: plugin.name,
              }),
            ),
          ];
        }
      });
    }
    return nextMenus;
  }, [configurablePlugins]);

  const observePlugins = (evt) => {
    if (evt.data.msgType === 'refreshConfigurablePlugins') {
      updateConfigurablePlugins();
    }
  };
  useEffect(() => {
    window.addEventListener('message', observePlugins);
    return () => {
      window.removeEventListener('message', observePlugins);
    };
  }, []);
  useEffect(() => {
    updateConfigurablePlugins();
  }, [interfaceLang]);

  return (
    <div id="adminSideNav">
      {showBrand && (
        <NavLink to="/" className="admin-side-site-brand side-nav-site-brand">
          {brandingInfo.mobile_logo || brandingInfo.logo ? (
            <img
              className="admin-side-brand-logo side-nav-brand-logo"
              src={brandingInfo.mobile_logo || brandingInfo.logo}
              alt={siteInfo.name}
            />
          ) : (
            <span className="admin-side-brand-mark side-nav-brand-mark">
              {siteInfo.name.slice(0, 1)}
            </span>
          )}
          <span className="admin-side-brand-name side-nav-brand-name">
            {siteInfo.name}
          </span>
        </NavLink>
      )}
      <NavLink to="/" className="admin-back-site">
        <Icon name="arrow-left" />
        <span>{t('back_sites')}</span>
      </NavLink>
      <AccordionNav menus={menus} path="/admin/" />
    </div>
  );
};

export default AdminSideNav;
