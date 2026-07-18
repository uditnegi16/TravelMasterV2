package aggregator

import (
	"sync"
	"testing"
)

func TestSessionStore_GetCreatesNewSession(t *testing.T) {
	store := NewSessionStore()

	session := store.Get("session-1")

	if session == nil {
		t.Fatal("expected a non-nil session")
	}
	if session.Received == nil {
		t.Fatal("expected Received map to be initialized")
	}
	if len(session.Received) != 0 {
		t.Fatalf("expected empty Received map, got %d entries", len(session.Received))
	}
}

func TestSessionStore_GetReturnsSameSessionForSameID(t *testing.T) {
	store := NewSessionStore()

	first := store.Get("session-1")
	first.Received["flights"] = true

	second := store.Get("session-1")

	if second != first {
		t.Fatal("expected Get to return the same *SessionData pointer for the same session ID")
	}
	if !second.Received["flights"] {
		t.Fatal("expected mutation on first reference to be visible on second reference")
	}
}

func TestSessionStore_GetIsolatesDifferentSessions(t *testing.T) {
	store := NewSessionStore()

	a := store.Get("session-a")
	b := store.Get("session-b")

	if a == b {
		t.Fatal("expected different session IDs to produce different *SessionData pointers")
	}
}

func TestSessionStore_Delete(t *testing.T) {
	store := NewSessionStore()

	first := store.Get("session-1")
	first.Received["flights"] = true

	store.Delete("session-1")

	second := store.Get("session-1")
	if second == first {
		t.Fatal("expected Delete to remove the session so Get creates a fresh one")
	}
	if second.Received["flights"] {
		t.Fatal("expected fresh session to not carry over old state")
	}
}

func TestSessionStore_DeleteNonExistentIsNoop(t *testing.T) {
	store := NewSessionStore()

	// Should not panic when deleting a session that was never created.
	store.Delete("does-not-exist")
}

// TestSessionStore_ConcurrentAccess exercises the store's own mutex under
// the race detector (`go test -race`) to catch data races in Get/Delete.
//
// NOTE: this intentionally does NOT mutate SessionData.Received from
// multiple goroutines concurrently on the *same* session ID. SessionStore
// only guards its own map (create/lookup/delete) — the SessionData struct
// returned by Get() has no lock of its own. In production that's safe
// because only the single-threaded main select loop in main.go ever calls
// Process()/mutates a session's Received map. If that assumption ever
// changes (e.g. processing moves onto worker goroutines), SessionData
// itself will need its own mutex to avoid "concurrent map writes" panics.
func TestSessionStore_ConcurrentAccess(t *testing.T) {
	store := NewSessionStore()

	var wg sync.WaitGroup
	sessionIDs := []string{"s1", "s2", "s3", "s4", "s5"}

	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func(iteration int) {
			defer wg.Done()
			id := sessionIDs[iteration%len(sessionIDs)]

			store.Get(id)

			if iteration%10 == 0 {
				store.Delete(id)
			}
		}(i)
	}

	wg.Wait()
}
