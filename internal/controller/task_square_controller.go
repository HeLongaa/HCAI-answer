package controller

import (
	"github.com/apache/answer/internal/base/handler"
	"github.com/apache/answer/internal/base/middleware"
	"github.com/apache/answer/internal/base/reason"
	"github.com/apache/answer/internal/schema"
	"github.com/apache/answer/internal/service/task_square"
	"github.com/gin-gonic/gin"
	"github.com/segmentfault/pacman/errors"
)

type TaskSquareController struct {
	taskSquareService *task_square.TaskSquareService
}

func NewTaskSquareController(taskSquareService *task_square.TaskSquareService) *TaskSquareController {
	return &TaskSquareController{taskSquareService: taskSquareService}
}

func (ctrl *TaskSquareController) CreateTask(ctx *gin.Context) {
	req := &schema.TaskCreateReq{}
	if handler.BindAndCheck(ctx, req) {
		return
	}
	req.UserID = middleware.GetLoginUserIDFromContext(ctx)
	req.IsAdminModerator = middleware.GetUserIsAdminModerator(ctx)
	err := ctrl.taskSquareService.CreateTask(ctx, req)
	handler.HandleResponse(ctx, err, nil)
}

func (ctrl *TaskSquareController) ListTasks(ctx *gin.Context) {
	req := &schema.TaskListReq{}
	if handler.BindAndCheck(ctx, req) {
		return
	}
	req.UserID = middleware.GetLoginUserIDFromContext(ctx)
	req.IsAdmin = false
	req.IsAdminModerator = middleware.GetUserIsAdminModerator(ctx)
	resp, err := ctrl.taskSquareService.ListTasks(ctx, req)
	handler.HandleResponse(ctx, err, resp)
}

func (ctrl *TaskSquareController) ListReviewTasks(ctx *gin.Context) {
	if !middleware.GetUserIsAdminModerator(ctx) {
		handler.HandleResponse(ctx, errors.Forbidden(reason.ForbiddenError), nil)
		return
	}
	req := &schema.TaskListReq{}
	if handler.BindAndCheck(ctx, req) {
		return
	}
	req.UserID = middleware.GetLoginUserIDFromContext(ctx)
	req.IsAdmin = true
	req.IsAdminModerator = true
	resp, err := ctrl.taskSquareService.ListTasks(ctx, req)
	handler.HandleResponse(ctx, err, resp)
}

func (ctrl *TaskSquareController) ReviewTask(ctx *gin.Context) {
	if !middleware.GetUserIsAdminModerator(ctx) {
		handler.HandleResponse(ctx, errors.Forbidden(reason.ForbiddenError), nil)
		return
	}
	req := &schema.TaskReviewReq{}
	if handler.BindAndCheck(ctx, req) {
		return
	}
	req.OperatorID = middleware.GetLoginUserIDFromContext(ctx)
	err := ctrl.taskSquareService.ReviewTask(ctx, req)
	handler.HandleResponse(ctx, err, nil)
}

func (ctrl *TaskSquareController) ReviewSubmission(ctx *gin.Context) {
	if !middleware.GetUserIsAdminModerator(ctx) {
		handler.HandleResponse(ctx, errors.Forbidden(reason.ForbiddenError), nil)
		return
	}
	req := &schema.TaskSubmissionReviewReq{}
	if handler.BindAndCheck(ctx, req) {
		return
	}
	req.OperatorID = middleware.GetLoginUserIDFromContext(ctx)
	err := ctrl.taskSquareService.ReviewSubmission(ctx, req)
	handler.HandleResponse(ctx, err, nil)
}

func (ctrl *TaskSquareController) GetTask(ctx *gin.Context) {
	req := &struct {
		ID int `validate:"required" form:"id"`
	}{}
	if handler.BindAndCheck(ctx, req) {
		return
	}
	resp, err := ctrl.taskSquareService.GetTask(ctx, req.ID, middleware.GetLoginUserIDFromContext(ctx), middleware.GetUserIsAdminModerator(ctx))
	handler.HandleResponse(ctx, err, resp)
}

func (ctrl *TaskSquareController) ClaimTask(ctx *gin.Context) {
	req := &schema.TaskClaimReq{}
	if handler.BindAndCheck(ctx, req) {
		return
	}
	req.UserID = middleware.GetLoginUserIDFromContext(ctx)
	err := ctrl.taskSquareService.ClaimTask(ctx, req)
	handler.HandleResponse(ctx, err, nil)
}

func (ctrl *TaskSquareController) SubmitTask(ctx *gin.Context) {
	req := &schema.TaskSubmitReq{}
	if handler.BindAndCheck(ctx, req) {
		return
	}
	req.UserID = middleware.GetLoginUserIDFromContext(ctx)
	err := ctrl.taskSquareService.SubmitTask(ctx, req)
	handler.HandleResponse(ctx, err, nil)
}

func (ctrl *TaskSquareController) GetPointAccount(ctx *gin.Context) {
	resp, err := ctrl.taskSquareService.GetPointAccount(ctx, middleware.GetLoginUserIDFromContext(ctx))
	handler.HandleResponse(ctx, err, resp)
}

func (ctrl *TaskSquareController) ListPointRanking(ctx *gin.Context) {
	resp, err := ctrl.taskSquareService.ListPointRanking(ctx)
	handler.HandleResponse(ctx, err, resp)
}

func (ctrl *TaskSquareController) ListContributionRanking(ctx *gin.Context) {
	resp, err := ctrl.taskSquareService.ListContributionRanking(ctx)
	handler.HandleResponse(ctx, err, resp)
}

func (ctrl *TaskSquareController) ListPointTransactions(ctx *gin.Context) {
	req := &schema.PointTransactionReq{}
	if handler.BindAndCheck(ctx, req) {
		return
	}
	req.UserID = middleware.GetLoginUserIDFromContext(ctx)
	resp, err := ctrl.taskSquareService.ListPointTransactions(ctx, req)
	handler.HandleResponse(ctx, err, resp)
}
