package realtime

import "testing"

func TestBroadcastReachesAllSubscribers(t *testing.T) {
	service := NewService()
	userCh, cleanupUser := service.Subscribe("1", false)
	defer cleanupUser()
	adminCh, cleanupAdmin := service.Subscribe("2", true)
	defer cleanupAdmin()

	service.Broadcast(EventTasksChanged, map[string]any{"task_id": 1})

	assertEventReceived(t, userCh, EventTasksChanged)
	assertEventReceived(t, adminCh, EventTasksChanged)
}

func TestBroadcastToAdminsSkipsNormalUsers(t *testing.T) {
	service := NewService()
	userCh, cleanupUser := service.Subscribe("1", false)
	defer cleanupUser()
	adminCh, cleanupAdmin := service.Subscribe("2", true)
	defer cleanupAdmin()

	service.BroadcastToAdmins(EventAdminUsersChanged, map[string]any{"user_id": "1"})

	assertEventReceived(t, adminCh, EventAdminUsersChanged)
	assertNoEvent(t, userCh)
}

func TestSendToUserOnlyReachesTargetUser(t *testing.T) {
	service := NewService()
	targetCh, cleanupTarget := service.Subscribe("1", false)
	defer cleanupTarget()
	otherCh, cleanupOther := service.Subscribe("2", true)
	defer cleanupOther()

	service.SendToUser("1", EventPointsChanged, map[string]any{"delta": 10})

	assertEventReceived(t, targetCh, EventPointsChanged)
	assertNoEvent(t, otherCh)
}

func TestUnsubscribeClosesChannel(t *testing.T) {
	service := NewService()
	ch, cleanup := service.Subscribe("1", false)

	cleanup()

	_, ok := <-ch
	if ok {
		t.Fatalf("channel is still open after unsubscribe")
	}
}

func assertEventReceived(t *testing.T, ch <-chan Event, eventType string) {
	t.Helper()
	select {
	case event := <-ch:
		if event.Type != eventType {
			t.Fatalf("event type = %q, want %q", event.Type, eventType)
		}
	default:
		t.Fatalf("expected event %q", eventType)
	}
}

func assertNoEvent(t *testing.T, ch <-chan Event) {
	t.Helper()
	select {
	case event := <-ch:
		t.Fatalf("unexpected event received: %#v", event)
	default:
	}
}
