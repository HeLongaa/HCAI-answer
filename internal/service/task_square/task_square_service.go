package task_square

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/apache/answer/internal/base/data"
	"github.com/apache/answer/internal/base/pager"
	"github.com/apache/answer/internal/base/reason"
	"github.com/apache/answer/internal/entity"
	"github.com/apache/answer/internal/schema"
	"github.com/apache/answer/internal/service/realtime"
	"github.com/apache/answer/internal/service/unique"
	"github.com/apache/answer/pkg/uid"
	"github.com/segmentfault/pacman/errors"
	"xorm.io/builder"
	"xorm.io/xorm"
)

const (
	featuredPostTagSlugName    = "featured"
	featuredPostTagDisplayName = "精选"
	featuredPostTagDescription = "精选话题"
)

var publicTaskStatuses = []string{
	entity.TaskStatusOpen,
	entity.TaskStatusInProgress,
	entity.TaskStatusSubmitted,
	entity.TaskStatusCompleted,
	entity.TaskStatusFailed,
	entity.TaskStatusClosed,
}

func isPublicTaskStatus(status string) bool {
	for _, item := range publicTaskStatuses {
		if status == item {
			return true
		}
	}
	return false
}

type TaskSquareService struct {
	data         *data.Data
	uniqueIDRepo unique.UniqueIDRepo
	realtime     *realtime.Service
}

func NewTaskSquareService(data *data.Data, uniqueIDRepo unique.UniqueIDRepo, realtime *realtime.Service) *TaskSquareService {
	return &TaskSquareService{data: data, uniqueIDRepo: uniqueIDRepo, realtime: realtime}
}

func encodeList(values []string) string {
	if len(values) == 0 {
		return "[]"
	}
	b, _ := json.Marshal(values)
	return string(b)
}

func decodeList(value string) []string {
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

func unixTime(t time.Time) int64 {
	if t.IsZero() {
		return 0
	}
	return t.Unix()
}

func (s *TaskSquareService) CreateTask(ctx context.Context, req *schema.TaskCreateReq) error {
	status := entity.TaskStatusPendingReview
	if req.IsAdminModerator {
		status = entity.TaskStatusOpen
	}
	task := &entity.Task{
		UserID:      req.UserID,
		Title:       req.Title,
		Description: req.Description,
		Attachments: encodeList(req.Attachments),
		Status:      status,
	}
	_, err := s.data.DB.Context(ctx).
		Cols("user_id", "title", "description", "attachments", "status").
		Insert(task)
	if err == nil {
		s.realtime.Broadcast(realtime.EventTasksChanged, map[string]any{"user_id": req.UserID})
	}
	return err
}

func (s *TaskSquareService) ListTasks(ctx context.Context, req *schema.TaskListReq) (*pager.PageModel, error) {
	req.Page, req.PageSize = pager.ValPageAndPageSize(req.Page, req.PageSize)
	tasks := make([]*entity.Task, 0)
	session := s.data.DB.Context(ctx).Desc("id")
	cond := builder.NewCond()
	if req.Status != "" {
		cond = cond.And(builder.Eq{"status": req.Status})
		if !req.IsAdmin && !req.Mine && !isPublicTaskStatus(req.Status) {
			cond = cond.And(builder.Eq{"id": 0})
		}
	} else if !req.IsAdmin && !req.Mine {
		cond = cond.And(builder.In("status", publicTaskStatuses))
	}
	if req.Mine {
		cond = cond.And(builder.Or(builder.Eq{"user_id": req.UserID}, builder.Eq{"assignee_id": req.UserID}))
	}
	if cond != nil {
		session = session.Where(cond)
	}
	total, err := pager.Help(req.Page, req.PageSize, &tasks, &entity.Task{}, session)
	if err != nil {
		return nil, err
	}
	resp := make([]*schema.TaskResp, 0, len(tasks))
	for _, task := range tasks {
		resp = append(resp, s.taskResp(ctx, task))
	}
	return pager.NewPageModel(total, resp), nil
}

func (s *TaskSquareService) GetTask(ctx context.Context, id int, userID string, isAdmin bool) (*schema.TaskResp, error) {
	task := &entity.Task{ID: id}
	has, err := s.data.DB.Context(ctx).Get(task)
	if err != nil {
		return nil, err
	}
	if !has {
		return nil, errors.NotFound(reason.ObjectNotFound)
	}
	if !isAdmin && !isPublicTaskStatus(task.Status) && task.UserID != userID && task.AssigneeID != userID {
		return nil, errors.Forbidden(reason.ForbiddenError)
	}
	return s.taskResp(ctx, task), nil
}

func (s *TaskSquareService) ReviewTask(ctx context.Context, req *schema.TaskReviewReq) error {
	task := &entity.Task{ID: req.ID}
	has, err := s.data.DB.Context(ctx).Get(task)
	if err != nil {
		return err
	}
	if !has {
		return errors.NotFound(reason.ObjectNotFound)
	}
	var deadline time.Time
	if req.Deadline > 0 {
		deadline = time.Unix(req.Deadline, 0)
	}
	_, err = s.data.DB.Context(ctx).ID(req.ID).Cols(
		"title", "description", "tags", "reward_points", "deadline", "submission_requirements",
		"attachments", "status", "review_comment", "reviewer_id",
	).Update(&entity.Task{
		Title:                  req.Title,
		Description:            req.Description,
		Tags:                   encodeList(req.Tags),
		RewardPoints:           req.RewardPoints,
		Deadline:               deadline,
		SubmissionRequirements: req.SubmissionRequirements,
		Attachments:            encodeList(req.Attachments),
		Status:                 req.Status,
		ReviewComment:          req.ReviewComment,
		ReviewerID:             req.OperatorID,
	})
	if err == nil {
		s.realtime.Broadcast(realtime.EventTasksChanged, map[string]any{"task_id": req.ID})
	}
	return err
}

func (s *TaskSquareService) ClaimTask(ctx context.Context, req *schema.TaskClaimReq) error {
	task := &entity.Task{ID: req.ID}
	has, err := s.data.DB.Context(ctx).Get(task)
	if err != nil {
		return err
	}
	if !has {
		return errors.NotFound(reason.ObjectNotFound)
	}
	if task.Status != entity.TaskStatusOpen || task.AssigneeID != "0" && task.AssigneeID != "" {
		return errors.BadRequest(reason.RequestFormatError)
	}
	_, err = s.data.DB.Context(ctx).ID(req.ID).Cols("assignee_id", "claimed_at", "status").Update(&entity.Task{
		AssigneeID: req.UserID,
		ClaimedAt:  time.Now(),
		Status:     entity.TaskStatusInProgress,
	})
	if err == nil {
		s.realtime.Broadcast(realtime.EventTasksChanged, map[string]any{"task_id": req.ID, "user_id": req.UserID})
	}
	return err
}

func (s *TaskSquareService) AssignTask(ctx context.Context, req *schema.TaskAssignReq) error {
	task := &entity.Task{ID: req.ID}
	has, err := s.data.DB.Context(ctx).Get(task)
	if err != nil {
		return err
	}
	if !has {
		return errors.NotFound(reason.ObjectNotFound)
	}
	if task.Status != entity.TaskStatusOpen && task.Status != entity.TaskStatusInProgress {
		return errors.BadRequest(reason.RequestFormatError)
	}
	_, err = s.data.DB.Context(ctx).ID(req.ID).Cols("assignee_id", "claimed_at", "status").Update(&entity.Task{
		AssigneeID: req.AssigneeID,
		ClaimedAt:  time.Now(),
		Status:     entity.TaskStatusInProgress,
	})
	if err == nil {
		s.realtime.Broadcast(realtime.EventTasksChanged, map[string]any{"task_id": req.ID, "user_id": req.AssigneeID})
	}
	return err
}

func (s *TaskSquareService) SubmitTask(ctx context.Context, req *schema.TaskSubmitReq) error {
	task := &entity.Task{ID: req.ID}
	has, err := s.data.DB.Context(ctx).Get(task)
	if err != nil {
		return err
	}
	if !has {
		return errors.NotFound(reason.ObjectNotFound)
	}
	if task.AssigneeID != req.UserID || task.Status != entity.TaskStatusInProgress {
		return errors.Forbidden(reason.ForbiddenError)
	}
	if !task.Deadline.IsZero() && time.Now().After(task.Deadline) {
		_, _ = s.data.DB.Context(ctx).ID(task.ID).Cols("status").Update(&entity.Task{Status: entity.TaskStatusFailed})
		return errors.BadRequest(reason.RequestFormatError)
	}
	session := s.data.DB.Context(ctx)
	if err := session.Begin(); err != nil {
		return err
	}
	submission := &entity.TaskSubmission{
		TaskID:      req.ID,
		UserID:      req.UserID,
		Content:     req.Content,
		Links:       encodeList(req.Links),
		Attachments: encodeList(req.Attachments),
		Status:      entity.TaskSubmissionStatusPending,
	}
	if _, err = session.Insert(submission); err != nil {
		_ = session.Rollback()
		return err
	}
	if _, err = session.ID(req.ID).Cols("status").Update(&entity.Task{Status: entity.TaskStatusSubmitted}); err != nil {
		_ = session.Rollback()
		return err
	}
	if err = session.Commit(); err != nil {
		return err
	}
	s.realtime.Broadcast(realtime.EventTasksChanged, map[string]any{"task_id": req.ID, "user_id": req.UserID})
	return nil
}

func (s *TaskSquareService) ReviewSubmission(ctx context.Context, req *schema.TaskSubmissionReviewReq) error {
	if req.SubmissionID <= 0 && req.TaskID <= 0 {
		return errors.BadRequest(reason.RequestFormatError)
	}
	var (
		sub  *entity.TaskSubmission
		task *entity.Task
		has  bool
		err  error
	)
	if req.SubmissionID > 0 {
		sub = &entity.TaskSubmission{ID: req.SubmissionID}
		has, err = s.data.DB.Context(ctx).Get(sub)
		if err != nil {
			return err
		}
		if !has {
			return errors.NotFound(reason.ObjectNotFound)
		}
		task = &entity.Task{ID: sub.TaskID}
	} else {
		task = &entity.Task{ID: req.TaskID}
	}
	has, err = s.data.DB.Context(ctx).Get(task)
	if err != nil {
		return err
	}
	if !has {
		return errors.NotFound(reason.ObjectNotFound)
	}
	if sub == nil {
		pendingSub := &entity.TaskSubmission{}
		has, err = s.data.DB.Context(ctx).
			Where("task_id = ? AND status = ?", task.ID, entity.TaskSubmissionStatusPending).
			Desc("id").Get(pendingSub)
		if err != nil {
			return err
		}
		if has {
			sub = pendingSub
		}
	}
	if task.Status != entity.TaskStatusSubmitted || sub != nil && sub.Status != entity.TaskSubmissionStatusPending {
		return errors.BadRequest(reason.RequestFormatError)
	}
	if req.Approved && (task.AssigneeID == "" || task.AssigneeID == "0") {
		return errors.BadRequest(reason.RequestFormatError)
	}
	session := s.data.DB.Context(ctx)
	if err = session.Begin(); err != nil {
		return err
	}
	if req.Approved {
		if sub != nil {
			if _, err = session.ID(sub.ID).Cols("status", "review_note", "reviewer_id").Update(&entity.TaskSubmission{
				Status:     entity.TaskSubmissionStatusApproved,
				ReviewNote: req.ReviewNote,
				ReviewerID: req.OperatorID,
			}); err != nil {
				_ = session.Rollback()
				return err
			}
		}
		if _, err = session.ID(task.ID).Cols("status", "completed_at").Update(&entity.Task{
			Status:      entity.TaskStatusCompleted,
			CompletedAt: time.Now(),
		}); err != nil {
			_ = session.Rollback()
			return err
		}
		if err = s.addPointsWithSession(ctx, session, task.AssigneeID, entity.PointSourceTaskReward, fmt.Sprintf("%d", task.ID), task.RewardPoints, "任务完成奖励："+task.Title, req.OperatorID); err != nil {
			_ = session.Rollback()
			return err
		}
	} else {
		if sub != nil {
			if _, err = session.ID(sub.ID).Cols("status", "review_note", "reviewer_id").Update(&entity.TaskSubmission{
				Status:     entity.TaskSubmissionStatusRejected,
				ReviewNote: req.ReviewNote,
				ReviewerID: req.OperatorID,
			}); err != nil {
				_ = session.Rollback()
				return err
			}
		}
		if _, err = session.ID(task.ID).Cols("status").Update(&entity.Task{Status: entity.TaskStatusInProgress}); err != nil {
			_ = session.Rollback()
			return err
		}
	}
	if err = session.Commit(); err != nil {
		return err
	}
	s.realtime.Broadcast(realtime.EventTasksChanged, map[string]any{"task_id": task.ID, "user_id": task.AssigneeID})
	if req.Approved {
		s.realtime.SendToUser(task.AssigneeID, realtime.EventPointsChanged, map[string]any{"source": entity.PointSourceTaskReward})
		s.realtime.Broadcast(realtime.EventAdminUsersChanged, map[string]any{"user_id": task.AssigneeID})
	}
	return nil
}

func (s *TaskSquareService) GetPointAccount(ctx context.Context, userID string) (*schema.PointAccountResp, error) {
	account, err := s.ensureAccount(ctx, userID)
	if err != nil {
		return nil, err
	}
	return &schema.PointAccountResp{Balance: account.Balance}, nil
}

func (s *TaskSquareService) ListPointTransactions(ctx context.Context, req *schema.PointTransactionReq) (*pager.PageModel, error) {
	req.Page, req.PageSize = pager.ValPageAndPageSize(req.Page, req.PageSize)
	items := make([]*entity.PointTransaction, 0)
	session := s.data.DB.Context(ctx).Where("user_id = ?", req.UserID).Desc("id")
	total, err := pager.Help(req.Page, req.PageSize, &items, &entity.PointTransaction{}, session)
	if err != nil {
		return nil, err
	}
	resp := make([]*schema.PointTransactionResp, 0, len(items))
	for _, item := range items {
		resp = append(resp, &schema.PointTransactionResp{
			ID: item.ID, CreatedAt: unixTime(item.CreatedAt), UserID: item.UserID, SourceType: item.SourceType,
			SourceID: item.SourceID, Delta: item.Delta, Balance: item.Balance, Description: item.Description, OperatorID: item.OperatorID,
		})
	}
	return pager.NewPageModel(total, resp), nil
}

func (s *TaskSquareService) FeaturePost(ctx context.Context, req *schema.FeaturedPostCreateReq) error {
	req.QuestionID = uid.DeShortID(req.QuestionID)
	question := &entity.Question{ID: req.QuestionID}
	has, err := s.data.DB.Context(ctx).Get(question)
	if err != nil {
		return err
	}
	if !has {
		return errors.NotFound(reason.QuestionNotFound)
	}
	exist, err := s.data.DB.Context(ctx).Where("question_id = ?", req.QuestionID).Exist(new(entity.FeaturedPost))
	if err != nil {
		return err
	}
	if exist {
		return errors.BadRequest(reason.DuplicateRequestError)
	}
	session := s.data.DB.Context(ctx)
	if err = session.Begin(); err != nil {
		return err
	}
	featured := &entity.FeaturedPost{
		QuestionID:   req.QuestionID,
		AuthorID:     question.UserID,
		OperatorID:   req.OperatorID,
		Title:        question.Title,
		RewardPoints: req.RewardPoints,
		Note:         req.Note,
		Active:       true,
		Revoked:      false,
	}
	if _, err = session.Insert(featured); err != nil {
		_ = session.Rollback()
		return err
	}
	tag, err := s.ensureFeaturedPostTagWithSession(ctx, session, req.OperatorID)
	if err != nil {
		_ = session.Rollback()
		return err
	}
	if err = s.ensureFeaturedPostTagRelWithSession(ctx, session, question, tag.ID); err != nil {
		_ = session.Rollback()
		return err
	}
	if err = s.addPointsWithSession(ctx, session, question.UserID, entity.PointSourceFeaturedPostReward, req.QuestionID, req.RewardPoints, "帖子精选奖励："+question.Title, req.OperatorID); err != nil {
		_ = session.Rollback()
		return err
	}
	if err = session.Commit(); err != nil {
		return err
	}
	s.realtime.Broadcast(realtime.EventQuestionFeatured, map[string]any{"question_id": req.QuestionID})
	s.realtime.Broadcast(realtime.EventFeaturedPostsChanged, map[string]any{"question_id": req.QuestionID})
	s.realtime.SendToUser(question.UserID, realtime.EventPointsChanged, map[string]any{
		"question_id": req.QuestionID,
		"source":      entity.PointSourceFeaturedPostReward,
	})
	s.realtime.Broadcast(realtime.EventAdminUsersChanged, map[string]any{"user_id": question.UserID})
	return nil
}

func (s *TaskSquareService) ListFeaturedPosts(ctx context.Context, req *schema.FeaturedPostListReq) (*pager.PageModel, error) {
	req.Page, req.PageSize = pager.ValPageAndPageSize(req.Page, req.PageSize)
	items := make([]*entity.FeaturedPost, 0)
	session := s.data.DB.Context(ctx).Desc("id")
	total, err := pager.Help(req.Page, req.PageSize, &items, &entity.FeaturedPost{}, session)
	if err != nil {
		return nil, err
	}
	resp := make([]*schema.FeaturedPostResp, 0, len(items))
	for _, item := range items {
		resp = append(resp, &schema.FeaturedPostResp{
			ID: item.ID, CreatedAt: unixTime(item.CreatedAt), QuestionID: item.QuestionID, AuthorID: item.AuthorID,
			AuthorName: s.userName(ctx, item.AuthorID), OperatorID: item.OperatorID, Title: item.Title,
			RewardPoints: item.RewardPoints, Note: item.Note, Active: item.Active, Revoked: item.Revoked, RevokedAt: unixTime(item.RevokedAt),
		})
	}
	return pager.NewPageModel(total, resp), nil
}

func (s *TaskSquareService) RevokeFeaturedPostReward(ctx context.Context, questionID, operatorID string) error {
	questionID = uid.DeShortID(questionID)
	featured := &entity.FeaturedPost{}
	has, err := s.data.DB.Context(ctx).Where("question_id = ? AND revoked = ?", questionID, false).Get(featured)
	if err != nil || !has {
		return err
	}
	session := s.data.DB.Context(ctx)
	if err = session.Begin(); err != nil {
		return err
	}
	now := time.Now()
	if _, err = session.ID(featured.ID).Cols("active", "revoked", "revoked_at").Update(&entity.FeaturedPost{
		Active: false, Revoked: true, RevokedAt: now,
	}); err != nil {
		_ = session.Rollback()
		return err
	}
	if err = s.addPointsWithSession(ctx, session, featured.AuthorID, entity.PointSourceFeaturedPostRevoke, featured.QuestionID, -featured.RewardPoints, "精选帖子删除，积分收回："+featured.Title, operatorID); err != nil {
		_ = session.Rollback()
		return err
	}
	if err = session.Commit(); err != nil {
		return err
	}
	s.realtime.Broadcast(realtime.EventQuestionFeatured, map[string]any{"question_id": featured.QuestionID, "revoked": true})
	s.realtime.Broadcast(realtime.EventFeaturedPostsChanged, map[string]any{"question_id": featured.QuestionID})
	s.realtime.SendToUser(featured.AuthorID, realtime.EventPointsChanged, map[string]any{
		"question_id": featured.QuestionID,
		"source":      entity.PointSourceFeaturedPostRevoke,
	})
	s.realtime.Broadcast(realtime.EventAdminUsersChanged, map[string]any{"user_id": featured.AuthorID})
	return nil
}

func (s *TaskSquareService) taskResp(ctx context.Context, task *entity.Task) *schema.TaskResp {
	resp := &schema.TaskResp{
		ID: task.ID, CreatedAt: unixTime(task.CreatedAt), UpdatedAt: unixTime(task.UpdatedAt), UserID: task.UserID,
		UserDisplayName: s.userName(ctx, task.UserID), ReviewerID: task.ReviewerID, AssigneeID: task.AssigneeID,
		AssigneeDisplayName: s.userName(ctx, task.AssigneeID), Title: task.Title, Description: task.Description,
		Tags: decodeList(task.Tags), RewardPoints: task.RewardPoints, Deadline: unixTime(task.Deadline),
		SubmissionRequirements: task.SubmissionRequirements, Attachments: decodeList(task.Attachments), Status: task.Status,
		ReviewComment: task.ReviewComment, ClaimedAt: unixTime(task.ClaimedAt), CompletedAt: unixTime(task.CompletedAt),
	}
	sub := &entity.TaskSubmission{}
	has, _ := s.data.DB.Context(ctx).Where("task_id = ?", task.ID).Desc("id").Get(sub)
	if has {
		resp.Submission = &schema.TaskSubmissionResp{
			ID: sub.ID, CreatedAt: unixTime(sub.CreatedAt), UpdatedAt: unixTime(sub.UpdatedAt), TaskID: sub.TaskID,
			UserID: sub.UserID, ReviewerID: sub.ReviewerID, Content: sub.Content, Links: decodeList(sub.Links),
			Attachments: decodeList(sub.Attachments), Status: sub.Status, ReviewNote: sub.ReviewNote,
		}
	}
	return resp
}

func (s *TaskSquareService) userName(ctx context.Context, userID string) string {
	if userID == "" || userID == "0" {
		return ""
	}
	user := &entity.User{ID: userID}
	has, err := s.data.DB.Context(ctx).Get(user)
	if err != nil || !has {
		return userID
	}
	if user.DisplayName != "" {
		return user.DisplayName
	}
	return user.Username
}

func (s *TaskSquareService) ensureAccount(ctx context.Context, userID string) (*entity.UserPointAccount, error) {
	account := &entity.UserPointAccount{UserID: userID}
	has, err := s.data.DB.Context(ctx).Get(account)
	if err != nil {
		return nil, err
	}
	if has {
		return account, nil
	}
	account.Balance = 0
	_, err = s.data.DB.Context(ctx).Insert(account)
	return account, err
}

func (s *TaskSquareService) ensureFeaturedPostTagWithSession(ctx context.Context, session *xorm.Session, operatorID string) (*entity.Tag, error) {
	tag := &entity.Tag{}
	has, err := session.Where("LOWER(slug_name) = ?", featuredPostTagSlugName).Get(tag)
	if err != nil {
		return nil, err
	}
	if has {
		updates := &entity.Tag{Reserved: true}
		cols := []string{"reserved"}
		if tag.Status == entity.TagStatusDeleted {
			updates.Status = entity.TagStatusAvailable
			cols = append(cols, "status")
		}
		if tag.DisplayName == "" {
			updates.DisplayName = featuredPostTagDisplayName
			cols = append(cols, "display_name")
		}
		if tag.OriginalText == "" {
			updates.OriginalText = featuredPostTagDescription
			updates.ParsedText = fmt.Sprintf("<p>%s</p>\n", featuredPostTagDescription)
			cols = append(cols, "original_text", "parsed_text")
		}
		if !tag.Reserved || tag.Status == entity.TagStatusDeleted || tag.DisplayName == "" || tag.OriginalText == "" {
			if _, err = session.ID(tag.ID).Cols(cols...).Update(updates); err != nil {
				return nil, err
			}
			tag.Reserved = true
			tag.Status = entity.TagStatusAvailable
			if tag.DisplayName == "" {
				tag.DisplayName = featuredPostTagDisplayName
			}
			if tag.OriginalText == "" {
				tag.OriginalText = featuredPostTagDescription
				tag.ParsedText = updates.ParsedText
			}
		}
		return tag, nil
	}

	tagID, err := s.uniqueIDRepo.GenUniqueIDStr(ctx, entity.Tag{}.TableName())
	if err != nil {
		return nil, err
	}
	tag = &entity.Tag{
		ID:           tagID,
		SlugName:     featuredPostTagSlugName,
		DisplayName:  featuredPostTagDisplayName,
		OriginalText: featuredPostTagDescription,
		ParsedText:   fmt.Sprintf("<p>%s</p>\n", featuredPostTagDescription),
		Status:       entity.TagStatusAvailable,
		Reserved:     true,
		RevisionID:   "0",
		UserID:       operatorID,
	}
	if _, err = session.Insert(tag); err != nil {
		return nil, err
	}
	return tag, nil
}

func (s *TaskSquareService) ensureFeaturedPostTagRelWithSession(ctx context.Context, session *xorm.Session, question *entity.Question, tagID string) error {
	status := entity.TagRelStatusAvailable
	if question.Show == entity.QuestionHide || question.Status == entity.QuestionStatusDeleted {
		status = entity.TagRelStatusHide
	}
	rel := &entity.TagRel{}
	has, err := session.Where("object_id = ? AND tag_id = ?", question.ID, tagID).Get(rel)
	if err != nil {
		return err
	}
	if has {
		if rel.Status != entity.TagRelStatusAvailable && rel.Status != entity.TagRelStatusHide {
			if _, err = session.ID(rel.ID).Cols("status").Update(&entity.TagRel{Status: status}); err != nil {
				return err
			}
		}
		return s.refreshFeaturedPostTagCountWithSession(session, tagID)
	}
	if _, err = session.Insert(&entity.TagRel{ObjectID: question.ID, TagID: tagID, Status: status}); err != nil {
		lowerErr := strings.ToLower(err.Error())
		if strings.Contains(lowerErr, "duplicate") || strings.Contains(lowerErr, "unique") {
			return s.refreshFeaturedPostTagCountWithSession(session, tagID)
		}
		return err
	}
	return s.refreshFeaturedPostTagCountWithSession(session, tagID)
}

func (s *TaskSquareService) refreshFeaturedPostTagCountWithSession(session *xorm.Session, tagID string) error {
	count, err := session.Count(&entity.TagRel{TagID: tagID, Status: entity.TagRelStatusAvailable})
	if err != nil {
		return err
	}
	_, err = session.ID(tagID).Cols("question_count").Update(&entity.Tag{QuestionCount: int(count)})
	return err
}

func (s *TaskSquareService) addPointsWithSession(ctx context.Context, session *xorm.Session, userID, sourceType, sourceID string, delta int, description, operatorID string) error {
	if delta == 0 {
		return nil
	}
	exist, err := session.Where("user_id = ? AND source_type = ? AND source_id = ?", userID, sourceType, sourceID).Exist(new(entity.PointTransaction))
	if err != nil {
		return err
	}
	if exist && sourceType != entity.PointSourceFeaturedPostRevoke {
		return nil
	}
	account := &entity.UserPointAccount{UserID: userID}
	has, err := session.Get(account)
	if err != nil {
		return err
	}
	if !has {
		account.Balance = 0
		if _, err = session.Insert(account); err != nil {
			return err
		}
	}
	nextBalance := account.Balance + delta
	if _, err = session.ID(userID).Cols("balance").Update(&entity.UserPointAccount{Balance: nextBalance}); err != nil {
		return err
	}
	_, err = session.Insert(&entity.PointTransaction{
		UserID: userID, SourceType: sourceType, SourceID: sourceID, Delta: delta,
		Balance: nextBalance, Description: description, OperatorID: operatorID,
	})
	return err
}
