package task_square

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
	"github.com/apache/answer/internal/service/export"
	"github.com/apache/answer/internal/service/realtime"
	"github.com/apache/answer/internal/service/role"
	"github.com/apache/answer/internal/service/siteinfo_common"
	"github.com/apache/answer/internal/service/unique"
	usernotificationconfig "github.com/apache/answer/internal/service/user_notification_config"
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
	data                       *data.Data
	uniqueIDRepo               unique.UniqueIDRepo
	realtime                   *realtime.Service
	siteInfoService            siteinfo_common.SiteInfoCommonService
	userRoleService            *role.UserRoleRelService
	emailService               *export.EmailService
	userNotificationConfigRepo usernotificationconfig.UserNotificationConfigRepo
}

func NewTaskSquareService(
	data *data.Data,
	uniqueIDRepo unique.UniqueIDRepo,
	realtime *realtime.Service,
	siteInfoService siteinfo_common.SiteInfoCommonService,
	userRoleService *role.UserRoleRelService,
	emailService *export.EmailService,
	userNotificationConfigRepo usernotificationconfig.UserNotificationConfigRepo,
) *TaskSquareService {
	return &TaskSquareService{
		data:                       data,
		uniqueIDRepo:               uniqueIDRepo,
		realtime:                   realtime,
		siteInfoService:            siteInfoService,
		userRoleService:            userRoleService,
		emailService:               emailService,
		userNotificationConfigRepo: userNotificationConfigRepo,
	}
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
	cols := []string{"user_id", "title", "description", "attachments", "status"}
	var deadline time.Time
	tags := []string{}
	rewardPoints := 0
	submissionRequirements := ""
	reviewComment := ""
	reviewerID := ""
	if req.IsAdminModerator {
		status = entity.TaskStatusOpen
		cols = append(cols,
			"tags", "reward_points", "deadline", "submission_requirements", "review_comment", "reviewer_id",
		)
		tags = req.Tags
		rewardPoints = req.RewardPoints
		submissionRequirements = req.SubmissionRequirements
		reviewComment = req.ReviewComment
		reviewerID = req.UserID
		if req.Deadline > 0 {
			deadline = time.Unix(req.Deadline, 0)
		}
	}
	task := &entity.Task{
		UserID:                 req.UserID,
		ReviewerID:             reviewerID,
		Title:                  req.Title,
		Description:            req.Description,
		Tags:                   encodeList(tags),
		RewardPoints:           rewardPoints,
		Deadline:               deadline,
		SubmissionRequirements: submissionRequirements,
		Attachments:            encodeList(req.Attachments),
		Status:                 status,
		ReviewComment:          reviewComment,
	}
	_, err := s.data.DB.Context(ctx).
		Cols(cols...).
		Insert(task)
	if err == nil {
		s.publishTaskChanged(task, req.UserID)
		if !req.IsAdminModerator {
			s.notifyAdminsTaskSubmitted(ctx, task, req.UserID)
		}
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
		taskResp, err := s.taskResp(ctx, task, req.UserID, req.IsAdmin || req.IsAdminModerator)
		if err != nil {
			return nil, err
		}
		resp = append(resp, taskResp)
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
	return s.taskResp(ctx, task, userID, isAdmin)
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
		task.Status = req.Status
		task.AssigneeID = ""
		s.publishTaskChanged(task, task.UserID)
		s.notifyTaskReviewed(ctx, task, req.OperatorID)
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
	affected, err := s.data.DB.Context(ctx).
		Where("id = ? AND status = ? AND (assignee_id = '' OR assignee_id = '0')", req.ID, entity.TaskStatusOpen).
		Cols("assignee_id", "claimed_at", "status").
		Update(&entity.Task{
			AssigneeID: req.UserID,
			ClaimedAt:  time.Now(),
			Status:     entity.TaskStatusInProgress,
		})
	if err != nil {
		return err
	}
	if affected == 0 {
		return errors.BadRequest(reason.RequestFormatError)
	}
	task.AssigneeID = req.UserID
	task.Status = entity.TaskStatusInProgress
	s.publishTaskChanged(task, req.UserID)
	s.notifyTaskClaimed(ctx, task, req.UserID)
	return nil
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
	affected, err := s.data.DB.Context(ctx).
		Where("id = ? AND status IN (?, ?)", req.ID, entity.TaskStatusOpen, entity.TaskStatusInProgress).
		Cols("assignee_id", "claimed_at", "status").
		Update(&entity.Task{
			AssigneeID: req.AssigneeID,
			ClaimedAt:  time.Now(),
			Status:     entity.TaskStatusInProgress,
		})
	if err != nil {
		return err
	}
	if affected == 0 {
		return errors.BadRequest(reason.RequestFormatError)
	}
	task.AssigneeID = req.AssigneeID
	task.Status = entity.TaskStatusInProgress
	s.publishTaskChanged(task, req.AssigneeID)
	s.notifyTaskClaimed(ctx, task, req.OperatorID)
	return nil
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
		_, _ = s.data.DB.Context(ctx).
			Where("id = ? AND status = ?", task.ID, entity.TaskStatusInProgress).
			Cols("status").
			Update(&entity.Task{Status: entity.TaskStatusFailed})
		return errors.BadRequest(reason.RequestFormatError)
	}
	session := s.data.DB.Context(ctx)
	if err := session.Begin(); err != nil {
		return err
	}
	affected, err := session.
		Table(new(entity.Task)).
		Where("id = ? AND assignee_id = ? AND status = ?", req.ID, req.UserID, entity.TaskStatusInProgress).
		Update(map[string]any{"status": entity.TaskStatusSubmitted})
	if err != nil {
		_ = session.Rollback()
		return err
	}
	if affected == 0 {
		_ = session.Rollback()
		return errors.BadRequest(reason.RequestFormatError)
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
	if err = session.Commit(); err != nil {
		return err
	}
	task.Status = entity.TaskStatusSubmitted
	s.publishTaskChanged(task, req.UserID)
	s.notifyTaskSubmittedForAcceptance(ctx, task, req.UserID)
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
			affected, err := session.
				Where("id = ? AND status = ?", sub.ID, entity.TaskSubmissionStatusPending).
				Cols("status", "review_note", "reviewer_id").
				Update(&entity.TaskSubmission{
					Status:     entity.TaskSubmissionStatusApproved,
					ReviewNote: req.ReviewNote,
					ReviewerID: req.OperatorID,
				})
			if err != nil {
				_ = session.Rollback()
				return err
			}
			if affected == 0 {
				_ = session.Rollback()
				return errors.BadRequest(reason.RequestFormatError)
			}
		}
		affected, err := session.
			Where("id = ? AND status = ?", task.ID, entity.TaskStatusSubmitted).
			Cols("status", "completed_at").
			Update(&entity.Task{
				Status:      entity.TaskStatusCompleted,
				CompletedAt: time.Now(),
			})
		if err != nil {
			_ = session.Rollback()
			return err
		}
		if affected == 0 {
			_ = session.Rollback()
			return errors.BadRequest(reason.RequestFormatError)
		}
		if err = s.addPointsWithSession(ctx, session, task.AssigneeID, entity.PointSourceTaskReward, fmt.Sprintf("%d", task.ID), task.RewardPoints, "任务完成奖励："+task.Title, req.OperatorID); err != nil {
			_ = session.Rollback()
			return err
		}
	} else {
		if sub != nil {
			affected, err := session.
				Where("id = ? AND status = ?", sub.ID, entity.TaskSubmissionStatusPending).
				Cols("status", "review_note", "reviewer_id").
				Update(&entity.TaskSubmission{
					Status:     entity.TaskSubmissionStatusRejected,
					ReviewNote: req.ReviewNote,
					ReviewerID: req.OperatorID,
				})
			if err != nil {
				_ = session.Rollback()
				return err
			}
			if affected == 0 {
				_ = session.Rollback()
				return errors.BadRequest(reason.RequestFormatError)
			}
		}
		affected, err := session.
			Where("id = ? AND status = ?", task.ID, entity.TaskStatusSubmitted).
			Cols("status").
			Update(&entity.Task{Status: entity.TaskStatusInProgress})
		if err != nil {
			_ = session.Rollback()
			return err
		}
		if affected == 0 {
			_ = session.Rollback()
			return errors.BadRequest(reason.RequestFormatError)
		}
	}
	if err = session.Commit(); err != nil {
		return err
	}
	if req.Approved {
		task.Status = entity.TaskStatusCompleted
	} else {
		task.Status = entity.TaskStatusInProgress
	}
	s.publishTaskChanged(task, task.AssigneeID)
	s.notifyTaskAcceptanceReviewed(ctx, task, req.OperatorID, req.ReviewNote, req.Approved)
	if req.Approved {
		s.sendToUser(task.AssigneeID, realtime.EventPointsChanged, map[string]any{"source": entity.PointSourceTaskReward})
		s.broadcastToAdmins(realtime.EventAdminUsersChanged, map[string]any{"user_id": task.AssigneeID})
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

func (s *TaskSquareService) ListPointRanking(ctx context.Context) ([]*schema.PointRankingResp, error) {
	accounts := make([]*entity.UserPointAccount, 0)
	if err := s.data.DB.Context(ctx).Find(&accounts); err != nil {
		return nil, err
	}
	balanceByUserID := make(map[string]int, len(accounts))
	for _, account := range accounts {
		balanceByUserID[account.UserID] = account.Balance
	}
	users := make([]*entity.User, 0)
	if err := s.data.DB.Context(ctx).
		Where("status != ?", entity.UserStatusDeleted).
		Find(&users); err != nil {
		return nil, err
	}
	sort.SliceStable(users, func(i, j int) bool {
		leftBalance := balanceByUserID[users[i].ID]
		rightBalance := balanceByUserID[users[j].ID]
		if leftBalance != rightBalance {
			return leftBalance > rightBalance
		}
		if users[i].Rank != users[j].Rank {
			return users[i].Rank > users[j].Rank
		}
		return users[i].ID < users[j].ID
	})
	if len(users) > 50 {
		users = users[:50]
	}
	avatarMapping := s.formatAvatarMapping(ctx, users)
	resp := make([]*schema.PointRankingResp, 0, len(users))
	for _, user := range users {
		resp = append(resp, &schema.PointRankingResp{
			UserID:      user.ID,
			Username:    user.Username,
			DisplayName: user.DisplayName,
			Avatar:      avatarMapping[user.ID],
			Balance:     balanceByUserID[user.ID],
		})
	}
	return resp, nil
}

func (s *TaskSquareService) ListContributionRanking(ctx context.Context) ([]*schema.UserRankingSimpleInfo, error) {
	users := make([]*entity.User, 0)
	if err := s.data.DB.Context(ctx).
		Where("status != ?", entity.UserStatusDeleted).
		Desc("rank").
		Asc("id").
		Limit(50).
		Find(&users); err != nil {
		return nil, err
	}
	avatarMapping := s.formatAvatarMapping(ctx, users)
	resp := make([]*schema.UserRankingSimpleInfo, 0, len(users))
	for _, user := range users {
		resp = append(resp, &schema.UserRankingSimpleInfo{
			Username:    user.Username,
			Rank:        user.Rank,
			DisplayName: user.DisplayName,
			Avatar:      avatarMapping[user.ID],
		})
	}
	return resp, nil
}

func (s *TaskSquareService) formatAvatarMapping(ctx context.Context, users []*entity.User) map[string]string {
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
	if !canFeatureQuestion(question) {
		return errors.BadRequest(reason.RequestFormatError)
	}
	session := s.data.DB.NewSession()
	defer session.Close()
	session.Context(ctx)
	if err = session.Begin(); err != nil {
		return err
	}
	exist, err := session.Where("question_id = ? AND active = ? AND revoked = ?", req.QuestionID, true, false).Exist(new(entity.FeaturedPost))
	if err != nil {
		_ = session.Rollback()
		return err
	}
	if exist {
		_ = session.Rollback()
		return errors.BadRequest(reason.DuplicateRequestError)
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
	rewardSourceID := fmt.Sprintf("%d", featured.ID)
	tag, err := s.ensureFeaturedPostTagWithSession(ctx, session, req.OperatorID)
	if err != nil {
		_ = session.Rollback()
		return err
	}
	if err = s.ensureFeaturedPostTagRelWithSession(ctx, session, question, tag.ID); err != nil {
		_ = session.Rollback()
		return err
	}
	if err = s.addPointsWithSession(ctx, session, question.UserID, entity.PointSourceFeaturedPostReward, rewardSourceID, req.RewardPoints, "帖子精选奖励："+question.Title, req.OperatorID); err != nil {
		_ = session.Rollback()
		return err
	}
	if err = session.Commit(); err != nil {
		return err
	}
	s.broadcast(realtime.EventQuestionFeatured, map[string]any{"question_id": req.QuestionID})
	s.broadcastToAdmins(realtime.EventFeaturedPostsChanged, map[string]any{"question_id": req.QuestionID})
	s.sendToUser(question.UserID, realtime.EventPointsChanged, map[string]any{
		"question_id": req.QuestionID,
		"source":      entity.PointSourceFeaturedPostReward,
	})
	s.broadcastToAdmins(realtime.EventAdminUsersChanged, map[string]any{"user_id": question.UserID})
	return nil
}

func canFeatureQuestion(question *entity.Question) bool {
	return question != nil &&
		question.Show == entity.QuestionShow &&
		(question.Status == entity.QuestionStatusAvailable || question.Status == entity.QuestionStatusClosed)
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
	return s.revokeFeaturedPostReward(ctx, questionID, operatorID, false)
}

func (s *TaskSquareService) RevokeFeaturedPostRewardIfExists(ctx context.Context, questionID, operatorID string) error {
	return s.revokeFeaturedPostReward(ctx, questionID, operatorID, true)
}

func (s *TaskSquareService) revokeFeaturedPostReward(ctx context.Context, questionID, operatorID string, ignoreMissing bool) error {
	questionID = uid.DeShortID(questionID)
	featured := &entity.FeaturedPost{}
	has, err := s.data.DB.Context(ctx).Where("question_id = ? AND active = ? AND revoked = ?", questionID, true, false).Get(featured)
	if err != nil {
		return err
	}
	if !has {
		if ignoreMissing {
			return nil
		}
		return errors.NotFound(reason.ObjectNotFound)
	}
	session := s.data.DB.NewSession()
	defer session.Close()
	session.Context(ctx)
	if err = session.Begin(); err != nil {
		return err
	}
	now := time.Now()
	affected, err := session.Table(new(entity.FeaturedPost)).
		Where("id = ? AND revoked = ?", featured.ID, false).
		Update(map[string]any{
			"active":     false,
			"revoked":    true,
			"revoked_at": now,
		})
	if err != nil {
		_ = session.Rollback()
		return err
	}
	if affected == 0 {
		_ = session.Rollback()
		return errors.BadRequest(reason.RequestFormatError)
	}
	if err = s.hideFeaturedPostTagRelWithSession(session, featured.QuestionID); err != nil {
		_ = session.Rollback()
		return err
	}
	revokeSourceID := fmt.Sprintf("%d", featured.ID)
	if err = s.addPointsWithSession(ctx, session, featured.AuthorID, entity.PointSourceFeaturedPostRevoke, revokeSourceID, -featured.RewardPoints, "精选帖子删除，积分收回："+featured.Title, operatorID); err != nil {
		_ = session.Rollback()
		return err
	}
	if err = session.Commit(); err != nil {
		return err
	}
	s.broadcast(realtime.EventQuestionFeatured, map[string]any{"question_id": featured.QuestionID, "revoked": true})
	s.broadcastToAdmins(realtime.EventFeaturedPostsChanged, map[string]any{"question_id": featured.QuestionID})
	s.sendToUser(featured.AuthorID, realtime.EventPointsChanged, map[string]any{
		"question_id": featured.QuestionID,
		"source":      entity.PointSourceFeaturedPostRevoke,
	})
	s.broadcastToAdmins(realtime.EventAdminUsersChanged, map[string]any{"user_id": featured.AuthorID})
	return nil
}

func (s *TaskSquareService) canViewTaskPrivateFields(task *entity.Task, userID string, isAdmin bool) bool {
	return isAdmin ||
		(task != nil && task.UserID != "" && task.UserID == userID) ||
		(task != nil && task.AssigneeID != "" && task.AssigneeID != "0" && task.AssigneeID == userID)
}

func (s *TaskSquareService) taskResp(ctx context.Context, task *entity.Task, userID string, isAdmin bool) (*schema.TaskResp, error) {
	canViewPrivateFields := s.canViewTaskPrivateFields(task, userID, isAdmin)
	resp := &schema.TaskResp{
		ID: task.ID, CreatedAt: unixTime(task.CreatedAt), UpdatedAt: unixTime(task.UpdatedAt), UserID: task.UserID,
		UserDisplayName:     s.userName(ctx, task.UserID),
		ReviewerID:          task.ReviewerID,
		ReviewerDisplayName: s.userName(ctx, task.ReviewerID),
		AssigneeID:          task.AssigneeID,
		AssigneeDisplayName: s.userName(ctx, task.AssigneeID), Title: task.Title, Description: task.Description,
		Tags: decodeList(task.Tags), RewardPoints: task.RewardPoints, Deadline: unixTime(task.Deadline),
		SubmissionRequirements: task.SubmissionRequirements, Attachments: decodeList(task.Attachments), Status: task.Status,
		ReviewComment: task.ReviewComment, ClaimedAt: unixTime(task.ClaimedAt), CompletedAt: unixTime(task.CompletedAt),
		CanViewPrivateFields: canViewPrivateFields,
	}
	if !canViewPrivateFields {
		resp.Description = ""
		resp.SubmissionRequirements = ""
		resp.Attachments = []string{}
	}
	sub := &entity.TaskSubmission{}
	has, err := s.data.DB.Context(ctx).Where("task_id = ?", task.ID).Desc("id").Get(sub)
	if err != nil {
		return nil, err
	}
	if has && canViewPrivateFields {
		resp.Submission = &schema.TaskSubmissionResp{
			ID: sub.ID, CreatedAt: unixTime(sub.CreatedAt), UpdatedAt: unixTime(sub.UpdatedAt), TaskID: sub.TaskID,
			UserID: sub.UserID, ReviewerID: sub.ReviewerID, Content: sub.Content, Links: decodeList(sub.Links),
			Attachments: decodeList(sub.Attachments), Status: sub.Status, ReviewNote: sub.ReviewNote,
		}
	}
	return resp, nil
}

func (s *TaskSquareService) broadcast(eventType string, data map[string]any) {
	if s.realtime == nil {
		return
	}
	s.realtime.Broadcast(eventType, data)
}

func (s *TaskSquareService) broadcastToAdmins(eventType string, data map[string]any) {
	if s.realtime == nil {
		return
	}
	s.realtime.BroadcastToAdmins(eventType, data)
}

func (s *TaskSquareService) sendToUser(userID, eventType string, data map[string]any) {
	if s.realtime == nil {
		return
	}
	s.realtime.SendToUser(userID, eventType, data)
}

func (s *TaskSquareService) publishTaskChanged(task *entity.Task, actorUserID string) {
	if task == nil || s.realtime == nil {
		return
	}
	data := map[string]any{"task_id": task.ID}
	if actorUserID != "" && actorUserID != "0" {
		data["user_id"] = actorUserID
	}
	if task.UserID != "" && task.UserID != "0" {
		data["owner_id"] = task.UserID
	}
	if task.AssigneeID != "" && task.AssigneeID != "0" {
		data["assignee_id"] = task.AssigneeID
	}
	if task.Status != "" {
		data["status"] = task.Status
	}

	if isPublicTaskStatus(task.Status) {
		s.broadcast(realtime.EventTasksChanged, data)
		return
	}
	s.sendToUser(task.UserID, realtime.EventTasksChanged, data)
	if task.AssigneeID != "" && task.AssigneeID != "0" && task.AssigneeID != task.UserID {
		s.sendToUser(task.AssigneeID, realtime.EventTasksChanged, data)
	}
	s.broadcastToAdmins(realtime.EventTasksChanged, data)
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
		if rel.Status != status {
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

func (s *TaskSquareService) hideFeaturedPostTagRelWithSession(session *xorm.Session, questionID string) error {
	tag := &entity.Tag{}
	has, err := session.Where("LOWER(slug_name) = ?", featuredPostTagSlugName).Get(tag)
	if err != nil {
		return err
	}
	if !has {
		return nil
	}
	_, err = session.
		Where("object_id = ? AND tag_id = ? AND status = ?", questionID, tag.ID, entity.TagRelStatusAvailable).
		Cols("status").
		Update(&entity.TagRel{Status: entity.TagRelStatusHide})
	if err != nil {
		return err
	}
	return s.refreshFeaturedPostTagCountWithSession(session, tag.ID)
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
		if _, err = session.Insert(account); err != nil && !isDuplicateKeyError(err) {
			return err
		}
		if isDuplicateKeyError(err) {
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
		Balance: updated.Balance, Description: description, OperatorID: operatorID,
	})
	if isDuplicateKeyError(err) {
		return err
	}
	return err
}

func isDuplicateKeyError(err error) bool {
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
