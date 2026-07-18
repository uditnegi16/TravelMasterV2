package models

type AgentMessage struct {
	Topic string
	Key   string
	Value []byte
}
