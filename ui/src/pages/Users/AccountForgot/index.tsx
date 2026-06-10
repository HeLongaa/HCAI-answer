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

import AuthBackButton from '@/components/AuthBackButton';
import { usePageTags } from '@/hooks';
import AuthBrandHeader from '../components/AuthBrandHeader';

import SendEmail from './components/sendEmail';
import '../Login/index.scss';

const Index: React.FC = () => {
  const { t } = useTranslation('translation', { keyPrefix: 'account_forgot' });
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');

  const callback = (param: number, mail: string) => {
    setStep(param);
    setEmail(mail);
  };
  usePageTags({
    title: t('account_recovery', { keyPrefix: 'page_title' }),
  });
  return (
    <Container className="auth-page auth-login-page">
      {step === 1 && (
        <div className="auth-shell">
          <Col className="auth-card mx-auto" md={7} lg={5} xl={4}>
            <AuthBackButton fallbackTo="/users/login" />
            <AuthBrandHeader
              title={t('page_title')}
              subtitle="输入邮箱后，我们会发送一封恢复邮件帮助你重新访问账号。"
            />
            <SendEmail visible={step === 1} callback={callback} />
          </Col>
        </div>
      )}
      {step === 2 && (
        <div className="auth-shell">
          <Col className="auth-card mx-auto" md={7} lg={5} xl={4}>
            <AuthBackButton fallbackTo="/users/login" />
            <AuthBrandHeader title="邮件已发送" />
            <div className="auth-success-message">
              <p>
                <Trans
                  i18nKey="account_forgot.send_success"
                  values={{ mail: email }}
                  components={{ bold: <strong /> }}
                />
              </p>
            </div>
          </Col>
        </div>
      )}
    </Container>
  );
};

export default React.memo(Index);
