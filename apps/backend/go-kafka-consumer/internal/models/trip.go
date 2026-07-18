package models

import "encoding/json"

type AggregatedTrip struct {
	SessionID string          `json:"session_id"`
	Flight    json.RawMessage `json:"flight"`
	Hotels    json.RawMessage `json:"hotels"`
	Places    json.RawMessage `json:"places"`
	Weather   json.RawMessage `json:"weather"`
}
