package config

import (
	"os"
	"os/exec"
	"testing"
)

// --- getEnv ---------------------------------------------------------------

func TestGetEnv_ReturnsValueWhenSet(t *testing.T) {
	t.Setenv("TEST_KEY", "custom-value")

	if got := getEnv("TEST_KEY", "fallback"); got != "custom-value" {
		t.Fatalf("expected %q, got %q", "custom-value", got)
	}
}

func TestGetEnv_ReturnsFallbackWhenUnset(t *testing.T) {
	_ = os.Unsetenv("TEST_KEY_UNSET")

	if got := getEnv("TEST_KEY_UNSET", "fallback"); got != "fallback" {
		t.Fatalf("expected %q, got %q", "fallback", got)
	}
}

// --- validatePort / validateBroker (valid inputs) --------------------------
//
// NOTE: these functions call log.Fatal (os.Exit) on invalid input, so their
// failure paths can't be exercised as normal in-process test cases — a
// failing call would kill the whole `go test` binary. The invalid-input
// behavior is instead covered by TestLoad_FatalsOnInvalidBroker /
// TestLoad_FatalsOnInvalidPort below using the standard Go subprocess
// re-exec pattern. Only the non-fatal, valid-input paths are tested directly
// here.

func TestValidatePort_ValidPortDoesNotExit(t *testing.T) {
	// Should simply return without calling log.Fatal.
	validatePort("TEST_PORT", "8081")
}

func TestValidateBroker_ValidBrokerDoesNotExit(t *testing.T) {
	// Should simply return without calling log.Fatal.
	validateBroker("localhost:9092")
}

// --- Load() -----------------------------------------------------------------

// clearConfigEnv unsets every environment variable Load() consults so tests
// can rely on Load()'s documented defaults.
func clearConfigEnv(t *testing.T) {
	t.Helper()
	keys := []string{
		"KAFKA_BROKER", "KAFKA_GROUP_ID",
		"FLIGHT_TOPIC", "HOTEL_TOPIC", "PLACES_TOPIC", "WEATHER_TOPIC",
		"HTTP_PORT", "METRICS_PORT", "PPROF_PORT",
	}
	for _, k := range keys {
		original, wasSet := os.LookupEnv(k)
		_ = os.Unsetenv(k)
		t.Cleanup(func() {
			if wasSet {
				_ = os.Setenv(k, original)
			}
		})
	}
}

func TestLoad_Defaults(t *testing.T) {
	clearConfigEnv(t)

	cfg := Load()

	if cfg.KafkaBrokers != "localhost:9092" {
		t.Errorf("KafkaBrokers: expected default %q, got %q", "localhost:9092", cfg.KafkaBrokers)
	}
	if cfg.GroupID != "travelmaster-go-consumer" {
		t.Errorf("GroupID: expected default %q, got %q", "travelmaster-go-consumer", cfg.GroupID)
	}
	if cfg.HTTPPort != "8081" {
		t.Errorf("HTTPPort: expected default %q, got %q", "8081", cfg.HTTPPort)
	}
	if cfg.MetricsPort != "2112" {
		t.Errorf("MetricsPort: expected default %q, got %q", "2112", cfg.MetricsPort)
	}
	if cfg.PprofPort != "6060" {
		t.Errorf("PprofPort: expected default %q, got %q", "6060", cfg.PprofPort)
	}
}

func TestLoad_EnvOverrides(t *testing.T) {
	clearConfigEnv(t)

	t.Setenv("KAFKA_BROKER", "kafka.internal:29092")
	t.Setenv("HTTP_PORT", "9090")
	t.Setenv("METRICS_PORT", "9091")
	t.Setenv("PPROF_PORT", "9092")

	cfg := Load()

	if cfg.KafkaBrokers != "kafka.internal:29092" {
		t.Errorf("expected overridden KafkaBrokers, got %q", cfg.KafkaBrokers)
	}
	if cfg.HTTPPort != "9090" {
		t.Errorf("expected overridden HTTPPort, got %q", cfg.HTTPPort)
	}
	if cfg.MetricsPort != "9091" {
		t.Errorf("expected overridden MetricsPort, got %q", cfg.MetricsPort)
	}
	if cfg.PprofPort != "9092" {
		t.Errorf("expected overridden PprofPort, got %q", cfg.PprofPort)
	}
}

// --- Load() fatal paths (subprocess re-exec pattern) ------------------------
//
// These tests re-invoke the test binary itself in a child process with an
// env var that routes into a small in-process harness (see
// TestHelperProcess_FatalOnInvalidConfig) so that the log.Fatal-triggered
// os.Exit doesn't tear down the real test run.

func TestLoad_FatalsOnInvalidBroker(t *testing.T) {
	if os.Getenv("GO_WANT_HELPER_PROCESS") == "1" {
		os.Setenv("KAFKA_BROKER", "not-a-valid-broker") // no port
		Load()
		return
	}

	cmd := exec.Command(os.Args[0], "-test.run=TestLoad_FatalsOnInvalidBroker")
	cmd.Env = append(os.Environ(), "GO_WANT_HELPER_PROCESS=1")
	err := cmd.Run()

	if err == nil {
		t.Fatal("expected Load() to exit non-zero for an invalid Kafka broker address")
	}
	if exitErr, ok := err.(*exec.ExitError); !ok || exitErr.Success() {
		t.Fatalf("expected a non-zero ExitError, got %v (%T)", err, err)
	}
}

func TestLoad_FatalsOnInvalidPort(t *testing.T) {
	if os.Getenv("GO_WANT_HELPER_PROCESS") == "1" {
		os.Setenv("HTTP_PORT", "not-a-port")
		Load()
		return
	}

	cmd := exec.Command(os.Args[0], "-test.run=TestLoad_FatalsOnInvalidPort")
	cmd.Env = append(os.Environ(), "GO_WANT_HELPER_PROCESS=1")
	err := cmd.Run()

	if err == nil {
		t.Fatal("expected Load() to exit non-zero for an invalid HTTP_PORT")
	}
	if exitErr, ok := err.(*exec.ExitError); !ok || exitErr.Success() {
		t.Fatalf("expected a non-zero ExitError, got %v (%T)", err, err)
	}
}
