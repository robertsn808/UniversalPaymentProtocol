export interface DemoConfig {
  enableLogging: boolean;
  runAllScenarios: boolean;
  scenarios: {
    smartphone: boolean;
    smartTV: boolean;
    iot: boolean;
    voice: boolean;
    gaming: boolean;
  };
  delays: {
    betweenScenarios: number;
    paymentProcessing: number;
  };
  paymentGateway: {
    mockDelayMs: number;
    successRate: number;
  };
}

export const DEFAULT_DEMO_CONFIG: DemoConfig = {
  enableLogging: true,
  runAllScenarios: true,
  scenarios: {
    smartphone: true,
    smartTV: true,
    iot: true,
    voice: true,
    gaming: true
  },
  delays: {
    betweenScenarios: 1000,
    paymentProcessing: 1000
  },
  paymentGateway: {
    mockDelayMs: 1000,
    successRate: 1.0
  }
};