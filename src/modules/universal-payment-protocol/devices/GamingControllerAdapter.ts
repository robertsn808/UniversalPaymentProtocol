import { z } from 'zod';
import crypto from 'crypto';

import { UPPDevice, DeviceCapabilities, PaymentRequest, PaymentResult, GamingResponse, PaymentUIOptions } from '../core/types.js';
import { UPPError } from '../../../utils/errors.js';

// Gaming Platform Types
export enum GamingPlatform {
  PLAYSTATION_5 = 'playstation_5',
  XBOX_SERIES_X = 'xbox_series_x',
  NINTENDO_SWITCH = 'nintendo_switch',
  STEAM_DECK = 'steam_deck',
  PC_GAMING = 'pc_gaming',
  MOBILE_GAMING = 'mobile_gaming',
  VR_HEADSET = 'vr_headset',
  RETRO_CONSOLE = 'retro_console',
}

// Controller Input Types
export enum ControllerInput {
  // D-Pad
  DPAD_UP = 'DPAD_UP',
  DPAD_DOWN = 'DPAD_DOWN',
  DPAD_LEFT = 'DPAD_LEFT',
  DPAD_RIGHT = 'DPAD_RIGHT',
  
  // Face Buttons
  BUTTON_A = 'BUTTON_A',
  BUTTON_B = 'BUTTON_B',
  BUTTON_X = 'BUTTON_X',
  BUTTON_Y = 'BUTTON_Y',
  
  // Shoulder Buttons
  LEFT_BUMPER = 'LEFT_BUMPER',
  RIGHT_BUMPER = 'RIGHT_BUMPER',
  LEFT_TRIGGER = 'LEFT_TRIGGER',
  RIGHT_TRIGGER = 'RIGHT_TRIGGER',
  
  // Analog Sticks
  LEFT_STICK_UP = 'LEFT_STICK_UP',
  LEFT_STICK_DOWN = 'LEFT_STICK_DOWN',
  LEFT_STICK_LEFT = 'LEFT_STICK_LEFT',
  LEFT_STICK_RIGHT = 'LEFT_STICK_RIGHT',
  LEFT_STICK_CLICK = 'LEFT_STICK_CLICK',
  
  RIGHT_STICK_UP = 'RIGHT_STICK_UP',
  RIGHT_STICK_DOWN = 'RIGHT_STICK_DOWN',
  RIGHT_STICK_LEFT = 'RIGHT_STICK_LEFT',
  RIGHT_STICK_RIGHT = 'RIGHT_STICK_RIGHT',
  RIGHT_STICK_CLICK = 'RIGHT_STICK_CLICK',
  
  // System Buttons
  START = 'START',
  SELECT = 'SELECT',
  HOME = 'HOME',
  MENU = 'MENU',
  
  // Special Features
  TOUCHPAD_TAP = 'TOUCHPAD_TAP',
  TOUCHPAD_SWIPE = 'TOUCHPAD_SWIPE',
  GYRO_TILT = 'GYRO_TILT',
  ACCELEROMETER = 'ACCELEROMETER',
}

// Controller Input Sequence for Payments
const ControllerSequenceSchema = z.object({
  inputs: z.array(z.nativeEnum(ControllerInput)),
  timing: z.array(z.number()), // Milliseconds between inputs
  holdDuration: z.array(z.number().optional()), // How long to hold each input
});

export type ControllerSequence = z.infer<typeof ControllerSequenceSchema>;

// Gaming Purchase Types
export enum GamePurchaseType {
  DLC = 'downloadable_content',
  COSMETIC = 'cosmetic_item',
  CURRENCY = 'in_game_currency',
  BATTLE_PASS = 'battle_pass',
  SUBSCRIPTION = 'subscription',
  FULL_GAME = 'full_game',
  EXPANSION = 'expansion_pack',
  LOOT_BOX = 'loot_box',
}

// Gaming Purchase Schema
const GamePurchaseSchema = z.object({
  purchaseType: z.nativeEnum(GamePurchaseType),
  gameId: z.string(),
  itemId: z.string(),
  itemName: z.string(),
  rarity: z.enum(['common', 'uncommon', 'rare', 'epic', 'legendary']).optional(),
  quantity: z.number().positive().default(1),
  price: z.number().positive(),
  currency: z.string().length(3),
  previewAvailable: z.boolean().default(false),
});

export type GamePurchase = z.infer<typeof GamePurchaseSchema>;

// Haptic Feedback Patterns
export enum HapticPattern {
  SUCCESS_PULSE = 'success_pulse',
  ERROR_BUZZ = 'error_buzz',
  PAYMENT_CONFIRM = 'payment_confirm',
  MENU_NAVIGATION = 'menu_navigation',
  SELECTION_CLICK = 'selection_click',
  WARNING_VIBRATION = 'warning_vibration',
  COIN_COLLECT = 'coin_collect',
  LEVEL_COMPLETE = 'level_complete',
}

// Gaming Controller Configuration
export interface GamingControllerConfig {
  platform: GamingPlatform;
  controllerId: string;
  playerNumber: number;
  features: {
    hasHapticFeedback: boolean;
    hasAdaptiveTriggers: boolean; // PS5 DualSense
    hasTouchpad: boolean;
    hasGyroscope: boolean;
    hasAccelerometer: boolean;
    hasSpeaker: boolean;
    hasMicrophone: boolean;
    hasLightBar: boolean;
  };
  paymentSettings: {
    requireSequenceAuth: boolean;
    secretSequence: ControllerSequence;
    maxPurchaseAmount: number;
    parentalControls: boolean;
    spendingLimit: {
      daily: number;
      weekly: number;
      monthly: number;
    };
  };
  gameIntegration: {
    apiKey?: string;
    gameTitle: string;
    developerId: string;
    supportedPurchaseTypes: GamePurchaseType[];
    overlayEnabled: boolean;
    achievementIntegration: boolean;
  };
  displaySettings: {
    overlayPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
    overlayOpacity: number;
    animationSpeed: 'fast' | 'medium' | 'slow';
    theme: 'dark' | 'light' | 'gaming' | 'minimal';
  };
}

/**
 * Gaming Controller Adapter for in-game purchases and gaming payments
 * Supports console controllers, handheld devices, and VR controllers
 */
export class GamingControllerAdapter implements UPPDevice {
  private config: GamingControllerConfig;
  private isInitialized = false;
  private controllerState = new Map<ControllerInput, { pressed: boolean; value: number; timestamp: number }>();
  private inputSequence: ControllerInput[] = [];
  private hapticDevice?: any; // Platform-specific haptic interface
  private gameOverlayElement?: HTMLElement;
  private currentPurchase?: GamePurchase;
  private spendingTracker = {
    daily: 0,
    weekly: 0,
    monthly: 0,
    lastReset: Date.now(),
  };

  constructor(config: Partial<GamingControllerConfig> = {}) {
    this.config = {
      platform: GamingPlatform.PC_GAMING,
      controllerId: 'generic-controller',
      playerNumber: 1,
      features: {
        hasHapticFeedback: true,
        hasAdaptiveTriggers: false,
        hasTouchpad: false,
        hasGyroscope: false,
        hasAccelerometer: false,
        hasSpeaker: false,
        hasMicrophone: false,
        hasLightBar: false,
      },
      paymentSettings: {
        requireSequenceAuth: true,
        secretSequence: {
          inputs: [ControllerInput.BUTTON_X, ControllerInput.BUTTON_Y, ControllerInput.BUTTON_B, ControllerInput.BUTTON_A],
          timing: [500, 500, 500],
          holdDuration: [undefined, undefined, undefined, undefined],
        },
        maxPurchaseAmount: 10000, // $100.00
        parentalControls: false,
        spendingLimit: {
          daily: 5000, // $50.00
          weekly: 20000, // $200.00
          monthly: 50000, // $500.00
        },
      },
      gameIntegration: {
        gameTitle: 'Universal Payment Game',
        developerId: 'upp-gaming',
        supportedPurchaseTypes: [
          GamePurchaseType.DLC,
          GamePurchaseType.COSMETIC,
          GamePurchaseType.CURRENCY,
        ],
        overlayEnabled: true,
        achievementIntegration: false,
      },
      displaySettings: {
        overlayPosition: 'top-right',
        overlayOpacity: 0.9,
        animationSpeed: 'medium',
        theme: 'gaming',
      },
      ...config,
    };
  }

  // UPPDevice interface implementation
  getDeviceId(): string {
    return `gaming-${this.getDeviceFingerprint()}`;
  }

  getDeviceType(): string {
    return 'GAMING_CONTROLLER';
  }

  getCapabilities(): DeviceCapabilities {
    return {
      hasDisplay: this.config.gameIntegration.overlayEnabled,
      hasCamera: false,
      hasNFC: false,
      hasBluetooth: [GamingPlatform.PLAYSTATION_5, GamingPlatform.XBOX_SERIES_X, GamingPlatform.NINTENDO_SWITCH].includes(this.config.platform),
      hasWiFi: this.config.platform !== GamingPlatform.RETRO_CONSOLE,
      hasKeypad: false,
      hasTouchScreen: this.config.features.hasTouchpad,
      hasVoiceInput: this.config.features.hasMicrophone,
      hasVoiceOutput: this.config.features.hasSpeaker,
      hasPrinter: false,
      supportsEncryption: true,
      internet_connection: this.config.platform !== GamingPlatform.RETRO_CONSOLE,
      maxPaymentAmount: this.config.paymentSettings.maxPurchaseAmount,
      supportedCurrencies: ['USD', 'EUR', 'GBP', 'JPY'],
      securityLevel: this.config.paymentSettings.requireSequenceAuth ? 'HIGH' : 'STANDARD',
    };
  }

  getDeviceFingerprint(): string {
    const platformId = this.config.platform.substring(0, 4);
    const controllerId = this.config.controllerId.substring(0, 6);
    const featuresHash = this.hashFeatures();
    
    return `${platformId}-${controllerId}-${featuresHash}`;
  }

  async handlePaymentResponse(response: PaymentResult): Promise<GamingResponse> {
    const hapticPattern = response.success ? HapticPattern.SUCCESS_PULSE : HapticPattern.ERROR_BUZZ;
    
    // Trigger haptic feedback
    if (this.config.features.hasHapticFeedback) {
      await this.triggerHapticFeedback(hapticPattern);
    }

    return {
      success: response.success,
      overlayMessage: response.success 
        ? `Purchase Successful! ${response.transactionId}` 
        : `Purchase Failed: ${response.error}`,
      hapticPattern,
      achievementUnlocked: response.success ? this.checkAchievementUnlock(response) : undefined,
      gameCurrencyAwarded: response.success ? this.calculateBonusCurrency(response) : 0,
      metadata: {
        platform: this.config.platform,
        gameTitle: this.config.gameIntegration.gameTitle,
        playerNumber: this.config.playerNumber,
        purchaseType: this.currentPurchase?.purchaseType,
      },
    };
  }

  async handleError(error: UPPError): Promise<void> {
    console.error(`Gaming Controller Error: ${error.message}`);
    
    // Show error overlay
    await this.showGameOverlay({
      title: 'Payment Error',
      message: error.message,
      type: 'error',
      duration: 5000,
    });
    
    // Error haptic feedback
    if (this.config.features.hasHapticFeedback) {
      await this.triggerHapticFeedback(HapticPattern.ERROR_BUZZ);
    }

    // Clear current purchase
    this.currentPurchase = undefined;
  }

  getFingerprint(): string {
    return `gaming-${this.config.platform}-${this.config.playerNumber}-${this.hashConfig()}`;
  }

  private hashConfig(): string {
    return crypto.createHash('md5').update(JSON.stringify({
      platform: this.config.platform,
      gameTitle: this.config.gameIntegration?.gameTitle || 'unknown',
      playerNumber: this.config.playerNumber,
      features: this.config.features
    })).digest('hex').substring(0, 8);
  }

  getSecurityContext(): any {
    return {
      platform: this.config.platform,
      playerNumber: this.config.playerNumber,
      encryptionLevel: 'TLS',
      biometricSupport: false, // Gaming controllers don't typically have biometric auth
      sequenceAuthEnabled: this.config.paymentSettings.requireSequenceAuth,
      maxPaymentAmount: this.config.paymentSettings.maxPurchaseAmount,
      securityLevel: this.config.paymentSettings.requireSequenceAuth ? 'HIGH' : 'STANDARD'
    };
  }

  // Gaming Controller specific methods

  /**
   * Initialize gaming controller and platform integration
   */
  async initializeController(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Initialize platform-specific controller SDK
      await this.initializePlatformSDK();
      
      // Setup controller input handlers
      await this.setupControllerInputs();
      
      // Initialize haptic feedback
      if (this.config.features.hasHapticFeedback) {
        await this.initializeHapticFeedback();
      }
      
      // Setup game overlay
      if (this.config.gameIntegration.overlayEnabled) {
        await this.createGameOverlay();
      }
      
      // Load spending tracker
      await this.loadSpendingTracker();

      this.isInitialized = true;
      console.log('Gaming Controller Adapter initialized successfully');
    } catch (error) {
      throw new UPPError(`Failed to initialize gaming controller: ${error}`, 'GAMING_CONTROLLER_INIT_ERROR');
    }
  }

  /**
   * Process controller input for payment navigation
   */
  async captureControllerInput(timeout = 30000): Promise<any> {
    if (!this.isInitialized) {
      await this.initializeController();
    }

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new UPPError('Controller input timeout', 'GAMING_CONTROLLER_TIMEOUT'));
      }, timeout);

      let inputData: {
        sequence: Array<{ input: ControllerInput; value: number; timestamp: number; }>;
        menuNavigation: string | null;
        purchaseConfirmation: boolean;
      } = {
        sequence: [],
        menuNavigation: null,
        purchaseConfirmation: false,
      };

      // Listen for controller input
      const inputHandler = (input: ControllerInput, value: number) => {
        this.inputSequence.push(input);
        inputData.sequence.push({ input, value, timestamp: Date.now() });

        // Check for payment confirmation sequence
        if (this.config.paymentSettings.requireSequenceAuth) {
          const sequenceMatch = this.checkSecretSequence();
          if (sequenceMatch) {
            clearTimeout(timeoutId);
            inputData.purchaseConfirmation = true;
            resolve(inputData);
            return;
          }
        }

        // Handle specific button presses
        switch (input) {
          case ControllerInput.BUTTON_A:
            // Confirm purchase
            clearTimeout(timeoutId);
            inputData.purchaseConfirmation = true;
            resolve(inputData);
            break;
          
          case ControllerInput.BUTTON_B:
            // Cancel purchase
            clearTimeout(timeoutId);
            inputData.purchaseConfirmation = false;
            resolve(inputData);
            break;
          
          case ControllerInput.START:
            // Menu access
            inputData.menuNavigation = 'menu';
            break;
        }

        // Trigger navigation feedback
        if (this.config.features.hasHapticFeedback) {
          this.triggerHapticFeedback(HapticPattern.MENU_NAVIGATION);
        }
      };

      // Simulate controller input capture
      this.setupInputCapture(inputHandler);
    });
  }

  /**
   * Display payment UI overlay in game
   */
  async displayPaymentUI(options: PaymentUIOptions): Promise<void> {
    // Convert PaymentUIOptions to GamePurchase for internal use
    const purchase: GamePurchase = {
      currency: options.currency,
      price: options.amount,
      quantity: 1,
      itemId: 'payment-item',
      purchaseType: 'in_game_currency' as GamePurchaseType,
      gameId: this.config.gameIntegration?.gameTitle || 'unknown',
      itemName: options.description || 'Payment',
      previewAvailable: false,
    };
    
    this.currentPurchase = purchase;

    const overlayContent = {
      title: 'Confirm Purchase',
      itemName: purchase.itemName,
      itemType: purchase.purchaseType,
      price: `$${(purchase.price / 100).toFixed(2)} ${purchase.currency}`,
      rarity: purchase.rarity,
      quantity: purchase.quantity,
      preview: purchase.previewAvailable,
      instructions: this.config.paymentSettings.requireSequenceAuth 
        ? 'Enter secret sequence or press A to confirm, B to cancel'
        : 'Press A to confirm, B to cancel',
    };

    await this.showGameOverlay({
      title: overlayContent.title,
      content: overlayContent,
      type: 'purchase',
      duration: 30000, // 30 seconds timeout
    });

    // Play preview if available
    if (purchase.previewAvailable) {
      await this.playItemPreview(purchase);
    }
  }

  /**
   * Process in-game purchase with controller confirmation
   */
  async processInGamePurchase(purchase: GamePurchase): Promise<PaymentResult> {
    try {
      // Check spending limits
      await this.checkSpendingLimits(purchase.price);
      
      // Display purchase UI
      await this.displayPaymentUI({
        amount: purchase.price,
        currency: purchase.currency,
        description: purchase.itemName,
        theme: 'dark'
      });
      
      // Capture controller input for confirmation
      const inputData = await this.captureControllerInput();
      
      if (!inputData.purchaseConfirmation) {
        return {
          success: false,
          transactionId: '',
          amount: purchase.price,
          currency: purchase.currency,
          error: 'Purchase cancelled by user',
          metadata: { cancelled: true },
        };
      }

      // Create payment request
      const paymentRequest: PaymentRequest = {
        amount: purchase.price,
        currency: purchase.currency,
        merchantId: this.config.gameIntegration.developerId,
        description: `${purchase.itemName} - ${purchase.gameId}`,
        metadata: {
          gameId: purchase.gameId,
          itemId: purchase.itemId,
          purchaseType: purchase.purchaseType,
          playerNumber: this.config.playerNumber,
          platform: this.config.platform,
        },
      };

      // Process payment (simulate success)
      const transactionId = `gaming_${Date.now()}_${Math.random().toString(36).substring(2)}`;
      
      // Update spending tracker
      await this.updateSpendingTracker(purchase.price);

      return {
        success: true,
        transactionId,
        amount: purchase.price,
        currency: purchase.currency,
        timestamp: new Date(),
        metadata: {
          gameTitle: this.config.gameIntegration.gameTitle,
          itemName: purchase.itemName,
          purchaseType: purchase.purchaseType,
          platform: this.config.platform,
        },
      };
    } catch (error) {
      return {
        success: false,
        transactionId: '',
        amount: purchase.price,
        currency: purchase.currency,
        error: error instanceof UPPError ? error.message : 'Purchase failed',
        metadata: { gamingError: true },
      };
    } finally {
      // Hide overlay
      await this.hideGameOverlay();
    }
  }

  /**
   * Trigger haptic feedback on controller
   */
  async triggerHapticFeedback(pattern: HapticPattern): Promise<void> {
    if (!this.config.features.hasHapticFeedback || !this.hapticDevice) {
      return;
    }

    try {
      const hapticConfig = this.getHapticConfig(pattern);
      
      // Platform-specific haptic implementation
      switch (this.config.platform) {
        case GamingPlatform.PLAYSTATION_5:
          await this.triggerPS5Haptics(hapticConfig);
          break;
        
        case GamingPlatform.XBOX_SERIES_X:
          await this.triggerXboxHaptics(hapticConfig);
          break;
        
        case GamingPlatform.NINTENDO_SWITCH:
          await this.triggerSwitchHaptics(hapticConfig);
          break;
        
        default:
          await this.triggerGenericHaptics(hapticConfig);
      }

      console.log(`Haptic feedback triggered: ${pattern}`);
    } catch (error) {
      console.error('Failed to trigger haptic feedback:', error);
    }
  }

  /**
   * Update controller light bar or LED indicators
   */
  async updateControllerLights(color: string, pattern: 'solid' | 'pulse' | 'flash'): Promise<void> {
    if (!this.config.features.hasLightBar) {
      return;
    }

    try {
      const lightConfig = {
        color,
        pattern,
        brightness: 0.7,
        duration: 3000,
      };

      console.log(`Controller lights updated:`, lightConfig);
    } catch (error) {
      console.error('Failed to update controller lights:', error);
    }
  }

  // Private helper methods

  private async initializePlatformSDK(): Promise<void> {
    switch (this.config.platform) {
      case GamingPlatform.PLAYSTATION_5:
        await this.initializePS5SDK();
        break;
      
      case GamingPlatform.XBOX_SERIES_X:
        await this.initializeXboxSDK();
        break;
      
      case GamingPlatform.NINTENDO_SWITCH:
        await this.initializeSwitchSDK();
        break;
      
      case GamingPlatform.STEAM_DECK:
        await this.initializeSteamSDK();
        break;
      
      default:
        console.log('Using generic gaming controller implementation');
    }
  }

  private async initializePS5SDK(): Promise<void> {
    console.log('Initializing PlayStation 5 SDK...');
    // PS5 DualSense SDK initialization
  }

  private async initializeXboxSDK(): Promise<void> {
    console.log('Initializing Xbox Series X SDK...');
    // Xbox Game Development Kit initialization
  }

  private async initializeSwitchSDK(): Promise<void> {
    console.log('Initializing Nintendo Switch SDK...');
    // Nintendo Switch SDK initialization
  }

  private async initializeSteamSDK(): Promise<void> {
    console.log('Initializing Steam Deck SDK...');
    // Steam Input API initialization
  }

  private async setupControllerInputs(): Promise<void> {
    console.log('Setting up controller input handlers...');
    
    // Initialize controller state
    Object.values(ControllerInput).forEach(input => {
      this.controllerState.set(input, {
        pressed: false,
        value: 0,
        timestamp: 0,
      });
    });
  }

  private async initializeHapticFeedback(): Promise<void> {
    console.log('Initializing haptic feedback...');
    
    // Platform-specific haptic device initialization
    // this.hapticDevice = platformSpecificHapticInterface;
  }

  private async createGameOverlay(): Promise<void> {
    if (typeof document === 'undefined') {
      return; // Not in browser environment
    }

    this.gameOverlayElement = document.createElement('div');
    this.gameOverlayElement.id = 'upp-gaming-overlay';
    
    const position = this.config.displaySettings.overlayPosition;
    const [vAlign, hAlign] = position.split('-');
    
    this.gameOverlayElement.style.cssText = `
      position: fixed;
      ${vAlign}: 20px;
      ${hAlign}: 20px;
      width: 400px;
      max-height: 300px;
      background: rgba(0, 0, 0, ${this.config.displaySettings.overlayOpacity});
      color: #ffffff;
      padding: 20px;
      border-radius: 10px;
      font-family: 'Consolas', monospace;
      font-size: 14px;
      z-index: 10000;
      display: none;
      border: 2px solid #00ff00;
      box-shadow: 0 4px 20px rgba(0, 255, 0, 0.3);
    `;

    document.body.appendChild(this.gameOverlayElement);
  }

  private setupInputCapture(inputHandler: (input: ControllerInput, value: number) => void): void {
    // Setup gamepad API or platform-specific input capture
    if (typeof navigator !== 'undefined' && navigator.getGamepads) {
      const pollGamepad = () => {
        const gamepads = navigator.getGamepads();
        const gamepad = gamepads[this.config.playerNumber - 1];
        
        if (gamepad) {
          // Check buttons
          gamepad.buttons.forEach((button, index) => {
            if (button.pressed) {
              const input = this.mapButtonIndexToInput(index);
              if (input) {
                inputHandler(input, button.value);
              }
            }
          });
          
          // Check analog sticks
          gamepad.axes.forEach((axisValue, index) => {
            if (Math.abs(axisValue) > 0.1) { // Dead zone
              const input = this.mapAxisToInput(index, axisValue);
              if (input) {
                inputHandler(input, axisValue);
              }
            }
          });
        }
        
        requestAnimationFrame(pollGamepad);
      };
      
      pollGamepad();
    } else {
      // Simulate controller input for demo
      setTimeout(() => {
        inputHandler(ControllerInput.BUTTON_A, 1.0);
      }, 2000);
    }
  }

  private mapButtonIndexToInput(buttonIndex: number): ControllerInput | null {
    // Standard gamepad button mapping
    const buttonMap: Record<number, ControllerInput> = {
      0: ControllerInput.BUTTON_A,
      1: ControllerInput.BUTTON_B,
      2: ControllerInput.BUTTON_X,
      3: ControllerInput.BUTTON_Y,
      4: ControllerInput.LEFT_BUMPER,
      5: ControllerInput.RIGHT_BUMPER,
      6: ControllerInput.LEFT_TRIGGER,
      7: ControllerInput.RIGHT_TRIGGER,
      8: ControllerInput.SELECT,
      9: ControllerInput.START,
      10: ControllerInput.LEFT_STICK_CLICK,
      11: ControllerInput.RIGHT_STICK_CLICK,
      12: ControllerInput.DPAD_UP,
      13: ControllerInput.DPAD_DOWN,
      14: ControllerInput.DPAD_LEFT,
      15: ControllerInput.DPAD_RIGHT,
      16: ControllerInput.HOME,
    };

    return buttonMap[buttonIndex] || null;
  }

  private mapAxisToInput(axisIndex: number, value: number): ControllerInput | null {
    // Map analog stick axes to inputs
    switch (axisIndex) {
      case 0: return value > 0 ? ControllerInput.LEFT_STICK_RIGHT : ControllerInput.LEFT_STICK_LEFT;
      case 1: return value > 0 ? ControllerInput.LEFT_STICK_DOWN : ControllerInput.LEFT_STICK_UP;
      case 2: return value > 0 ? ControllerInput.RIGHT_STICK_RIGHT : ControllerInput.RIGHT_STICK_LEFT;
      case 3: return value > 0 ? ControllerInput.RIGHT_STICK_DOWN : ControllerInput.RIGHT_STICK_UP;
      default: return null;
    }
  }

  private checkSecretSequence(): boolean {
    const requiredSequence = this.config.paymentSettings.secretSequence.inputs;
    const recentInputs = this.inputSequence.slice(-requiredSequence.length);
    
    return recentInputs.length === requiredSequence.length &&
           recentInputs.every((input, index) => input === requiredSequence[index]);
  }

  private async showGameOverlay(config: any): Promise<void> {
    if (!this.gameOverlayElement) {
      return;
    }

    let content = '';
    
    if (config.type === 'purchase' && config.content) {
      const item = config.content;
      content = `
        <div style="text-align: center;">
          <h3 style="color: #00ff00; margin: 0 0 15px 0;">${config.title}</h3>
          <div style="border: 1px solid #333; padding: 15px; margin-bottom: 15px;">
            <h4 style="color: #ffff00; margin: 0 0 10px 0;">${item.itemName}</h4>
            <p style="margin: 5px 0;">Type: ${item.itemType}</p>
            <p style="margin: 5px 0;">Price: <strong>${item.price}</strong></p>
            ${item.rarity ? `<p style="margin: 5px 0;">Rarity: <span style="color: #ff6600;">${item.rarity.toUpperCase()}</span></p>` : ''}
            ${item.quantity > 1 ? `<p style="margin: 5px 0;">Quantity: ${item.quantity}</p>` : ''}
          </div>
          <p style="font-size: 12px; color: #aaa; margin: 10px 0;">${item.instructions}</p>
        </div>
      `;
    } else {
      content = `
        <div style="text-align: center;">
          <h3 style="color: ${config.type === 'error' ? '#ff0000' : '#00ff00'}; margin: 0 0 15px 0;">${config.title}</h3>
          <p style="margin: 10px 0;">${config.message}</p>
        </div>
      `;
    }

    this.gameOverlayElement.innerHTML = content;
    this.gameOverlayElement.style.display = 'block';

    // Auto-hide after duration
    if (config.duration) {
      setTimeout(() => {
        this.hideGameOverlay();
      }, config.duration);
    }
  }

  private async hideGameOverlay(): Promise<void> {
    if (this.gameOverlayElement) {
      this.gameOverlayElement.style.display = 'none';
    }
  }

  private getHapticConfig(pattern: HapticPattern): any {
    const configs: Record<HapticPattern, any> = {
      [HapticPattern.SUCCESS_PULSE]: { intensity: 0.8, duration: 200, pattern: 'pulse' },
      [HapticPattern.ERROR_BUZZ]: { intensity: 1.0, duration: 500, pattern: 'buzz' },
      [HapticPattern.PAYMENT_CONFIRM]: { intensity: 0.6, duration: 300, pattern: 'double-tap' },
      [HapticPattern.MENU_NAVIGATION]: { intensity: 0.3, duration: 50, pattern: 'click' },
      [HapticPattern.SELECTION_CLICK]: { intensity: 0.4, duration: 100, pattern: 'click' },
      [HapticPattern.COIN_COLLECT]: { intensity: 0.5, duration: 150, pattern: 'chirp' },
      [HapticPattern.WARNING_VIBRATION]: { intensity: 0.7, duration: 400, pattern: 'warning' },
      [HapticPattern.LEVEL_COMPLETE]: { intensity: 0.9, duration: 600, pattern: 'celebration' },
    };

    return configs[pattern] || { intensity: 0.5, duration: 200, pattern: 'pulse' };
  }

  private async triggerPS5Haptics(config: any): Promise<void> {
    console.log('PS5 DualSense haptic feedback:', config);
    // PS5 adaptive trigger and haptic implementation
  }

  private async triggerXboxHaptics(config: any): Promise<void> {
    console.log('Xbox controller haptic feedback:', config);
    // Xbox controller vibration implementation
  }

  private async triggerSwitchHaptics(config: any): Promise<void> {
    console.log('Nintendo Switch HD Rumble:', config);
    // Nintendo Switch HD Rumble implementation
  }

  private async triggerGenericHaptics(config: any): Promise<void> {
    console.log('Generic controller vibration:', config);
    // Generic gamepad vibration API
    if (navigator.getGamepads) {
      const gamepads = navigator.getGamepads();
      const gamepad = gamepads[this.config.playerNumber - 1];
      
      if (gamepad && gamepad.vibrationActuator) {
        gamepad.vibrationActuator.playEffect('dual-rumble', {
          duration: config.duration,
          strongMagnitude: config.intensity,
          weakMagnitude: config.intensity * 0.5,
        });
      }
    }
  }

  private async playItemPreview(purchase: GamePurchase): Promise<void> {
    console.log(`Playing preview for ${purchase.itemName}...`);
    
    // Simulate item preview (3D model, animation, sound, etc.)
    // This would integrate with the game's preview system
  }

  private checkAchievementUnlock(result: PaymentResult): string | undefined {
    if (!this.config.gameIntegration.achievementIntegration) {
      return undefined;
    }

    // Simple achievement logic
    const amount = result.amount;
    if (amount >= 5000) { // $50+
      return 'Big Spender';
    } else if (amount >= 1000) { // $10+
      return 'First Purchase';
    }

    return undefined;
  }

  private calculateBonusCurrency(result: PaymentResult): number {
    // Award bonus in-game currency based on purchase amount
    return Math.floor(result.amount / 100); // 1 coin per dollar
  }

  private async loadSpendingTracker(): Promise<void> {
    // Load spending data from storage
    console.log('Loading spending tracker data...');
    
    // Reset counters if time periods have elapsed
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    
    if (now - this.spendingTracker.lastReset > dayMs) {
      this.spendingTracker.daily = 0;
    }
    
    if (now - this.spendingTracker.lastReset > dayMs * 7) {
      this.spendingTracker.weekly = 0;
    }
    
    if (now - this.spendingTracker.lastReset > dayMs * 30) {
      this.spendingTracker.monthly = 0;
    }
  }

  private async checkSpendingLimits(amount: number): Promise<void> {
    const limits = this.config.paymentSettings.spendingLimit;
    
    if (this.spendingTracker.daily + amount > limits.daily) {
      throw new UPPError(`Daily spending limit ($${limits.daily / 100}) would be exceeded`, 'GAMING_CONTROLLER_SPENDING_LIMIT_EXCEEDED');
    }
    
    if (this.spendingTracker.weekly + amount > limits.weekly) {
      throw new UPPError(`Weekly spending limit ($${limits.weekly / 100}) would be exceeded`, 'GAMING_CONTROLLER_SPENDING_LIMIT_EXCEEDED');
    }
    
    if (this.spendingTracker.monthly + amount > limits.monthly) {
      throw new UPPError(`Monthly spending limit ($${limits.monthly / 100}) would be exceeded`, 'GAMING_CONTROLLER_SPENDING_LIMIT_EXCEEDED');
    }
  }

  private async updateSpendingTracker(amount: number): Promise<void> {
    this.spendingTracker.daily += amount;
    this.spendingTracker.weekly += amount;
    this.spendingTracker.monthly += amount;
    this.spendingTracker.lastReset = Date.now();
    
    // Save to storage
    console.log('Spending tracker updated:', this.spendingTracker);
  }

  private hashFeatures(): string {
    const featuresString = JSON.stringify(this.config.features);
    return Buffer.from(featuresString).toString('base64').substring(0, 6);
  }
}