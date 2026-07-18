package aggregator

import "travelmaster/go-kafka-consumer/internal/models"

type Aggregator struct {
	Messages chan models.AgentMessage
	Store    *SessionStore
}

func New() *Aggregator {
	return &Aggregator{
		Messages: make(chan models.AgentMessage, 100),
		Store:    NewSessionStore(),
	}
}
