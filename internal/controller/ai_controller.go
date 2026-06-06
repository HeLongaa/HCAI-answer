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

package controller

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"io"
	"maps"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/apache/answer/internal/base/constant"
	"github.com/apache/answer/internal/base/handler"
	"github.com/apache/answer/internal/base/middleware"
	"github.com/apache/answer/internal/schema"
	"github.com/apache/answer/internal/schema/mcp_tools"
	"github.com/apache/answer/internal/service/ai_chat_config"
	"github.com/apache/answer/internal/service/ai_conversation"
	answercommon "github.com/apache/answer/internal/service/answer_common"
	"github.com/apache/answer/internal/service/comment"
	"github.com/apache/answer/internal/service/content"
	"github.com/apache/answer/internal/service/feature_toggle"
	questioncommon "github.com/apache/answer/internal/service/question_common"
	"github.com/apache/answer/internal/service/siteinfo_common"
	tagcommonser "github.com/apache/answer/internal/service/tag_common"
	usercommon "github.com/apache/answer/internal/service/user_common"
	"github.com/apache/answer/pkg/token"
	"github.com/gin-gonic/gin"
	"github.com/ledongthuc/pdf"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/sashabaranov/go-openai"
	"github.com/segmentfault/pacman/errors"
	"github.com/segmentfault/pacman/i18n"
	"github.com/segmentfault/pacman/log"
)

type AIController struct {
	searchService         *content.SearchService
	siteInfoService       siteinfo_common.SiteInfoCommonService
	tagCommonService      *tagcommonser.TagCommonService
	questioncommon        *questioncommon.QuestionCommon
	commentRepo           comment.CommentRepo
	userCommon            *usercommon.UserCommon
	answerRepo            answercommon.AnswerRepo
	mcpController         *MCPController
	aiChatConfigService   ai_chat_config.AiChatConfigService
	aiConversationService ai_conversation.AIConversationService
	featureToggleSvc      *feature_toggle.FeatureToggleService
}

// NewAIController new site info controller.
func NewAIController(
	searchService *content.SearchService,
	siteInfoService siteinfo_common.SiteInfoCommonService,
	tagCommonService *tagcommonser.TagCommonService,
	questioncommon *questioncommon.QuestionCommon,
	commentRepo comment.CommentRepo,
	userCommon *usercommon.UserCommon,
	answerRepo answercommon.AnswerRepo,
	mcpController *MCPController,
	aiChatConfigService ai_chat_config.AiChatConfigService,
	aiConversationService ai_conversation.AIConversationService,
	featureToggleSvc *feature_toggle.FeatureToggleService,
) *AIController {
	return &AIController{
		searchService:         searchService,
		siteInfoService:       siteInfoService,
		tagCommonService:      tagCommonService,
		questioncommon:        questioncommon,
		commentRepo:           commentRepo,
		userCommon:            userCommon,
		answerRepo:            answerRepo,
		mcpController:         mcpController,
		aiChatConfigService:   aiChatConfigService,
		aiConversationService: aiConversationService,
		featureToggleSvc:      featureToggleSvc,
	}
}

func (c *AIController) ensureAIChatEnabled(ctx *gin.Context) bool {
	if c.featureToggleSvc == nil {
		return true
	}
	if err := c.featureToggleSvc.EnsureEnabled(ctx, feature_toggle.FeatureAIChatbot); err != nil {
		handler.HandleResponse(ctx, err, nil)
		return false
	}
	return true
}

func (c *AIController) GetSubscriptionOverview(ctx *gin.Context) {
	if c.aiChatConfigService == nil {
		handler.HandleResponse(ctx, errors.BadRequest("ai chat config is not available"), nil)
		return
	}
	userID := middleware.GetLoginUserIDFromContext(ctx)
	resp, err := c.aiChatConfigService.GetSubscriptionOverview(ctx, userID)
	handler.HandleResponse(ctx, err, resp)
}

func (c *AIController) GetSubscriptionPurchase(ctx *gin.Context) {
	if c.aiChatConfigService == nil {
		handler.HandleResponse(ctx, errors.BadRequest("ai chat config is not available"), nil)
		return
	}
	userID := middleware.GetLoginUserIDFromContext(ctx)
	resp, err := c.aiChatConfigService.GetSubscriptionPurchase(ctx, userID)
	handler.HandleResponse(ctx, err, resp)
}

func (c *AIController) RedeemSubscriptionCode(ctx *gin.Context) {
	if c.aiChatConfigService == nil {
		handler.HandleResponse(ctx, errors.BadRequest("ai chat config is not available"), nil)
		return
	}
	req := &schema.AISubscriptionRedeemReq{}
	if handler.BindAndCheck(ctx, req) {
		return
	}
	userID := middleware.GetLoginUserIDFromContext(ctx)
	resp, err := c.aiChatConfigService.RedeemSubscriptionCode(ctx, userID, req)
	handler.HandleResponse(ctx, err, resp)
}

func (c *AIController) GetAIChatModels(ctx *gin.Context) {
	if c.aiChatConfigService == nil {
		handler.HandleResponse(ctx, errors.BadRequest("ai chat config is not available"), nil)
		return
	}
	userID := middleware.GetLoginUserIDFromContext(ctx)
	resp, err := c.aiChatConfigService.ListUserAvailableModels(ctx, userID)
	handler.HandleResponse(ctx, err, resp)
}

func (c *AIController) GetAIImageModels(ctx *gin.Context) {
	if c.aiChatConfigService == nil {
		handler.HandleResponse(ctx, errors.BadRequest("ai chat config is not available"), nil)
		return
	}
	resp, err := c.aiChatConfigService.ListImageModels(ctx, true)
	handler.HandleResponse(ctx, err, resp)
}

func (c *AIController) GenerateImage(ctx *gin.Context) {
	if c.aiChatConfigService == nil {
		handler.HandleResponse(ctx, errors.BadRequest("ai chat config is not available"), nil)
		return
	}
	req := &schema.AIImageGenerateReq{}
	if handler.BindAndCheck(ctx, req) {
		return
	}
	userID := middleware.GetLoginUserIDFromContext(ctx)
	if req.Stream {
		ctx.Header("Content-Type", "text/event-stream")
		ctx.Header("Cache-Control", "no-cache")
		ctx.Header("Connection", "keep-alive")
		ctx.Header("X-Accel-Buffering", "no")
		err := c.aiChatConfigService.GenerateImageStream(ctx, userID, req, ctx.Writer, func() {
			if f, ok := ctx.Writer.(http.Flusher); ok {
				f.Flush()
			}
		})
		if err != nil {
			writeImageStreamError(ctx.Writer, err)
			if f, ok := ctx.Writer.(http.Flusher); ok {
				f.Flush()
			}
		}
		return
	}
	resp, err := c.aiChatConfigService.GenerateImage(ctx, userID, req)
	handler.HandleResponse(ctx, err, resp)
}

func (c *AIController) SaveAgentImageGeneration(ctx *gin.Context) {
	if c.aiChatConfigService == nil {
		handler.HandleResponse(ctx, errors.BadRequest("ai chat config is not available"), nil)
		return
	}
	req := &schema.AIImageAgentGenerationSaveReq{}
	if handler.BindAndCheck(ctx, req) {
		return
	}
	userID := middleware.GetLoginUserIDFromContext(ctx)
	resp, err := c.aiChatConfigService.SaveAgentImageGeneration(ctx, userID, req)
	handler.HandleResponse(ctx, err, resp)
}

func writeImageStreamError(w io.Writer, err error) {
	payload, _ := json.Marshal(map[string]any{
		"type":  "image_generation.failed",
		"error": map[string]any{"message": err.Error()},
	})
	_, _ = fmt.Fprintf(w, "data: %s\n\n", payload)
}

func (c *AIController) AgentResponses(ctx *gin.Context) {
	if !c.ensureAIChatEnabled(ctx) {
		return
	}
	if c.aiChatConfigService == nil {
		handler.HandleResponse(ctx, errors.BadRequest("ai chat config is not available"), nil)
		return
	}
	req := &schema.AIAgentResponsesReq{}
	if handler.BindAndCheck(ctx, req) {
		return
	}
	if req.ReasoningEffort != "" && !validReasoningEffort(req.ReasoningEffort) {
		handler.HandleResponse(ctx, errors.BadRequest("invalid reasoning effort"), nil)
		return
	}

	upstream, err := c.aiChatConfigService.ResolveImageAgentUpstream(ctx, req.ImageModel)
	if err != nil {
		handler.HandleResponse(ctx, err, nil)
		return
	}

	body := map[string]any{
		"model":  upstream.ProviderModelID,
		"input":  req.Input,
		"stream": req.Stream && upstream.SupportsStream,
	}
	if req.Instructions != "" {
		body["instructions"] = req.Instructions
	}
	if req.Tools != nil {
		body["tools"] = req.Tools
	}
	if req.ToolChoice != nil {
		body["tool_choice"] = req.ToolChoice
	}
	if req.MaxOutputTokens > 0 {
		body["max_output_tokens"] = req.MaxOutputTokens
	}
	if req.ReasoningEffort != "" {
		body["reasoning"] = map[string]any{"effort": req.ReasoningEffort}
	}

	bodyBytes, err := json.Marshal(body)
	if err != nil {
		handler.HandleResponse(ctx, errors.BadRequest(err.Error()), nil)
		return
	}
	baseURL := strings.TrimRight(upstream.BaseURL, "/")
	const maxAttempts = 4
	var resp *http.Response
	for attempt := 1; attempt <= maxAttempts; attempt++ {
		httpReq, err := http.NewRequestWithContext(ctx.Request.Context(), http.MethodPost, baseURL+"/responses", bytes.NewReader(bodyBytes))
		if err != nil {
			handler.HandleResponse(ctx, errors.BadRequest(err.Error()), nil)
			return
		}
		httpReq.Header.Set("Authorization", fmt.Sprintf("Bearer %s", upstream.APIKey))
		httpReq.Header.Set("Content-Type", "application/json")
		httpReq.Header.Set("Accept", "application/json, text/event-stream")
		resp, err = http.DefaultClient.Do(httpReq)
		if err != nil {
			handler.HandleResponse(ctx, errors.BadRequest(err.Error()), nil)
			return
		}
		if resp.StatusCode >= http.StatusOK && resp.StatusCode < http.StatusMultipleChoices {
			break
		}
		bodyBytes, _ := io.ReadAll(resp.Body)
		_ = resp.Body.Close()
		if attempt < maxAttempts && shouldRetryAgentResponsesProxy(resp.StatusCode, bodyBytes) {
			delay := agentResponsesProxyRetryDelay(attempt)
			log.Warnf("retrying agent responses proxy status=%d attempt=%d delay=%s body=%s", resp.StatusCode, attempt, delay, string(bodyBytes))
			if err := sleepWithRequestContext(ctx.Request.Context(), delay); err != nil {
				handler.HandleResponse(ctx, errors.BadRequest(err.Error()), nil)
				return
			}
			continue
		}
		handler.HandleResponse(ctx, errors.BadRequest(fmt.Sprintf("responses status %d: %s", resp.StatusCode, string(bodyBytes))), nil)
		return
	}
	if resp == nil {
		handler.HandleResponse(ctx, errors.BadRequest("responses request did not return response"), nil)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		bodyBytes, _ := io.ReadAll(resp.Body)
		handler.HandleResponse(ctx, errors.BadRequest(fmt.Sprintf("responses status %d: %s", resp.StatusCode, string(bodyBytes))), nil)
		return
	}

	for key, values := range resp.Header {
		if strings.EqualFold(key, "Content-Length") || strings.EqualFold(key, "Transfer-Encoding") {
			continue
		}
		for _, value := range values {
			ctx.Writer.Header().Add(key, value)
		}
	}
	ctx.Status(resp.StatusCode)
	if _, err := io.Copy(ctx.Writer, resp.Body); err != nil {
		log.Errorf("failed to proxy agent responses: %v", err)
	}
	if f, ok := ctx.Writer.(http.Flusher); ok {
		f.Flush()
	}
}

func shouldRetryAgentResponsesProxy(statusCode int, body []byte) bool {
	if statusCode != http.StatusTooManyRequests && statusCode != http.StatusBadGateway && statusCode != http.StatusServiceUnavailable {
		return false
	}
	text := strings.ToLower(string(body))
	return statusCode == http.StatusServiceUnavailable ||
		strings.Contains(text, "rate limit") ||
		strings.Contains(text, "try again") ||
		strings.Contains(text, "temporarily unavailable") ||
		strings.Contains(text, "service unavailable") ||
		strings.Contains(text, "upstream_error") ||
		strings.Contains(text, "upstream request failed")
}

func agentResponsesProxyRetryDelay(attempt int) time.Duration {
	switch attempt {
	case 1:
		return 300 * time.Millisecond
	case 2:
		return 900 * time.Millisecond
	default:
		return 1800 * time.Millisecond
	}
}

func sleepWithRequestContext(ctx context.Context, delay time.Duration) error {
	timer := time.NewTimer(delay)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}

func (c *AIController) EditImage(ctx *gin.Context) {
	if c.aiChatConfigService == nil {
		handler.HandleResponse(ctx, errors.BadRequest("ai chat config is not available"), nil)
		return
	}
	req := &schema.AIImageEditReq{}
	if handler.BindAndCheck(ctx, req) {
		return
	}
	userID := middleware.GetLoginUserIDFromContext(ctx)
	resp, err := c.aiChatConfigService.EditImage(ctx, userID, req)
	handler.HandleResponse(ctx, err, resp)
}

func (c *AIController) GetImageGenerations(ctx *gin.Context) {
	if c.aiChatConfigService == nil {
		handler.HandleResponse(ctx, errors.BadRequest("ai chat config is not available"), nil)
		return
	}
	limit := 30
	if raw := ctx.Query("limit"); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil {
			limit = parsed
		}
	}
	userID := middleware.GetLoginUserIDFromContext(ctx)
	resp, err := c.aiChatConfigService.ListUserImageGenerations(ctx, userID, limit)
	handler.HandleResponse(ctx, err, resp)
}

func (c *AIController) DeleteImageGeneration(ctx *gin.Context) {
	if c.aiChatConfigService == nil {
		handler.HandleResponse(ctx, errors.BadRequest("ai chat config is not available"), nil)
		return
	}
	req := &schema.AIImageGenerationDeleteReq{}
	if handler.BindAndCheck(ctx, req) {
		return
	}
	userID := middleware.GetLoginUserIDFromContext(ctx)
	err := c.aiChatConfigService.DeleteUserImageGeneration(ctx, userID, req.GenerationID)
	handler.HandleResponse(ctx, err, nil)
}

func (c *AIController) GetImageAgentConversations(ctx *gin.Context) {
	if c.aiChatConfigService == nil {
		handler.HandleResponse(ctx, errors.BadRequest("ai chat config is not available"), nil)
		return
	}
	userID := middleware.GetLoginUserIDFromContext(ctx)
	resp, err := c.aiChatConfigService.ListUserImageAgentConversations(ctx, userID)
	handler.HandleResponse(ctx, err, resp)
}

func (c *AIController) SaveImageAgentConversation(ctx *gin.Context) {
	if c.aiChatConfigService == nil {
		handler.HandleResponse(ctx, errors.BadRequest("ai chat config is not available"), nil)
		return
	}
	req := &schema.AIImageAgentConversationSaveReq{}
	if handler.BindAndCheck(ctx, req) {
		return
	}
	userID := middleware.GetLoginUserIDFromContext(ctx)
	resp, err := c.aiChatConfigService.SaveUserImageAgentConversation(ctx, userID, req)
	handler.HandleResponse(ctx, err, resp)
}

func (c *AIController) DeleteImageAgentConversation(ctx *gin.Context) {
	if c.aiChatConfigService == nil {
		handler.HandleResponse(ctx, errors.BadRequest("ai chat config is not available"), nil)
		return
	}
	req := &schema.AIImageAgentConversationDeleteReq{}
	if handler.BindAndCheck(ctx, req) {
		return
	}
	userID := middleware.GetLoginUserIDFromContext(ctx)
	err := c.aiChatConfigService.DeleteUserImageAgentConversation(ctx, userID, req.ConversationID)
	handler.HandleResponse(ctx, err, nil)
}

func (c *AIController) GetImageAsset(ctx *gin.Context) {
	if c.aiChatConfigService == nil {
		handler.HandleResponse(ctx, errors.BadRequest("ai chat config is not available"), nil)
		return
	}
	userID := middleware.GetLoginUserIDFromContext(ctx)
	filePath, err := c.aiChatConfigService.GetUserImageFilePath(
		ctx,
		userID,
		ctx.Param("user_id"),
		ctx.Param("filename"),
	)
	if err != nil {
		handler.HandleResponse(ctx, err, nil)
		return
	}
	ctx.File(filePath)
}

func (c *AIController) GetAIVideoModels(ctx *gin.Context) {
	if c.aiChatConfigService == nil {
		handler.HandleResponse(ctx, errors.BadRequest("ai chat config is not available"), nil)
		return
	}
	resp, err := c.aiChatConfigService.ListVideoModels(ctx, true)
	handler.HandleResponse(ctx, err, resp)
}

func (c *AIController) GenerateVideo(ctx *gin.Context) {
	if c.aiChatConfigService == nil {
		handler.HandleResponse(ctx, errors.BadRequest("ai chat config is not available"), nil)
		return
	}
	req := &schema.AIVideoGenerateReq{}
	if handler.BindAndCheck(ctx, req) {
		return
	}
	userID := middleware.GetLoginUserIDFromContext(ctx)
	resp, err := c.aiChatConfigService.GenerateVideo(ctx, userID, req)
	handler.HandleResponse(ctx, err, resp)
}

func (c *AIController) GetVideoGenerations(ctx *gin.Context) {
	if c.aiChatConfigService == nil {
		handler.HandleResponse(ctx, errors.BadRequest("ai chat config is not available"), nil)
		return
	}
	limit := 30
	if raw := ctx.Query("limit"); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil {
			limit = parsed
		}
	}
	userID := middleware.GetLoginUserIDFromContext(ctx)
	resp, err := c.aiChatConfigService.ListUserVideoGenerations(ctx, userID, limit)
	handler.HandleResponse(ctx, err, resp)
}

func (c *AIController) GetVideoAsset(ctx *gin.Context) {
	if c.aiChatConfigService == nil {
		handler.HandleResponse(ctx, errors.BadRequest("ai chat config is not available"), nil)
		return
	}
	userID := middleware.GetLoginUserIDFromContext(ctx)
	filePath, err := c.aiChatConfigService.GetUserVideoFilePath(
		ctx,
		userID,
		ctx.Param("user_id"),
		ctx.Param("filename"),
	)
	if err != nil {
		handler.HandleResponse(ctx, err, nil)
		return
	}
	ctx.File(filePath)
}

type ChatCompletionsRequest struct {
	Messages              []Message `validate:"required,gte=1" json:"messages"`
	Model                 string    `json:"model"`
	ConversationID        string    `json:"conversation_id"`
	BranchParentMessageID string    `json:"branch_parent_message_id"`
	ReasoningEffort       string    `json:"reasoning_effort"`
	Stream                *bool     `json:"stream"`
	UserID                string    `json:"-"`
}

type Message struct {
	Role    string      `json:"role" binding:"required"`
	Content string      `json:"content"`
	Images  []ChatImage `json:"images"`
	Files   []ChatFile  `json:"files"`
}

type ChatImage struct {
	URL string `json:"url"`
}

type ChatFile struct {
	Name          string `json:"name"`
	Type          string `json:"type"`
	Size          int64  `json:"size"`
	Content       string `json:"content"`
	Data          string `json:"data"`
	ParsedContent string `json:"-"`
}

type ChatCompletionsResponse struct {
	ID      string   `json:"id"`
	Object  string   `json:"object"`
	Created int64    `json:"created"`
	Model   string   `json:"model"`
	Choices []Choice `json:"choices"`
	Usage   Usage    `json:"usage"`
}

type StreamResponse struct {
	ChatCompletionID string         `json:"chat_completion_id"`
	Object           string         `json:"object"`
	Created          int64          `json:"created"`
	Model            string         `json:"model"`
	Choices          []StreamChoice `json:"choices"`
}

type Choice struct {
	Index        int     `json:"index"`
	Message      Message `json:"message"`
	FinishReason string  `json:"finish_reason"`
}

type StreamChoice struct {
	Index        int     `json:"index"`
	Delta        Delta   `json:"delta"`
	FinishReason *string `json:"finish_reason"`
}

type Delta struct {
	Role    string `json:"role,omitempty"`
	Content string `json:"content,omitempty"`
}

type Usage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

type ConversationContext struct {
	ConversationID        string
	UserID                string
	UserQuestion          string
	Messages              []*ai_conversation.ConversationMessage
	IsNewConversation     bool
	Model                 string
	EnableTools           bool
	BranchParentMessageID string
	ReasoningEffort       string
	Stream                bool
	UpstreamStream        bool
}

func (c *ConversationContext) GetOpenAIMessages() []openai.ChatCompletionMessage {
	messages := make([]openai.ChatCompletionMessage, len(c.Messages))
	for i, msg := range c.Messages {
		content := withMessageFiles(msg.Content, msg.Files)
		message := openai.ChatCompletionMessage{
			Role:    msg.Role,
			Content: content,
		}
		if msg.Role == openai.ChatMessageRoleUser && len(msg.Images) > 0 {
			parts := []openai.ChatMessagePart{
				{
					Type: openai.ChatMessagePartTypeText,
					Text: content,
				},
			}
			for _, image := range msg.Images {
				parts = append(parts, openai.ChatMessagePart{
					Type: openai.ChatMessagePartTypeImageURL,
					ImageURL: &openai.ChatMessageImageURL{
						URL:    image,
						Detail: openai.ImageURLDetailAuto,
					},
				})
			}
			message.Content = ""
			message.MultiContent = parts
		}
		messages[i] = message
	}
	return messages
}

// sendStreamData
func sendStreamData(w http.ResponseWriter, data StreamResponse) {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return
	}

	_, _ = fmt.Fprintf(w, "data: %s\n\n", string(jsonData))
	if f, ok := w.(http.Flusher); ok {
		f.Flush()
	}
}

func validateChatCompletionsRequest(req *ChatCompletionsRequest) error {
	if len(req.Messages) == 0 {
		return errors.BadRequest("messages are required")
	}
	if req.ReasoningEffort != "" && !validReasoningEffort(req.ReasoningEffort) {
		return errors.BadRequest("invalid reasoning effort")
	}
	for msgIndex := range req.Messages {
		msg := &req.Messages[msgIndex]
		if strings.TrimSpace(msg.Content) == "" && len(msg.Images) == 0 && len(msg.Files) == 0 {
			return errors.BadRequest("message content, image, or file is required")
		}
		if len(msg.Images) > 4 {
			return errors.BadRequest("a message can contain at most 4 images")
		}
		if len(msg.Files) > 5 {
			return errors.BadRequest("a message can contain at most 5 files")
		}
		for _, image := range msg.Images {
			imageURL := strings.TrimSpace(image.URL)
			if imageURL == "" {
				return errors.BadRequest("image url is required")
			}
			if !strings.HasPrefix(imageURL, "data:image/") &&
				!strings.HasPrefix(imageURL, "http://") &&
				!strings.HasPrefix(imageURL, "https://") {
				return errors.BadRequest("image must be a data url or http url")
			}
			if len(imageURL) > 10*1024*1024 {
				return errors.BadRequest("image is too large")
			}
		}
		for fileIndex := range msg.Files {
			file := &msg.Files[fileIndex]
			if strings.TrimSpace(file.Name) == "" {
				return errors.BadRequest("file name is required")
			}
			if strings.TrimSpace(file.Content) == "" && strings.TrimSpace(file.Data) == "" {
				return errors.BadRequest("file content is required")
			}
			if len(file.Content) > 10*1024*1024 || len(file.Data) > 14*1024*1024 {
				return errors.BadRequest("file content is too large")
			}
			content, err := extractChatFileContent(*file)
			if err != nil {
				return errors.BadRequest(err.Error())
			}
			if strings.TrimSpace(content) == "" {
				return errors.BadRequest("file content is empty or unsupported")
			}
			file.ParsedContent = content
		}
	}
	return nil
}

func validReasoningEffort(value string) bool {
	switch value {
	case "none", "minimal", "low", "medium", "high", "xhigh":
		return true
	default:
		return false
	}
}

func countMessageImages(messages []Message) int {
	count := 0
	for _, msg := range messages {
		count += len(msg.Images)
	}
	return count
}

func countMessageFiles(messages []Message) int {
	count := 0
	for _, msg := range messages {
		count += len(msg.Files)
	}
	return count
}

func messageImages(msg Message) []string {
	if len(msg.Images) == 0 {
		return nil
	}
	images := make([]string, 0, len(msg.Images))
	for _, image := range msg.Images {
		if imageURL := strings.TrimSpace(image.URL); imageURL != "" {
			images = append(images, imageURL)
		}
	}
	return images
}

func extractChatFileContent(file ChatFile) (string, error) {
	if strings.TrimSpace(file.Content) != "" {
		return strings.TrimSpace(file.Content), nil
	}
	data, err := decodeDataURL(file.Data)
	if err != nil {
		return "", fmt.Errorf("file data is invalid")
	}
	switch strings.ToLower(strings.TrimPrefix(filepath.Ext(file.Name), ".")) {
	case "pdf":
		return extractPDFText(data)
	case "docx":
		return extractDocxText(data)
	case "xlsx":
		return extractXlsxText(data)
	case "pptx":
		return extractPptxText(data)
	default:
		return "", fmt.Errorf("unsupported file type")
	}
}

func decodeDataURL(value string) ([]byte, error) {
	value = strings.TrimSpace(value)
	if comma := strings.Index(value, ","); comma >= 0 {
		value = value[comma+1:]
	}
	return base64.StdEncoding.DecodeString(value)
}

func extractPDFText(data []byte) (string, error) {
	tmp, err := os.CreateTemp("", "answer-ai-chat-*.pdf")
	if err != nil {
		return "", err
	}
	tmpName := tmp.Name()
	defer func() {
		_ = os.Remove(tmpName)
	}()
	if _, err = tmp.Write(data); err != nil {
		_ = tmp.Close()
		return "", err
	}
	if err = tmp.Close(); err != nil {
		return "", err
	}
	f, reader, err := pdf.Open(tmpName)
	if err != nil {
		return "", err
	}
	defer func() {
		_ = f.Close()
	}()
	textReader, err := reader.GetPlainText()
	if err != nil {
		return "", err
	}
	text, err := io.ReadAll(textReader)
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(text)), nil
}

func extractDocxText(data []byte) (string, error) {
	return extractZipXMLText(data, func(name string) bool {
		return name == "word/document.xml" ||
			strings.HasPrefix(name, "word/header") ||
			strings.HasPrefix(name, "word/footer")
	})
}

func extractPptxText(data []byte) (string, error) {
	return extractZipXMLText(data, func(name string) bool {
		return strings.HasPrefix(name, "ppt/slides/slide") &&
			strings.HasSuffix(name, ".xml")
	})
}

func extractXlsxText(data []byte) (string, error) {
	return extractZipXMLText(data, func(name string) bool {
		return name == "xl/sharedStrings.xml" ||
			(strings.HasPrefix(name, "xl/worksheets/sheet") &&
				strings.HasSuffix(name, ".xml"))
	})
}

func extractZipXMLText(data []byte, include func(name string) bool) (string, error) {
	reader, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return "", err
	}
	files := make([]*zip.File, 0)
	for _, file := range reader.File {
		if include(file.Name) {
			files = append(files, file)
		}
	}
	sort.Slice(files, func(i, j int) bool {
		return files[i].Name < files[j].Name
	})
	var builder strings.Builder
	for _, file := range files {
		content, err := readZipXMLText(file)
		if err != nil {
			return "", err
		}
		if content == "" {
			continue
		}
		if builder.Len() > 0 {
			builder.WriteString("\n\n")
		}
		builder.WriteString(content)
	}
	return strings.TrimSpace(builder.String()), nil
}

func readZipXMLText(file *zip.File) (string, error) {
	rc, err := file.Open()
	if err != nil {
		return "", err
	}
	defer func() {
		_ = rc.Close()
	}()
	decoder := xml.NewDecoder(rc)
	var parts []string
	for {
		token, err := decoder.Token()
		if err == io.EOF {
			break
		}
		if err != nil {
			return "", err
		}
		charData, ok := token.(xml.CharData)
		if !ok {
			continue
		}
		text := strings.TrimSpace(string(charData))
		if text != "" {
			parts = append(parts, text)
		}
	}
	return strings.Join(parts, " "), nil
}

func messageFiles(msg Message) []ai_conversation.ConversationFile {
	if len(msg.Files) == 0 {
		return nil
	}
	files := make([]ai_conversation.ConversationFile, 0, len(msg.Files))
	for _, file := range msg.Files {
		files = append(files, ai_conversation.ConversationFile{
			Name:    strings.TrimSpace(file.Name),
			Type:    strings.TrimSpace(file.Type),
			Size:    file.Size,
			Content: file.ParsedContent,
		})
	}
	return files
}

func withMessageFiles(content string, files []ai_conversation.ConversationFile) string {
	if len(files) == 0 {
		return content
	}
	var builder strings.Builder
	builder.WriteString(content)
	if strings.TrimSpace(content) != "" {
		builder.WriteString("\n\n")
	}
	builder.WriteString("用户上传的文件内容：")
	for _, file := range files {
		builder.WriteString("\n\n---\n文件名：")
		builder.WriteString(file.Name)
		if file.Type != "" {
			builder.WriteString("\n类型：")
			builder.WriteString(file.Type)
		}
		builder.WriteString("\n内容：\n")
		builder.WriteString(file.Content)
	}
	return builder.String()
}

func conversationTopicFromMessage(msg Message) string {
	content := strings.TrimSpace(msg.Content)
	if content != "" {
		return content
	}
	if len(msg.Images) > 0 {
		return "图片消息"
	}
	if len(msg.Files) > 0 {
		return "文件消息"
	}
	return ""
}

func (c *AIController) ChatCompletions(ctx *gin.Context) {
	if !c.ensureAIChatEnabled(ctx) {
		return
	}
	req := &ChatCompletionsRequest{}
	if handler.BindAndCheck(ctx, req) {
		return
	}
	req.UserID = middleware.GetLoginUserIDFromContext(ctx)
	if err := validateChatCompletionsRequest(req); err != nil {
		handler.HandleResponse(ctx, err, nil)
		return
	}

	clientWantsStream := req.Stream == nil || *req.Stream
	log.Infof("ai chat request model=%s conversation_id=%s messages=%d images=%d files=%d stream=%v reasoning_effort=%s", req.Model, req.ConversationID, len(req.Messages), countMessageImages(req.Messages), countMessageFiles(req.Messages), clientWantsStream, req.ReasoningEffort)

	model := ""
	var client *openai.Client
	siteModelID := ""
	var upstream *schema.AIUpstreamModelResp
	var cost float64
	var err error
	enableTools := true
	upstreamSupportsStream := true
	if req.Model != "" && c.aiChatConfigService != nil {
		if err := c.aiChatConfigService.CheckUserModelPermission(ctx, req.UserID, req.Model); err != nil {
			handler.HandleResponse(ctx, err, nil)
			return
		}
		upstream, err = c.aiChatConfigService.ResolveUpstreamModel(ctx, req.Model)
		if err != nil {
			handler.HandleResponse(ctx, err, nil)
			return
		}
		if countMessageImages(req.Messages) > 0 && !upstream.SupportsVision {
			handler.HandleResponse(ctx, errors.BadRequest("current model does not support image understanding"), nil)
			return
		}
		cost, err = c.aiChatConfigService.CalculateChatCost(ctx, req.Model, 1)
		if err != nil {
			handler.HandleResponse(ctx, err, nil)
			return
		}
		if err := c.aiChatConfigService.DeductUserPoints(ctx, req.UserID, cost); err != nil {
			handler.HandleResponse(ctx, err, nil)
			return
		}
		siteModelID = req.Model
		model = upstream.ProviderModelID
		client = c.createOpenAIClient(upstream.BaseURL, upstream.APIKey)
		upstreamSupportsStream = upstream.SupportsStream
		enableTools = false
	} else {
		aiConfig, err := c.siteInfoService.GetSiteAI(context.Background())
		if err != nil {
			log.Errorf("Failed to get AI config: %v", err)
			handler.HandleResponse(ctx, errors.BadRequest("AI service configuration error"), nil)
			return
		}
		if !aiConfig.Enabled {
			handler.HandleResponse(ctx, errors.ServiceUnavailable("AI service is not enabled"), nil)
			return
		}
		aiProvider := aiConfig.GetProvider()
		model = aiProvider.Model
		client = c.createOpenAIClient(aiProvider.APIHost, aiProvider.APIKey)
	}

	upstreamStream := clientWantsStream && upstreamSupportsStream
	chatcmplID := "chatcmpl-" + token.GenerateToken()
	created := time.Now().Unix()
	conversationCtx := c.initializeConversationContext(ctx, model, enableTools, req)
	if conversationCtx == nil {
		log.Error("Failed to initialize conversation context")
		if clientWantsStream {
			c.prepareStreamResponse(ctx)
			c.sendErrorResponse(ctx.Writer, chatcmplID, model, "Failed to initialize conversation context")
			c.sendStreamDone(ctx.Writer, chatcmplID, model, created)
			return
		}
		handler.HandleResponse(ctx, errors.BadRequest("Failed to initialize conversation context"), nil)
		return
	}
	conversationCtx.Stream = clientWantsStream
	conversationCtx.UpstreamStream = upstreamStream

	if clientWantsStream {
		c.prepareStreamResponse(ctx)
		w := ctx.Writer
		sendStreamData(w, StreamResponse{
			ChatCompletionID: chatcmplID,
			Object:           "chat.completion.chunk",
			Created:          created,
			Model:            model,
			Choices:          []StreamChoice{{Index: 0, Delta: Delta{Role: "assistant"}, FinishReason: nil}},
		})

		if upstreamStream {
			c.redirectRequestToAI(ctx, w, chatcmplID, conversationCtx, client)
		} else {
			aiResponse, err := c.handleAINonStreamConversation(ctx, chatcmplID, client, conversationCtx)
			if err != nil {
				c.sendErrorResponse(w, chatcmplID, model, err.Error())
			} else if aiResponse != "" {
				sendStreamData(w, StreamResponse{
					ChatCompletionID: chatcmplID,
					Object:           "chat.completion.chunk",
					Created:          time.Now().Unix(),
					Model:            model,
					Choices: []StreamChoice{{
						Index:        0,
						Delta:        Delta{Content: aiResponse},
						FinishReason: nil,
					}},
				})
			}
		}

		c.sendStreamDone(w, chatcmplID, model, created)
		c.saveConversationRecord(ctx, chatcmplID, conversationCtx)
		c.recordChatUsage(ctx, req, conversationCtx, chatcmplID, siteModelID, upstream, cost)
		return
	}

	aiResponse, err := c.handleAINonStreamConversation(ctx, chatcmplID, client, conversationCtx)
	if err != nil {
		handler.HandleResponse(ctx, errors.BadRequest(err.Error()), nil)
		return
	}
	c.saveConversationRecord(ctx, chatcmplID, conversationCtx)
	c.recordChatUsage(ctx, req, conversationCtx, chatcmplID, siteModelID, upstream, cost)
	ctx.JSON(http.StatusOK, ChatCompletionsResponse{
		ID:      chatcmplID,
		Object:  "chat.completion",
		Created: created,
		Model:   model,
		Choices: []Choice{{
			Index:        0,
			Message:      Message{Role: "assistant", Content: aiResponse},
			FinishReason: "stop",
		}},
	})
}

func (c *AIController) prepareStreamResponse(ctx *gin.Context) {
	ctx.Header("Content-Type", "text/event-stream")
	ctx.Header("Cache-Control", "no-cache")
	ctx.Header("Connection", "keep-alive")
	ctx.Header("Access-Control-Allow-Origin", "*")
	ctx.Header("Access-Control-Allow-Headers", "Cache-Control")

	ctx.Status(http.StatusOK)
	if f, ok := ctx.Writer.(http.Flusher); ok {
		f.Flush()
	}
}

func (c *AIController) sendStreamDone(w http.ResponseWriter, id, model string, created int64) {
	finishReason := "stop"
	sendStreamData(w, StreamResponse{
		ChatCompletionID: id,
		Object:           "chat.completion.chunk",
		Created:          created,
		Model:            model,
		Choices:          []StreamChoice{{Index: 0, Delta: Delta{}, FinishReason: &finishReason}},
	})
	_, _ = fmt.Fprintf(w, "data: [DONE]\n\n")
	if f, ok := w.(http.Flusher); ok {
		f.Flush()
	}
}

func (c *AIController) recordChatUsage(ctx context.Context, req *ChatCompletionsRequest, conversationCtx *ConversationContext, chatcmplID, siteModelID string, upstream *schema.AIUpstreamModelResp, cost float64) {
	if siteModelID != "" && upstream != nil {
		if err := c.aiChatConfigService.RecordChatUsage(ctx, &schema.AIChatUsageLogReq{
			UserID:           req.UserID,
			ConversationID:   conversationCtx.ConversationID,
			ChatCompletionID: chatcmplID,
			SiteModelID:      siteModelID,
			ProviderID:       upstream.ProviderID,
			ProviderName:     upstream.ProviderName,
			ProviderModelID:  upstream.ProviderModelID,
			ConsumePoints:    cost,
		}); err != nil {
			log.Errorf("Failed to record chat usage: %v", err)
		}
	}
}

func (c *AIController) redirectRequestToAI(ctx *gin.Context, w http.ResponseWriter, id string, conversationCtx *ConversationContext, client *openai.Client) {
	c.handleAIConversation(ctx, w, id, client, conversationCtx)
}

// createOpenAIClient
func (c *AIController) createOpenAIClient(apiHost, apiKey string) *openai.Client {
	config := openai.DefaultConfig(apiKey)
	config.BaseURL = strings.TrimRight(apiHost, "/")
	if !strings.HasSuffix(config.BaseURL, "/v1") {
		config.BaseURL += "/v1"
	}
	return openai.NewClientWithConfig(config)
}

// getPromptByLanguage
func (c *AIController) getPromptByLanguage(language i18n.Language, question string) string {
	aiConfig, err := c.siteInfoService.GetSiteAI(context.Background())
	if err != nil {
		log.Errorf("Failed to get AI config: %v", err)
		return c.getDefaultPrompt(language, question)
	}

	var promptTemplate string

	switch language {
	case i18n.LanguageChinese:
		promptTemplate = aiConfig.PromptConfig.ZhCN
	case i18n.LanguageEnglish:
		promptTemplate = aiConfig.PromptConfig.EnUS
	default:
		promptTemplate = aiConfig.PromptConfig.EnUS
	}

	if promptTemplate == "" {
		return c.getDefaultPrompt(language, question)
	}

	return fmt.Sprintf(promptTemplate, question)
}

// getDefaultPrompt prompt
func (c *AIController) getDefaultPrompt(language i18n.Language, question string) string {
	switch language {
	case i18n.LanguageChinese:
		return fmt.Sprintf(constant.DefaultAIPromptConfigZhCN, question)
	case i18n.LanguageEnglish:
		return fmt.Sprintf(constant.DefaultAIPromptConfigEnUS, question)
	default:
		return fmt.Sprintf(constant.DefaultAIPromptConfigEnUS, question)
	}
}

// initializeConversationContext
func (c *AIController) initializeConversationContext(ctx *gin.Context, model string, enableTools bool, req *ChatCompletionsRequest) *ConversationContext {
	if len(req.ConversationID) == 0 {
		req.ConversationID = token.GenerateToken()
	}
	conversationCtx := &ConversationContext{
		UserID:                req.UserID,
		Messages:              make([]*ai_conversation.ConversationMessage, 0),
		ConversationID:        req.ConversationID,
		Model:                 model,
		EnableTools:           enableTools,
		BranchParentMessageID: req.BranchParentMessageID,
		ReasoningEffort:       req.ReasoningEffort,
	}

	conversationDetail, exist, err := c.aiConversationService.GetConversationDetail(ctx, &schema.AIConversationDetailReq{
		ConversationID: req.ConversationID,
		UserID:         req.UserID,
	})
	if err != nil {
		log.Errorf("Failed to get conversation detail: %v", err)
		return nil
	}
	if !exist {
		conversationCtx.UserQuestion = conversationTopicFromMessage(req.Messages[0])
		conversationCtx.Messages = c.buildInitialMessages(ctx, req)
		conversationCtx.IsNewConversation = true
		return conversationCtx
	}
	conversationCtx.IsNewConversation = false

	for _, record := range conversationDetail.Records {
		if record.Role == "assistant" && record.ParentMessageID != "" && !record.Active {
			continue
		}
		conversationCtx.Messages = append(conversationCtx.Messages, &ai_conversation.ConversationMessage{
			ChatCompletionID: record.ChatCompletionID,
			MessageID:        record.MessageID,
			ParentMessageID:  record.ParentMessageID,
			BranchIndex:      record.BranchIndex,
			Active:           record.Active,
			Role:             record.Role,
			Content:          record.Content,
		})
		if req.BranchParentMessageID != "" && record.MessageID == req.BranchParentMessageID {
			return conversationCtx
		}
	}
	if req.BranchParentMessageID != "" {
		log.Warnf("branch parent message not found: %s", req.BranchParentMessageID)
		return nil
	}
	conversationCtx.Messages = append(conversationCtx.Messages, &ai_conversation.ConversationMessage{
		Role:    req.Messages[0].Role,
		Content: req.Messages[0].Content,
		Images:  messageImages(req.Messages[0]),
		Files:   messageFiles(req.Messages[0]),
	})
	return conversationCtx
}

// buildInitialMessages
func (c *AIController) buildInitialMessages(ctx *gin.Context, req *ChatCompletionsRequest) []*ai_conversation.ConversationMessage {
	if req.Model != "" {
		messages := make([]*ai_conversation.ConversationMessage, len(req.Messages))
		for i, msg := range req.Messages {
			messages[i] = &ai_conversation.ConversationMessage{
				Role:    msg.Role,
				Content: msg.Content,
				Images:  messageImages(msg),
				Files:   messageFiles(msg),
			}
		}
		return messages
	}

	question := ""
	if len(req.Messages) == 1 {
		question = req.Messages[0].Content
	} else {
		messages := make([]*ai_conversation.ConversationMessage, len(req.Messages))
		for i, msg := range req.Messages {
			messages[i] = &ai_conversation.ConversationMessage{
				Role:    msg.Role,
				Content: msg.Content,
				Images:  messageImages(msg),
				Files:   messageFiles(msg),
			}
		}
		return messages
	}

	currentLang := handler.GetLangByCtx(ctx)

	prompt := c.getPromptByLanguage(currentLang, question)

	return []*ai_conversation.ConversationMessage{{Role: openai.ChatMessageRoleUser, Content: prompt}}
}

// saveConversationRecord
func (c *AIController) saveConversationRecord(ctx context.Context, chatcmplID string, conversationCtx *ConversationContext) {
	if conversationCtx == nil || len(conversationCtx.Messages) == 0 {
		return
	}

	if conversationCtx.IsNewConversation {
		topic := conversationCtx.UserQuestion
		if topic == "" {
			log.Warn("No user message found for new conversation")
			return
		}

		err := c.aiConversationService.CreateConversation(ctx, conversationCtx.UserID, conversationCtx.ConversationID, topic)
		if err != nil {
			log.Errorf("Failed to create conversation: %v", err)
			return
		}
	}

	err := c.aiConversationService.SaveConversationRecords(ctx, conversationCtx.ConversationID, chatcmplID, conversationCtx.BranchParentMessageID, conversationCtx.Messages)
	if err != nil {
		log.Errorf("Failed to save conversation records: %v", err)
	}
}

func (c *AIController) handleAIConversation(ctx *gin.Context, w http.ResponseWriter, id string, client *openai.Client, conversationCtx *ConversationContext) {
	maxRounds := 10
	messages := conversationCtx.GetOpenAIMessages()

	for round := range maxRounds {
		log.Debugf("AI conversation round: %d", round+1)

		aiReq := openai.ChatCompletionRequest{
			Model:    conversationCtx.Model,
			Messages: messages,
			Stream:   true,
		}
		if conversationCtx.ReasoningEffort != "" {
			aiReq.ReasoningEffort = conversationCtx.ReasoningEffort
		}
		if conversationCtx.EnableTools {
			aiReq.Tools = c.getMCPTools()
		}

		toolCalls, newMessages, finished, aiResponse := c.processAIStream(ctx, w, id, conversationCtx.Model, client, aiReq, messages)
		messages = newMessages

		log.Debugf("Round %d: toolCalls=%v", round+1, toolCalls)
		if aiResponse != "" {
			conversationCtx.Messages = append(conversationCtx.Messages, &ai_conversation.ConversationMessage{
				Role:    "assistant",
				Content: aiResponse,
			})
		}

		if finished {
			return
		}

		if len(toolCalls) > 0 {
			messages = c.executeToolCalls(ctx, w, id, conversationCtx.Model, toolCalls, messages)
		} else {
			return
		}
	}

	log.Warnf("AI conversation reached maximum rounds limit: %d", maxRounds)
}

func (c *AIController) handleAINonStreamConversation(ctx *gin.Context, id string, client *openai.Client, conversationCtx *ConversationContext) (string, error) {
	maxRounds := 10
	messages := conversationCtx.GetOpenAIMessages()

	requestCtx := context.Background()
	if ctx != nil && ctx.Request != nil {
		requestCtx = ctx.Request.Context()
	}

	for round := range maxRounds {
		log.Debugf("AI non-stream conversation round: %d", round+1)

		aiReq := openai.ChatCompletionRequest{
			Model:    conversationCtx.Model,
			Messages: messages,
			Stream:   false,
		}
		if conversationCtx.ReasoningEffort != "" {
			aiReq.ReasoningEffort = conversationCtx.ReasoningEffort
		}
		if conversationCtx.EnableTools {
			aiReq.Tools = c.getMCPTools()
		}

		response, err := client.CreateChatCompletion(requestCtx, aiReq)
		if err != nil {
			return "", fmt.Errorf("failed to create AI completion: %w", err)
		}
		if len(response.Choices) == 0 {
			return "", fmt.Errorf("AI completion returned no choices")
		}

		choice := response.Choices[0]
		if len(choice.Message.ToolCalls) > 0 || choice.FinishReason == "tool_calls" {
			messages = c.executeToolCalls(ctx, nil, id, conversationCtx.Model, choice.Message.ToolCalls, messages)
			continue
		}

		messages = append(messages, choice.Message)
		aiResponse := choice.Message.Content
		if aiResponse != "" {
			conversationCtx.Messages = append(conversationCtx.Messages, &ai_conversation.ConversationMessage{
				Role:    "assistant",
				Content: aiResponse,
			})
		}
		return aiResponse, nil
	}

	return "", fmt.Errorf("AI conversation reached maximum rounds limit")
}

// processAIStream
func (c *AIController) processAIStream(
	ctx *gin.Context, w http.ResponseWriter, id, model string, client *openai.Client, aiReq openai.ChatCompletionRequest, messages []openai.ChatCompletionMessage) (
	[]openai.ToolCall, []openai.ChatCompletionMessage, bool, string) {
	requestCtx := context.Background()
	if ctx != nil && ctx.Request != nil {
		requestCtx = ctx.Request.Context()
	}
	stream, err := client.CreateChatCompletionStream(requestCtx, aiReq)
	if err != nil {
		if requestCtx.Err() != nil {
			log.Infof("AI stream request cancelled before start: %v", requestCtx.Err())
			return nil, messages, true, ""
		}
		log.Errorf("Failed to create stream: %v", err)
		c.sendErrorResponse(w, id, model, fmt.Sprintf("Failed to create AI stream: %s", err.Error()))
		return nil, messages, true, ""
	}
	defer func() {
		_ = stream.Close()
	}()

	var currentToolCalls []openai.ToolCall
	var accumulatedContent strings.Builder
	var accumulatedMessage openai.ChatCompletionMessage
	toolCallsMap := make(map[int]*openai.ToolCall)

	for {
		response, err := stream.Recv()
		if err != nil {
			if err.Error() == "EOF" {
				log.Info("Stream finished")
				break
			}
			if requestCtx.Err() != nil {
				log.Infof("AI stream request cancelled: %v", requestCtx.Err())
				break
			}
			log.Errorf("Stream error: %v", err)
			errorContent := fmt.Sprintf("Error: %s", err.Error())
			accumulatedContent.WriteString(errorContent)
			c.sendErrorResponse(w, id, model, err.Error())
			break
		}

		if len(response.Choices) == 0 {
			continue
		}

		choice := response.Choices[0]

		if len(choice.Delta.ToolCalls) > 0 {
			for _, deltaToolCall := range choice.Delta.ToolCalls {
				index := *deltaToolCall.Index

				if _, exists := toolCallsMap[index]; !exists {
					toolCallsMap[index] = &openai.ToolCall{
						ID:   deltaToolCall.ID,
						Type: deltaToolCall.Type,
						Function: openai.FunctionCall{
							Name:      deltaToolCall.Function.Name,
							Arguments: deltaToolCall.Function.Arguments,
						},
					}
				} else {
					if deltaToolCall.Function.Arguments != "" {
						toolCallsMap[index].Function.Arguments += deltaToolCall.Function.Arguments
					}
					if deltaToolCall.Function.Name != "" {
						toolCallsMap[index].Function.Name = deltaToolCall.Function.Name
					}
				}
			}
		}

		if choice.Delta.Content != "" {
			accumulatedContent.WriteString(choice.Delta.Content)

			contentResponse := StreamResponse{
				ChatCompletionID: id,
				Object:           "chat.completion.chunk",
				Created:          time.Now().Unix(),
				Model:            model,
				Choices: []StreamChoice{
					{
						Index: 0,
						Delta: Delta{
							Content: choice.Delta.Content,
						},
						FinishReason: nil,
					},
				},
			}
			sendStreamData(w, contentResponse)
		}

		if len(choice.FinishReason) > 0 {
			if choice.FinishReason == "tool_calls" {
				for _, toolCall := range toolCallsMap {
					currentToolCalls = append(currentToolCalls, *toolCall)
				}
				return currentToolCalls, messages, false, accumulatedContent.String()
			} else {
				aiResponseContent := accumulatedContent.String()
				if aiResponseContent != "" {
					accumulatedMessage = openai.ChatCompletionMessage{
						Role:    openai.ChatMessageRoleAssistant,
						Content: aiResponseContent,
					}
					messages = append(messages, accumulatedMessage)
				}
				return nil, messages, true, aiResponseContent
			}
		}
	}

	aiResponseContent := accumulatedContent.String()
	if aiResponseContent != "" {
		accumulatedMessage = openai.ChatCompletionMessage{
			Role:    openai.ChatMessageRoleAssistant,
			Content: aiResponseContent,
		}
		messages = append(messages, accumulatedMessage)
	}

	if len(toolCallsMap) > 0 {
		for _, toolCall := range toolCallsMap {
			currentToolCalls = append(currentToolCalls, *toolCall)
		}
		return currentToolCalls, messages, false, aiResponseContent
	}

	return currentToolCalls, messages, len(currentToolCalls) == 0, aiResponseContent
}

// executeToolCalls
func (c *AIController) executeToolCalls(ctx *gin.Context, _ http.ResponseWriter, _, _ string, toolCalls []openai.ToolCall, messages []openai.ChatCompletionMessage) []openai.ChatCompletionMessage {
	validToolCalls := make([]openai.ToolCall, 0)
	for _, toolCall := range toolCalls {
		if toolCall.ID == "" || toolCall.Function.Name == "" {
			log.Errorf("Invalid tool call: missing required fields. ID: %s, Function: %v", toolCall.ID, toolCall.Function)
			continue
		}

		if toolCall.Function.Arguments == "" {
			toolCall.Function.Arguments = "{}"
		}

		validToolCalls = append(validToolCalls, toolCall)
		log.Debugf("Valid tool call: ID=%s, Name=%s, Arguments=%s", toolCall.ID, toolCall.Function.Name, toolCall.Function.Arguments)
	}

	if len(validToolCalls) == 0 {
		log.Warn("No valid tool calls found")
		return messages
	}

	assistantMsg := openai.ChatCompletionMessage{
		Role:      openai.ChatMessageRoleAssistant,
		ToolCalls: validToolCalls,
	}
	messages = append(messages, assistantMsg)

	for _, toolCall := range validToolCalls {
		if toolCall.Function.Name != "" {
			var args map[string]any
			if err := json.Unmarshal([]byte(toolCall.Function.Arguments), &args); err != nil {
				log.Errorf("Failed to parse tool arguments for %s: %v, arguments: %s", toolCall.Function.Name, err, toolCall.Function.Arguments)
				errorResult := fmt.Sprintf("Error parsing tool arguments: %v", err)
				toolMessage := openai.ChatCompletionMessage{
					Role:       openai.ChatMessageRoleTool,
					Content:    errorResult,
					ToolCallID: toolCall.ID,
				}
				messages = append(messages, toolMessage)
				continue
			}

			result, err := c.callMCPTool(ctx, toolCall.Function.Name, args)
			if err != nil {
				log.Errorf("Failed to call MCP tool %s: %v", toolCall.Function.Name, err)
				result = fmt.Sprintf("Error calling tool %s: %v", toolCall.Function.Name, err)
			}

			toolMessage := openai.ChatCompletionMessage{
				Role:       openai.ChatMessageRoleTool,
				Content:    result,
				ToolCallID: toolCall.ID,
			}
			messages = append(messages, toolMessage)
		}
	}

	return messages
}

// sendErrorResponse send error response in stream
func (c *AIController) sendErrorResponse(w http.ResponseWriter, id, model, errorMsg string) {
	errorResponse := StreamResponse{
		ChatCompletionID: id,
		Object:           "chat.completion.chunk",
		Created:          time.Now().Unix(),
		Model:            model,
		Choices: []StreamChoice{
			{
				Index: 0,
				Delta: Delta{
					Content: fmt.Sprintf("Error: %s", errorMsg),
				},
				FinishReason: nil,
			},
		},
	}
	sendStreamData(w, errorResponse)
}

// getMCPTools
func (c *AIController) getMCPTools() []openai.Tool {
	openaiTools := make([]openai.Tool, 0)
	for _, mcpTool := range mcp_tools.MCPToolsList {
		openaiTool := c.convertMCPToolToOpenAI(mcpTool)
		openaiTools = append(openaiTools, openaiTool)
	}

	return openaiTools
}

// convertMCPToolToOpenAI
func (c *AIController) convertMCPToolToOpenAI(mcpTool mcp.Tool) openai.Tool {
	properties := make(map[string]any)
	required := make([]string, 0)

	maps.Copy(properties, mcpTool.InputSchema.Properties)

	required = append(required, mcpTool.InputSchema.Required...)

	parameters := map[string]any{
		"type":       "object",
		"properties": properties,
	}

	if len(required) > 0 {
		parameters["required"] = required
	}

	return openai.Tool{
		Type: openai.ToolTypeFunction,
		Function: &openai.FunctionDefinition{
			Name:        mcpTool.Name,
			Description: mcpTool.Description,
			Parameters:  parameters,
		},
	}
}

// callMCPTool
func (c *AIController) callMCPTool(ctx context.Context, toolName string, arguments map[string]any) (string, error) {
	request := mcp.CallToolRequest{
		Request: mcp.Request{},
		Params: struct {
			Name      string    `json:"name"`
			Arguments any       `json:"arguments,omitempty"`
			Meta      *mcp.Meta `json:"_meta,omitempty"`
		}{
			Name:      toolName,
			Arguments: arguments,
		},
	}

	var result *mcp.CallToolResult
	var err error

	log.Debugf("Calling MCP tool: %s with arguments: %v", toolName, arguments)

	switch toolName {
	case "get_questions":
		result, err = c.mcpController.MCPQuestionsHandler()(ctx, request)
	case "get_answers_by_question_id":
		result, err = c.mcpController.MCPAnswersHandler()(ctx, request)
	case "get_comments":
		result, err = c.mcpController.MCPCommentsHandler()(ctx, request)
	case "get_tags":
		result, err = c.mcpController.MCPTagsHandler()(ctx, request)
	case "get_tag_detail":
		result, err = c.mcpController.MCPTagDetailsHandler()(ctx, request)
	case "get_user":
		result, err = c.mcpController.MCPUserDetailsHandler()(ctx, request)
	case "semantic_search":
		result, err = c.mcpController.MCPSemanticSearchHandler()(ctx, request)
	default:
		return "", fmt.Errorf("unknown tool: %s", toolName)
	}

	if err != nil {
		return "", err
	}

	data, _ := json.Marshal(result)
	log.Debugf("MCP tool %s called successfully, result: %v", toolName, string(data))

	if result != nil && len(result.Content) > 0 {
		if textContent, ok := result.Content[0].(mcp.TextContent); ok {
			return textContent.Text, nil
		}
	}

	return "No result found", nil
}
