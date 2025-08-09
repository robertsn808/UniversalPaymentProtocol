// 🌊 DEVICE ONBOARDING FLOW - Welcome New Devices to UPP Universe!
// This shows how ANY device can join the payment network! 🚀

export interface OnboardingStep {
  id: string;
  name: string;
  description: string;
  completed: boolean;
  required: boolean;
}

export interface DeviceOnboarding {
  deviceId: string;
  deviceType: string;
  steps: OnboardingStep[];
  progress: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startTime: Date;
  completionTime?: Date;
}

export class DeviceOnboardingFlow {
  private onboardingSessions = new Map<string, DeviceOnboarding>();

  async startOnboarding(deviceId: string, deviceType: string): Promise<DeviceOnboarding> {
    const onboarding: DeviceOnboarding = {
      deviceId,
      deviceType,
      steps: this.getOnboardingSteps(deviceType),
      progress: 0,
      status: 'in_progress',
      startTime: new Date()
    };

    this.onboardingSessions.set(deviceId, onboarding);
    console.log(`🌊 Started onboarding for ${deviceType} device: ${deviceId}`);

    return onboarding;
  }

  private getOnboardingSteps(deviceType: string): OnboardingStep[] {
    const baseSteps: OnboardingStep[] = [
      {
        id: 'device_registration',
        name: 'Device Registration',
        description: 'Register device with UPP network',
        completed: false,
        required: true
      },
      {
        id: 'security_setup',
        name: 'Security Setup',
        description: 'Configure security protocols',
        completed: false,
        required: true
      },
      {
        id: 'payment_method_config',
        name: 'Payment Method Configuration',
        description: 'Set up payment processing capabilities',
        completed: false,
        required: true
      }
    ];

    // Add device-specific steps
    if (deviceType === 'smartphone') {
      baseSteps.push({
        id: 'nfc_setup',
        name: 'NFC Setup',
        description: 'Configure NFC payment capabilities',
        completed: false,
        required: false
      });
    } else if (deviceType === 'smart_tv') {
      baseSteps.push({
        id: 'qr_setup',
        name: 'QR Code Setup',
        description: 'Configure QR code payment display',
        completed: false,
        required: false
      });
    }

    return baseSteps;
  }

  async completeStep(deviceId: string, stepId: string): Promise<boolean> {
    const onboarding = this.onboardingSessions.get(deviceId);
    if (!onboarding) return false;

    const step = onboarding.steps.find(s => s.id === stepId);
    if (!step) return false;

    step.completed = true;
    onboarding.progress = this.calculateProgress(onboarding.steps);

    // Check if onboarding is complete
    const allRequiredStepsComplete = onboarding.steps
      .filter(s => s.required)
      .every(s => s.completed);

    if (allRequiredStepsComplete) {
      onboarding.status = 'completed';
      onboarding.completionTime = new Date();
      console.log(`✅ Device onboarding completed for ${deviceId}`);
    }

    return true;
  }

  private calculateProgress(steps: OnboardingStep[]): number {
    const completed = steps.filter(s => s.completed).length;
    return Math.round((completed / steps.length) * 100);
  }

  getOnboardingStatus(deviceId: string): DeviceOnboarding | undefined {
    return this.onboardingSessions.get(deviceId);
  }

  getAllOnboardingSessions(): DeviceOnboarding[] {
    return Array.from(this.onboardingSessions.values());
  }
}

export const deviceOnboardingFlow = new DeviceOnboardingFlow();