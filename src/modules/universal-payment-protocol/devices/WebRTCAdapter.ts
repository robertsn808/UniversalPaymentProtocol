import { z } from 'zod';

import { UPPDevice, DeviceCapabilities, PaymentRequest, PaymentResult, MobileResponse } from '../core/types.js';
import { UPPError } from '../../../utils/errors.js';

// WebRTC Configuration Schema
const WebRTCConfigSchema = z.object({
  iceServers: z.array(z.object({
    urls: z.union([z.string(), z.array(z.string())]),
    username: z.string().optional(),
    credential: z.string().optional(),
  })),
  iceTransportPolicy: z.enum(['all', 'relay']).default('all'),
  bundlePolicy: z.enum(['balanced', 'max-compat', 'max-bundle']).default('balanced'),
  rtcpMuxPolicy: z.enum(['negotiate', 'require']).default('require'),
});

export type WebRTCConfig = z.infer<typeof WebRTCConfigSchema>;

// Signaling Message Types
export enum SignalingMessageType {
  OFFER = 'offer',
  ANSWER = 'answer',
  ICE_CANDIDATE = 'ice-candidate',
  PAYMENT_REQUEST = 'payment-request',
  PAYMENT_RESPONSE = 'payment-response',
  DEVICE_INFO = 'device-info',
  CONNECTION_STATE = 'connection-state',
  ERROR = 'error',
}

// Signaling Message Schema
const SignalingMessageSchema = z.object({
  type: z.nativeEnum(SignalingMessageType),
  data: z.any(),
  sessionId: z.string(),
  timestamp: z.number(),
  source: z.string(), // Device ID
  target: z.string().optional(), // Target device ID (for direct messages)
});

export type SignalingMessage = z.infer<typeof SignalingMessageSchema>;

// WebRTC Data Channel Message
const DataChannelMessageSchema = z.object({
  type: z.enum(['payment', 'status', 'control', 'media']),
  payload: z.any(),
  messageId: z.string(),
  timestamp: z.number(),
  priority: z.enum(['low', 'normal', 'high']).default('normal'),
});

export type DataChannelMessage = z.infer<typeof DataChannelMessageSchema>;

// Peer Connection State
export interface PeerConnectionState {
  id: string;
  connectionState: RTCPeerConnectionState;
  iceConnectionState: RTCIceConnectionState;
  signalingState: RTCSignalingState;
  dataChannels: Map<string, RTCDataChannel>;
  mediaStreams: Map<string, MediaStream>;
  lastActivity: Date;
  deviceInfo?: any;
}

export interface WebRTCAdapterConfig {
  signalingServerUrl: string;
  signalingServerType: 'websocket' | 'socket.io' | 'custom';
  enableDataChannel: boolean;
  enableAudioStream: boolean;
  enableVideoStream: boolean;
  enableScreenShare: boolean;
  maxPeers: number;
  connectionTimeout: number;
  keepAliveInterval: number;
  dataChannelConfig: {
    ordered: boolean;
    maxRetransmits?: number;
    maxPacketLifeTime?: number;
  };
  mediaConstraints: {
    audio: boolean | MediaTrackConstraints;
    video: boolean | MediaTrackConstraints;
  };
  stunServers: string[];
  turnServers: Array<{
    urls: string;
    username: string;
    credential: string;
  }>;
}

/**
 * WebRTC Adapter for real-time peer-to-peer payment communication
 * Supports direct device connections, video payments, and screen sharing
 */
export class WebRTCAdapter implements UPPDevice {
  private config: WebRTCAdapterConfig;
  private rtcConfiguration: RTCConfiguration;
  private peerConnections = new Map<string, PeerConnectionState>();
  private signalingConnection?: WebSocket;
  private localStream?: MediaStream;
  private isInitialized = false;
  private sessionId: string;

  constructor(config: Partial<WebRTCAdapterConfig> = {}) {
    this.config = {
      signalingServerUrl: 'wss://signaling.upp-protocol.com',
      signalingServerType: 'websocket',
      enableDataChannel: true,
      enableAudioStream: true,
      enableVideoStream: true,
      enableScreenShare: true,
      maxPeers: 10,
      connectionTimeout: 30000,
      keepAliveInterval: 30000,
      dataChannelConfig: {
        ordered: true,
        maxRetransmits: 3,
      },
      mediaConstraints: {
        audio: true,
        video: { width: 640, height: 480, frameRate: 30 },
      },
      stunServers: [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302',
      ],
      turnServers: [],
      ...config,
    };

    // Configure RTCConfiguration
    this.rtcConfiguration = {
      iceServers: [
        ...this.config.stunServers.map(url => ({ urls: url })),
        ...this.config.turnServers.map(server => ({
          urls: server.urls,
          username: server.username,
          credential: server.credential,
        })),
      ],
      iceTransportPolicy: 'all',
      bundlePolicy: 'balanced',
      rtcpMuxPolicy: 'require',
    };

    this.sessionId = this.generateSessionId();
  }

  // UPPDevice interface implementation
  getDeviceId(): string {
    return `webrtc-${this.getDeviceFingerprint()}`;
  }

  getDeviceType(): string {
    return 'WEBRTC_PEER_DEVICE';
  }

  getCapabilities(): DeviceCapabilities {
    return {
      hasDisplay: true,
      hasCamera: this.config.enableVideoStream,
      hasNFC: false,
      hasBluetooth: false,
      hasWiFi: true,
      hasKeypad: false,
      hasTouchScreen: false,
      hasVoiceInput: this.config.enableAudioStream,
      hasVoiceOutput: this.config.enableAudioStream,
      hasPrinter: false,
      supportsEncryption: true,
      internet_connection: true,
      maxPaymentAmount: 10000, // Default max amount in cents
      supportedCurrencies: ['USD', 'EUR', 'GBP'],
      securityLevel: 'HIGH',
    };
  }

  getFingerprint(): string {
    return this.getDeviceFingerprint();
  }

  getSecurityContext(): any {
    return {
      encryption: true,
      encryptionLevel: 'TLS',
      peerToPeer: true,
      maxPeers: this.config.maxPeers,
      videoEnabled: this.config.enableVideoStream,
      audioEnabled: this.config.enableAudioStream,
      securityLevel: 'HIGH'
    };
  }

  getDeviceFingerprint(): string {
    const configHash = this.hashConfig();
    return `webrtc-${configHash}-${this.sessionId.slice(-8)}`;
  }

  async handlePaymentResponse(response: PaymentResult): Promise<MobileResponse> {
    const connectedPeers = this.peerConnections.size;
    
    // Broadcast payment result to all connected peers
    await this.broadcastToAllPeers({
      type: 'payment',
      payload: response,
      messageId: this.generateMessageId(),
      timestamp: Date.now(),
      priority: 'high',
    });

    return {
      success: response.success,
      message: response.success 
        ? `Payment completed via WebRTC (${connectedPeers} peers notified)` 
        : 'WebRTC payment failed',
      displayDuration: 5000,
      requiresUserAction: !response.success,
      metadata: {
        sessionId: this.sessionId,
        connectedPeers,
        webrtcEnabled: true,
      },
    };
  }

  async handleError(error: UPPError): Promise<void> {
    console.error(`WebRTC Adapter Error: ${error.message}`);
    
    // Broadcast error to all peers
    await this.broadcastToAllPeers({
      type: 'status',
      payload: { error: error.message, timestamp: Date.now() },
      messageId: this.generateMessageId(),
      timestamp: Date.now(),
      priority: 'high',
    });

    // Clean up failed connections
    await this.cleanupFailedConnections();
  }

  // WebRTC-specific methods

  /**
   * Initialize WebRTC adapter and signaling connection
   */
  async initializeWebRTC(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Setup signaling connection
      await this.connectToSignalingServer();
      
      // Initialize local media streams if enabled
      if (this.config.enableAudioStream || this.config.enableVideoStream) {
        await this.setupLocalMediaStream();
      }
      
      // Start keep-alive mechanism
      this.startKeepAlive();

      this.isInitialized = true;
      console.log('WebRTC Adapter initialized successfully');
    } catch (error) {
      throw new UPPError(`Failed to initialize WebRTC: ${error}`, "WEBRTC_ERROR", 500);
    }
  }

  /**
   * Create peer connection to another device
   */
  async createPeerConnection(peerId: string): Promise<void> {
    if (this.peerConnections.has(peerId)) {
      console.log(`Peer connection to ${peerId} already exists`);
      return;
    }

    if (this.peerConnections.size >= this.config.maxPeers) {
      throw new UPPError(`Maximum peer connections (${this.config.maxPeers}) reached`);
    }

    try {
      const peerConnection = new RTCPeerConnection(this.rtcConfiguration);
      
      // Setup event handlers
      this.setupPeerConnectionHandlers(peerConnection, peerId);
      
      // Add local streams if available
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => {
          peerConnection.addTrack(track, this.localStream!);
        });
      }

      // Create data channel if enabled
      let dataChannels = new Map<string, RTCDataChannel>();
      if (this.config.enableDataChannel) {
        const dataChannel = peerConnection.createDataChannel('payments', this.config.dataChannelConfig);
        this.setupDataChannelHandlers(dataChannel, peerId);
        dataChannels.set('payments', dataChannel);
      }

      // Store peer connection state
      const peerState: PeerConnectionState = {
        id: peerId,
        connectionState: peerConnection.connectionState,
        iceConnectionState: peerConnection.iceConnectionState,
        signalingState: peerConnection.signalingState,
        dataChannels,
        mediaStreams: new Map(),
        lastActivity: new Date(),
      };

      this.peerConnections.set(peerId, peerState);

      // Create and send offer
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      
      await this.sendSignalingMessage({
        type: SignalingMessageType.OFFER,
        data: offer,
        sessionId: this.sessionId,
        timestamp: Date.now(),
        source: this.getDeviceId(),
        target: peerId,
      });

      console.log(`Created peer connection to ${peerId}`);
    } catch (error) {
      throw new UPPError(`Failed to create peer connection to ${peerId}: ${error}`, "WEBRTC_ERROR", 500);
    }
  }

  /**
   * Send payment request via WebRTC data channel
   */
  async sendPaymentRequestP2P(peerId: string, request: PaymentRequest): Promise<PaymentResult> {
    const peerState = this.peerConnections.get(peerId);
    if (!peerState) {
      throw new UPPError(`No peer connection to ${peerId}`, "WEBRTC_ERROR", 500);
    }

    const paymentChannel = peerState.dataChannels.get('payments');
    if (!paymentChannel || paymentChannel.readyState !== 'open') {
      throw new UPPError(`Payment data channel to ${peerId} not available`, "WEBRTC_ERROR", 500);
    }

    try {
      const paymentMessage: DataChannelMessage = {
        type: 'payment',
        payload: {
          ...request,
          transactionId: `webrtc_${Date.now()}_${Math.random().toString(36).substring(2)}`,
        },
        messageId: this.generateMessageId(),
        timestamp: Date.now(),
        priority: 'high',
      };

      // Send payment request
      paymentChannel.send(JSON.stringify(paymentMessage));
      
      // Wait for payment response
      const response = await this.waitForPaymentResponse(peerId, paymentMessage.payload.transactionId);
      
      return response;
    } catch (error) {
      return {
        success: false,
        transactionId: '',
        amount: request.amount,
        currency: request.currency,
        error: error instanceof UPPError ? error.message : 'WebRTC payment failed',
        metadata: {
          peerId,
          webrtcError: true,
        },
      };
    }
  }

  /**
   * Start screen sharing for payment verification
   */
  async startScreenShare(): Promise<MediaStream> {
    if (!this.config.enableScreenShare) {
      throw new UPPError('Screen sharing is disabled', "WEBRTC_ERROR", 500);
    }

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { mediaSource: 'screen' },
        audio: true,
      });

      // Add screen share tracks to all peer connections
      for (const [peerId, peerState] of this.peerConnections) {
        const peerConnection = this.getPeerConnection(peerId);
        
        screenStream.getTracks().forEach(track => {
          peerConnection.addTrack(track, screenStream);
        });
        
        // Store screen stream
        peerState.mediaStreams.set('screen', screenStream);
      }

      console.log('Screen sharing started');
      return screenStream;
    } catch (error) {
      throw new UPPError(`Failed to start screen sharing: ${error}`, "WEBRTC_ERROR", 500);
    }
  }

  /**
   * Stop screen sharing
   */
  async stopScreenShare(): Promise<void> {
    for (const [peerId, peerState] of this.peerConnections) {
      const screenStream = peerState.mediaStreams.get('screen');
      if (screenStream) {
        // Stop all tracks
        screenStream.getTracks().forEach(track => track.stop());
        
        // Remove tracks from peer connection
        const peerConnection = this.getPeerConnection(peerId);
        const senders = peerConnection.getSenders();
        
        for (const sender of senders) {
          if (sender.track && screenStream.getTracks().includes(sender.track)) {
            peerConnection.removeTrack(sender);
          }
        }
        
        peerState.mediaStreams.delete('screen');
      }
    }

    console.log('Screen sharing stopped');
  }

  /**
   * Get connected peers list
   */
  getConnectedPeers(): string[] {
    return Array.from(this.peerConnections.keys()).filter(peerId => {
      const peerState = this.peerConnections.get(peerId);
      return peerState?.connectionState === 'connected';
    });
  }

  /**
   * Disconnect from specific peer
   */
  async disconnectPeer(peerId: string): Promise<void> {
    const peerState = this.peerConnections.get(peerId);
    if (!peerState) {
      console.log(`Peer ${peerId} not connected`);
      return;
    }

    try {
      // Close data channels
      for (const dataChannel of peerState.dataChannels.values()) {
        dataChannel.close();
      }

      // Stop media streams
      for (const stream of peerState.mediaStreams.values()) {
        stream.getTracks().forEach(track => track.stop());
      }

      // Close peer connection
      const peerConnection = this.getPeerConnection(peerId);
      peerConnection.close();

      // Remove from connections map
      this.peerConnections.delete(peerId);

      console.log(`Disconnected from peer: ${peerId}`);
    } catch (error) {
      console.error(`Error disconnecting from peer ${peerId}:`, error);
      this.peerConnections.delete(peerId);
    }
  }

  // Private helper methods

  private async connectToSignalingServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.signalingConnection = new WebSocket(this.config.signalingServerUrl);
      
      this.signalingConnection.onopen = () => {
        console.log('Connected to signaling server');
        this.setupSignalingHandlers();
        resolve();
      };
      
      this.signalingConnection.onerror = (error) => {
        reject(new UPPError(`Signaling server connection failed: ${error}`, "WEBRTC_ERROR", 500));
      };
      
      this.signalingConnection.onclose = () => {
        console.log('Signaling server connection closed');
        // Attempt reconnection
        setTimeout(() => this.connectToSignalingServer(), 5000);
      };
    });
  }

  private setupSignalingHandlers(): void {
    if (!this.signalingConnection) return;

    this.signalingConnection.onmessage = async (event) => {
      try {
        const message: SignalingMessage = JSON.parse(event.data);
        await this.handleSignalingMessage(message);
      } catch (error) {
        console.error('Error handling signaling message:', error);
      }
    };
  }

  private async handleSignalingMessage(message: SignalingMessage): Promise<void> {
    const { type, data, source, target } = message;

    // Check if message is for this device
    if (target && target !== this.getDeviceId()) {
      return;
    }

    switch (type) {
      case SignalingMessageType.OFFER:
        await this.handleOffer(data, source);
        break;
      
      case SignalingMessageType.ANSWER:
        await this.handleAnswer(data, source);
        break;
      
      case SignalingMessageType.ICE_CANDIDATE:
        await this.handleIceCandidate(data, source);
        break;
      
      case SignalingMessageType.DEVICE_INFO:
        await this.handleDeviceInfo(data, source);
        break;
      
      default:
        console.log(`Unhandled signaling message type: ${type}`);
    }
  }

  private async handleOffer(offer: RTCSessionDescriptionInit, peerId: string): Promise<void> {
    if (!this.peerConnections.has(peerId)) {
      // Create peer connection for incoming offer
      const peerConnection = new RTCPeerConnection(this.rtcConfiguration);
      this.setupPeerConnectionHandlers(peerConnection, peerId);
      
      const peerState: PeerConnectionState = {
        id: peerId,
        connectionState: peerConnection.connectionState,
        iceConnectionState: peerConnection.iceConnectionState,
        signalingState: peerConnection.signalingState,
        dataChannels: new Map(),
        mediaStreams: new Map(),
        lastActivity: new Date(),
      };
      
      this.peerConnections.set(peerId, peerState);
    }

    const peerConnection = this.getPeerConnection(peerId);
    
    await peerConnection.setRemoteDescription(offer);
    
    // Add local streams
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, this.localStream!);
      });
    }
    
    // Create answer
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    
    // Send answer
    await this.sendSignalingMessage({
      type: SignalingMessageType.ANSWER,
      data: answer,
      sessionId: this.sessionId,
      timestamp: Date.now(),
      source: this.getDeviceId(),
      target: peerId,
    });
  }

  private async handleAnswer(answer: RTCSessionDescriptionInit, peerId: string): Promise<void> {
    const peerConnection = this.getPeerConnection(peerId);
    await peerConnection.setRemoteDescription(answer);
  }

  private async handleIceCandidate(candidate: RTCIceCandidateInit, peerId: string): Promise<void> {
    const peerConnection = this.getPeerConnection(peerId);
    await peerConnection.addIceCandidate(candidate);
  }

  private async handleDeviceInfo(deviceInfo: any, peerId: string): Promise<void> {
    const peerState = this.peerConnections.get(peerId);
    if (peerState) {
      peerState.deviceInfo = deviceInfo;
    }
  }

  private setupPeerConnectionHandlers(peerConnection: RTCPeerConnection, peerId: string): void {
    peerConnection.onicecandidate = async (event) => {
      if (event.candidate) {
        await this.sendSignalingMessage({
          type: SignalingMessageType.ICE_CANDIDATE,
          data: event.candidate,
          sessionId: this.sessionId,
          timestamp: Date.now(),
          source: this.getDeviceId(),
          target: peerId,
        });
      }
    };

    peerConnection.onconnectionstatechange = () => {
      const peerState = this.peerConnections.get(peerId);
      if (peerState) {
        peerState.connectionState = peerConnection.connectionState;
        peerState.lastActivity = new Date();
      }
      
      console.log(`Peer ${peerId} connection state: ${peerConnection.connectionState}`);
      
      if (peerConnection.connectionState === 'failed' || peerConnection.connectionState === 'closed') {
        this.disconnectPeer(peerId);
      }
    };

    peerConnection.ondatachannel = (event) => {
      const dataChannel = event.channel;
      this.setupDataChannelHandlers(dataChannel, peerId);
      
      const peerState = this.peerConnections.get(peerId);
      if (peerState) {
        peerState.dataChannels.set(dataChannel.label, dataChannel);
      }
    };

    peerConnection.ontrack = (event) => {
      const [remoteStream] = event.streams;
      const peerState = this.peerConnections.get(peerId);
      if (peerState) {
        peerState.mediaStreams.set('remote', remoteStream);
      }
      
      console.log(`Received remote stream from peer ${peerId}`);
    };
  }

  private setupDataChannelHandlers(dataChannel: RTCDataChannel, peerId: string): void {
    dataChannel.onopen = () => {
      console.log(`Data channel '${dataChannel.label}' opened with peer ${peerId}`);
    };

    dataChannel.onmessage = (event) => {
      try {
        const message: DataChannelMessage = JSON.parse(event.data);
        this.handleDataChannelMessage(message, peerId);
      } catch (error) {
        console.error(`Error parsing data channel message from ${peerId}:`, error);
      }
    };

    dataChannel.onerror = (error) => {
      console.error(`Data channel error with peer ${peerId}:`, error);
    };

    dataChannel.onclose = () => {
      console.log(`Data channel '${dataChannel.label}' closed with peer ${peerId}`);
    };
  }

  private async handleDataChannelMessage(message: DataChannelMessage, peerId: string): Promise<void> {
    const { type, payload, messageId } = message;
    
    switch (type) {
      case 'payment':
        await this.handlePaymentMessage(payload, peerId, messageId);
        break;
      
      case 'status':
        console.log(`Status update from ${peerId}:`, payload);
        break;
      
      case 'control':
        await this.handleControlMessage(payload, peerId);
        break;
      
      default:
        console.log(`Unhandled data channel message type: ${type} from ${peerId}`);
    }
  }

  private async handlePaymentMessage(payload: any, peerId: string, messageId: string): Promise<void> {
    // Process payment message and send response
    try {
      // Simulate payment processing
      const paymentResult: PaymentResult = {
        success: true,
        transactionId: payload.transactionId,
        amount: payload.amount,
        currency: payload.currency,
        timestamp: new Date(),
        metadata: {
          peerId,
          webrtcPayment: true,
          messageId,
        },
      };

      // Send payment response back
      await this.sendDataChannelMessage(peerId, 'payments', {
        type: 'payment',
        payload: paymentResult,
        messageId: this.generateMessageId(),
        timestamp: Date.now(),
        priority: 'high',
      });
    } catch (error) {
      console.error(`Error processing payment message from ${peerId}:`, error);
    }
  }

  private async handleControlMessage(payload: any, peerId: string): Promise<void> {
    // Handle control messages (screen share, media control, etc.)
    console.log(`Control message from ${peerId}:`, payload);
  }

  private async sendSignalingMessage(message: SignalingMessage): Promise<void> {
    if (!this.signalingConnection || this.signalingConnection.readyState !== WebSocket.OPEN) {
      throw new UPPError('Signaling connection not available', "WEBRTC_ERROR", 500);
    }

    this.signalingConnection.send(JSON.stringify(message));
  }

  private async sendDataChannelMessage(peerId: string, channelName: string, message: DataChannelMessage): Promise<void> {
    const peerState = this.peerConnections.get(peerId);
    if (!peerState) {
      throw new UPPError(`Peer ${peerId} not connected`, "WEBRTC_ERROR", 500);
    }

    const dataChannel = peerState.dataChannels.get(channelName);
    if (!dataChannel || dataChannel.readyState !== 'open') {
      throw new UPPError(`Data channel '${channelName}' to ${peerId} not available`, "WEBRTC_ERROR", 500);
    }

    dataChannel.send(JSON.stringify(message));
  }

  private async broadcastToAllPeers(message: DataChannelMessage): Promise<void> {
    const promises = Array.from(this.peerConnections.keys()).map(async (peerId) => {
      try {
        await this.sendDataChannelMessage(peerId, 'payments', message);
      } catch (error) {
        console.error(`Failed to broadcast to peer ${peerId}:`, error);
      }
    });

    await Promise.all(promises);
  }

  private async setupLocalMediaStream(): Promise<void> {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(this.config.mediaConstraints);
      console.log('Local media stream initialized');
    } catch (error) {
      console.warn('Failed to initialize local media stream:', error);
    }
  }

  private startKeepAlive(): void {
    setInterval(() => {
      // Send keep-alive to all connected peers
      const keepAliveMessage: DataChannelMessage = {
        type: 'status',
        payload: { keepAlive: true, timestamp: Date.now() },
        messageId: this.generateMessageId(),
        timestamp: Date.now(),
        priority: 'low',
      };

      this.broadcastToAllPeers(keepAliveMessage);
    }, this.config.keepAliveInterval);
  }

  private async cleanupFailedConnections(): Promise<void> {
    const failedPeers: string[] = [];
    
    for (const [peerId, peerState] of this.peerConnections) {
      const timeSinceActivity = Date.now() - peerState.lastActivity.getTime();
      
      if (timeSinceActivity > this.config.connectionTimeout || 
          peerState.connectionState === 'failed' || 
          peerState.connectionState === 'disconnected') {
        failedPeers.push(peerId);
      }
    }

    for (const peerId of failedPeers) {
      await this.disconnectPeer(peerId);
    }
  }

  private async waitForPaymentResponse(peerId: string, transactionId: string): Promise<PaymentResult> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new UPPError(`Payment response timeout from peer ${peerId}`, "WEBRTC_ERROR", 500));
      }, 30000); // 30-second timeout

      // Set up temporary message handler to wait for payment response
      const originalHandler = this.handleDataChannelMessage.bind(this);
      this.handleDataChannelMessage = async (message: DataChannelMessage, sourcePeerId: string) => {
        if (sourcePeerId === peerId && 
            message.type === 'payment' && 
            message.payload.transactionId === transactionId) {
          clearTimeout(timeout);
          this.handleDataChannelMessage = originalHandler;
          resolve(message.payload as PaymentResult);
        } else {
          await originalHandler(message, sourcePeerId);
        }
      };
    });
  }

  private getPeerConnection(peerId: string): RTCPeerConnection {
    const peerState = this.peerConnections.get(peerId);
    if (!peerState) {
      throw new UPPError(`Peer connection ${peerId} not found`, "WEBRTC_ERROR", 500);
    }

    // In a real implementation, we would store the RTCPeerConnection reference
    // For now, we simulate this
    throw new UPPError('RTCPeerConnection reference not implemented in simulation', "WEBRTC_ERROR", 500);
  }

  private generateSessionId(): string {
    return `webrtc_session_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  private hashConfig(): string {
    const configString = JSON.stringify(this.config);
    return Buffer.from(configString).toString('base64').substring(0, 8);
  }
}