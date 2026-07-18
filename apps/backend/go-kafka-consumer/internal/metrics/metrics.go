package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
)

var (
	MessagesReceived = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "travelguru_messages_received_total",
			Help: "Total Kafka messages received",
		},
		[]string{"topic"},
	)

	ProcessingLatency = prometheus.NewHistogram(
		prometheus.HistogramOpts{
			Name:    "travelguru_processing_latency_seconds",
			Help:    "Trip aggregation latency",
			Buckets: prometheus.DefBuckets,
		},
	)

	AggregationFailures = prometheus.NewCounter(
		prometheus.CounterOpts{
			Name: "travelguru_aggregation_failures_total",
			Help: "Aggregation failures",
		},
	)

	HTTPRequests = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "travelguru_http_requests_total",
			Help: "HTTP requests",
		},
		[]string{"endpoint"},
	)
)

func Init() {
	prometheus.MustRegister(
		MessagesReceived,
		ProcessingLatency,
		AggregationFailures,
		HTTPRequests,
	)
}
