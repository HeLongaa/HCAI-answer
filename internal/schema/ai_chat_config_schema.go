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

package schema

type AIProviderReq struct {
	Name           string `json:"name" validate:"required"`
	BaseURL        string `json:"base_url" validate:"required"`
	APIKey         string `json:"api_key"`
	Enabled        bool   `json:"enabled"`
	SupportsStream bool   `json:"supports_stream"`
	Remark         string `json:"remark"`
}

type AIProviderResp struct {
	ID             int                    `json:"id"`
	Name           string                 `json:"name"`
	BaseURL        string                 `json:"base_url"`
	APIKey         string                 `json:"api_key"`
	Enabled        bool                   `json:"enabled"`
	SupportsStream bool                   `json:"supports_stream"`
	Remark         string                 `json:"remark"`
	Models         []*AIProviderModelResp `json:"models"`
	CreatedAt      int64                  `json:"created_at"`
	UpdatedAt      int64                  `json:"updated_at"`
}

type AIProviderModelResp struct {
	ID              int    `json:"id"`
	ProviderID      int    `json:"provider_id"`
	ProviderModelID string `json:"provider_model_id"`
	ModelName       string `json:"model_name"`
	Enabled         bool   `json:"enabled"`
	FetchedAt       int64  `json:"fetched_at"`
	CreatedAt       int64  `json:"created_at"`
	UpdatedAt       int64  `json:"updated_at"`
}

type AITestProviderModelReq struct {
	ProviderModelID string `json:"provider_model_id" validate:"required"`
}

type AITestProviderModelResp struct {
	ProviderID      int    `json:"provider_id"`
	ProviderModelID string `json:"provider_model_id"`
	Message         string `json:"message"`
	RawResponse     string `json:"raw_response"`
}

type AIModelMappingItemReq struct {
	ID              int    `json:"id"`
	ProviderID      int    `json:"provider_id"`
	ProviderModelID string `json:"provider_model_id"`
	Priority        int    `json:"priority"`
	Enabled         bool   `json:"enabled"`
}

type AIModelMappingReq struct {
	SiteModelID            string                   `json:"site_model_id" validate:"required"`
	DisplayName            string                   `json:"display_name"`
	Description            string                   `json:"description"`
	Enabled                bool                     `json:"enabled"`
	SortOrder              int                      `json:"sort_order"`
	SupportsVision         bool                     `json:"supports_vision"`
	FallbackEnabled        bool                     `json:"fallback_enabled"`
	DefaultProviderModelID string                   `json:"default_provider_model_id"`
	Items                  []*AIModelMappingItemReq `json:"items"`
}

type AIModelMappingResp struct {
	ID                     int                       `json:"id"`
	SiteModelID            string                    `json:"site_model_id"`
	DisplayName            string                    `json:"display_name"`
	Description            string                    `json:"description"`
	Enabled                bool                      `json:"enabled"`
	SortOrder              int                       `json:"sort_order"`
	SupportsVision         bool                      `json:"supports_vision"`
	FallbackEnabled        bool                      `json:"fallback_enabled"`
	DefaultProviderModelID string                    `json:"default_provider_model_id"`
	Items                  []*AIModelMappingItemResp `json:"items"`
	CreatedAt              int64                     `json:"created_at"`
	UpdatedAt              int64                     `json:"updated_at"`
}

type AIModelMappingItemResp struct {
	ID              int    `json:"id"`
	MappingID       int    `json:"mapping_id"`
	ProviderID      int    `json:"provider_id"`
	ProviderName    string `json:"provider_name"`
	ProviderModelID string `json:"provider_model_id"`
	Priority        int    `json:"priority"`
	Enabled         bool   `json:"enabled"`
	CreatedAt       int64  `json:"created_at"`
	UpdatedAt       int64  `json:"updated_at"`
}

type AISubscriptionPlanReq struct {
	PlanID          string  `json:"plan_id" validate:"required"`
	Name            string  `json:"name" validate:"required"`
	Enabled         bool    `json:"enabled"`
	MonthlyPrice    float64 `json:"monthly_price"`
	ChatPoints      int     `json:"chat_points"`
	ImageQuota      int     `json:"image_quota"`
	VideoDailyQuota int     `json:"video_daily_quota"`
	VideoQuota      int     `json:"video_quota"`
	PurchaseURL     string  `json:"purchase_url"`
	ModelMappingIDs []int   `json:"model_mapping_ids"`
	TaskDescription string  `json:"task_description"`
	SortOrder       int     `json:"sort_order"`
}

type AISubscriptionPlanResp struct {
	ID                int      `json:"id"`
	PlanID            string   `json:"plan_id"`
	Name              string   `json:"name"`
	Enabled           bool     `json:"enabled"`
	MonthlyPrice      float64  `json:"monthly_price"`
	ChatPoints        int      `json:"chat_points"`
	ImageQuota        int      `json:"image_quota"`
	VideoDailyQuota   int      `json:"video_daily_quota"`
	VideoQuota        int      `json:"video_quota"`
	PurchaseURL       string   `json:"purchase_url"`
	ModelMappingIDs   []int    `json:"model_mapping_ids"`
	AvailableModelIDs []string `json:"available_model_ids"`
	TaskDescription   string   `json:"task_description"`
	SortOrder         int      `json:"sort_order"`
	CreatedAt         int64    `json:"created_at"`
	UpdatedAt         int64    `json:"updated_at"`
}

type AISubscriptionRedeemCodeGenerateReq struct {
	PlanID         int    `json:"plan_id" validate:"required"`
	Count          int    `json:"count"`
	DurationMonths int    `json:"duration_months"`
	Prefix         string `json:"prefix"`
	Remark         string `json:"remark"`
}

type AISubscriptionRedeemCodeResp struct {
	ID             int    `json:"id"`
	Code           string `json:"code"`
	PlanID         int    `json:"plan_id"`
	PlanKey        string `json:"plan_key"`
	PlanName       string `json:"plan_name"`
	DurationMonths int    `json:"duration_months"`
	Enabled        bool   `json:"enabled"`
	Used           bool   `json:"used"`
	UsedByUserID   string `json:"used_by_user_id"`
	UsedAt         int64  `json:"used_at"`
	BatchNo        string `json:"batch_no"`
	Remark         string `json:"remark"`
	CreatedAt      int64  `json:"created_at"`
	UpdatedAt      int64  `json:"updated_at"`
}

type AISubscriptionRedeemReq struct {
	Code string `json:"code" validate:"required"`
}

type AISubscriptionRedeemResp struct {
	PlanID    string `json:"plan_id"`
	PlanName  string `json:"plan_name"`
	StartedAt int64  `json:"started_at"`
	ExpiresAt int64  `json:"expires_at"`
}

type AIModelConsumeRateReq struct {
	ModelMappingID int     `json:"model_mapping_id"`
	ConsumeRate    float64 `json:"consume_rate"`
	Enabled        bool    `json:"enabled"`
	Remark         string  `json:"remark"`
}

type AIModelConsumeRateResp struct {
	ID             int     `json:"id"`
	ModelMappingID int     `json:"model_mapping_id"`
	SiteModelID    string  `json:"site_model_id"`
	ConsumeRate    float64 `json:"consume_rate"`
	Enabled        bool    `json:"enabled"`
	Remark         string  `json:"remark"`
	CreatedAt      int64   `json:"created_at"`
	UpdatedAt      int64   `json:"updated_at"`
}

type AISubscriptionOverviewResp struct {
	PlanID              string                     `json:"plan_id"`
	PlanName            string                     `json:"plan_name"`
	ChatPoints          int                        `json:"chat_points"`
	ChatPointsUsed      int                        `json:"chat_points_used"`
	ChatPointsRemaining int                        `json:"chat_points_remaining"`
	ImageQuota          int                        `json:"image_quota"`
	ImageQuotaUsed      int                        `json:"image_quota_used"`
	ImageQuotaRemaining int                        `json:"image_quota_remaining"`
	VideoDailyQuota     int                        `json:"video_daily_quota"`
	VideoDailyUsed      int                        `json:"video_daily_used"`
	VideoDailyRemaining int                        `json:"video_daily_remaining"`
	VideoQuota          int                        `json:"video_quota"`
	VideoQuotaUsed      int                        `json:"video_quota_used"`
	VideoQuotaRemaining int                        `json:"video_quota_remaining"`
	AvailableModels     []string                   `json:"available_models"`
	ConsumeRates        []*AISubscriptionModelRate `json:"consume_rates"`
	PeriodStart         int64                      `json:"period_start"`
	PeriodEnd           int64                      `json:"period_end"`
	ExpiresAt           int64                      `json:"expires_at"`
}

type AISubscriptionModelRate struct {
	SiteModelID string  `json:"site_model_id"`
	ConsumeRate float64 `json:"consume_rate"`
}

type AIChatModelResp struct {
	SiteModelID    string  `json:"site_model_id"`
	DisplayName    string  `json:"display_name"`
	Description    string  `json:"description"`
	ConsumeRate    float64 `json:"consume_rate"`
	Enabled        bool    `json:"enabled"`
	SupportsVision bool    `json:"supports_vision"`
}

type AIChatUsageLogReq struct {
	UserID           string  `json:"user_id"`
	ConversationID   string  `json:"conversation_id"`
	ChatCompletionID string  `json:"chat_completion_id"`
	SiteModelID      string  `json:"site_model_id"`
	ProviderID       int     `json:"provider_id"`
	ProviderName     string  `json:"provider_name"`
	ProviderModelID  string  `json:"provider_model_id"`
	ConsumePoints    float64 `json:"consume_points"`
}

type AIAgentResponsesReq struct {
	ImageModel        string `json:"model" validate:"required"`
	Instructions      string `json:"instructions"`
	Input             any    `json:"input" validate:"required"`
	Tools             any    `json:"tools"`
	ToolChoice        any    `json:"tool_choice"`
	Stream            bool   `json:"stream"`
	MaxOutputTokens   int    `json:"max_output_tokens"`
	ReasoningEffort   string `json:"reasoning_effort"`
	ConversationID    string `json:"conversation_id"`
	ChatCompletionID  string `json:"chat_completion_id"`
	DisableUsageLog   bool   `json:"disable_usage_log"`
	DisablePointCheck bool   `json:"disable_point_check"`
}

type AIImageAgentUpstreamResp struct {
	ImageModelID    string
	ProviderID      int
	ProviderName    string
	ProviderModelID string
	BaseURL         string
	APIKey          string
	SupportsStream  bool
}

type AIImageProviderReq struct {
	Name    string `json:"name" validate:"required"`
	BaseURL string `json:"base_url" validate:"required"`
	APIKey  string `json:"api_key"`
	Enabled bool   `json:"enabled"`
	Remark  string `json:"remark"`
}

type AIImageProviderResp struct {
	ID        int    `json:"id"`
	Name      string `json:"name"`
	BaseURL   string `json:"base_url"`
	APIKey    string `json:"api_key"`
	Enabled   bool   `json:"enabled"`
	Remark    string `json:"remark"`
	CreatedAt int64  `json:"created_at"`
	UpdatedAt int64  `json:"updated_at"`
}

type AIImageModelUpstreamReq struct {
	ProviderID       int    `json:"provider_id"`
	ProviderModelID  string `json:"provider_model_id"`
	AgentModelID     string `json:"agent_model_id"`
	ResponsesModelID string `json:"responses_model_id"`
	Weight           int    `json:"weight"`
	Enabled          bool   `json:"enabled"`
}

type AIImageModelUpstreamResp struct {
	ProviderID       int    `json:"provider_id"`
	ProviderName     string `json:"provider_name"`
	ProviderModelID  string `json:"provider_model_id"`
	AgentModelID     string `json:"agent_model_id"`
	ResponsesModelID string `json:"responses_model_id"`
	Weight           int    `json:"weight"`
	Enabled          bool   `json:"enabled"`
}

type AIImageModelReq struct {
	ProviderID      int                       `json:"provider_id"`
	SiteModelID     string                    `json:"site_model_id" validate:"required"`
	ProviderModelID string                    `json:"provider_model_id" validate:"required"`
	AgentModelID    string                    `json:"agent_model_id"`
	DisplayName     string                    `json:"display_name"`
	Description     string                    `json:"description"`
	DefaultSize     string                    `json:"default_size"`
	APIMode         string                    `json:"api_mode"`
	SupportsEdits   bool                      `json:"supports_edits"`
	SupportsRefs    bool                      `json:"supports_references"`
	SupportsStream  bool                      `json:"supports_stream"`
	DefaultQuality  string                    `json:"default_quality"`
	DefaultFormat   string                    `json:"default_format"`
	ExtraConfig     string                    `json:"extra_config"`
	Enabled         bool                      `json:"enabled"`
	SortOrder       int                       `json:"sort_order"`
	Upstreams       []AIImageModelUpstreamReq `json:"upstreams"`
}

type AIImageModelResp struct {
	ID              int                        `json:"id"`
	ProviderID      int                        `json:"provider_id"`
	ProviderName    string                     `json:"provider_name"`
	SiteModelID     string                     `json:"site_model_id"`
	ProviderModelID string                     `json:"provider_model_id"`
	AgentModelID    string                     `json:"agent_model_id"`
	DisplayName     string                     `json:"display_name"`
	Description     string                     `json:"description"`
	DefaultSize     string                     `json:"default_size"`
	APIMode         string                     `json:"api_mode"`
	SupportsEdits   bool                       `json:"supports_edits"`
	SupportsRefs    bool                       `json:"supports_references"`
	SupportsStream  bool                       `json:"supports_stream"`
	DefaultQuality  string                     `json:"default_quality"`
	DefaultFormat   string                     `json:"default_format"`
	ExtraConfig     string                     `json:"extra_config"`
	Enabled         bool                       `json:"enabled"`
	SortOrder       int                        `json:"sort_order"`
	CreatedAt       int64                      `json:"created_at"`
	UpdatedAt       int64                      `json:"updated_at"`
	Upstreams       []AIImageModelUpstreamResp `json:"upstreams"`
}

type AIImageSettingReq struct {
	RetentionDays int `json:"retention_days"`
}

type AIImageSettingResp struct {
	RetentionDays int   `json:"retention_days"`
	CreatedAt     int64 `json:"created_at"`
	UpdatedAt     int64 `json:"updated_at"`
}

type AIImageGenerateReq struct {
	Prompt          string   `json:"prompt" validate:"required"`
	NegativePrompt  string   `json:"negative_prompt"`
	Model           string   `json:"model" validate:"required"`
	AspectRatio     string   `json:"aspect_ratio"`
	Size            string   `json:"size"`
	Style           string   `json:"style"`
	Quality         string   `json:"quality"`
	OutputFormat    string   `json:"output_format"`
	Compression     int      `json:"output_compression"`
	Moderation      string   `json:"moderation"`
	Background      string   `json:"background"`
	MaskImage       string   `json:"mask_image"`
	Count           int      `json:"count"`
	ReferenceImages []string `json:"reference_images"`
	Stream          bool     `json:"stream"`
	PartialImages   int      `json:"partial_images"`
}

type AIImageAgentGenerationSaveReq struct {
	Prompt          string   `json:"prompt" validate:"required"`
	NegativePrompt  string   `json:"negative_prompt"`
	Model           string   `json:"model" validate:"required"`
	AspectRatio     string   `json:"aspect_ratio"`
	Size            string   `json:"size"`
	Style           string   `json:"style"`
	Quality         string   `json:"quality"`
	OutputFormat    string   `json:"output_format"`
	Compression     int      `json:"output_compression"`
	Moderation      string   `json:"moderation"`
	Background      string   `json:"background"`
	MaskImage       string   `json:"mask_image"`
	ReferenceImages []string `json:"reference_images"`
	Images          []string `json:"images" validate:"required"`
	ResponseID      string   `json:"response_id"`
	ResponseOutput  string   `json:"response_output"`
}

type AIImageEditReq struct {
	Prompt   string `json:"prompt" validate:"required"`
	ImageURL string `json:"image_url" validate:"required"`
	Model    string `json:"model" validate:"required"`
	Size     string `json:"size"`
	Quality  string `json:"quality"`
}

type AIImageGenerationDeleteReq struct {
	GenerationID string `json:"generation_id" validate:"required"`
}

type AIImageGenerationResp struct {
	ID              int      `json:"id"`
	GenerationID    string   `json:"generation_id"`
	UserID          string   `json:"user_id"`
	SiteModelID     string   `json:"site_model_id"`
	ProviderID      int      `json:"provider_id"`
	ProviderName    string   `json:"provider_name"`
	ProviderModelID string   `json:"provider_model_id"`
	Prompt          string   `json:"prompt"`
	NegativePrompt  string   `json:"negative_prompt"`
	AspectRatio     string   `json:"aspect_ratio"`
	Size            string   `json:"size"`
	Style           string   `json:"style"`
	Quality         string   `json:"quality"`
	OutputFormat    string   `json:"output_format"`
	Compression     int      `json:"output_compression"`
	Moderation      string   `json:"moderation"`
	Background      string   `json:"background"`
	ReferenceImages []string `json:"reference_images"`
	MaskImage       string   `json:"mask_image"`
	APIMode         string   `json:"api_mode"`
	ResponseID      string   `json:"response_id"`
	ResponseOutput  string   `json:"response_output"`
	Count           int      `json:"count"`
	ImageURLs       []string `json:"image_urls"`
	Status          string   `json:"status"`
	Error           string   `json:"error"`
	ExpiresAt       int64    `json:"expires_at"`
	CreatedAt       int64    `json:"created_at"`
	UpdatedAt       int64    `json:"updated_at"`
}

type AIImageAgentConversationResp struct {
	ID             int    `json:"id"`
	ConversationID string `json:"conversation_id"`
	Title          string `json:"title"`
	Payload        string `json:"payload"`
	CreatedAt      int64  `json:"created_at"`
	UpdatedAt      int64  `json:"updated_at"`
}

type AIImageAgentConversationSaveReq struct {
	ConversationID string `json:"conversation_id" validate:"required"`
	Title          string `json:"title"`
	Payload        string `json:"payload" validate:"required"`
}

type AIImageAgentConversationDeleteReq struct {
	ConversationID string `json:"conversation_id" validate:"required"`
}

type AIImageGenerateResp struct {
	GenerationID string   `json:"generation_id"`
	Size         string   `json:"size"`
	ImageURLs    []string `json:"image_urls"`
	ExpiresAt    int64    `json:"expires_at"`
}

type AIVideoProviderReq struct {
	Name    string `json:"name" validate:"required"`
	BaseURL string `json:"base_url" validate:"required"`
	APIKey  string `json:"api_key"`
	Enabled bool   `json:"enabled"`
	Remark  string `json:"remark"`
}

type AIVideoProviderResp struct {
	ID        int    `json:"id"`
	Name      string `json:"name"`
	BaseURL   string `json:"base_url"`
	APIKey    string `json:"api_key"`
	Enabled   bool   `json:"enabled"`
	Remark    string `json:"remark"`
	CreatedAt int64  `json:"created_at"`
	UpdatedAt int64  `json:"updated_at"`
}

type AIVideoModelReq struct {
	ProviderID        int    `json:"provider_id"`
	SiteModelID       string `json:"site_model_id" validate:"required"`
	ProviderModelID   string `json:"provider_model_id" validate:"required"`
	DisplayName       string `json:"display_name"`
	Description       string `json:"description"`
	DefaultSize       string `json:"default_size"`
	DefaultSeconds    int    `json:"default_seconds"`
	DefaultResolution string `json:"default_resolution"`
	DefaultPreset     string `json:"default_preset"`
	Enabled           bool   `json:"enabled"`
	SortOrder         int    `json:"sort_order"`
}

type AIVideoModelResp struct {
	ID                int    `json:"id"`
	ProviderID        int    `json:"provider_id"`
	ProviderName      string `json:"provider_name"`
	SiteModelID       string `json:"site_model_id"`
	ProviderModelID   string `json:"provider_model_id"`
	DisplayName       string `json:"display_name"`
	Description       string `json:"description"`
	DefaultSize       string `json:"default_size"`
	DefaultSeconds    int    `json:"default_seconds"`
	DefaultResolution string `json:"default_resolution"`
	DefaultPreset     string `json:"default_preset"`
	Enabled           bool   `json:"enabled"`
	SortOrder         int    `json:"sort_order"`
	CreatedAt         int64  `json:"created_at"`
	UpdatedAt         int64  `json:"updated_at"`
}

type AIVideoSettingReq struct {
	RetentionDays int `json:"retention_days"`
}

type AIVideoSettingResp struct {
	RetentionDays int   `json:"retention_days"`
	CreatedAt     int64 `json:"created_at"`
	UpdatedAt     int64 `json:"updated_at"`
}

type AIVideoGenerateReq struct {
	Prompt          string   `json:"prompt" validate:"required"`
	Model           string   `json:"model" validate:"required"`
	Size            string   `json:"size"`
	Quality         string   `json:"quality"`
	Seconds         int      `json:"seconds"`
	Preset          string   `json:"preset"`
	ReferenceImages []string `json:"reference_images"`
}

type AIVideoGenerationResp struct {
	ID              int      `json:"id"`
	GenerationID    string   `json:"generation_id"`
	UpstreamID      string   `json:"upstream_id"`
	UserID          string   `json:"user_id"`
	SiteModelID     string   `json:"site_model_id"`
	ProviderID      int      `json:"provider_id"`
	ProviderName    string   `json:"provider_name"`
	ProviderModelID string   `json:"provider_model_id"`
	Prompt          string   `json:"prompt"`
	AspectRatio     string   `json:"aspect_ratio"`
	Size            string   `json:"size"`
	Quality         string   `json:"quality"`
	Seconds         int      `json:"seconds"`
	Preset          string   `json:"preset"`
	ReferenceImages []string `json:"reference_images"`
	VideoURL        string   `json:"video_url"`
	Status          string   `json:"status"`
	Progress        int      `json:"progress"`
	Error           string   `json:"error"`
	ExpiresAt       int64    `json:"expires_at"`
	CreatedAt       int64    `json:"created_at"`
	UpdatedAt       int64    `json:"updated_at"`
}

type AIVideoGenerateResp struct {
	GenerationID string `json:"generation_id"`
	Status       string `json:"status"`
	Progress     int    `json:"progress"`
	Size         string `json:"size"`
	Seconds      int    `json:"seconds"`
	ExpiresAt    int64  `json:"expires_at"`
}

type AISubscriptionPurchaseResp struct {
	CurrentPlanID string                     `json:"current_plan_id"`
	Plans         []*AISubscriptionPlanResp  `json:"plans"`
	ConsumeRates  []*AISubscriptionModelRate `json:"consume_rates"`
}

type AIUpstreamModelResp struct {
	ProviderID      int    `json:"provider_id"`
	ProviderName    string `json:"provider_name"`
	ProviderModelID string `json:"provider_model_id"`
	BaseURL         string `json:"base_url"`
	APIKey          string `json:"-"`
	SupportsVision  bool   `json:"supports_vision"`
	SupportsStream  bool   `json:"supports_stream"`
}
