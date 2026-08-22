package api

import (
	"encoding/json"
	"net/http"
	"strings"
	"sync"

	"travelmaster/go-kafka-consumer/internal/metrics"
	"travelmaster/go-kafka-consumer/internal/models"
)

type Server struct {
	mu     sync.RWMutex
	Trips  map[string]models.AggregatedTrip
	Router *http.ServeMux
}

func New(enableTestSeed bool) *Server {

	router := http.NewServeMux()

	s := &Server{
		Trips:  make(map[string]models.AggregatedTrip),
		Router: router,
	}

	// Business API
	router.HandleFunc("/result/", s.GetTrip)

	// Health Endpoints
	router.HandleFunc("/health/live", s.Live)
	router.HandleFunc("/health/ready", s.Ready)

	// Test-only: populates Trips directly over HTTP, so a load test can
	// exercise many unique, realistic session IDs without needing to
	// run the full Kafka pipeline just to seed read data. Only
	// registered when ENABLE_TEST_SEED=true is explicitly set --
	// absent from the route table entirely otherwise, not just
	// unauthenticated-but-present.
	if enableTestSeed {
		router.HandleFunc("/test/seed", s.SeedTrip)
	}

	return s
}

func (s *Server) Live(w http.ResponseWriter, r *http.Request) {

	w.Header().Set("Content-Type", "application/json")

	json.NewEncoder(w).Encode(map[string]string{
		"status": "UP",
	})
}

func (s *Server) Ready(w http.ResponseWriter, r *http.Request) {

	w.Header().Set("Content-Type", "application/json")

	json.NewEncoder(w).Encode(map[string]string{
		"status": "READY",
	})
}

func (s *Server) GetTrip(w http.ResponseWriter, r *http.Request) {

	metrics.HTTPRequests.WithLabelValues("/result").Inc()

	sessionID := strings.TrimPrefix(r.URL.Path, "/result/")

	s.mu.RLock()
	trip, ok := s.Trips[sessionID]
	s.mu.RUnlock()

	if !ok {
		http.NotFound(w, r)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(trip)
}

func (s *Server) SaveTrip(trip models.AggregatedTrip) {

	s.mu.Lock()
	defer s.mu.Unlock()

	s.Trips[trip.SessionID] = trip
}

func (s *Server) SeedTrip(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var trip models.AggregatedTrip
	if err := json.NewDecoder(r.Body).Decode(&trip); err != nil {
		http.Error(w, "invalid JSON body", http.StatusBadRequest)
		return
	}

	if trip.SessionID == "" {
		http.Error(w, "session_id is required", http.StatusBadRequest)
		return
	}

	s.SaveTrip(trip)

	w.WriteHeader(http.StatusCreated)
}
