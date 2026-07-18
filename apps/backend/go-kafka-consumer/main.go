package main

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"net/http"
	_ "net/http/pprof"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"travelmaster/go-kafka-consumer/internal/aggregator"
	"travelmaster/go-kafka-consumer/internal/api"
	"travelmaster/go-kafka-consumer/internal/config"
	"travelmaster/go-kafka-consumer/internal/kafka"
	"travelmaster/go-kafka-consumer/internal/metrics"
)

func main() {

	cfg := config.Load()

	metrics.Init()

	agg := aggregator.New()
	server := api.New()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	var wg sync.WaitGroup
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	//---------------------------------------------------------------------
	// HTTP Servers
	//---------------------------------------------------------------------

	apiServer := &http.Server{
		Addr:    ":" + cfg.HTTPPort,
		Handler: server.Router,
	}

	metricsMux := http.NewServeMux()
	metricsMux.Handle("/metrics", promhttp.Handler())

	metricsServer := &http.Server{
		Addr:    ":" + cfg.MetricsPort,
		Handler: metricsMux,
	}

	pprofServer := &http.Server{
		Addr:    ":" + cfg.PprofPort,
		Handler: http.DefaultServeMux,
	}

	//---------------------------------------------------------------------
	// Shutdown Handler
	//---------------------------------------------------------------------

	go func() {

		sig := <-sigChan

		fmt.Println()
		fmt.Println("=================================")
		fmt.Println("Shutdown signal received:", sig)
		fmt.Println("Stopping Go Aggregator...")
		fmt.Println("=================================")

		cancel()

		shutdownCtx, shutdownCancel := context.WithTimeout(
			context.Background(),
			10*time.Second,
		)
		defer shutdownCancel()

		if err := apiServer.Shutdown(shutdownCtx); err != nil {
			fmt.Println("API shutdown:", err)
		}

		if err := metricsServer.Shutdown(shutdownCtx); err != nil {
			fmt.Println("Metrics shutdown:", err)
		}

		if err := pprofServer.Shutdown(shutdownCtx); err != nil {
			fmt.Println("pprof shutdown:", err)
		}
	}()

	//---------------------------------------------------------------------
	// API Server
	//---------------------------------------------------------------------

	go func() {

		fmt.Println("HTTP API listening on :" + cfg.HTTPPort)

		if err := apiServer.ListenAndServe(); err != nil &&
			err != http.ErrServerClosed {
			panic(err)
		}
	}()

	//---------------------------------------------------------------------
	// Metrics
	//---------------------------------------------------------------------

	go func() {

		fmt.Println("Metrics server listening on :" + cfg.MetricsPort)

		if err := metricsServer.ListenAndServe(); err != nil &&
			err != http.ErrServerClosed {
			panic(err)
		}
	}()

	//---------------------------------------------------------------------
	// pprof
	//---------------------------------------------------------------------

	go func() {

		fmt.Println("pprof listening on :" + cfg.PprofPort)

		if err := pprofServer.ListenAndServe(); err != nil &&
			err != http.ErrServerClosed {
			panic(err)
		}
	}()

	//---------------------------------------------------------------------
	// Kafka Consumers
	//---------------------------------------------------------------------

	wg.Add(4)

	go kafka.ConsumeTopic(ctx, &wg, cfg, cfg.FlightTopic, agg.Messages)
	go kafka.ConsumeTopic(ctx, &wg, cfg, cfg.HotelTopic, agg.Messages)
	go kafka.ConsumeTopic(ctx, &wg, cfg, cfg.PlacesTopic, agg.Messages)
	go kafka.ConsumeTopic(ctx, &wg, cfg, cfg.WeatherTopic, agg.Messages)
	fmt.Println("=================================")
	fmt.Println("Go Aggregation Service Started")
	fmt.Println("Listening on Kafka Topics...")
	fmt.Println("=================================")

	for {

		select {

		case <-ctx.Done():

			fmt.Println("Waiting for Kafka consumers...")

			wg.Wait()

			fmt.Println("All Kafka consumers stopped.")
			fmt.Println("Aggregator shutdown complete.")

			return

		case msg := <-agg.Messages:

			start := time.Now()

			metrics.MessagesReceived.WithLabelValues(msg.Topic).Inc()

			session, complete := agg.Process(msg)

			fmt.Printf(
				"\nReceived %-8s | Session=%s\n",
				msg.Topic,
				msg.Key,
			)

			if complete {

				fmt.Println("=================================")

				trip := agg.BuildTrip(msg.Key, session)

				metrics.ProcessingLatency.Observe(
					time.Since(start).Seconds(),
				)

				server.SaveTrip(trip)

				data, err := json.MarshalIndent(trip, "", "  ")
				if err != nil {
					metrics.AggregationFailures.Inc()
					fmt.Println(err)
				} else {
					fmt.Println(string(data))
				}

				fmt.Println("Session:", msg.Key)
				fmt.Println("Flights :", session.Received["flights"])
				fmt.Println("Hotels  :", session.Received["hotels"])
				fmt.Println("Places  :", session.Received["places"])
				fmt.Println("Weather :", session.Received["weather"])
				fmt.Println("=================================")

				agg.Store.Delete(msg.Key)
			}
		}
	}
}
