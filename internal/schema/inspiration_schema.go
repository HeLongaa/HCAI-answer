package schema

type InspirationListReq struct {
	Page     int    `form:"page"`
	PageSize int    `form:"page_size"`
	Query    string `form:"q"`
	Type     string `form:"type"`
	Category string `form:"category"`
	Tag      string `form:"tag"`
	Status   string `form:"status"`
	Sort     string `form:"sort"`
	Mine     bool   `form:"mine"`
	Featured bool   `form:"featured"`
	UserID   string `json:"-"`
	IsAdmin  bool   `json:"-"`
	IsManage bool   `json:"-"`
}

type InspirationCreateReq struct {
	Title       string   `validate:"required,min=2,max=180" json:"title"`
	Summary     string   `json:"summary"`
	Content     string   `validate:"required,min=2" json:"content"`
	Type        string   `json:"type"`
	Category    string   `json:"category"`
	Tags        []string `json:"tags"`
	CoverURL    string   `json:"cover_url"`
	Prompt      string   `json:"prompt"`
	Model       string   `json:"model"`
	Attachments []string `json:"attachments"`
	Links       []string `json:"links"`
	IsPublic    bool     `json:"is_public"`
	UserID      string   `json:"-"`
}

type InspirationUpdateReq struct {
	ID          int      `validate:"required" json:"id"`
	Title       string   `validate:"required,min=2,max=180" json:"title"`
	Summary     string   `json:"summary"`
	Content     string   `validate:"required,min=2" json:"content"`
	Type        string   `json:"type"`
	Category    string   `json:"category"`
	Tags        []string `json:"tags"`
	CoverURL    string   `json:"cover_url"`
	Prompt      string   `json:"prompt"`
	Model       string   `json:"model"`
	Attachments []string `json:"attachments"`
	Links       []string `json:"links"`
	IsPublic    bool     `json:"is_public"`
	UserID      string   `json:"-"`
	IsAdmin     bool     `json:"-"`
}

type InspirationAdminActionReq struct {
	ID                 int    `validate:"required" json:"id"`
	Status             string `json:"status"`
	ReviewComment      string `json:"review_comment"`
	Featured           bool   `json:"featured"`
	FeaturedWeight     int    `json:"featured_weight"`
	RevokeReward       bool   `json:"revoke_reward"`
	BanAuthor          bool   `json:"ban_author"`
	OperatorID         string `json:"-"`
	OperatorIsAdminMod bool   `json:"-"`
}

type InspirationReportReq struct {
	ID      int    `validate:"required" json:"id"`
	Reason  string `validate:"required" json:"reason"`
	Content string `json:"content"`
	UserID  string `json:"-"`
}

type InspirationCommentCreateReq struct {
	ID      int    `validate:"required" json:"id"`
	Content string `validate:"required,min=1" json:"content"`
	UserID  string `json:"-"`
}

type InspirationCommentListReq struct {
	ID       int    `validate:"required" form:"id"`
	Page     int    `form:"page"`
	PageSize int    `form:"page_size"`
	UserID   string `json:"-"`
	IsAdmin  bool   `json:"-"`
}

type InspirationSettingReq struct {
	RequireReview             bool     `json:"require_review"`
	PublishRewardEnabled      bool     `json:"publish_reward_enabled"`
	PublishRewardPoints       int      `validate:"min=0" json:"publish_reward_points"`
	RewardAfterReview         bool     `json:"reward_after_review"`
	RevokeRewardOnDelete      bool     `json:"revoke_reward_on_delete"`
	FeaturedDefaultWeight     int      `json:"featured_default_weight"`
	RecommendationHotWeight   int      `json:"recommendation_hot_weight"`
	RecommendationFreshWeight int      `json:"recommendation_fresh_weight"`
	Categories                []string `json:"categories"`
}

type InspirationResp struct {
	ID              int                         `json:"id"`
	CreatedAt       int64                       `json:"created_at"`
	UpdatedAt       int64                       `json:"updated_at"`
	PublishedAt     int64                       `json:"published_at"`
	UserID          string                      `json:"user_id"`
	Username        string                      `json:"username"`
	UserDisplayName string                      `json:"user_display_name"`
	UserAvatar      string                      `json:"user_avatar"`
	ReviewerID      string                      `json:"reviewer_id"`
	ReviewerName    string                      `json:"reviewer_name"`
	Title           string                      `json:"title"`
	Summary         string                      `json:"summary"`
	Content         string                      `json:"content"`
	ContentHTML     string                      `json:"content_html"`
	Type            string                      `json:"type"`
	Category        string                      `json:"category"`
	Tags            []string                    `json:"tags"`
	CoverURL        string                      `json:"cover_url"`
	Prompt          string                      `json:"prompt"`
	Model           string                      `json:"model"`
	Attachments     []string                    `json:"attachments"`
	Links           []string                    `json:"links"`
	IsPublic        bool                        `json:"is_public"`
	IsFeatured      bool                        `json:"is_featured"`
	FeaturedWeight  int                         `json:"featured_weight"`
	Status          string                      `json:"status"`
	ReviewComment   string                      `json:"review_comment"`
	ReportReason    string                      `json:"report_reason"`
	ReportContent   string                      `json:"report_content"`
	ViewCount       int                         `json:"view_count"`
	LikeCount       int                         `json:"like_count"`
	FavoriteCount   int                         `json:"favorite_count"`
	CommentCount    int                         `json:"comment_count"`
	ShareCount      int                         `json:"share_count"`
	HotScore        int                         `json:"hot_score"`
	RewardGranted   bool                        `json:"reward_granted"`
	RewardRevoked   bool                        `json:"reward_revoked"`
	RewardLogs      []*InspirationRewardLogResp `json:"reward_logs,omitempty"`
	Liked           bool                        `json:"liked"`
	Favorited       bool                        `json:"favorited"`
	CanEdit         bool                        `json:"can_edit"`
	CanManage       bool                        `json:"can_manage"`
	Related         []*InspirationResp          `json:"related,omitempty"`
}

type InspirationRewardLogResp struct {
	ID          int    `json:"id"`
	CreatedAt   int64  `json:"created_at"`
	SourceType  string `json:"source_type"`
	Delta       int    `json:"delta"`
	Balance     int    `json:"balance"`
	Description string `json:"description"`
	OperatorID  string `json:"operator_id"`
}

type InspirationCommentResp struct {
	ID            int    `json:"id"`
	CreatedAt     int64  `json:"created_at"`
	UpdatedAt     int64  `json:"updated_at"`
	InspirationID int    `json:"inspiration_id"`
	UserID        string `json:"user_id"`
	Username      string `json:"username"`
	DisplayName   string `json:"display_name"`
	Avatar        string `json:"avatar"`
	Content       string `json:"content"`
	Status        string `json:"status"`
}

type InspirationSettingResp struct {
	RequireReview             bool     `json:"require_review"`
	PublishRewardEnabled      bool     `json:"publish_reward_enabled"`
	PublishRewardPoints       int      `json:"publish_reward_points"`
	RewardAfterReview         bool     `json:"reward_after_review"`
	RevokeRewardOnDelete      bool     `json:"revoke_reward_on_delete"`
	FeaturedDefaultWeight     int      `json:"featured_default_weight"`
	RecommendationHotWeight   int      `json:"recommendation_hot_weight"`
	RecommendationFreshWeight int      `json:"recommendation_fresh_weight"`
	Categories                []string `json:"categories"`
}

type InspirationAuthorRankResp struct {
	UserID      string `json:"user_id"`
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
	Avatar      string `json:"avatar"`
	Count       int    `json:"count"`
	HotScore    int    `json:"hot_score"`
}

type InspirationTaxonomyResp struct {
	Categories []*InspirationTaxonomyItem `json:"categories"`
	Tags       []*InspirationTaxonomyItem `json:"tags"`
	Types      []*InspirationTaxonomyItem `json:"types"`
}

type InspirationTaxonomyItem struct {
	Name  string `json:"name"`
	Count int    `json:"count"`
}
