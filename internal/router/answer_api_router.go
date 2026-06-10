/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

package router

import (
	"github.com/apache/answer/internal/base/middleware"
	"github.com/apache/answer/internal/controller"
	"github.com/apache/answer/internal/controller_admin"
	"github.com/gin-gonic/gin"
)

type AnswerAPIRouter struct {
	langController            *controller.LangController
	userController            *controller.UserController
	commentController         *controller.CommentController
	reportController          *controller.ReportController
	voteController            *controller.VoteController
	tagController             *controller.TagController
	followController          *controller.FollowController
	collectionController      *controller.CollectionController
	questionController        *controller.QuestionController
	answerController          *controller.AnswerController
	searchController          *controller.SearchController
	revisionController        *controller.RevisionController
	rankController            *controller.RankController
	adminUserController       *controller_admin.UserAdminController
	reasonController          *controller.ReasonController
	themeController           *controller_admin.ThemeController
	adminSiteInfoController   *controller_admin.SiteInfoController
	siteInfoController        *controller.SiteInfoController
	notificationController    *controller.NotificationController
	dashboardController       *controller.DashboardController
	uploadController          *controller.UploadController
	activityController        *controller.ActivityController
	roleController            *controller_admin.RoleController
	pluginController          *controller_admin.PluginController
	permissionController      *controller.PermissionController
	userPluginController      *controller.UserPluginController
	reviewController          *controller.ReviewController
	metaController            *controller.MetaController
	badgeController           *controller.BadgeController
	adminBadgeController      *controller_admin.BadgeController
	apiKeyController          *controller_admin.AdminAPIKeyController
	aiChatConfigController    *controller_admin.AIChatConfigController
	aiController              *controller.AIController
	aiConversationController  *controller.AIConversationController
	mcpController             *controller.MCPController
	taskSquareController      *controller.TaskSquareController
	taskSquareAdminController *controller_admin.TaskSquareAdminController
	realtimeController        *controller.RealtimeController
}

func NewAnswerAPIRouter(
	langController *controller.LangController,
	userController *controller.UserController,
	commentController *controller.CommentController,
	reportController *controller.ReportController,
	voteController *controller.VoteController,
	tagController *controller.TagController,
	followController *controller.FollowController,
	collectionController *controller.CollectionController,
	questionController *controller.QuestionController,
	answerController *controller.AnswerController,
	searchController *controller.SearchController,
	revisionController *controller.RevisionController,
	rankController *controller.RankController,
	adminUserController *controller_admin.UserAdminController,
	reasonController *controller.ReasonController,
	themeController *controller_admin.ThemeController,
	adminSiteInfoController *controller_admin.SiteInfoController,
	siteInfoController *controller.SiteInfoController,
	notificationController *controller.NotificationController,
	dashboardController *controller.DashboardController,
	uploadController *controller.UploadController,
	activityController *controller.ActivityController,
	roleController *controller_admin.RoleController,
	pluginController *controller_admin.PluginController,
	permissionController *controller.PermissionController,
	userPluginController *controller.UserPluginController,
	reviewController *controller.ReviewController,
	metaController *controller.MetaController,
	badgeController *controller.BadgeController,
	adminBadgeController *controller_admin.BadgeController,
	apiKeyController *controller_admin.AdminAPIKeyController,
	aiChatConfigController *controller_admin.AIChatConfigController,
	aiController *controller.AIController,
	aiConversationController *controller.AIConversationController,
	mcpController *controller.MCPController,
	taskSquareController *controller.TaskSquareController,
	taskSquareAdminController *controller_admin.TaskSquareAdminController,
	realtimeController *controller.RealtimeController,
) *AnswerAPIRouter {
	return &AnswerAPIRouter{
		langController:            langController,
		userController:            userController,
		commentController:         commentController,
		reportController:          reportController,
		voteController:            voteController,
		tagController:             tagController,
		followController:          followController,
		collectionController:      collectionController,
		questionController:        questionController,
		answerController:          answerController,
		searchController:          searchController,
		revisionController:        revisionController,
		rankController:            rankController,
		adminUserController:       adminUserController,
		reasonController:          reasonController,
		themeController:           themeController,
		adminSiteInfoController:   adminSiteInfoController,
		notificationController:    notificationController,
		siteInfoController:        siteInfoController,
		dashboardController:       dashboardController,
		uploadController:          uploadController,
		activityController:        activityController,
		roleController:            roleController,
		pluginController:          pluginController,
		permissionController:      permissionController,
		userPluginController:      userPluginController,
		reviewController:          reviewController,
		metaController:            metaController,
		badgeController:           badgeController,
		adminBadgeController:      adminBadgeController,
		apiKeyController:          apiKeyController,
		aiChatConfigController:    aiChatConfigController,
		aiController:              aiController,
		aiConversationController:  aiConversationController,
		mcpController:             mcpController,
		taskSquareController:      taskSquareController,
		taskSquareAdminController: taskSquareAdminController,
		realtimeController:        realtimeController,
	}
}

func (a *AnswerAPIRouter) RegisterMustUnAuthAnswerAPIRouter(authUserMiddleware *middleware.AuthUserMiddleware, r *gin.RouterGroup) {
	// i18n
	r.GET("/language/config", a.langController.GetLangMapping)
	r.GET("/language/options", a.langController.GetUserLangOptions)

	// siteinfo
	r.GET("/siteinfo", a.siteInfoController.GetSiteInfo)
	r.GET("/siteinfo/legal", a.siteInfoController.GetSiteLegalInfo)

	// user
	r.GET("/user/info", a.userController.GetUserInfoByUserID)
	r.GET("/user/action/record", authUserMiddleware.Auth(), a.userController.ActionRecord)
	routerGroup := r.Group("", middleware.BanAPIForUserCenter)
	routerGroup.POST("/user/login/email", a.userController.UserEmailLogin)
	routerGroup.POST("/user/register/email", a.userController.UserRegisterByEmail)
	routerGroup.POST("/user/email/verification", a.userController.UserVerifyEmail)
	routerGroup.PUT("/user/email", a.userController.UserChangeEmailVerify)
	routerGroup.POST("/user/password/reset", a.userController.RetrievePassWord)
	routerGroup.POST("/user/password/replacement", a.userController.UseRePassWord)
	routerGroup.PUT("/user/notification/unsubscribe", a.userController.UserUnsubscribeNotification)

	// plugins
	r.GET("/plugin/status", a.pluginController.GetAllPluginStatus)
}

func (a *AnswerAPIRouter) RegisterUnAuthAnswerAPIRouter(r *gin.RouterGroup) {
	// user
	r.GET("/personal/user/info", a.userController.GetOtherUserInfoByUsername)
	r.GET("/user/ranking", a.userController.UserRanking)
	r.GET("/user/staff", a.userController.UserStaff)

	// answer
	r.GET("/answer/info", a.answerController.GetAnswerInfo)
	r.GET("/answer/page", a.answerController.AnswerList)
	r.GET("/personal/answer/page", a.questionController.PersonalAnswerPage)

	// question
	r.GET("/question/info", a.questionController.GetQuestion)
	r.GET("/question/invite", a.questionController.GetQuestionInviteUserInfo)
	r.GET("/question/page", a.questionController.QuestionPage)
	r.GET("/question/recommend/page", a.questionController.QuestionRecommendPage)
	r.GET("/question/similar/tag", a.questionController.SimilarQuestion)
	r.GET("/personal/qa/top", a.questionController.UserTop)
	r.GET("/personal/question/page", a.questionController.PersonalQuestionPage)
	r.GET("/question/link", a.questionController.GetQuestionLink)

	// comment
	r.GET("/comment/page", a.commentController.GetCommentWithPage)
	r.GET("/personal/comment/page", a.commentController.GetCommentPersonalWithPage)
	r.GET("/comment", a.commentController.GetComment)

	// tag
	r.GET("/tags/page", a.tagController.GetTagWithPage)
	r.GET("/tags/following", a.tagController.GetFollowingTags)
	r.GET("/tag", a.tagController.GetTagInfo)
	r.GET("/tags", a.tagController.GetTagsBySlugName)
	r.GET("/tag/synonyms", a.tagController.GetTagSynonyms)

	// search
	r.GET("/search", a.searchController.Search)
	r.GET("/search/desc", a.searchController.SearchDesc)

	// rank
	r.GET("/personal/rank/page", a.rankController.GetRankPersonalWithPage)

	// reaction
	r.GET("/meta/reaction", a.metaController.GetReaction)

	// badges
	r.GET("/badge", a.badgeController.GetBadgeInfo)
	r.GET("/badge/awards/page", a.badgeController.GetBadgeAwardList)
	r.GET("/badge/user/awards/recent", a.badgeController.GetRecentBadgeAwardListByUsername)
	r.GET("/badge/user/awards", a.badgeController.GetAllBadgeAwardListByUsername)
	r.GET("/badges", a.badgeController.GetBadgeList)
}

func (a *AnswerAPIRouter) RegisterAuthUserWithAnyStatusAnswerAPIRouter(r *gin.RouterGroup) {
	r.GET("/user/logout", a.userController.UserLogout)
	r.POST("/user/email/change/code", middleware.BanAPIForUserCenter, a.userController.UserChangeEmailSendCode)
	r.POST("/user/email/verification/send", middleware.BanAPIForUserCenter, a.userController.UserVerifyEmailSend)
}

func (a *AnswerAPIRouter) RegisterAnswerAPIRouter(r *gin.RouterGroup) {
	// realtime
	r.GET("/realtime/events", a.realtimeController.Events)

	// revisions
	r.GET("/revisions", a.revisionController.GetRevisionList)
	r.GET("/revisions/unreviewed", a.revisionController.GetUnreviewedRevisionList)
	r.PUT("/revisions/audit", a.revisionController.RevisionAudit)
	r.GET("/revisions/edit/check", a.revisionController.CheckCanUpdateRevision)
	r.GET("/reviewing/type", a.revisionController.GetReviewingType)

	// comment
	r.POST("/comment", a.commentController.AddComment)
	r.DELETE("/comment", a.commentController.RemoveComment)
	r.PUT("/comment", a.commentController.UpdateComment)

	// report
	r.POST("/report", a.reportController.AddReport)
	r.GET("/report/unreviewed/post", a.reportController.GetUnreviewedReportPostPage)
	r.PUT("/report/review", a.reportController.ReviewReport)

	// review
	r.GET("/review/pending/post/page", a.reviewController.GetUnreviewedPostPage)
	r.PUT("/review/pending/post", a.reviewController.UpdateReview)

	// vote
	r.POST("/vote/up", a.voteController.VoteUp)
	r.POST("/vote/down", a.voteController.VoteDown)

	// follow
	r.POST("/follow", a.followController.Follow)
	r.PUT("/follow/tags", a.followController.UpdateFollowTags)

	// tag
	r.GET("/question/tags", a.tagController.SearchTagLike)
	r.POST("/tag", a.tagController.AddTag)
	r.PUT("/tag", a.tagController.UpdateTag)
	r.POST("/tag/recover", a.tagController.RecoverTag)
	r.DELETE("/tag", a.tagController.RemoveTag)
	r.PUT("/tag/synonym", a.tagController.UpdateTagSynonym)
	r.POST("/tag/merge", a.tagController.MergeTag)

	// collection
	r.POST("/collection/switch", a.collectionController.CollectionSwitch)
	r.GET("/personal/collection/page", a.questionController.PersonalCollectionPage)

	// question
	r.POST("/question", a.questionController.AddQuestion)
	r.POST("/question/answer", a.questionController.AddQuestionByAnswer)
	r.PUT("/question", a.questionController.UpdateQuestion)
	r.PUT("/question/invite", a.questionController.UpdateQuestionInviteUser)
	r.DELETE("/question", a.questionController.RemoveQuestion)
	r.PUT("/question/status", a.questionController.CloseQuestion)
	r.PUT("/question/operation", a.questionController.OperationQuestion)
	r.PUT("/question/reopen", a.questionController.ReopenQuestion)
	r.GET("/question/similar", a.questionController.GetSimilarQuestions)
	r.POST("/question/recover", a.questionController.QuestionRecover)

	// answer
	r.POST("/answer", a.answerController.AddAnswer)
	r.PUT("/answer", a.answerController.UpdateAnswer)
	r.POST("/answer/acceptance", a.answerController.AcceptAnswer)
	r.DELETE("/answer", a.answerController.RemoveAnswer)
	r.POST("/answer/recover", a.answerController.RecoverAnswer)

	// user
	r.PUT("/user/password", middleware.BanAPIForUserCenter, a.userController.UserModifyPassWord)
	r.PUT("/user/info", a.userController.UserUpdateInfo)
	r.PUT("/user/interface", a.userController.UserUpdateInterface)
	r.GET("/user/notification/config", a.userController.GetUserNotificationConfig)
	r.PUT("/user/notification/config", a.userController.UpdateUserNotificationConfig)
	r.GET("/user/info/search", a.userController.SearchUserListByName)

	// vote
	r.GET("/personal/vote/page", a.voteController.UserVotes)

	// reason
	r.GET("/reasons", a.reasonController.Reasons)

	// permission
	r.GET("/permission", a.permissionController.GetPermission)

	// notification
	r.GET("/notification/status", a.notificationController.GetRedDot)
	r.PUT("/notification/status", a.notificationController.ClearRedDot)
	r.GET("/notification/page", a.notificationController.GetList)
	r.PUT("/notification/read/state/all", a.notificationController.ClearUnRead)
	r.PUT("/notification/read/state", a.notificationController.ClearIDUnRead)

	// upload file
	r.POST("/file", a.uploadController.UploadFile)
	r.POST("/post/render", a.uploadController.PostRender)

	// activity
	r.GET("/activity/timeline", a.activityController.GetObjectTimeline)
	r.GET("/activity/timeline/detail", a.activityController.GetObjectTimelineDetail)

	// plugin
	r.GET("/user/plugin/configs", a.userPluginController.GetUserPluginList)
	r.GET("/user/plugin/config", a.userPluginController.GetUserPluginConfig)
	r.PUT("/user/plugin/config", a.userPluginController.UpdatePluginUserConfig)

	// meta
	r.PUT("/meta/reaction", a.metaController.AddOrUpdateReaction)

	// AI chat
	r.POST("/chat/completions", a.aiController.ChatCompletions)
	r.GET("/ai-chat/models", a.aiController.GetAIChatModels)
	r.GET("/ai-chat/subscription/overview", a.aiController.GetSubscriptionOverview)
	r.GET("/ai-chat/subscription/purchase", a.aiController.GetSubscriptionPurchase)
	r.POST("/ai-chat/subscription/redeem", a.aiController.RedeemSubscriptionCode)
	r.POST("/ai-agent/responses", a.aiController.AgentResponses)
	r.GET("/ai-image/models", a.aiController.GetAIImageModels)
	r.GET("/ai-image/generations", a.aiController.GetImageGenerations)
	r.DELETE("/ai-image/generations", a.aiController.DeleteImageGeneration)
	r.GET("/ai-image/agent-conversations", a.aiController.GetImageAgentConversations)
	r.PUT("/ai-image/agent-conversations", a.aiController.SaveImageAgentConversation)
	r.DELETE("/ai-image/agent-conversations", a.aiController.DeleteImageAgentConversation)
	r.GET("/ai-image/assets/:user_id/:filename", a.aiController.GetImageAsset)
	r.POST("/ai-image/agent-generations", a.aiController.SaveAgentImageGeneration)
	r.POST("/ai-image/generations", a.aiController.GenerateImage)
	r.POST("/ai-image/edits", a.aiController.EditImage)
	r.GET("/ai-video/models", a.aiController.GetAIVideoModels)
	r.GET("/ai-video/generations", a.aiController.GetVideoGenerations)
	r.GET("/ai-video/assets/:user_id/:filename", a.aiController.GetVideoAsset)
	r.POST("/ai-video/generations", a.aiController.GenerateVideo)

	// task square
	r.GET("/tasks", a.taskSquareController.ListTasks)
	r.GET("/task", a.taskSquareController.GetTask)
	r.POST("/task", a.taskSquareController.CreateTask)
	r.POST("/task/claim", a.taskSquareController.ClaimTask)
	r.POST("/task/submission", a.taskSquareController.SubmitTask)
	r.GET("/review/tasks", a.taskSquareController.ListReviewTasks)
	r.PUT("/review/task", a.taskSquareController.ReviewTask)
	r.PUT("/review/task/submission", a.taskSquareController.ReviewSubmission)
	r.GET("/points/account", a.taskSquareController.GetPointAccount)
	r.GET("/points/ranking", a.taskSquareController.ListPointRanking)
	r.GET("/contribution/ranking", a.taskSquareController.ListContributionRanking)
	r.GET("/points/transactions", a.taskSquareController.ListPointTransactions)

	// AI conversation
	r.GET("/ai/conversation/page", a.aiConversationController.GetConversationList)
	r.GET("/ai/conversation", a.aiConversationController.GetConversationDetail)
	r.POST("/ai/conversation/vote", a.aiConversationController.VoteRecord)
	r.PUT("/ai/conversation/branch", a.aiConversationController.SwitchBranch)
	r.DELETE("/ai/conversation/record", a.aiConversationController.DeleteRecord)
}

func (a *AnswerAPIRouter) RegisterAnswerAdminAPIRouter(r *gin.RouterGroup) {
	r.GET("/question/page", a.questionController.AdminQuestionPage)
	r.PUT("/question/status", a.questionController.AdminUpdateQuestionStatus)
	r.GET("/answer/page", a.questionController.AdminAnswerPage)
	r.PUT("/answer/status", a.answerController.AdminUpdateAnswerStatus)

	// user
	r.GET("/users/page", a.adminUserController.GetUserPage)
	r.PUT("/user/status", a.adminUserController.UpdateUserStatus)
	r.PUT("/user/role", a.adminUserController.UpdateUserRole)
	r.GET("/user/activation", a.adminUserController.GetUserActivation)
	r.POST("/user/activation", a.adminUserController.SendUserActivation)
	r.POST("/user", a.adminUserController.AddUser)
	r.POST("/users", a.adminUserController.AddUsers)
	r.PUT("/user/password", a.adminUserController.UpdateUserPassword)
	r.PUT("/user/profile", a.adminUserController.EditUserProfile)

	r.DELETE("/delete/permanently", a.adminUserController.DeletePermanently)

	// reason
	r.GET("/reasons", a.reasonController.Reasons)

	// language
	r.GET("/language/options", a.langController.GetAdminLangOptions)

	// theme
	r.GET("/theme/options", a.themeController.GetThemeOptions)

	// siteinfo
	r.GET("/siteinfo/general", a.adminSiteInfoController.GetGeneral)
	r.PUT("/siteinfo/general", a.adminSiteInfoController.UpdateGeneral)

	r.GET("/siteinfo/interface", a.adminSiteInfoController.GetInterface)
	r.PUT("/siteinfo/interface", a.adminSiteInfoController.UpdateInterface)
	r.GET("/siteinfo/users-settings", a.adminSiteInfoController.GetUsersSettings)
	r.PUT("/siteinfo/users-settings", a.adminSiteInfoController.UpdateUsersSettings)

	r.GET("/siteinfo/branding", a.adminSiteInfoController.GetSiteBranding)
	r.PUT("/siteinfo/branding", a.adminSiteInfoController.UpdateBranding)

	r.GET("/siteinfo/question", a.adminSiteInfoController.GetSiteQuestion)
	r.PUT("/siteinfo/question", a.adminSiteInfoController.UpdateSiteQuestion)
	r.GET("/siteinfo/tag", a.adminSiteInfoController.GetSiteTag)
	r.PUT("/siteinfo/tag", a.adminSiteInfoController.UpdateSiteTag)
	r.GET("/siteinfo/advanced", a.adminSiteInfoController.GetSiteAdvanced)
	r.PUT("/siteinfo/advanced", a.adminSiteInfoController.UpdateSiteAdvanced)

	r.GET("/siteinfo/polices", a.adminSiteInfoController.GetSitePolicies)
	r.PUT("/siteinfo/polices", a.adminSiteInfoController.UpdateSitePolices)
	r.GET("/siteinfo/security", a.adminSiteInfoController.GetSiteSecurity)
	r.PUT("/siteinfo/security", a.adminSiteInfoController.UpdateSiteSecurity)

	r.GET("/siteinfo/seo", a.adminSiteInfoController.GetSeo)
	r.PUT("/siteinfo/seo", a.adminSiteInfoController.UpdateSeo)
	r.GET("/siteinfo/login", a.adminSiteInfoController.GetSiteLogin)
	r.PUT("/siteinfo/login", a.adminSiteInfoController.UpdateSiteLogin)
	r.GET("/siteinfo/custom-css-html", a.adminSiteInfoController.GetSiteCustomCssHTML)
	r.PUT("/siteinfo/custom-css-html", a.adminSiteInfoController.UpdateSiteCustomCssHTML)
	r.GET("/siteinfo/theme", a.adminSiteInfoController.GetSiteTheme)
	r.PUT("/siteinfo/theme", a.adminSiteInfoController.SaveSiteTheme)
	r.GET("/siteinfo/users", a.adminSiteInfoController.GetSiteUsers)
	r.PUT("/siteinfo/users", a.adminSiteInfoController.UpdateSiteUsers)
	r.GET("/setting/smtp", a.adminSiteInfoController.GetSMTPConfig)
	r.PUT("/setting/smtp", a.adminSiteInfoController.UpdateSMTPConfig)
	r.GET("/setting/privileges", a.adminSiteInfoController.GetPrivilegesConfig)
	r.PUT("/setting/privileges", a.adminSiteInfoController.UpdatePrivilegesConfig)

	// dashboard
	r.GET("/dashboard", a.dashboardController.DashboardInfo)

	// roles
	r.GET("/roles", a.roleController.GetRoleList)

	// plugin
	r.GET("/plugins", a.pluginController.GetPluginList)
	r.PUT("/plugin/status", a.pluginController.UpdatePluginStatus)
	r.GET("/plugin/config", a.pluginController.GetPluginConfig)
	r.PUT("/plugin/config", a.pluginController.UpdatePluginConfig)

	// badge
	r.GET("/badges", a.adminBadgeController.GetBadgeList)
	r.PUT("/badge/status", a.adminBadgeController.UpdateBadgeStatus)

	// api key
	r.GET("/api-key/all", a.apiKeyController.GetAllAPIKeys)
	r.POST("/api-key", a.apiKeyController.AddAPIKey)
	r.PUT("/api-key", a.apiKeyController.UpdateAPIKey)
	r.DELETE("/api-key", a.apiKeyController.DeleteAPIKey)

	// AI Chat config
	r.GET("/ai-chat/providers", a.aiChatConfigController.ListProviders)
	r.POST("/ai-chat/providers", a.aiChatConfigController.CreateProvider)
	r.PUT("/ai-chat/providers/:id", a.aiChatConfigController.UpdateProvider)
	r.DELETE("/ai-chat/providers/:id", a.aiChatConfigController.DeleteProvider)
	r.POST("/ai-chat/providers/:id/fetch-models", a.aiChatConfigController.FetchProviderModels)
	r.POST("/ai-chat/providers/:id/test-model", a.aiChatConfigController.TestProviderModel)

	r.GET("/ai-chat/chat-setting", a.aiChatConfigController.GetChatSetting)
	r.PUT("/ai-chat/chat-setting", a.aiChatConfigController.SaveChatSetting)
	r.GET("/ai-chat/model-mappings", a.aiChatConfigController.ListModelMappings)
	r.POST("/ai-chat/model-mappings", a.aiChatConfigController.CreateModelMapping)
	r.PUT("/ai-chat/model-mappings/:id", a.aiChatConfigController.UpdateModelMapping)
	r.DELETE("/ai-chat/model-mappings/:id", a.aiChatConfigController.DeleteModelMapping)

	r.GET("/ai-chat/subscription-plans", a.aiChatConfigController.ListSubscriptionPlans)
	r.POST("/ai-chat/subscription-plans", a.aiChatConfigController.CreateSubscriptionPlan)
	r.PUT("/ai-chat/subscription-plans/:id", a.aiChatConfigController.UpdateSubscriptionPlan)
	r.DELETE("/ai-chat/subscription-plans/:id", a.aiChatConfigController.DeleteSubscriptionPlan)
	r.GET("/ai-chat/redeem-codes", a.aiChatConfigController.ListSubscriptionRedeemCodes)
	r.POST("/ai-chat/redeem-codes/generate", a.aiChatConfigController.GenerateSubscriptionRedeemCodes)

	r.GET("/ai-chat/consume-rates", a.aiChatConfigController.ListConsumeRates)
	r.POST("/ai-chat/consume-rates", a.aiChatConfigController.CreateConsumeRate)
	r.PUT("/ai-chat/consume-rates/:id", a.aiChatConfigController.UpdateConsumeRate)
	r.GET("/ai-chat/image-providers", a.aiChatConfigController.ListImageProviders)
	r.POST("/ai-chat/image-providers", a.aiChatConfigController.CreateImageProvider)
	r.PUT("/ai-chat/image-providers/:id", a.aiChatConfigController.UpdateImageProvider)
	r.DELETE("/ai-chat/image-providers/:id", a.aiChatConfigController.DeleteImageProvider)
	r.GET("/ai-chat/image-models", a.aiChatConfigController.ListImageModels)
	r.POST("/ai-chat/image-models", a.aiChatConfigController.CreateImageModel)
	r.PUT("/ai-chat/image-models/:id", a.aiChatConfigController.UpdateImageModel)
	r.DELETE("/ai-chat/image-models/:id", a.aiChatConfigController.DeleteImageModel)
	r.GET("/ai-chat/image-setting", a.aiChatConfigController.GetImageSetting)
	r.PUT("/ai-chat/image-setting", a.aiChatConfigController.SaveImageSetting)
	r.GET("/ai-chat/video-providers", a.aiChatConfigController.ListVideoProviders)
	r.POST("/ai-chat/video-providers", a.aiChatConfigController.CreateVideoProvider)
	r.PUT("/ai-chat/video-providers/:id", a.aiChatConfigController.UpdateVideoProvider)
	r.DELETE("/ai-chat/video-providers/:id", a.aiChatConfigController.DeleteVideoProvider)
	r.GET("/ai-chat/video-models", a.aiChatConfigController.ListVideoModels)
	r.POST("/ai-chat/video-models", a.aiChatConfigController.CreateVideoModel)
	r.PUT("/ai-chat/video-models/:id", a.aiChatConfigController.UpdateVideoModel)
	r.DELETE("/ai-chat/video-models/:id", a.aiChatConfigController.DeleteVideoModel)
	r.GET("/ai-chat/video-setting", a.aiChatConfigController.GetVideoSetting)
	r.PUT("/ai-chat/video-setting", a.aiChatConfigController.SaveVideoSetting)

	// task square
	r.GET("/tasks", a.taskSquareAdminController.ListTasks)
	r.PUT("/task/review", a.taskSquareAdminController.ReviewTask)
	r.PUT("/task/assign", a.taskSquareAdminController.AssignTask)
	r.PUT("/task/submission/review", a.taskSquareAdminController.ReviewSubmission)
	r.GET("/featured-posts", a.taskSquareAdminController.ListFeaturedPosts)
	r.POST("/featured-post", a.taskSquareAdminController.FeaturePost)
	r.PUT("/featured-post/revoke", a.taskSquareAdminController.RevokeFeaturedPost)
}
