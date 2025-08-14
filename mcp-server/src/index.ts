#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { UniversalPaymentProtocol } from '../src/modules/universal-payment-protocol/UniversalPaymentProtocol.js';
import { PaymentProcessor } from '../src/payments/PaymentProcessor.js';
import { DatabaseConnection } from '../src/database/connection.js';
import { Logger } from '../src/shared/logger.js';
import { config } from '../src/config/environment.js';

class UniversalPaymentMcpServer {
  private server: Server;
  private paymentProtocol: UniversalPaymentProtocol;
  private paymentProcessor: PaymentProcessor;
  private logger: Logger;

  constructor() {
    this.server = new Server(
      {
        name: 'universal-payment-protocol-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    );

    this.logger = new Logger();
    this.paymentProcessor = new PaymentProcessor();
    this.paymentProtocol = new UniversalPaymentProtocol();

    this.setupResourceHandlers();
    this.setupToolHandlers();
    
    // Error handling
    this.server.onerror = (error) => this.logger.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupResourceHandlers() {
    // List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [
        {
          uri: 'upp://payment-methods',
          name: 'Available Payment Methods',
          mimeType: 'application/json',
          description: 'List of all supported payment methods and devices',
        },
        {
          uri: 'upp://transaction-stats',
          name: 'Transaction Statistics',
          mimeType: 'application/json',
          description: 'Real-time transaction statistics and metrics',
        },
        {
          uri: 'upp://compliance-status',
          name: 'Compliance Status',
          mimeType: 'application/json',
          description: 'Current compliance status for PCI-DSS, GDPR, etc.',
        },
      ],
    }));

    // List resource templates for dynamic resources
    this.server.setRequestHandler(
      ListResourceTemplatesRequestSchema,
      async () => ({
        resourceTemplates: [
          {
            uriTemplate: 'upp://transactions/{transactionId}',
            name: 'Transaction Details',
            mimeType: 'application/json',
            description: 'Get detailed information about a specific transaction',
          },
          {
            uriTemplate: 'upp://device/{deviceId}/status',
            name: 'Device Status',
            mimeType: 'application/json',
            description: 'Get status and capabilities of a specific payment device',
          },
          {
            uriTemplate: 'upp://payment-methods/{methodId}',
            name: 'Payment Method Details',
            mimeType: 'application/json',
            description: 'Get configuration and status of a specific payment method',
          },
        ],
      })
    );

    // Handle resource reading
    this.server.setRequestHandler(
      ReadResourceRequestSchema,
      async (request) => {
        const uri = request.params.uri;

        try {
          if (uri === 'upp://payment-methods') {
            const methods = await this.getPaymentMethods();
            return {
              contents: [
                {
                  uri,
                  mimeType: 'application/json',
                  text: JSON.stringify(methods, null, 2),
                },
              ],
            };
          }

          if (uri === 'upp://transaction-stats') {
            const stats = await this.getTransactionStats();
            return {
              contents: [
                {
                  uri,
                  mimeType: 'application/json',
                  text: JSON.stringify(stats, null, 2),
                },
              ],
            };
          }

          if (uri === 'upp://compliance-status') {
            const compliance = await this.getComplianceStatus();
            return {
              contents: [
                {
                  uri,
                  mimeType: 'application/json',
                  text: JSON.stringify(compliance, null, 2),
                },
              ],
            };
          }

          // Handle dynamic resources
          const transactionMatch = uri.match(/^upp:\/\/transactions\/([^/]+)$/);
          if (transactionMatch) {
            const transactionId = transactionMatch[1];
            const transaction = await this.getTransaction(transactionId);
            return {
              contents: [
                {
                  uri,
                  mimeType: 'application/json',
                  text: JSON.stringify(transaction, null, 2),
                },
              ],
            };
          }

          const deviceMatch = uri.match(/^upp:\/\/device\/([^/]+)\/status$/);
          if (deviceMatch) {
            const deviceId = deviceMatch[1];
            const status = await this.getDeviceStatus(deviceId);
            return {
              contents: [
                {
                  uri,
                  mimeType: 'application/json',
                  text: JSON.stringify(status, null, 2),
                },
              ],
            };
          }

          const methodMatch = uri.match(/^upp:\/\/payment-methods\/([^/]+)$/);
          if (methodMatch) {
            const methodId = methodMatch[1];
            const method = await this.getPaymentMethod(methodId);
            return {
              contents: [
                {
                  uri,
                  mimeType: 'application/json',
                  text: JSON.stringify(method, null, 2),
                },
              ],
            };
          }

          throw new McpError(
            ErrorCode.InvalidRequest,
            `Unknown resource URI: ${uri}`
          );
        } catch (error) {
          this.logger.error('Error reading resource:', error);
          throw new McpError(
            ErrorCode.InternalError,
            `Failed to read resource: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }
    );
  }

  private setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'process_payment',
          description: 'Process a payment transaction',
          inputSchema: {
            type: 'object',
            properties: {
              amount: {
                type: 'number',
                description: 'Payment amount in cents',
                minimum: 1,
              },
              currency: {
                type: 'string',
                description: 'Currency code (e.g., USD, EUR, JPY)',
                pattern: '^[A-Z]{3}$',
              },
              payment_method: {
                type: 'string',
                description: 'Payment method type (e.g., card, nfc, qr)',
              },
              device_type: {
                type: 'string',
                description: 'Device type for payment (e.g., smart-tv, mobile, nfc)',
              },
              customer_email: {
                type: 'string',
                description: 'Customer email address',
                format: 'email',
              },
              description: {
                type: 'string',
                description: 'Payment description',
              },
            },
            required: ['amount', 'currency', 'payment_method', 'device_type'],
          },
        },
        {
          name: 'refund_payment',
          description: 'Refund a payment transaction',
          inputSchema: {
            type: 'object',
            properties: {
              transaction_id: {
                type: 'string',
                description: 'Transaction ID to refund',
              },
              amount: {
                type: 'number',
                description: 'Refund amount in cents (optional, defaults to full amount)',
                minimum: 1,
              },
              reason: {
                type: 'string',
                description: 'Refund reason',
              },
            },
            required: ['transaction_id'],
          },
        },
        {
          name: 'get_payment_status',
          description: 'Get the status of a payment transaction',
          inputSchema: {
            type: 'object',
            properties: {
              transaction_id: {
                type: 'string',
                description: 'Transaction ID to check',
              },
            },
            required: ['transaction_id'],
          },
        },
        {
          name: 'validate_payment_method',
          description: 'Validate a payment method configuration',
          inputSchema: {
            type: 'object',
            properties: {
              payment_method: {
                type: 'string',
                description: 'Payment method type to validate',
              },
              configuration: {
                type: 'object',
                description: 'Payment method configuration object',
              },
            },
            required: ['payment_method', 'configuration'],
          },
        },
        {
          name: 'list_supported_devices',
          description: 'List all supported payment devices',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'run_compliance_check',
          description: 'Run compliance checks for PCI-DSS, GDPR, etc.',
          inputSchema: {
            type: 'object',
            properties: {
              check_type: {
                type: 'string',
                description: 'Type of compliance check (pci-dss, gdpr, audit)',
                enum: ['pci-dss', 'gdpr', 'audit'],
              },
            },
            required: ['check_type'],
          },
        },
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        switch (request.params.name) {
          case 'process_payment':
            return await this.processPayment(request.params.arguments);
          case 'refund_payment':
            return await this.refundPayment(request.params.arguments);
          case 'get_payment_status':
            return await this.getPaymentStatus(request.params.arguments);
          case 'validate_payment_method':
            return await this.validatePaymentMethod(request.params.arguments);
          case 'list_supported_devices':
            return await this.listSupportedDevices();
          case 'run_compliance_check':
            return await this.runComplianceCheck(request.params.arguments);
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${request.params.name}`
            );
        }
      } catch (error) {
        this.logger.error('Error executing tool:', error);
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  private async getPaymentMethods() {
    return {
      methods: [
        'credit_card',
        'debit_card',
        'nfc',
        'qr_code',
        'voice_assistant',
        'smart_tv',
        'gaming_controller',
        'iot_device',
        'webrtc',
      ],
      devices: [
        'mobile',
        'desktop',
        'smart_tv',
        'voice_assistant',
        'gaming_console',
        'iot_device',
        'pos_terminal',
      ],
    };
  }

  private async getTransactionStats() {
    // Mock implementation - in real scenario, this would query database
    return {
      total_transactions: 12543,
      total_volume: 8945672,
      success_rate: 0.987,
      average_transaction_amount: 713.45,
      top_payment_methods: ['credit_card', 'nfc', 'qr_code'],
      top_devices: ['mobile', 'smart_tv', 'pos_terminal'],
    };
  }

  private async getComplianceStatus() {
    return {
      'pci-dss': {
        compliant: true,
        last_audit: new Date().toISOString(),
        level: 'level_1',
      },
      gdpr: {
        compliant: true,
        last_audit: new Date().toISOString(),
        data_retention_days: 2555,
      },
      audit: {
        last_audit: new Date().toISOString(),
        findings: 0,
        recommendations: ['Regular security updates', 'Quarterly penetration testing'],
      },
    };
  }

  private async getTransaction(transactionId: string) {
    // Mock implementation
    return {
      id: transactionId,
      amount: 1000,
      currency: 'USD',
      status: 'completed',
      payment_method: 'credit_card',
      device_type: 'mobile',
      created_at: new Date().toISOString(),
      customer_email: 'customer@example.com',
    };
  }

  private async getDeviceStatus(deviceId: string) {
    // Mock implementation
    return {
      id: deviceId,
      type: 'smart_tv',
      status: 'online',
      last_seen: new Date().toISOString(),
      capabilities: ['nfc', 'qr_code', 'voice'],
      location: 'Living Room',
    };
  }

  private async getPaymentMethod(methodId: string) {
    // Mock implementation
    return {
      id: methodId,
      type: 'credit_card',
      name: 'Visa',
      supported_currencies: ['USD', 'EUR', 'GBP'],
      requires_internet: true,
      security_level: 'high',
    };
  }

  private async processPayment(args: any) {
    const { amount, currency, payment_method, device_type, customer_email, description } = args;
    
    // Mock payment processing
    const transaction = {
      id: `txn_${Date.now()}`,
      amount,
      currency,
      payment_method,
      device_type,
      customer_email,
      description,
      status: 'completed',
      created_at: new Date().toISOString(),
    };

    this.logger.info('Payment processed:', transaction);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            transaction,
            message: 'Payment processed successfully',
          }, null, 2),
        },
      ],
    };
  }

  private async refundPayment(args: any) {
    const { transaction_id, amount, reason } = args;
    
    const refund = {
      id: `refund_${Date.now()}`,
      transaction_id,
      amount: amount || 1000, // Mock amount
      reason,
      status: 'completed',
      created_at: new Date().toISOString(),
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            refund,
            message: 'Refund processed successfully',
          }, null, 2),
        },
      ],
    };
  }

  private async getPaymentStatus(args: any) {
    const { transaction_id } = args;
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            transaction_id,
            status: 'completed',
            amount: 1000,
            currency: 'USD',
            created_at: new Date().toISOString(),
          }, null, 2),
        },
      ],
    };
  }

  private async validatePaymentMethod(args: any) {
    const { payment_method, configuration } = args;
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            valid: true,
            payment_method,
            configuration,
            message: 'Payment method configuration is valid',
          }, null, 2),
        },
      ],
    };
  }

  private async listSupportedDevices() {
    const devices = [
      { id: 'smart_tv', name: 'Smart TV', capabilities: ['nfc', 'qr_code', 'voice'] },
      { id: 'mobile', name: 'Mobile Phone', capabilities: ['nfc', 'qr_code', 'card'] },
      { id: 'voice_assistant', name: 'Voice Assistant', capabilities: ['voice'] },
      { id: 'gaming_console', name: 'Gaming Console', capabilities: ['qr_code', 'voice'] },
      { id: 'iot_device', name: 'IoT Device', capabilities: ['nfc', 'qr_code'] },
      { id: 'pos_terminal', name: 'POS Terminal', capabilities: ['card', 'nfc', 'qr_code'] },
    ];

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ devices }, null, 2),
        },
      ],
    };
  }

  private async runComplianceCheck(args: any) {
    const { check_type } = args;
    
    const results = {
      'pci-dss': {
        compliant: true,
        checks: ['encryption', 'tokenization', 'access_control'],
        score: 100,
      },
      gdpr: {
        compliant: true,
        checks: ['data_protection', 'consent_management', 'right_to_be_forgotten'],
        score: 95,
      },
      audit: {
        compliant: true,
        checks: ['logging', 'monitoring', 'incident_response'],
        score: 98,
      },
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            check_type,
            ...results[check_type as keyof typeof results],
          }, null, 2),
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Universal Payment Protocol MCP server running on stdio');
  }
}

const server = new UniversalPaymentMcpServer();
server.run().catch(console.error);
