package aggregator

import (
	"encoding/json"
	"sync"
)

type SessionData struct {
	Flight  json.RawMessage
	Hotels  json.RawMessage
	Places  json.RawMessage
	Weather json.RawMessage

	Received map[string]bool
}

type SessionStore struct {
	mu       sync.RWMutex
	sessions map[string]*SessionData
}

func NewSessionStore() *SessionStore {
	return &SessionStore{
		sessions: make(map[string]*SessionData),
	}
}

func (s *SessionStore) Get(sessionID string) *SessionData {
	s.mu.Lock()
	defer s.mu.Unlock()

	if existing, ok := s.sessions[sessionID]; ok {
		return existing
	}

	data := &SessionData{
		Received: make(map[string]bool),
	}

	s.sessions[sessionID] = data
	return data
}

func (s *SessionStore) Delete(sessionID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.sessions, sessionID)
}
