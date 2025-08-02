# Universal Payment Protocol - Monitoring

This directory contains monitoring configurations for the Universal Payment Protocol system.

## Overview

The monitoring stack consists of:
- **Prometheus**: Metrics collection and storage
- **Grafana**: Visualization and dashboarding
- **Node Exporter**: System metrics collection
- **Custom Application Metrics**: UPP-specific payment processing metrics

## Directory Structure

```
monitoring/
├── grafana/
│   ├── dashboards/          # Grafana dashboard definitions
│   │   └── payment-processing.json
│   └── datasources/        # Grafana datasource configurations
│       └── prometheus.yml
├── prometheus.yml          # Prometheus configuration
└── README.md               # This file
```

## Metrics Collected

### Payment Processing Metrics
- `upp_payment_transactions_total` - Total number of payment transactions
- `upp_payment_amount_total` - Total payment amount processed
- `upp_payment_success_total` - Successful payment transactions
- `upp_payment_failure_total` - Failed payment transactions
- `upp_payment_processing_duration_seconds` - Payment processing latency
- `upp_payment_by_device_type` - Payment distribution by device type
- `upp_payment_errors_total` - Payment error counts by type

### System Metrics
- CPU usage
- Memory usage
- Disk I/O
- Network traffic
- Container metrics (if using Docker)

## Setup Instructions

### 1. Prometheus Setup

1. Install Prometheus: https://prometheus.io/download/
2. Copy `prometheus.yml` to your Prometheus config directory
3. Start Prometheus: `prometheus --config.file=prometheus.yml`

### 2. Grafana Setup

1. Install Grafana: https://grafana.com/grafana/download
2. Start Grafana: `systemctl start grafana-server`
3. Access Grafana at http://localhost:3000 (default admin/admin)
4. Configure datasources using `grafana/datasources/prometheus.yml`
5. Import dashboards from `grafana/dashboards/`

### 3. Node Exporter Setup (Optional)

1. Install Node Exporter: https://github.com/prometheus/node_exporter
2. Start Node Exporter: `./node_exporter`
3. Node metrics will be available at http://localhost:9100

## Custom Metrics Implementation

To implement custom metrics in the UPP application:

```typescript
// Import prometheus client
import { Counter, Gauge, Histogram } from 'prom-client';

// Define metrics
const paymentCounter = new Counter({
  name: 'upp_payment_transactions_total',
  help: 'Total number of payment transactions',
  labelNames: ['status', 'device_type']
});

const paymentAmountGauge = new Gauge({
  name: 'upp_payment_amount_total',
  help: 'Total payment amount processed',
  labelNames: ['currency']
});

const paymentDuration = new Histogram({
  name: 'upp_payment_processing_duration_seconds',
  help: 'Payment processing latency',
  labelNames: ['device_type', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5, 10]
});
```

## Alerting Rules

Create alerting rules in Prometheus for critical metrics:

```yaml
groups:
- name: upp-alerts
  rules:
  - alert: HighPaymentFailureRate
    expr: (upp_payment_failure_total / (upp_payment_success_total + upp_payment_failure_total)) > 0.05
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High payment failure rate detected"
      description: "Payment failure rate is above 5% for the last 5 minutes"

  - alert: HighLatency
    expr: histogram_quantile(0.95, rate(upp_payment_processing_duration_seconds_bucket[5m])) > 10
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "High payment processing latency"
      description: "95th percentile payment processing time exceeds 10 seconds"
```

## Dashboard Features

The payment processing dashboard includes:

1. **Payment Volume Graph**: Real-time visualization of payment volume
2. **Transaction Counter**: Total transactions processed today
3. **Success Rate**: Percentage of successful payments
4. **Processing Latency**: Payment processing time metrics
5. **Device Distribution**: Payment distribution by device type
6. **Error Rates**: Visualization of payment errors by type

## Security Considerations

- Restrict access to monitoring endpoints
- Use authentication for Prometheus and Grafana
- Encrypt traffic between components
- Regularly update monitoring software
- Monitor access logs for suspicious activity

## Troubleshooting

### Common Issues

1. **Metrics not appearing**: Check Prometheus target status
2. **Dashboard panels empty**: Verify metric names match implementation
3. **High memory usage**: Adjust scrape intervals in prometheus.yml
4. **Connection refused**: Ensure all services are running on correct ports

### Logs and Debugging

- Check Prometheus logs for scraping errors
- Verify Grafana can connect to Prometheus datasource
- Ensure application metrics endpoint is accessible
- Check firewall settings for inter-service communication

## Performance Optimization

- Adjust scrape intervals based on metric volatility
- Use metric relabeling to reduce cardinality
- Implement recording rules for expensive queries
- Use federation for large-scale deployments
