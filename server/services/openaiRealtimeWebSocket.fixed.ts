/**
 * OpenAI Realtime WebSocket Service
 * 
 * This service creates a bridge between client browsers and OpenAI's Realtime API WebSocket endpoint.
 * It handles client connections, manages OpenAI sessions, and routes messages between them.
 */

import WebSocket, { WebSocketServer } from 'ws';
import { Server as HttpServer } from 'http';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './logger';
import { openAIRealtimeService } from './openaiRealtime';

// WebSocket states
const WS_CONNECTING = 0;
const WS_OPEN = 1;
const WS_CLOSING = 2;
const WS_CLOSED = 3;

// Define the client connection type
interface ClientConnection {
  socket: WebSocket.WebSocket;
  id: string;
  customerId?: number;
  customerName?: string;
  sessionId?: string;
  openaiSocket?: WebSocket.WebSocket;
  openaiReadyState: boolean;
  lastErrorTime?: number;
  // Buffer for audio chunks received before OpenAI session is ready
  pendingAudioChunks: Buffer[];
  initializingSession: boolean;
}

export class OpenAIRealtimeWebSocketService {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, ClientConnection> = new Map();
  private pingInterval: NodeJS.Timeout | null = null;
  
  // Initialize the WebSocket server
  initialize(server: HttpServer): void {
    if (this.wss) {
      this.close();
    }
    
    logger.info({
      message: 'Initializing OpenAI Realtime WebSocket service',
      category: 'realtime',
      source: 'openai'
    });
    
    // Create WebSocket server attached to HTTP server
    this.wss = new WebSocketServer({ 
      server, 
      path: '/api/openai/realtime' 
    });
    
    // Set up event handlers
    this.wss.on('connection', this.handleConnection.bind(this));
    this.wss.on('error', this.handleServerError.bind(this));
    
    // Set up ping interval to keep connections alive
    this.pingInterval = setInterval(this.pingClients.bind(this), 30000);
    
    logger.info({
      message: 'OpenAI Realtime WebSocket service initialized',
      category: 'realtime',
      source: 'openai'
    });
  }
  
  // Close the WebSocket server and all connections
  close(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    
    // Close all client connections
    for (const clientConnection of this.clients.values()) {
      this.closeClientConnection(clientConnection.id);
    }
    
    // Close the server
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
    
    logger.info({
      message: 'OpenAI Realtime WebSocket service closed',
      category: 'realtime',
      source: 'openai'
    });
  }
  
  // Handle new WebSocket connections
  private handleConnection(socket: WebSocket.WebSocket, request: any): void {
    const clientId = uuidv4();
    
    logger.info({
      message: `New client connection: ${clientId}`,
      category: 'realtime',
      source: 'openai',
      metadata: { clientId }
    });
    
    // Create client connection object
    const clientConnection: ClientConnection = {
      socket,
      id: clientId,
      openaiReadyState: false,
      pendingAudioChunks: [],
      initializingSession: false
    };
    
    // Add to clients map
    this.clients.set(clientId, clientConnection);
    
    // Set up event handlers for this connection
    socket.on('message', (message) => this.handleClientMessage(clientId, message));
    socket.on('close', () => this.handleClientDisconnect(clientId));
    socket.on('error', (error) => this.handleClientError(clientId, error));
    
    // Send welcome message
    socket.send(JSON.stringify({
      type: 'welcome',
      message: 'Connected to OpenAI Realtime WebSocket service',
      clientId,
      timestamp: new Date().toISOString()
    }));
  }
  
  // Handle incoming messages from clients
  private async handleClientMessage(clientId: string, message: any): Promise<void> {
    const client = this.clients.get(clientId);
    
    if (!client) {
      logger.warn({
        message: `Received message from unknown client: ${clientId}`,
        category: 'realtime',
        source: 'openai',
        metadata: { clientId }
      });
      return;
    }
    
    // Handle binary data (audio chunks)
    if (message instanceof Buffer || message instanceof ArrayBuffer) {
      await this.handleBinaryMessage(client, message);
      return;
    }
    
    // For text messages, parse the JSON
    try {
      const data = JSON.parse(message.toString());
      await this.handleJsonMessage(client, data);
    } catch (error) {
      logger.error({
        message: `Error parsing message from client: ${clientId}`,
        category: 'realtime',
        source: 'openai',
        metadata: { 
          clientId,
          error: error instanceof Error ? error.stack : String(error)
        }
      });
      
      // Send error back to client
      client.socket.send(JSON.stringify({
        type: 'error',
        message: 'Invalid message format',
        timestamp: new Date().toISOString()
      }));
    }
  }
  
  // Handle binary messages (audio data)
  private async handleBinaryMessage(client: ClientConnection, message: any): Promise<void> {
    const { id: clientId, openaiSocket, openaiReadyState } = client;
    
    // Ensure message is a Buffer
    const buffer = message instanceof Buffer 
      ? message 
      : Buffer.from(message as ArrayBuffer);
    
    const size = buffer.length;
    
    // Check if there's an active OpenAI connection for this client
    if (openaiSocket && openaiReadyState) {
      // Connection exists and is ready
      if (openaiSocket.readyState === WS_OPEN) {
        logger.debug({
          message: `Forwarding audio data to OpenAI for client: ${clientId}`,
          category: 'realtime',
          source: 'openai',
          metadata: { clientId, size }
        });
        
        // Forward the binary data to OpenAI
        openaiSocket.send(buffer);
      } else {
        // Connection exists but isn't ready or is closing/closed
        logger.warn({
          message: `Cannot forward audio data - OpenAI socket not in OPEN state for client: ${clientId}`,
          category: 'realtime',
          source: 'openai',
          metadata: { 
            clientId, 
            socketState: openaiSocket.readyState 
          }
        });
        
        // If connection is closing or closed, buffer the audio for reconnection
        if (openaiSocket.readyState === WS_CLOSING || openaiSocket.readyState === WS_CLOSED) {
          this.bufferAudioForClient(client, buffer);
          
          // Try to reconnect if the connection is closed
          if (openaiSocket.readyState === WS_CLOSED) {
            this.sendErrorWithThrottling(client, {
              type: 'error',
              message: 'OpenAI connection was closed. Attempting to reconnect...',
              code: 'OPENAI_CONNECTION_CLOSED',
              timestamp: new Date().toISOString()
            });
            
            // Attempt to reestablish the connection if we have a session ID
            if (client.sessionId) {
              this.reconnectToOpenAI(client);
            }
          }
        }
      }
    } else if (openaiSocket && !openaiReadyState) {
      // Connection exists but isn't ready
      logger.warn({
        message: `Received audio data before OpenAI connection is ready for client: ${clientId}`,
        category: 'realtime',
        source: 'openai',
        metadata: { clientId, size }
      });
      
      // Buffer the audio data for when the session is ready
      this.bufferAudioForClient(client, buffer);
      
      // Send a clear error message back to the client
      this.sendErrorWithThrottling(client, {
        type: 'error',
        message: 'OpenAI connection is initializing. Please wait for the AI Ready notification before speaking.',
        code: 'OPENAI_CONNECTION_NOT_READY',
        timestamp: new Date().toISOString()
      });
    } else {
      // No OpenAI socket exists for this client
      logger.warn({
        message: `Received audio data but no OpenAI connection exists for client: ${clientId}`,
        category: 'realtime',
        source: 'openai',
        metadata: { clientId, size, initializingSession: client.initializingSession }
      });
      
      // Buffer the audio data if the session is initializing
      if (client.initializingSession) {
        this.bufferAudioForClient(client, buffer);
        this.sendErrorWithThrottling(client, {
          type: 'error',
          message: 'OpenAI session is being created. Please wait for the AI Ready notification before speaking.',
          code: 'SESSION_INITIALIZING',
          timestamp: new Date().toISOString()
        });
      } else {
        // If we have a client socket, send an error message
        this.sendErrorWithThrottling(client, {
          type: 'error',
          message: 'No active session. Please initiate a new conversation.',
          code: 'NO_SESSION_EXISTS',
          timestamp: new Date().toISOString()
        });
      }
    }
  }
  
  // Buffer audio data for a client to send when the session is ready
  private bufferAudioForClient(client: ClientConnection, buffer: Buffer): void {
    // Add to the pending audio chunks
    client.pendingAudioChunks.push(buffer);
    
    // Log if buffer is getting large
    if (client.pendingAudioChunks.length === 1) {
      logger.debug({
        message: `Started buffering audio for client: ${client.id}`,
        category: 'realtime',
        source: 'openai',
        metadata: { clientId: client.id }
      });
    } else if (client.pendingAudioChunks.length % 10 === 0) {
      logger.warn({
        message: `Large audio buffer accumulating for client: ${client.id}`,
        category: 'realtime',
        source: 'openai',
        metadata: { 
          clientId: client.id, 
          bufferSize: client.pendingAudioChunks.length,
          totalBytes: client.pendingAudioChunks.reduce((sum, chunk) => sum + chunk.length, 0)
        }
      });
    }
    
    // Limit buffer size to prevent memory issues
    if (client.pendingAudioChunks.length > 100) {
      logger.warn({
        message: `Audio buffer limit reached for client: ${client.id} - dropping oldest chunks`,
        category: 'realtime',
        source: 'openai',
        metadata: { clientId: client.id }
      });
      
      // Remove oldest chunks to keep buffer size manageable
      client.pendingAudioChunks = client.pendingAudioChunks.slice(-50);
    }
  }
  
  // Process buffered audio chunks for a client when session is ready
  private async processBufferedAudio(client: ClientConnection): Promise<void> {
    if (!client.openaiSocket || client.openaiSocket.readyState !== WS_OPEN || !client.openaiReadyState) {
      logger.warn({
        message: `Cannot process buffered audio - OpenAI session not ready for client: ${client.id}`,
        category: 'realtime',
        source: 'openai',
        metadata: { 
          clientId: client.id, 
          hasSocket: !!client.openaiSocket,
          socketReady: client.openaiSocket ? client.openaiSocket.readyState === WS_OPEN : false,
          sessionReady: client.openaiReadyState,
          bufferSize: client.pendingAudioChunks.length
        }
      });
      return;
    }
    
    const chunks = client.pendingAudioChunks;
    if (chunks.length === 0) return;
    
    logger.info({
      message: `Processing ${chunks.length} buffered audio chunks for client: ${client.id}`,
      category: 'realtime',
      source: 'openai',
      metadata: { 
        clientId: client.id, 
        chunksCount: chunks.length,
        totalBytes: chunks.reduce((sum, chunk) => sum + chunk.length, 0)
      }
    });
    
    // Send each chunk with a small delay to avoid flooding the network
    for (const chunk of chunks) {
      if (client.openaiSocket.readyState === WS_OPEN) {
        client.openaiSocket.send(chunk);
        
        // Small delay between chunks
        await new Promise(resolve => setTimeout(resolve, 10));
      } else {
        break;
      }
    }
    
    // Clear the buffer after processing
    client.pendingAudioChunks = [];
    
    // If we just processed audio, send an end of stream message to ensure proper transcription
    if (client.openaiSocket.readyState === WS_OPEN) {
      try {
        const message = JSON.stringify({
          type: 'input_audio_buffer.commit'
        });
        client.openaiSocket.send(message);
        
        logger.debug({
          message: `Sent commit message after processing buffered audio for client: ${client.id}`,
          category: 'realtime',
          source: 'openai',
          metadata: { clientId: client.id }
        });
      } catch (error) {
        logger.error({
          message: `Error sending commit message after buffered audio: ${error instanceof Error ? error.message : String(error)}`,
          category: 'realtime',
          source: 'openai',
          metadata: { 
            clientId: client.id,
            error: error instanceof Error ? error.stack : String(error)
          }
        });
      }
    }
  }
  
  // Send error messages with throttling to avoid flooding clients
  private sendErrorWithThrottling(client: ClientConnection, errorData: any): void {
    const now = Date.now();
    
    // Only send one error per second to avoid spamming the client
    if (!client.lastErrorTime || now - client.lastErrorTime > 1000) {
      client.lastErrorTime = now;
      
      if (client.socket && client.socket.readyState === WS_OPEN) {
        client.socket.send(JSON.stringify(errorData));
      }
    } else {
      logger.debug({
        message: `Suppressed duplicate error message to client: ${client.id}`,
        category: 'realtime',
        source: 'openai',
        metadata: { 
          clientId: client.id, 
          errorCode: errorData.code,
          timeSinceLastError: now - (client.lastErrorTime || 0)
        }
      });
    }
  }
  
  // Handle JSON messages from clients
  private async handleJsonMessage(client: ClientConnection, data: any): Promise<void> {
    const { id: clientId } = client;
    
    // If client doesn't exist, log and ignore
    if (!client) {
      logger.warn({
        message: `Received message from unknown client: ${clientId}`,
        category: 'realtime',
        source: 'openai',
      });
      return;
    }
    
    switch (data.type) {
      case 'create_session':
        await this.handleCreateSession(client, data);
        break;
        
      case 'end_session':
        this.handleEndSession(client);
        break;
        
      case 'audio_data':
        await this.handleAudioData(client, data);
        break;
        
      case 'end_of_stream':
        await this.handleEndOfStream(client);
        break;
        
      default:
        logger.warn({
          message: `Unhandled message type from client: ${clientId}`,
          category: 'realtime',
          source: 'openai',
          metadata: { 
            clientId, 
            messageType: data.type
          }
        });
        
        // Send error back to client
        client.socket.send(JSON.stringify({
          type: 'error',
          message: `Unrecognized message type: ${data.type}`,
          timestamp: new Date().toISOString()
        }));
    }
  }
  
  // Handle create session request
  private async handleCreateSession(client: ClientConnection, data: any): Promise<void> {
    const { id: clientId } = client;
    
    // Store customer info
    client.customerId = data.customerId;
    client.customerName = data.customerName || 'Customer';
    
    logger.info({
      message: `Creating session for client: ${clientId}`,
      category: 'realtime',
      source: 'openai',
      metadata: { 
        clientId,
        voice: data.voice,
        model: data.model || 'gpt-4o-realtime-preview'
      }
    });
    
    // Add logging for request data
    logger.debug({
      message: `Session creation request details`,
      category: 'realtime',
      source: 'openai',
      metadata: { 
        clientId: client.id,
        data: JSON.stringify(data) // Log the entire request
      }
    });
    
    // Mark as initializing to properly handle audio received during initialization
    client.initializingSession = true;
    
    try {
      // Add retry logic for session creation
      let retries = 0;
      const MAX_RETRIES = 2;
      let sessionData;
      
      while (retries <= MAX_RETRIES) {
        try {
          // Create a session with OpenAI
          sessionData = await openAIRealtimeService.createRealtimeSession({
            model: data.model || 'gpt-4o-realtime-preview', // Updated model name
            voice: data.voice || 'alloy',
            instructions: data.instructions || `You are a helpful assistant named Financial Sherpa.`
          });
          break; // Success, exit retry loop
        } catch (error) {
          retries++;
          logger.warn({
            message: `Session creation attempt ${retries} failed: ${error instanceof Error ? error.message : String(error)}`,
            category: 'realtime',
            source: 'openai',
            metadata: { clientId: client.id }
          });
          
          // If we've reached max retries, throw the error
          if (retries > MAX_RETRIES) throw error;
          
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * retries));
        }
      }
      
      if (!sessionData) {
        throw new Error('Failed to create session after retries');
      }
      
      // Extract session ID from the response
      const sessionId = sessionData.id;
      
      // Store the session ID
      client.sessionId = sessionId;
      
      // Construct WebSocket URL using the session ID
      const sessionUrl = `wss://api.openai.com/v1/realtime/${sessionId}`;
      
      // Use the session ID as the token
      const token = sessionId;
      
      // Connect to OpenAI WebSocket
      await this.connectToOpenAI(client, sessionUrl, token);
      
      logger.info({
        message: `Created session for client: ${clientId}`,
        category: 'realtime',
        source: 'openai',
        metadata: { 
          clientId,
          sessionId
        }
      });
      
      // Send confirmation message to client
      client.socket.send(JSON.stringify({
        type: 'session_created',
        message: 'Session created successfully',
        sessionId,
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      logger.error({
        message: `Error creating session for client: ${clientId}`,
        category: 'realtime',
        source: 'openai',
        metadata: { 
          clientId,
          error: error instanceof Error ? error.stack : String(error)
        }
      });
      
      // Send error back to client
      client.socket.send(JSON.stringify({
        type: 'error',
        message: 'Failed to create session',
        details: error instanceof Error ? error.message : String(error),
        code: 'SESSION_INITIALIZATION_FAILED',
        timestamp: new Date().toISOString()
      }));
    } finally {
      // Always mark session as no longer initializing, regardless of success/failure
      client.initializingSession = false;
    }
  }
  
  // Connect to OpenAI WebSocket
  private async connectToOpenAI(client: ClientConnection, sessionUrl: string, token: string): Promise<void> {
    const { id: clientId } = client;
    
    // Close any existing connection
    if (client.openaiSocket) {
      try {
        client.openaiSocket.close();
      } catch (error) {
        // Ignore errors when closing old connection
      }
    }
    
    // Reset connection state
    client.openaiReadyState = false;
    
    // Create a new connection to OpenAI
    try {
      logger.info({
        message: `Connecting to OpenAI for client: ${clientId}`,
        category: 'realtime',
        source: 'openai',
        metadata: { 
          clientId,
          sessionUrl
        }
      });
      
      // Create a new WebSocket connection
      // WebSocket protocol doesn't support sending custom headers in the initial handshake
      // For OpenAI, the token should be in the query string
      const wsUrlWithToken = `${sessionUrl}?token=${encodeURIComponent(token)}`;
      const socket = new WebSocket.WebSocket(wsUrlWithToken);
      
      // Store the socket
      client.openaiSocket = socket;
      
      // Set up event handlers
      socket.on('open', () => {
        logger.info({
          message: `Connected to OpenAI for client: ${clientId}`,
          category: 'realtime',
          source: 'openai',
          metadata: { clientId }
        });
        
        // Reset initialization flag
        client.initializingSession = false;
      });
      
      socket.on('message', (message) => this.handleOpenAIMessage(client, message));
      
      socket.on('close', (code, reason) => {
        logger.warn({
          message: `OpenAI connection closed for client: ${clientId}`,
          category: 'realtime',
          source: 'openai',
          metadata: { 
            clientId,
            code,
            reason: reason.toString() 
          }
        });
        
        // Reset connection state
        client.openaiReadyState = false;
        
        // Notify client
        client.socket.send(JSON.stringify({
          type: 'openai_disconnected',
          message: 'OpenAI connection closed',
          code,
          reason: reason.toString(),
          timestamp: new Date().toISOString()
        }));
      });
      
      socket.on('error', (error) => {
        logger.error({
          message: `OpenAI socket error for client: ${clientId}`,
          category: 'realtime',
          source: 'openai',
          metadata: { 
            clientId,
            error: error instanceof Error ? error.stack : String(error)
          }
        });
        
        // Reset connection state
        client.openaiReadyState = false;
        
        // Notify client
        client.socket.send(JSON.stringify({
          type: 'error',
          message: 'OpenAI connection error',
          details: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString()
        }));
      });
    } catch (error) {
      logger.error({
        message: `Error connecting to OpenAI for client: ${clientId}`,
        category: 'realtime',
        source: 'openai',
        metadata: { 
          clientId,
          error: error instanceof Error ? error.stack : String(error)
        }
      });
      
      // Reset initialization flag
      client.initializingSession = false;
      
      // Notify client
      client.socket.send(JSON.stringify({
        type: 'error',
        message: 'Failed to connect to OpenAI',
        details: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      }));
      
      throw error;
    }
  }
  
  // Handle messages from OpenAI
  private async handleOpenAIMessage(client: ClientConnection, message: WebSocket.Data): Promise<void> {
    const { id: clientId } = client;
    
    try {
      if (typeof message === 'string') {
        // Parse JSON messages
        const data = JSON.parse(message);
        
        logger.debug({
          message: `Received message from OpenAI for client: ${clientId}`,
          category: 'realtime',
          source: 'openai',
          metadata: { 
            clientId,
            messageType: data.type
          }
        });
        
        // Check for session ready event
        if (data.type === 'transcription.session_created') {
          this.setSessionReady(client);
        }
        
        // Forward message to client
        client.socket.send(message);
      } else if (message instanceof Buffer || message instanceof ArrayBuffer) {
        // Forward binary data (likely audio) to client
        client.socket.send(message);
      }
    } catch (error) {
      logger.error({
        message: `Error handling OpenAI message for client: ${clientId}`,
        category: 'realtime',
        source: 'openai',
        metadata: { 
          clientId,
          error: error instanceof Error ? error.stack : String(error)
        }
      });
    }
  }
  
  // Mark session as ready and process any buffered audio
  private setSessionReady(client: ClientConnection): void {
    const { id: clientId } = client;
    
    if (client.openaiReadyState) {
      // Already ready, nothing to do
      return;
    }
    
    logger.info({
      message: `OpenAI session ready for client: ${clientId}`,
      category: 'realtime',
      source: 'openai',
      metadata: { clientId }
    });
    
    // Mark session as ready
    client.openaiReadyState = true;
    
    // Process any buffered audio
    if (client.pendingAudioChunks.length > 0) {
      this.processBufferedAudio(client);
    }
  }
  
  // Reconnect to OpenAI
  private async reconnectToOpenAI(client: ClientConnection): Promise<void> {
    const { id: clientId } = client;
    
    logger.info({
      message: `Reconnecting to OpenAI for client: ${clientId}`,
      category: 'realtime',
      source: 'openai',
      metadata: { clientId }
    });
    
    try {
      // Instead of trying to get a new token, we'll create a new session
      // since the original session might be expired
      const sessionData = await openAIRealtimeService.createRealtimeSession({
        model: 'gpt-4o-realtime-preview', // Updated model name
        voice: 'alloy', // Default voice
      });
      
      // Store the new session ID
      client.sessionId = sessionData.id;
      
      // Extract URL and token for connection
      const sessionUrl = `wss://api.openai.com/v1/realtime/${sessionData.id}`;
      const token = sessionData.id; // Using session ID as token for simplicity
      
      // Connect to OpenAI WebSocket
      await this.connectToOpenAI(client, sessionUrl, token);
      
      // Send notification to client
      client.socket.send(JSON.stringify({
        type: 'reconnected',
        message: 'Reconnected to OpenAI',
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      logger.error({
        message: `Failed to reconnect to OpenAI for client: ${clientId}`,
        category: 'realtime',
        source: 'openai',
        metadata: { 
          clientId,
          error: error instanceof Error ? error.stack : String(error)
        }
      });
      
      // Notify client
      client.socket.send(JSON.stringify({
        type: 'error',
        message: 'Failed to reconnect to OpenAI',
        details: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      }));
    }
  }
  
  // Handle audio data message
  private async handleAudioData(client: ClientConnection, data: any): Promise<void> {
    // Audio data should be provided as binary data, not in JSON
    // This is just a placeholder for any future implementation
    logger.warn({
      message: `Received audio_data message type, but audio should be sent as binary data for client: ${client.id}`,
      category: 'realtime',
      source: 'openai',
      metadata: { clientId: client.id }
    });
    
    // Send error back to client
    client.socket.send(JSON.stringify({
      type: 'error',
      message: 'Audio data should be sent as binary data, not in a JSON message',
      timestamp: new Date().toISOString()
    }));
  }
  
  // Handle end of stream message
  private async handleEndOfStream(client: ClientConnection): Promise<void> {
    const { id: clientId, openaiSocket, openaiReadyState } = client;
    
    logger.info({
      message: `Received end_of_stream for client: ${clientId}`,
      category: 'realtime',
      source: 'openai',
      metadata: { 
        clientId,
        openaiReady: openaiReadyState
      }
    });
    
    // If we have an OpenAI connection, forward the end of stream
    if (openaiSocket && openaiReadyState && openaiSocket.readyState === WS_OPEN) {
      try {
        // Send the commit message to finalize the audio buffer
        openaiSocket.send(JSON.stringify({
          type: 'input_audio_buffer.commit'
        }));
        
        logger.debug({
          message: `Sent commit message for client: ${clientId}`,
          category: 'realtime',
          source: 'openai',
          metadata: { clientId }
        });
      } catch (error) {
        logger.error({
          message: `Error sending commit message for client: ${clientId}`,
          category: 'realtime',
          source: 'openai',
          metadata: { 
            clientId,
            error: error instanceof Error ? error.stack : String(error)
          }
        });
      }
    } else {
      logger.warn({
        message: `Cannot send end of stream - OpenAI connection not ready for client: ${clientId}`,
        category: 'realtime',
        source: 'openai',
        metadata: { 
          clientId,
          hasSocket: !!openaiSocket,
          socketState: openaiSocket ? openaiSocket.readyState : 'none',
          sessionReady: openaiReadyState
        }
      });
    }
  }
  
  // Handle client disconnect
  private handleClientDisconnect(clientId: string): void {
    logger.info({
      message: `Client disconnected: ${clientId}`,
      category: 'realtime',
      source: 'openai',
      metadata: { clientId }
    });
    
    // Close the OpenAI connection and clean up
    this.closeClientConnection(clientId);
  }
  
  // Handle client error
  private handleClientError(clientId: string, error: Error): void {
    logger.error({
      message: `Client error: ${clientId}`,
      category: 'realtime',
      source: 'openai',
      metadata: { 
        clientId,
        error: error.stack
      }
    });
    
    // Close the OpenAI connection and clean up
    this.closeClientConnection(clientId);
  }
  
  // Handle server error
  private handleServerError(error: Error): void {
    logger.error({
      message: `WebSocket server error`,
      category: 'realtime',
      source: 'openai',
      metadata: { 
        error: error.stack
      }
    });
  }
  
  // Close a client connection
  private closeClientConnection(clientId: string): void {
    const client = this.clients.get(clientId);
    
    if (!client) {
      return;
    }
    
    // Close OpenAI connection
    if (client.openaiSocket) {
      try {
        client.openaiSocket.close();
      } catch (error) {
        // Ignore errors when closing
      }
      client.openaiSocket = undefined;
    }
    
    // Remove from clients map
    this.clients.delete(clientId);
    
    logger.info({
      message: `Closed client connection: ${clientId}`,
      category: 'realtime',
      source: 'openai',
      metadata: { clientId }
    });
  }
  
  // Handle end session request
  private handleEndSession(client: ClientConnection): void {
    const { id: clientId } = client;
    
    logger.info({
      message: `Ending session for client: ${clientId}`,
      category: 'realtime',
      source: 'openai',
      metadata: { clientId }
    });
    
    // Close OpenAI connection
    if (client.openaiSocket) {
      try {
        client.openaiSocket.close();
      } catch (error) {
        // Ignore errors when closing
      }
      client.openaiSocket = undefined;
      client.openaiReadyState = false;
    }
    
    // Clear session ID
    client.sessionId = undefined;
    
    // Clear pending audio
    client.pendingAudioChunks = [];
    
    // Send confirmation to client
    client.socket.send(JSON.stringify({
      type: 'session_ended',
      message: 'Session ended successfully',
      timestamp: new Date().toISOString()
    }));
  }
  
  // Ping clients to keep connections alive
  private pingClients(): void {
    for (const client of this.clients.values()) {
      if (client.socket.readyState === WS_OPEN) {
        try {
          // Use a simple ping message instead of the ping() method
          client.socket.send(JSON.stringify({ type: 'ping' }));
        } catch (error) {
          // Ignore ping errors, they might disconnect naturally
        }
      }
    }
  }
}

// Create singleton instance
export const openaiRealtimeWebSocketService = new OpenAIRealtimeWebSocketService();