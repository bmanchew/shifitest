/**
 * OpenAI Realtime WebSocket Service
 * 
 * This service creates a bridge between client browsers and OpenAI's Realtime API WebSocket endpoint.
 * It handles client connections, manages OpenAI sessions, and routes messages between them.
 */

import * as WebSocket from 'ws';
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
  socket: WebSocket;
  id: string;
  customerId?: number;
  customerName?: string;
  sessionId?: string;
  openaiSocket?: WebSocket;
  openaiReadyState: boolean;
  lastErrorTime?: number;
  // Buffer for audio chunks received before OpenAI session is ready
  pendingAudioChunks: Buffer[];
  initializingSession: boolean;
}

export class OpenAIRealtimeWebSocketService {
  private wss: WebSocket.Server | null = null;
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
    this.wss = new WebSocket.Server({ server, path: '/api/openai/realtime' });
    
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
  private handleConnection(socket: WebSocket, request: any): void {
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
  private async handleClientMessage(clientId: string, message: WebSocket.Data): Promise<void> {
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
  private async handleBinaryMessage(client: ClientConnection, message: WebSocket.Data): Promise<void> {
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
        openaiSocket.send(message);
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
        voice: data.voice
      }
    });
    
    // Mark as initializing to properly handle audio received during initialization
    client.initializingSession = true;
    
    try {
      // Create a session with OpenAI via REST API
      const sessionData = await openAIRealtimeService.createRealtimeSession({
        model: 'gpt-4o',
        voice: data.voice || 'alloy',
        instructions: data.instructions || `You are a helpful assistant named Financial Sherpa.`
      });
      
      // Extract session ID from the response
      const sessionId = sessionData.id;
      
      // Construct WebSocket URL using the session ID
      const sessionUrl = `wss://api.openai.com/v1/realtime/${sessionId}`;
      
      // Use the session ID as the token (this varies depending on OpenAI's API)
      const token = sessionId;
      
      logger.info({
        message: `Session created for client: ${clientId}`,
        category: 'realtime',
        source: 'openai',
        metadata: { 
          clientId,
          sessionId,
          sessionData // Log the full session data for debugging
        }
      });
      
      // Store session ID
      client.sessionId = sessionId;
      
      // Connect to OpenAI WebSocket with the session token
      await this.connectToOpenAI(client, sessionUrl, token);
      
      // Notify client of session creation
      client.socket.send(JSON.stringify({
        type: 'session_created',
        sessionId,
        voice: data.voice || 'alloy',
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
      
      // Unmark initializing state
      client.initializingSession = false;
      
      // Send error to client
      client.socket.send(JSON.stringify({
        type: 'error',
        message: `Failed to create session: ${error instanceof Error ? error.message : String(error)}`,
        critical: true,
        timestamp: new Date().toISOString()
      }));
    }
  }
  
  // Connect to OpenAI WebSocket
  private async connectToOpenAI(client: ClientConnection, sessionUrl: string, token: string): Promise<void> {
    const { id: clientId } = client;
    
    try {
      logger.info({
        message: `Connecting to OpenAI Realtime API for client: ${clientId}`,
        category: 'realtime',
        source: 'openai',
        metadata: { 
          clientId
        }
      });
      
      // Create WebSocket connection to OpenAI
      const openaiSocket = new WebSocket(sessionUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      // Store the socket in the client object
      client.openaiSocket = openaiSocket;
      
      // Set up event handlers
      openaiSocket.on('open', () => {
        logger.info({
          message: `OpenAI WebSocket connection opened for client: ${clientId}`,
          category: 'realtime',
          source: 'openai',
          metadata: { clientId }
        });
        
        // Send auth success notification to client
        client.socket.send(JSON.stringify({
          type: 'session_authenticate_success',
          timestamp: new Date().toISOString()
        }));
        
        // Now send the create payload to OpenAI
        try {
          const createPayload = {
            type: 'transcription_session.create',
            transcription_session: {
              mode: 'speech_recognition',
              language: 'en', // TODO: Make this configurable
              vad: {
                active: true,
                before_speech_ms: 200,
                after_speech_ms: 1000
              },
              sample_rate: 16000, // TODO: Make this configurable
              direct_voice_activity_detection: true
            }
          };
          
          logger.info({
            message: `Sending transcription_session.create payload to OpenAI for client: ${clientId}`,
            category: 'realtime',
            source: 'openai',
            metadata: { 
              clientId,
              payload: createPayload
            }
          });
          
          openaiSocket.send(JSON.stringify(createPayload));
        } catch (error) {
          logger.error({
            message: `Error sending transcription_session.create payload: ${error instanceof Error ? error.message : String(error)}`,
            category: 'realtime',
            source: 'openai',
            metadata: { 
              clientId,
              error: error instanceof Error ? error.stack : String(error)
            }
          });
        }
        
        // Set a timeout to force-set readiness if we don't get confirmation
        // This helps in case OpenAI doesn't send the expected event
        setTimeout(() => {
          if (!client.openaiReadyState && client.openaiSocket === openaiSocket) {
            logger.warn({
              message: `OpenAI session readiness timeout - forcing ready state for client: ${clientId}`,
              category: 'realtime',
              source: 'openai',
              metadata: { clientId }
            });
            
            // Force set ready state after timeout
            this.setSessionReady(client);
          }
        }, 8000); // 8 second timeout
      });
      
      openaiSocket.on('message', (message) => this.handleOpenAIMessage(client, message));
      
      openaiSocket.on('close', () => {
        logger.info({
          message: `OpenAI WebSocket connection closed for client: ${clientId}`,
          category: 'realtime',
          source: 'openai',
          metadata: { clientId }
        });
        
        // Reset ready state on close
        client.openaiReadyState = false;
        
        // Notify client of connection close if their socket is still open
        if (client.socket && client.socket.readyState === WS_OPEN) {
          client.socket.send(JSON.stringify({
            type: 'error',
            message: 'OpenAI connection closed',
            code: 'OPENAI_CONNECTION_CLOSED',
            timestamp: new Date().toISOString()
          }));
        }
      });
      
      openaiSocket.on('error', (error) => {
        logger.error({
          message: `OpenAI WebSocket error for client: ${clientId}`,
          category: 'realtime',
          source: 'openai',
          metadata: { 
            clientId,
            error: error instanceof Error ? error.stack : String(error)
          }
        });
        
        // Notify client of error
        if (client.socket && client.socket.readyState === WS_OPEN) {
          client.socket.send(JSON.stringify({
            type: 'error',
            message: `OpenAI connection error: ${error instanceof Error ? error.message : String(error)}`,
            code: 'OPENAI_CONNECTION_ERROR',
            timestamp: new Date().toISOString()
          }));
        }
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
      
      // Unmark initializing state
      client.initializingSession = false;
      
      // Send error to client
      client.socket.send(JSON.stringify({
        type: 'error',
        message: `Failed to connect to OpenAI: ${error instanceof Error ? error.message : String(error)}`,
        critical: true,
        timestamp: new Date().toISOString()
      }));
    }
  }
  
  // Handle messages from OpenAI
  private async handleOpenAIMessage(client: ClientConnection, message: WebSocket.Data): Promise<void> {
    const { id: clientId } = client;
    
    try {
      // If the message is a Buffer or ArrayBuffer, it's binary data
      if (message instanceof Buffer || message instanceof ArrayBuffer) {
        // OpenAI doesn't typically send binary data back, but if it does, log it
        logger.debug({
          message: `Received binary data from OpenAI for client: ${clientId}`,
          category: 'realtime',
          source: 'openai',
          metadata: { 
            clientId,
            size: message instanceof Buffer ? message.length : message.byteLength
          }
        });
        return;
      }
      
      // Parse the message as JSON
      const data = JSON.parse(message.toString());
      
      // Handle different message types from OpenAI
      switch (data.type) {
        case 'transcription_session.created':
          logger.info({
            message: `Transcription session CREATED for client: ${clientId}`,
            category: 'realtime',
            source: 'openai',
            metadata: { 
              clientId,
              sessionData: data
            }
          });
          
          // Set the session as ready
          this.setSessionReady(client);
          
          // Forward the message to the client
          client.socket.send(JSON.stringify({
            type: 'transcription_session.created',
            timestamp: new Date().toISOString()
          }));
          break;
          
        case 'transcription_session.updated':
          logger.info({
            message: `Transcription session updated for client: ${clientId}`,
            category: 'realtime',
            source: 'openai',
            metadata: { 
              clientId,
              sessionData: data
            }
          });
          
          // Also consider the session ready when updated (as a fallback)
          this.setSessionReady(client);
          break;
          
        case 'conversation.item.input_audio_transcription.delta':
          // Don't log every delta to avoid spam
          
          // Forward the delta transcription to the client
          client.socket.send(JSON.stringify({
            type: 'transcription',
            text: data.delta?.text || '',
            timestamp: new Date().toISOString()
          }));
          break;
          
        case 'conversation.item.input_audio_transcription.completed':
          logger.info({
            message: `Transcription completed for client: ${clientId}`,
            category: 'realtime',
            source: 'openai',
            metadata: { 
              clientId,
              transcription: data.input_audio_transcription?.text || ''
            }
          });
          
          // Forward the complete transcription to the client
          client.socket.send(JSON.stringify({
            type: 'transcription',
            text: data.input_audio_transcription?.text || '',
            final: true,
            timestamp: new Date().toISOString()
          }));
          break;
          
        case 'conversation.item.message.delta':
          // Forward the delta message to the client
          if (data.delta?.content) {
            client.socket.send(JSON.stringify({
              type: 'message',
              role: 'assistant',
              content: data.delta.content,
              timestamp: new Date().toISOString()
            }));
          }
          break;
          
        case 'conversation.item.message.completed':
          logger.info({
            message: `Message completed for client: ${clientId}`,
            category: 'realtime',
            source: 'openai',
            metadata: { 
              clientId,
              message: data.message?.content || ''
            }
          });
          
          // Forward the complete message to the client
          if (data.message?.content) {
            client.socket.send(JSON.stringify({
              type: 'message',
              role: 'assistant',
              content: data.message.content,
              final: true,
              timestamp: new Date().toISOString()
            }));
          }
          break;
          
        case 'error':
          logger.error({
            message: `Error from OpenAI for client: ${clientId}`,
            category: 'realtime',
            source: 'openai',
            metadata: { 
              clientId,
              error: data
            }
          });
          
          // Forward the error to the client
          client.socket.send(JSON.stringify({
            type: 'error',
            message: data.message || 'Unknown error from OpenAI',
            code: 'OPENAI_API_ERROR',
            timestamp: new Date().toISOString()
          }));
          break;
          
        default:
          // Log but don't forward unknown message types
          logger.debug({
            message: `Unhandled message type from OpenAI for client: ${clientId}`,
            category: 'realtime',
            source: 'openai',
            metadata: { 
              clientId,
              type: data.type,
              data: data
            }
          });
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
  
  // Set the session as ready and process any pending audio
  private setSessionReady(client: ClientConnection): void {
    if (client.openaiReadyState) return; // Already ready
    
    const { id: clientId } = client;
    
    logger.info({
      message: `Setting OpenAI session ready state to TRUE for client: ${clientId}`,
      category: 'realtime',
      source: 'openai',
      metadata: { 
        clientId,
        pendingAudioChunks: client.pendingAudioChunks.length
      }
    });
    
    // Set ready state
    client.openaiReadyState = true;
    client.initializingSession = false;
    
    // Process any pending audio chunks
    if (client.pendingAudioChunks.length > 0) {
      this.processBufferedAudio(client);
    }
  }
  
  // Attempt to reconnect to OpenAI
  private async reconnectToOpenAI(client: ClientConnection): Promise<void> {
    const { id: clientId, sessionId } = client;
    
    if (!sessionId) {
      logger.warn({
        message: `Cannot reconnect to OpenAI - no session ID for client: ${clientId}`,
        category: 'realtime',
        source: 'openai',
        metadata: { clientId }
      });
      return;
    }
    
    try {
      logger.info({
        message: `Attempting to reconnect to OpenAI for client: ${clientId}`,
        category: 'realtime',
        source: 'openai',
        metadata: { clientId, sessionId }
      });
      
      // Instead of trying to get a new token, we'll create a new session
      // since the original session might be expired
      const sessionResponse = await openAIRealtimeService.createRealtimeSession({
        model: 'gpt-4o',
        voice: 'alloy', // Default voice
      });
      
      // Store the new session ID
      client.sessionId = sessionResponse.id;
      
      // Extract URL and token for connection
      const sessionUrl = `wss://api.openai.com/v1/realtime/${sessionResponse.id}`;
      const token = sessionResponse.id; // Using session ID as token for simplicity
      
      // Connect to OpenAI with the new session
      await this.connectToOpenAI(client, sessionUrl, token);
      
      logger.info({
        message: `Created new session during reconnect for client: ${clientId}`,
        category: 'realtime',
        source: 'openai',
        metadata: { 
          clientId,
          newSessionId: sessionResponse.id
        }
      });
    } catch (error) {
      logger.error({
        message: `Failed to reconnect to OpenAI for client: ${clientId}`,
        category: 'realtime',
        source: 'openai',
        metadata: { 
          clientId, 
          sessionId,
          error: error instanceof Error ? error.stack : String(error)
        }
      });
      
      // Notify client of reconnection failure
      client.socket.send(JSON.stringify({
        type: 'error',
        message: 'Failed to reconnect to OpenAI',
        code: 'OPENAI_RECONNECT_FAILED',
        critical: true,
        timestamp: new Date().toISOString()
      }));
    }
  }
  
  // Handle audio data sent as base64 (fallback for browsers that don't support binary WebSocket)
  private async handleAudioData(client: ClientConnection, data: any): Promise<void> {
    const { id: clientId, openaiSocket, openaiReadyState } = client;
    
    if (!data.audio) {
      logger.warn({
        message: `Received audio_data message without audio field from client: ${clientId}`,
        category: 'realtime',
        source: 'openai',
        metadata: { clientId }
      });
      return;
    }
    
    try {
      // Convert base64 to buffer
      const buffer = Buffer.from(data.audio, 'base64');
      
      // Handle like binary data
      await this.handleBinaryMessage(client, buffer);
    } catch (error) {
      logger.error({
        message: `Error handling base64 audio data from client: ${clientId}`,
        category: 'realtime',
        source: 'openai',
        metadata: { 
          clientId,
          error: error instanceof Error ? error.stack : String(error)
        }
      });
    }
  }
  
  // Handle end of stream message
  private async handleEndOfStream(client: ClientConnection): Promise<void> {
    const { id: clientId, openaiSocket, openaiReadyState } = client;
    
    if (openaiSocket && openaiReadyState && openaiSocket.readyState === WS_OPEN) {
      logger.info({
        message: `Sending end of stream for client: ${clientId}`,
        category: 'realtime',
        source: 'openai',
        metadata: { clientId }
      });
      
      // Send commit message to OpenAI to signal end of audio
      openaiSocket.send(JSON.stringify({
        type: 'input_audio_buffer.commit'
      }));
    } else {
      logger.warn({
        message: `Cannot send end of stream - OpenAI connection not ready for client: ${clientId}`,
        category: 'realtime',
        source: 'openai',
        metadata: { 
          clientId, 
          hasSocket: !!openaiSocket,
          socketReady: openaiSocket ? openaiSocket.readyState === WS_OPEN : false,
          sessionReady: openaiReadyState
        }
      });
    }
  }
  
  // Handle client disconnection
  private handleClientDisconnect(clientId: string): void {
    logger.info({
      message: `Client disconnected: ${clientId}`,
      category: 'realtime',
      source: 'openai',
      metadata: { clientId }
    });
    
    // Close and clean up the client connection
    this.closeClientConnection(clientId);
  }
  
  // Handle client errors
  private handleClientError(clientId: string, error: Error): void {
    logger.error({
      message: `Client connection error: ${clientId}`,
      category: 'realtime',
      source: 'openai',
      metadata: { 
        clientId, 
        error: error.stack || error.message
      }
    });
    
    // Close the connection on error
    this.closeClientConnection(clientId);
  }
  
  // Handle WebSocket server errors
  private handleServerError(error: Error): void {
    logger.error({
      message: 'WebSocket server error',
      category: 'realtime',
      source: 'openai',
      metadata: { error: error.stack || error.message }
    });
  }
  
  // Close a client connection and clean up resources
  private closeClientConnection(clientId: string): void {
    const client = this.clients.get(clientId);
    
    if (!client) return;
    
    // Close OpenAI connection
    if (client.openaiSocket) {
      // Only close if it's not already closed
      if (client.openaiSocket.readyState !== WS_CLOSED) {
        client.openaiSocket.close();
      }
      client.openaiSocket = undefined;
    }
    
    // Close client socket
    if (client.socket && client.socket.readyState !== WS_CLOSED) {
      client.socket.close();
    }
    
    // Remove from clients map
    this.clients.delete(clientId);
    
    logger.info({
      message: `Client connection closed and cleaned up: ${clientId}`,
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
    
    // Close OpenAI connection but keep client connection
    if (client.openaiSocket) {
      // Only close if it's not already closed
      if (client.openaiSocket.readyState !== WS_CLOSED) {
        client.openaiSocket.close();
      }
      client.openaiSocket = undefined;
    }
    
    // Reset client state
    client.openaiReadyState = false;
    client.sessionId = undefined;
    client.pendingAudioChunks = [];
    client.initializingSession = false;
    
    // Notify client
    client.socket.send(JSON.stringify({
      type: 'session_ended',
      message: 'Session ended successfully',
      timestamp: new Date().toISOString()
    }));
  }
  
  // Ping clients to keep connections alive
  private pingClients(): void {
    for (const client of this.clients.values()) {
      if (client.socket && client.socket.readyState === WS_OPEN) {
        try {
          client.socket.ping();
        } catch (error) {
          logger.error({
            message: `Error pinging client: ${client.id}`,
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
  }
}

// Export an instance of the service
export const openaiRealtimeWebSocketService = new OpenAIRealtimeWebSocketService();