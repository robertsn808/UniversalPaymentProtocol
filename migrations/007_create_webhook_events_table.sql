-- Create webhook_events table for tracking Stripe webhook processing
CREATE TABLE IF NOT EXISTS webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(100) NOT NULL,
    data JSONB NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_webhook_events_type ON webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed_at ON webhook_events(processed_at);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON webhook_events(created_at);

-- Add GIN index for JSONB data column for efficient querying
CREATE INDEX IF NOT EXISTS idx_webhook_events_data ON webhook_events USING GIN(data);

-- Add trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_webhook_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_webhook_events_updated_at
    BEFORE UPDATE ON webhook_events
    FOR EACH ROW
    EXECUTE FUNCTION update_webhook_events_updated_at();

-- Add comment to document the table purpose
COMMENT ON TABLE webhook_events IS 'Stores processed Stripe webhook events for audit and monitoring purposes';