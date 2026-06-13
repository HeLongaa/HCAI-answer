package inspiration

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/apache/answer/internal/base/data"
	"github.com/apache/answer/internal/base/pager"
	"github.com/apache/answer/internal/base/reason"
	"github.com/apache/answer/internal/entity"
	"github.com/apache/answer/internal/schema"
	"github.com/apache/answer/internal/service/realtime"
	"github.com/apache/answer/internal/service/siteinfo_common"
	"github.com/segmentfault/pacman/errors"
	"xorm.io/builder"
	"xorm.io/xorm"
)

type InspirationService struct {
	data            *data.Data
	realtime        *realtime.Service
	siteInfoService siteinfo_common.SiteInfoCommonService
}

type authorInspirationStat struct {
	count int
	hot   int
}

var defaultInspirationCategories = []string{
	"Chat 提示词",
	"图片生成",
	"视频生成",
	"编程开发",
	"写作辅助",
	"数据分析",
	"办公效率",
	"角色扮演",
}

func NewInspirationService(
	data *data.Data,
	realtime *realtime.Service,
	siteInfoService siteinfo_common.SiteInfoCommonService,
) *InspirationService {
	return &InspirationService{
		data:            data,
		realtime:        realtime,
		siteInfoService: siteInfoService,
	}
}

func encodeInspirationList(values []string) string {
	if len(values) == 0 {
		return "[]"
	}
	b, _ := json.Marshal(values)
	return string(b)
}

func decodeInspirationList(value string) []string {
	if value == "" {
		return []string{}
	}
	var resp []string
	_ = json.Unmarshal([]byte(value), &resp)
	if resp == nil {
		return []string{}
	}
	return resp
}

func inspirationUnixTime(t time.Time) int64 {
	if t.IsZero() {
		return 0
	}
	return t.Unix()
}

func publicInspirationStatuses() []string {
	return []string{entity.InspirationStatusPublished, entity.InspirationStatusReported}
}

func isConfiguredInspirationCategory(category string, categories []string) bool {
	category = strings.TrimSpace(category)
	for _, item := range categories {
		if category == strings.TrimSpace(item) {
			return true
		}
	}
	return false
}

func inspirationBigIntString(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return "0"
	}
	return value
}

func (s *InspirationService) Create(ctx context.Context, req *schema.InspirationCreateReq) (*schema.InspirationResp, error) {
	setting, err := s.GetSetting(ctx)
	if err != nil {
		return nil, err
	}
	if !isConfiguredInspirationCategory(req.Category, setting.Categories) {
		return nil, errors.BadRequest(reason.RequestFormatError)
	}
	status := entity.InspirationStatusPublished
	var publishedAt time.Time
	if setting.RequireReview {
		status = entity.InspirationStatusPendingReview
	} else {
		publishedAt = time.Now()
	}
	item := &entity.Inspiration{
		UserID:      inspirationBigIntString(req.UserID),
		ReviewerID:  "0",
		Title:       req.Title,
		Summary:     req.Summary,
		Content:     req.Content,
		ContentHTML: req.Content,
		Type:        req.Type,
		Category:    req.Category,
		Tags:        encodeInspirationList(req.Tags),
		CoverURL:    req.CoverURL,
		Prompt:      req.Prompt,
		Model:       req.Model,
		Attachments: encodeInspirationList(req.Attachments),
		Links:       encodeInspirationList(req.Links),
		IsPublic:    req.IsPublic,
		Status:      status,
		PublishedAt: publishedAt,
		DeletedBy:   "0",
	}
	if _, err = s.data.DB.Context(ctx).Insert(item); err != nil {
		return nil, err
	}
	if status == entity.InspirationStatusPublished && !setting.RewardAfterReview {
		_ = s.grantPublishReward(ctx, nil, item, "")
	}
	s.publishChanged(item)
	return s.Get(ctx, item.ID, req.UserID, false, "")
}

func (s *InspirationService) Update(ctx context.Context, req *schema.InspirationUpdateReq) (*schema.InspirationResp, error) {
	item, err := s.getEntity(ctx, req.ID)
	if err != nil {
		return nil, err
	}
	if !req.IsAdmin && item.UserID != req.UserID {
		return nil, errors.Forbidden(reason.ForbiddenError)
	}
	if item.Status == entity.InspirationStatusDeleted {
		return nil, errors.BadRequest(reason.RequestFormatError)
	}
	setting, err := s.GetSetting(ctx)
	if err != nil {
		return nil, err
	}
	if req.Category != item.Category && !isConfiguredInspirationCategory(req.Category, setting.Categories) {
		return nil, errors.BadRequest(reason.RequestFormatError)
	}
	_, err = s.data.DB.Context(ctx).ID(req.ID).Cols(
		"title", "summary", "content", "content_html", "type", "category", "tags", "cover_url",
		"prompt", "model", "attachments", "links", "is_public",
	).Update(&entity.Inspiration{
		Title:       req.Title,
		Summary:     req.Summary,
		Content:     req.Content,
		ContentHTML: req.Content,
		Type:        req.Type,
		Category:    req.Category,
		Tags:        encodeInspirationList(req.Tags),
		CoverURL:    req.CoverURL,
		Prompt:      req.Prompt,
		Model:       req.Model,
		Attachments: encodeInspirationList(req.Attachments),
		Links:       encodeInspirationList(req.Links),
		IsPublic:    req.IsPublic,
	})
	if err != nil {
		return nil, err
	}
	s.publishChanged(item)
	return s.Get(ctx, req.ID, req.UserID, req.IsAdmin, "")
}

func (s *InspirationService) List(ctx context.Context, req *schema.InspirationListReq) (*pager.PageModel, error) {
	req.Page, req.PageSize = pager.ValPageAndPageSize(req.Page, req.PageSize)
	items := make([]*entity.Inspiration, 0)
	session := s.data.DB.Context(ctx)
	cond := builder.NewCond()
	if req.Query != "" {
		query := strings.TrimSpace(req.Query)
		like := "%" + query + "%"
		queryCond := builder.Or(builder.Like{"title", like}, builder.Like{"summary", like}, builder.Like{"content", like}, builder.Like{"tags", like}, builder.Like{"user_id", like})
		authorIDs, err := s.searchAuthorIDs(ctx, query)
		if err != nil {
			return nil, err
		}
		if len(authorIDs) > 0 {
			queryCond = queryCond.Or(builder.In("user_id", authorIDs))
		}
		cond = cond.And(queryCond)
	}
	if req.Type != "" {
		cond = cond.And(builder.Eq{"type": req.Type})
	}
	if req.Category != "" {
		cond = cond.And(builder.Eq{"category": req.Category})
	}
	if req.Tag != "" {
		cond = cond.And(builder.Like{"tags", fmt.Sprintf("%%%q%%", req.Tag)})
	}
	if req.Featured || req.Sort == "featured" {
		cond = cond.And(builder.Eq{"is_featured": true})
	}
	if req.Mine {
		cond = cond.And(builder.Eq{"user_id": req.UserID})
	} else if req.IsManage {
		if req.Status != "" {
			cond = cond.And(builder.Eq{"status": req.Status})
		}
	} else {
		cond = cond.And(builder.In("status", publicInspirationStatuses()))
		cond = cond.And(builder.Eq{"is_public": true})
	}
	if req.Status != "" && (req.IsManage || req.Mine) {
		cond = cond.And(builder.Eq{"status": req.Status})
	}
	session = session.Where(cond)
	if req.Sort == "recommend" {
		return s.listRecommended(ctx, req, session)
	}
	switch req.Sort {
	case "hot":
		session = session.Desc("hot_score", "id")
	case "popular":
		session = session.Desc("like_count", "favorite_count", "view_count", "id")
	case "featured":
		session = session.Desc("is_featured", "featured_weight", "published_at", "id")
	default:
		session = session.Desc("published_at", "id")
	}
	total, err := pager.Help(req.Page, req.PageSize, &items, &entity.Inspiration{}, session)
	if err != nil {
		return nil, err
	}
	resp := make([]*schema.InspirationResp, 0, len(items))
	for _, item := range items {
		itemResp, err := s.toResp(ctx, item, req.UserID, req.IsAdmin)
		if err != nil {
			return nil, err
		}
		resp = append(resp, itemResp)
	}
	return pager.NewPageModel(total, resp), nil
}

func (s *InspirationService) listRecommended(ctx context.Context, req *schema.InspirationListReq, session *xorm.Session) (*pager.PageModel, error) {
	items := make([]*entity.Inspiration, 0)
	if err := session.Find(&items); err != nil {
		return nil, err
	}
	setting, _ := s.GetSetting(ctx)
	now := time.Now()
	sort.SliceStable(items, func(i, j int) bool {
		left := recommendationScore(items[i], setting, now)
		right := recommendationScore(items[j], setting, now)
		if left != right {
			return left > right
		}
		return items[i].ID > items[j].ID
	})
	total := int64(len(items))
	start := (req.Page - 1) * req.PageSize
	if start > len(items) {
		start = len(items)
	}
	end := start + req.PageSize
	if end > len(items) {
		end = len(items)
	}
	resp := make([]*schema.InspirationResp, 0, end-start)
	for _, item := range items[start:end] {
		itemResp, err := s.toResp(ctx, item, req.UserID, req.IsAdmin)
		if err != nil {
			return nil, err
		}
		resp = append(resp, itemResp)
	}
	return pager.NewPageModel(total, resp), nil
}

func (s *InspirationService) Get(ctx context.Context, id int, userID string, isAdmin bool, ip string) (*schema.InspirationResp, error) {
	item, err := s.getEntity(ctx, id)
	if err != nil {
		return nil, err
	}
	if !s.canView(item, userID, isAdmin) {
		return nil, errors.Forbidden(reason.ForbiddenError)
	}
	if item.Status != entity.InspirationStatusDeleted && ip != "" {
		_ = s.recordView(ctx, item, userID, ip)
	}
	resp, err := s.toResp(ctx, item, userID, isAdmin)
	if err != nil {
		return nil, err
	}
	related, _ := s.related(ctx, item, userID, isAdmin)
	resp.Related = related
	return resp, nil
}

func (s *InspirationService) Delete(ctx context.Context, id int, userID string, isAdmin bool) error {
	item, err := s.getEntity(ctx, id)
	if err != nil {
		return err
	}
	if !isAdmin && item.UserID != userID {
		return errors.Forbidden(reason.ForbiddenError)
	}
	return s.adminUpdateStatus(ctx, item, entity.InspirationStatusDeleted, "", userID, true, false)
}

func (s *InspirationService) Like(ctx context.Context, id int, userID string, active bool) error {
	userID = inspirationBigIntString(userID)
	item, err := s.getEntity(ctx, id)
	if err != nil {
		return err
	}
	if !s.canView(item, userID, false) {
		return errors.Forbidden(reason.ForbiddenError)
	}
	session := s.data.DB.Context(ctx)
	if active {
		exist, err := session.Where("inspiration_id = ? AND user_id = ?", id, userID).Exist(new(entity.InspirationReaction))
		if err != nil {
			return err
		}
		if exist {
			return nil
		}
		_, err = session.Insert(&entity.InspirationReaction{InspirationID: id, UserID: userID})
		if err != nil {
			return err
		}
		_, _ = session.Exec("UPDATE inspiration SET like_count = like_count + 1, hot_score = hot_score + 3 WHERE id = ?", id)
	} else {
		affected, err := session.Where("inspiration_id = ? AND user_id = ?", id, userID).Delete(new(entity.InspirationReaction))
		if err != nil {
			return err
		}
		if affected > 0 {
			_, _ = session.Exec("UPDATE inspiration SET like_count = CASE WHEN like_count > 0 THEN like_count - 1 ELSE 0 END, hot_score = CASE WHEN hot_score > 2 THEN hot_score - 3 ELSE 0 END WHERE id = ?", id)
		}
	}
	s.publishChanged(item)
	return nil
}

func (s *InspirationService) Favorite(ctx context.Context, id int, userID string, active bool) error {
	userID = inspirationBigIntString(userID)
	item, err := s.getEntity(ctx, id)
	if err != nil {
		return err
	}
	if !s.canView(item, userID, false) {
		return errors.Forbidden(reason.ForbiddenError)
	}
	session := s.data.DB.Context(ctx)
	if active {
		exist, err := session.Where("inspiration_id = ? AND user_id = ?", id, userID).Exist(new(entity.InspirationFavorite))
		if err != nil {
			return err
		}
		if exist {
			return nil
		}
		_, err = session.Insert(&entity.InspirationFavorite{InspirationID: id, UserID: userID})
		if err != nil {
			return err
		}
		_, _ = session.Exec("UPDATE inspiration SET favorite_count = favorite_count + 1, hot_score = hot_score + 4 WHERE id = ?", id)
	} else {
		affected, err := session.Where("inspiration_id = ? AND user_id = ?", id, userID).Delete(new(entity.InspirationFavorite))
		if err != nil {
			return err
		}
		if affected > 0 {
			_, _ = session.Exec("UPDATE inspiration SET favorite_count = CASE WHEN favorite_count > 0 THEN favorite_count - 1 ELSE 0 END, hot_score = CASE WHEN hot_score > 3 THEN hot_score - 4 ELSE 0 END WHERE id = ?", id)
		}
	}
	s.publishChanged(item)
	return nil
}

func (s *InspirationService) Share(ctx context.Context, id int, userID string) error {
	userID = inspirationBigIntString(userID)
	item, err := s.getEntity(ctx, id)
	if err != nil {
		return err
	}
	if !s.canView(item, userID, false) {
		return errors.Forbidden(reason.ForbiddenError)
	}
	_, err = s.data.DB.Context(ctx).Exec("UPDATE inspiration SET share_count = share_count + 1, hot_score = hot_score + 2 WHERE id = ?", id)
	s.publishChanged(item)
	return err
}

func (s *InspirationService) AddComment(ctx context.Context, req *schema.InspirationCommentCreateReq) (*schema.InspirationCommentResp, error) {
	req.UserID = inspirationBigIntString(req.UserID)
	item, err := s.getEntity(ctx, req.ID)
	if err != nil {
		return nil, err
	}
	if !s.canView(item, req.UserID, false) {
		return nil, errors.Forbidden(reason.ForbiddenError)
	}
	comment := &entity.InspirationComment{InspirationID: req.ID, UserID: req.UserID, Content: req.Content, Status: entity.InspirationStatusPublished}
	if _, err = s.data.DB.Context(ctx).Insert(comment); err != nil {
		return nil, err
	}
	_, _ = s.data.DB.Context(ctx).Exec("UPDATE inspiration SET comment_count = comment_count + 1, hot_score = hot_score + 5 WHERE id = ?", req.ID)
	s.publishChanged(item)
	return s.commentResp(ctx, comment)
}

func (s *InspirationService) ListComments(ctx context.Context, req *schema.InspirationCommentListReq) (*pager.PageModel, error) {
	item, err := s.getEntity(ctx, req.ID)
	if err != nil {
		return nil, err
	}
	if !s.canView(item, req.UserID, req.IsAdmin) {
		return nil, errors.Forbidden(reason.ForbiddenError)
	}
	req.Page, req.PageSize = pager.ValPageAndPageSize(req.Page, req.PageSize)
	comments := make([]*entity.InspirationComment, 0)
	session := s.data.DB.Context(ctx).
		Where("inspiration_id = ? AND status = ?", req.ID, entity.InspirationStatusPublished).
		Asc("id")
	total, err := pager.Help(req.Page, req.PageSize, &comments, &entity.InspirationComment{}, session)
	if err != nil {
		return nil, err
	}
	resp := make([]*schema.InspirationCommentResp, 0, len(comments))
	for _, comment := range comments {
		item, err := s.commentResp(ctx, comment)
		if err != nil {
			return nil, err
		}
		resp = append(resp, item)
	}
	return pager.NewPageModel(total, resp), nil
}

func (s *InspirationService) Report(ctx context.Context, req *schema.InspirationReportReq) error {
	req.UserID = inspirationBigIntString(req.UserID)
	item, err := s.getEntity(ctx, req.ID)
	if err != nil {
		return err
	}
	if !s.canView(item, req.UserID, false) {
		return errors.Forbidden(reason.ForbiddenError)
	}
	report := &entity.InspirationReport{
		InspirationID: req.ID,
		UserID:        req.UserID,
		Reason:        req.Reason,
		Content:       req.Content,
		Status:        entity.InspirationReportStatusPending,
		OperatorID:    "0",
	}
	if _, err = s.data.DB.Context(ctx).Insert(report); err != nil {
		return err
	}
	if item.Status == entity.InspirationStatusPublished {
		_, _ = s.data.DB.Context(ctx).ID(req.ID).Cols("status").Update(&entity.Inspiration{Status: entity.InspirationStatusReported})
	}
	s.publishChanged(item)
	return nil
}

func (s *InspirationService) AdminAction(ctx context.Context, req *schema.InspirationAdminActionReq) (*schema.InspirationResp, error) {
	item, err := s.getEntity(ctx, req.ID)
	if err != nil {
		return nil, err
	}
	status := req.Status
	if status == "" {
		status = item.Status
	}
	if err = s.adminUpdateStatus(ctx, item, status, req.ReviewComment, req.OperatorID, req.RevokeReward, req.BanAuthor); err != nil {
		return nil, err
	}
	cols := []string{"is_featured", "featured_weight"}
	if req.FeaturedWeight <= 0 {
		setting, _ := s.GetSetting(ctx)
		req.FeaturedWeight = setting.FeaturedDefaultWeight
	}
	_, err = s.data.DB.Context(ctx).ID(req.ID).Cols(cols...).Update(&entity.Inspiration{
		IsFeatured:     req.Featured,
		FeaturedWeight: req.FeaturedWeight,
	})
	if err != nil {
		return nil, err
	}
	return s.Get(ctx, req.ID, req.OperatorID, true, "")
}

func (s *InspirationService) GetSetting(ctx context.Context) (*schema.InspirationSettingResp, error) {
	setting := &entity.InspirationSetting{ID: 1}
	has, err := s.data.DB.Context(ctx).Get(setting)
	if err != nil {
		return nil, err
	}
	if !has {
		setting = &entity.InspirationSetting{
			ID:                        1,
			PublishRewardEnabled:      true,
			PublishRewardPoints:       5,
			RevokeRewardOnDelete:      true,
			FeaturedDefaultWeight:     100,
			RecommendationHotWeight:   3,
			RecommendationFreshWeight: 1,
			Categories:                encodeInspirationList(defaultInspirationCategories),
		}
		_, err = s.data.DB.Context(ctx).Insert(setting)
		if err != nil {
			return nil, err
		}
	}
	categories := decodeInspirationList(setting.Categories)
	if len(categories) == 0 {
		categories = defaultInspirationCategories
	}
	return &schema.InspirationSettingResp{
		RequireReview:             setting.RequireReview,
		PublishRewardEnabled:      setting.PublishRewardEnabled,
		PublishRewardPoints:       setting.PublishRewardPoints,
		RewardAfterReview:         setting.RewardAfterReview,
		RevokeRewardOnDelete:      setting.RevokeRewardOnDelete,
		FeaturedDefaultWeight:     setting.FeaturedDefaultWeight,
		RecommendationHotWeight:   setting.RecommendationHotWeight,
		RecommendationFreshWeight: setting.RecommendationFreshWeight,
		Categories:                categories,
	}, nil
}

func (s *InspirationService) SaveSetting(ctx context.Context, req *schema.InspirationSettingReq) (*schema.InspirationSettingResp, error) {
	setting := &entity.InspirationSetting{
		ID:                        1,
		RequireReview:             req.RequireReview,
		PublishRewardEnabled:      req.PublishRewardEnabled,
		PublishRewardPoints:       req.PublishRewardPoints,
		RewardAfterReview:         req.RewardAfterReview,
		RevokeRewardOnDelete:      req.RevokeRewardOnDelete,
		FeaturedDefaultWeight:     req.FeaturedDefaultWeight,
		RecommendationHotWeight:   req.RecommendationHotWeight,
		RecommendationFreshWeight: req.RecommendationFreshWeight,
		Categories:                encodeInspirationList(req.Categories),
	}
	if setting.FeaturedDefaultWeight <= 0 {
		setting.FeaturedDefaultWeight = 100
	}
	if setting.RecommendationHotWeight <= 0 {
		setting.RecommendationHotWeight = 3
	}
	if setting.RecommendationFreshWeight <= 0 {
		setting.RecommendationFreshWeight = 1
	}
	if len(req.Categories) == 0 {
		setting.Categories = encodeInspirationList(defaultInspirationCategories)
	}
	affected, err := s.data.DB.Context(ctx).ID(1).AllCols().Update(setting)
	if err != nil {
		return nil, err
	}
	if affected == 0 {
		if _, err = s.data.DB.Context(ctx).Insert(setting); err != nil {
			return nil, err
		}
	}
	return s.GetSetting(ctx)
}

func (s *InspirationService) AuthorRanking(ctx context.Context) ([]*schema.InspirationAuthorRankResp, error) {
	items := make([]*entity.Inspiration, 0)
	if err := s.data.DB.Context(ctx).
		Where("status IN (?, ?) AND is_public = ?", entity.InspirationStatusPublished, entity.InspirationStatusReported, true).
		Find(&items); err != nil {
		return nil, err
	}
	stats := map[string]authorInspirationStat{}
	for _, item := range items {
		current := stats[item.UserID]
		current.count++
		current.hot += item.HotScore
		stats[item.UserID] = current
	}
	if len(stats) == 0 {
		return []*schema.InspirationAuthorRankResp{}, nil
	}
	users := make([]*entity.User, 0)
	if err := s.data.DB.Context(ctx).In("id", mapKeys(stats)).Find(&users); err != nil {
		return nil, err
	}
	avatarMapping := s.formatAvatarMapping(ctx, users)
	resp := make([]*schema.InspirationAuthorRankResp, 0, len(users))
	for _, user := range users {
		current := stats[user.ID]
		resp = append(resp, &schema.InspirationAuthorRankResp{
			UserID: user.ID, Username: user.Username, DisplayName: user.DisplayName, Avatar: avatarMapping[user.ID],
			Count: current.count, HotScore: current.hot,
		})
	}
	sort.SliceStable(resp, func(i, j int) bool {
		if resp[i].HotScore != resp[j].HotScore {
			return resp[i].HotScore > resp[j].HotScore
		}
		return resp[i].Count > resp[j].Count
	})
	if len(resp) > 20 {
		resp = resp[:20]
	}
	return resp, nil
}

func (s *InspirationService) Taxonomy(ctx context.Context) (*schema.InspirationTaxonomyResp, error) {
	items := make([]*entity.Inspiration, 0)
	if err := s.data.DB.Context(ctx).
		Where("status IN (?, ?) AND is_public = ?", entity.InspirationStatusPublished, entity.InspirationStatusReported, true).
		Find(&items); err != nil {
		return nil, err
	}
	categoryCounts := map[string]int{}
	tagCounts := map[string]int{}
	typeCounts := map[string]int{}
	for _, item := range items {
		if item.Category != "" {
			categoryCounts[item.Category]++
		}
		if item.Type != "" {
			typeCounts[item.Type]++
		}
		for _, tag := range decodeInspirationList(item.Tags) {
			tag = strings.TrimSpace(tag)
			if tag != "" {
				tagCounts[tag]++
			}
		}
	}
	categoryItems := taxonomyItems(categoryCounts, 20)
	setting, _ := s.GetSetting(ctx)
	if setting != nil && len(setting.Categories) > 0 {
		categoryItems = make([]*schema.InspirationTaxonomyItem, 0, len(setting.Categories))
		for _, category := range setting.Categories {
			category = strings.TrimSpace(category)
			if category != "" {
				categoryItems = append(categoryItems, &schema.InspirationTaxonomyItem{
					Name:  category,
					Count: categoryCounts[category],
				})
			}
		}
	}
	return &schema.InspirationTaxonomyResp{
		Categories: categoryItems,
		Tags:       taxonomyItems(tagCounts, 30),
		Types:      taxonomyItems(typeCounts, 12),
	}, nil
}

func (s *InspirationService) getEntity(ctx context.Context, id int) (*entity.Inspiration, error) {
	item := &entity.Inspiration{ID: id}
	has, err := s.data.DB.Context(ctx).Get(item)
	if err != nil {
		return nil, err
	}
	if !has {
		return nil, errors.NotFound(reason.ObjectNotFound)
	}
	return item, nil
}

func (s *InspirationService) searchAuthorIDs(ctx context.Context, query string) ([]string, error) {
	if query == "" {
		return nil, nil
	}
	like := "%" + query + "%"
	users := make([]*entity.User, 0)
	if err := s.data.DB.Context(ctx).
		Where(builder.Or(builder.Like{"username", like}, builder.Like{"display_name", like})).
		Limit(50).
		Find(&users); err != nil {
		return nil, err
	}
	ids := make([]string, 0, len(users))
	for _, user := range users {
		ids = append(ids, user.ID)
	}
	return ids, nil
}

func (s *InspirationService) canView(item *entity.Inspiration, userID string, isAdmin bool) bool {
	if isAdmin || item.UserID == userID {
		return true
	}
	if !item.IsPublic {
		return false
	}
	for _, status := range publicInspirationStatuses() {
		if item.Status == status {
			return true
		}
	}
	return false
}

func (s *InspirationService) toResp(ctx context.Context, item *entity.Inspiration, userID string, isAdmin bool) (*schema.InspirationResp, error) {
	user := &entity.User{ID: item.UserID}
	_, _ = s.data.DB.Context(ctx).Get(user)
	reviewer := &entity.User{ID: item.ReviewerID}
	_, _ = s.data.DB.Context(ctx).Get(reviewer)
	liked, _ := s.data.DB.Context(ctx).Where("inspiration_id = ? AND user_id = ?", item.ID, userID).Exist(new(entity.InspirationReaction))
	favorited, _ := s.data.DB.Context(ctx).Where("inspiration_id = ? AND user_id = ?", item.ID, userID).Exist(new(entity.InspirationFavorite))
	avatars := s.formatAvatarMapping(ctx, []*entity.User{user})
	reportReason := ""
	reportContent := ""
	if isAdmin {
		report := &entity.InspirationReport{}
		has, _ := s.data.DB.Context(ctx).
			Where("inspiration_id = ? AND status = ?", item.ID, entity.InspirationReportStatusPending).
			Desc("id").
			Get(report)
		if has {
			reportReason = report.Reason
			reportContent = report.Content
		}
	}
	return &schema.InspirationResp{
		ID: item.ID, CreatedAt: inspirationUnixTime(item.CreatedAt), UpdatedAt: inspirationUnixTime(item.UpdatedAt), PublishedAt: inspirationUnixTime(item.PublishedAt),
		UserID: item.UserID, Username: user.Username, UserDisplayName: user.DisplayName, UserAvatar: avatars[item.UserID],
		ReviewerID: item.ReviewerID, ReviewerName: reviewer.DisplayName,
		Title: item.Title, Summary: item.Summary, Content: item.Content, ContentHTML: item.ContentHTML, Type: item.Type, Category: item.Category,
		Tags: decodeInspirationList(item.Tags), CoverURL: item.CoverURL, Prompt: item.Prompt, Model: item.Model,
		Attachments: decodeInspirationList(item.Attachments), Links: decodeInspirationList(item.Links),
		IsPublic: item.IsPublic, IsFeatured: item.IsFeatured, FeaturedWeight: item.FeaturedWeight, Status: item.Status, ReviewComment: item.ReviewComment,
		ReportReason: reportReason, ReportContent: reportContent,
		ViewCount: item.ViewCount, LikeCount: item.LikeCount, FavoriteCount: item.FavoriteCount, CommentCount: item.CommentCount, ShareCount: item.ShareCount, HotScore: item.HotScore,
		RewardGranted: item.RewardGranted, RewardRevoked: item.RewardRevoked, RewardLogs: s.rewardLogs(ctx, item, isAdmin),
		Liked: liked, Favorited: favorited,
		CanEdit: isAdmin || item.UserID == userID, CanManage: isAdmin,
	}, nil
}

func (s *InspirationService) rewardLogs(ctx context.Context, item *entity.Inspiration, isAdmin bool) []*schema.InspirationRewardLogResp {
	if !isAdmin {
		return nil
	}
	sourceID := fmt.Sprintf("%d", item.ID)
	transactions := make([]*entity.PointTransaction, 0)
	if err := s.data.DB.Context(ctx).
		Where("user_id = ? AND source_id = ? AND source_type IN (?, ?)", item.UserID, sourceID, entity.PointSourceInspirationPublish, entity.PointSourceInspirationPublishRevoke).
		Asc("id").
		Find(&transactions); err != nil {
		return nil
	}
	resp := make([]*schema.InspirationRewardLogResp, 0, len(transactions))
	for _, transaction := range transactions {
		resp = append(resp, &schema.InspirationRewardLogResp{
			ID: transaction.ID, CreatedAt: inspirationUnixTime(transaction.CreatedAt),
			SourceType: transaction.SourceType, Delta: transaction.Delta, Balance: transaction.Balance,
			Description: transaction.Description, OperatorID: transaction.OperatorID,
		})
	}
	return resp
}

func (s *InspirationService) commentResp(ctx context.Context, comment *entity.InspirationComment) (*schema.InspirationCommentResp, error) {
	user := &entity.User{ID: comment.UserID}
	_, _ = s.data.DB.Context(ctx).Get(user)
	avatars := s.formatAvatarMapping(ctx, []*entity.User{user})
	return &schema.InspirationCommentResp{
		ID: comment.ID, CreatedAt: inspirationUnixTime(comment.CreatedAt), UpdatedAt: inspirationUnixTime(comment.UpdatedAt),
		InspirationID: comment.InspirationID, UserID: comment.UserID, Username: user.Username, DisplayName: user.DisplayName,
		Avatar: avatars[comment.UserID], Content: comment.Content, Status: comment.Status,
	}, nil
}

func (s *InspirationService) related(ctx context.Context, item *entity.Inspiration, userID string, isAdmin bool) ([]*schema.InspirationResp, error) {
	items := make([]*entity.Inspiration, 0)
	session := s.data.DB.Context(ctx).
		Where("id != ? AND status IN (?, ?) AND is_public = ?", item.ID, entity.InspirationStatusPublished, entity.InspirationStatusReported, true).
		Desc("hot_score", "id").Limit(6)
	if item.Category != "" {
		session = session.And("category = ?", item.Category)
	}
	if err := session.Find(&items); err != nil {
		return nil, err
	}
	resp := make([]*schema.InspirationResp, 0, len(items))
	for _, relatedItem := range items {
		relatedResp, err := s.toResp(ctx, relatedItem, userID, isAdmin)
		if err != nil {
			return nil, err
		}
		resp = append(resp, relatedResp)
	}
	return resp, nil
}

func (s *InspirationService) recordView(ctx context.Context, item *entity.Inspiration, userID, ip string) error {
	windowKey := time.Now().Format("2006010215")
	_, err := s.data.DB.Context(ctx).Insert(&entity.InspirationViewLog{
		InspirationID: item.ID,
		UserID:        inspirationBigIntString(userID),
		IP:            ip,
		WindowKey:     windowKey,
	})
	if err != nil {
		return nil
	}
	_, err = s.data.DB.Context(ctx).Exec("UPDATE inspiration SET view_count = view_count + 1, hot_score = hot_score + 1 WHERE id = ?", item.ID)
	return err
}

func (s *InspirationService) adminUpdateStatus(ctx context.Context, item *entity.Inspiration, status, reviewComment, operatorID string, revokeReward, banAuthor bool) error {
	session := s.data.DB.Context(ctx)
	if err := session.Begin(); err != nil {
		return err
	}
	operatorID = inspirationBigIntString(operatorID)
	update := &entity.Inspiration{Status: status, ReviewComment: reviewComment, ReviewerID: operatorID}
	cols := []string{"status", "review_comment", "reviewer_id"}
	if status == entity.InspirationStatusPublished && item.PublishedAt.IsZero() {
		update.PublishedAt = time.Now()
		cols = append(cols, "published_at")
	}
	if status == entity.InspirationStatusDeleted {
		update.DeletedAt = time.Now()
		update.DeletedBy = operatorID
		cols = append(cols, "deleted_at", "deleted_by")
	}
	if _, err := session.ID(item.ID).Cols(cols...).Update(update); err != nil {
		_ = session.Rollback()
		return err
	}
	item.Status = status
	if status == entity.InspirationStatusPublished {
		if err := s.grantPublishReward(ctx, session, item, operatorID); err != nil {
			_ = session.Rollback()
			return err
		}
	}
	if status == entity.InspirationStatusDeleted && revokeReward {
		if err := s.revokePublishReward(ctx, session, item, operatorID); err != nil {
			_ = session.Rollback()
			return err
		}
	}
	if banAuthor {
		_, err := session.ID(item.UserID).Cols("status", "suspended_at", "suspended_until").Update(&entity.User{
			Status:         entity.UserStatusSuspended,
			SuspendedAt:    time.Now(),
			SuspendedUntil: entity.PermanentSuspensionTime,
		})
		if err != nil {
			_ = session.Rollback()
			return err
		}
	}
	if err := session.Commit(); err != nil {
		return err
	}
	s.publishChanged(item)
	return nil
}

func (s *InspirationService) grantPublishReward(ctx context.Context, session *xorm.Session, item *entity.Inspiration, operatorID string) error {
	setting, err := s.GetSetting(ctx)
	if err != nil || !setting.PublishRewardEnabled || setting.PublishRewardPoints <= 0 || item.RewardGranted {
		return err
	}
	db := s.data.DB.Context(ctx)
	if session != nil {
		db = session
	}
	if err = s.addPointsWithSession(ctx, db, item.UserID, entity.PointSourceInspirationPublish, fmt.Sprintf("%d", item.ID), setting.PublishRewardPoints, "灵感发布奖励："+item.Title, operatorID); err != nil {
		return err
	}
	_, err = db.ID(item.ID).Cols("reward_granted").Update(&entity.Inspiration{RewardGranted: true})
	return err
}

func (s *InspirationService) revokePublishReward(ctx context.Context, session *xorm.Session, item *entity.Inspiration, operatorID string) error {
	if !item.RewardGranted || item.RewardRevoked {
		return nil
	}
	setting, err := s.GetSetting(ctx)
	if err != nil || !setting.RevokeRewardOnDelete {
		return err
	}
	db := s.data.DB.Context(ctx)
	if session != nil {
		db = session
	}
	sourceID := fmt.Sprintf("%d", item.ID)
	reward := &entity.PointTransaction{}
	has, err := db.Where("user_id = ? AND source_type = ? AND source_id = ?", item.UserID, entity.PointSourceInspirationPublish, sourceID).Get(reward)
	if err != nil || !has {
		return err
	}
	if err = s.addPointsWithSession(ctx, db, item.UserID, entity.PointSourceInspirationPublishRevoke, sourceID, -reward.Delta, "灵感删除撤销奖励："+item.Title, operatorID); err != nil {
		return err
	}
	_, err = db.ID(item.ID).Cols("reward_revoked").Update(&entity.Inspiration{RewardRevoked: true})
	return err
}

func (s *InspirationService) addPointsWithSession(ctx context.Context, session *xorm.Session, userID, sourceType, sourceID string, delta int, description, operatorID string) error {
	userID = inspirationBigIntString(userID)
	if delta == 0 {
		return nil
	}
	exist, err := session.Where("user_id = ? AND source_type = ? AND source_id = ?", userID, sourceType, sourceID).Exist(new(entity.PointTransaction))
	if err != nil {
		return err
	}
	if exist {
		return nil
	}
	account := &entity.UserPointAccount{UserID: userID}
	has, err := session.ForUpdate().Get(account)
	if err != nil {
		return err
	}
	if !has {
		account.Balance = 0
		if _, err = session.Insert(account); err != nil && !isInspirationDuplicateKeyError(err) {
			return err
		}
		if isInspirationDuplicateKeyError(err) {
			account = &entity.UserPointAccount{UserID: userID}
			if has, err = session.ForUpdate().Get(account); err != nil {
				return err
			}
			if !has {
				return fmt.Errorf("point account is not available")
			}
		}
	}
	exist, err = session.Where("user_id = ? AND source_type = ? AND source_id = ?", userID, sourceType, sourceID).Exist(new(entity.PointTransaction))
	if err != nil {
		return err
	}
	if exist {
		return nil
	}
	if _, err = session.ID(userID).Incr("balance", delta).Update(&entity.UserPointAccount{}); err != nil {
		return err
	}
	updated := &entity.UserPointAccount{UserID: userID}
	if has, err = session.Get(updated); err != nil {
		return err
	}
	if !has {
		return fmt.Errorf("point account is not available")
	}
	_, err = session.Insert(&entity.PointTransaction{
		UserID: userID, SourceType: sourceType, SourceID: sourceID, Delta: delta,
		Balance: updated.Balance, Description: description, OperatorID: inspirationBigIntString(operatorID),
	})
	if isInspirationDuplicateKeyError(err) {
		return nil
	}
	return err
}

func (s *InspirationService) formatAvatarMapping(ctx context.Context, users []*entity.User) map[string]string {
	resp := make(map[string]string, len(users))
	if s.siteInfoService != nil {
		avatarMapping := s.siteInfoService.FormatListAvatar(ctx, users)
		for _, user := range users {
			if avatar := avatarMapping[user.ID]; avatar != nil {
				resp[user.ID] = avatar.GetURL()
			}
		}
		return resp
	}
	for _, user := range users {
		avatar := &schema.AvatarInfo{}
		_ = json.Unmarshal([]byte(user.Avatar), avatar)
		resp[user.ID] = avatar.GetURL()
	}
	return resp
}

func (s *InspirationService) publishChanged(item *entity.Inspiration) {
	if s.realtime == nil || item == nil {
		return
	}
	s.realtime.Broadcast(realtime.EventInspirationsChanged, map[string]any{"inspiration_id": item.ID})
}

func mapKeys(values map[string]authorInspirationStat) []string {
	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	return keys
}

func isInspirationDuplicateKeyError(err error) bool {
	if err == nil {
		return false
	}
	text := strings.ToLower(err.Error())
	return strings.Contains(text, "duplicate") ||
		strings.Contains(text, "unique constraint") ||
		strings.Contains(text, "unique failed") ||
		strings.Contains(text, "constraint failed") ||
		strings.Contains(text, "duplicate key")
}

func recommendationScore(item *entity.Inspiration, setting *schema.InspirationSettingResp, now time.Time) int64 {
	hotWeight := 3
	freshWeight := 1
	if setting != nil {
		if setting.RecommendationHotWeight > 0 {
			hotWeight = setting.RecommendationHotWeight
		}
		if setting.RecommendationFreshWeight > 0 {
			freshWeight = setting.RecommendationFreshWeight
		}
	}
	publishedAt := item.PublishedAt
	if publishedAt.IsZero() {
		publishedAt = item.CreatedAt
	}
	ageHours := int(now.Sub(publishedAt).Hours())
	if ageHours < 0 {
		ageHours = 0
	}
	freshScore := 720 - ageHours
	if freshScore < 0 {
		freshScore = 0
	}
	score := int64(item.HotScore*hotWeight + freshScore*freshWeight)
	if item.IsFeatured {
		score += int64(10000 + item.FeaturedWeight*100)
	}
	return score
}

func taxonomyItems(values map[string]int, limit int) []*schema.InspirationTaxonomyItem {
	resp := make([]*schema.InspirationTaxonomyItem, 0, len(values))
	for name, count := range values {
		resp = append(resp, &schema.InspirationTaxonomyItem{Name: name, Count: count})
	}
	sort.SliceStable(resp, func(i, j int) bool {
		if resp[i].Count != resp[j].Count {
			return resp[i].Count > resp[j].Count
		}
		return resp[i].Name < resp[j].Name
	})
	if limit > 0 && len(resp) > limit {
		return resp[:limit]
	}
	return resp
}
