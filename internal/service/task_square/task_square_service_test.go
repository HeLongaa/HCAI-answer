package task_square

import (
	"context"
	"fmt"
	"path/filepath"
	"testing"

	"github.com/apache/answer/internal/base/data"
	"github.com/apache/answer/internal/entity"
	"github.com/apache/answer/internal/schema"
	"github.com/apache/answer/internal/service/siteinfo_common"
	_ "modernc.org/sqlite"
	"xorm.io/xorm"
)

func newTaskSquareTestService(t *testing.T) (*TaskSquareService, *xorm.Engine) {
	t.Helper()
	engine, err := xorm.NewEngine("sqlite", filepath.Join(t.TempDir(), "task-square.db"))
	if err != nil {
		t.Fatalf("new sqlite engine: %v", err)
	}
	if err := engine.Sync(
		new(entity.Task),
		new(entity.TaskSubmission),
		new(entity.User),
		new(entity.UserPointAccount),
		new(entity.PointTransaction),
		new(entity.Notification),
		new(entity.Question),
		new(entity.FeaturedPost),
		new(entity.Tag),
		new(entity.TagRel),
	); err != nil {
		t.Fatalf("sync task square tables: %v", err)
	}
	return NewTaskSquareService(&data.Data{DB: engine}, &testUniqueIDRepo{}, nil, &testSiteInfoService{}, nil, nil, nil), engine
}

type testUniqueIDRepo struct {
	next int
}

func (r *testUniqueIDRepo) GenUniqueIDStr(_ context.Context, key string) (string, error) {
	r.next++
	return fmt.Sprintf("9000%d", r.next), nil
}

type testSiteInfoService struct {
	siteinfo_common.SiteInfoCommonService
}

func (s *testSiteInfoService) FormatListAvatar(_ context.Context, users []*entity.User) map[string]*schema.AvatarInfo {
	resp := make(map[string]*schema.AvatarInfo, len(users))
	for _, user := range users {
		resp[user.ID] = schema.CustomAvatar(fmt.Sprintf("https://avatar.example/%s.png", user.ID))
	}
	return resp
}

func TestAddPointsWithSessionIsIdempotentBySource(t *testing.T) {
	ctx := context.Background()
	service, engine := newTaskSquareTestService(t)
	defer engine.Close()

	session := engine.NewSession()
	defer session.Close()
	if err := session.Begin(); err != nil {
		t.Fatalf("begin session: %v", err)
	}
	if err := service.addPointsWithSession(ctx, session, "1", entity.PointSourceTaskReward, "task-1", 10, "reward", "99"); err != nil {
		_ = session.Rollback()
		t.Fatalf("add first points: %v", err)
	}
	if err := service.addPointsWithSession(ctx, session, "1", entity.PointSourceTaskReward, "task-1", 10, "reward", "99"); err != nil {
		_ = session.Rollback()
		t.Fatalf("add duplicate points: %v", err)
	}
	if err := session.Commit(); err != nil {
		t.Fatalf("commit session: %v", err)
	}

	account := &entity.UserPointAccount{UserID: "1"}
	if ok, err := engine.Get(account); err != nil || !ok {
		t.Fatalf("get point account ok=%v err=%v", ok, err)
	}
	if account.Balance != 10 {
		t.Fatalf("balance = %d, want 10", account.Balance)
	}
	count, err := engine.Count(&entity.PointTransaction{UserID: "1"})
	if err != nil {
		t.Fatalf("count point transactions: %v", err)
	}
	if count != 1 {
		t.Fatalf("transaction count = %d, want 1", count)
	}
}

func TestListPointRankingOrdersAvailableUsersByBalance(t *testing.T) {
	ctx := context.Background()
	service, engine := newTaskSquareTestService(t)
	defer engine.Close()

	users := []*entity.User{
		{ID: "10", Username: "low", DisplayName: "Low", Status: entity.UserStatusAvailable},
		{
			ID:          "20",
			Username:    "top",
			DisplayName: "Top",
			Avatar:      schema.CustomAvatar("https://example.com/top.png").ToJsonString(),
			Status:      entity.UserStatusAvailable,
		},
		{ID: "30", Username: "deleted", DisplayName: "Deleted", Status: entity.UserStatusDeleted},
		{ID: "40", Username: "zero", DisplayName: "Zero", Status: entity.UserStatusAvailable},
	}
	if _, err := engine.Insert(users); err != nil {
		t.Fatalf("insert users: %v", err)
	}
	if _, err := engine.Insert([]*entity.UserPointAccount{
		{UserID: "10", Balance: 5},
		{UserID: "20", Balance: 30},
		{UserID: "30", Balance: 100},
		{UserID: "40", Balance: 0},
	}); err != nil {
		t.Fatalf("insert accounts: %v", err)
	}

	ranking, err := service.ListPointRanking(ctx)
	if err != nil {
		t.Fatalf("list point ranking: %v", err)
	}
	if len(ranking) != 3 {
		t.Fatalf("ranking length = %d, want 3", len(ranking))
	}
	if ranking[0].Username != "top" || ranking[0].Balance != 30 {
		t.Fatalf("first ranking = %+v, want top with 30", ranking[0])
	}
	if ranking[0].Avatar != "https://avatar.example/20.png" {
		t.Fatalf("first ranking avatar = %q, want site-formatted avatar URL", ranking[0].Avatar)
	}
	if ranking[1].Username != "low" || ranking[1].Balance != 5 {
		t.Fatalf("second ranking = %+v, want low with 5", ranking[1])
	}
	if ranking[2].Username != "zero" || ranking[2].Balance != 0 {
		t.Fatalf("third ranking = %+v, want zero with 0", ranking[2])
	}
}

func TestListContributionRankingOrdersAvailableUsersByRank(t *testing.T) {
	ctx := context.Background()
	service, engine := newTaskSquareTestService(t)
	defer engine.Close()

	users := []*entity.User{
		{ID: "10", Username: "low", DisplayName: "Low", Rank: 1, Status: entity.UserStatusAvailable},
		{
			ID:          "20",
			Username:    "top",
			DisplayName: "Top",
			Avatar:      schema.CustomAvatar("https://example.com/top-rank.png").ToJsonString(),
			Rank:        30,
			Status:      entity.UserStatusAvailable,
		},
		{ID: "30", Username: "deleted", DisplayName: "Deleted", Rank: 100, Status: entity.UserStatusDeleted},
		{ID: "40", Username: "zero", DisplayName: "Zero", Rank: 0, Status: entity.UserStatusAvailable},
	}
	if _, err := engine.Insert(users); err != nil {
		t.Fatalf("insert users: %v", err)
	}

	ranking, err := service.ListContributionRanking(ctx)
	if err != nil {
		t.Fatalf("list contribution ranking: %v", err)
	}
	if len(ranking) != 3 {
		t.Fatalf("ranking length = %d, want 3", len(ranking))
	}
	if ranking[0].Username != "top" || ranking[0].Rank != 30 {
		t.Fatalf("first ranking = %+v, want top with 30", ranking[0])
	}
	if ranking[0].Avatar != "https://avatar.example/20.png" {
		t.Fatalf("first ranking avatar = %q, want site-formatted avatar URL", ranking[0].Avatar)
	}
	if ranking[1].Username != "low" || ranking[1].Rank != 1 {
		t.Fatalf("second ranking = %+v, want low with 1", ranking[1])
	}
	if ranking[2].Username != "zero" || ranking[2].Rank != 0 {
		t.Fatalf("third ranking = %+v, want zero with 0", ranking[2])
	}
}

func TestClaimTaskOnlyOpenUnassignedTaskCanBeClaimed(t *testing.T) {
	ctx := context.Background()
	service, engine := newTaskSquareTestService(t)
	defer engine.Close()

	task := &entity.Task{
		UserID:      "10",
		Title:       "task",
		Description: "desc",
		Status:      entity.TaskStatusOpen,
		AssigneeID:  "0",
	}
	if _, err := engine.Insert(task); err != nil {
		t.Fatalf("insert task: %v", err)
	}

	if err := service.ClaimTask(ctx, &schema.TaskClaimReq{ID: task.ID, UserID: "1"}); err != nil {
		t.Fatalf("claim task first time: %v", err)
	}
	if err := service.ClaimTask(ctx, &schema.TaskClaimReq{ID: task.ID, UserID: "2"}); err == nil {
		t.Fatalf("claim task second time succeeded, want error")
	}

	claimed := &entity.Task{ID: task.ID}
	if ok, err := engine.Get(claimed); err != nil || !ok {
		t.Fatalf("get claimed task ok=%v err=%v", ok, err)
	}
	if claimed.AssigneeID != "1" {
		t.Fatalf("assignee = %q, want 1", claimed.AssigneeID)
	}
}

func TestCreateTaskSavesFullFieldsOnlyForAdminModerator(t *testing.T) {
	ctx := context.Background()
	service, engine := newTaskSquareTestService(t)
	defer engine.Close()

	if err := service.CreateTask(ctx, &schema.TaskCreateReq{
		UserID:                 "10",
		Title:                  "user task",
		Description:            "desc",
		Tags:                   []string{"hidden"},
		RewardPoints:           50,
		Deadline:               1893456000,
		SubmissionRequirements: "hidden requirements",
		Attachments:            []string{"https://example.com/user"},
		ReviewComment:          "hidden review",
		IsAdminModerator:       false,
	}); err != nil {
		t.Fatalf("create user task: %v", err)
	}
	userTask := &entity.Task{}
	if ok, err := engine.Where("title = ?", "user task").Get(userTask); err != nil || !ok {
		t.Fatalf("get user task ok=%v err=%v", ok, err)
	}
	if userTask.Status != entity.TaskStatusPendingReview {
		t.Fatalf("user task status = %q, want pending_review", userTask.Status)
	}
	if userTask.Tags != "" || userTask.RewardPoints != 0 ||
		!userTask.Deadline.IsZero() || userTask.SubmissionRequirements != "" ||
		userTask.ReviewComment != "" {
		t.Fatalf("user task saved admin-only fields: %+v", userTask)
	}
	if got := decodeList(userTask.Attachments); len(got) != 1 || got[0] != "https://example.com/user" {
		t.Fatalf("user task attachments = %v", got)
	}

	if err := service.CreateTask(ctx, &schema.TaskCreateReq{
		UserID:                 "99",
		Title:                  "admin task",
		Description:            "desc",
		Tags:                   []string{"design", "urgent"},
		RewardPoints:           25,
		Deadline:               1893456000,
		SubmissionRequirements: "requirements",
		Attachments:            []string{"https://example.com/admin"},
		ReviewComment:          "review",
		IsAdminModerator:       true,
	}); err != nil {
		t.Fatalf("create admin task: %v", err)
	}
	adminTask := &entity.Task{}
	if ok, err := engine.Where("title = ?", "admin task").Get(adminTask); err != nil || !ok {
		t.Fatalf("get admin task ok=%v err=%v", ok, err)
	}
	if adminTask.Status != entity.TaskStatusOpen || adminTask.ReviewerID != "99" ||
		adminTask.RewardPoints != 25 || adminTask.SubmissionRequirements != "requirements" ||
		adminTask.ReviewComment != "review" || adminTask.Deadline.IsZero() {
		t.Fatalf("admin task full fields not saved: %+v", adminTask)
	}
	if got := decodeList(adminTask.Tags); len(got) != 2 || got[0] != "design" || got[1] != "urgent" {
		t.Fatalf("admin task tags = %v", got)
	}
}

func TestTaskPrivateFieldsOnlyVisibleToOwnerAssigneeAndAdmin(t *testing.T) {
	ctx := context.Background()
	service, engine := newTaskSquareTestService(t)
	defer engine.Close()

	task := &entity.Task{
		UserID:                 "10",
		ReviewerID:             "99",
		Title:                  "task",
		Description:            "private description",
		SubmissionRequirements: "private requirements",
		Attachments:            encodeList([]string{"https://example.com/file"}),
		ReviewComment:          "private review",
		Status:                 entity.TaskStatusOpen,
		AssigneeID:             "20",
	}
	if _, err := engine.Insert(task); err != nil {
		t.Fatalf("insert task: %v", err)
	}
	submission := &entity.TaskSubmission{
		TaskID:     task.ID,
		UserID:     "20",
		Content:    "private submission",
		Links:      encodeList([]string{"https://example.com/result"}),
		Status:     entity.TaskSubmissionStatusPending,
		ReviewNote: "private note",
	}
	if _, err := engine.Insert(submission); err != nil {
		t.Fatalf("insert submission: %v", err)
	}

	visitorResp, err := service.GetTask(ctx, task.ID, "30", false)
	if err != nil {
		t.Fatalf("get task as visitor: %v", err)
	}
	if visitorResp.CanViewPrivateFields {
		t.Fatalf("visitor can view private fields")
	}
	if visitorResp.Description != "" || visitorResp.SubmissionRequirements != "" ||
		len(visitorResp.Attachments) != 0 || visitorResp.ReviewComment != task.ReviewComment ||
		visitorResp.Submission != nil {
		t.Fatalf("visitor private fields were not redacted: %+v", visitorResp)
	}

	ownerResp, err := service.GetTask(ctx, task.ID, "10", false)
	if err != nil {
		t.Fatalf("get task as owner: %v", err)
	}
	if !ownerResp.CanViewPrivateFields || ownerResp.Description != task.Description ||
		ownerResp.SubmissionRequirements != task.SubmissionRequirements ||
		len(ownerResp.Attachments) != 1 || ownerResp.ReviewComment != task.ReviewComment ||
		ownerResp.Submission == nil || ownerResp.Submission.Content != submission.Content {
		t.Fatalf("owner private fields are not visible: %+v", ownerResp)
	}

	assigneeResp, err := service.GetTask(ctx, task.ID, "20", false)
	if err != nil {
		t.Fatalf("get task as assignee: %v", err)
	}
	if !assigneeResp.CanViewPrivateFields || assigneeResp.Description != task.Description ||
		assigneeResp.Submission == nil || assigneeResp.Submission.Content != submission.Content {
		t.Fatalf("assignee private fields are not visible: %+v", assigneeResp)
	}

	adminResp, err := service.GetTask(ctx, task.ID, "30", true)
	if err != nil {
		t.Fatalf("get task as admin: %v", err)
	}
	if !adminResp.CanViewPrivateFields || adminResp.Description != task.Description ||
		adminResp.Submission == nil || adminResp.Submission.Content != submission.Content {
		t.Fatalf("admin private fields are not visible: %+v", adminResp)
	}
}

func TestFeaturePostRejectsUnavailableQuestion(t *testing.T) {
	ctx := context.Background()
	service, engine := newTaskSquareTestService(t)
	defer engine.Close()

	hiddenQuestion := &entity.Question{
		ID:     "10010000000000101",
		UserID: "10",
		Title:  "hidden question",
		Show:   entity.QuestionHide,
		Status: entity.QuestionStatusAvailable,
	}
	if _, err := engine.Insert(hiddenQuestion); err != nil {
		t.Fatalf("insert hidden question: %v", err)
	}

	err := service.FeaturePost(ctx, &schema.FeaturedPostCreateReq{
		QuestionID:   hiddenQuestion.ID,
		RewardPoints: 10,
		OperatorID:   "99",
	})
	if err == nil {
		t.Fatalf("feature hidden question succeeded, want error")
	}

	count, err := engine.Count(new(entity.FeaturedPost))
	if err != nil {
		t.Fatalf("count featured posts: %v", err)
	}
	if count != 0 {
		t.Fatalf("featured post count = %d, want 0", count)
	}
}

func TestRevokeFeaturedPostRewardIfExistsIsIdempotent(t *testing.T) {
	ctx := context.Background()
	service, engine := newTaskSquareTestService(t)
	defer engine.Close()

	if err := service.RevokeFeaturedPostRewardIfExists(ctx, "missing", "99"); err != nil {
		t.Fatalf("idempotent revoke missing featured post: %v", err)
	}
}

func TestFeaturePostRevokeAndFeatureAgainKeepsFeaturedTagConsistent(t *testing.T) {
	ctx := context.Background()
	service, engine := newTaskSquareTestService(t)
	defer engine.Close()

	question := &entity.Question{
		ID:     "10010000000000101",
		UserID: "10",
		Title:  "featured question",
		Show:   entity.QuestionShow,
		Status: entity.QuestionStatusAvailable,
	}
	if _, err := engine.Insert(question); err != nil {
		t.Fatalf("insert question: %v", err)
	}

	if err := service.FeaturePost(ctx, &schema.FeaturedPostCreateReq{
		QuestionID:   question.ID,
		RewardPoints: 10,
		OperatorID:   "99",
	}); err != nil {
		t.Fatalf("feature post: %v", err)
	}
	assertFeaturedState(t, engine, question.ID, true, 1, 10)

	if err := service.RevokeFeaturedPostRewardIfExists(ctx, question.ID, "99"); err != nil {
		t.Fatalf("revoke featured post: %v", err)
	}
	assertFeaturedState(t, engine, question.ID, false, 0, 0)

	if err := service.FeaturePost(ctx, &schema.FeaturedPostCreateReq{
		QuestionID:   question.ID,
		RewardPoints: 5,
		OperatorID:   "99",
	}); err != nil {
		t.Fatalf("feature post again: %v", err)
	}
	assertFeaturedState(t, engine, question.ID, true, 1, 5)

	totalFeatured, err := engine.Where("question_id = ?", question.ID).Count(new(entity.FeaturedPost))
	if err != nil {
		t.Fatalf("count featured post history: %v", err)
	}
	if totalFeatured != 2 {
		t.Fatalf("featured post history count = %d, want 2", totalFeatured)
	}
}

func assertFeaturedState(t *testing.T, engine *xorm.Engine, questionID string, active bool, tagCount int, balance int) {
	t.Helper()
	activeCount, err := engine.Where("question_id = ? AND active = ? AND revoked = ?", questionID, true, false).Count(new(entity.FeaturedPost))
	if err != nil {
		t.Fatalf("count active featured posts: %v", err)
	}
	wantActiveCount := int64(0)
	if active {
		wantActiveCount = 1
	}
	if activeCount != wantActiveCount {
		rows, _ := engine.QueryString("SELECT id, active, revoked, revoked_at FROM featured_post WHERE question_id = ?", questionID)
		t.Fatalf("active featured post count = %d, want %d, rows=%v", activeCount, wantActiveCount, rows)
	}

	tag := &entity.Tag{}
	has, err := engine.Where("slug_name = ?", featuredPostTagSlugName).Get(tag)
	if err != nil {
		t.Fatalf("get featured tag: %v", err)
	}
	if !has {
		t.Fatalf("featured tag not found")
	}
	if tag.QuestionCount != tagCount {
		t.Fatalf("featured tag question count = %d, want %d", tag.QuestionCount, tagCount)
	}

	rel := &entity.TagRel{}
	has, err = engine.Where("object_id = ? AND tag_id = ?", questionID, tag.ID).Get(rel)
	if err != nil {
		t.Fatalf("get featured tag rel: %v", err)
	}
	if !has {
		t.Fatalf("featured tag rel not found")
	}
	wantRelStatus := entity.TagRelStatusHide
	if active {
		wantRelStatus = entity.TagRelStatusAvailable
	}
	if rel.Status != wantRelStatus {
		t.Fatalf("featured tag rel status = %d, want %d", rel.Status, wantRelStatus)
	}

	account := &entity.UserPointAccount{UserID: "10"}
	has, err = engine.Get(account)
	if err != nil {
		t.Fatalf("get point account: %v", err)
	}
	if !has {
		t.Fatalf("point account not found")
	}
	if account.Balance != balance {
		t.Fatalf("point balance = %d, want %d", account.Balance, balance)
	}
}
