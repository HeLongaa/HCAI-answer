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

package controller_admin

import (
	"strconv"

	"github.com/apache/answer/internal/base/handler"
	"github.com/apache/answer/internal/base/reason"
	"github.com/apache/answer/internal/schema"
	"github.com/apache/answer/internal/service/ai_chat_config"
	"github.com/gin-gonic/gin"
	"github.com/segmentfault/pacman/errors"
)

type AIChatConfigController struct {
	aiChatConfigService ai_chat_config.AiChatConfigService
}

func NewAIChatConfigController(aiChatConfigService ai_chat_config.AiChatConfigService) *AIChatConfigController {
	return &AIChatConfigController{aiChatConfigService: aiChatConfigService}
}

func (ctrl *AIChatConfigController) ListProviders(ctx *gin.Context) {
	resp, err := ctrl.aiChatConfigService.ListProviders(ctx)
	handler.HandleResponse(ctx, err, resp)
}

func (ctrl *AIChatConfigController) CreateProvider(ctx *gin.Context) {
	req := &schema.AIProviderReq{}
	if handler.BindAndCheck(ctx, req) {
		return
	}
	resp, err := ctrl.aiChatConfigService.CreateProvider(ctx, req)
	handler.HandleResponse(ctx, err, resp)
}

func (ctrl *AIChatConfigController) UpdateProvider(ctx *gin.Context) {
	id, ok := pathID(ctx)
	if !ok {
		return
	}
	req := &schema.AIProviderReq{}
	if handler.BindAndCheck(ctx, req) {
		return
	}
	resp, err := ctrl.aiChatConfigService.UpdateProvider(ctx, id, req)
	handler.HandleResponse(ctx, err, resp)
}

func (ctrl *AIChatConfigController) DeleteProvider(ctx *gin.Context) {
	id, ok := pathID(ctx)
	if !ok {
		return
	}
	err := ctrl.aiChatConfigService.DeleteProvider(ctx, id)
	handler.HandleResponse(ctx, err, nil)
}

func (ctrl *AIChatConfigController) FetchProviderModels(ctx *gin.Context) {
	id, ok := pathID(ctx)
	if !ok {
		return
	}
	resp, err := ctrl.aiChatConfigService.FetchProviderModels(ctx, id)
	handler.HandleResponse(ctx, err, resp)
}

func (ctrl *AIChatConfigController) TestProviderModel(ctx *gin.Context) {
	id, ok := pathID(ctx)
	if !ok {
		return
	}
	req := &schema.AITestProviderModelReq{}
	if handler.BindAndCheck(ctx, req) {
		return
	}
	resp, err := ctrl.aiChatConfigService.TestProviderModel(ctx, id, req.ProviderModelID)
	handler.HandleResponse(ctx, err, resp)
}

func (ctrl *AIChatConfigController) ListModelMappings(ctx *gin.Context) {
	resp, err := ctrl.aiChatConfigService.ListModelMappings(ctx)
	handler.HandleResponse(ctx, err, resp)
}

func (ctrl *AIChatConfigController) GetChatSetting(ctx *gin.Context) {
	resp, err := ctrl.aiChatConfigService.GetChatSetting(ctx)
	handler.HandleResponse(ctx, err, resp)
}

func (ctrl *AIChatConfigController) SaveChatSetting(ctx *gin.Context) {
	req := &schema.AIChatSettingReq{}
	if handler.BindAndCheck(ctx, req) {
		return
	}
	resp, err := ctrl.aiChatConfigService.SaveChatSetting(ctx, req)
	handler.HandleResponse(ctx, err, resp)
}

func (ctrl *AIChatConfigController) CreateModelMapping(ctx *gin.Context) {
	req := &schema.AIModelMappingReq{}
	if handler.BindAndCheck(ctx, req) {
		return
	}
	resp, err := ctrl.aiChatConfigService.CreateModelMapping(ctx, req)
	handler.HandleResponse(ctx, err, resp)
}

func (ctrl *AIChatConfigController) UpdateModelMapping(ctx *gin.Context) {
	id, ok := pathID(ctx)
	if !ok {
		return
	}
	req := &schema.AIModelMappingReq{}
	if handler.BindAndCheck(ctx, req) {
		return
	}
	resp, err := ctrl.aiChatConfigService.UpdateModelMapping(ctx, id, req)
	handler.HandleResponse(ctx, err, resp)
}

func (ctrl *AIChatConfigController) DeleteModelMapping(ctx *gin.Context) {
	id, ok := pathID(ctx)
	if !ok {
		return
	}
	err := ctrl.aiChatConfigService.DeleteModelMapping(ctx, id)
	handler.HandleResponse(ctx, err, nil)
}

func (ctrl *AIChatConfigController) ListSubscriptionPlans(ctx *gin.Context) {
	resp, err := ctrl.aiChatConfigService.ListSubscriptionPlans(ctx)
	handler.HandleResponse(ctx, err, resp)
}

func (ctrl *AIChatConfigController) CreateSubscriptionPlan(ctx *gin.Context) {
	req := &schema.AISubscriptionPlanReq{}
	if handler.BindAndCheck(ctx, req) {
		return
	}
	resp, err := ctrl.aiChatConfigService.CreateSubscriptionPlan(ctx, req)
	handler.HandleResponse(ctx, err, resp)
}

func (ctrl *AIChatConfigController) UpdateSubscriptionPlan(ctx *gin.Context) {
	id, ok := pathID(ctx)
	if !ok {
		return
	}
	req := &schema.AISubscriptionPlanReq{}
	if handler.BindAndCheck(ctx, req) {
		return
	}
	resp, err := ctrl.aiChatConfigService.UpdateSubscriptionPlan(ctx, id, req)
	handler.HandleResponse(ctx, err, resp)
}

func (ctrl *AIChatConfigController) DeleteSubscriptionPlan(ctx *gin.Context) {
	id, ok := pathID(ctx)
	if !ok {
		return
	}
	err := ctrl.aiChatConfigService.DeleteSubscriptionPlan(ctx, id)
	handler.HandleResponse(ctx, err, nil)
}

func (ctrl *AIChatConfigController) ListSubscriptionRedeemCodes(ctx *gin.Context) {
	resp, err := ctrl.aiChatConfigService.ListSubscriptionRedeemCodes(ctx)
	handler.HandleResponse(ctx, err, resp)
}

func (ctrl *AIChatConfigController) GenerateSubscriptionRedeemCodes(ctx *gin.Context) {
	req := &schema.AISubscriptionRedeemCodeGenerateReq{}
	if handler.BindAndCheck(ctx, req) {
		return
	}
	resp, err := ctrl.aiChatConfigService.GenerateSubscriptionRedeemCodes(ctx, req)
	handler.HandleResponse(ctx, err, resp)
}

func (ctrl *AIChatConfigController) ListConsumeRates(ctx *gin.Context) {
	resp, err := ctrl.aiChatConfigService.ListConsumeRates(ctx)
	handler.HandleResponse(ctx, err, resp)
}

func (ctrl *AIChatConfigController) CreateConsumeRate(ctx *gin.Context) {
	req := &schema.AIModelConsumeRateReq{}
	if handler.BindAndCheck(ctx, req) {
		return
	}
	resp, err := ctrl.aiChatConfigService.SaveConsumeRate(ctx, 0, req)
	handler.HandleResponse(ctx, err, resp)
}

func (ctrl *AIChatConfigController) UpdateConsumeRate(ctx *gin.Context) {
	id, ok := pathID(ctx)
	if !ok {
		return
	}
	req := &schema.AIModelConsumeRateReq{}
	if handler.BindAndCheck(ctx, req) {
		return
	}
	resp, err := ctrl.aiChatConfigService.SaveConsumeRate(ctx, id, req)
	handler.HandleResponse(ctx, err, resp)
}

func (ctrl *AIChatConfigController) ListImageProviders(ctx *gin.Context) {
	resp, err := ctrl.aiChatConfigService.ListImageProviders(ctx)
	handler.HandleResponse(ctx, err, resp)
}

func (ctrl *AIChatConfigController) CreateImageProvider(ctx *gin.Context) {
	req := &schema.AIImageProviderReq{}
	if handler.BindAndCheck(ctx, req) {
		return
	}
	resp, err := ctrl.aiChatConfigService.CreateImageProvider(ctx, req)
	handler.HandleResponse(ctx, err, resp)
}

func (ctrl *AIChatConfigController) UpdateImageProvider(ctx *gin.Context) {
	id, ok := pathID(ctx)
	if !ok {
		return
	}
	req := &schema.AIImageProviderReq{}
	if handler.BindAndCheck(ctx, req) {
		return
	}
	resp, err := ctrl.aiChatConfigService.UpdateImageProvider(ctx, id, req)
	handler.HandleResponse(ctx, err, resp)
}

func (ctrl *AIChatConfigController) DeleteImageProvider(ctx *gin.Context) {
	id, ok := pathID(ctx)
	if !ok {
		return
	}
	err := ctrl.aiChatConfigService.DeleteImageProvider(ctx, id)
	handler.HandleResponse(ctx, err, nil)
}

func (ctrl *AIChatConfigController) ListImageModels(ctx *gin.Context) {
	resp, err := ctrl.aiChatConfigService.ListImageModels(ctx, false)
	handler.HandleResponse(ctx, err, resp)
}

func (ctrl *AIChatConfigController) CreateImageModel(ctx *gin.Context) {
	req := &schema.AIImageModelReq{}
	if handler.BindAndCheck(ctx, req) {
		return
	}
	resp, err := ctrl.aiChatConfigService.SaveImageModel(ctx, 0, req)
	handler.HandleResponse(ctx, err, resp)
}

func (ctrl *AIChatConfigController) UpdateImageModel(ctx *gin.Context) {
	id, ok := pathID(ctx)
	if !ok {
		return
	}
	req := &schema.AIImageModelReq{}
	if handler.BindAndCheck(ctx, req) {
		return
	}
	resp, err := ctrl.aiChatConfigService.SaveImageModel(ctx, id, req)
	handler.HandleResponse(ctx, err, resp)
}

func (ctrl *AIChatConfigController) DeleteImageModel(ctx *gin.Context) {
	id, ok := pathID(ctx)
	if !ok {
		return
	}
	err := ctrl.aiChatConfigService.DeleteImageModel(ctx, id)
	handler.HandleResponse(ctx, err, nil)
}

func (ctrl *AIChatConfigController) GetImageSetting(ctx *gin.Context) {
	resp, err := ctrl.aiChatConfigService.GetImageSetting(ctx)
	handler.HandleResponse(ctx, err, resp)
}

func (ctrl *AIChatConfigController) SaveImageSetting(ctx *gin.Context) {
	req := &schema.AIImageSettingReq{}
	if handler.BindAndCheck(ctx, req) {
		return
	}
	resp, err := ctrl.aiChatConfigService.SaveImageSetting(ctx, req)
	handler.HandleResponse(ctx, err, resp)
}

func (ctrl *AIChatConfigController) ListVideoProviders(ctx *gin.Context) {
	resp, err := ctrl.aiChatConfigService.ListVideoProviders(ctx)
	handler.HandleResponse(ctx, err, resp)
}

func (ctrl *AIChatConfigController) CreateVideoProvider(ctx *gin.Context) {
	req := &schema.AIVideoProviderReq{}
	if handler.BindAndCheck(ctx, req) {
		return
	}
	resp, err := ctrl.aiChatConfigService.CreateVideoProvider(ctx, req)
	handler.HandleResponse(ctx, err, resp)
}

func (ctrl *AIChatConfigController) UpdateVideoProvider(ctx *gin.Context) {
	id, ok := pathID(ctx)
	if !ok {
		return
	}
	req := &schema.AIVideoProviderReq{}
	if handler.BindAndCheck(ctx, req) {
		return
	}
	resp, err := ctrl.aiChatConfigService.UpdateVideoProvider(ctx, id, req)
	handler.HandleResponse(ctx, err, resp)
}

func (ctrl *AIChatConfigController) DeleteVideoProvider(ctx *gin.Context) {
	id, ok := pathID(ctx)
	if !ok {
		return
	}
	err := ctrl.aiChatConfigService.DeleteVideoProvider(ctx, id)
	handler.HandleResponse(ctx, err, nil)
}

func (ctrl *AIChatConfigController) ListVideoModels(ctx *gin.Context) {
	resp, err := ctrl.aiChatConfigService.ListVideoModels(ctx, false)
	handler.HandleResponse(ctx, err, resp)
}

func (ctrl *AIChatConfigController) CreateVideoModel(ctx *gin.Context) {
	req := &schema.AIVideoModelReq{}
	if handler.BindAndCheck(ctx, req) {
		return
	}
	resp, err := ctrl.aiChatConfigService.SaveVideoModel(ctx, 0, req)
	handler.HandleResponse(ctx, err, resp)
}

func (ctrl *AIChatConfigController) UpdateVideoModel(ctx *gin.Context) {
	id, ok := pathID(ctx)
	if !ok {
		return
	}
	req := &schema.AIVideoModelReq{}
	if handler.BindAndCheck(ctx, req) {
		return
	}
	resp, err := ctrl.aiChatConfigService.SaveVideoModel(ctx, id, req)
	handler.HandleResponse(ctx, err, resp)
}

func (ctrl *AIChatConfigController) DeleteVideoModel(ctx *gin.Context) {
	id, ok := pathID(ctx)
	if !ok {
		return
	}
	err := ctrl.aiChatConfigService.DeleteVideoModel(ctx, id)
	handler.HandleResponse(ctx, err, nil)
}

func (ctrl *AIChatConfigController) GetVideoSetting(ctx *gin.Context) {
	resp, err := ctrl.aiChatConfigService.GetVideoSetting(ctx)
	handler.HandleResponse(ctx, err, resp)
}

func (ctrl *AIChatConfigController) SaveVideoSetting(ctx *gin.Context) {
	req := &schema.AIVideoSettingReq{}
	if handler.BindAndCheck(ctx, req) {
		return
	}
	resp, err := ctrl.aiChatConfigService.SaveVideoSetting(ctx, req)
	handler.HandleResponse(ctx, err, resp)
}

func pathID(ctx *gin.Context) (int, bool) {
	id, err := strconv.Atoi(ctx.Param("id"))
	if err != nil || id <= 0 {
		handler.HandleResponse(ctx, errors.BadRequest(reason.RequestFormatError), nil)
		return 0, false
	}
	return id, true
}
