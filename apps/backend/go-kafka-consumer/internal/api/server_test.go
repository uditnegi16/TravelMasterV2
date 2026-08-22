package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"travelmaster/go-kafka-consumer/internal/models"
)

func TestNewRegistersRoutes(t *testing.T) {
	s := New(false)

	if s.Router == nil {
		t.Fatal("expected New() to initialize a Router")
	}
	if s.Trips == nil {
		t.Fatal("expected New() to initialize the Trips map")
	}
}

func TestLiveEndpoint(t *testing.T) {
	s := New(false)

	req := httptest.NewRequest(http.MethodGet, "/health/live", nil)
	rec := httptest.NewRecorder()

	s.Router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rec.Code)
	}

	var body map[string]string
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response body: %v", err)
	}
	if body["status"] != "UP" {
		t.Fatalf(`expected status "UP", got %q`, body["status"])
	}
	if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
		t.Fatalf("expected Content-Type application/json, got %q", ct)
	}
}

func TestReadyEndpoint(t *testing.T) {
	s := New(false)

	req := httptest.NewRequest(http.MethodGet, "/health/ready", nil)
	rec := httptest.NewRecorder()

	s.Router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rec.Code)
	}

	var body map[string]string
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response body: %v", err)
	}
	if body["status"] != "READY" {
		t.Fatalf(`expected status "READY", got %q`, body["status"])
	}
}

func TestGetTrip_NotFound(t *testing.T) {
	s := New(false)

	req := httptest.NewRequest(http.MethodGet, "/result/does-not-exist", nil)
	rec := httptest.NewRecorder()

	s.Router.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected status 404 for an unknown session, got %d", rec.Code)
	}
}

func TestGetTrip_Found(t *testing.T) {
	s := New(false)

	trip := models.AggregatedTrip{
		SessionID: "session-1",
		Flight:    json.RawMessage(`{"airline":"IndiGo"}`),
	}
	s.SaveTrip(trip)

	req := httptest.NewRequest(http.MethodGet, "/result/session-1", nil)
	rec := httptest.NewRecorder()

	s.Router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rec.Code)
	}

	var got models.AggregatedTrip
	if err := json.NewDecoder(rec.Body).Decode(&got); err != nil {
		t.Fatalf("failed to decode response body: %v", err)
	}
	if got.SessionID != "session-1" {
		t.Fatalf("expected session_id %q, got %q", "session-1", got.SessionID)
	}
	if string(got.Flight) != `{"airline":"IndiGo"}` {
		t.Fatalf("expected flight payload to round-trip, got %s", string(got.Flight))
	}
}

func TestSaveTrip_OverwritesExisting(t *testing.T) {
	s := New(false)

	s.SaveTrip(models.AggregatedTrip{SessionID: "session-1", Flight: json.RawMessage(`{"v":1}`)})
	s.SaveTrip(models.AggregatedTrip{SessionID: "session-1", Flight: json.RawMessage(`{"v":2}`)})

	req := httptest.NewRequest(http.MethodGet, "/result/session-1", nil)
	rec := httptest.NewRecorder()
	s.Router.ServeHTTP(rec, req)

	var got models.AggregatedTrip
	if err := json.NewDecoder(rec.Body).Decode(&got); err != nil {
		t.Fatalf("failed to decode response body: %v", err)
	}
	if string(got.Flight) != `{"v":2}` {
		t.Fatalf("expected the second SaveTrip call to overwrite the first, got %s", string(got.Flight))
	}
}

func TestSeedEndpoint_AbsentByDefault(t *testing.T) {
	// Genuinely not registered when disabled -- not just unauthenticated.
	// A 404 here means the route table itself has no handler for it,
	// matching http.NewServeMux's behavior for an unregistered path.
	s := New(false)

	req := httptest.NewRequest(http.MethodPost, "/test/seed", nil)
	rec := httptest.NewRecorder()
	s.Router.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected /test/seed to be entirely absent (404) when disabled, got %d", rec.Code)
	}
}

func TestSeedEndpoint_PopulatesTripWhenEnabled(t *testing.T) {
	s := New(true)

	body := `{"session_id":"seeded-1","flight":{"airline":"IndiGo"}}`
	req := httptest.NewRequest(http.MethodPost, "/test/seed", strings.NewReader(body))
	rec := httptest.NewRecorder()
	s.Router.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected status 201, got %d", rec.Code)
	}

	getReq := httptest.NewRequest(http.MethodGet, "/result/seeded-1", nil)
	getRec := httptest.NewRecorder()
	s.Router.ServeHTTP(getRec, getReq)

	if getRec.Code != http.StatusOK {
		t.Fatalf("expected the seeded session to be readable, got status %d", getRec.Code)
	}
}

func TestSeedEndpoint_RejectsMissingSessionID(t *testing.T) {
	s := New(true)

	req := httptest.NewRequest(http.MethodPost, "/test/seed", strings.NewReader(`{"flight":{}}`))
	rec := httptest.NewRecorder()
	s.Router.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400 for a missing session_id, got %d", rec.Code)
	}
}

func TestSeedEndpoint_RejectsNonPost(t *testing.T) {
	s := New(true)

	req := httptest.NewRequest(http.MethodGet, "/test/seed", nil)
	rec := httptest.NewRecorder()
	s.Router.ServeHTTP(rec, req)

	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected status 405 for a GET, got %d", rec.Code)
	}
}
