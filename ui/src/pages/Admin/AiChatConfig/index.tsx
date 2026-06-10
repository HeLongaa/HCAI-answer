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

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Form,
  Modal,
  Row,
  Spinner,
  Tab,
  Table,
  Tabs,
} from 'react-bootstrap';
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';

import type * as Type from '@/common/interface';
import { useToast } from '@/hooks';
import {
  createAiChatConsumeRate,
  createAiChatModelMapping,
  createAiChatProvider,
  createAiChatSubscriptionPlan,
  createAdminAiImageModel,
  createAdminAiImageProvider,
  createAdminAiVideoModel,
  createAdminAiVideoProvider,
  deleteAiChatModelMapping,
  deleteAiChatProvider,
  deleteAiChatSubscriptionPlan,
  deleteAdminAiImageModel,
  deleteAdminAiImageProvider,
  deleteAdminAiVideoModel,
  deleteAdminAiVideoProvider,
  fetchAiChatProviderModels,
  generateAiChatRedeemCodes,
  getAiChatConsumeRates,
  getAiChatModelMappings,
  getAiChatProviders,
  getAiChatRedeemCodes,
  getAiChatSubscriptionPlans,
  getAdminAiChatSetting,
  getAdminAiImageModels,
  getAdminAiImageProviders,
  getAdminAiImageSetting,
  getAdminAiVideoModels,
  getAdminAiVideoProviders,
  getAdminAiVideoSetting,
  testAiChatProviderModel,
  updateAiChatConsumeRate,
  updateAiChatModelMapping,
  updateAiChatProvider,
  updateAiChatSubscriptionPlan,
  updateAdminAiChatSetting,
  updateAdminAiImageModel,
  updateAdminAiImageProvider,
  updateAdminAiImageSetting,
  updateAdminAiVideoModel,
  updateAdminAiVideoProvider,
  updateAdminAiVideoSetting,
} from '@/services';

import './index.scss';

const providerInit = {
  id: 0,
  name: '',
  base_url: 'https://api.openai.com/v1',
  api_key: '',
  enabled: true,
  supports_stream: true,
  remark: '',
};

const newMappingItem = (priority = 1) => ({
  id: 0,
  client_id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  provider_id: 0,
  provider_model_id: '',
  priority,
  enabled: true,
});

const mappingInit = {
  id: 0,
  site_model_id: '',
  display_name: '',
  description: '',
  enabled: true,
  sort_order: 0,
  supports_vision: false,
  fallback_enabled: true,
  default_provider_model_id: '',
  items: [newMappingItem()],
};

const planInit = {
  id: 0,
  plan_id: '',
  name: '',
  enabled: true,
  monthly_price: 0,
  chat_points: 0,
  image_quota: 0,
  video_daily_quota: 0,
  video_quota: 0,
  purchase_url: '',
  model_mapping_ids: [] as number[],
  task_description: '',
  sort_order: 0,
};

const rateInit = {
  id: 0,
  model_mapping_id: 0,
  consume_rate: 1,
  enabled: true,
  remark: '',
};

const chatSettingInit = {
  title_model_id: '',
};

const imageProviderInit = {
  id: 0,
  name: '',
  base_url: 'https://api.openai.com/v1',
  api_key: '',
  api_format: 'openai' as Type.AdminAiImageProviderParams['api_format'],
  flow2api_model_groups: [] as string[],
  enabled: true,
  remark: '',
};

const flow2APIImageModelGroups = [
  'gemini-3.1-flash-image',
  'gemini-3.0-pro-image',
];

const imageModelUpstreamInit = {
  client_id: '',
  provider_id: 0,
  provider_model_id: '',
  quality_model_id: '',
  agent_model_id: '',
  responses_model_id: '',
  weight: 1,
  enabled: true,
};

type ImageAPIMode = Type.AdminAiImageModelParams['api_mode'];

const imageModelInit = {
  id: 0,
  provider_id: 0,
  site_model_id: '',
  provider_model_id: '',
  quality_model_id: '',
  agent_model_id: '',
  display_name: '',
  description: '',
  default_size: '1024x1024',
  api_mode: 'images' as ImageAPIMode,
  supports_edits: true,
  supports_references: true,
  supports_stream: false,
  default_quality: 'auto',
  default_format: 'png',
  extra_config: '',
  enabled: true,
  sort_order: 0,
  upstreams: [] as Array<typeof imageModelUpstreamInit>,
};

type ImageModelUpstreamForm = typeof imageModelUpstreamInit;

const newImageModelUpstream = (): ImageModelUpstreamForm => ({
  ...imageModelUpstreamInit,
  client_id:
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`,
});

const normalizeImageModelUpstreams = (
  upstreams?: Array<Type.AiImageModelUpstream | ImageModelUpstreamForm>,
  isGrokProvider?: (providerID: number) => boolean,
) =>
  (upstreams || [])
    .map((upstream, index) => ({
      client_id:
        'client_id' in upstream ? upstream.client_id : `saved-${index}`,
      provider_id: Number(upstream.provider_id || 0),
      provider_model_id: upstream.provider_model_id || '',
      quality_model_id:
        !isGrokProvider || isGrokProvider(Number(upstream.provider_id || 0))
          ? upstream.quality_model_id || ''
          : '',
      agent_model_id: upstream.agent_model_id || '',
      responses_model_id: upstream.responses_model_id || '',
      weight: Math.max(1, Number(upstream.weight || 1)),
      enabled: upstream.enabled !== false,
    }))
    .filter(
      (upstream) =>
        upstream.provider_id > 0 || upstream.provider_model_id.trim() !== '',
    );

const imageSettingInit = {
  retention_days: 30,
};

const videoProviderInit = {
  id: 0,
  name: '',
  base_url: 'https://api.openai.com/v1',
  api_key: '',
  enabled: true,
  remark: '',
};

const videoModelInit = {
  id: 0,
  provider_id: 0,
  site_model_id: 'grok-imagine-video',
  provider_model_id: 'grok-imagine-video',
  display_name: 'Grok Imagine Video',
  description: '',
  default_size: '1280x720',
  default_seconds: 6,
  default_resolution: '720p',
  default_preset: 'custom',
  enabled: true,
  sort_order: 0,
};

const videoSettingInit = {
  retention_days: 30,
};

const redeemInit = {
  plan_id: 0,
  count: 10,
  duration_months: 1,
  prefix: '',
  remark: '',
};

const tabKeys = [
  'providers',
  'chat-settings',
  'mappings',
  'plans',
  'redeem-codes',
  'rates',
  'images',
  'videos',
];

const formatQuota = (value: number) => (value === -1 ? '无限制' : value);

const formatDateTime = (value?: number) => {
  if (!value) {
    return '-';
  }
  return new Date(value * 1000).toLocaleString();
};

const AiChatConfig = () => {
  const toast = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams<{ tab?: string }>();
  const [searchParams] = useSearchParams();
  const tabFromPath = params.tab || '';
  const legacyTab = searchParams.get('tab') || '';
  const activeTab = tabKeys.includes(tabFromPath) ? tabFromPath : 'providers';
  const [providers, setProviders] = useState<Type.AdminAiProvider[]>([]);
  const [mappings, setMappings] = useState<Type.AdminAiModelMapping[]>([]);
  const [plans, setPlans] = useState<Type.AiSubscriptionPlan[]>([]);
  const [redeemCodes, setRedeemCodes] = useState<
    Type.AiSubscriptionRedeemCode[]
  >([]);
  const [rates, setRates] = useState<Type.AiModelConsumeRate[]>([]);
  const [imageProviders, setImageProviders] = useState<
    Type.AdminAiImageProvider[]
  >([]);
  const [imageModels, setImageModels] = useState<Type.AiImageModel[]>([]);
  const [videoProviders, setVideoProviders] = useState<
    Type.AdminAiVideoProvider[]
  >([]);
  const [videoModels, setVideoModels] = useState<Type.AiVideoModel[]>([]);
  const [providerForm, setProviderForm] = useState(providerInit);
  const [mappingForm, setMappingForm] = useState(mappingInit);
  const [planForm, setPlanForm] = useState(planInit);
  const [rateForm, setRateForm] = useState(rateInit);
  const [chatSettingForm, setChatSettingForm] = useState(chatSettingInit);
  const [imageProviderForm, setImageProviderForm] = useState(imageProviderInit);
  const [imageModelForm, setImageModelForm] = useState(imageModelInit);
  const [imageSettingForm, setImageSettingForm] = useState(imageSettingInit);
  const [videoProviderForm, setVideoProviderForm] = useState(videoProviderInit);
  const [videoModelForm, setVideoModelForm] = useState(videoModelInit);
  const [videoSettingForm, setVideoSettingForm] = useState(videoSettingInit);
  const [redeemForm, setRedeemForm] = useState(redeemInit);
  const [generatedCodes, setGeneratedCodes] = useState<
    Type.AiSubscriptionRedeemCode[]
  >([]);
  const [testingProvider, setTestingProvider] =
    useState<Type.AdminAiProvider | null>(null);
  const [modelListProvider, setModelListProvider] =
    useState<Type.AdminAiProvider | null>(null);
  const [testingModelID, setTestingModelID] = useState('');
  const [testingResult, setTestingResult] =
    useState<Type.AdminAiTestProviderModelResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchingProviderID, setFetchingProviderID] = useState(0);
  const [error, setError] = useState('');

  const upstreamOptions = useMemo(
    () =>
      providers.flatMap((provider) =>
        (provider.models || []).map((model) => ({
          provider_id: provider.id,
          provider_name: provider.name,
          provider_model_id: model.provider_model_id,
          label: `${provider.name} / ${model.provider_model_id}`,
        })),
      ),
    [providers],
  );
  const getImageProviderAPIFormat = (providerID: number) =>
    imageProviders.find((provider) => provider.id === providerID)?.api_format ||
    'openai';
  const isGrokImageProviderID = (providerID: number) =>
    getImageProviderAPIFormat(providerID) === 'grok';
  const isImageModelGrokProvider = isGrokImageProviderID(
    Number(imageModelForm.provider_id || 0),
  );

  const loadAll = async (showFullLoading = false) => {
    if (showFullLoading) {
      setInitialLoading(true);
    } else {
      setLoading(true);
    }
    setError('');
    try {
      const [
        providerData,
        chatSettingData,
        mappingData,
        planData,
        redeemCodeData,
        rateData,
        imageProviderData,
        imageModelData,
        imageSettingData,
        videoProviderData,
        videoModelData,
        videoSettingData,
      ] = await Promise.all([
        getAiChatProviders(),
        getAdminAiChatSetting(),
        getAiChatModelMappings(),
        getAiChatSubscriptionPlans(),
        getAiChatRedeemCodes(),
        getAiChatConsumeRates(),
        getAdminAiImageProviders(),
        getAdminAiImageModels(),
        getAdminAiImageSetting(),
        getAdminAiVideoProviders(),
        getAdminAiVideoModels(),
        getAdminAiVideoSetting(),
      ]);
      setProviders(providerData || []);
      setChatSettingForm(chatSettingData || chatSettingInit);
      setMappings(mappingData || []);
      setPlans(planData || []);
      setRedeemCodes(redeemCodeData || []);
      setRates(rateData || []);
      setImageProviders(imageProviderData || []);
      setImageModels(imageModelData || []);
      setImageSettingForm(imageSettingData || imageSettingInit);
      setVideoProviders(videoProviderData || []);
      setVideoModels(videoModelData || []);
      setVideoSettingForm(videoSettingData || videoSettingInit);
    } catch (err: any) {
      setError(err?.msg || '加载 AI-CHAT 配置失败');
    } finally {
      setInitialLoading(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll(true);
  }, []);

  useEffect(() => {
    if (!tabFromPath && legacyTab && tabKeys.includes(legacyTab)) {
      navigate(`/admin/ai-chat-config/${legacyTab}`, { replace: true });
      return;
    }
    if (
      !tabFromPath &&
      location.pathname.replace(/\/+$/, '') === '/admin/ai-chat-config'
    ) {
      navigate('/admin/ai-chat-config/providers', { replace: true });
      return;
    }
    if (tabFromPath && !tabKeys.includes(tabFromPath)) {
      navigate('/admin/ai-chat-config/providers', { replace: true });
    }
  }, [legacyTab, location.pathname, navigate, tabFromPath]);

  const showSuccess = (msg: string) => {
    toast.onShow({ msg, variant: 'success' });
  };

  const deleteProvider = async (provider: Type.AdminAiProvider) => {
    if (!window.confirm(`确认删除 Provider「${provider.name}」？`)) {
      return;
    }
    setError('');
    try {
      await deleteAiChatProvider(provider.id);
      showSuccess('Provider 已删除');
      await loadAll();
    } catch (err: any) {
      setError(err?.msg || 'Provider 删除失败');
    }
  };

  const deleteImageProvider = async (provider: Type.AdminAiImageProvider) => {
    if (!window.confirm(`确认删除生图 Provider「${provider.name}」？`)) {
      return;
    }
    setError('');
    try {
      await deleteAdminAiImageProvider(provider.id);
      showSuccess('生图 Provider 已删除');
      await loadAll();
    } catch (err: any) {
      setError(err?.msg || '生图 Provider 删除失败');
    }
  };

  const deleteVideoProvider = async (provider: Type.AdminAiVideoProvider) => {
    if (!window.confirm(`确认删除视频 Provider「${provider.name}」？`)) {
      return;
    }
    setError('');
    try {
      await deleteAdminAiVideoProvider(provider.id);
      showSuccess('视频 Provider 已删除');
      await loadAll();
    } catch (err: any) {
      setError(err?.msg || '视频 Provider 删除失败');
    }
  };

  const refreshProviderModels = async (
    providerID: number,
    showToast = true,
  ) => {
    setFetchingProviderID(providerID);
    setError('');
    try {
      const models = await fetchAiChatProviderModels(providerID);
      if (showToast) {
        showSuccess('模型列表已更新');
      }
      return models || [];
    } catch (err: any) {
      const msg = err?.msg || '获取模型列表失败';
      setError(msg);
      throw err;
    } finally {
      setFetchingProviderID(0);
    }
  };

  const submitProvider = async (evt: FormEvent) => {
    evt.preventDefault();
    setError('');
    try {
      if (providerForm.id) {
        await updateAiChatProvider(providerForm.id, providerForm);
        setProviderForm(providerInit);
        showSuccess('Provider 已保存');
        await loadAll();
      } else {
        const provider = await createAiChatProvider(providerForm);
        setProviderForm(providerInit);
        try {
          const models = await refreshProviderModels(provider.id, false);
          showSuccess(`Provider 已保存，已获取 ${models.length} 个模型`);
          await loadAll();
        } catch (fetchErr: any) {
          showSuccess('Provider 已保存');
          setError(fetchErr?.msg || 'Provider 已保存，但自动获取模型列表失败');
          await loadAll();
        }
      }
    } catch (err: any) {
      setError(err?.msg || 'Provider 保存失败');
    }
  };

  const submitMapping = async (evt: FormEvent) => {
    evt.preventDefault();
    setError('');
    try {
      const payload = {
        ...mappingForm,
        sort_order: Number(mappingForm.sort_order),
        items: mappingForm.items.map(({ client_id, ...item }) => ({
          ...item,
          provider_id: Number(item.provider_id),
          priority: Number(item.priority),
        })),
      };
      if (mappingForm.id) {
        await updateAiChatModelMapping(mappingForm.id, payload);
      } else {
        await createAiChatModelMapping(payload);
      }
      setMappingForm(mappingInit);
      showSuccess('模型映射已保存');
      await loadAll();
    } catch (err: any) {
      setError(err?.msg || '模型映射保存失败');
    }
  };

  const submitChatSetting = async (evt: FormEvent) => {
    evt.preventDefault();
    setError('');
    try {
      const data = await updateAdminAiChatSetting({
        title_model_id: chatSettingForm.title_model_id,
      });
      setChatSettingForm(data || chatSettingInit);
      showSuccess('聊天设置已保存');
      await loadAll();
    } catch (err: any) {
      setError(err?.msg || '聊天设置保存失败');
    }
  };

  const submitPlan = async (evt: FormEvent) => {
    evt.preventDefault();
    setError('');
    try {
      const payload = {
        ...planForm,
        monthly_price: Number(planForm.monthly_price),
        chat_points: Number(planForm.chat_points),
        image_quota: Number(planForm.image_quota),
        video_daily_quota: Number(planForm.video_daily_quota),
        video_quota: Number(planForm.video_quota),
        sort_order: Number(planForm.sort_order),
        model_mapping_ids: planForm.model_mapping_ids.map(Number),
      };
      if (planForm.id) {
        await updateAiChatSubscriptionPlan(planForm.id, payload);
      } else {
        await createAiChatSubscriptionPlan(payload);
      }
      setPlanForm(planInit);
      showSuccess('订阅等级已保存');
      await loadAll();
    } catch (err: any) {
      setError(err?.msg || '订阅等级保存失败');
    }
  };

  const submitRate = async (evt: FormEvent) => {
    evt.preventDefault();
    setError('');
    try {
      const payload = {
        ...rateForm,
        model_mapping_id: Number(rateForm.model_mapping_id),
        consume_rate: Number(rateForm.consume_rate),
      };
      if (rateForm.id) {
        await updateAiChatConsumeRate(rateForm.id, payload);
      } else {
        await createAiChatConsumeRate(payload);
      }
      setRateForm(rateInit);
      showSuccess('消耗系数已保存');
      await loadAll();
    } catch (err: any) {
      setError(err?.msg || '消耗系数保存失败');
    }
  };

  const submitImageProvider = async (evt: FormEvent) => {
    evt.preventDefault();
    setError('');
    try {
      if (imageProviderForm.id) {
        await updateAdminAiImageProvider(
          imageProviderForm.id,
          imageProviderForm,
        );
      } else {
        await createAdminAiImageProvider(imageProviderForm);
      }
      setImageProviderForm(imageProviderInit);
      showSuccess('生图 Provider 已保存');
      await loadAll();
    } catch (err: any) {
      setError(err?.msg || '生图 Provider 保存失败');
    }
  };

  const submitImageModel = async (evt: FormEvent) => {
    evt.preventDefault();
    setError('');
    try {
      const normalizedUpstreams = normalizeImageModelUpstreams(
        imageModelForm.upstreams,
        isGrokImageProviderID,
      );
      const payload = {
        ...imageModelForm,
        provider_id: Number(imageModelForm.provider_id),
        sort_order: Number(imageModelForm.sort_order),
        quality_model_id: isImageModelGrokProvider
          ? imageModelForm.quality_model_id || ''
          : '',
        upstreams: normalizedUpstreams.map(
          ({ client_id, ...upstream }) => upstream,
        ),
      };
      if (imageModelForm.id) {
        await updateAdminAiImageModel(imageModelForm.id, payload);
      } else {
        await createAdminAiImageModel(payload);
      }
      setImageModelForm(imageModelInit);
      showSuccess('生图模型已保存');
      await loadAll();
    } catch (err: any) {
      setError(err?.msg || '生图模型保存失败');
    }
  };

  const submitImageSetting = async (evt: FormEvent) => {
    evt.preventDefault();
    setError('');
    try {
      await updateAdminAiImageSetting({
        retention_days: Number(imageSettingForm.retention_days),
      });
      showSuccess('生图保存时间已更新');
      await loadAll();
    } catch (err: any) {
      setError(err?.msg || '生图保存时间更新失败');
    }
  };

  const submitVideoProvider = async (evt: FormEvent) => {
    evt.preventDefault();
    setError('');
    try {
      if (videoProviderForm.id) {
        await updateAdminAiVideoProvider(
          videoProviderForm.id,
          videoProviderForm,
        );
      } else {
        await createAdminAiVideoProvider(videoProviderForm);
      }
      setVideoProviderForm(videoProviderInit);
      showSuccess('视频 Provider 已保存');
      await loadAll();
    } catch (err: any) {
      setError(err?.msg || '视频 Provider 保存失败');
    }
  };

  const submitVideoModel = async (evt: FormEvent) => {
    evt.preventDefault();
    setError('');
    try {
      const payload = {
        ...videoModelForm,
        provider_id: Number(videoModelForm.provider_id),
        default_seconds: Number(videoModelForm.default_seconds),
        sort_order: Number(videoModelForm.sort_order),
      };
      if (videoModelForm.id) {
        await updateAdminAiVideoModel(videoModelForm.id, payload);
      } else {
        await createAdminAiVideoModel(payload);
      }
      setVideoModelForm(videoModelInit);
      showSuccess('视频模型已保存');
      await loadAll();
    } catch (err: any) {
      setError(err?.msg || '视频模型保存失败');
    }
  };

  const submitVideoSetting = async (evt: FormEvent) => {
    evt.preventDefault();
    setError('');
    try {
      await updateAdminAiVideoSetting({
        retention_days: Number(videoSettingForm.retention_days),
      });
      showSuccess('视频保存时间已更新');
      await loadAll();
    } catch (err: any) {
      setError(err?.msg || '视频保存时间更新失败');
    }
  };

  const submitRedeemCodes = async (evt: FormEvent) => {
    evt.preventDefault();
    setError('');
    setGeneratedCodes([]);
    try {
      const payload = {
        ...redeemForm,
        plan_id: Number(redeemForm.plan_id),
        count: Number(redeemForm.count),
        duration_months: Number(redeemForm.duration_months),
      };
      const resp = await generateAiChatRedeemCodes(payload);
      setGeneratedCodes(resp || []);
      setRedeemForm({ ...redeemForm, count: 10 });
      showSuccess('兑换码已生成');
      await loadAll();
    } catch (err: any) {
      setError(err?.msg || '兑换码生成失败');
    }
  };

  const fetchModels = async (providerID: number) => {
    try {
      await refreshProviderModels(providerID);
      await loadAll();
    } catch {
      // Error has already been surfaced by refreshProviderModels.
    }
  };

  const openTestProvider = (provider) => {
    const firstModel = provider.models?.[0]?.provider_model_id || '';
    setTestingProvider(provider);
    setTestingModelID(firstModel);
    setTestingResult(null);
    setError('');
  };

  const closeTestProvider = () => {
    if (testing) {
      return;
    }
    setTestingProvider(null);
    setTestingModelID('');
    setTestingResult(null);
  };

  const testProviderModel = async () => {
    if (!testingProvider || !testingModelID) {
      return;
    }
    setTesting(true);
    setTestingResult(null);
    setError('');
    try {
      const resp = await testAiChatProviderModel(testingProvider.id, {
        provider_model_id: testingModelID,
      });
      setTestingResult(resp);
      showSuccess('模型测试成功');
    } catch (err: any) {
      setTestingResult({
        provider_id: testingProvider.id,
        provider_model_id: testingModelID,
        message: '',
        raw_response: '',
        error: err?.msg || '模型测试失败',
      });
    } finally {
      setTesting(false);
    }
  };

  const updateMappingItem = (
    index: number,
    patch: Partial<(typeof mappingForm.items)[0]>,
  ) => {
    const items = [...mappingForm.items];
    items[index] = { ...items[index], ...patch };
    setMappingForm({ ...mappingForm, items });
  };

  const extraPlanCount = plans.filter((plan) => plan.plan_id !== 'free').length;
  const paidPlans = plans.filter((plan) => plan.plan_id !== 'free');

  if (initialLoading) {
    return <Spinner animation="border" />;
  }

  return (
    <div className="ai-chat-config-page">
      <h3 className="mb-4">
        AI-CHAT配置
        {loading ? (
          <Spinner animation="border" size="sm" className="ms-2" />
        ) : null}
      </h3>
      {error ? <Alert variant="danger">{error}</Alert> : null}
      <Tabs activeKey={activeTab} className="ai-chat-config-tabs d-none">
        <Tab eventKey="providers" title="Provider 管理">
          <Card className="mb-4">
            <Card.Body>
              <Form onSubmit={submitProvider}>
                <Row>
                  <Col md={4}>
                    <Form.Group className="mb-3">
                      <Form.Label>Provider 名称</Form.Label>
                      <Form.Control
                        required
                        value={providerForm.name}
                        onChange={(e) =>
                          setProviderForm({
                            ...providerForm,
                            name: e.target.value,
                          })
                        }
                      />
                    </Form.Group>
                  </Col>
                  <Col md={5}>
                    <Form.Group className="mb-3">
                      <Form.Label>Base URL</Form.Label>
                      <Form.Control
                        required
                        value={providerForm.base_url}
                        onChange={(e) =>
                          setProviderForm({
                            ...providerForm,
                            base_url: e.target.value,
                          })
                        }
                      />
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group className="mb-3">
                      <Form.Label>API Key</Form.Label>
                      <Form.Control
                        type="password"
                        required={!providerForm.id}
                        placeholder={
                          providerForm.id ? '留空则保持原 API Key' : ''
                        }
                        value={providerForm.api_key}
                        onChange={(e) =>
                          setProviderForm({
                            ...providerForm,
                            api_key: e.target.value,
                          })
                        }
                      />
                    </Form.Group>
                  </Col>
                </Row>
                <Form.Group className="mb-3">
                  <Form.Label>备注</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    value={providerForm.remark}
                    onChange={(e) =>
                      setProviderForm({
                        ...providerForm,
                        remark: e.target.value,
                      })
                    }
                  />
                </Form.Group>
                <Form.Check
                  className="mb-3"
                  type="switch"
                  label="启用"
                  checked={providerForm.enabled}
                  onChange={(e) =>
                    setProviderForm({
                      ...providerForm,
                      enabled: e.target.checked,
                    })
                  }
                />
                <Form.Check
                  className="mb-3"
                  type="switch"
                  label="支持流式输出"
                  checked={providerForm.supports_stream}
                  onChange={(e) =>
                    setProviderForm({
                      ...providerForm,
                      supports_stream: e.target.checked,
                    })
                  }
                />
                <Button type="submit" className="me-2">
                  保存 Provider
                </Button>
                {providerForm.id ? (
                  <Button
                    type="button"
                    variant="link"
                    onClick={() => setProviderForm(providerInit)}>
                    取消编辑
                  </Button>
                ) : null}
              </Form>
            </Card.Body>
          </Card>
          <Table responsive hover>
            <thead>
              <tr>
                <th>名称</th>
                <th>Base URL</th>
                <th>状态</th>
                <th>流式</th>
                <th>模型</th>
                <th className="ai-chat-config-action-col">操作</th>
              </tr>
            </thead>
            <tbody>
              {providers.map((provider) => (
                <tr key={provider.id}>
                  <td
                    className="ai-chat-config-text-cell"
                    title={provider.name}>
                    {provider.name}
                  </td>
                  <td
                    className="ai-chat-config-text-cell"
                    title={provider.base_url}>
                    {provider.base_url}
                  </td>
                  <td>
                    <Badge bg={provider.enabled ? 'success' : 'secondary'}>
                      {provider.enabled ? '启用' : '禁用'}
                    </Badge>
                  </td>
                  <td>
                    <Badge
                      bg={provider.supports_stream ? 'success' : 'secondary'}>
                      {provider.supports_stream ? '支持' : '不支持'}
                    </Badge>
                  </td>
                  <td>
                    <Button
                      type="button"
                      size="sm"
                      variant="link"
                      className="ai-chat-config-model-count-btn"
                      onClick={() => setModelListProvider(provider)}>
                      {provider.models?.length || 0}
                    </Button>
                  </td>
                  <td className="ai-chat-config-action-cell">
                    <Button
                      size="sm"
                      variant="outline-primary"
                      onClick={() =>
                        setProviderForm({ ...provider, api_key: '' })
                      }>
                      编辑
                    </Button>
                    <Button
                      size="sm"
                      variant="outline-secondary"
                      disabled={fetchingProviderID === provider.id}
                      onClick={() => fetchModels(provider.id)}>
                      获取模型列表
                    </Button>
                    <Button
                      size="sm"
                      variant="outline-secondary"
                      disabled={!provider.models?.length}
                      onClick={() => openTestProvider(provider)}>
                      测试模型
                    </Button>
                    <Button
                      size="sm"
                      variant="outline-danger"
                      onClick={() => deleteProvider(provider)}>
                      删除
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Tab>

        <Tab eventKey="chat-settings" title="聊天设置">
          <Card className="mb-4">
            <Card.Body>
              <Form onSubmit={submitChatSetting}>
                <Row className="align-items-end">
                  <Col md={5}>
                    <Form.Group className="mb-3">
                      <Form.Label>会话标题生成模型</Form.Label>
                      <Form.Select
                        value={chatSettingForm.title_model_id}
                        onChange={(e) =>
                          setChatSettingForm({
                            title_model_id: e.target.value,
                          })
                        }>
                        <option value="">不自动生成标题</option>
                        {mappings
                          .filter((mapping) => mapping.enabled)
                          .map((mapping) => (
                            <option
                              key={mapping.site_model_id}
                              value={mapping.site_model_id}>
                              {mapping.display_name || mapping.site_model_id}
                            </option>
                          ))}
                      </Form.Select>
                      <Form.Text>
                        开启后会根据用户首条消息和 AI 首次回复生成对话列表标题。
                      </Form.Text>
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Button type="submit" className="mb-3">
                      保存聊天设置
                    </Button>
                  </Col>
                </Row>
              </Form>
            </Card.Body>
          </Card>
        </Tab>

        <Tab eventKey="mappings" title="模型映射">
          <Card className="mb-4">
            <Card.Body>
              <Form onSubmit={submitMapping}>
                <Row>
                  <Col md={3}>
                    <Form.Group className="mb-3">
                      <Form.Label>本站模型 ID</Form.Label>
                      <Form.Control
                        required
                        placeholder="fast-chat"
                        value={mappingForm.site_model_id}
                        onChange={(e) =>
                          setMappingForm({
                            ...mappingForm,
                            site_model_id: e.target.value,
                          })
                        }
                      />
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group className="mb-3">
                      <Form.Label>显示名称</Form.Label>
                      <Form.Control
                        value={mappingForm.display_name}
                        onChange={(e) =>
                          setMappingForm({
                            ...mappingForm,
                            display_name: e.target.value,
                          })
                        }
                      />
                    </Form.Group>
                  </Col>
                  <Col md={2}>
                    <Form.Group className="mb-3">
                      <Form.Label>排序权重</Form.Label>
                      <Form.Control
                        type="number"
                        value={mappingForm.sort_order}
                        onChange={(e) =>
                          setMappingForm({
                            ...mappingForm,
                            sort_order: Number(e.target.value),
                          })
                        }
                      />
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group className="mb-3">
                      <Form.Label>默认上游模型</Form.Label>
                      <Form.Select
                        value={mappingForm.default_provider_model_id}
                        onChange={(e) =>
                          setMappingForm({
                            ...mappingForm,
                            default_provider_model_id: e.target.value,
                          })
                        }>
                        <option value="">按优先级</option>
                        {mappingForm.items.map((item) =>
                          item.provider_model_id ? (
                            <option
                              key={`${item.provider_id}-${item.provider_model_id}-${item.priority}`}
                              value={item.provider_model_id}>
                              {item.provider_model_id}
                            </option>
                          ) : null,
                        )}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                </Row>
                <Form.Group className="mb-3">
                  <Form.Label>模型说明</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    value={mappingForm.description}
                    onChange={(e) =>
                      setMappingForm({
                        ...mappingForm,
                        description: e.target.value,
                      })
                    }
                  />
                </Form.Group>
                {mappingForm.items.map((item, index) => (
                  <Row
                    key={
                      item.id ||
                      item.client_id ||
                      `${item.provider_id}-${item.provider_model_id}-${item.priority}`
                    }
                    className="align-items-end">
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>上游模型</Form.Label>
                        <Form.Select
                          required
                          value={`${item.provider_id}|${item.provider_model_id}`}
                          onChange={(e) => {
                            const [providerID, modelID] =
                              e.target.value.split('|');
                            updateMappingItem(index, {
                              provider_id: Number(providerID),
                              provider_model_id: modelID,
                            });
                          }}>
                          <option value="0|">请选择</option>
                          {upstreamOptions.map((option) => (
                            <option
                              key={`${option.provider_id}-${option.provider_model_id}`}
                              value={`${option.provider_id}|${option.provider_model_id}`}>
                              {option.label}
                            </option>
                          ))}
                        </Form.Select>
                      </Form.Group>
                    </Col>
                    <Col md={2}>
                      <Form.Group className="mb-3">
                        <Form.Label>优先级</Form.Label>
                        <Form.Control
                          type="number"
                          value={item.priority}
                          onChange={(e) =>
                            updateMappingItem(index, {
                              priority: Number(e.target.value),
                            })
                          }
                        />
                      </Form.Group>
                    </Col>
                    <Col md={2}>
                      <Form.Check
                        className="mb-3"
                        type="switch"
                        label="启用"
                        checked={item.enabled}
                        onChange={(e) =>
                          updateMappingItem(index, {
                            enabled: e.target.checked,
                          })
                        }
                      />
                    </Col>
                    <Col md={2}>
                      <Button
                        className="mb-3"
                        variant="outline-danger"
                        disabled={mappingForm.items.length === 1}
                        onClick={() =>
                          setMappingForm({
                            ...mappingForm,
                            items: mappingForm.items.filter(
                              (_, itemIndex) => itemIndex !== index,
                            ),
                          })
                        }>
                        删除
                      </Button>
                    </Col>
                  </Row>
                ))}
                <Button
                  type="button"
                  variant="outline-secondary"
                  className="me-2"
                  onClick={() =>
                    setMappingForm({
                      ...mappingForm,
                      items: [
                        ...mappingForm.items,
                        newMappingItem(mappingForm.items.length + 1),
                      ],
                    })
                  }>
                  添加上游模型
                </Button>
                <Form.Check
                  inline
                  type="switch"
                  label="启用映射"
                  checked={mappingForm.enabled}
                  onChange={(e) =>
                    setMappingForm({
                      ...mappingForm,
                      enabled: e.target.checked,
                    })
                  }
                />
                <Form.Check
                  inline
                  type="switch"
                  label="支持图片理解"
                  checked={mappingForm.supports_vision}
                  onChange={(e) =>
                    setMappingForm({
                      ...mappingForm,
                      supports_vision: e.target.checked,
                    })
                  }
                />
                <Form.Check
                  inline
                  type="switch"
                  label="失败自动切换备用"
                  checked={mappingForm.fallback_enabled}
                  onChange={(e) =>
                    setMappingForm({
                      ...mappingForm,
                      fallback_enabled: e.target.checked,
                    })
                  }
                />
                <div className="mt-3">
                  <Button type="submit">保存模型映射</Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
          <Table responsive hover>
            <thead>
              <tr>
                <th>本站模型 ID</th>
                <th>显示名称</th>
                <th>上游模型</th>
                <th>能力</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {mappings.map((mapping) => (
                <tr key={mapping.id}>
                  <td>{mapping.site_model_id}</td>
                  <td>{mapping.display_name}</td>
                  <td>
                    {(mapping.items || []).map((item) => (
                      <Badge
                        bg="light"
                        text="dark"
                        className="me-1"
                        key={item.id}>
                        {item.provider_name}/{item.provider_model_id}
                      </Badge>
                    ))}
                  </td>
                  <td>
                    {mapping.supports_vision ? (
                      <Badge bg="info">图片理解</Badge>
                    ) : (
                      <span className="text-muted">文本</span>
                    )}
                  </td>
                  <td>{mapping.enabled ? '启用' : '禁用'}</td>
                  <td>
                    <Button
                      size="sm"
                      variant="outline-primary"
                      className="me-2"
                      onClick={() =>
                        setMappingForm({
                          ...mapping,
                          items: mapping.items.map((item, index) => ({
                            ...item,
                            client_id: `saved-${index}`,
                          })),
                        })
                      }>
                      编辑
                    </Button>
                    <Button
                      size="sm"
                      variant="outline-danger"
                      onClick={() =>
                        deleteAiChatModelMapping(mapping.id).then(loadAll)
                      }>
                      删除
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Tab>

        <Tab eventKey="plans" title="用户等级 / 订阅配置">
          {extraPlanCount >= 3 && !planForm.id ? (
            <div className="ai-chat-config-notice" role="alert">
              最多只能额外添加 3 个订阅等级。
            </div>
          ) : null}
          <Card className="mb-4">
            <Card.Body>
              <Form onSubmit={submitPlan}>
                <Row>
                  <Col md={3}>
                    <Form.Group className="mb-3">
                      <Form.Label>等级 ID</Form.Label>
                      <Form.Control
                        required
                        disabled={planForm.plan_id === 'free'}
                        value={planForm.plan_id}
                        onChange={(e) =>
                          setPlanForm({ ...planForm, plan_id: e.target.value })
                        }
                      />
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group className="mb-3">
                      <Form.Label>等级名称</Form.Label>
                      <Form.Control
                        required
                        value={planForm.name}
                        onChange={(e) =>
                          setPlanForm({ ...planForm, name: e.target.value })
                        }
                      />
                    </Form.Group>
                  </Col>
                  <Col md={2}>
                    <Form.Group className="mb-3">
                      <Form.Label>月费用</Form.Label>
                      <Form.Control
                        type="number"
                        min="0"
                        value={planForm.monthly_price}
                        onChange={(e) =>
                          setPlanForm({
                            ...planForm,
                            monthly_price: Number(e.target.value),
                          })
                        }
                      />
                    </Form.Group>
                  </Col>
                  <Col md={2}>
                    <Form.Group className="mb-3">
                      <Form.Label>聊天点数</Form.Label>
                      <Form.Control
                        type="number"
                        min="-1"
                        value={planForm.chat_points}
                        onChange={(e) =>
                          setPlanForm({
                            ...planForm,
                            chat_points: Number(e.target.value),
                          })
                        }
                      />
                      <Form.Text className="text-muted">
                        -1 表示无限制
                      </Form.Text>
                    </Form.Group>
                  </Col>
                  <Col md={2}>
                    <Form.Group className="mb-3">
                      <Form.Label>图片张数</Form.Label>
                      <Form.Control
                        type="number"
                        min="0"
                        value={planForm.image_quota}
                        onChange={(e) =>
                          setPlanForm({
                            ...planForm,
                            image_quota: Number(e.target.value),
                          })
                        }
                      />
                    </Form.Group>
                  </Col>
                </Row>
                <Row>
                  <Col md={3}>
                    <Form.Group className="mb-3">
                      <Form.Label>每日视频次数</Form.Label>
                      <Form.Control
                        type="number"
                        min="-1"
                        value={planForm.video_daily_quota}
                        onChange={(e) =>
                          setPlanForm({
                            ...planForm,
                            video_daily_quota: Number(e.target.value),
                          })
                        }
                      />
                      <Form.Text className="text-muted">
                        -1 表示无限制
                      </Form.Text>
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group className="mb-3">
                      <Form.Label>每月视频次数</Form.Label>
                      <Form.Control
                        type="number"
                        min="-1"
                        value={planForm.video_quota}
                        onChange={(e) =>
                          setPlanForm({
                            ...planForm,
                            video_quota: Number(e.target.value),
                          })
                        }
                      />
                      <Form.Text className="text-muted">
                        -1 表示无限制
                      </Form.Text>
                    </Form.Group>
                  </Col>
                </Row>
                <Form.Group className="mb-3">
                  <Form.Label>购买链接</Form.Label>
                  <Form.Control
                    type="url"
                    placeholder="https://..."
                    value={planForm.purchase_url}
                    onChange={(e) =>
                      setPlanForm({
                        ...planForm,
                        purchase_url: e.target.value,
                      })
                    }
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>可用模型列表</Form.Label>
                  <div className="ai-chat-config-checkbox-list">
                    {mappings.map((mapping) => {
                      const checked = planForm.model_mapping_ids.includes(
                        mapping.id,
                      );
                      return (
                        <Form.Check
                          key={mapping.id}
                          type="checkbox"
                          id={`plan-model-${mapping.id}`}
                          label={mapping.site_model_id}
                          checked={checked}
                          onChange={(e) => {
                            setPlanForm({
                              ...planForm,
                              model_mapping_ids: e.target.checked
                                ? [...planForm.model_mapping_ids, mapping.id]
                                : planForm.model_mapping_ids.filter(
                                    (id) => id !== mapping.id,
                                  ),
                            });
                          }}
                        />
                      );
                    })}
                    {mappings.length === 0 ? (
                      <div className="text-muted">请先创建模型映射</div>
                    ) : null}
                  </div>
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>适合的任务说明</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    value={planForm.task_description}
                    onChange={(e) =>
                      setPlanForm({
                        ...planForm,
                        task_description: e.target.value,
                      })
                    }
                  />
                </Form.Group>
                <Form.Check
                  className="mb-3"
                  type="switch"
                  label="启用"
                  checked={planForm.enabled}
                  onChange={(e) =>
                    setPlanForm({ ...planForm, enabled: e.target.checked })
                  }
                />
                <Button
                  type="submit"
                  disabled={extraPlanCount >= 3 && !planForm.id}>
                  保存订阅等级
                </Button>
              </Form>
            </Card.Body>
          </Card>
          <Table responsive hover>
            <thead>
              <tr>
                <th>等级</th>
                <th>价格</th>
                <th>点数 / 图片</th>
                <th>视频额度</th>
                <th>购买链接</th>
                <th>可用模型</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr key={plan.id}>
                  <td>
                    {plan.name}{' '}
                    <span className="text-muted">({plan.plan_id})</span>
                  </td>
                  <td>{plan.monthly_price}</td>
                  <td>
                    {formatQuota(plan.chat_points)} / {plan.image_quota}
                  </td>
                  <td>
                    日 {formatQuota(plan.video_daily_quota)} / 月{' '}
                    {formatQuota(plan.video_quota)}
                  </td>
                  <td>{plan.purchase_url ? '已配置' : '未配置'}</td>
                  <td>{(plan.available_model_ids || []).join(', ')}</td>
                  <td>{plan.enabled ? '启用' : '禁用'}</td>
                  <td>
                    <Button
                      size="sm"
                      variant="outline-primary"
                      className="me-2"
                      onClick={() => setPlanForm(plan)}>
                      编辑
                    </Button>
                    <Button
                      size="sm"
                      variant="outline-danger"
                      disabled={plan.plan_id === 'free'}
                      onClick={() =>
                        deleteAiChatSubscriptionPlan(plan.id).then(loadAll)
                      }>
                      删除
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Tab>

        <Tab eventKey="redeem-codes" title="订阅兑换码">
          <Card className="mb-4">
            <Card.Body>
              <Form onSubmit={submitRedeemCodes}>
                <Row>
                  <Col md={3}>
                    <Form.Group className="mb-3">
                      <Form.Label>订阅等级</Form.Label>
                      <Form.Select
                        required
                        value={redeemForm.plan_id}
                        onChange={(e) =>
                          setRedeemForm({
                            ...redeemForm,
                            plan_id: Number(e.target.value),
                          })
                        }>
                        <option value={0}>请选择</option>
                        {paidPlans.map((plan) => (
                          <option key={plan.id} value={plan.id}>
                            {plan.name} ({plan.plan_id})
                          </option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={2}>
                    <Form.Group className="mb-3">
                      <Form.Label>生成数量</Form.Label>
                      <Form.Control
                        required
                        min={1}
                        max={500}
                        type="number"
                        value={redeemForm.count}
                        onChange={(e) =>
                          setRedeemForm({
                            ...redeemForm,
                            count: Number(e.target.value),
                          })
                        }
                      />
                    </Form.Group>
                  </Col>
                  <Col md={2}>
                    <Form.Group className="mb-3">
                      <Form.Label>有效月数</Form.Label>
                      <Form.Control
                        required
                        min={1}
                        max={120}
                        type="number"
                        value={redeemForm.duration_months}
                        onChange={(e) =>
                          setRedeemForm({
                            ...redeemForm,
                            duration_months: Number(e.target.value),
                          })
                        }
                      />
                    </Form.Group>
                  </Col>
                  <Col md={2}>
                    <Form.Group className="mb-3">
                      <Form.Label>前缀</Form.Label>
                      <Form.Control
                        placeholder="PLUS"
                        value={redeemForm.prefix}
                        onChange={(e) =>
                          setRedeemForm({
                            ...redeemForm,
                            prefix: e.target.value,
                          })
                        }
                      />
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group className="mb-3">
                      <Form.Label>备注</Form.Label>
                      <Form.Control
                        value={redeemForm.remark}
                        onChange={(e) =>
                          setRedeemForm({
                            ...redeemForm,
                            remark: e.target.value,
                          })
                        }
                      />
                    </Form.Group>
                  </Col>
                </Row>
                <Button type="submit" disabled={paidPlans.length === 0}>
                  批量生成兑换码
                </Button>
                {paidPlans.length === 0 ? (
                  <span className="text-muted ms-3">请先创建付费订阅等级</span>
                ) : null}
              </Form>
            </Card.Body>
          </Card>

          {generatedCodes.length > 0 ? (
            <Card className="mb-4">
              <Card.Body>
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <strong>本次生成</strong>
                  <Badge bg="primary">{generatedCodes.length} 个</Badge>
                </div>
                <Form.Control
                  as="textarea"
                  readOnly
                  rows={Math.min(8, generatedCodes.length)}
                  className="ai-chat-config-code-output"
                  value={generatedCodes.map((item) => item.code).join('\n')}
                />
              </Card.Body>
            </Card>
          ) : null}

          <Table responsive hover className="ai-chat-config-redeem-table">
            <thead>
              <tr>
                <th>兑换码</th>
                <th>等级</th>
                <th>月数</th>
                <th>状态</th>
                <th>使用用户</th>
                <th>使用时间</th>
                <th>批次</th>
                <th>备注</th>
              </tr>
            </thead>
            <tbody>
              {redeemCodes.map((code) => (
                <tr key={code.id}>
                  <td className="ai-chat-config-code-cell">{code.code}</td>
                  <td>
                    {code.plan_name || '-'}{' '}
                    <span className="text-muted">({code.plan_key || '-'})</span>
                  </td>
                  <td>{code.duration_months}</td>
                  <td>
                    <Badge bg={code.used ? 'secondary' : 'success'}>
                      {code.used ? '已使用' : '未使用'}
                    </Badge>
                  </td>
                  <td>{code.used_by_user_id || '-'}</td>
                  <td>{formatDateTime(code.used_at)}</td>
                  <td
                    className="ai-chat-config-text-cell"
                    title={code.batch_no || '-'}>
                    {code.batch_no || '-'}
                  </td>
                  <td
                    className="ai-chat-config-text-cell"
                    title={code.remark || '-'}>
                    {code.remark || '-'}
                  </td>
                </tr>
              ))}
              {redeemCodes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-muted">
                    暂无兑换码
                  </td>
                </tr>
              ) : null}
            </tbody>
          </Table>
        </Tab>

        <Tab eventKey="rates" title="模型消耗系数">
          <Card className="mb-4">
            <Card.Body>
              <Form onSubmit={submitRate}>
                <Row>
                  <Col md={4}>
                    <Form.Group className="mb-3">
                      <Form.Label>本站模型 ID</Form.Label>
                      <Form.Select
                        required
                        value={rateForm.model_mapping_id}
                        onChange={(e) =>
                          setRateForm({
                            ...rateForm,
                            model_mapping_id: Number(e.target.value),
                          })
                        }>
                        <option value={0}>请选择</option>
                        {mappings
                          .filter((mapping) => mapping.enabled)
                          .map((mapping) => (
                            <option key={mapping.id} value={mapping.id}>
                              {mapping.site_model_id}
                            </option>
                          ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group className="mb-3">
                      <Form.Label>消耗系数</Form.Label>
                      <Form.Control
                        required
                        min="0.01"
                        step="any"
                        type="number"
                        value={rateForm.consume_rate}
                        onChange={(e) =>
                          setRateForm({
                            ...rateForm,
                            consume_rate: Number(e.target.value),
                          })
                        }
                      />
                    </Form.Group>
                  </Col>
                  <Col md={5}>
                    <Form.Group className="mb-3">
                      <Form.Label>备注</Form.Label>
                      <Form.Control
                        value={rateForm.remark}
                        onChange={(e) =>
                          setRateForm({
                            ...rateForm,
                            remark: e.target.value,
                          })
                        }
                      />
                    </Form.Group>
                  </Col>
                </Row>
                <Form.Check
                  className="mb-3"
                  type="switch"
                  label="启用"
                  checked={rateForm.enabled}
                  onChange={(e) =>
                    setRateForm({ ...rateForm, enabled: e.target.checked })
                  }
                />
                <Button type="submit">保存消耗系数</Button>
              </Form>
            </Card.Body>
          </Card>
          <Table responsive hover>
            <thead>
              <tr>
                <th>本站模型 ID</th>
                <th>消耗系数</th>
                <th>状态</th>
                <th>备注</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {rates.map((rate) => (
                <tr key={rate.id}>
                  <td>{rate.site_model_id}</td>
                  <td>{rate.consume_rate}</td>
                  <td>{rate.enabled ? '启用' : '禁用'}</td>
                  <td>{rate.remark}</td>
                  <td>
                    <Button
                      size="sm"
                      variant="outline-primary"
                      onClick={() => setRateForm(rate)}>
                      编辑
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Tab>

        <Tab eventKey="images" title="图片生成">
          <Card className="mb-4">
            <Card.Body>
              <Form onSubmit={submitImageProvider}>
                <Row>
                  <Col md={2}>
                    <Form.Group className="mb-3">
                      <Form.Label>Provider 名称</Form.Label>
                      <Form.Control
                        required
                        value={imageProviderForm.name}
                        onChange={(e) =>
                          setImageProviderForm({
                            ...imageProviderForm,
                            name: e.target.value,
                          })
                        }
                      />
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group className="mb-3">
                      <Form.Label>Base URL</Form.Label>
                      <Form.Control
                        required
                        value={imageProviderForm.base_url}
                        onChange={(e) =>
                          setImageProviderForm({
                            ...imageProviderForm,
                            base_url: e.target.value,
                          })
                        }
                      />
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group className="mb-3">
                      <Form.Label>API Key</Form.Label>
                      <Form.Control
                        type="password"
                        required={!imageProviderForm.id}
                        placeholder={
                          imageProviderForm.id ? '留空则保持原 API Key' : ''
                        }
                        value={imageProviderForm.api_key}
                        onChange={(e) =>
                          setImageProviderForm({
                            ...imageProviderForm,
                            api_key: e.target.value,
                          })
                        }
                      />
                    </Form.Group>
                  </Col>
                  <Col md={2}>
                    <Form.Group className="mb-3">
                      <Form.Label>协议格式</Form.Label>
                      <Form.Select
                        value={imageProviderForm.api_format || 'openai'}
                        onChange={(e) => {
                          const nextFormat = e.target
                            .value as Type.AdminAiImageProviderParams['api_format'];
                          setImageProviderForm({
                            ...imageProviderForm,
                            api_format: nextFormat,
                            flow2api_model_groups:
                              nextFormat === 'flow2api'
                                ? imageProviderForm.flow2api_model_groups
                                    ?.length
                                  ? imageProviderForm.flow2api_model_groups
                                  : flow2APIImageModelGroups
                                : [],
                          });
                        }}>
                        <option value="openai">OpenAI 兼容</option>
                        <option value="gemini">Gemini 原生</option>
                        <option value="flow2api">Flow2API</option>
                        <option value="grok">Grok / xAI 图片</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={1}>
                    <Form.Group className="mb-3">
                      <Form.Label>备注</Form.Label>
                      <Form.Control
                        value={imageProviderForm.remark}
                        onChange={(e) =>
                          setImageProviderForm({
                            ...imageProviderForm,
                            remark: e.target.value,
                          })
                        }
                      />
                    </Form.Group>
                  </Col>
                </Row>
                {imageProviderForm.api_format === 'flow2api' && (
                  <div className="mb-3 rounded border border-light-subtle p-3">
                    <div className="mb-2 fw-semibold">Flow2API 模型组</div>
                    <div className="d-flex flex-wrap gap-3">
                      {flow2APIImageModelGroups.map((group) => (
                        <Form.Check
                          key={group}
                          type="switch"
                          label={group}
                          checked={
                            imageProviderForm.flow2api_model_groups?.includes(
                              group,
                            ) ?? false
                          }
                          onChange={(e) => {
                            const current =
                              imageProviderForm.flow2api_model_groups || [];
                            setImageProviderForm({
                              ...imageProviderForm,
                              flow2api_model_groups: e.target.checked
                                ? Array.from(new Set([...current, group]))
                                : current.filter((item) => item !== group),
                            });
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}
                <Form.Check
                  className="mb-3"
                  type="switch"
                  label="启用"
                  checked={imageProviderForm.enabled}
                  onChange={(e) =>
                    setImageProviderForm({
                      ...imageProviderForm,
                      enabled: e.target.checked,
                    })
                  }
                />
                <Button type="submit">保存生图 Provider</Button>
              </Form>
            </Card.Body>
          </Card>

          <Table responsive hover className="mb-4">
            <thead>
              <tr>
                <th>Provider</th>
                <th>Base URL</th>
                <th>协议</th>
                <th>状态</th>
                <th>备注</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {imageProviders.map((provider) => (
                <tr key={provider.id}>
                  <td>{provider.name}</td>
                  <td className="ai-chat-config-text-cell">
                    {provider.base_url}
                  </td>
                  <td>
                    {(provider.api_format || 'openai') === 'flow2api'
                      ? 'Flow2API'
                      : (provider.api_format || 'openai') === 'gemini'
                        ? 'Gemini 原生'
                        : (provider.api_format || 'openai') === 'grok'
                          ? 'Grok / xAI 图片'
                          : 'OpenAI 兼容'}
                    {(provider.api_format || 'openai') === 'flow2api' ? (
                      provider.flow2api_model_groups?.length ? (
                        <div className="small text-muted">
                          {provider.flow2api_model_groups.join('、')}
                        </div>
                      ) : null
                    ) : null}
                  </td>
                  <td>{provider.enabled ? '启用' : '禁用'}</td>
                  <td>{provider.remark}</td>
                  <td className="ai-chat-config-action-cell">
                    <Button
                      size="sm"
                      variant="outline-primary"
                      onClick={() =>
                        setImageProviderForm({
                          ...provider,
                          api_format: provider.api_format || 'openai',
                          flow2api_model_groups:
                            provider.flow2api_model_groups || [],
                          api_key: '',
                        })
                      }>
                      编辑
                    </Button>
                    <Button
                      size="sm"
                      variant="outline-danger"
                      onClick={() => deleteImageProvider(provider)}>
                      删除
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>

          <Card className="mb-4">
            <Card.Body>
              <Form onSubmit={submitImageModel}>
                <Row>
                  <Col md={3}>
                    <Form.Group className="mb-3">
                      <Form.Label>Provider</Form.Label>
                      <Form.Select
                        required
                        value={imageModelForm.provider_id}
                        onChange={(e) => {
                          const nextProviderID = Number(e.target.value);
                          const nextIsGrokProvider =
                            isGrokImageProviderID(nextProviderID);
                          setImageModelForm({
                            ...imageModelForm,
                            provider_id: nextProviderID,
                            quality_model_id: nextIsGrokProvider
                              ? imageModelForm.quality_model_id
                              : '',
                            default_quality:
                              nextIsGrokProvider &&
                              imageModelForm.default_quality === 'medium'
                                ? 'auto'
                                : imageModelForm.default_quality,
                          });
                        }}>
                        <option value={0}>请选择</option>
                        {imageProviders.map((provider) => (
                          <option key={provider.id} value={provider.id}>
                            {provider.name}
                          </option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group className="mb-3">
                      <Form.Label>本站模型 ID</Form.Label>
                      <Form.Control
                        required
                        value={imageModelForm.site_model_id}
                        onChange={(e) =>
                          setImageModelForm({
                            ...imageModelForm,
                            site_model_id: e.target.value,
                          })
                        }
                      />
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group className="mb-3">
                      <Form.Label>供应商模型 ID</Form.Label>
                      <Form.Control
                        required
                        value={imageModelForm.provider_model_id}
                        onChange={(e) =>
                          setImageModelForm({
                            ...imageModelForm,
                            provider_model_id: e.target.value,
                          })
                        }
                      />
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group className="mb-3">
                      <Form.Label>Agent 思考模型 ID</Form.Label>
                      <Form.Control
                        placeholder="gpt-4.1-mini"
                        value={imageModelForm.agent_model_id}
                        onChange={(e) =>
                          setImageModelForm({
                            ...imageModelForm,
                            agent_model_id: e.target.value,
                          })
                        }
                      />
                    </Form.Group>
                  </Col>
                </Row>
                {isImageModelGrokProvider && (
                  <Row>
                    <Col md={3}>
                      <Form.Group className="mb-3">
                        <Form.Label>高质量模型 ID</Form.Label>
                        <Form.Control
                          placeholder="grok-imagine-image-quality"
                          value={imageModelForm.quality_model_id}
                          onChange={(e) =>
                            setImageModelForm({
                              ...imageModelForm,
                              quality_model_id: e.target.value,
                            })
                          }
                        />
                      </Form.Group>
                    </Col>
                  </Row>
                )}
                <Row>
                  <Col md={3}>
                    <Form.Group className="mb-3">
                      <Form.Label>默认尺寸</Form.Label>
                      <Form.Control
                        required
                        value={imageModelForm.default_size}
                        onChange={(e) =>
                          setImageModelForm({
                            ...imageModelForm,
                            default_size: e.target.value,
                          })
                        }
                      />
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group className="mb-3">
                      <Form.Label>展示名称</Form.Label>
                      <Form.Control
                        value={imageModelForm.display_name}
                        onChange={(e) =>
                          setImageModelForm({
                            ...imageModelForm,
                            display_name: e.target.value,
                          })
                        }
                      />
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group className="mb-3">
                      <Form.Label>描述</Form.Label>
                      <Form.Control
                        value={imageModelForm.description}
                        onChange={(e) =>
                          setImageModelForm({
                            ...imageModelForm,
                            description: e.target.value,
                          })
                        }
                      />
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group className="mb-3">
                      <Form.Label>排序</Form.Label>
                      <Form.Control
                        type="number"
                        value={imageModelForm.sort_order}
                        onChange={(e) =>
                          setImageModelForm({
                            ...imageModelForm,
                            sort_order: Number(e.target.value),
                          })
                        }
                      />
                    </Form.Group>
                  </Col>
                </Row>
                <Row>
                  <Col md={3}>
                    <Form.Group className="mb-3">
                      <Form.Label>接口模式</Form.Label>
                      <Form.Select
                        value={imageModelForm.api_mode}
                        onChange={(e) =>
                          setImageModelForm({
                            ...imageModelForm,
                            api_mode: e.target.value as ImageAPIMode,
                          })
                        }>
                        <option value="images">Images</option>
                        <option value="responses">Responses</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group className="mb-3">
                      <Form.Label>默认质量</Form.Label>
                      <Form.Select
                        value={imageModelForm.default_quality}
                        onChange={(e) =>
                          setImageModelForm({
                            ...imageModelForm,
                            default_quality: e.target.value,
                          })
                        }>
                        <option value="auto">auto</option>
                        <option value="low">low</option>
                        {!isImageModelGrokProvider && (
                          <option value="medium">medium</option>
                        )}
                        <option value="high">high</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group className="mb-3">
                      <Form.Label>默认格式</Form.Label>
                      <Form.Select
                        value={imageModelForm.default_format}
                        onChange={(e) =>
                          setImageModelForm({
                            ...imageModelForm,
                            default_format: e.target.value,
                          })
                        }>
                        <option value="png">PNG</option>
                        <option value="jpeg">JPEG</option>
                        <option value="webp">WebP</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group className="mb-3">
                      <Form.Label>额外配置 JSON</Form.Label>
                      <Form.Control
                        placeholder='{"responses_model_id":"gpt-5.5"}'
                        value={imageModelForm.extra_config}
                        onChange={(e) =>
                          setImageModelForm({
                            ...imageModelForm,
                            extra_config: e.target.value,
                          })
                        }
                      />
                    </Form.Group>
                  </Col>
                </Row>
                <div className="ai-chat-config-checkbox-list mb-3">
                  <Form.Check
                    type="switch"
                    label="支持图片编辑"
                    checked={imageModelForm.supports_edits}
                    onChange={(e) =>
                      setImageModelForm({
                        ...imageModelForm,
                        supports_edits: e.target.checked,
                      })
                    }
                  />
                  <Form.Check
                    type="switch"
                    label="支持参考图"
                    checked={imageModelForm.supports_references}
                    onChange={(e) =>
                      setImageModelForm({
                        ...imageModelForm,
                        supports_references: e.target.checked,
                      })
                    }
                  />
                  <Form.Check
                    type="switch"
                    label="支持流式"
                    checked={imageModelForm.supports_stream}
                    onChange={(e) =>
                      setImageModelForm({
                        ...imageModelForm,
                        supports_stream: e.target.checked,
                      })
                    }
                  />
                </div>
                <div className="ai-chat-config-upstream-panel mb-3">
                  <div className="ai-chat-config-upstream-header">
                    <div>
                      <div className="ai-chat-config-upstream-title">
                        负载均衡端点池
                      </div>
                      <div className="ai-chat-config-upstream-subtitle">
                        填写后将按权重从这里选择上游；留空时使用上方默认
                        Provider 和供应商模型。
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline-primary"
                      onClick={() =>
                        setImageModelForm({
                          ...imageModelForm,
                          upstreams: [
                            ...imageModelForm.upstreams,
                            newImageModelUpstream(),
                          ],
                        })
                      }>
                      添加端点
                    </Button>
                  </div>
                  {imageModelForm.upstreams.length === 0 ? (
                    <div className="ai-chat-config-upstream-empty">
                      当前使用默认上游。
                    </div>
                  ) : (
                    <div className="ai-chat-config-upstream-list">
                      {imageModelForm.upstreams.map((upstream, index) => {
                        const updateUpstream = (
                          patch: Partial<ImageModelUpstreamForm>,
                        ) => {
                          const upstreams = imageModelForm.upstreams.map(
                            (item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, ...patch }
                                : item,
                          );
                          setImageModelForm({ ...imageModelForm, upstreams });
                        };
                        const isUpstreamGrokProvider = isGrokImageProviderID(
                          Number(upstream.provider_id || 0),
                        );
                        return (
                          <div
                            key={upstream.client_id}
                            className="ai-chat-config-upstream-row">
                            <Form.Select
                              value={upstream.provider_id}
                              onChange={(e) => {
                                const nextProviderID = Number(e.target.value);
                                updateUpstream({
                                  provider_id: nextProviderID,
                                  quality_model_id: isGrokImageProviderID(
                                    nextProviderID,
                                  )
                                    ? upstream.quality_model_id
                                    : '',
                                });
                              }}>
                              <option value={0}>Provider</option>
                              {imageProviders.map((provider) => (
                                <option key={provider.id} value={provider.id}>
                                  {provider.name}
                                </option>
                              ))}
                            </Form.Select>
                            <Form.Control
                              placeholder="供应商模型 ID"
                              value={upstream.provider_model_id}
                              onChange={(e) =>
                                updateUpstream({
                                  provider_model_id: e.target.value,
                                })
                              }
                            />
                            {isUpstreamGrokProvider && (
                              <Form.Control
                                placeholder="高质量模型 ID，可选"
                                value={upstream.quality_model_id}
                                onChange={(e) =>
                                  updateUpstream({
                                    quality_model_id: e.target.value,
                                  })
                                }
                              />
                            )}
                            <Form.Control
                              placeholder="Agent 模型，可选"
                              value={upstream.agent_model_id}
                              onChange={(e) =>
                                updateUpstream({
                                  agent_model_id: e.target.value,
                                })
                              }
                            />
                            <Form.Control
                              placeholder="Responses 模型，可选"
                              value={upstream.responses_model_id}
                              onChange={(e) =>
                                updateUpstream({
                                  responses_model_id: e.target.value,
                                })
                              }
                            />
                            <Form.Control
                              type="number"
                              min={1}
                              value={upstream.weight}
                              onChange={(e) =>
                                updateUpstream({
                                  weight: Math.max(
                                    1,
                                    Number(e.target.value || 1),
                                  ),
                                })
                              }
                            />
                            <Form.Check
                              type="switch"
                              label="启用"
                              checked={upstream.enabled}
                              onChange={(e) =>
                                updateUpstream({ enabled: e.target.checked })
                              }
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant="outline-danger"
                              onClick={() =>
                                setImageModelForm({
                                  ...imageModelForm,
                                  upstreams: imageModelForm.upstreams.filter(
                                    (_, itemIndex) => itemIndex !== index,
                                  ),
                                })
                              }>
                              删除
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                <Form.Check
                  className="mb-3"
                  type="switch"
                  label="启用"
                  checked={imageModelForm.enabled}
                  onChange={(e) =>
                    setImageModelForm({
                      ...imageModelForm,
                      enabled: e.target.checked,
                    })
                  }
                />
                <Button type="submit">保存生图模型</Button>
              </Form>
            </Card.Body>
          </Card>

          <Table responsive hover className="mb-4">
            <thead>
              <tr>
                <th>本站模型 ID</th>
                <th>Provider</th>
                <th>供应商模型</th>
                <th>Agent 思考模型</th>
                <th>默认尺寸</th>
                <th>接口模式</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {imageModels.map((model) => (
                <tr key={model.id}>
                  <td>{model.site_model_id}</td>
                  <td>{model.provider_name}</td>
                  <td>
                    <div>{model.provider_model_id}</div>
                    {(model.upstreams?.length || 0) > 0 && (
                      <Badge bg="info" className="mt-1">
                        {model.upstreams?.length} 个端点
                      </Badge>
                    )}
                  </td>
                  <td>{model.agent_model_id || '-'}</td>
                  <td>{model.default_size}</td>
                  <td>{model.api_mode || 'images'}</td>
                  <td>{model.enabled ? '启用' : '禁用'}</td>
                  <td className="ai-chat-config-action-cell">
                    <Button
                      size="sm"
                      variant="outline-primary"
                      onClick={() =>
                        setImageModelForm({
                          ...imageModelInit,
                          ...model,
                          quality_model_id: model.quality_model_id || '',
                          agent_model_id: model.agent_model_id || '',
                          upstreams: normalizeImageModelUpstreams(
                            model.upstreams,
                          ),
                        })
                      }>
                      编辑
                    </Button>
                    <Button
                      size="sm"
                      variant="outline-danger"
                      onClick={async () => {
                        await deleteAdminAiImageModel(model.id);
                        await loadAll();
                      }}>
                      删除
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>

          <Card>
            <Card.Body>
              <Form onSubmit={submitImageSetting}>
                <Row className="align-items-end">
                  <Col md={4}>
                    <Form.Group className="mb-3">
                      <Form.Label>图片保存天数</Form.Label>
                      <Form.Control
                        required
                        min={1}
                        max={3650}
                        type="number"
                        value={imageSettingForm.retention_days}
                        onChange={(e) =>
                          setImageSettingForm({
                            retention_days: Number(e.target.value),
                          })
                        }
                      />
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Button type="submit" className="mb-3">
                      保存设置
                    </Button>
                  </Col>
                </Row>
              </Form>
            </Card.Body>
          </Card>
        </Tab>

        <Tab eventKey="videos" title="视频生成">
          <Card className="mb-4">
            <Card.Body>
              <Form onSubmit={submitVideoProvider}>
                <Row>
                  <Col md={3}>
                    <Form.Group className="mb-3">
                      <Form.Label>Provider 名称</Form.Label>
                      <Form.Control
                        required
                        value={videoProviderForm.name}
                        onChange={(e) =>
                          setVideoProviderForm({
                            ...videoProviderForm,
                            name: e.target.value,
                          })
                        }
                      />
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group className="mb-3">
                      <Form.Label>Base URL</Form.Label>
                      <Form.Control
                        required
                        value={videoProviderForm.base_url}
                        onChange={(e) =>
                          setVideoProviderForm({
                            ...videoProviderForm,
                            base_url: e.target.value,
                          })
                        }
                      />
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group className="mb-3">
                      <Form.Label>API Key</Form.Label>
                      <Form.Control
                        type="password"
                        required={!videoProviderForm.id}
                        placeholder={
                          videoProviderForm.id ? '留空则保持原 API Key' : ''
                        }
                        value={videoProviderForm.api_key}
                        onChange={(e) =>
                          setVideoProviderForm({
                            ...videoProviderForm,
                            api_key: e.target.value,
                          })
                        }
                      />
                    </Form.Group>
                  </Col>
                  <Col md={2}>
                    <Form.Group className="mb-3">
                      <Form.Label>备注</Form.Label>
                      <Form.Control
                        value={videoProviderForm.remark}
                        onChange={(e) =>
                          setVideoProviderForm({
                            ...videoProviderForm,
                            remark: e.target.value,
                          })
                        }
                      />
                    </Form.Group>
                  </Col>
                </Row>
                <Form.Check
                  className="mb-3"
                  type="switch"
                  label="启用"
                  checked={videoProviderForm.enabled}
                  onChange={(e) =>
                    setVideoProviderForm({
                      ...videoProviderForm,
                      enabled: e.target.checked,
                    })
                  }
                />
                <Button type="submit">保存视频 Provider</Button>
              </Form>
            </Card.Body>
          </Card>

          <Table responsive hover className="mb-4">
            <thead>
              <tr>
                <th>Provider</th>
                <th>Base URL</th>
                <th>状态</th>
                <th>备注</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {videoProviders.map((provider) => (
                <tr key={provider.id}>
                  <td>{provider.name}</td>
                  <td className="ai-chat-config-text-cell">
                    {provider.base_url}
                  </td>
                  <td>{provider.enabled ? '启用' : '禁用'}</td>
                  <td>{provider.remark}</td>
                  <td className="ai-chat-config-action-cell">
                    <Button
                      size="sm"
                      variant="outline-primary"
                      onClick={() =>
                        setVideoProviderForm({ ...provider, api_key: '' })
                      }>
                      编辑
                    </Button>
                    <Button
                      size="sm"
                      variant="outline-danger"
                      onClick={() => deleteVideoProvider(provider)}>
                      删除
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>

          <Card className="mb-4">
            <Card.Body>
              <Form onSubmit={submitVideoModel}>
                <Row>
                  <Col md={3}>
                    <Form.Group className="mb-3">
                      <Form.Label>Provider</Form.Label>
                      <Form.Select
                        required
                        value={videoModelForm.provider_id}
                        onChange={(e) =>
                          setVideoModelForm({
                            ...videoModelForm,
                            provider_id: Number(e.target.value),
                          })
                        }>
                        <option value={0}>请选择</option>
                        {videoProviders.map((provider) => (
                          <option key={provider.id} value={provider.id}>
                            {provider.name}
                          </option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group className="mb-3">
                      <Form.Label>本站模型 ID</Form.Label>
                      <Form.Control
                        required
                        value={videoModelForm.site_model_id}
                        onChange={(e) =>
                          setVideoModelForm({
                            ...videoModelForm,
                            site_model_id: e.target.value,
                          })
                        }
                      />
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group className="mb-3">
                      <Form.Label>供应商模型 ID</Form.Label>
                      <Form.Control
                        required
                        value={videoModelForm.provider_model_id}
                        onChange={(e) =>
                          setVideoModelForm({
                            ...videoModelForm,
                            provider_model_id: e.target.value,
                          })
                        }
                      />
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group className="mb-3">
                      <Form.Label>默认尺寸</Form.Label>
                      <Form.Select
                        value={videoModelForm.default_size}
                        onChange={(e) =>
                          setVideoModelForm({
                            ...videoModelForm,
                            default_size: e.target.value,
                          })
                        }>
                        <option value="1280x720">16:9 1280x720</option>
                        <option value="720x1280">9:16 720x1280</option>
                        <option value="1024x1024">1:1 1024x1024</option>
                        <option value="1792x1024">16:9 1792x1024</option>
                        <option value="1024x1792">9:16 1024x1792</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                </Row>
                <Row>
                  <Col md={3}>
                    <Form.Group className="mb-3">
                      <Form.Label>默认时长</Form.Label>
                      <Form.Select
                        value={videoModelForm.default_seconds}
                        onChange={(e) =>
                          setVideoModelForm({
                            ...videoModelForm,
                            default_seconds: Number(e.target.value),
                          })
                        }>
                        {[6, 10, 12, 16, 20].map((seconds) => (
                          <option key={seconds} value={seconds}>
                            {seconds} 秒
                          </option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group className="mb-3">
                      <Form.Label>默认质量</Form.Label>
                      <Form.Select
                        value={videoModelForm.default_resolution}
                        onChange={(e) =>
                          setVideoModelForm({
                            ...videoModelForm,
                            default_resolution: e.target.value,
                          })
                        }>
                        <option value="720p">720p</option>
                        <option value="480p">480p</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group className="mb-3">
                      <Form.Label>默认模式</Form.Label>
                      <Form.Select
                        value={videoModelForm.default_preset}
                        onChange={(e) =>
                          setVideoModelForm({
                            ...videoModelForm,
                            default_preset: e.target.value,
                          })
                        }>
                        <option value="custom">custom</option>
                        <option value="normal">normal</option>
                        <option value="fun">fun</option>
                        <option value="spicy">spicy</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group className="mb-3">
                      <Form.Label>排序</Form.Label>
                      <Form.Control
                        type="number"
                        value={videoModelForm.sort_order}
                        onChange={(e) =>
                          setVideoModelForm({
                            ...videoModelForm,
                            sort_order: Number(e.target.value),
                          })
                        }
                      />
                    </Form.Group>
                  </Col>
                </Row>
                <Row>
                  <Col md={4}>
                    <Form.Group className="mb-3">
                      <Form.Label>展示名称</Form.Label>
                      <Form.Control
                        value={videoModelForm.display_name}
                        onChange={(e) =>
                          setVideoModelForm({
                            ...videoModelForm,
                            display_name: e.target.value,
                          })
                        }
                      />
                    </Form.Group>
                  </Col>
                  <Col md={8}>
                    <Form.Group className="mb-3">
                      <Form.Label>描述</Form.Label>
                      <Form.Control
                        value={videoModelForm.description}
                        onChange={(e) =>
                          setVideoModelForm({
                            ...videoModelForm,
                            description: e.target.value,
                          })
                        }
                      />
                    </Form.Group>
                  </Col>
                </Row>
                <Form.Check
                  className="mb-3"
                  type="switch"
                  label="启用"
                  checked={videoModelForm.enabled}
                  onChange={(e) =>
                    setVideoModelForm({
                      ...videoModelForm,
                      enabled: e.target.checked,
                    })
                  }
                />
                <Button type="submit">保存视频模型</Button>
              </Form>
            </Card.Body>
          </Card>

          <Table responsive hover className="mb-4">
            <thead>
              <tr>
                <th>本站模型 ID</th>
                <th>Provider</th>
                <th>供应商模型</th>
                <th>默认参数</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {videoModels.map((model) => (
                <tr key={model.id}>
                  <td>{model.site_model_id}</td>
                  <td>{model.provider_name}</td>
                  <td>{model.provider_model_id}</td>
                  <td>
                    {model.default_size} · {model.default_seconds} 秒 ·{' '}
                    {model.default_resolution}
                  </td>
                  <td>{model.enabled ? '启用' : '禁用'}</td>
                  <td className="ai-chat-config-action-cell">
                    <Button
                      size="sm"
                      variant="outline-primary"
                      onClick={() => setVideoModelForm(model)}>
                      编辑
                    </Button>
                    <Button
                      size="sm"
                      variant="outline-danger"
                      onClick={async () => {
                        await deleteAdminAiVideoModel(model.id);
                        await loadAll();
                      }}>
                      删除
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>

          <Card>
            <Card.Body>
              <Form onSubmit={submitVideoSetting}>
                <Row className="align-items-end">
                  <Col md={4}>
                    <Form.Group className="mb-3">
                      <Form.Label>视频保存天数</Form.Label>
                      <Form.Control
                        required
                        min={1}
                        max={3650}
                        type="number"
                        value={videoSettingForm.retention_days}
                        onChange={(e) =>
                          setVideoSettingForm({
                            retention_days: Number(e.target.value),
                          })
                        }
                      />
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Button type="submit" className="mb-3">
                      保存设置
                    </Button>
                  </Col>
                </Row>
              </Form>
            </Card.Body>
          </Card>
        </Tab>
      </Tabs>
      <Modal
        show={!!modelListProvider}
        onHide={() => setModelListProvider(null)}
        centered
        scrollable
        size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            模型列表
            {modelListProvider?.name ? ` - ${modelListProvider.name}` : ''}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {modelListProvider?.models?.length ? (
            <Table responsive hover size="sm" className="mb-0">
              <thead>
                <tr>
                  <th>模型 ID</th>
                  <th>状态</th>
                  <th>获取时间</th>
                </tr>
              </thead>
              <tbody>
                {modelListProvider.models.map((model) => (
                  <tr key={model.id || model.provider_model_id}>
                    <td
                      className="ai-chat-config-code-cell"
                      title={model.provider_model_id}>
                      {model.provider_model_id}
                    </td>
                    <td>
                      <Badge bg={model.enabled ? 'success' : 'secondary'}>
                        {model.enabled ? '启用' : '禁用'}
                      </Badge>
                    </td>
                    <td>{formatDateTime(model.fetched_at)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <Alert variant="secondary" className="mb-0">
              暂无模型，请先获取模型列表。
            </Alert>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            type="button"
            variant="link"
            onClick={() => setModelListProvider(null)}>
            关闭
          </Button>
        </Modal.Footer>
      </Modal>
      <Modal show={!!testingProvider} onHide={closeTestProvider} centered>
        <Modal.Header closeButton={!testing}>
          <Modal.Title>测试模型</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>Provider</Form.Label>
            <Form.Control readOnly value={testingProvider?.name || ''} />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>模型</Form.Label>
            <Form.Select
              value={testingModelID}
              disabled={testing}
              onChange={(e) => {
                setTestingModelID(e.target.value);
                setTestingResult(null);
              }}>
              {(testingProvider?.models || []).map((model) => (
                <option
                  key={model.provider_model_id}
                  value={model.provider_model_id}>
                  {model.provider_model_id}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
          <div className="text-muted mb-2">测试消息：hi</div>
          {testingResult?.error ? (
            <Alert variant="danger">{testingResult.error}</Alert>
          ) : null}
          {testingResult?.message ? (
            <div className="ai-chat-config-test-result">
              {testingResult.message}
            </div>
          ) : null}
        </Modal.Body>
        <Modal.Footer>
          <Button
            type="button"
            variant="link"
            disabled={testing}
            onClick={closeTestProvider}>
            关闭
          </Button>
          <Button
            type="button"
            disabled={!testingModelID || testing}
            onClick={testProviderModel}>
            {testing ? (
              <Spinner animation="border" size="sm" className="me-2" />
            ) : null}
            开始测试
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default AiChatConfig;
