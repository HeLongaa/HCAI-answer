package task_square

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/segmentfault/pacman/i18n"
	"github.com/segmentfault/pacman/log"

	"github.com/apache/answer/internal/base/constant"
	"github.com/apache/answer/internal/base/handler"
	"github.com/apache/answer/internal/base/translator"
	"github.com/apache/answer/internal/entity"
	"github.com/apache/answer/internal/schema"
	"github.com/apache/answer/internal/service/role"
)

type taskNotificationKind string

const (
	taskNotificationSubmittedForReview     taskNotificationKind = "submitted_for_review"
	taskNotificationReviewApproved         taskNotificationKind = "review_approved"
	taskNotificationReviewRejected         taskNotificationKind = "review_rejected"
	taskNotificationClaimed                taskNotificationKind = "claimed"
	taskNotificationClaimedAdmin           taskNotificationKind = "claimed_admin"
	taskNotificationSubmittedForAcceptance taskNotificationKind = "submitted_for_acceptance"
	taskNotificationAcceptanceApproved     taskNotificationKind = "acceptance_approved"
	taskNotificationAcceptanceRejected     taskNotificationKind = "acceptance_rejected"
)

var taskNotificationActions = map[taskNotificationKind]string{
	taskNotificationSubmittedForReview:     constant.NotificationTaskSubmittedForReview,
	taskNotificationReviewApproved:         constant.NotificationTaskReviewApproved,
	taskNotificationReviewRejected:         constant.NotificationTaskReviewRejected,
	taskNotificationClaimed:                constant.NotificationTaskClaimed,
	taskNotificationClaimedAdmin:           constant.NotificationTaskClaimedAdmin,
	taskNotificationSubmittedForAcceptance: constant.NotificationTaskSubmittedForAcceptance,
	taskNotificationAcceptanceApproved:     constant.NotificationTaskAcceptanceApproved,
	taskNotificationAcceptanceRejected:     constant.NotificationTaskAcceptanceRejected,
}

var taskNotificationActionTitles = map[taskNotificationKind]string{
	taskNotificationSubmittedForReview:     "有新的任务需求待审核",
	taskNotificationReviewApproved:         "你的任务需求已通过审核",
	taskNotificationReviewRejected:         "你的任务需求未通过审核",
	taskNotificationClaimed:                "你的任务已被领取",
	taskNotificationClaimedAdmin:           "任务已被领取",
	taskNotificationSubmittedForAcceptance: "任务已提交验收",
	taskNotificationAcceptanceApproved:     "你的任务验收已通过",
	taskNotificationAcceptanceRejected:     "你的任务验收被退回",
}

func (s *TaskSquareService) notifyAdminsTaskSubmitted(ctx context.Context, task *entity.Task, actorUserID string) {
	s.notifyTaskAdmins(ctx, task, actorUserID, taskNotificationSubmittedForReview, false, "")
}

func (s *TaskSquareService) notifyTaskReviewed(ctx context.Context, task *entity.Task, operatorID string) {
	kind := taskNotificationReviewRejected
	if task.Status == entity.TaskStatusOpen {
		kind = taskNotificationReviewApproved
	}
	s.notifyTaskUser(ctx, task, task.UserID, operatorID, kind, true, task.ReviewComment)
}

func (s *TaskSquareService) notifyTaskClaimed(ctx context.Context, task *entity.Task, actorUserID string) {
	s.notifyTaskUser(ctx, task, task.UserID, actorUserID, taskNotificationClaimed, true, "")
	s.notifyTaskAdmins(ctx, task, actorUserID, taskNotificationClaimedAdmin, false, "")
}

func (s *TaskSquareService) notifyTaskSubmittedForAcceptance(ctx context.Context, task *entity.Task, actorUserID string) {
	s.notifyTaskAdmins(ctx, task, actorUserID, taskNotificationSubmittedForAcceptance, true, "")
}

func (s *TaskSquareService) notifyTaskAcceptanceReviewed(ctx context.Context, task *entity.Task, operatorID, reviewNote string, approved bool) {
	kind := taskNotificationAcceptanceRejected
	if approved {
		kind = taskNotificationAcceptanceApproved
	}
	s.notifyTaskUser(ctx, task, task.AssigneeID, operatorID, kind, true, reviewNote)
}

func (s *TaskSquareService) notifyTaskAdmins(
	ctx context.Context,
	task *entity.Task,
	actorUserID string,
	kind taskNotificationKind,
	sendEmail bool,
	summary string,
) {
	for _, admin := range s.taskAdminUsers(ctx) {
		if admin.ID == actorUserID && kind == taskNotificationClaimedAdmin {
			continue
		}
		s.notifyTaskUser(ctx, task, admin.ID, actorUserID, kind, sendEmail, summary)
	}
}

func (s *TaskSquareService) notifyTaskUser(
	ctx context.Context,
	task *entity.Task,
	receiverUserID string,
	actorUserID string,
	kind taskNotificationKind,
	sendEmail bool,
	summary string,
) {
	if task == nil || receiverUserID == "" || receiverUserID == "0" {
		return
	}
	action := taskNotificationActions[kind]
	if action == "" {
		return
	}
	if err := s.addTaskInboxNotification(ctx, task, receiverUserID, actorUserID, action); err != nil {
		log.Errorf("add task notification failed task_id=%d receiver=%s action=%s err=%v", task.ID, receiverUserID, action, err)
	}
	if sendEmail {
		go s.sendTaskNotificationEmail(ctx, task, receiverUserID, kind, summary)
	}
}

func (s *TaskSquareService) addTaskInboxNotification(
	ctx context.Context,
	task *entity.Task,
	receiverUserID string,
	actorUserID string,
	action string,
) error {
	now := time.Now()
	content := &schema.NotificationContent{
		TriggerUserID:  actorUserID,
		ReceiverUserID: receiverUserID,
		ObjectInfo: schema.ObjectInfo{
			Title:      task.Title,
			ObjectID:   fmt.Sprintf("%d", task.ID),
			ObjectType: constant.TaskObjectType,
			ObjectMap: map[string]string{
				"task": fmt.Sprintf("%d", task.ID),
			},
		},
		NotificationAction: action,
		Type:               schema.NotificationTypeInbox,
	}
	if actorUserID == "" || actorUserID == "0" {
		content.UserInfo = &schema.UserBasicInfo{DisplayName: "System", Status: constant.UserNormal}
	} else if user := s.taskUser(ctx, actorUserID); user != nil {
		content.UserInfo = &schema.UserBasicInfo{
			ID:             user.ID,
			Username:       user.Username,
			Rank:           user.Rank,
			DisplayName:    user.DisplayName,
			Avatar:         user.Avatar,
			Website:        user.Website,
			Location:       user.Location,
			Language:       user.Language,
			Status:         constant.ConvertUserStatus(user.Status, user.MailStatus),
			SuspendedUntil: unixTime(user.SuspendedUntil),
		}
	}
	contentJSON, _ := json.Marshal(content)
	notification := &entity.Notification{
		UserID:    receiverUserID,
		ObjectID:  fmt.Sprintf("%d", task.ID),
		Content:   string(contentJSON),
		Type:      schema.NotificationTypeInbox,
		MsgType:   schema.NotificationInboxTypePosts,
		IsRead:    schema.NotificationNotRead,
		Status:    schema.NotificationStatusNormal,
		CreatedAt: now,
		UpdatedAt: now,
	}
	if _, err := s.data.DB.Context(ctx).Insert(notification); err != nil {
		return err
	}
	return s.addTaskNotificationRedDot(ctx, receiverUserID)
}

func (s *TaskSquareService) addTaskNotificationRedDot(ctx context.Context, userID string) error {
	if s.data == nil || s.data.Cache == nil {
		return nil
	}
	key := fmt.Sprintf(constant.RedDotCacheKey, constant.NotificationTypeInbox, userID)
	_, exist, err := s.data.Cache.GetInt64(ctx, key)
	if err != nil {
		return err
	}
	if exist {
		_, err = s.data.Cache.Increase(ctx, key, 1)
		return err
	}
	return s.data.Cache.SetInt64(ctx, key, 1, constant.RedDotCacheTime)
}

func (s *TaskSquareService) sendTaskNotificationEmail(
	ctx context.Context,
	task *entity.Task,
	receiverUserID string,
	kind taskNotificationKind,
	summary string,
) {
	if s.emailService == nil {
		return
	}
	receiver := s.taskUser(ctx, receiverUserID)
	if receiver == nil || receiver.Status != entity.UserStatusAvailable || receiver.EMail == "" {
		return
	}
	if !s.shouldSendTaskNotificationEmail(ctx, receiverUserID) {
		return
	}
	emailCtx := ctx
	if receiver.Language != "" {
		emailCtx = context.WithValue(ctx, constant.AcceptLanguageContextKey, i18n.Language(receiver.Language))
	}
	actionTitle := s.taskNotificationActionTitle(emailCtx, kind)
	if strings.TrimSpace(summary) == "" {
		summary = actionTitle
	}
	title, body, err := s.emailService.TaskNotificationTemplate(emailCtx, &schema.TaskNotificationTemplateRawData{
		ActionTitle: actionTitle,
		TaskTitle:   task.Title,
		TaskURL:     s.taskURL(ctx, task.ID),
		Summary:     summary,
	})
	if err != nil {
		log.Errorf("build task notification email failed task_id=%d receiver=%s err=%v", task.ID, receiverUserID, err)
		return
	}
	s.emailService.Send(emailCtx, receiver.EMail, title, body)
}

func (s *TaskSquareService) shouldSendTaskNotificationEmail(ctx context.Context, receiverUserID string) bool {
	if s.userNotificationConfigRepo == nil {
		return true
	}
	config, exist, err := s.userNotificationConfigRepo.GetByUserIDAndSource(ctx, receiverUserID, constant.InboxSource)
	if err != nil {
		log.Errorf("get task notification email config failed receiver=%s err=%v", receiverUserID, err)
		return false
	}
	if !exist || !config.Enabled {
		return false
	}
	for _, channel := range schema.NewNotificationChannelsFormJson(config.Channels) {
		if channel.Enable && channel.Key == constant.EmailChannel {
			return true
		}
	}
	return false
}

func (s *TaskSquareService) taskNotificationActionTitle(ctx context.Context, kind taskNotificationKind) string {
	action := taskNotificationActions[kind]
	if action != "" {
		title := translator.Tr(handler.GetLangByCtx(ctx), action)
		if title != "" && title != action {
			return title
		}
	}
	return taskNotificationActionTitles[kind]
}

func (s *TaskSquareService) taskURL(ctx context.Context, taskID int) string {
	path := fmt.Sprintf("/tasks/%d", taskID)
	if s.siteInfoService == nil {
		return path
	}
	siteInfo, err := s.siteInfoService.GetSiteGeneral(ctx)
	if err != nil || siteInfo == nil || siteInfo.SiteUrl == "" {
		return path
	}
	return strings.TrimRight(siteInfo.SiteUrl, "/") + path
}

func (s *TaskSquareService) taskAdminUsers(ctx context.Context) []*entity.User {
	if s.userRoleService == nil {
		return nil
	}
	rels, err := s.userRoleService.GetUserByRoleID(ctx, []int{role.RoleAdminID, role.RoleModeratorID})
	if err != nil {
		log.Errorf("get task admin users failed: %v", err)
		return nil
	}
	userIDs := make([]string, 0, len(rels))
	seen := make(map[string]bool, len(rels))
	for _, rel := range rels {
		if rel.UserID == "" || rel.UserID == "0" || seen[rel.UserID] {
			continue
		}
		seen[rel.UserID] = true
		userIDs = append(userIDs, rel.UserID)
	}
	if len(userIDs) == 0 {
		return nil
	}
	users := make([]*entity.User, 0, len(userIDs))
	if err := s.data.DB.Context(ctx).In("id", userIDs).Where("status = ?", entity.UserStatusAvailable).Find(&users); err != nil {
		log.Errorf("get task admin user info failed: %v", err)
		return nil
	}
	return users
}

func (s *TaskSquareService) taskUser(ctx context.Context, userID string) *entity.User {
	if userID == "" || userID == "0" {
		return nil
	}
	user := &entity.User{ID: userID}
	if has, err := s.data.DB.Context(ctx).Get(user); err != nil || !has {
		if err != nil {
			log.Errorf("get task user failed user_id=%s err=%v", userID, err)
		}
		return nil
	}
	return user
}
