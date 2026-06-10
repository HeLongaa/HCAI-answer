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
import { Row, Col, Nav } from 'react-bootstrap';
import { Outlet, NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import AuthBackButton from '@/components/AuthBackButton';

import './index.scss';

const Index: FC = () => {
  const { t } = useTranslation('translation', { keyPrefix: 'nav_menus' });
  return (
    <main className="legal-public-page">
      <Row className="legal-public-shell">
        <Col xxl={12}>
          <div className="legal-public-topbar">
            <AuthBackButton fallbackTo="/users/register" mode="fallback" />
            <Nav className="legal-public-tabs flex-nowrap" variant="pills">
              <NavLink to="/tos" key="tos" className="nav-link">
                {t('tos')}
              </NavLink>
              <NavLink to="/privacy" key="privacy" className="nav-link">
                {t('privacy')}
              </NavLink>
            </Nav>
            <span className="legal-public-topbar-spacer" aria-hidden="true" />
          </div>
        </Col>
        <Col xxl={12}>
          <section className="legal-public-card">
            <Outlet />
          </section>
        </Col>
      </Row>
    </main>
  );
};

export default Index;
