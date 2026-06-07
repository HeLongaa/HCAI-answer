package migrations

import (
	"context"
	"path/filepath"
	"testing"

	"github.com/apache/answer/internal/entity"
	_ "modernc.org/sqlite"
	"xorm.io/xorm"
)

func newMigrationTestEngine(t *testing.T) *xorm.Engine {
	t.Helper()
	engine, err := xorm.NewEngine("sqlite", filepath.Join(t.TempDir(), "migrations.db"))
	if err != nil {
		t.Fatalf("new sqlite engine: %v", err)
	}
	t.Cleanup(func() {
		_ = engine.Close()
	})
	return engine
}

func TestEnsurePointTransactionUniqueSourceIndexDeduplicatesAndIsIdempotent(t *testing.T) {
	ctx := context.Background()
	engine := newMigrationTestEngine(t)

	if _, err := engine.Exec(`
CREATE TABLE user_point_account (
	user_id TEXT PRIMARY KEY NOT NULL,
	balance INTEGER NOT NULL DEFAULT 0,
	created_at DATETIME,
	updated_at DATETIME
)`); err != nil {
		t.Fatalf("create user_point_account: %v", err)
	}
	if _, err := engine.Exec(`
CREATE TABLE point_transaction (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	created_at DATETIME,
	user_id TEXT NOT NULL DEFAULT '',
	source_type TEXT NOT NULL DEFAULT '',
	source_id TEXT NOT NULL DEFAULT '',
	delta INTEGER NOT NULL DEFAULT 0,
	balance INTEGER NOT NULL DEFAULT 0,
	description TEXT,
	operator_id TEXT NOT NULL DEFAULT ''
)`); err != nil {
		t.Fatalf("create point_transaction: %v", err)
	}
	if _, err := engine.Exec("INSERT INTO user_point_account (user_id, balance) VALUES (?, ?)", "100", 13); err != nil {
		t.Fatalf("insert account: %v", err)
	}
	rows := []entity.PointTransaction{
		{UserID: "100", SourceType: entity.PointSourceFeaturedPostReward, SourceID: "question-1", Delta: 10, Balance: 10},
		{UserID: "100", SourceType: entity.PointSourceFeaturedPostReward, SourceID: "question-1", Delta: 5, Balance: 15},
		{UserID: "100", SourceType: entity.PointSourceFeaturedPostReward, SourceID: "question-1", Delta: -2, Balance: 13},
		{UserID: "100", SourceType: entity.PointSourceFeaturedPostReward, SourceID: "question-2", Delta: 7, Balance: 20},
	}
	for _, row := range rows {
		if _, err := engine.Exec(
			"INSERT INTO point_transaction (user_id, source_type, source_id, delta, balance, description, operator_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
			row.UserID, row.SourceType, row.SourceID, row.Delta, row.Balance, row.Description, row.OperatorID,
		); err != nil {
			t.Fatalf("insert point transaction: %v", err)
		}
	}

	if err := ensurePointTransactionUniqueSourceIndex(ctx, engine); err != nil {
		t.Fatalf("ensure point transaction unique source index: %v", err)
	}
	if err := ensurePointTransactionUniqueSourceIndex(ctx, engine); err != nil {
		t.Fatalf("ensure point transaction unique source index twice: %v", err)
	}

	account := &entity.UserPointAccount{UserID: "100"}
	if ok, err := engine.Get(account); err != nil || !ok {
		t.Fatalf("get account ok=%v err=%v", ok, err)
	}
	if account.Balance != 10 {
		t.Fatalf("balance = %d, want 10", account.Balance)
	}
	count, err := engine.Where("user_id = ? AND source_type = ? AND source_id = ?", "100", entity.PointSourceFeaturedPostReward, "question-1").
		Count(new(entity.PointTransaction))
	if err != nil {
		t.Fatalf("count deduplicated transactions: %v", err)
	}
	if count != 1 {
		t.Fatalf("deduplicated transaction count = %d, want 1", count)
	}
	exists, err := indexExists(ctx, engine, "point_transaction", pointTransactionSourceIndex)
	if err != nil {
		t.Fatalf("check point source index: %v", err)
	}
	if !exists {
		t.Fatalf("point source unique index was not created")
	}
	if _, err := engine.Exec(
		"INSERT INTO point_transaction (user_id, source_type, source_id, delta, balance, description, operator_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
		"100", entity.PointSourceFeaturedPostReward, "question-1", 1, 11, "", "1",
	); err == nil {
		t.Fatalf("duplicate point transaction insert succeeded, want unique index error")
	}
}

func TestAllowFeaturedPostHistoryDropsQuestionUniqueIndexAndIsIdempotent(t *testing.T) {
	ctx := context.Background()
	engine := newMigrationTestEngine(t)
	if err := engine.Sync(new(entity.FeaturedPost)); err != nil {
		t.Fatalf("sync featured_post: %v", err)
	}
	if _, err := engine.Exec("CREATE UNIQUE INDEX " + featuredPostQuestionUniqueIndex + " ON featured_post (question_id)"); err != nil {
		t.Fatalf("create legacy featured_post unique index: %v", err)
	}
	if _, err := engine.Insert(&entity.FeaturedPost{
		QuestionID:   "question-1",
		AuthorID:     "100",
		OperatorID:   "200",
		Title:        "first",
		RewardPoints: 10,
		Active:       false,
		Revoked:      true,
	}); err != nil {
		t.Fatalf("insert legacy featured post: %v", err)
	}

	if err := allowFeaturedPostHistory(ctx, engine); err != nil {
		t.Fatalf("allow featured post history: %v", err)
	}
	if err := allowFeaturedPostHistory(ctx, engine); err != nil {
		t.Fatalf("allow featured post history twice: %v", err)
	}

	exists, err := indexExists(ctx, engine, "featured_post", featuredPostQuestionUniqueIndex)
	if err != nil {
		t.Fatalf("check featured_post question unique index: %v", err)
	}
	if exists {
		t.Fatalf("legacy featured_post question unique index still exists")
	}
	if _, err := engine.Insert(&entity.FeaturedPost{
		QuestionID:   "question-1",
		AuthorID:     "100",
		OperatorID:   "200",
		Title:        "second",
		RewardPoints: 20,
		Active:       true,
		Revoked:      false,
	}); err != nil {
		t.Fatalf("insert second featured post for same question: %v", err)
	}
	count, err := engine.Where("question_id = ?", "question-1").Count(new(entity.FeaturedPost))
	if err != nil {
		t.Fatalf("count featured posts: %v", err)
	}
	if count != 2 {
		t.Fatalf("featured post count = %d, want 2", count)
	}
}
