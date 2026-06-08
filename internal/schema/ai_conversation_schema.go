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

package schema

import (
	"github.com/apache/answer/internal/base/validator"
)

// AIConversationListReq ai conversation list req
type AIConversationListReq struct {
	Page     int    `validate:"omitempty,min=1" form:"page"`
	PageSize int    `validate:"omitempty,min=1" form:"page_size"`
	UserID   string `validate:"omitempty" json:"-"`
}

// AIConversationListItem ai conversation list item
type AIConversationListItem struct {
	ConversationID string `json:"conversation_id"`
	Topic          string `json:"topic"`
	CreatedAt      int64  `json:"created_at"`
}

// AIConversationDetailReq ai conversation detail req
type AIConversationDetailReq struct {
	ConversationID string `validate:"required" form:"conversation_id" json:"conversation_id"`
	UserID         string `validate:"omitempty" json:"-"`
}

// AIConversationRecord ai conversation record
type AIConversationRecord struct {
	ID               int                  `json:"id"`
	ChatCompletionID string               `json:"chat_completion_id"`
	MessageID        string               `json:"message_id"`
	ParentMessageID  string               `json:"parent_message_id"`
	BranchIndex      int                  `json:"branch_index"`
	Active           bool                 `json:"active"`
	Role             string               `json:"role"`
	Content          string               `json:"content"`
	Images           []string             `json:"images"`
	Files            []AIConversationFile `json:"files"`
	Helpful          int                  `json:"helpful"`
	Unhelpful        int                  `json:"unhelpful"`
	CreatedAt        int64                `json:"created_at"`
	DeletedAt        int64                `json:"deleted_at"`
}

type AIConversationFile struct {
	Name    string `json:"name"`
	Type    string `json:"type"`
	Size    int64  `json:"size"`
	Content string `json:"content,omitempty"`
}

// AIConversationDetailResp ai conversation detail resp
type AIConversationDetailResp struct {
	ConversationID string                  `json:"conversation_id"`
	Topic          string                  `json:"topic"`
	Records        []*AIConversationRecord `json:"records"`
	CreatedAt      int64                   `json:"created_at"`
	UpdatedAt      int64                   `json:"updated_at"`
}

// AIConversationVoteReq ai conversation vote req
type AIConversationVoteReq struct {
	ChatCompletionID string `validate:"required" json:"chat_completion_id"`
	VoteType         string `validate:"required,oneof=helpful unhelpful" json:"vote_type"`
	Cancel           bool   `validate:"omitempty" json:"cancel"`
	UserID           string `validate:"omitempty" json:"-"`
}

type AIConversationBranchSwitchReq struct {
	ConversationID  string `validate:"required" json:"conversation_id"`
	ParentMessageID string `validate:"required" json:"parent_message_id"`
	MessageID       string `validate:"required" json:"message_id"`
	UserID          string `validate:"omitempty" json:"-"`
}

type AIConversationRecordDeleteReq struct {
	ConversationID string `validate:"required" json:"conversation_id"`
	MessageID      string `validate:"required" json:"message_id"`
	UserID         string `validate:"omitempty" json:"-"`
}

func (req *AIConversationDetailReq) Check() (errFields []*validator.FormErrorField, err error) {
	return nil, nil
}

func (req *AIConversationVoteReq) Check() (errFields []*validator.FormErrorField, err error) {
	return nil, nil
}
