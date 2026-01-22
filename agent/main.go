package main

import (
	"context"
	"flag"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

var (
	configPath = flag.String("config", "config.yaml", "Path to configuration file")
)

func main() {
	flag.Parse()

	// Setup logger
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr, TimeFormat: time.RFC3339})
	log.Info().Msg("Starting FLIP Agent Service")

	// Load configuration
	config, err := LoadConfig(*configPath)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to load configuration")
	}

	// Initialize agent
	agent, err := NewAgent(config)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to initialize agent")
	}

	// Setup graceful shutdown
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	// Start agent in goroutine
	agentErrChan := make(chan error, 1)
	go func() {
		if err := agent.Run(ctx); err != nil {
			agentErrChan <- err
		}
	}()

	// Wait for shutdown signal or error
	select {
	case sig := <-sigChan:
		log.Info().Str("signal", sig.String()).Msg("Received shutdown signal")
		cancel()
	case err := <-agentErrChan:
		log.Error().Err(err).Msg("Agent error")
		cancel()
	}

	// Graceful shutdown
	log.Info().Msg("Shutting down agent...")
	time.Sleep(2 * time.Second)
	log.Info().Msg("Agent stopped")
}

