package config

import (
	"log"
	"net"
	"os"
	"strconv"
)

type Config struct {
	KafkaBrokers string
	GroupID      string

	FlightTopic  string
	HotelTopic   string
	PlacesTopic  string
	WeatherTopic string

	HTTPPort    string
	MetricsPort string
	PprofPort   string
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func validatePort(name, port string) {
	p, err := strconv.Atoi(port)
	if err != nil || p < 1 || p > 65535 {
		log.Fatalf("Invalid %s: %s", name, port)
	}
}

func validateBroker(broker string) {
	host, port, err := net.SplitHostPort(broker)
	if err != nil {
		log.Fatalf("Invalid Kafka broker address: %s", broker)
	}

	if host == "" {
		log.Fatal("Kafka broker host cannot be empty")
	}

	validatePort("Kafka broker port", port)
}

func Load() *Config {

	cfg := &Config{
		KafkaBrokers: getEnv("KAFKA_BROKER", "localhost:9092"),
		GroupID:      getEnv("KAFKA_GROUP_ID", "travelmaster-go-consumer"),

		FlightTopic:  getEnv("FLIGHT_TOPIC", "travelguru.agents.flights"),
		HotelTopic:   getEnv("HOTEL_TOPIC", "travelguru.agents.hotels"),
		PlacesTopic:  getEnv("PLACES_TOPIC", "travelguru.agents.places"),
		WeatherTopic: getEnv("WEATHER_TOPIC", "travelguru.agents.weather"),

		HTTPPort:    getEnv("HTTP_PORT", "8081"),
		MetricsPort: getEnv("METRICS_PORT", "2112"),
		PprofPort:   getEnv("PPROF_PORT", "6060"),
	}

	validateBroker(cfg.KafkaBrokers)
	validatePort("HTTP_PORT", cfg.HTTPPort)
	validatePort("METRICS_PORT", cfg.MetricsPort)
	validatePort("PPROF_PORT", cfg.PprofPort)

	log.Println("========== Configuration ==========")
	log.Println("Kafka Broker :", cfg.KafkaBrokers)
	log.Println("Group ID     :", cfg.GroupID)
	log.Println("Flight Topic :", cfg.FlightTopic)
	log.Println("Hotel Topic  :", cfg.HotelTopic)
	log.Println("Places Topic :", cfg.PlacesTopic)
	log.Println("Weather Topic:", cfg.WeatherTopic)
	log.Println("HTTP Port    :", cfg.HTTPPort)
	log.Println("Metrics Port :", cfg.MetricsPort)
	log.Println("pprof Port   :", cfg.PprofPort)
	log.Println("===================================")

	return cfg
}
