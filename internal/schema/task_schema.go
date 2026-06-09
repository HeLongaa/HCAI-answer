package schema

type TaskCreateReq struct {
	Title                  string   `validate:"required,min=2,max=150" json:"title"`
	Description            string   `validate:"required,min=2" json:"description"`
	Tags                   []string `json:"tags"`
	RewardPoints           int      `validate:"min=0" json:"reward_points"`
	Deadline               int64    `json:"deadline"`
	SubmissionRequirements string   `json:"submission_requirements"`
	Attachments            []string `json:"attachments"`
	ReviewComment          string   `json:"review_comment"`
	UserID                 string   `json:"-"`
	IsAdminModerator       bool     `json:"-"`
}

type TaskReviewReq struct {
	ID                     int      `validate:"required" json:"id"`
	Title                  string   `validate:"required,min=2,max=150" json:"title"`
	Description            string   `validate:"required,min=2" json:"description"`
	Tags                   []string `json:"tags"`
	RewardPoints           int      `validate:"min=0" json:"reward_points"`
	Deadline               int64    `json:"deadline"`
	SubmissionRequirements string   `json:"submission_requirements"`
	Attachments            []string `json:"attachments"`
	Status                 string   `validate:"required,oneof=open rejected closed failed" json:"status"`
	ReviewComment          string   `json:"review_comment"`
	OperatorID             string   `json:"-"`
}

type TaskClaimReq struct {
	ID     int    `validate:"required" json:"id"`
	UserID string `json:"-"`
}

type TaskAssignReq struct {
	ID         int    `validate:"required" json:"id"`
	AssigneeID string `validate:"required" json:"assignee_id"`
	OperatorID string `json:"-"`
}

type TaskSubmitReq struct {
	ID          int      `validate:"required" json:"id"`
	Content     string   `validate:"required,min=2" json:"content"`
	Links       []string `json:"links"`
	Attachments []string `json:"attachments"`
	UserID      string   `json:"-"`
}

type TaskSubmissionReviewReq struct {
	SubmissionID int    `json:"submission_id"`
	TaskID       int    `json:"task_id"`
	Approved     bool   `json:"approved"`
	ReviewNote   string `json:"review_note"`
	OperatorID   string `json:"-"`
}

type TaskListReq struct {
	Page             int    `form:"page"`
	PageSize         int    `form:"page_size"`
	Status           string `form:"status"`
	Mine             bool   `form:"mine"`
	UserID           string `json:"-"`
	IsAdmin          bool   `json:"-"`
	IsAdminModerator bool   `json:"-"`
}

type TaskResp struct {
	ID                     int                 `json:"id"`
	CreatedAt              int64               `json:"created_at"`
	UpdatedAt              int64               `json:"updated_at"`
	UserID                 string              `json:"user_id"`
	UserDisplayName        string              `json:"user_display_name"`
	ReviewerID             string              `json:"reviewer_id"`
	ReviewerDisplayName    string              `json:"reviewer_display_name"`
	AssigneeID             string              `json:"assignee_id"`
	AssigneeDisplayName    string              `json:"assignee_display_name"`
	Title                  string              `json:"title"`
	Description            string              `json:"description"`
	Tags                   []string            `json:"tags"`
	RewardPoints           int                 `json:"reward_points"`
	Deadline               int64               `json:"deadline"`
	SubmissionRequirements string              `json:"submission_requirements"`
	Attachments            []string            `json:"attachments"`
	Status                 string              `json:"status"`
	ReviewComment          string              `json:"review_comment"`
	ClaimedAt              int64               `json:"claimed_at"`
	CompletedAt            int64               `json:"completed_at"`
	CanViewPrivateFields   bool                `json:"can_view_private_fields"`
	Submission             *TaskSubmissionResp `json:"submission,omitempty"`
}

type TaskSubmissionResp struct {
	ID          int      `json:"id"`
	CreatedAt   int64    `json:"created_at"`
	UpdatedAt   int64    `json:"updated_at"`
	TaskID      int      `json:"task_id"`
	UserID      string   `json:"user_id"`
	ReviewerID  string   `json:"reviewer_id"`
	Content     string   `json:"content"`
	Links       []string `json:"links"`
	Attachments []string `json:"attachments"`
	Status      string   `json:"status"`
	ReviewNote  string   `json:"review_note"`
}

type PointAccountResp struct {
	Balance int `json:"balance"`
}

type PointRankingResp struct {
	UserID      string `json:"user_id"`
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
	Avatar      string `json:"avatar"`
	Balance     int    `json:"balance"`
}

type PointTransactionReq struct {
	Page     int    `form:"page"`
	PageSize int    `form:"page_size"`
	UserID   string `json:"-"`
}

type PointTransactionResp struct {
	ID          int    `json:"id"`
	CreatedAt   int64  `json:"created_at"`
	UserID      string `json:"user_id"`
	SourceType  string `json:"source_type"`
	SourceID    string `json:"source_id"`
	Delta       int    `json:"delta"`
	Balance     int    `json:"balance"`
	Description string `json:"description"`
	OperatorID  string `json:"operator_id"`
}

type FeaturedPostCreateReq struct {
	QuestionID   string `validate:"required" json:"question_id"`
	RewardPoints int    `validate:"min=1" json:"reward_points"`
	Note         string `json:"note"`
	OperatorID   string `json:"-"`
}

type FeaturedPostRevokeReq struct {
	QuestionID string `validate:"required" json:"question_id"`
	OperatorID string `json:"-"`
}

type FeaturedPostListReq struct {
	Page     int `form:"page"`
	PageSize int `form:"page_size"`
}

type FeaturedPostResp struct {
	ID           int    `json:"id"`
	CreatedAt    int64  `json:"created_at"`
	QuestionID   string `json:"question_id"`
	AuthorID     string `json:"author_id"`
	AuthorName   string `json:"author_name"`
	OperatorID   string `json:"operator_id"`
	Title        string `json:"title"`
	RewardPoints int    `json:"reward_points"`
	Note         string `json:"note"`
	Active       bool   `json:"active"`
	Revoked      bool   `json:"revoked"`
	RevokedAt    int64  `json:"revoked_at"`
}
