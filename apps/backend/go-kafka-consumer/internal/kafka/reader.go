package kafka

import (
	"context"
	"fmt"
	kafkago "github.com/segmentio/kafka-go"
	"sync"

	"travelmaster/go-kafka-consumer/internal/config"
	"travelmaster/go-kafka-consumer/internal/models"
)

func NewReader(cfg *config.Config, topic string) *kafkago.Reader {

	return kafkago.NewReader(kafkago.ReaderConfig{
		Brokers:  []string{cfg.KafkaBrokers},
		GroupID:  cfg.GroupID,
		Topic:    topic,
		MinBytes: 10e3,
		MaxBytes: 10e6,
	})
}

func ConsumeTopic(
	ctx context.Context,
	wg *sync.WaitGroup,
	cfg *config.Config,
	topic string,
	out chan<- models.AgentMessage,
) {
	defer wg.Done()
	reader := NewReader(cfg, topic)

	defer func() {
		if err := reader.Close(); err != nil {
			fmt.Printf("[%s] failed to close reader: %v\n", topic, err)
		} else {
			fmt.Printf("[%s] reader closed\n", topic)
		}
	}()

	for {

		msg, err := reader.ReadMessage(ctx)
		if err != nil {

			if ctx.Err() != nil {
				fmt.Printf("[%s] context canceled\n", topic)
				return
			}

			fmt.Printf("[%s] %v\n", topic, err)
			continue
		}

		out <- models.AgentMessage{
			Topic: topic,
			Key:   string(msg.Key),
			Value: msg.Value,
		}
	}
}
