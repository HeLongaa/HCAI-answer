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

package s3_storage

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"mime/multipart"
	"path"
	"strings"

	"github.com/apache/answer/internal/base/reason"
	"github.com/apache/answer/internal/service/media_storage"
	"github.com/apache/answer/pkg/checker"
	"github.com/apache/answer/pkg/uid"
	"github.com/apache/answer/plugin"
)

type storagePlugin struct{}

func init() {
	plugin.Register(&storagePlugin{})
}

func (p *storagePlugin) Info() plugin.Info {
	return plugin.Info{
		Name:        literal("S3 Compatible Storage"),
		SlugName:    media_storage.S3PluginSlugName,
		Description: literal("Upload images, videos, and attachments to an S3-compatible public bucket."),
		Author:      "HCAI",
		Version:     "1.0.0",
	}
}

func (p *storagePlugin) ConfigFields() []plugin.ConfigField {
	config := media_storage.GetS3Config()
	return []plugin.ConfigField{
		inputField("endpoint", "Endpoint", "S3 compatible endpoint.", config.Endpoint, true, plugin.InputTypeUrl),
		inputField("bucket", "Bucket", "Bucket name.", config.Bucket, true, plugin.InputTypeText),
		inputField("region", "Region", "S3 signing region.", config.Region, true, plugin.InputTypeText),
		inputField("access_key_id", "Access Key ID", "Access key used to sign upload requests.", config.AccessKeyID, true, plugin.InputTypeText),
		inputField("secret_access_key", "Secret Access Key", "Secret key used to sign upload requests.", config.SecretAccessKey, true, plugin.InputTypePassword),
		inputField("public_url_prefix", "Public URL Prefix", "Public read URL prefix returned after upload.", config.PublicURLPrefix, true, plugin.InputTypeUrl),
		{
			Name:        "force_path_style",
			Type:        plugin.ConfigTypeSwitch,
			Title:       literal("Path Style"),
			Description: literal("Keep enabled for buckets with dots in the name."),
			Required:    true,
			Value:       config.ForcePathStyle,
			UIOptions: plugin.ConfigFieldUIOptions{
				Label: literal("Use path-style URLs"),
			},
		},
	}
}

func (p *storagePlugin) ConfigReceiver(data []byte) error {
	config, err := media_storage.ParseS3Config(data)
	if err != nil {
		return err
	}
	if !config.ForcePathStyle {
		return fmt.Errorf("path style must be enabled for bucket %s", config.Bucket)
	}
	return media_storage.SetS3Config(config)
}

func (p *storagePlugin) UploadFile(ctx *plugin.GinContext, condition plugin.UploadFileCondition) plugin.UploadFileResponse {
	file, fileHeader, err := ctx.Request.FormFile("file")
	if err != nil {
		return uploadError(err)
	}
	defer file.Close()

	objectKey, maxBytes, err := objectKeyAndLimit(fileHeader, condition)
	if err != nil {
		return uploadError(err)
	}
	data, err := io.ReadAll(io.LimitReader(file, maxBytes+1))
	if err != nil {
		return uploadError(err)
	}
	if int64(len(data)) > maxBytes {
		return uploadError(fmt.Errorf("file is too large"))
	}
	if err := validateUpload(fileHeader, data, condition); err != nil {
		return uploadError(err)
	}
	uploadCtx := context.Background()
	if ctx.Request != nil {
		uploadCtx = ctx.Request.Context()
	}
	fullURL, err := media_storage.UploadBytesWithConfig(uploadCtx, media_storage.GetS3Config(), objectKey, data, media_storage.ContentTypeByKey(objectKey))
	if err != nil {
		return uploadError(err)
	}
	return plugin.UploadFileResponse{FullURL: fullURL}
}

func objectKeyAndLimit(fileHeader *multipart.FileHeader, condition plugin.UploadFileCondition) (string, int64, error) {
	ext := strings.ToLower(path.Ext(fileHeader.Filename))
	if ext == "" {
		return "", 0, fmt.Errorf("file extension is required")
	}
	filename := uid.IDStr12() + ext
	switch condition.Source {
	case plugin.UserAvatar:
		return path.Join("avatar", filename), maxMegabytes(condition.MaxImageSize, 4), nil
	case plugin.UserPost:
		return path.Join("post", filename), maxMegabytes(condition.MaxImageSize, 4), nil
	case plugin.UserPostAttachment:
		return path.Join("files/post", filename), maxMegabytes(condition.MaxAttachmentSize, 20), nil
	case plugin.AdminBranding:
		return path.Join("branding", filename), maxMegabytes(condition.MaxImageSize, 4), nil
	default:
		return "", 0, fmt.Errorf("upload source is not supported")
	}
}

func validateUpload(fileHeader *multipart.FileHeader, data []byte, condition plugin.UploadFileCondition) error {
	ext := strings.ToLower(path.Ext(fileHeader.Filename))
	switch condition.Source {
	case plugin.UserAvatar, plugin.AdminBranding:
		if _, ok := plugin.DefaultFileTypeCheckMapping[condition.Source][ext]; !ok {
			return fmt.Errorf("file type is not supported")
		}
	case plugin.UserPost:
		if checker.IsUnAuthorizedExtension(fileHeader.Filename, condition.AuthorizedImageExtensions) {
			return fmt.Errorf("file type is not supported")
		}
	case plugin.UserPostAttachment:
		if checker.IsUnAuthorizedExtension(fileHeader.Filename, condition.AuthorizedAttachmentExtensions) {
			return fmt.Errorf("file type is not supported")
		}
		return nil
	default:
		return fmt.Errorf("upload source is not supported")
	}
	if !checker.DecodeAndCheckImageReader(bytes.NewReader(data), ext, condition.MaxImageMegapixel*1000*1000) {
		return fmt.Errorf("image format is not supported")
	}
	return nil
}

func uploadError(err error) plugin.UploadFileResponse {
	return plugin.UploadFileResponse{
		OriginalError:   err,
		DisplayErrorMsg: plugin.MakeTranslator(reason.UploadFileUnsupportedFileFormat),
	}
}

func maxMegabytes(value, fallback int) int64 {
	if value <= 0 {
		value = fallback
	}
	return int64(value) * 1024 * 1024
}

func inputField(name, title, description, value string, required bool, inputType plugin.InputType) plugin.ConfigField {
	return plugin.ConfigField{
		Name:        name,
		Type:        plugin.ConfigTypeInput,
		Title:       literal(title),
		Description: literal(description),
		Required:    required,
		Value:       value,
		UIOptions: plugin.ConfigFieldUIOptions{
			InputType: inputType,
		},
	}
}

func literal(value string) plugin.Translator {
	return plugin.Translator{Fn: func(ctx *plugin.GinContext) string {
		return value
	}}
}

var _ plugin.Storage = (*storagePlugin)(nil)
var _ plugin.Config = (*storagePlugin)(nil)
