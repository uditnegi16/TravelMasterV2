package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"travelmaster/go-kafka-consumer/internal/models"
)

func TestNewRegistersRoutes(t *testing.T) {
	s := New()

	if s.Router == nil {
		t.Fatal("expected New() to initialize a Router")
	}
	if s.Trips == nil {
		t.Fatal("expected New() to initialize the Trips map")
	}
}

func TestLiveEndpoint(t *testing.T) {
	s := New()

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
	s := New()

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
	s := New()

	req := httptest.NewRequest(http.MethodGet, "/result/does-not-exist", nil)
	rec := httptest.NewRecorder()

	s.Router.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected status 404 for an unknown session, got %d", rec.Code)
	}
}

func TestGetTrip_Found(t *testing.T) {
	s := New()

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
	s := New()

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
