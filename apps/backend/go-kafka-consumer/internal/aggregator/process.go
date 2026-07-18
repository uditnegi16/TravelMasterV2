package aggregator

import (
	"strings"

	"travelmaster/go-kafka-consumer/internal/models"
)

func (a *Aggregator) Process(msg models.AgentMessage) (*SessionData, bool) {

	session := a.Store.Get(msg.Key)

	switch {
	case strings.Contains(msg.Topic, "flights"):
		session.Flight = msg.Value
		session.Received["flights"] = true

	case strings.Contains(msg.Topic, "hotels"):
		session.Hotels = msg.Value
		session.Received["hotels"] = true

	case strings.Contains(msg.Topic, "places"):
		session.Places = msg.Value
		session.Received["places"] = true

	case strings.Contains(msg.Topic, "weather"):
		session.Weather = msg.Value
		session.Received["weather"] = true
	}

	complete :=
		session.Received["flights"] &&
			session.Received["hotels"] &&
			session.Received["places"] &&
			session.Received["weather"]

	return session, complete
}
