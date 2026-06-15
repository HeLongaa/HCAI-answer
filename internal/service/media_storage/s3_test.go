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
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestEncodePathAndPublicURL(t *testing.T) {
	config := DefaultS3Config()
	got := PublicURL(config, "uploads/hello world/图.png")
	want := "https://storage.hctopup.com/chat.hctopup.com/uploads/hello%20world/%E5%9B%BE.png"
	if got != want {
		t.Fatalf("PublicURL = %q, want %q", got, want)
	}
}

func TestObjectKeyFromPublicURL(t *testing.T) {
	restore := GetS3Config()
	defer func() { _ = SetS3Config(restore) }()
	if err := SetS3Config(DefaultS3Config()); err != nil {
		t.Fatal(err)
	}
	key, ok := ObjectKeyFromPublicURL("https://storage.hctopup.com/chat.hctopup.com/uploads/hello%20world/%E5%9B%BE.png")
	if !ok {
		t.Fatal("ObjectKeyFromPublicURL did not match public prefix")
	}
	if key != "uploads/hello world/图.png" {
		t.Fatalf("key = %q", key)
	}
}

func TestUploadBytesWithConfigUsesPathStyleAndSignedPut(t *testing.T) {
	var gotPath, gotAuth, gotContentType, gotHash, gotBody string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.EscapedPath()
		gotAuth = r.Header.Get("Authorization")
		gotContentType = r.Header.Get("Content-Type")
		gotHash = r.Header.Get("X-Amz-Content-Sha256")
		body, _ := io.ReadAll(r.Body)
		gotBody = string(body)
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	config := DefaultS3Config()
	config.Endpoint = server.URL
	config.AccessKeyID = "access"
	config.SecretAccessKey = "secret"
	url, err := UploadBytesWithConfig(context.Background(), config, "uploads/demo image.png", []byte("hello"), "image/png")
	if err != nil {
		t.Fatalf("UploadBytesWithConfig returned error: %v", err)
	}
	if gotPath != "/chat.hctopup.com/uploads/demo%20image.png" {
		t.Fatalf("path = %q", gotPath)
	}
	if !strings.HasPrefix(gotAuth, "AWS4-HMAC-SHA256 Credential=access/") {
		t.Fatalf("authorization header = %q", gotAuth)
	}
	if gotContentType != "image/png" {
		t.Fatalf("content-type = %q", gotContentType)
	}
	if gotHash == "" {
		t.Fatal("missing payload hash")
	}
	if gotBody != "hello" {
		t.Fatalf("body = %q", gotBody)
	}
	if url != "https://storage.hctopup.com/chat.hctopup.com/uploads/demo%20image.png" {
		t.Fatalf("returned url = %q", url)
	}
}
