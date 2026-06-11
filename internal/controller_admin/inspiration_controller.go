package controller_admin

import (
	"strconv"

	"github.com/apache/answer/internal/base/handler"
	"github.com/apache/answer/internal/base/middleware"
	"github.com/apache/answer/internal/base/reason"
	"github.com/apache/answer/internal/schema"
	"github.com/apache/answer/internal/service/inspiration"
	"github.com/gin-gonic/gin"
	"github.com/segmentfault/pacman/errors"
)

type InspirationAdminController struct {
	inspirationService *inspiration.InspirationService
}

func NewInspirationAdminController(inspirationService *inspiration.InspirationService) *InspirationAdminController {
	return &InspirationAdminController{inspirationService: inspirationService}
}

func (ctrl *InspirationAdminController) List(ctx *gin.Context) {
	req := &schema.InspirationListReq{}
	if handler.BindAndCheck(ctx, req) {
		return
	}
	req.UserID = middleware.GetLoginUserIDFromContext(ctx)
	req.IsAdmin = true
	req.IsManage = true
	resp, err := ctrl.inspirationService.List(ctx, req)
	handler.HandleResponse(ctx, err, resp)
}

func (ctrl *InspirationAdminController) Action(ctx *gin.Context) {
	id, err := strconv.Atoi(ctx.Param("id"))
	if err != nil || id <= 0 {
		handler.HandleResponse(ctx, errors.BadRequest(reason.RequestFormatError), nil)
		return
	}
	req := &schema.InspirationAdminActionReq{ID: id}
	if handler.BindAndCheck(ctx, req) {
		return
	}
	req.OperatorID = middleware.GetLoginUserIDFromContext(ctx)
	req.OperatorIsAdminMod = middleware.GetUserIsAdminModerator(ctx)
	resp, err := ctrl.inspirationService.AdminAction(ctx, req)
	handler.HandleResponse(ctx, err, resp)
}

func (ctrl *InspirationAdminController) Hide(ctx *gin.Context) {
	ctrl.actionWithStatus(ctx, entityStatusHidden)
}

func (ctrl *InspirationAdminController) Restore(ctx *gin.Context) {
	ctrl.actionWithStatus(ctx, entityStatusPublished)
}

func (ctrl *InspirationAdminController) Delete(ctx *gin.Context) {
	ctrl.actionWithStatus(ctx, entityStatusDeleted)
}

func (ctrl *InspirationAdminController) BanAuthor(ctx *gin.Context) {
	id, err := strconv.Atoi(ctx.Param("id"))
	if err != nil || id <= 0 {
		handler.HandleResponse(ctx, errors.BadRequest(reason.RequestFormatError), nil)
		return
	}
	req := &schema.InspirationAdminActionReq{ID: id, BanAuthor: true}
	if handler.BindAndCheck(ctx, req) {
		return
	}
	req.OperatorID = middleware.GetLoginUserIDFromContext(ctx)
	resp, err := ctrl.inspirationService.AdminAction(ctx, req)
	handler.HandleResponse(ctx, err, resp)
}

func (ctrl *InspirationAdminController) GetSetting(ctx *gin.Context) {
	resp, err := ctrl.inspirationService.GetSetting(ctx)
	handler.HandleResponse(ctx, err, resp)
}

func (ctrl *InspirationAdminController) SaveSetting(ctx *gin.Context) {
	req := &schema.InspirationSettingReq{}
	if handler.BindAndCheck(ctx, req) {
		return
	}
	resp, err := ctrl.inspirationService.SaveSetting(ctx, req)
	handler.HandleResponse(ctx, err, resp)
}

func (ctrl *InspirationAdminController) actionWithStatus(ctx *gin.Context, status string) {
	id, err := strconv.Atoi(ctx.Param("id"))
	if err != nil || id <= 0 {
		handler.HandleResponse(ctx, errors.BadRequest(reason.RequestFormatError), nil)
		return
	}
	req := &schema.InspirationAdminActionReq{ID: id, Status: status, RevokeReward: true}
	if handler.BindAndCheck(ctx, req) {
		return
	}
	req.OperatorID = middleware.GetLoginUserIDFromContext(ctx)
	resp, err := ctrl.inspirationService.AdminAction(ctx, req)
	handler.HandleResponse(ctx, err, resp)
}

const (
	entityStatusHidden    = "hidden"
	entityStatusPublished = "published"
	entityStatusDeleted   = "deleted"
)
