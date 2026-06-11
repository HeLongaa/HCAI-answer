package controller

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

type InspirationController struct {
	inspirationService *inspiration.InspirationService
}

func NewInspirationController(inspirationService *inspiration.InspirationService) *InspirationController {
	return &InspirationController{inspirationService: inspirationService}
}

func (ctrl *InspirationController) List(ctx *gin.Context) {
	req := &schema.InspirationListReq{}
	if handler.BindAndCheck(ctx, req) {
		return
	}
	req.UserID = middleware.GetLoginUserIDFromContext(ctx)
	req.IsAdmin = middleware.GetUserIsAdminModerator(ctx)
	resp, err := ctrl.inspirationService.List(ctx, req)
	handler.HandleResponse(ctx, err, resp)
}

func (ctrl *InspirationController) ListReview(ctx *gin.Context) {
	if !middleware.GetUserIsAdminModerator(ctx) {
		handler.HandleResponse(ctx, errors.Forbidden(reason.ForbiddenError), nil)
		return
	}
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

func (ctrl *InspirationController) Get(ctx *gin.Context) {
	id, err := strconv.Atoi(ctx.Param("id"))
	if err != nil || id <= 0 {
		handler.HandleResponse(ctx, errors.BadRequest(reason.RequestFormatError), nil)
		return
	}
	resp, err := ctrl.inspirationService.Get(
		ctx,
		id,
		middleware.GetLoginUserIDFromContext(ctx),
		middleware.GetUserIsAdminModerator(ctx),
		ctx.ClientIP(),
	)
	handler.HandleResponse(ctx, err, resp)
}

func (ctrl *InspirationController) Create(ctx *gin.Context) {
	req := &schema.InspirationCreateReq{}
	if handler.BindAndCheck(ctx, req) {
		return
	}
	req.UserID = middleware.GetLoginUserIDFromContext(ctx)
	resp, err := ctrl.inspirationService.Create(ctx, req)
	handler.HandleResponse(ctx, err, resp)
}

func (ctrl *InspirationController) Update(ctx *gin.Context) {
	id, err := strconv.Atoi(ctx.Param("id"))
	if err != nil || id <= 0 {
		handler.HandleResponse(ctx, errors.BadRequest(reason.RequestFormatError), nil)
		return
	}
	req := &schema.InspirationUpdateReq{ID: id}
	if handler.BindAndCheck(ctx, req) {
		return
	}
	req.UserID = middleware.GetLoginUserIDFromContext(ctx)
	req.IsAdmin = middleware.GetUserIsAdminModerator(ctx)
	resp, err := ctrl.inspirationService.Update(ctx, req)
	handler.HandleResponse(ctx, err, resp)
}

func (ctrl *InspirationController) Delete(ctx *gin.Context) {
	id, err := strconv.Atoi(ctx.Param("id"))
	if err != nil || id <= 0 {
		handler.HandleResponse(ctx, errors.BadRequest(reason.RequestFormatError), nil)
		return
	}
	err = ctrl.inspirationService.Delete(ctx, id, middleware.GetLoginUserIDFromContext(ctx), middleware.GetUserIsAdminModerator(ctx))
	handler.HandleResponse(ctx, err, nil)
}

func (ctrl *InspirationController) Review(ctx *gin.Context) {
	if !middleware.GetUserIsAdminModerator(ctx) {
		handler.HandleResponse(ctx, errors.Forbidden(reason.ForbiddenError), nil)
		return
	}
	req := &schema.InspirationAdminActionReq{}
	if handler.BindAndCheck(ctx, req) {
		return
	}
	req.OperatorID = middleware.GetLoginUserIDFromContext(ctx)
	req.OperatorIsAdminMod = true
	resp, err := ctrl.inspirationService.AdminAction(ctx, req)
	handler.HandleResponse(ctx, err, resp)
}

func (ctrl *InspirationController) Like(ctx *gin.Context) {
	id, err := strconv.Atoi(ctx.Param("id"))
	if err != nil || id <= 0 {
		handler.HandleResponse(ctx, errors.BadRequest(reason.RequestFormatError), nil)
		return
	}
	err = ctrl.inspirationService.Like(ctx, id, middleware.GetLoginUserIDFromContext(ctx), true)
	handler.HandleResponse(ctx, err, nil)
}

func (ctrl *InspirationController) Unlike(ctx *gin.Context) {
	id, err := strconv.Atoi(ctx.Param("id"))
	if err != nil || id <= 0 {
		handler.HandleResponse(ctx, errors.BadRequest(reason.RequestFormatError), nil)
		return
	}
	err = ctrl.inspirationService.Like(ctx, id, middleware.GetLoginUserIDFromContext(ctx), false)
	handler.HandleResponse(ctx, err, nil)
}

func (ctrl *InspirationController) Favorite(ctx *gin.Context) {
	id, err := strconv.Atoi(ctx.Param("id"))
	if err != nil || id <= 0 {
		handler.HandleResponse(ctx, errors.BadRequest(reason.RequestFormatError), nil)
		return
	}
	err = ctrl.inspirationService.Favorite(ctx, id, middleware.GetLoginUserIDFromContext(ctx), true)
	handler.HandleResponse(ctx, err, nil)
}

func (ctrl *InspirationController) Unfavorite(ctx *gin.Context) {
	id, err := strconv.Atoi(ctx.Param("id"))
	if err != nil || id <= 0 {
		handler.HandleResponse(ctx, errors.BadRequest(reason.RequestFormatError), nil)
		return
	}
	err = ctrl.inspirationService.Favorite(ctx, id, middleware.GetLoginUserIDFromContext(ctx), false)
	handler.HandleResponse(ctx, err, nil)
}

func (ctrl *InspirationController) Share(ctx *gin.Context) {
	id, err := strconv.Atoi(ctx.Param("id"))
	if err != nil || id <= 0 {
		handler.HandleResponse(ctx, errors.BadRequest(reason.RequestFormatError), nil)
		return
	}
	err = ctrl.inspirationService.Share(ctx, id, middleware.GetLoginUserIDFromContext(ctx))
	handler.HandleResponse(ctx, err, nil)
}

func (ctrl *InspirationController) AddComment(ctx *gin.Context) {
	id, err := strconv.Atoi(ctx.Param("id"))
	if err != nil || id <= 0 {
		handler.HandleResponse(ctx, errors.BadRequest(reason.RequestFormatError), nil)
		return
	}
	req := &schema.InspirationCommentCreateReq{ID: id}
	if handler.BindAndCheck(ctx, req) {
		return
	}
	req.UserID = middleware.GetLoginUserIDFromContext(ctx)
	resp, err := ctrl.inspirationService.AddComment(ctx, req)
	handler.HandleResponse(ctx, err, resp)
}

func (ctrl *InspirationController) ListComments(ctx *gin.Context) {
	id, err := strconv.Atoi(ctx.Param("id"))
	if err != nil || id <= 0 {
		handler.HandleResponse(ctx, errors.BadRequest(reason.RequestFormatError), nil)
		return
	}
	req := &schema.InspirationCommentListReq{ID: id}
	if handler.BindAndCheck(ctx, req) {
		return
	}
	req.UserID = middleware.GetLoginUserIDFromContext(ctx)
	req.IsAdmin = middleware.GetUserIsAdminModerator(ctx)
	resp, err := ctrl.inspirationService.ListComments(ctx, req)
	handler.HandleResponse(ctx, err, resp)
}

func (ctrl *InspirationController) Report(ctx *gin.Context) {
	id, err := strconv.Atoi(ctx.Param("id"))
	if err != nil || id <= 0 {
		handler.HandleResponse(ctx, errors.BadRequest(reason.RequestFormatError), nil)
		return
	}
	req := &schema.InspirationReportReq{ID: id}
	if handler.BindAndCheck(ctx, req) {
		return
	}
	req.UserID = middleware.GetLoginUserIDFromContext(ctx)
	err = ctrl.inspirationService.Report(ctx, req)
	handler.HandleResponse(ctx, err, nil)
}

func (ctrl *InspirationController) AuthorRanking(ctx *gin.Context) {
	resp, err := ctrl.inspirationService.AuthorRanking(ctx)
	handler.HandleResponse(ctx, err, resp)
}

func (ctrl *InspirationController) Taxonomy(ctx *gin.Context) {
	resp, err := ctrl.inspirationService.Taxonomy(ctx)
	handler.HandleResponse(ctx, err, resp)
}
