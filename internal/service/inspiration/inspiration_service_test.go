package inspiration

import (
	"context"
	"fmt"
	"path/filepath"
	"testing"
	"time"

	"github.com/apache/answer/internal/base/data"
	"github.com/apache/answer/internal/entity"
	"github.com/apache/answer/internal/schema"
	"github.com/apache/answer/internal/service/siteinfo_common"
	_ "modernc.org/sqlite"
	"xorm.io/xorm"
)

func newInspirationTestService(t *testing.T) (*InspirationService, *xorm.Engine) {
	t.Helper()
	engine, err := xorm.NewEngine("sqlite", filepath.Join(t.TempDir(), "inspiration.db"))
	if err != nil {
		t.Fatalf("new sqlite engine: %v", err)
	}
	if err := engine.Sync(
		new(entity.Inspiration),
		new(entity.InspirationReaction),
		new(entity.InspirationFavorite),
		new(entity.InspirationComment),
		new(entity.InspirationReport),
		new(entity.InspirationViewLog),
		new(entity.InspirationSetting),
		new(entity.User),
		new(entity.UserPointAccount),
		new(entity.PointTransaction),
	); err != nil {
		t.Fatalf("sync inspiration tables: %v", err)
	}
	return NewInspirationService(&data.Data{DB: engine}, nil, &testInspirationSiteInfoService{}), engine
}

type testInspirationSiteInfoService struct {
	siteinfo_common.SiteInfoCommonService
}

func (s *testInspirationSiteInfoService) FormatListAvatar(_ context.Context, users []*entity.User) map[string]*schema.AvatarInfo {
	resp := make(map[string]*schema.AvatarInfo, len(users))
	for _, user := range users {
		resp[user.ID] = schema.CustomAvatar(fmt.Sprintf("https://avatar.example/%s.png", user.ID))
	}
	return resp
}

func TestCreatePublishedInspirationGrantsRewardAndDeleteRevokesOnce(t *testing.T) {
	ctx := context.Background()
	service, engine := newInspirationTestService(t)
	defer engine.Close()

	if _, err := engine.Insert(&entity.User{ID: "1", Username: "author", DisplayName: "Author"}); err != nil {
		t.Fatalf("insert user: %v", err)
	}

	item, err := service.Create(ctx, &schema.InspirationCreateReq{
		UserID:   "1",
		Title:    "Useful prompt",
		Content:  "Prompt body",
		Category: "Chat 提示词",
		IsPublic: true,
	})
	if err != nil {
		t.Fatalf("create inspiration: %v", err)
	}
	account := &entity.UserPointAccount{UserID: "1"}
	if ok, err := engine.Get(account); err != nil || !ok {
		t.Fatalf("get account ok=%v err=%v", ok, err)
	}
	if account.Balance != 5 {
		t.Fatalf("balance after publish = %d, want 5", account.Balance)
	}

	if err := service.Delete(ctx, item.ID, "99", true); err != nil {
		t.Fatalf("delete inspiration: %v", err)
	}
	if err := service.Delete(ctx, item.ID, "99", true); err != nil {
		t.Fatalf("delete inspiration twice: %v", err)
	}

	account = &entity.UserPointAccount{UserID: "1"}
	if ok, err := engine.Get(account); err != nil || !ok {
		t.Fatalf("get account after delete ok=%v err=%v", ok, err)
	}
	if account.Balance != 0 {
		t.Fatalf("balance after revoke = %d, want 0", account.Balance)
	}
	count, err := engine.Count(&entity.PointTransaction{UserID: "1"})
	if err != nil {
		t.Fatalf("count transactions: %v", err)
	}
	if count != 2 {
		t.Fatalf("transaction count = %d, want 2", count)
	}
}

func TestAuthorRankingEmptyAndSearchByAuthorName(t *testing.T) {
	ctx := context.Background()
	service, engine := newInspirationTestService(t)
	defer engine.Close()

	ranking, err := service.AuthorRanking(ctx)
	if err != nil {
		t.Fatalf("empty author ranking: %v", err)
	}
	if len(ranking) != 0 {
		t.Fatalf("empty author ranking length = %d, want 0", len(ranking))
	}

	if _, err := engine.Insert(&entity.User{ID: "1", Username: "spark-user", DisplayName: "Spark Maker"}); err != nil {
		t.Fatalf("insert user: %v", err)
	}
	if _, err := engine.Insert(&entity.Inspiration{
		UserID:        "1",
		Title:         "Workflow",
		Content:       "Body",
		Status:        entity.InspirationStatusPublished,
		IsPublic:      true,
		RewardGranted: true,
	}); err != nil {
		t.Fatalf("insert inspiration: %v", err)
	}
	resp, err := service.List(ctx, &schema.InspirationListReq{
		Page:     1,
		PageSize: 10,
		Query:    "Spark",
	})
	if err != nil {
		t.Fatalf("search by author name: %v", err)
	}
	if resp.Count != 1 {
		t.Fatalf("search count = %d, want 1", resp.Count)
	}
}

func TestUpdateKeepsExistingCategoryAfterConfigChanges(t *testing.T) {
	ctx := context.Background()
	service, engine := newInspirationTestService(t)
	defer engine.Close()

	if _, err := engine.Insert(&entity.User{ID: "1", Username: "author", DisplayName: "Author"}); err != nil {
		t.Fatalf("insert user: %v", err)
	}
	item := &entity.Inspiration{
		UserID:   "1",
		Title:    "Old category",
		Content:  "Body",
		Category: "Legacy",
		Status:   entity.InspirationStatusPublished,
		IsPublic: true,
	}
	if _, err := engine.Insert(item); err != nil {
		t.Fatalf("insert inspiration: %v", err)
	}
	if _, err := service.SaveSetting(ctx, &schema.InspirationSettingReq{
		Categories: []string{"Current"},
	}); err != nil {
		t.Fatalf("save setting: %v", err)
	}

	if _, err := service.Update(ctx, &schema.InspirationUpdateReq{
		ID:       item.ID,
		UserID:   "1",
		Title:    "Updated title",
		Content:  "Updated body",
		Category: "Legacy",
		IsPublic: true,
	}); err != nil {
		t.Fatalf("update while keeping legacy category: %v", err)
	}
	if _, err := service.Update(ctx, &schema.InspirationUpdateReq{
		ID:       item.ID,
		UserID:   "1",
		Title:    "Updated title",
		Content:  "Updated body",
		Category: "Missing",
		IsPublic: true,
	}); err == nil {
		t.Fatal("update to an unconfigured category should fail")
	}
}

func TestFeaturedSortFiltersFeaturedItems(t *testing.T) {
	ctx := context.Background()
	service, engine := newInspirationTestService(t)
	defer engine.Close()

	if _, err := engine.Insert(&entity.User{ID: "1", Username: "author", DisplayName: "Author"}); err != nil {
		t.Fatalf("insert user: %v", err)
	}
	items := []*entity.Inspiration{
		{UserID: "1", Title: "Plain", Content: "Body", Status: entity.InspirationStatusPublished, IsPublic: true},
		{UserID: "1", Title: "Featured", Content: "Body", Status: entity.InspirationStatusPublished, IsPublic: true, IsFeatured: true, FeaturedWeight: 10},
	}
	if _, err := engine.Insert(items); err != nil {
		t.Fatalf("insert inspirations: %v", err)
	}

	resp, err := service.List(ctx, &schema.InspirationListReq{
		Page:     1,
		PageSize: 10,
		Sort:     "featured",
	})
	if err != nil {
		t.Fatalf("list featured: %v", err)
	}
	list := resp.List.([]*schema.InspirationResp)
	if resp.Count != 1 || len(list) != 1 || list[0].Title != "Featured" {
		t.Fatalf("featured list count=%d items=%#v, want only Featured", resp.Count, list)
	}
}

func TestSaveSettingInsertsMissingSettingRow(t *testing.T) {
	ctx := context.Background()
	service, engine := newInspirationTestService(t)
	defer engine.Close()

	setting, err := service.SaveSetting(ctx, &schema.InspirationSettingReq{
		PublishRewardPoints: 9,
		Categories:          []string{"One", "Two"},
	})
	if err != nil {
		t.Fatalf("save setting without existing row: %v", err)
	}
	if setting.PublishRewardPoints != 9 || len(setting.Categories) != 2 || setting.Categories[0] != "One" {
		t.Fatalf("setting = %#v, want saved values", setting)
	}
}

func TestRecommendationScoreUsesConfiguredWeightsAndFeaturedBoost(t *testing.T) {
	now := time.Now()
	hot := &entity.Inspiration{
		HotScore:    100,
		PublishedAt: now.Add(-48 * time.Hour),
	}
	fresh := &entity.Inspiration{
		HotScore:    10,
		PublishedAt: now,
	}

	hotWeighted := &schema.InspirationSettingResp{
		RecommendationHotWeight:   10,
		RecommendationFreshWeight: 1,
	}
	if recommendationScore(hot, hotWeighted, now) <= recommendationScore(fresh, hotWeighted, now) {
		t.Fatal("hot-weighted recommendation should prefer the hotter item")
	}

	freshWeighted := &schema.InspirationSettingResp{
		RecommendationHotWeight:   1,
		RecommendationFreshWeight: 10,
	}
	if recommendationScore(fresh, freshWeighted, now) <= recommendationScore(hot, freshWeighted, now) {
		t.Fatal("fresh-weighted recommendation should prefer the newer item")
	}

	featured := *hot
	featured.HotScore = 0
	featured.IsFeatured = true
	featured.FeaturedWeight = 1
	if recommendationScore(&featured, hotWeighted, now) <= recommendationScore(hot, hotWeighted, now) {
		t.Fatal("featured boost should outrank a non-featured item")
	}
}

func TestRecommendedListSortsBeforePagination(t *testing.T) {
	ctx := context.Background()
	service, engine := newInspirationTestService(t)
	defer engine.Close()

	if _, err := engine.Insert(&entity.User{ID: "1", Username: "author", DisplayName: "Author"}); err != nil {
		t.Fatalf("insert user: %v", err)
	}
	now := time.Now()
	items := []*entity.Inspiration{
		{UserID: "1", Title: "Low", Content: "Body", Status: entity.InspirationStatusPublished, IsPublic: true, HotScore: 1, PublishedAt: now},
		{UserID: "1", Title: "High", Content: "Body", Status: entity.InspirationStatusPublished, IsPublic: true, HotScore: 100, PublishedAt: now.Add(-time.Hour)},
		{UserID: "1", Title: "Middle", Content: "Body", Status: entity.InspirationStatusPublished, IsPublic: true, HotScore: 50, PublishedAt: now.Add(-time.Hour)},
	}
	if _, err := engine.Insert(items); err != nil {
		t.Fatalf("insert inspirations: %v", err)
	}

	firstPage, err := service.List(ctx, &schema.InspirationListReq{
		Page:     1,
		PageSize: 2,
		Sort:     "recommend",
	})
	if err != nil {
		t.Fatalf("list first recommendation page: %v", err)
	}
	firstItems := firstPage.List.([]*schema.InspirationResp)
	if firstPage.Count != 3 || len(firstItems) != 2 {
		t.Fatalf("first page count=%d length=%d, want count=3 length=2", firstPage.Count, len(firstItems))
	}
	if firstItems[0].Title != "High" || firstItems[1].Title != "Middle" {
		t.Fatalf("first page titles = %q, %q; want High, Middle", firstItems[0].Title, firstItems[1].Title)
	}

	secondPage, err := service.List(ctx, &schema.InspirationListReq{
		Page:     2,
		PageSize: 2,
		Sort:     "recommend",
	})
	if err != nil {
		t.Fatalf("list second recommendation page: %v", err)
	}
	secondItems := secondPage.List.([]*schema.InspirationResp)
	if len(secondItems) != 1 || secondItems[0].Title != "Low" {
		t.Fatalf("second page = %#v, want only Low", secondItems)
	}
}
