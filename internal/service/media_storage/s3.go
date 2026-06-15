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

package media_storage

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"mime"
	"net/http"
	"net/url"
	"path"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

const S3PluginSlugName = "hctopup_s3_storage"

type S3Config struct {
	Endpoint        string `json:"endpoint"`
	Bucket          string `json:"bucket"`
	Region          string `json:"region"`
	AccessKeyID     string `json:"access_key_id"`
	SecretAccessKey string `json:"secret_access_key"`
	PublicURLPrefix string `json:"public_url_prefix"`
	ForcePathStyle  bool   `json:"force_path_style"`
}

var (
	s3Mu     sync.RWMutex
	s3Config = DefaultS3Config()
)

func DefaultS3Config() S3Config {
	return S3Config{
		Endpoint:        "https://storage.hctopup.com",
		Bucket:          "chat.hctopup.com",
		Region:          "us-east-1",
		PublicURLPrefix: "https://storage.hctopup.com/chat.hctopup.com",
		ForcePathStyle:  true,
	}
}

func SetS3Config(config S3Config) error {
	normalized, err := NormalizeS3Config(config)
	if err != nil {
		return err
	}
	s3Mu.Lock()
	defer s3Mu.Unlock()
	s3Config = normalized
	return nil
}

func GetS3Config() S3Config {
	s3Mu.RLock()
	defer s3Mu.RUnlock()
	return s3Config
}

func ParseS3Config(data []byte) (S3Config, error) {
	config := DefaultS3Config()
	if len(bytes.TrimSpace(data)) == 0 {
		return config, nil
	}
	if err := json.Unmarshal(data, &config); err != nil {
		return config, err
	}
	return NormalizeS3Config(config)
}

func NormalizeS3Config(config S3Config) (S3Config, error) {
	defaults := DefaultS3Config()
	config.Endpoint = strings.TrimRight(strings.TrimSpace(firstNonEmpty(config.Endpoint, defaults.Endpoint)), "/")
	config.Bucket = strings.TrimSpace(firstNonEmpty(config.Bucket, defaults.Bucket))
	config.Region = strings.TrimSpace(firstNonEmpty(config.Region, defaults.Region))
	config.AccessKeyID = strings.TrimSpace(config.AccessKeyID)
	config.SecretAccessKey = strings.TrimSpace(config.SecretAccessKey)
	config.PublicURLPrefix = strings.TrimRight(strings.TrimSpace(firstNonEmpty(config.PublicURLPrefix, config.Endpoint+"/"+config.Bucket)), "/")
	config.ForcePathStyle = true
	if config.Endpoint == "" {
		return config, fmt.Errorf("endpoint is required")
	}
	if _, err := url.ParseRequestURI(config.Endpoint); err != nil {
		return config, fmt.Errorf("endpoint is invalid: %w", err)
	}
	if config.Bucket == "" {
		return config, fmt.Errorf("bucket is required")
	}
	if config.Region == "" {
		return config, fmt.Errorf("region is required")
	}
	return config, nil
}

func IsS3Configured() bool {
	config := GetS3Config()
	return config.Endpoint != "" && config.Bucket != "" && config.Region != "" &&
		config.AccessKeyID != "" && config.SecretAccessKey != ""
}

func UploadBytes(ctx context.Context, objectKey string, data []byte) (string, error) {
	config := GetS3Config()
	return UploadBytesWithConfig(ctx, config, objectKey, data, ContentTypeByKey(objectKey))
}

func UploadBytesWithConfig(ctx context.Context, config S3Config, objectKey string, data []byte, contentType string) (string, error) {
	normalized, err := NormalizeS3Config(config)
	if err != nil {
		return "", err
	}
	if normalized.AccessKeyID == "" || normalized.SecretAccessKey == "" {
		return "", fmt.Errorf("s3 credentials are required")
	}
	objectKey = strings.TrimLeft(path.Clean("/"+objectKey), "/")
	if objectKey == "." || objectKey == "" {
		return "", fmt.Errorf("object key is required")
	}
	if contentType == "" {
		contentType = ContentTypeByKey(objectKey)
	}

	endpointURL, err := url.Parse(normalized.Endpoint)
	if err != nil {
		return "", err
	}
	endpointURL.Path = "/" + strings.TrimLeft(path.Join(normalized.Bucket, objectKey), "/")
	endpointURL.RawPath = "/" + EncodePath(strings.TrimLeft(path.Join(normalized.Bucket, objectKey), "/"))

	req, err := http.NewRequestWithContext(ctx, http.MethodPut, endpointURL.String(), bytes.NewReader(data))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", contentType)
	signS3Request(req, normalized, data)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
		return "", fmt.Errorf("s3 upload failed status %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
	return PublicURL(normalized, objectKey), nil
}

func PublicURL(config S3Config, objectKey string) string {
	prefix := strings.TrimRight(config.PublicURLPrefix, "/")
	if prefix == "" {
		prefix = strings.TrimRight(config.Endpoint, "/") + "/" + strings.Trim(config.Bucket, "/")
	}
	return prefix + "/" + EncodePath(strings.TrimLeft(objectKey, "/"))
}

func ObjectKeyFromPublicURL(rawURL string) (string, bool) {
	config := GetS3Config()
	prefix := strings.TrimRight(config.PublicURLPrefix, "/") + "/"
	if prefix == "/" || !strings.HasPrefix(rawURL, prefix) {
		return "", false
	}
	key := strings.TrimPrefix(rawURL, prefix)
	parts := strings.Split(key, "/")
	for i, part := range parts {
		decoded, err := url.PathUnescape(part)
		if err != nil {
			return "", false
		}
		parts[i] = decoded
	}
	return strings.Join(parts, "/"), true
}

func EncodePath(key string) string {
	parts := strings.Split(key, "/")
	for i, part := range parts {
		parts[i] = url.PathEscape(part)
	}
	return strings.Join(parts, "/")
}

func ContentTypeByKey(key string) string {
	contentType := mime.TypeByExtension(strings.ToLower(filepath.Ext(key)))
	if contentType != "" {
		return contentType
	}
	switch strings.ToLower(filepath.Ext(key)) {
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".png":
		return "image/png"
	case ".webp":
		return "image/webp"
	case ".gif":
		return "image/gif"
	case ".mp4":
		return "video/mp4"
	case ".pdf":
		return "application/pdf"
	default:
		return "application/octet-stream"
	}
}

func signS3Request(req *http.Request, config S3Config, payload []byte) {
	now := time.Now().UTC()
	amzDate := now.Format("20060102T150405Z")
	dateStamp := now.Format("20060102")
	payloadHash := sha256Hex(payload)
	req.Header.Set("X-Amz-Date", amzDate)
	req.Header.Set("X-Amz-Content-Sha256", payloadHash)

	canonicalURI := req.URL.EscapedPath()
	canonicalHeaders := fmt.Sprintf(
		"content-type:%s\nhost:%s\nx-amz-content-sha256:%s\nx-amz-date:%s\n",
		req.Header.Get("Content-Type"),
		req.Host,
		payloadHash,
		amzDate,
	)
	signedHeaders := "content-type;host;x-amz-content-sha256;x-amz-date"
	canonicalRequest := strings.Join([]string{
		req.Method,
		canonicalURI,
		"",
		canonicalHeaders,
		signedHeaders,
		payloadHash,
	}, "\n")
	scope := fmt.Sprintf("%s/%s/s3/aws4_request", dateStamp, config.Region)
	stringToSign := strings.Join([]string{
		"AWS4-HMAC-SHA256",
		amzDate,
		scope,
		sha256Hex([]byte(canonicalRequest)),
	}, "\n")
	signingKey := s3SigningKey(config.SecretAccessKey, dateStamp, config.Region)
	signature := hex.EncodeToString(hmacSHA256(signingKey, stringToSign))
	req.Header.Set("Authorization", fmt.Sprintf(
		"AWS4-HMAC-SHA256 Credential=%s/%s, SignedHeaders=%s, Signature=%s",
		config.AccessKeyID,
		scope,
		signedHeaders,
		signature,
	))
}

func s3SigningKey(secret, dateStamp, region string) []byte {
	dateKey := hmacSHA256([]byte("AWS4"+secret), dateStamp)
	dateRegionKey := hmacSHA256(dateKey, region)
	dateRegionServiceKey := hmacSHA256(dateRegionKey, "s3")
	return hmacSHA256(dateRegionServiceKey, "aws4_request")
}

func hmacSHA256(key []byte, data string) []byte {
	mac := hmac.New(sha256.New, key)
	mac.Write([]byte(data))
	return mac.Sum(nil)
}

func sha256Hex(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}
