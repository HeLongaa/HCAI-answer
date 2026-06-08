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

package ai_conversation

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"github.com/apache/answer/internal/base/pager"
	"github.com/apache/answer/internal/base/reason"
	"github.com/apache/answer/internal/entity"
	"github.com/apache/answer/internal/repo/ai_conversation"
	"github.com/apache/answer/internal/schema"
	"github.com/apache/answer/pkg/token"
	"github.com/segmentfault/pacman/errors"
	"github.com/segmentfault/pacman/log"
)

// AIConversationService
type AIConversationService interface {
	CreateConversation(ctx context.Context, userID, conversationID, topic string) error
	SaveConversationRecords(ctx context.Context, conversationID, chatcmplID, branchParentMessageID string, records []*ConversationMessage) error
	GetConversationList(ctx context.Context, req *schema.AIConversationListReq) (*pager.PageModel, error)
	GetConversationDetail(ctx context.Context, req *schema.AIConversationDetailReq) (resp *schema.AIConversationDetailResp, exist bool, err error)
	VoteRecord(ctx context.Context, req *schema.AIConversationVoteReq) error
	SwitchBranch(ctx context.Context, req *schema.AIConversationBranchSwitchReq) error
	DeleteRecord(ctx context.Context, req *schema.AIConversationRecordDeleteReq) error
}

// ConversationMessage
type ConversationMessage struct {
	ChatCompletionID string `json:"chat_completion_id"`
	MessageID        string `json:"message_id"`
	ParentMessageID  string `json:"parent_message_id"`
	BranchIndex      int    `json:"branch_index"`
	Active           bool   `json:"active"`
	Role             string `json:"role"`
	Content          string `json:"content"`
	Images           []string
	Files            []ConversationFile
}

type ConversationFile struct {
	Name    string
	Type    string
	Size    int64
	Content string
}

type ConversationAttachments struct {
	Images []string           `json:"images,omitempty"`
	Files  []ConversationFile `json:"files,omitempty"`
}

// aiConversationService
type aiConversationService struct {
	aiConversationRepo ai_conversation.AIConversationRepo
}

// NewAIConversationService
func NewAIConversationService(
	aiConversationRepo ai_conversation.AIConversationRepo,
) AIConversationService {
	return &aiConversationService{
		aiConversationRepo: aiConversationRepo,
	}
}

// CreateConversation
func (s *aiConversationService) CreateConversation(ctx context.Context, userID, conversationID, topic string) error {
	conversation := &entity.AIConversation{
		ConversationID: conversationID,
		Topic:          topic,
		UserID:         userID,
	}
	err := s.aiConversationRepo.CreateConversation(ctx, conversation)
	if err != nil {
		log.Errorf("create conversation failed: %v", err)
		return err
	}

	return nil
}

// SaveConversationRecords
func (s *aiConversationService) SaveConversationRecords(ctx context.Context, conversationID, chatcmplID, branchParentMessageID string, records []*ConversationMessage) error {
	conversation, exist, err := s.aiConversationRepo.GetConversation(ctx, conversationID)
	if err != nil {
		return errors.InternalServer(reason.DatabaseError).WithError(err)
	}
	if !exist {
		return errors.BadRequest(reason.ObjectNotFound)
	}

	content := strings.Builder{}
	parentMessageID := branchParentMessageID
	lastPersistedMessageID := ""

	for _, record := range records {
		if len(record.ChatCompletionID) > 0 {
			if record.MessageID != "" {
				lastPersistedMessageID = record.MessageID
			}
			continue
		}
		if record.Role == "user" {
			if parentMessageID != "" {
				continue
			}
			parentMessageID = "msg-" + token.GenerateToken()
			aiRecord := &entity.AIConversationRecord{
				ConversationID:   conversationID,
				ChatCompletionID: chatcmplID,
				MessageID:        parentMessageID,
				ParentMessageID:  lastPersistedMessageID,
				Role:             "user",
				Content:          record.Content,
				Attachments:      marshalConversationAttachments(record),
				BranchIndex:      0,
				Active:           true,
			}

			err = s.aiConversationRepo.CreateRecord(ctx, aiRecord)
			if err != nil {
				log.Errorf("create conversation record failed: %v", err)
				return errors.InternalServer(reason.DatabaseError).WithError(err)
			}
			continue
		}

		content.WriteString(record.Content)
		content.WriteString("\n")
	}
	if parentMessageID == "" {
		return nil
	}
	branchIndex, err := s.aiConversationRepo.CountAssistantBranches(ctx, conversationID, parentMessageID)
	if err != nil {
		return errors.InternalServer(reason.DatabaseError).WithError(err)
	}
	aiRecord := &entity.AIConversationRecord{
		ConversationID:   conversationID,
		ChatCompletionID: chatcmplID,
		MessageID:        "msg-" + token.GenerateToken(),
		ParentMessageID:  parentMessageID,
		BranchIndex:      int(branchIndex),
		Active:           true,
		Role:             "assistant",
		Content:          content.String(),
		Helpful:          0,
		Unhelpful:        0,
	}

	err = s.aiConversationRepo.CreateRecord(ctx, aiRecord)
	if err != nil {
		log.Errorf("create conversation record failed: %v", err)
		return errors.InternalServer(reason.DatabaseError).WithError(err)
	}
	if err = s.aiConversationRepo.SetActiveBranch(ctx, conversationID, parentMessageID, aiRecord.MessageID); err != nil {
		return errors.InternalServer(reason.DatabaseError).WithError(err)
	}

	conversation.UpdatedAt = time.Now()
	err = s.aiConversationRepo.UpdateConversation(ctx, conversation)
	if err != nil {
		log.Errorf("update conversation failed: %v", err)
		return errors.InternalServer(reason.DatabaseError).WithError(err)
	}

	return nil
}

// GetConversationList
func (s *aiConversationService) GetConversationList(ctx context.Context, req *schema.AIConversationListReq) (*pager.PageModel, error) {
	conversations, total, err := s.aiConversationRepo.GetConversationsPage(ctx, req.Page, req.PageSize, &entity.AIConversation{UserID: req.UserID})
	if err != nil {
		return nil, errors.InternalServer(reason.DatabaseError).WithError(err)
	}

	list := make([]schema.AIConversationListItem, 0, len(conversations))
	for _, conversation := range conversations {
		list = append(list, schema.AIConversationListItem{
			ConversationID: conversation.ConversationID,
			CreatedAt:      conversation.CreatedAt.Unix(),
			Topic:          conversation.Topic,
		})
	}

	return pager.NewPageModel(total, list), nil
}

// GetConversationDetail
func (s *aiConversationService) GetConversationDetail(ctx context.Context, req *schema.AIConversationDetailReq) (
	resp *schema.AIConversationDetailResp, exist bool, err error) {
	conversation, exist, err := s.aiConversationRepo.GetConversation(ctx, req.ConversationID)
	if err != nil {
		return nil, false, errors.InternalServer(reason.DatabaseError).WithError(err)
	}
	if !exist || conversation.UserID != req.UserID {
		return nil, false, nil
	}

	records, err := s.aiConversationRepo.GetRecordsByConversationID(ctx, req.ConversationID)
	if err != nil {
		return nil, false, errors.InternalServer(reason.DatabaseError).WithError(err)
	}

	recordList := make([]*schema.AIConversationRecord, 0, len(records))
	for i, record := range records {
		if i == 0 {
			record.Content = conversation.Topic
		}
		attachments := unmarshalConversationAttachments(record.Attachments)
		recordList = append(recordList, &schema.AIConversationRecord{
			ID:               record.ID,
			ChatCompletionID: record.ChatCompletionID,
			MessageID:        record.MessageID,
			ParentMessageID:  record.ParentMessageID,
			BranchIndex:      record.BranchIndex,
			Active:           record.Active,
			Role:             record.Role,
			Content:          record.Content,
			Images:           attachments.Images,
			Files:            schemaConversationFiles(attachments.Files),
			Helpful:          record.Helpful,
			Unhelpful:        record.Unhelpful,
			CreatedAt:        record.CreatedAt.Unix(),
			DeletedAt:        unixOrZero(record.DeletedAt),
		})
	}

	return &schema.AIConversationDetailResp{
		ConversationID: conversation.ConversationID,
		Topic:          conversation.Topic,
		Records:        recordList,
		CreatedAt:      conversation.CreatedAt.Unix(),
		UpdatedAt:      conversation.UpdatedAt.Unix(),
	}, true, nil
}

func (s *aiConversationService) SwitchBranch(ctx context.Context, req *schema.AIConversationBranchSwitchReq) error {
	conversation, exist, err := s.aiConversationRepo.GetConversation(ctx, req.ConversationID)
	if err != nil {
		return errors.InternalServer(reason.DatabaseError).WithError(err)
	}
	if !exist || conversation.UserID != req.UserID {
		return errors.Forbidden(reason.UnauthorizedError)
	}
	record, exist, err := s.aiConversationRepo.GetRecordByMessageID(ctx, req.MessageID)
	if err != nil {
		return errors.InternalServer(reason.DatabaseError).WithError(err)
	}
	if !exist || record.ConversationID != req.ConversationID || record.ParentMessageID != req.ParentMessageID || record.Role != "assistant" {
		return errors.BadRequest(reason.ObjectNotFound)
	}
	if err = s.aiConversationRepo.SetActiveBranch(ctx, req.ConversationID, req.ParentMessageID, req.MessageID); err != nil {
		return errors.InternalServer(reason.DatabaseError).WithError(err)
	}
	return nil
}

func (s *aiConversationService) DeleteRecord(ctx context.Context, req *schema.AIConversationRecordDeleteReq) error {
	conversation, exist, err := s.aiConversationRepo.GetConversation(ctx, req.ConversationID)
	if err != nil {
		return errors.InternalServer(reason.DatabaseError).WithError(err)
	}
	if !exist || conversation.UserID != req.UserID {
		return errors.Forbidden(reason.UnauthorizedError)
	}
	records, err := s.aiConversationRepo.GetRecordsByConversationID(ctx, req.ConversationID)
	if err != nil {
		return errors.InternalServer(reason.DatabaseError).WithError(err)
	}
	children := map[string][]string{}
	var target *entity.AIConversationRecord
	for _, record := range records {
		if record.MessageID == req.MessageID {
			target = record
		}
		children[record.ParentMessageID] = append(children[record.ParentMessageID], record.MessageID)
	}
	if target == nil {
		return errors.BadRequest(reason.ObjectNotFound)
	}
	toDelete := []string{}
	var walk func(messageID string)
	walk = func(messageID string) {
		toDelete = append(toDelete, messageID)
		for _, childID := range children[messageID] {
			walk(childID)
		}
	}
	walk(req.MessageID)
	if err = s.aiConversationRepo.SoftDeleteRecords(ctx, toDelete); err != nil {
		return errors.InternalServer(reason.DatabaseError).WithError(err)
	}
	if target.Role == "assistant" && target.ParentMessageID != "" && target.Active {
		records, err := s.aiConversationRepo.GetRecordsByConversationID(ctx, req.ConversationID)
		if err != nil {
			return errors.InternalServer(reason.DatabaseError).WithError(err)
		}
		for _, item := range records {
			if item.Role == "assistant" && item.ParentMessageID == target.ParentMessageID {
				if err = s.aiConversationRepo.SetActiveBranch(ctx, req.ConversationID, target.ParentMessageID, item.MessageID); err != nil {
					return errors.InternalServer(reason.DatabaseError).WithError(err)
				}
				break
			}
		}
	}
	return nil
}

// VoteRecord
func (s *aiConversationService) VoteRecord(ctx context.Context, req *schema.AIConversationVoteReq) error {
	record, exist, err := s.aiConversationRepo.GetRecordByChatCompletionID(ctx, "assistant", req.ChatCompletionID)
	if err != nil {
		return errors.InternalServer(reason.DatabaseError).WithError(err)
	}
	if !exist {
		return errors.BadRequest(reason.ObjectNotFound)
	}

	conversation, exist, err := s.aiConversationRepo.GetConversation(ctx, record.ConversationID)
	if err != nil {
		return errors.InternalServer(reason.DatabaseError).WithError(err)
	}
	if !exist {
		return errors.BadRequest(reason.ObjectNotFound)
	}

	if conversation.UserID != req.UserID {
		return errors.Forbidden(reason.UnauthorizedError)
	}

	if record.Role != "assistant" {
		return errors.BadRequest("Only AI responses can be voted")
	}

	if req.VoteType == "helpful" {
		if req.Cancel {
			record.Helpful = 0
		} else {
			record.Helpful = 1
			record.Unhelpful = 0
		}
	} else {
		if req.Cancel {
			record.Unhelpful = 0
		} else {
			record.Unhelpful = 1
			record.Helpful = 0
		}
	}

	err = s.aiConversationRepo.UpdateRecordVote(ctx, record)
	if err != nil {
		return errors.InternalServer(reason.DatabaseError).WithError(err)
	}

	return nil
}

func unixOrZero(value time.Time) int64 {
	if value.IsZero() {
		return 0
	}
	return value.Unix()
}

func marshalConversationAttachments(record *ConversationMessage) string {
	if record == nil || (len(record.Images) == 0 && len(record.Files) == 0) {
		return ""
	}
	data, err := json.Marshal(ConversationAttachments{
		Images: record.Images,
		Files:  record.Files,
	})
	if err != nil {
		log.Errorf("marshal conversation attachments failed: %v", err)
		return ""
	}
	return string(data)
}

func unmarshalConversationAttachments(value string) ConversationAttachments {
	if strings.TrimSpace(value) == "" {
		return ConversationAttachments{}
	}
	var attachments ConversationAttachments
	if err := json.Unmarshal([]byte(value), &attachments); err != nil {
		log.Errorf("unmarshal conversation attachments failed: %v", err)
		return ConversationAttachments{}
	}
	return attachments
}

func schemaConversationFiles(files []ConversationFile) []schema.AIConversationFile {
	if len(files) == 0 {
		return nil
	}
	resp := make([]schema.AIConversationFile, 0, len(files))
	for _, file := range files {
		resp = append(resp, schema.AIConversationFile{
			Name:    file.Name,
			Type:    file.Type,
			Size:    file.Size,
			Content: file.Content,
		})
	}
	return resp
}
