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
	"time"

	"github.com/apache/answer/internal/base/data"
	"github.com/apache/answer/internal/base/pager"
	"github.com/apache/answer/internal/base/reason"
	"github.com/apache/answer/internal/entity"
	"github.com/segmentfault/pacman/errors"
	"github.com/segmentfault/pacman/log"
	"xorm.io/builder"
	"xorm.io/xorm"
)

// AIConversationRepo
type AIConversationRepo interface {
	CreateConversation(ctx context.Context, conversation *entity.AIConversation) error
	GetConversation(ctx context.Context, conversationID string) (*entity.AIConversation, bool, error)
	UpdateConversation(ctx context.Context, conversation *entity.AIConversation) error
	GetConversationsPage(ctx context.Context, page, pageSize int, cond *entity.AIConversation) (list []*entity.AIConversation, total int64, err error)
	CreateRecord(ctx context.Context, record *entity.AIConversationRecord) error
	GetRecordsByConversationID(ctx context.Context, conversationID string) ([]*entity.AIConversationRecord, error)
	GetRecordByMessageID(ctx context.Context, messageID string) (*entity.AIConversationRecord, bool, error)
	CountAssistantBranches(ctx context.Context, conversationID, parentMessageID string) (int64, error)
	SetActiveBranch(ctx context.Context, conversationID, parentMessageID, messageID string) error
	SoftDeleteRecords(ctx context.Context, messageIDs []string) error
	UpdateRecordVote(ctx context.Context, cond *entity.AIConversationRecord) error
	GetRecord(ctx context.Context, recordID int) (*entity.AIConversationRecord, bool, error)
	GetRecordByChatCompletionID(ctx context.Context, role, chatCompletionID string) (*entity.AIConversationRecord, bool, error)
}

type aiConversationRepo struct {
	data *data.Data
}

// NewAIConversationRepo new AIConversationRepo
func NewAIConversationRepo(data *data.Data) AIConversationRepo {
	return &aiConversationRepo{
		data: data,
	}
}

// CreateConversation creates a conversation
func (r *aiConversationRepo) CreateConversation(ctx context.Context, conversation *entity.AIConversation) error {
	_, err := r.data.DB.Context(ctx).Insert(conversation)
	if err != nil {
		log.Errorf("create ai conversation failed: %v", err)
		return err
	}
	return nil
}

// GetConversation gets a conversation
func (r *aiConversationRepo) GetConversation(ctx context.Context, conversationID string) (*entity.AIConversation, bool, error) {
	conversation := &entity.AIConversation{}
	exist, err := r.data.DB.Context(ctx).Where(builder.Eq{"conversation_id": conversationID}).Get(conversation)
	if err != nil {
		log.Errorf("get ai conversation failed: %v", err)
		return nil, false, err
	}
	return conversation, exist, nil
}

// UpdateConversation updates a conversation
func (r *aiConversationRepo) UpdateConversation(ctx context.Context, conversation *entity.AIConversation) error {
	_, err := r.data.DB.Context(ctx).ID(conversation.ID).Update(conversation)
	if err != nil {
		log.Errorf("update ai conversation failed: %v", err)
		return err
	}
	return nil
}

// GetConversationsPage get conversations by user ID
func (r *aiConversationRepo) GetConversationsPage(ctx context.Context, page, pageSize int, cond *entity.AIConversation) (list []*entity.AIConversation, total int64, err error) {
	list = make([]*entity.AIConversation, 0)
	total, err = pager.Help(page, pageSize, &list, cond, r.data.DB.Context(ctx).Desc("id"))
	if err != nil {
		err = errors.InternalServer(reason.DatabaseError).WithError(err).WithStack()
	}
	return list, total, err
}

// CreateRecord creates a conversation record
func (r *aiConversationRepo) CreateRecord(ctx context.Context, record *entity.AIConversationRecord) error {
	_, err := r.data.DB.Context(ctx).Insert(record)
	if err != nil {
		log.Errorf("create ai conversation record failed: %v", err)
		return err
	}
	return nil
}

// GetRecordsByConversationID get records by conversation ID
func (r *aiConversationRepo) GetRecordsByConversationID(ctx context.Context, conversationID string) ([]*entity.AIConversationRecord, error) {
	records := make([]*entity.AIConversationRecord, 0)
	err := r.data.DB.Context(ctx).
		Where(builder.Eq{"conversation_id": conversationID}).
		Where("deleted_at IS NULL OR deleted_at = ?", "0001-01-01 00:00:00").
		Asc("id").
		Find(&records)
	if err != nil {
		log.Errorf("get ai conversation records failed: %v", err)
		return nil, err
	}
	return records, nil
}

func (r *aiConversationRepo) GetRecordByMessageID(ctx context.Context, messageID string) (*entity.AIConversationRecord, bool, error) {
	record := &entity.AIConversationRecord{}
	exist, err := r.data.DB.Context(ctx).
		Where("message_id = ?", messageID).
		Where("deleted_at IS NULL OR deleted_at = ?", "0001-01-01 00:00:00").
		Get(record)
	if err != nil {
		log.Errorf("get ai conversation record by message id failed: %v", err)
		return nil, false, err
	}
	return record, exist, nil
}

func (r *aiConversationRepo) CountAssistantBranches(ctx context.Context, conversationID, parentMessageID string) (int64, error) {
	return r.data.DB.Context(ctx).
		Where("conversation_id = ? AND parent_message_id = ? AND role = ?", conversationID, parentMessageID, "assistant").
		Where("deleted_at IS NULL OR deleted_at = ?", "0001-01-01 00:00:00").
		Count(new(entity.AIConversationRecord))
}

func (r *aiConversationRepo) SetActiveBranch(ctx context.Context, conversationID, parentMessageID, messageID string) error {
	_, err := r.data.DB.Transaction(func(session *xorm.Session) (any, error) {
		if _, err := session.Context(ctx).
			Where("conversation_id = ? AND parent_message_id = ? AND role = ?", conversationID, parentMessageID, "assistant").
			Cols("active").
			Update(&entity.AIConversationRecord{Active: false}); err != nil {
			return nil, err
		}
		_, err := session.Context(ctx).
			Where("conversation_id = ? AND parent_message_id = ? AND message_id = ?", conversationID, parentMessageID, messageID).
			Cols("active").
			Update(&entity.AIConversationRecord{Active: true})
		return nil, err
	})
	return err
}

func (r *aiConversationRepo) SoftDeleteRecords(ctx context.Context, messageIDs []string) error {
	if len(messageIDs) == 0 {
		return nil
	}
	_, err := r.data.DB.Context(ctx).
		In("message_id", messageIDs).
		Cols("deleted_at").
		Update(&entity.AIConversationRecord{DeletedAt: time.Now()})
	return err
}

// UpdateRecordVote update record vote
func (r *aiConversationRepo) UpdateRecordVote(ctx context.Context, cond *entity.AIConversationRecord) (err error) {
	_, err = r.data.DB.Context(ctx).ID(cond.ID).MustCols("helpful", "unhelpful").Update(cond)
	if err != nil {
		log.Errorf("update ai conversation record vote failed: %v", err)
		return err
	}
	return nil
}

// GetRecord get record
func (r *aiConversationRepo) GetRecord(ctx context.Context, recordID int) (*entity.AIConversationRecord, bool, error) {
	record := &entity.AIConversationRecord{}
	exist, err := r.data.DB.Context(ctx).ID(recordID).Get(record)
	if err != nil {
		log.Errorf("get ai conversation record failed: %v", err)
		return nil, false, err
	}
	return record, exist, nil
}

// GetRecordByChatCompletionID gets record by chat completion ID
func (r *aiConversationRepo) GetRecordByChatCompletionID(ctx context.Context, role, chatCompletionID string) (*entity.AIConversationRecord, bool, error) {
	record := &entity.AIConversationRecord{}
	exist, err := r.data.DB.Context(ctx).Where(builder.Eq{"role": role}).
		Where(builder.Eq{"chat_completion_id": chatCompletionID}).Get(record)
	if err != nil {
		log.Errorf("get ai conversation record by chat completion id failed: %v", err)
		return nil, false, err
	}
	return record, exist, nil
}
