package ai_chat_config

import (
	"context"
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/apache/answer/internal/entity"
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

func TestNormalizeProviderBaseURLRejectsUnsafeURLs(t *testing.T) {
	tests := []string{
		"file:///etc/passwd",
		"http://127.0.0.1:8080/v1",
		"http://localhost:8080/v1",
	}
	for _, raw := range tests {
		if got, err := normalizeProviderBaseURL(context.Background(), raw); err == nil {
			t.Fatalf("normalizeProviderBaseURL(%q) = %q, want error", raw, got)
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
