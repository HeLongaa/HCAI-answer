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

package entity

import "time"

type AIProvider struct {
	ID             int       `xorm:"not null pk autoincr INT(11) id"`
	Name           string    `xorm:"not null default '' VARCHAR(255) name"`
	BaseURL        string    `xorm:"not null default '' VARCHAR(500) base_url"`
	APIKey         string    `xorm:"not null TEXT api_key"`
	Enabled        bool      `xorm:"not null default true BOOL enabled"`
	SupportsStream bool      `xorm:"not null default true BOOL supports_stream"`
	Remark         string    `xorm:"not null TEXT remark"`
	CreatedAt      time.Time `xorm:"created not null default CURRENT_TIMESTAMP TIMESTAMP created_at"`
	UpdatedAt      time.Time `xorm:"updated not null default CURRENT_TIMESTAMP TIMESTAMP updated_at"`
}

func (AIProvider) TableName() string { return "ai_providers" }

type AIProviderModel struct {
	ID              int       `xorm:"not null pk autoincr INT(11) id"`
	ProviderID      int       `xorm:"not null index INT(11) provider_id"`
	ProviderModelID string    `xorm:"not null default '' VARCHAR(255) provider_model_id"`
	ModelName       string    `xorm:"not null default '' VARCHAR(255) model_name"`
	Enabled         bool      `xorm:"not null default true BOOL enabled"`
	FetchedAt       time.Time `xorm:"TIMESTAMP fetched_at"`
	CreatedAt       time.Time `xorm:"created not null default CURRENT_TIMESTAMP TIMESTAMP created_at"`
	UpdatedAt       time.Time `xorm:"updated not null default CURRENT_TIMESTAMP TIMESTAMP updated_at"`
}

func (AIProviderModel) TableName() string { return "ai_provider_models" }

type AIModelMapping struct {
	ID                     int       `xorm:"not null pk autoincr INT(11) id"`
	SiteModelID            string    `xorm:"not null unique VARCHAR(100) site_model_id"`
	DisplayName            string    `xorm:"not null default '' VARCHAR(255) display_name"`
	Description            string    `xorm:"not null TEXT description"`
	Enabled                bool      `xorm:"not null default true BOOL enabled"`
	SortOrder              int       `xorm:"not null default 0 INT(11) sort_order"`
	SupportsVision         bool      `xorm:"not null default false BOOL supports_vision"`
	FallbackEnabled        bool      `xorm:"not null default false BOOL fallback_enabled"`
	DefaultProviderModelID string    `xorm:"not null default '' VARCHAR(255) default_provider_model_id"`
	CreatedAt              time.Time `xorm:"created not null default CURRENT_TIMESTAMP TIMESTAMP created_at"`
	UpdatedAt              time.Time `xorm:"updated not null default CURRENT_TIMESTAMP TIMESTAMP updated_at"`
}

func (AIModelMapping) TableName() string { return "ai_model_mappings" }

type AIModelMappingItem struct {
	ID              int       `xorm:"not null pk autoincr INT(11) id"`
	MappingID       int       `xorm:"not null index INT(11) mapping_id"`
	ProviderID      int       `xorm:"not null index INT(11) provider_id"`
	ProviderModelID string    `xorm:"not null default '' VARCHAR(255) provider_model_id"`
	Priority        int       `xorm:"not null default 0 INT(11) priority"`
	Enabled         bool      `xorm:"not null default true BOOL enabled"`
	CreatedAt       time.Time `xorm:"created not null default CURRENT_TIMESTAMP TIMESTAMP created_at"`
	UpdatedAt       time.Time `xorm:"updated not null default CURRENT_TIMESTAMP TIMESTAMP updated_at"`
}

func (AIModelMappingItem) TableName() string { return "ai_model_mapping_items" }

type AISubscriptionPlan struct {
	ID              int       `xorm:"not null pk autoincr INT(11) id"`
	PlanID          string    `xorm:"not null unique VARCHAR(100) plan_id"`
	Name            string    `xorm:"not null default '' VARCHAR(255) name"`
	Enabled         bool      `xorm:"not null default true BOOL enabled"`
	MonthlyPrice    float64   `xorm:"not null default 0 DOUBLE monthly_price"`
	ChatPoints      int       `xorm:"not null default 0 INT(11) chat_points"`
	ImageQuota      int       `xorm:"not null default 0 INT(11) image_quota"`
	VideoDailyQuota int       `xorm:"not null default 0 INT(11) video_daily_quota"`
	VideoQuota      int       `xorm:"not null default 0 INT(11) video_quota"`
	PurchaseURL     string    `xorm:"not null default '' VARCHAR(500) purchase_url"`
	TaskDescription string    `xorm:"not null TEXT task_description"`
	SortOrder       int       `xorm:"not null default 0 INT(11) sort_order"`
	CreatedAt       time.Time `xorm:"created not null default CURRENT_TIMESTAMP TIMESTAMP created_at"`
	UpdatedAt       time.Time `xorm:"updated not null default CURRENT_TIMESTAMP TIMESTAMP updated_at"`
}

func (AISubscriptionPlan) TableName() string { return "ai_subscription_plans" }

type AISubscriptionPlanModel struct {
	ID             int       `xorm:"not null pk autoincr INT(11) id"`
	PlanID         int       `xorm:"not null index INT(11) plan_id"`
	ModelMappingID int       `xorm:"not null index INT(11) model_mapping_id"`
	CreatedAt      time.Time `xorm:"created not null default CURRENT_TIMESTAMP TIMESTAMP created_at"`
}

func (AISubscriptionPlanModel) TableName() string { return "ai_subscription_plan_models" }

type AISubscriptionRedeemCode struct {
	ID             int       `xorm:"not null pk autoincr INT(11) id"`
	Code           string    `xorm:"not null unique VARCHAR(100) code"`
	PlanID         int       `xorm:"not null index INT(11) plan_id"`
	DurationMonths int       `xorm:"not null default 1 INT(11) duration_months"`
	Enabled        bool      `xorm:"not null default true BOOL enabled"`
	Used           bool      `xorm:"not null default false BOOL used"`
	UsedByUserID   string    `xorm:"not null default '' VARCHAR(100) used_by_user_id"`
	UsedAt         time.Time `xorm:"DATETIME used_at"`
	BatchNo        string    `xorm:"not null default '' VARCHAR(100) batch_no"`
	Remark         string    `xorm:"not null TEXT remark"`
	CreatedAt      time.Time `xorm:"created not null default CURRENT_TIMESTAMP TIMESTAMP created_at"`
	UpdatedAt      time.Time `xorm:"updated not null default CURRENT_TIMESTAMP TIMESTAMP updated_at"`
}

func (AISubscriptionRedeemCode) TableName() string { return "ai_subscription_redeem_codes" }

type AIModelConsumeRate struct {
	ID             int       `xorm:"not null pk autoincr INT(11) id"`
	ModelMappingID int       `xorm:"not null index INT(11) model_mapping_id"`
	ConsumeRate    float64   `xorm:"not null default 1 DOUBLE consume_rate"`
	Enabled        bool      `xorm:"not null default true BOOL enabled"`
	Remark         string    `xorm:"not null TEXT remark"`
	CreatedAt      time.Time `xorm:"created not null default CURRENT_TIMESTAMP TIMESTAMP created_at"`
	UpdatedAt      time.Time `xorm:"updated not null default CURRENT_TIMESTAMP TIMESTAMP updated_at"`
}

func (AIModelConsumeRate) TableName() string { return "ai_model_consume_rates" }

type AIChatUsageLog struct {
	ID               int       `xorm:"not null pk autoincr INT(11) id"`
	UserID           string    `xorm:"not null index VARCHAR(100) user_id"`
	ConversationID   string    `xorm:"not null index VARCHAR(255) conversation_id"`
	ChatCompletionID string    `xorm:"not null index VARCHAR(255) chat_completion_id"`
	SiteModelID      string    `xorm:"not null default '' VARCHAR(100) site_model_id"`
	ProviderID       int       `xorm:"not null default 0 INT(11) provider_id"`
	ProviderName     string    `xorm:"not null default '' VARCHAR(255) provider_name"`
	ProviderModelID  string    `xorm:"not null default '' VARCHAR(255) provider_model_id"`
	ConsumePoints    float64   `xorm:"not null default 0 DOUBLE consume_points"`
	Status           string    `xorm:"not null default 'completed' VARCHAR(50) status"`
	CreatedAt        time.Time `xorm:"created not null default CURRENT_TIMESTAMP TIMESTAMP created_at"`
}

func (AIChatUsageLog) TableName() string { return "ai_chat_usage_logs" }

type AIImageProvider struct {
	ID                  int       `xorm:"not null pk autoincr INT(11) id"`
	Name                string    `xorm:"not null default '' VARCHAR(255) name"`
	BaseURL             string    `xorm:"not null default '' VARCHAR(500) base_url"`
	APIKey              string    `xorm:"not null TEXT api_key"`
	APIFormat           string    `xorm:"not null default 'openai' VARCHAR(50) api_format"`
	Flow2APIModelGroups string    `xorm:"not null default '' TEXT flow2api_model_groups"`
	Enabled             bool      `xorm:"not null default true BOOL enabled"`
	Remark              string    `xorm:"not null TEXT remark"`
	CreatedAt           time.Time `xorm:"created not null default CURRENT_TIMESTAMP TIMESTAMP created_at"`
	UpdatedAt           time.Time `xorm:"updated not null default CURRENT_TIMESTAMP TIMESTAMP updated_at"`
}

func (AIImageProvider) TableName() string { return "ai_image_providers" }

type AIImageModel struct {
	ID              int       `xorm:"not null pk autoincr INT(11) id"`
	ProviderID      int       `xorm:"not null index INT(11) provider_id"`
	SiteModelID     string    `xorm:"not null unique VARCHAR(100) site_model_id"`
	ProviderModelID string    `xorm:"not null default '' VARCHAR(255) provider_model_id"`
	DisplayName     string    `xorm:"not null default '' VARCHAR(255) display_name"`
	Description     string    `xorm:"not null TEXT description"`
	DefaultSize     string    `xorm:"not null default '1024x1024' VARCHAR(50) default_size"`
	APIMode         string    `xorm:"not null default 'images' VARCHAR(50) api_mode"`
	SupportsEdits   bool      `xorm:"not null default true BOOL supports_edits"`
	SupportsRefs    bool      `xorm:"not null default true BOOL supports_references"`
	SupportsStream  bool      `xorm:"not null default false BOOL supports_stream"`
	DefaultQuality  string    `xorm:"not null default 'auto' VARCHAR(50) default_quality"`
	DefaultFormat   string    `xorm:"not null default 'png' VARCHAR(50) default_format"`
	ExtraConfig     string    `xorm:"not null TEXT extra_config"`
	Enabled         bool      `xorm:"not null default true BOOL enabled"`
	SortOrder       int       `xorm:"not null default 0 INT(11) sort_order"`
	CreatedAt       time.Time `xorm:"created not null default CURRENT_TIMESTAMP TIMESTAMP created_at"`
	UpdatedAt       time.Time `xorm:"updated not null default CURRENT_TIMESTAMP TIMESTAMP updated_at"`
}

func (AIImageModel) TableName() string { return "ai_image_models" }

type AIImageSetting struct {
	ID            int       `xorm:"not null pk INT(11) id"`
	RetentionDays int       `xorm:"not null default 30 INT(11) retention_days"`
	CreatedAt     time.Time `xorm:"created not null default CURRENT_TIMESTAMP TIMESTAMP created_at"`
	UpdatedAt     time.Time `xorm:"updated not null default CURRENT_TIMESTAMP TIMESTAMP updated_at"`
}

func (AIImageSetting) TableName() string { return "ai_image_settings" }

type AIImageGeneration struct {
	ID               int       `xorm:"not null pk autoincr INT(11) id"`
	GenerationID     string    `xorm:"not null unique VARCHAR(100) generation_id"`
	UserID           string    `xorm:"not null index VARCHAR(100) user_id"`
	SiteModelID      string    `xorm:"not null default '' VARCHAR(100) site_model_id"`
	ProviderID       int       `xorm:"not null default 0 INT(11) provider_id"`
	ProviderName     string    `xorm:"not null default '' VARCHAR(255) provider_name"`
	ProviderModelID  string    `xorm:"not null default '' VARCHAR(255) provider_model_id"`
	Prompt           string    `xorm:"not null TEXT prompt"`
	NegativePrompt   string    `xorm:"not null TEXT negative_prompt"`
	AspectRatio      string    `xorm:"not null default '' VARCHAR(50) aspect_ratio"`
	Size             string    `xorm:"not null default '' VARCHAR(50) size"`
	Style            string    `xorm:"not null default '' VARCHAR(100) style"`
	Quality          string    `xorm:"not null default '' VARCHAR(100) quality"`
	OutputFormat     string    `xorm:"not null default '' VARCHAR(50) output_format"`
	Compression      int       `xorm:"not null default 0 INT(11) compression"`
	Moderation       string    `xorm:"not null default '' VARCHAR(50) moderation"`
	Background       string    `xorm:"not null default '' VARCHAR(50) background"`
	ReferenceImages  string    `xorm:"not null TEXT reference_images"`
	MaskImage        string    `xorm:"not null TEXT mask_image"`
	APIMode          string    `xorm:"not null default '' VARCHAR(50) api_mode"`
	ResponseID       string    `xorm:"not null default '' VARCHAR(255) response_id"`
	ResponseOutput   string    `xorm:"not null TEXT response_output"`
	Count            int       `xorm:"not null default 1 INT(11) count"`
	ImageURLs        string    `xorm:"not null TEXT image_urls"`
	PartialImageURLs string    `xorm:"not null TEXT partial_image_urls"`
	Status           string    `xorm:"not null default 'completed' VARCHAR(50) status"`
	Error            string    `xorm:"not null TEXT error"`
	ExpiresAt        time.Time `xorm:"DATETIME expires_at"`
	CreatedAt        time.Time `xorm:"created not null default CURRENT_TIMESTAMP TIMESTAMP created_at"`
	UpdatedAt        time.Time `xorm:"updated not null default CURRENT_TIMESTAMP TIMESTAMP updated_at"`
}

func (AIImageGeneration) TableName() string { return "ai_image_generations" }

type AIImageAgentConversation struct {
	ID             int       `xorm:"not null pk autoincr INT(11) id"`
	ConversationID string    `xorm:"not null unique(conversation_user) VARCHAR(100) conversation_id"`
	UserID         string    `xorm:"not null unique(conversation_user) index VARCHAR(100) user_id"`
	Title          string    `xorm:"not null default '' VARCHAR(255) title"`
	Payload        string    `xorm:"not null MEDIUMTEXT payload"`
	CreatedAt      time.Time `xorm:"created not null default CURRENT_TIMESTAMP TIMESTAMP created_at"`
	UpdatedAt      time.Time `xorm:"updated not null default CURRENT_TIMESTAMP TIMESTAMP updated_at"`
}

func (AIImageAgentConversation) TableName() string {
	return "ai_image_agent_conversations"
}

type AIVideoProvider struct {
	ID        int       `xorm:"not null pk autoincr INT(11) id"`
	Name      string    `xorm:"not null default '' VARCHAR(255) name"`
	BaseURL   string    `xorm:"not null default '' VARCHAR(500) base_url"`
	APIKey    string    `xorm:"not null TEXT api_key"`
	Enabled   bool      `xorm:"not null default true BOOL enabled"`
	Remark    string    `xorm:"not null TEXT remark"`
	CreatedAt time.Time `xorm:"created not null default CURRENT_TIMESTAMP TIMESTAMP created_at"`
	UpdatedAt time.Time `xorm:"updated not null default CURRENT_TIMESTAMP TIMESTAMP updated_at"`
}

func (AIVideoProvider) TableName() string { return "ai_video_providers" }

type AIVideoModel struct {
	ID                int       `xorm:"not null pk autoincr INT(11) id"`
	ProviderID        int       `xorm:"not null index INT(11) provider_id"`
	SiteModelID       string    `xorm:"not null unique VARCHAR(100) site_model_id"`
	ProviderModelID   string    `xorm:"not null default '' VARCHAR(255) provider_model_id"`
	DisplayName       string    `xorm:"not null default '' VARCHAR(255) display_name"`
	Description       string    `xorm:"not null TEXT description"`
	DefaultSize       string    `xorm:"not null default '1280x720' VARCHAR(50) default_size"`
	DefaultSeconds    int       `xorm:"not null default 6 INT(11) default_seconds"`
	DefaultResolution string    `xorm:"not null default '720p' VARCHAR(50) default_resolution"`
	DefaultPreset     string    `xorm:"not null default 'custom' VARCHAR(50) default_preset"`
	Enabled           bool      `xorm:"not null default true BOOL enabled"`
	SortOrder         int       `xorm:"not null default 0 INT(11) sort_order"`
	CreatedAt         time.Time `xorm:"created not null default CURRENT_TIMESTAMP TIMESTAMP created_at"`
	UpdatedAt         time.Time `xorm:"updated not null default CURRENT_TIMESTAMP TIMESTAMP updated_at"`
}

func (AIVideoModel) TableName() string { return "ai_video_models" }

type AIVideoSetting struct {
	ID            int       `xorm:"not null pk INT(11) id"`
	RetentionDays int       `xorm:"not null default 30 INT(11) retention_days"`
	CreatedAt     time.Time `xorm:"created not null default CURRENT_TIMESTAMP TIMESTAMP created_at"`
	UpdatedAt     time.Time `xorm:"updated not null default CURRENT_TIMESTAMP TIMESTAMP updated_at"`
}

func (AIVideoSetting) TableName() string { return "ai_video_settings" }

const (
	AIVideoStatusQueued     = "queued"
	AIVideoStatusInProgress = "in_progress"
	AIVideoStatusCompleted  = "completed"
	AIVideoStatusFailed     = "failed"
)

type AIVideoGeneration struct {
	ID              int       `xorm:"not null pk autoincr INT(11) id"`
	GenerationID    string    `xorm:"not null unique VARCHAR(100) generation_id"`
	UpstreamID      string    `xorm:"not null default '' VARCHAR(100) upstream_id"`
	UserID          string    `xorm:"not null index VARCHAR(100) user_id"`
	SiteModelID     string    `xorm:"not null default '' VARCHAR(100) site_model_id"`
	ProviderID      int       `xorm:"not null default 0 INT(11) provider_id"`
	ProviderName    string    `xorm:"not null default '' VARCHAR(255) provider_name"`
	ProviderModelID string    `xorm:"not null default '' VARCHAR(255) provider_model_id"`
	Prompt          string    `xorm:"not null TEXT prompt"`
	AspectRatio     string    `xorm:"not null default '' VARCHAR(50) aspect_ratio"`
	Size            string    `xorm:"not null default '' VARCHAR(50) size"`
	Quality         string    `xorm:"not null default '' VARCHAR(100) quality"`
	Seconds         int       `xorm:"not null default 6 INT(11) seconds"`
	Preset          string    `xorm:"not null default '' VARCHAR(100) preset"`
	ReferenceImages string    `xorm:"not null TEXT reference_images"`
	VideoURL        string    `xorm:"not null TEXT video_url"`
	Status          string    `xorm:"not null default 'queued' VARCHAR(50) status"`
	Progress        int       `xorm:"not null default 0 INT(11) progress"`
	Error           string    `xorm:"not null TEXT error"`
	ExpiresAt       time.Time `xorm:"DATETIME expires_at"`
	CreatedAt       time.Time `xorm:"created not null default CURRENT_TIMESTAMP TIMESTAMP created_at"`
	UpdatedAt       time.Time `xorm:"updated not null default CURRENT_TIMESTAMP TIMESTAMP updated_at"`
}

func (AIVideoGeneration) TableName() string { return "ai_video_generations" }
