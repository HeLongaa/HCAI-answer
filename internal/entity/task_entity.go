package entity

import "time"

const (
	TaskStatusPendingReview = "pending_review"
	TaskStatusRejected      = "rejected"
	TaskStatusOpen          = "open"
	TaskStatusInProgress    = "in_progress"
	TaskStatusSubmitted     = "submitted"
	TaskStatusCompleted     = "completed"
	TaskStatusFailed        = "failed"
	TaskStatusClosed        = "closed"

	TaskSubmissionStatusPending  = "pending"
	TaskSubmissionStatusApproved = "approved"
	TaskSubmissionStatusRejected = "rejected"

	PointSourceTaskReward         = "task_reward"
	PointSourceFeaturedPostReward = "featured_post_reward"
	PointSourceFeaturedPostRevoke = "featured_post_revoke"
)

type Task struct {
	ID                     int       `xorm:"not null pk autoincr INT(11) id"`
	CreatedAt              time.Time `xorm:"created not null default CURRENT_TIMESTAMP TIMESTAMP created_at"`
	UpdatedAt              time.Time `xorm:"updated TIMESTAMP updated_at"`
	UserID                 string    `xorm:"not null default 0 BIGINT(20) INDEX user_id"`
	ReviewerID             string    `xorm:"not null default 0 BIGINT(20) reviewer_id"`
	AssigneeID             string    `xorm:"not null default 0 BIGINT(20) INDEX assignee_id"`
	Title                  string    `xorm:"not null default '' VARCHAR(150) title"`
	Description            string    `xorm:"not null MEDIUMTEXT description"`
	Tags                   string    `xorm:"TEXT tags"`
	RewardPoints           int       `xorm:"not null default 0 INT(11) reward_points"`
	Deadline               time.Time `xorm:"TIMESTAMP deadline"`
	SubmissionRequirements string    `xorm:"MEDIUMTEXT submission_requirements"`
	Attachments            string    `xorm:"MEDIUMTEXT attachments"`
	Status                 string    `xorm:"not null default 'pending_review' VARCHAR(32) INDEX status"`
	ReviewComment          string    `xorm:"TEXT review_comment"`
	ClaimedAt              time.Time `xorm:"TIMESTAMP claimed_at"`
	CompletedAt            time.Time `xorm:"TIMESTAMP completed_at"`
}

func (Task) TableName() string {
	return "task"
}

type TaskSubmission struct {
	ID          int       `xorm:"not null pk autoincr INT(11) id"`
	CreatedAt   time.Time `xorm:"created not null default CURRENT_TIMESTAMP TIMESTAMP created_at"`
	UpdatedAt   time.Time `xorm:"updated TIMESTAMP updated_at"`
	TaskID      int       `xorm:"not null INT(11) INDEX task_id"`
	UserID      string    `xorm:"not null default 0 BIGINT(20) INDEX user_id"`
	ReviewerID  string    `xorm:"not null default 0 BIGINT(20) reviewer_id"`
	Content     string    `xorm:"not null MEDIUMTEXT content"`
	Links       string    `xorm:"TEXT links"`
	Attachments string    `xorm:"MEDIUMTEXT attachments"`
	Status      string    `xorm:"not null default 'pending' VARCHAR(32) INDEX status"`
	ReviewNote  string    `xorm:"TEXT review_note"`
}

func (TaskSubmission) TableName() string {
	return "task_submission"
}

type UserPointAccount struct {
	UserID    string    `xorm:"not null pk BIGINT(20) user_id"`
	Balance   int       `xorm:"not null default 0 INT(11) balance"`
	CreatedAt time.Time `xorm:"created not null default CURRENT_TIMESTAMP TIMESTAMP created_at"`
	UpdatedAt time.Time `xorm:"updated TIMESTAMP updated_at"`
}

func (UserPointAccount) TableName() string {
	return "user_point_account"
}

type PointTransaction struct {
	ID          int       `xorm:"not null pk autoincr INT(11) id"`
	CreatedAt   time.Time `xorm:"created not null default CURRENT_TIMESTAMP TIMESTAMP created_at"`
	UserID      string    `xorm:"not null default 0 BIGINT(20) INDEX UNIQUE(point_source) user_id"`
	SourceType  string    `xorm:"not null default '' VARCHAR(64) INDEX UNIQUE(point_source) source_type"`
	SourceID    string    `xorm:"not null default '' VARCHAR(64) INDEX UNIQUE(point_source) source_id"`
	Delta       int       `xorm:"not null default 0 INT(11) delta"`
	Balance     int       `xorm:"not null default 0 INT(11) balance"`
	Description string    `xorm:"TEXT description"`
	OperatorID  string    `xorm:"not null default 0 BIGINT(20) operator_id"`
}

func (PointTransaction) TableName() string {
	return "point_transaction"
}

type FeaturedPost struct {
	ID           int       `xorm:"not null pk autoincr INT(11) id"`
	CreatedAt    time.Time `xorm:"created not null default CURRENT_TIMESTAMP TIMESTAMP created_at"`
	UpdatedAt    time.Time `xorm:"updated TIMESTAMP updated_at"`
	QuestionID   string    `xorm:"not null default 0 BIGINT(20) INDEX question_id"`
	AuthorID     string    `xorm:"not null default 0 BIGINT(20) INDEX author_id"`
	OperatorID   string    `xorm:"not null default 0 BIGINT(20) operator_id"`
	Title        string    `xorm:"not null default '' VARCHAR(150) title"`
	RewardPoints int       `xorm:"not null default 0 INT(11) reward_points"`
	Note         string    `xorm:"TEXT note"`
	Active       bool      `xorm:"not null default true BOOL active"`
	Revoked      bool      `xorm:"not null default false BOOL revoked"`
	RevokedAt    time.Time `xorm:"TIMESTAMP revoked_at"`
}

func (FeaturedPost) TableName() string {
	return "featured_post"
}
