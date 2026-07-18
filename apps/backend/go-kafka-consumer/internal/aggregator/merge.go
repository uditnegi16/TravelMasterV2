package aggregator

import "travelmaster/go-kafka-consumer/internal/models"

func (a *Aggregator) BuildTrip(sessionID string, s *SessionData) models.AggregatedTrip {

	return models.AggregatedTrip{
		SessionID: sessionID,
		Flight:    s.Flight,
		Hotels:    s.Hotels,
		Places:    s.Places,
		Weather:   s.Weather,
	}
}
