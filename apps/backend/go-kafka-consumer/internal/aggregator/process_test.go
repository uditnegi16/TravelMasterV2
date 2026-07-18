package aggregator

import (
	"testing"

	"travelmaster/go-kafka-consumer/internal/models"
)

func TestProcess_SingleMessageIsIncomplete(t *testing.T) {
	agg := New()

	session, complete := agg.Process(models.AgentMessage{
		Topic: "travelguru.agents.flights",
		Key:   "session-1",
		Value: []byte(`{"airline":"IndiGo"}`),
	})

	if complete {
		t.Fatal("expected session to be incomplete after only one of four topics")
	}
	if session.Flight == nil {
		t.Fatal("expected Flight to be populated")
	}
	if !session.Received["flights"] {
		t.Fatal("expected Received[\"flights\"] to be true")
	}
	if session.Received["hotels"] || session.Received["places"] || session.Received["weather"] {
		t.Fatal("expected only the flights key to be marked received")
	}
}

func TestProcess_AllFourTopicsMarksComplete(t *testing.T) {
	agg := New()
	sessionID := "session-1"

	topics := []struct {
		topic string
		value string
	}{
		{"travelguru.agents.flights", `{"a":1}`},
		{"travelguru.agents.hotels", `{"b":2}`},
		{"travelguru.agents.places", `{"c":3}`},
		{"travelguru.agents.weather", `{"d":4}`},
	}

	var complete bool
	var session *SessionData

	for i, entry := range topics {
		session, complete = agg.Process(models.AgentMessage{
			Topic: entry.topic,
			Key:   sessionID,
			Value: []byte(entry.value),
		})

		isLast := i == len(topics)-1
		if complete != isLast {
			t.Fatalf("after %d/%d messages: expected complete=%v, got %v", i+1, len(topics), isLast, complete)
		}
	}

	if session.Flight == nil || session.Hotels == nil || session.Places == nil || session.Weather == nil {
		t.Fatal("expected all four fields to be populated once the session is complete")
	}
}

func TestProcess_DuplicateMessageDoesNotFalselyComplete(t *testing.T) {
	agg := New()
	sessionID := "session-1"

	// Send the same topic three times; the session should still be
	// incomplete because the other three topics never arrived.
	for i := 0; i < 3; i++ {
		_, complete := agg.Process(models.AgentMessage{
			Topic: "travelguru.agents.hotels",
			Key:   sessionID,
			Value: []byte(`{"hotel":"Taj"}`),
		})
		if complete {
			t.Fatalf("iteration %d: expected session to remain incomplete after repeated hotels-only messages", i)
		}
	}
}

func TestProcess_UnknownTopicIsIgnored(t *testing.T) {
	agg := New()

	session, complete := agg.Process(models.AgentMessage{
		Topic: "travelguru.agents.unknown",
		Key:   "session-1",
		Value: []byte(`{}`),
	})

	if complete {
		t.Fatal("expected an unrecognized topic to never mark the session complete")
	}
	if len(session.Received) != 0 {
		t.Fatalf("expected no Received flags to be set for an unrecognized topic, got %v", session.Received)
	}
}

func TestProcess_DifferentSessionsAreIndependent(t *testing.T) {
	agg := New()

	_, completeA := agg.Process(models.AgentMessage{
		Topic: "travelguru.agents.flights",
		Key:   "session-a",
		Value: []byte(`{}`),
	})
	_, completeB := agg.Process(models.AgentMessage{
		Topic: "travelguru.agents.hotels",
		Key:   "session-b",
		Value: []byte(`{}`),
	})

	if completeA || completeB {
		t.Fatal("expected neither independent, partially-filled session to be complete")
	}

	sessionA := agg.Store.Get("session-a")
	sessionB := agg.Store.Get("session-b")

	if sessionA.Received["hotels"] {
		t.Fatal("expected session-a to not be affected by session-b's message")
	}
	if sessionB.Received["flights"] {
		t.Fatal("expected session-b to not be affected by session-a's message")
	}
}

func TestBuildTrip(t *testing.T) {
	agg := New()
	sessionID := "session-1"

	session, _ := agg.Process(models.AgentMessage{
		Topic: "travelguru.agents.flights",
		Key:   sessionID,
		Value: []byte(`{"airline":"IndiGo"}`),
	})

	trip := agg.BuildTrip(sessionID, session)

	if trip.SessionID != sessionID {
		t.Fatalf("expected SessionID %q, got %q", sessionID, trip.SessionID)
	}
	if string(trip.Flight) != `{"airline":"IndiGo"}` {
		t.Fatalf("expected Flight to carry through the raw JSON, got %s", string(trip.Flight))
	}
	if trip.Hotels != nil || trip.Places != nil || trip.Weather != nil {
		t.Fatal("expected fields that were never received to remain nil")
	}
}
