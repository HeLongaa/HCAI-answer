package ai_chat_config

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"github.com/apache/answer/internal/entity"
	_ "modernc.org/sqlite"
	"xorm.io/xorm"
)

func TestCountUserVideoGenerationsCountsChargedStatuses(t *testing.T) {
	ctx := context.Background()
	dbPath := filepath.Join(t.TempDir(), "video-quota.db")
	engine, err := xorm.NewEngine("sqlite", dbPath)
	if err != nil {
		t.Fatalf("new engine: %v", err)
	}
	defer engine.Close()
	if err := engine.Sync(new(entity.AIVideoGeneration)); err != nil {
		t.Fatalf("sync table: %v", err)
	}

	records := []*entity.AIVideoGeneration{
		{GenerationID: "vid_queued", UserID: "user-1", Status: entity.AIVideoStatusQueued},
		{GenerationID: "vid_running", UserID: "user-1", Status: entity.AIVideoStatusInProgress},
		{GenerationID: "vid_done", UserID: "user-1", Status: entity.AIVideoStatusCompleted},
		{GenerationID: "vid_failed", UserID: "user-1", Status: entity.AIVideoStatusFailed},
		{GenerationID: "vid_other_user", UserID: "user-2", Status: entity.AIVideoStatusInProgress},
	}
	if _, err := engine.Insert(records); err != nil {
		t.Fatalf("insert records: %v", err)
	}
	session := engine.NewSession()
	defer session.Close()
	startAt := time.Date(1970, time.January, 1, 0, 0, 0, 0, time.UTC)
	endAt := time.Date(2099, time.January, 1, 0, 0, 0, 0, time.UTC)
	count, err := countUserVideoGenerations(ctx, session, "user-1", startAt, endAt)
	if err != nil {
		t.Fatalf("count video generations: %v", err)
	}
	if count != 4 {
		t.Fatalf("count = %d, want 4", count)
	}
}
