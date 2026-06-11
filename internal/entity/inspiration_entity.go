package entity

import "time"

const (
	InspirationStatusPublished     = "published"
	InspirationStatusPendingReview = "pending_review"
	InspirationStatusRejected      = "rejected"
	InspirationStatusHidden        = "hidden"
	InspirationStatusDeleted       = "deleted"
	InspirationStatusReported      = "reported"

	InspirationReportStatusPending  = "pending"
	InspirationReportStatusResolved = "resolved"
	InspirationReportStatusIgnored  = "ignored"

	PointSourceInspirationPublish       = "inspiration_publish_reward"
	PointSourceInspirationPublishRevoke = "inspiration_publish_revoke"
)

type Inspiration struct {
	ID             int       `xorm:"not null pk autoincr INT(11) id"`
	CreatedAt      time.Time `xorm:"created not null default CURRENT_TIMESTAMP TIMESTAMP created_at"`
	UpdatedAt      time.Time `xorm:"updated TIMESTAMP updated_at"`
	PublishedAt    time.Time `xorm:"TIMESTAMP INDEX published_at"`
	UserID         string    `xorm:"not null default 0 BIGINT(20) INDEX user_id"`
	ReviewerID     string    `xorm:"not null default 0 BIGINT(20) reviewer_id"`
	Title          string    `xorm:"not null default '' VARCHAR(180) title"`
	Summary        string    `xorm:"TEXT summary"`
	Content        string    `xorm:"not null MEDIUMTEXT content"`
	ContentHTML    string    `xorm:"MEDIUMTEXT content_html"`
	Type           string    `xorm:"not null default '' VARCHAR(64) INDEX type"`
	Category       string    `xorm:"not null default '' VARCHAR(80) INDEX category"`
	Tags           string    `xorm:"TEXT tags"`
	CoverURL       string    `xorm:"TEXT cover_url"`
	Prompt         string    `xorm:"MEDIUMTEXT prompt"`
	Model          string    `xorm:"not null default '' VARCHAR(120) model"`
	Attachments    string    `xorm:"MEDIUMTEXT attachments"`
	Links          string    `xorm:"MEDIUMTEXT links"`
	IsPublic       bool      `xorm:"not null default true BOOL INDEX is_public"`
	IsFeatured     bool      `xorm:"not null default false BOOL INDEX is_featured"`
	FeaturedWeight int       `xorm:"not null default 0 INT(11) featured_weight"`
	Status         string    `xorm:"not null default 'published' VARCHAR(32) INDEX status"`
	ReviewComment  string    `xorm:"TEXT review_comment"`
	ViewCount      int       `xorm:"not null default 0 INT(11) view_count"`
	LikeCount      int       `xorm:"not null default 0 INT(11) like_count"`
	FavoriteCount  int       `xorm:"not null default 0 INT(11) favorite_count"`
	CommentCount   int       `xorm:"not null default 0 INT(11) comment_count"`
	ShareCount     int       `xorm:"not null default 0 INT(11) share_count"`
	HotScore       int       `xorm:"not null default 0 INT(11) INDEX hot_score"`
	RewardGranted  bool      `xorm:"not null default false BOOL reward_granted"`
	RewardRevoked  bool      `xorm:"not null default false BOOL reward_revoked"`
	DeletedAt      time.Time `xorm:"TIMESTAMP deleted_at"`
	DeletedBy      string    `xorm:"not null default 0 BIGINT(20) deleted_by"`
}

func (Inspiration) TableName() string {
	return "inspiration"
}

type InspirationReaction struct {
	ID            int       `xorm:"not null pk autoincr INT(11) id"`
	CreatedAt     time.Time `xorm:"created not null default CURRENT_TIMESTAMP TIMESTAMP created_at"`
	InspirationID int       `xorm:"not null INT(11) INDEX UNIQUE(inspiration_user) inspiration_id"`
	UserID        string    `xorm:"not null default 0 BIGINT(20) INDEX UNIQUE(inspiration_user) user_id"`
}

func (InspirationReaction) TableName() string {
	return "inspiration_reaction"
}

type InspirationFavorite struct {
	ID            int       `xorm:"not null pk autoincr INT(11) id"`
	CreatedAt     time.Time `xorm:"created not null default CURRENT_TIMESTAMP TIMESTAMP created_at"`
	InspirationID int       `xorm:"not null INT(11) INDEX UNIQUE(inspiration_user) inspiration_id"`
	UserID        string    `xorm:"not null default 0 BIGINT(20) INDEX UNIQUE(inspiration_user) user_id"`
}

func (InspirationFavorite) TableName() string {
	return "inspiration_favorite"
}

type InspirationComment struct {
	ID            int       `xorm:"not null pk autoincr INT(11) id"`
	CreatedAt     time.Time `xorm:"created not null default CURRENT_TIMESTAMP TIMESTAMP created_at"`
	UpdatedAt     time.Time `xorm:"updated TIMESTAMP updated_at"`
	InspirationID int       `xorm:"not null INT(11) INDEX inspiration_id"`
	UserID        string    `xorm:"not null default 0 BIGINT(20) INDEX user_id"`
	Content       string    `xorm:"not null MEDIUMTEXT content"`
	Status        string    `xorm:"not null default 'published' VARCHAR(32) INDEX status"`
}

func (InspirationComment) TableName() string {
	return "inspiration_comment"
}

type InspirationReport struct {
	ID            int       `xorm:"not null pk autoincr INT(11) id"`
	CreatedAt     time.Time `xorm:"created not null default CURRENT_TIMESTAMP TIMESTAMP created_at"`
	UpdatedAt     time.Time `xorm:"updated TIMESTAMP updated_at"`
	InspirationID int       `xorm:"not null INT(11) INDEX inspiration_id"`
	UserID        string    `xorm:"not null default 0 BIGINT(20) INDEX user_id"`
	Reason        string    `xorm:"not null default '' VARCHAR(120) reason"`
	Content       string    `xorm:"TEXT content"`
	Status        string    `xorm:"not null default 'pending' VARCHAR(32) INDEX status"`
	OperatorID    string    `xorm:"not null default 0 BIGINT(20) operator_id"`
	ReviewNote    string    `xorm:"TEXT review_note"`
}

func (InspirationReport) TableName() string {
	return "inspiration_report"
}

type InspirationViewLog struct {
	ID            int       `xorm:"not null pk autoincr INT(11) id"`
	CreatedAt     time.Time `xorm:"created not null default CURRENT_TIMESTAMP TIMESTAMP created_at"`
	InspirationID int       `xorm:"not null INT(11) INDEX UNIQUE(view_fingerprint) inspiration_id"`
	UserID        string    `xorm:"not null default 0 BIGINT(20) INDEX UNIQUE(view_fingerprint) user_id"`
	IP            string    `xorm:"not null default '' VARCHAR(64) INDEX UNIQUE(view_fingerprint) ip"`
	WindowKey     string    `xorm:"not null default '' VARCHAR(32) UNIQUE(view_fingerprint) window_key"`
}

func (InspirationViewLog) TableName() string {
	return "inspiration_view_log"
}

type InspirationSetting struct {
	ID                        int       `xorm:"not null pk autoincr INT(11) id"`
	CreatedAt                 time.Time `xorm:"created not null default CURRENT_TIMESTAMP TIMESTAMP created_at"`
	UpdatedAt                 time.Time `xorm:"updated TIMESTAMP updated_at"`
	RequireReview             bool      `xorm:"not null default false BOOL require_review"`
	PublishRewardEnabled      bool      `xorm:"not null default true BOOL publish_reward_enabled"`
	PublishRewardPoints       int       `xorm:"not null default 5 INT(11) publish_reward_points"`
	RewardAfterReview         bool      `xorm:"not null default false BOOL reward_after_review"`
	RevokeRewardOnDelete      bool      `xorm:"not null default true BOOL revoke_reward_on_delete"`
	FeaturedDefaultWeight     int       `xorm:"not null default 100 INT(11) featured_default_weight"`
	RecommendationHotWeight   int       `xorm:"not null default 3 INT(11) recommendation_hot_weight"`
	RecommendationFreshWeight int       `xorm:"not null default 1 INT(11) recommendation_fresh_weight"`
	Categories                string    `xorm:"TEXT categories"`
}

func (InspirationSetting) TableName() string {
	return "inspiration_setting"
}
