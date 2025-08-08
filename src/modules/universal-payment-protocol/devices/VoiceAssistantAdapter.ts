import { z } from 'zod';

import { UPPDevice, DeviceCapabilities, PaymentRequest, PaymentResult, VoiceResponse } from '../core/types.js';
import { UPPError } from '../../../utils/errors.js';

// Voice Assistant Platforms
export enum VoiceAssistantPlatform {
  AMAZON_ALEXA = 'amazon_alexa',
  GOOGLE_ASSISTANT = 'google_assistant',
  APPLE_SIRI = 'apple_siri',
  MICROSOFT_CORTANA = 'microsoft_cortana',
  SAMSUNG_BIXBY = 'samsung_bixby',
  CUSTOM = 'custom',
}

// Voice Command Types
export enum VoiceCommandType {
  PAYMENT_REQUEST = 'payment_request',
  PAYMENT_CONFIRM = 'payment_confirm',
  PAYMENT_CANCEL = 'payment_cancel',
  BALANCE_INQUIRY = 'balance_inquiry',
  TRANSACTION_HISTORY = 'transaction_history',
  VOICE_AUTHENTICATION = 'voice_authentication',
  HELP = 'help',
  STATUS = 'status',
}

// Voice Command Schema
const VoiceCommandSchema = z.object({
  commandType: z.nativeEnum(VoiceCommandType),
  transcript: z.string(),
  confidence: z.number().min(0).max(1),
  intent: z.string(),
  entities: z.array(z.object({
    type: z.string(),
    value: z.string(),
    confidence: z.number().min(0).max(1),
  })),
  sessionId: z.string(),
  userId: z.string().optional(),
  timestamp: z.number(),
});

export type VoiceCommand = z.infer<typeof VoiceCommandSchema>;

// Voice Authentication Data
const VoiceAuthDataSchema = z.object({
  voicePrint: z.string(), // Base64 encoded voice biometric data
  speakerModel: z.string(),
  enrollmentId: z.string(),
  confidence: z.number().min(0).max(1),
  duration: z.number(), // Audio duration in seconds
  sampleRate: z.number(),
});

export type VoiceAuthData = z.infer<typeof VoiceAuthDataSchema>;

// Speech Configuration
export interface SpeechConfig {
  language: string;
  accent: string;
  voiceId: string;
  speed: number; // 0.5 - 2.0
  pitch: number; // 0.5 - 2.0
  volume: number; // 0.0 - 1.0
  ssmlEnabled: boolean;
}

// Voice Assistant Configuration
export interface VoiceAssistantConfig {
  platform: VoiceAssistantPlatform;
  skillId?: string; // Alexa Skill ID, Google Action ID, etc.
  apiKey?: string;
  secretKey?: string;
  speechToText: {
    provider: 'native' | 'google' | 'amazon' | 'azure' | 'openai';
    language: string;
    model: string;
    profanityFilter: boolean;
    wordTimeOffsets: boolean;
    speakerDiarization: boolean;
  };
  textToSpeech: SpeechConfig;
  voiceAuthentication: {
    enabled: boolean;
    enrollmentRequired: boolean;
    confidenceThreshold: number;
    maxAttempts: number;
  };
  naturalLanguageUnderstanding: {
    provider: 'native' | 'dialogflow' | 'luis' | 'openai';
    model: string;
    supportedIntents: string[];
  };
  conversationFlow: {
    sessionTimeout: number; // seconds
    contextPersistence: boolean;
    multiTurnSupport: boolean;
  };
  paymentSettings: {
    requireVoiceAuth: boolean;
    maxPaymentAmount: number;
    confirmationRequired: boolean;
    allowedMerchants: string[];
  };
}

/**
 * Voice Assistant Adapter for speech-based payment processing
 * Supports Alexa, Google Assistant, Siri, and custom voice interfaces
 */
export class VoiceAssistantAdapter implements UPPDevice {
  private config: VoiceAssistantConfig;
  private isInitialized = false;
  private currentSession?: string;
  private speechRecognition?: any; // Web Speech API or platform-specific
  private speechSynthesis?: any;
  private enrolledVoicePrints = new Map<string, VoiceAuthData>();
  private conversationContext = new Map<string, any>();

  constructor(config: Partial<VoiceAssistantConfig> = {}) {
    this.config = {
      platform: VoiceAssistantPlatform.CUSTOM,
      speechToText: {
        provider: 'native',
        language: 'en-US',
        model: 'latest_short',
        profanityFilter: true,
        wordTimeOffsets: false,
        speakerDiarization: false,
      },
      textToSpeech: {
        language: 'en-US',
        accent: 'standard',
        voiceId: 'en-US-Standard-A',
        speed: 1.0,
        pitch: 1.0,
        volume: 0.8,
        ssmlEnabled: true,
      },
      voiceAuthentication: {
        enabled: true,
        enrollmentRequired: true,
        confidenceThreshold: 0.85,
        maxAttempts: 3,
      },
      naturalLanguageUnderstanding: {
        provider: 'native',
        model: 'standard',
        supportedIntents: [
          'payment.request',
          'payment.confirm',
          'payment.cancel',
          'balance.inquiry',
          'transaction.history',
        ],
      },
      conversationFlow: {
        sessionTimeout: 300, // 5 minutes
        contextPersistence: true,
        multiTurnSupport: true,
      },
      paymentSettings: {
        requireVoiceAuth: true,
        maxPaymentAmount: 10000, // $100.00
        confirmationRequired: true,
        allowedMerchants: [],
      },
      ...config,
    };
  }

  // UPPDevice interface implementation
  getDeviceId(): string {
    return `voice-${this.getDeviceFingerprint()}`;
  }

  getDeviceType(): string {
    return 'VOICE_ASSISTANT';
  }

  getCapabilities(): DeviceCapabilities {
    return {
      hasDisplay: false,
      hasCamera: false,
      hasNFC: false,
      hasBluetooth: false,
      hasWiFi: true,
      hasKeypad: false,
      hasTouchScreen: false,
      hasVoiceInput: true,
      hasVoiceOutput: true,
      hasPrinter: false,
      supportsEncryption: true,
      maxPaymentAmount: this.config.paymentSettings.maxPaymentAmount,
      supportedCurrencies: ['USD', 'EUR', 'GBP', 'CAD'],
      securityLevel: this.config.voiceAuthentication.enabled ? 'HIGH' : 'STANDARD',
    };
  }

  getDeviceFingerprint(): string {
    const platformId = this.config.platform;
    const langId = this.config.speechToText.language.replace('-', '');
    const configHash = this.hashConfig();
    
    return `${platformId}-${langId}-${configHash}`;
  }

  async handlePaymentResponse(response: PaymentResult): Promise<VoiceResponse> {
    const message = response.success 
      ? `Payment successful! Transaction ${response.transactionId} for ${response.currency} ${(response.amount / 100).toFixed(2)} has been completed.`
      : `Payment failed. ${response.error || 'Please try again or use a different payment method.'}`;

    return {
      success: response.success,
      message,
      audioResponse: await this.generateAudioResponse(message),
      shouldEndSession: response.success,
      metadata: {
        sessionId: this.currentSession,
        platform: this.config.platform,
        requiresFollowUp: !response.success,
      },
    };
  }

  async handleError(error: UPPError): Promise<void> {
    console.error(`Voice Assistant Error: ${error.message}`);
    
    const errorMessage = `I encountered an error: ${error.message}. Please try again or say "help" for assistance.`;
    
    // Speak error message
    await this.speakResponse(errorMessage);
    
    // Clear current session if critical error
    if (this.currentSession) {
      this.conversationContext.delete(this.currentSession);
      this.currentSession = undefined;
    }
  }

  // Voice Assistant specific methods

  /**
   * Initialize Voice Assistant platform integration
   */
  async initializeVoiceAssistant(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Initialize platform-specific SDK
      await this.initializePlatformSDK();
      
      // Setup speech recognition
      await this.setupSpeechRecognition();
      
      // Setup speech synthesis
      await this.setupSpeechSynthesis();
      
      // Initialize NLU service
      await this.initializeNLU();
      
      // Load enrolled voice prints
      await this.loadVoicePrints();

      this.isInitialized = true;
      console.log('Voice Assistant Adapter initialized successfully');
    } catch (error) {
      throw new UPPError(`Failed to initialize Voice Assistant: ${error}`);
    }
  }

  /**
   * Process voice command from user
   */
  async processVoiceCommand(audioBuffer: ArrayBuffer): Promise<PaymentRequest | VoiceResponse> {
    if (!this.isInitialized) {
      await this.initializeVoiceAssistant();
    }

    try {
      // Convert audio to text
      const transcript = await this.speechToText(audioBuffer);
      
      // Parse command and extract intent
      const command = await this.parseVoiceCommand(transcript);
      
      // Authenticate user if required
      if (this.config.voiceAuthentication.enabled) {
        const authResult = await this.authenticateVoice(audioBuffer);
        if (!authResult.authenticated) {
          return await this.handleAuthenticationFailure(authResult.reason);
        }
      }
      
      // Process command based on type
      return await this.handleVoiceCommand(command);
    } catch (error) {
      const errorResponse = `Sorry, I couldn't understand that. ${error.message || 'Please try again.'}`;
      return {
        success: false,
        message: errorResponse,
        audioResponse: await this.generateAudioResponse(errorResponse),
        shouldEndSession: false,
        metadata: { error: true },
      };
    }
  }

  /**
   * Enroll user's voice for biometric authentication
   */
  async enrollVoiceBiometric(userId: string, audioSamples: ArrayBuffer[]): Promise<void> {
    if (audioSamples.length < 3) {
      throw new UPPError('At least 3 audio samples required for voice enrollment');
    }

    try {
      // Process audio samples to create voice print
      const voicePrint = await this.createVoicePrint(audioSamples);
      
      // Store voice print
      const enrollmentId = `voice_${userId}_${Date.now()}`;
      const voiceAuthData: VoiceAuthData = {
        voicePrint: voicePrint.data,
        speakerModel: voicePrint.model,
        enrollmentId,
        confidence: voicePrint.confidence,
        duration: voicePrint.duration,
        sampleRate: voicePrint.sampleRate,
      };

      this.enrolledVoicePrints.set(userId, voiceAuthData);
      
      console.log(`Voice biometric enrolled for user: ${userId}`);
    } catch (error) {
      throw new UPPError(`Voice enrollment failed: ${error}`);
    }
  }

  /**
   * Authenticate user by voice biometric
   */
  async authenticateVoice(audioBuffer: ArrayBuffer): Promise<{ authenticated: boolean; userId?: string; confidence?: number; reason?: string }> {
    if (!this.config.voiceAuthentication.enabled) {
      return { authenticated: true };
    }

    try {
      // Extract voice features from audio
      const voiceFeatures = await this.extractVoiceFeatures(audioBuffer);
      
      // Compare against enrolled voice prints
      for (const [userId, enrolledData] of this.enrolledVoicePrints) {
        const similarity = await this.compareVoicePrints(voiceFeatures, enrolledData.voicePrint);
        
        if (similarity >= this.config.voiceAuthentication.confidenceThreshold) {
          return {
            authenticated: true,
            userId,
            confidence: similarity,
          };
        }
      }

      return {
        authenticated: false,
        reason: 'Voice not recognized or confidence too low',
      };
    } catch (error) {
      return {
        authenticated: false,
        reason: `Authentication error: ${error.message}`,
      };
    }
  }

  /**
   * Generate speech response
   */
  async speakResponse(text: string): Promise<ArrayBuffer> {
    try {
      // Convert text to speech using configured voice
      const audioResponse = await this.textToSpeech(text);
      
      // Play audio if supported
      if (typeof Audio !== 'undefined') {
        const audioBlob = new Blob([audioResponse], { type: 'audio/wav' });
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        
        audio.volume = this.config.textToSpeech.volume;
        await audio.play();
        
        // Clean up
        setTimeout(() => URL.revokeObjectURL(audioUrl), 1000);
      }

      return audioResponse;
    } catch (error) {
      console.error('Failed to generate speech response:', error);
      throw new UPPError(`Speech synthesis failed: ${error}`);
    }
  }

  /**
   * Handle multi-turn conversation
   */
  async handleConversation(sessionId: string, userInput: string): Promise<VoiceResponse> {
    try {
      // Get or create conversation context
      let context = this.conversationContext.get(sessionId);
      if (!context) {
        context = {
          sessionId,
          startTime: Date.now(),
          turns: [],
          currentIntent: null,
          pendingPayment: null,
        };
        this.conversationContext.set(sessionId, context);
      }

      // Add user turn to context
      context.turns.push({
        role: 'user',
        content: userInput,
        timestamp: Date.now(),
      });

      // Process input and generate response
      const response = await this.generateConversationalResponse(context, userInput);
      
      // Add assistant turn to context
      context.turns.push({
        role: 'assistant',
        content: response.message,
        timestamp: Date.now(),
      });

      // Clean up expired sessions
      this.cleanupExpiredSessions();

      return response;
    } catch (error) {
      throw new UPPError(`Conversation handling failed: ${error}`);
    }
  }

  // Private helper methods

  private async initializePlatformSDK(): Promise<void> {
    switch (this.config.platform) {
      case VoiceAssistantPlatform.AMAZON_ALEXA:
        await this.initializeAlexaSDK();
        break;
      
      case VoiceAssistantPlatform.GOOGLE_ASSISTANT:
        await this.initializeGoogleAssistantSDK();
        break;
      
      case VoiceAssistantPlatform.APPLE_SIRI:
        await this.initializeSiriSDK();
        break;
      
      case VoiceAssistantPlatform.MICROSOFT_CORTANA:
        await this.initializeCortanaSDK();
        break;
      
      default:
        console.log('Using custom voice assistant implementation');
    }
  }

  private async initializeAlexaSDK(): Promise<void> {
    console.log('Initializing Amazon Alexa SDK...');
    // Alexa Skills Kit SDK initialization
  }

  private async initializeGoogleAssistantSDK(): Promise<void> {
    console.log('Initializing Google Assistant SDK...');
    // Google Assistant SDK initialization
  }

  private async initializeSiriSDK(): Promise<void> {
    console.log('Initializing Apple Siri SDK...');
    // SiriKit / Shortcuts integration
  }

  private async initializeCortanaSDK(): Promise<void> {
    console.log('Initializing Microsoft Cortana SDK...');
    // Cortana Skills Kit initialization
  }

  private async setupSpeechRecognition(): Promise<void> {
    if (typeof webkitSpeechRecognition !== 'undefined') {
      this.speechRecognition = new webkitSpeechRecognition();
      this.speechRecognition.continuous = false;
      this.speechRecognition.interimResults = false;
      this.speechRecognition.lang = this.config.speechToText.language;
    } else {
      console.log('Web Speech API not available, using platform-specific STT');
    }
  }

  private async setupSpeechSynthesis(): Promise<void> {
    if (typeof speechSynthesis !== 'undefined') {
      this.speechSynthesis = speechSynthesis;
    } else {
      console.log('Web Speech Synthesis not available, using platform-specific TTS');
    }
  }

  private async initializeNLU(): Promise<void> {
    console.log(`Initializing NLU service: ${this.config.naturalLanguageUnderstanding.provider}`);
    // Initialize natural language understanding service
  }

  private async loadVoicePrints(): Promise<void> {
    // Load enrolled voice prints from storage
    console.log('Loading enrolled voice biometric data...');
    // In real implementation, this would load from secure storage
  }

  private async speechToText(audioBuffer: ArrayBuffer): Promise<string> {
    // Convert audio to text using configured STT service
    switch (this.config.speechToText.provider) {
      case 'native':
        return await this.nativeSpeechToText(audioBuffer);
      case 'google':
        return await this.googleSpeechToText(audioBuffer);
      case 'amazon':
        return await this.amazonSpeechToText(audioBuffer);
      default:
        throw new UPPError(`Unsupported STT provider: ${this.config.speechToText.provider}`);
    }
  }

  private async nativeSpeechToText(audioBuffer: ArrayBuffer): Promise<string> {
    // Simulate native speech recognition
    // In real implementation, this would use Web Speech API or platform-specific APIs
    
    const transcripts = [
      'pay twenty five dollars to coffee shop',
      'send fifteen dollars to john',
      'what is my balance',
      'cancel payment',
      'confirm payment',
    ];
    
    return transcripts[Math.floor(Math.random() * transcripts.length)];
  }

  private async googleSpeechToText(audioBuffer: ArrayBuffer): Promise<string> {
    // Google Cloud Speech-to-Text implementation
    console.log('Processing audio with Google Speech-to-Text...');
    return 'pay twenty dollars to merchant';
  }

  private async amazonSpeechToText(audioBuffer: ArrayBuffer): Promise<string> {
    // Amazon Transcribe implementation
    console.log('Processing audio with Amazon Transcribe...');
    return 'pay twenty dollars to merchant';
  }

  private async parseVoiceCommand(transcript: string): Promise<VoiceCommand> {
    // Parse transcript into structured command
    const command = await this.extractIntentAndEntities(transcript);
    
    return {
      commandType: command.type,
      transcript,
      confidence: command.confidence,
      intent: command.intent,
      entities: command.entities,
      sessionId: this.currentSession || this.generateSessionId(),
      timestamp: Date.now(),
    };
  }

  private async extractIntentAndEntities(text: string): Promise<any> {
    // Simple NLU implementation - in production, use DialogFlow, LUIS, etc.
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('pay') || lowerText.includes('send')) {
      const amountMatch = text.match(/(\d+(?:\.\d{2})?)\s*dollars?/i);
      const merchantMatch = text.match(/to\s+([a-zA-Z\s]+)/i);
      
      return {
        type: VoiceCommandType.PAYMENT_REQUEST,
        intent: 'payment.request',
        confidence: 0.9,
        entities: [
          ...(amountMatch ? [{
            type: 'amount',
            value: amountMatch[1],
            confidence: 0.95,
          }] : []),
          ...(merchantMatch ? [{
            type: 'merchant',
            value: merchantMatch[1].trim(),
            confidence: 0.85,
          }] : []),
        ],
      };
    }

    if (lowerText.includes('confirm') || lowerText.includes('yes')) {
      return {
        type: VoiceCommandType.PAYMENT_CONFIRM,
        intent: 'payment.confirm',
        confidence: 0.95,
        entities: [],
      };
    }

    if (lowerText.includes('cancel') || lowerText.includes('no')) {
      return {
        type: VoiceCommandType.PAYMENT_CANCEL,
        intent: 'payment.cancel',
        confidence: 0.95,
        entities: [],
      };
    }

    if (lowerText.includes('balance')) {
      return {
        type: VoiceCommandType.BALANCE_INQUIRY,
        intent: 'balance.inquiry',
        confidence: 0.9,
        entities: [],
      };
    }

    // Default to help
    return {
      type: VoiceCommandType.HELP,
      intent: 'help',
      confidence: 0.7,
      entities: [],
    };
  }

  private async handleVoiceCommand(command: VoiceCommand): Promise<PaymentRequest | VoiceResponse> {
    switch (command.commandType) {
      case VoiceCommandType.PAYMENT_REQUEST:
        return await this.handlePaymentRequest(command);
      
      case VoiceCommandType.PAYMENT_CONFIRM:
        return await this.handlePaymentConfirmation(command);
      
      case VoiceCommandType.PAYMENT_CANCEL:
        return await this.handlePaymentCancellation(command);
      
      case VoiceCommandType.BALANCE_INQUIRY:
        return await this.handleBalanceInquiry(command);
      
      case VoiceCommandType.HELP:
        return await this.handleHelpRequest(command);
      
      default:
        return await this.handleUnknownCommand(command);
    }
  }

  private async handlePaymentRequest(command: VoiceCommand): Promise<PaymentRequest> {
    // Extract payment details from command
    const amountEntity = command.entities.find(e => e.type === 'amount');
    const merchantEntity = command.entities.find(e => e.type === 'merchant');
    
    if (!amountEntity) {
      throw new UPPError('Payment amount not specified');
    }

    const amount = Math.round(parseFloat(amountEntity.value) * 100); // Convert to cents
    
    if (amount > this.config.paymentSettings.maxPaymentAmount) {
      throw new UPPError(`Amount exceeds maximum limit of $${this.config.paymentSettings.maxPaymentAmount / 100}`);
    }

    const paymentRequest: PaymentRequest = {
      amount,
      currency: 'USD',
      merchantId: merchantEntity?.value || 'voice-merchant',
      description: `Voice payment: ${command.transcript}`,
      metadata: {
        sessionId: command.sessionId,
        voiceCommand: true,
        platform: this.config.platform,
        confidence: command.confidence,
      },
    };

    // Store pending payment for confirmation if required
    if (this.config.paymentSettings.confirmationRequired) {
      this.storePendingPayment(command.sessionId, paymentRequest);
      
      const confirmationMessage = `You want to pay $${(amount / 100).toFixed(2)} to ${merchantEntity?.value || 'the merchant'}. Say "confirm" to proceed or "cancel" to abort.`;
      
      throw new UPPError(confirmationMessage); // This will be caught and converted to voice response
    }

    return paymentRequest;
  }

  private async handlePaymentConfirmation(command: VoiceCommand): Promise<PaymentRequest> {
    const pendingPayment = this.getPendingPayment(command.sessionId);
    if (!pendingPayment) {
      throw new UPPError('No pending payment to confirm');
    }

    this.clearPendingPayment(command.sessionId);
    return pendingPayment;
  }

  private async handlePaymentCancellation(command: VoiceCommand): Promise<VoiceResponse> {
    this.clearPendingPayment(command.sessionId);
    
    const message = 'Payment cancelled. Is there anything else I can help you with?';
    return {
      success: true,
      message,
      audioResponse: await this.generateAudioResponse(message),
      shouldEndSession: false,
      metadata: { cancelled: true },
    };
  }

  private async handleBalanceInquiry(command: VoiceCommand): Promise<VoiceResponse> {
    // Simulate balance inquiry - in real implementation, query payment system
    const balance = '$125.50'; // Mock balance
    
    const message = `Your current balance is ${balance}.`;
    return {
      success: true,
      message,
      audioResponse: await this.generateAudioResponse(message),
      shouldEndSession: false,
      metadata: { balance },
    };
  }

  private async handleHelpRequest(command: VoiceCommand): Promise<VoiceResponse> {
    const message = `I can help you with payments and account management. You can say things like "pay twenty dollars to coffee shop", "what's my balance", or "confirm payment". What would you like to do?`;
    
    return {
      success: true,
      message,
      audioResponse: await this.generateAudioResponse(message),
      shouldEndSession: false,
      metadata: { help: true },
    };
  }

  private async handleUnknownCommand(command: VoiceCommand): Promise<VoiceResponse> {
    const message = `I didn't understand "${command.transcript}". Try saying something like "pay twenty dollars to coffee shop" or say "help" for more options.`;
    
    return {
      success: false,
      message,
      audioResponse: await this.generateAudioResponse(message),
      shouldEndSession: false,
      metadata: { unknown: true },
    };
  }

  private async textToSpeech(text: string): Promise<ArrayBuffer> {
    // Convert text to speech using configured TTS service
    console.log(`TTS: ${text}`);
    
    // Simulate audio generation - in real implementation, use TTS service
    const sampleRate = 22050;
    const duration = Math.max(2, text.length * 0.05); // Rough estimate
    const samples = Math.floor(sampleRate * duration);
    const audioBuffer = new ArrayBuffer(samples * 2);
    
    return audioBuffer;
  }

  private async generateAudioResponse(text: string): Promise<ArrayBuffer> {
    return await this.textToSpeech(text);
  }

  private async createVoicePrint(audioSamples: ArrayBuffer[]): Promise<any> {
    // Create voice biometric print from audio samples
    console.log(`Creating voice print from ${audioSamples.length} samples`);
    
    // Simulate voice print creation
    return {
      data: Buffer.from('mock_voice_print_data').toString('base64'),
      model: 'voice_model_v1',
      confidence: 0.95,
      duration: audioSamples.length * 3, // Approximate duration
      sampleRate: 16000,
    };
  }

  private async extractVoiceFeatures(audioBuffer: ArrayBuffer): Promise<string> {
    // Extract voice biometric features from audio
    console.log('Extracting voice features...');
    
    // Simulate feature extraction
    return Buffer.from('mock_voice_features').toString('base64');
  }

  private async compareVoicePrints(features: string, enrolledPrint: string): Promise<number> {
    // Compare voice features against enrolled print
    // Return similarity score between 0 and 1
    
    // Simulate voice comparison - in real implementation, use ML model
    return Math.random() * 0.4 + 0.6; // 0.6 - 1.0 range
  }

  private async handleAuthenticationFailure(reason: string): Promise<VoiceResponse> {
    const message = `Voice authentication failed: ${reason}. Please try again or contact support.`;
    
    return {
      success: false,
      message,
      audioResponse: await this.generateAudioResponse(message),
      shouldEndSession: true,
      metadata: { authFailed: true, reason },
    };
  }

  private async generateConversationalResponse(context: any, userInput: string): Promise<VoiceResponse> {
    // Generate contextual response based on conversation history
    const message = `I understand you said "${userInput}". How can I help you with payments today?`;
    
    return {
      success: true,
      message,
      audioResponse: await this.generateAudioResponse(message),
      shouldEndSession: false,
      metadata: { conversational: true },
    };
  }

  private storePendingPayment(sessionId: string, payment: PaymentRequest): void {
    const context = this.conversationContext.get(sessionId) || {};
    context.pendingPayment = payment;
    this.conversationContext.set(sessionId, context);
  }

  private getPendingPayment(sessionId: string): PaymentRequest | null {
    const context = this.conversationContext.get(sessionId);
    return context?.pendingPayment || null;
  }

  private clearPendingPayment(sessionId: string): void {
    const context = this.conversationContext.get(sessionId);
    if (context) {
      context.pendingPayment = null;
    }
  }

  private cleanupExpiredSessions(): void {
    const now = Date.now();
    const timeout = this.config.conversationFlow.sessionTimeout * 1000;
    
    for (const [sessionId, context] of this.conversationContext) {
      if (now - context.startTime > timeout) {
        this.conversationContext.delete(sessionId);
      }
    }
  }

  private generateSessionId(): string {
    return `voice_session_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  private hashConfig(): string {
    const configString = JSON.stringify({
      platform: this.config.platform,
      language: this.config.speechToText.language,
      voiceAuth: this.config.voiceAuthentication.enabled,
    });
    return Buffer.from(configString).toString('base64').substring(0, 8);
  }
}