# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the UniversalPaymentProtocol project, currently containing a minimal monitoring infrastructure setup with Grafana and Prometheus configurations.

## Project Structure

The repository is organized as follows:

- `monitoring/` - Contains monitoring and observability configurations
  - `grafana/` - Grafana configuration
    - `dashboards/` - Custom Grafana dashboards (currently empty)
    - `datasources/` - Grafana datasource configurations (currently empty)
- `prometheus.yml/` - Prometheus configuration directory (currently empty)

## Current State

This appears to be a very early-stage project with only the basic monitoring infrastructure directories created. The project currently contains:

- Empty monitoring configuration directories
- No package.json, README, or other standard project files
- No build scripts, tests, or development commands yet defined

## Development Notes

Since this is an early-stage project with minimal structure, any development work should:

1. Follow standard practices for the chosen technology stack once it's established
2. Add appropriate build, test, and development scripts as the project grows
3. Implement proper configuration for Prometheus and Grafana monitoring as needed
4. Add README and other documentation as the project matures

The monitoring directory structure suggests this may be intended as a payment protocol with observability built-in from the start.