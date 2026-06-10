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

import request from '@/utils/request';
import type * as Type from '@/common/interface';

const base = '/answer/admin/api/ai-chat';

export const getAiChatProviders = () => {
  return request.get<Type.AdminAiProvider[]>(`${base}/providers`);
};

export const createAiChatProvider = (params: Type.AdminAiProviderParams) => {
  return request.post<Type.AdminAiProvider>(`${base}/providers`, params);
};

export const updateAiChatProvider = (
  id: number,
  params: Type.AdminAiProviderParams,
) => {
  return request.put<Type.AdminAiProvider>(`${base}/providers/${id}`, params);
};

export const deleteAiChatProvider = (id: number) => {
  return request.delete(`${base}/providers/${id}`);
};

export const fetchAiChatProviderModels = (id: number) => {
  return request.post<Type.AdminAiProviderModel[]>(
    `${base}/providers/${id}/fetch-models`,
  );
};

export const testAiChatProviderModel = (
  id: number,
  params: { provider_model_id: string },
) => {
  return request.post<Type.AdminAiTestProviderModelResult>(
    `${base}/providers/${id}/test-model`,
    params,
  );
};

export const getAiChatModelMappings = () => {
  return request.get<Type.AdminAiModelMapping[]>(`${base}/model-mappings`);
};

export const createAiChatModelMapping = (
  params: Type.AdminAiModelMappingParams,
) => {
  return request.post(`${base}/model-mappings`, params);
};

export const updateAiChatModelMapping = (
  id: number,
  params: Type.AdminAiModelMappingParams,
) => {
  return request.put(`${base}/model-mappings/${id}`, params);
};

export const deleteAiChatModelMapping = (id: number) => {
  return request.delete(`${base}/model-mappings/${id}`);
};

export const getAdminAiChatSetting = () => {
  return request.get<Type.AdminAiChatSetting>(`${base}/chat-setting`);
};

export const updateAdminAiChatSetting = (
  params: Type.AdminAiChatSettingParams,
) => {
  return request.put(`${base}/chat-setting`, params);
};

export const getAiChatSubscriptionPlans = () => {
  return request.get<Type.AiSubscriptionPlan[]>(`${base}/subscription-plans`);
};

export const createAiChatSubscriptionPlan = (
  params: Type.AiSubscriptionPlanParams,
) => {
  return request.post(`${base}/subscription-plans`, params);
};

export const updateAiChatSubscriptionPlan = (
  id: number,
  params: Type.AiSubscriptionPlanParams,
) => {
  return request.put(`${base}/subscription-plans/${id}`, params);
};

export const deleteAiChatSubscriptionPlan = (id: number) => {
  return request.delete(`${base}/subscription-plans/${id}`);
};

export const getAiChatRedeemCodes = () => {
  return request.get<Type.AiSubscriptionRedeemCode[]>(`${base}/redeem-codes`);
};

export const generateAiChatRedeemCodes = (
  params: Type.AiSubscriptionRedeemCodeGenerateParams,
) => {
  return request.post<Type.AiSubscriptionRedeemCode[]>(
    `${base}/redeem-codes/generate`,
    params,
  );
};

export const getAiChatConsumeRates = () => {
  return request.get<Type.AiModelConsumeRate[]>(`${base}/consume-rates`);
};

export const createAiChatConsumeRate = (
  params: Type.AiModelConsumeRateParams,
) => {
  return request.post(`${base}/consume-rates`, params);
};

export const updateAiChatConsumeRate = (
  id: number,
  params: Type.AiModelConsumeRateParams,
) => {
  return request.put(`${base}/consume-rates/${id}`, params);
};

export const getAdminAiImageProviders = () => {
  return request.get<Type.AdminAiImageProvider[]>(`${base}/image-providers`);
};

export const createAdminAiImageProvider = (
  params: Type.AdminAiImageProviderParams,
) => {
  return request.post(`${base}/image-providers`, params);
};

export const updateAdminAiImageProvider = (
  id: number,
  params: Type.AdminAiImageProviderParams,
) => {
  return request.put(`${base}/image-providers/${id}`, params);
};

export const deleteAdminAiImageProvider = (id: number) => {
  return request.delete(`${base}/image-providers/${id}`);
};

export const getAdminAiImageModels = () => {
  return request.get<Type.AiImageModel[]>(`${base}/image-models`);
};

export const createAdminAiImageModel = (
  params: Type.AdminAiImageModelParams,
) => {
  return request.post(`${base}/image-models`, params);
};

export const updateAdminAiImageModel = (
  id: number,
  params: Type.AdminAiImageModelParams,
) => {
  return request.put(`${base}/image-models/${id}`, params);
};

export const deleteAdminAiImageModel = (id: number) => {
  return request.delete(`${base}/image-models/${id}`);
};

export const getAdminAiImageSetting = () => {
  return request.get<Type.AdminAiImageSetting>(`${base}/image-setting`);
};

export const updateAdminAiImageSetting = (
  params: Type.AdminAiImageSettingParams,
) => {
  return request.put(`${base}/image-setting`, params);
};

export const getAdminAiVideoProviders = () => {
  return request.get<Type.AdminAiVideoProvider[]>(`${base}/video-providers`);
};

export const createAdminAiVideoProvider = (
  params: Type.AdminAiVideoProviderParams,
) => {
  return request.post(`${base}/video-providers`, params);
};

export const updateAdminAiVideoProvider = (
  id: number,
  params: Type.AdminAiVideoProviderParams,
) => {
  return request.put(`${base}/video-providers/${id}`, params);
};

export const deleteAdminAiVideoProvider = (id: number) => {
  return request.delete(`${base}/video-providers/${id}`);
};

export const getAdminAiVideoModels = () => {
  return request.get<Type.AiVideoModel[]>(`${base}/video-models`);
};

export const createAdminAiVideoModel = (
  params: Type.AdminAiVideoModelParams,
) => {
  return request.post(`${base}/video-models`, params);
};

export const updateAdminAiVideoModel = (
  id: number,
  params: Type.AdminAiVideoModelParams,
) => {
  return request.put(`${base}/video-models/${id}`, params);
};

export const deleteAdminAiVideoModel = (id: number) => {
  return request.delete(`${base}/video-models/${id}`);
};

export const getAdminAiVideoSetting = () => {
  return request.get<Type.AdminAiVideoSetting>(`${base}/video-setting`);
};

export const updateAdminAiVideoSetting = (
  params: Type.AdminAiVideoSettingParams,
) => {
  return request.put(`${base}/video-setting`, params);
};
