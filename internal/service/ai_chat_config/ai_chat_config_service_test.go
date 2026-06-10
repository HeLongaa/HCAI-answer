package ai_chat_config

import (
	"bytes"
	"context"
	"encoding/base64"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/apache/answer/internal/entity"
	"github.com/apache/answer/internal/service/service_config"
)

func TestMonthRange(t *testing.T) {
	loc := time.FixedZone("test", 8*60*60)
	now := time.Date(2026, time.June, 6, 15, 30, 0, 0, loc)

	start, end := monthRange(now)

	wantStart := time.Date(2026, time.June, 1, 0, 0, 0, 0, loc)
	wantEnd := time.Date(2026, time.July, 1, 0, 0, 0, 0, loc)
	if !start.Equal(wantStart) {
		t.Fatalf("start = %s, want %s", start, wantStart)
	}
	if !end.Equal(wantEnd) {
		t.Fatalf("end = %s, want %s", end, wantEnd)
	}
}

func TestDayRange(t *testing.T) {
	loc := time.FixedZone("test", 8*60*60)
	now := time.Date(2026, time.June, 6, 15, 30, 0, 0, loc)

	start, end := dayRange(now)

	wantStart := time.Date(2026, time.June, 6, 0, 0, 0, 0, loc)
	wantEnd := time.Date(2026, time.June, 7, 0, 0, 0, 0, loc)
	if !start.Equal(wantStart) {
		t.Fatalf("start = %s, want %s", start, wantStart)
	}
	if !end.Equal(wantEnd) {
		t.Fatalf("end = %s, want %s", end, wantEnd)
	}
}

func TestSubscriptionRedeemRangeSameActivePlanExtendsCurrentExpiry(t *testing.T) {
	now := time.Date(2026, time.June, 6, 12, 0, 0, 0, time.UTC)
	startedAt := now.AddDate(0, -1, 0)
	expiresAt := now.AddDate(0, 1, 0)
	user := &entity.User{
		SubscriptionLevel:     "pro",
		SubscriptionStartedAt: startedAt,
		SubscriptionExpiresAt: expiresAt,
	}

	start, base := subscriptionRedeemRange(user, "pro", now)

	if !start.Equal(startedAt) {
		t.Fatalf("start = %s, want %s", start, startedAt)
	}
	if !base.Equal(expiresAt) {
		t.Fatalf("base = %s, want %s", base, expiresAt)
	}
}

func TestSubscriptionRedeemRangeDifferentActivePlanStartsNow(t *testing.T) {
	now := time.Date(2026, time.June, 6, 12, 0, 0, 0, time.UTC)
	user := &entity.User{
		SubscriptionLevel:     "basic",
		SubscriptionStartedAt: now.AddDate(0, -1, 0),
		SubscriptionExpiresAt: now.AddDate(0, 1, 0),
	}

	start, base := subscriptionRedeemRange(user, "pro", now)

	if !start.Equal(now) {
		t.Fatalf("start = %s, want %s", start, now)
	}
	if !base.Equal(now) {
		t.Fatalf("base = %s, want %s", base, now)
	}
}

func TestSubscriptionRedeemRangeExpiredPlanStartsNow(t *testing.T) {
	now := time.Date(2026, time.June, 6, 12, 0, 0, 0, time.UTC)
	user := &entity.User{
		SubscriptionLevel:     "pro",
		SubscriptionStartedAt: now.AddDate(0, -2, 0),
		SubscriptionExpiresAt: now.AddDate(0, -1, 0),
	}

	start, base := subscriptionRedeemRange(user, "pro", now)

	if !start.Equal(now) {
		t.Fatalf("start = %s, want %s", start, now)
	}
	if !base.Equal(now) {
		t.Fatalf("base = %s, want %s", base, now)
	}
}

func TestNormalizeVideoStatus(t *testing.T) {
	if got := normalizeVideoStatus(entity.AIVideoStatusQueued); got != entity.AIVideoStatusQueued {
		t.Fatalf("queued status = %s", got)
	}
	if got := normalizeVideoStatus(entity.AIVideoStatusCompleted); got != entity.AIVideoStatusCompleted {
		t.Fatalf("completed status = %s", got)
	}
	if got := normalizeVideoStatus("processing"); got != entity.AIVideoStatusInProgress {
		t.Fatalf("processing status = %s, want %s", got, entity.AIVideoStatusInProgress)
	}
}

func TestPrepareReferenceImagesRejectsTooManyVideoReferences(t *testing.T) {
	rawImage := "data:image/png;base64," + base64.StdEncoding.EncodeToString([]byte("png"))
	_, err := prepareReferenceImages(context.Background(), []string{
		rawImage,
		rawImage,
		rawImage,
		rawImage,
		rawImage,
	}, referenceImageOptions{MaxCount: videoReferenceImageMaxCount})
	if err == nil || !strings.Contains(err.Error(), "cannot be greater than 4") {
		t.Fatalf("err = %v, want max count error", err)
	}
}

func TestPrepareReferenceImagesRejectsOversizedVideoReference(t *testing.T) {
	rawImage := "data:image/png;base64," + base64.StdEncoding.EncodeToString([]byte("123456"))
	_, err := prepareReferenceImages(context.Background(), []string{rawImage}, referenceImageOptions{MaxBytes: 5})
	if err == nil || !strings.Contains(err.Error(), "too large") {
		t.Fatalf("err = %v, want too large error", err)
	}
}

func TestDownloadImageRejectsPrivateHostForVideoReference(t *testing.T) {
	_, _, err := downloadImage(context.Background(), "https://127.0.0.1/image.png", imageDownloadOptions{
		RequireHTTPS:   true,
		BlockPrivateIP: true,
	})
	if err == nil || !strings.Contains(err.Error(), "not allowed") {
		t.Fatalf("err = %v, want private host error", err)
	}
}

func TestDownloadImageRejectsNonImageResponse(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/plain")
		_, _ = w.Write([]byte("not an image"))
	}))
	defer server.Close()

	_, _, err := downloadImage(context.Background(), server.URL, imageDownloadOptions{})
	if err == nil || !strings.Contains(err.Error(), "not an image") {
		t.Fatalf("err = %v, want non-image error", err)
	}
}

func TestSaveGeminiImageResponse(t *testing.T) {
	dir := t.TempDir()
	service := &aiChatConfigService{
		serviceConfig: &service_config.ServiceConfig{UploadPath: dir},
	}
	body := []byte(`{
		"candidates": [
			{
				"content": {
					"role": "model",
					"parts": [
						{
							"inlineData": {
								"mimeType": "image/png",
								"data": "` + base64.StdEncoding.EncodeToString([]byte("png-data")) + `"
							}
						}
					]
				}
			}
		]
	}`)

	urls, err := service.saveGeminiImageResponse(context.Background(), "1", "img_test", body)
	if err != nil {
		t.Fatalf("saveGeminiImageResponse err = %v", err)
	}
	if len(urls) != 1 || urls[0] != "/uploads/ai-images/1/img_test-1.png" {
		t.Fatalf("urls = %#v, want saved image URL", urls)
	}
	if _, err := os.Stat(dir + "/ai-images/1/img_test-1.png"); err != nil {
		t.Fatalf("saved file missing: %v", err)
	}
}

func TestNormalizeProviderBaseURLRejectsUnsupportedSchemes(t *testing.T) {
	tests := []string{
		"file:///etc/passwd",
	}
	for _, raw := range tests {
		if got, err := normalizeProviderBaseURL(context.Background(), raw); err == nil {
			t.Fatalf("normalizeProviderBaseURL(%q) = %q, want error", raw, got)
		}
	}
}

func TestNormalizeProviderBaseURLAllowsLocalAdminProviders(t *testing.T) {
	tests := []string{
		"http://127.0.0.1:8080/v1",
		"http://localhost:8080/v1",
	}
	for _, raw := range tests {
		if got, err := normalizeProviderBaseURL(context.Background(), raw); err != nil || got != raw {
			t.Fatalf("normalizeProviderBaseURL(%q) = %q, %v; want %q, nil", raw, got, err, raw)
		}
	}
}

func TestSafeUpstreamResponseRedactsSecrets(t *testing.T) {
	raw := []byte(`{"error":"bad","authorization":"Bearer sk-secret","api_key":"sk-api","nested":{"access_token":"tok-value"}}`)

	got := safeUpstreamResponse(raw)

	for _, secret := range []string{"sk-secret", "sk-api", "tok-value"} {
		if strings.Contains(got, secret) {
			t.Fatalf("safeUpstreamResponse leaked %q in %q", secret, got)
		}
	}
	if !strings.Contains(got, "<redacted>") {
		t.Fatalf("safeUpstreamResponse = %q, want redacted marker", got)
	}
}

func TestSafeUpstreamResponseOmitsImagePayloads(t *testing.T) {
	raw := []byte(`{"b64_json":"final-image","partial_image_b64":"partial-image","result":"response-image","image_url":"data:image/png;base64,abc"}`)

	got := safeUpstreamResponse(raw)

	for _, value := range []string{"final-image", "partial-image", "response-image", "base64,abc"} {
		if strings.Contains(got, value) {
			t.Fatalf("safeUpstreamResponse leaked image payload %q in %q", value, got)
		}
	}
	if !strings.Contains(got, "<omitted>") {
		t.Fatalf("safeUpstreamResponse = %q, want omitted marker", got)
	}
}

func TestParseImageStreamBlockPartial(t *testing.T) {
	result, err := parseImageStreamBlock(`data: {"type":"response.image_generation_call.partial_image","partial_image_b64":"cGFydGlhbA==","partial_image_index":0}`+"\n\n", "1024x1024")
	if err != nil {
		t.Fatalf("parseImageStreamBlock returned error: %v", err)
	}
	if !result.Forward || result.PartialImageB64 != "cGFydGlhbA==" {
		t.Fatalf("partial result = %+v, want forwarded partial image", result)
	}
}

func TestParseImageStreamBlockIgnoresSSEComments(t *testing.T) {
	result, err := parseImageStreamBlock(": keep-alive\n\n", "")
	if err != nil {
		t.Fatalf("parseImageStreamBlock returned error: %v", err)
	}
	if result == nil || !result.Empty {
		t.Fatalf("result = %+v, want empty comment block", result)
	}
}

func TestWriteImageSSEComment(t *testing.T) {
	var out strings.Builder

	_ = writeImageSSEComment(&out, "keep\nalive")

	if got := out.String(); got != ": keep alive\n\n" {
		t.Fatalf("comment = %q, want SSE comment", got)
	}
}

func TestShouldRetryImageStreamStatus(t *testing.T) {
	for _, status := range []int{http.StatusTooManyRequests, http.StatusBadGateway, http.StatusServiceUnavailable, http.StatusGatewayTimeout, 524} {
		if !shouldRetryImageStreamStatus(status, nil) {
			t.Fatalf("status %d should be retryable", status)
		}
	}
	if shouldRetryImageStreamStatus(http.StatusUnauthorized, nil) {
		t.Fatalf("401 should not be retryable")
	}
}

func TestProxyAndSaveImageStreamWritesHeartbeatDuringSilentUpstream(t *testing.T) {
	oldHeartbeat := imageStreamHeartbeatInterval
	oldIdle := imageStreamUpstreamIdleLimit
	imageStreamHeartbeatInterval = 10 * time.Millisecond
	imageStreamUpstreamIdleLimit = 35 * time.Millisecond
	t.Cleanup(func() {
		imageStreamHeartbeatInterval = oldHeartbeat
		imageStreamUpstreamIdleLimit = oldIdle
	})
	reader, writer := io.Pipe()
	defer reader.Close()
	defer writer.Close()
	var out bytes.Buffer
	flushCount := 0
	service := &aiChatConfigService{}

	_, err := service.proxyAndSaveImageStream(context.Background(), context.Background(), reader, &out, func() {
		flushCount++
	}, "user-a", "generation-a", "1024x1024")

	if err == nil || !strings.Contains(err.Error(), "idle timeout") {
		t.Fatalf("err = %v, want idle timeout", err)
	}
	if !strings.Contains(out.String(), ": keep-alive\n\n") {
		t.Fatalf("stream output = %q, want heartbeat comment", out.String())
	}
	if flushCount == 0 {
		t.Fatalf("flush count = 0, want heartbeat flush")
	}
}

func TestProxyAndSaveImageStreamFailsWithoutFinalImage(t *testing.T) {
	body := strings.NewReader(`data: {"type":"response.image_generation_call.partial_image","partial_image_b64":"cGFydGlhbA==","partial_image_index":0}` + "\n\n")
	var out bytes.Buffer
	service := &aiChatConfigService{}

	finalBody, err := service.proxyAndSaveImageStream(context.Background(), context.Background(), body, &out, func() {}, "user-a", "generation-a", "1024x1024")

	if err == nil || !strings.Contains(err.Error(), "did not return final image data") {
		t.Fatalf("err = %v, want missing final image error", err)
	}
	if len(finalBody) != 0 {
		t.Fatalf("final body = %s, want empty body", string(finalBody))
	}
	if !strings.Contains(out.String(), "partial_image") {
		t.Fatalf("stream output = %q, want forwarded partial event", out.String())
	}
}

func TestProxyAndSaveImageStreamReturnsWhenFinalArrivesBeforeEOF(t *testing.T) {
	reader, writer := io.Pipe()
	defer reader.Close()
	defer writer.Close()
	var out bytes.Buffer
	service := &aiChatConfigService{}
	resultCh := make(chan struct {
		body []byte
		err  error
	}, 1)

	go func() {
		body, err := service.proxyAndSaveImageStream(context.Background(), context.Background(), reader, &out, func() {}, "user-a", "generation-a", "1024x1024")
		resultCh <- struct {
			body []byte
			err  error
		}{body: body, err: err}
	}()

	_, err := writer.Write([]byte(`data: {"type":"response.output_item.done","item":{"type":"image_generation_call","result":"ZmluYWw="},"output_index":0}` + "\n\n"))
	if err != nil {
		t.Fatalf("write final event: %v", err)
	}

	select {
	case result := <-resultCh:
		if result.err != nil {
			t.Fatalf("proxyAndSaveImageStream returned error: %v", result.err)
		}
		if !responseBodyHasImageData(result.body) {
			t.Fatalf("final body = %s, want image data", string(result.body))
		}
	case <-time.After(500 * time.Millisecond):
		t.Fatal("proxyAndSaveImageStream did not return after final image event")
	}
}

func TestProxyAndSaveImageStreamContinuesWhenDownstreamWriteBlocks(t *testing.T) {
	oldDownstreamTimeout := imageStreamDownstreamTimeout
	imageStreamDownstreamTimeout = 10 * time.Millisecond
	t.Cleanup(func() {
		imageStreamDownstreamTimeout = oldDownstreamTimeout
	})

	body := strings.NewReader(
		`data: {"type":"response.image_generation_call.partial_image","partial_image_b64":"cGFydGlhbA==","partial_image_index":0}` + "\n\n" +
			`data: {"type":"response.output_item.done","item":{"type":"image_generation_call","result":"ZmluYWw="},"output_index":0}` + "\n\n",
	)
	writer := newBlockingWriter()
	t.Cleanup(writer.release)
	service := &aiChatConfigService{}

	finalBody, err := service.proxyAndSaveImageStream(context.Background(), context.Background(), body, writer, func() {}, "user-a", "generation-a", "1024x1024")

	if err != nil {
		t.Fatalf("proxyAndSaveImageStream returned error: %v", err)
	}
	if !responseBodyHasImageData(finalBody) {
		t.Fatalf("final body = %s, want image data", string(finalBody))
	}
	if !writer.blocked() {
		t.Fatalf("writer did not observe a blocked downstream write")
	}
}

type blockingWriter struct {
	started     chan struct{}
	releaseOnce sync.Once
	released    chan struct{}
}

func newBlockingWriter() *blockingWriter {
	return &blockingWriter{
		started:  make(chan struct{}),
		released: make(chan struct{}),
	}
}

func (w *blockingWriter) Write(p []byte) (int, error) {
	select {
	case <-w.started:
	default:
		close(w.started)
	}
	<-w.released
	return len(p), nil
}

func (w *blockingWriter) blocked() bool {
	select {
	case <-w.started:
		return true
	default:
		return false
	}
}

func (w *blockingWriter) release() {
	w.releaseOnce.Do(func() {
		close(w.released)
	})
}
