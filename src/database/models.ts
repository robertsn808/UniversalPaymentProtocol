// Database models and interfaces for UPP

export interface User {
  id: number;
  email: string;
  password_hash: string;
  first_name?: string;
  last_name?: string;
  role: 'user' | 'admin' | 'merchant';
  is_active: boolean;
  email_verified: boolean;
  last_login?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface Device {
  id: string;
  user_id?: number;
  device_type: string;
  fingerprint: string;
  capabilities: any;
  security_context: any;
  status: 'active' | 'inactive' | 'suspended';
  last_seen: Date;
  ip_address?: string;
  user_agent?: string;
  location?: any;
  created_at: Date;
  updated_at: Date;
}

export interface Transaction {
  id: string;
  user_id?: number;
  device_id?: string;
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  payment_intent_id?: string;
  payment_method?: string;
  merchant_id?: string;
  description?: string;
  metadata?: any;
  stripe_data?: any;
  error_message?: string;
  processed_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface AuditLog {
  id: number;
  user_id?: number;
  device_id?: string;
  action: string;
  resource: string;
  result: 'success' | 'failure' | 'error';
  ip_address?: string;
  user_agent?: string;
  correlation_id?: string;
  request_data?: any;
  response_data?: any;
  error_data?: any;
  sensitive_data_accessed: boolean;
  created_at: Date;
}

export interface ApiKey {
  id: number;
  user_id: number;
  key_hash: string;
  name: string;
  permissions: string[];
  last_used?: Date;
  expires_at?: Date;
  is_active: boolean;
  created_at: Date;
}

export interface UserSession {
  id: string;
  user_id: number;
  device_fingerprint?: string;
  ip_address?: string;
  user_agent?: string;
  expires_at: Date;
  created_at: Date;
}

// Create types for database operations
export type CreateUser = Omit<User, 'id' | 'created_at' | 'updated_at'>;
export type UpdateUser = Partial<Omit<User, 'id' | 'created_at' | 'updated_at'>>;

export type CreateDevice = Omit<Device, 'created_at' | 'updated_at'>;
export type UpdateDevice = Partial<Omit<Device, 'id' | 'created_at' | 'updated_at'>>;

export type CreateTransaction = Omit<Transaction, 'created_at' | 'updated_at'>;
export type UpdateTransaction = Partial<Omit<Transaction, 'id' | 'created_at' | 'updated_at'>>;

export type CreateAuditLog = Omit<AuditLog, 'id' | 'created_at'>;
export type CreateApiKey = Omit<ApiKey, 'id' | 'created_at'>;
export type CreateUserSession = Omit<UserSession, 'created_at'>;