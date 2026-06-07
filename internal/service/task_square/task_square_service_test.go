package task_square

import (
	"context"
	"fmt"
	"path/filepath"
	"testing"

	"github.com/apache/answer/internal/base/data"
	"github.com/apache/answer/internal/entity"
	"github.com/apache/answer/internal/schema"
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
		new(entity.UserPointAccount),
		new(entity.PointTransaction),
		new(entity.Question),
		new(entity.FeaturedPost),
		new(entity.Tag),
		new(entity.TagRel),
	); err != nil {
		t.Fatalf("sync task square tables: %v", err)
	}
	return NewTaskSquareService(&data.Data{DB: engine}, &testUniqueIDRepo{}, nil), engine
}

type testUniqueIDRepo struct {
	next int
}

func (r *testUniqueIDRepo) GenUniqueIDStr(_ context.Context, key string) (string, error) {
	r.next++
	return fmt.Sprintf("9000%d", r.next), nil
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
