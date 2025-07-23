-- Create fraud detection and security tables

-- Fraud assessments table
CREATE TABLE IF NOT EXISTS fraud_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id VARCHAR(255) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    business_type VARCHAR(50) NOT NULL,
    fraud_score INTEGER NOT NULL,
    fraud_level VARCHAR(20) NOT NULL,
    reasons JSONB,
    rule_scores JSONB,
    should_block BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Blacklist table for blocking malicious entities
CREATE TABLE IF NOT EXISTS blacklist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(20) NOT NULL, -- 'device', 'email', 'ip'
    value VARCHAR(255) NOT NULL,
    reason VARCHAR(500),
    active BOOLEAN NOT NULL DEFAULT true,
    created_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE,
    
    UNIQUE(type, value)
);

-- Rate limiting tracking table
CREATE TABLE IF NOT EXISTS rate_limit_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier VARCHAR(255) NOT NULL, -- IP, device_id, user_id, etc.
    endpoint VARCHAR(100) NOT NULL,
    window_start TIMESTAMP WITH TIME ZONE NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(identifier, endpoint, window_start)
);

-- Security incidents table
CREATE TABLE IF NOT EXISTS security_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_type VARCHAR(50) NOT NULL, -- 'fraud_attempt', 'rate_limit_exceeded', 'suspicious_activity'
    severity VARCHAR(20) NOT NULL, -- 'low', 'medium', 'high', 'critical'
    description TEXT NOT NULL,
    metadata JSONB,
    device_id VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    resolved BOOLEAN NOT NULL DEFAULT false,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_fraud_assessments_device_id ON fraud_assessments(device_id);
CREATE INDEX IF NOT EXISTS idx_fraud_assessments_created_at ON fraud_assessments(created_at);
CREATE INDEX IF NOT EXISTS idx_fraud_assessments_fraud_level ON fraud_assessments(fraud_level);

CREATE INDEX IF NOT EXISTS idx_blacklist_type_value ON blacklist(type, value);
CREATE INDEX IF NOT EXISTS idx_blacklist_active ON blacklist(active);

CREATE INDEX IF NOT EXISTS idx_rate_limit_identifier ON rate_limit_tracking(identifier);
CREATE INDEX IF NOT EXISTS idx_rate_limit_endpoint ON rate_limit_tracking(endpoint);
CREATE INDEX IF NOT EXISTS idx_rate_limit_window ON rate_limit_tracking(window_start);

CREATE INDEX IF NOT EXISTS idx_security_incidents_type ON security_incidents(incident_type);
CREATE INDEX IF NOT EXISTS idx_security_incidents_severity ON security_incidents(severity);
CREATE INDEX IF NOT EXISTS idx_security_incidents_created_at ON security_incidents(created_at);
CREATE INDEX IF NOT EXISTS idx_security_incidents_device_id ON security_incidents(device_id);

-- Add triggers for updated_at
CREATE OR REPLACE FUNCTION update_rate_limit_tracking_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_rate_limit_tracking_updated_at
    BEFORE UPDATE ON rate_limit_tracking
    FOR EACH ROW
    EXECUTE FUNCTION update_rate_limit_tracking_updated_at();

-- Add comments
COMMENT ON TABLE fraud_assessments IS 'Stores fraud detection results for all payment attempts';
COMMENT ON TABLE blacklist IS 'Stores blacklisted entities (devices, emails, IPs) for security';
COMMENT ON TABLE rate_limit_tracking IS 'Tracks API request rates for rate limiting enforcement';
COMMENT ON TABLE security_incidents IS 'Logs security incidents and suspicious activities';