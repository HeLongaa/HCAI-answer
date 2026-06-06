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

import qs from 'qs';

import request from '@/utils/request';
import type * as Type from '@/common/interface';

const aiImageTimeout = 600000;

export const getConversationList = (params: Type.Paging) => {
  return request.get<{ count: number; list: Type.ConversationListItem[] }>(
    `/answer/api/v1/ai/conversation/page?${qs.stringify(params)}`,
  );
};

export const getConversationDetail = (id: string) => {
  return request.get<Type.ConversationDetail>(
    `/answer/api/v1/ai/conversation?conversation_id=${id}`,
  );
};

// /answer/api/v1/ai/conversation/vote
export const voteConversation = (params: Type.VoteConversationParams) => {
  return request.post('/answer/api/v1/ai/conversation/vote', params);
};

export const switchConversationBranch = (params: {
  conversation_id: string;
  parent_message_id: string;
  message_id: string;
}) => {
  return request.put('/answer/api/v1/ai/conversation/branch', params);
};

export const deleteConversationRecord = (params: {
  conversation_id: string;
  message_id: string;
}) => {
  return request.delete('/answer/api/v1/ai/conversation/record', params);
};

export const getAiSubscriptionOverview = () => {
  return request.get<Type.AiSubscriptionOverview>(
    '/answer/api/v1/ai-chat/subscription/overview',
  );
};

export const getAiChatModels = () => {
  return request.get<Type.AiChatModel[]>('/answer/api/v1/ai-chat/models');
};

export const getAiImageModels = () => {
  return request.get<Type.AiImageModel[]>('/answer/api/v1/ai-image/models');
};

export const getAiVideoModels = () => {
  return request.get<Type.AiVideoModel[]>('/answer/api/v1/ai-video/models');
};

export const getAiImageGenerations = (limit = 30) => {
  return request.get<Type.AiImageGeneration[]>(
    `/answer/api/v1/ai-image/generations?limit=${limit}`,
  );
};

export const deleteAiImageGeneration = (params: { generation_id: string }) => {
  return request.delete('/answer/api/v1/ai-image/generations', params);
};

export const getAiImageAgentConversations = () => {
  return request.get<Type.AiImageAgentConversation[]>(
    '/answer/api/v1/ai-image/agent-conversations',
  );
};

export const saveAiImageAgentConversation = (
  params: Type.AiImageAgentConversationSaveParams,
) => {
  return request.put<Type.AiImageAgentConversation>(
    '/answer/api/v1/ai-image/agent-conversations',
    params,
  );
};

export const deleteAiImageAgentConversation = (params: {
  conversation_id: string;
}) => {
  return request.delete('/answer/api/v1/ai-image/agent-conversations', params);
};

export const getAiVideoGenerations = (limit = 30) => {
  return request.get<Type.AiVideoGeneration[]>(
    `/answer/api/v1/ai-video/generations?limit=${limit}`,
  );
};

export const generateAiImage = (params: Type.AiImageGenerateParams) => {
  return request.post<Type.AiImageGenerateResult>(
    '/answer/api/v1/ai-image/generations',
    params,
    { timeout: aiImageTimeout },
  );
};

export const saveAiImageAgentGeneration = (
  params: Type.AiImageAgentGenerationSaveParams,
) => {
  return request.post<Type.AiImageGenerateResult>(
    '/answer/api/v1/ai-image/agent-generations',
    params,
    { timeout: aiImageTimeout },
  );
};

export const generateAiVideo = (params: Type.AiVideoGenerateParams) => {
  return request.post<Type.AiVideoGenerateResult>(
    '/answer/api/v1/ai-video/generations',
    params,
    { timeout: aiImageTimeout },
  );
};

export const editAiImage = (params: Type.AiImageEditParams) => {
  return request.post<Type.AiImageGenerateResult>(
    '/answer/api/v1/ai-image/edits',
    params,
    { timeout: aiImageTimeout },
  );
};

export const getAiSubscriptionPurchase = () => {
  return request.get<Type.AiSubscriptionPurchase>(
    '/answer/api/v1/ai-chat/subscription/purchase',
  );
};

export const redeemAiSubscriptionCode = (params: { code: string }) => {
  return request.post<Type.AiSubscriptionRedeemResult>(
    '/answer/api/v1/ai-chat/subscription/redeem',
    params,
  );
};
