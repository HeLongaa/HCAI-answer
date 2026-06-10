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

import React, { useState } from 'react';
import { Container, Col } from 'react-bootstrap';
import { Trans, useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { usePageTags } from '@/hooks';
import { Unactivate, PluginRender } from '@/components';
import AuthBackButton from '@/components/AuthBackButton';
import { guard } from '@/utils';
import { loginSettingStore } from '@/stores';
import { PluginType } from '@/utils/pluginKit/interface';
import AuthBrandHeader from '../components/AuthBrandHeader';

import SignUpForm from './components/SignUpForm';
import '../Login/index.scss';

const Index: React.FC = () => {
  const [showForm, setShowForm] = useState(true);
  const { t } = useTranslation('translation', { keyPrefix: 'login' });
  const loginSetting = loginSettingStore((state) => state.login);
  const onStep = () => {
    setShowForm((bol) => !bol);
  };
  usePageTags({
    title: t('sign_up', { keyPrefix: 'page_title' }),
  });

  if (!guard.singUpAgent().ok) {
    return null;
  }

  const showSignupForm =
    loginSetting?.allow_new_registrations &&
    loginSetting.allow_email_registrations;

  return (
    <Container className="auth-page auth-login-page">
      {showForm ? (
        <div className="auth-shell">
          <Col className="auth-card mx-auto" md={7} lg={5} xl={4}>
            <AuthBackButton />
            <AuthBrandHeader
              title="创建账号"
              subtitle="加入后即可使用 AI 创作、任务协作和积分权益。"
            />
            <div className="auth-plugin-stack">
              <PluginRender
                type={PluginType.Connector}
                slug_name="third_party_connector"
                className="auth-plugin"
              />
            </div>
            {showSignupForm ? <SignUpForm callback={onStep} /> : null}
            <div className="auth-footer">
              <Trans i18nKey="login.info_login" ns="translation">
                Already have an account? <Link to="/users/login">Log in</Link>
              </Trans>
            </div>
          </Col>
        </div>
      ) : (
        <Unactivate visible={!showForm} />
      )}
    </Container>
  );
};

export default React.memo(Index);
