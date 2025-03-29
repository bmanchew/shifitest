/**
 * OpenAI Realtime WebSocket service
 * 
 * This service creates a WebSocket server that acts as a bridge between
 * the browser client and OpenAI's Realtime API WebSocket server.
 */

import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './logger';
import { openAIRealtimeService } from './openaiRealtime';

interface RealtimeWebSocketOptions {
  server: any; // Express server or HTTP/HTTPS server
  path?: string;
}

class OpenAIRealtimeWebSocketService {
  private wss: WebSocket.Server | null = null;
  private clients: Map<string, {
    socket: WebSocket;
    sessionId?: string;
    userId?: number;
    role?: string;
  }> = new Map();
  private openaiConnections: Map<string, WebSocket> = new Map();
  
  constructor() {}

  /**
   * Initialize the WebSocket server
   */
  public initialize(options: RealtimeWebSocketOptions): boolean {
    try {
      if (this.wss) {
        logger.warn('WebSocket server already initialized', {
          category: 'openai',
          source: 'openai'
        });
        return true;
      }

      const { server, path = '/api/openai/realtime' } = options;

      this.wss = new WebSocket.Server({ 
        server,
        path 
      });

      this.wss.on('connection', this.handleConnection.bind(this));

      logger.info('OpenAI Realtime WebSocket server initialized', {
        path,
        category: 'openai',
        source: 'openai'
      });

      return true;
    } catch (error) {
      logger.error('Failed to initialize WebSocket server', {
        error,
        category: 'openai',
        source: 'openai'
      });
      return false;
    }
  }

  /**
   * Handle a new WebSocket connection from a client
   */
  private handleConnection(clientSocket: WebSocket, request: any): void {
    const clientId = uuidv4();
    
    // Store client information
    this.clients.set(clientId, {
      socket: clientSocket
    });

    // Parse URL parameters
    const url = new URL(request.url, `http://${request.headers.host}`);
    const userId = url.searchParams.get('userId');
    const role = url.searchParams.get('role');
    
    if (userId) {
      this.clients.get(clientId)!.userId = parseInt(userId, 10);
    }
    
    if (role) {
      this.clients.get(clientId)!.role = role;
    }

    logger.info('Client connected to OpenAI Realtime WebSocket', {
      clientId,
      userId,
      role,
      category: 'openai',
      source: 'openai'
    });

    // Set up event handlers for the client socket
    clientSocket.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        await this.handleClientMessage(clientId, data);
      } catch (error) {
        logger.error('Error handling client message', {
          error,
          clientId,
          category: 'openai',
          source: 'openai'
        });
      }
    });

    clientSocket.on('close', () => {
      this.handleClientDisconnect(clientId);
    });

    clientSocket.on('error', (error) => {
      logger.error('WebSocket error with client', {
        error,
        clientId,
        category: 'openai',
        source: 'openai'
      });
    });

    // Send welcome message
    clientSocket.send(JSON.stringify({
      type: 'welcome',
      clientId,
      connected: true,
      timestamp: Date.now()
    }));
  }

  /**
   * Handle a message received from a client
   */
  private async handleClientMessage(clientId: string, data: any): Promise<void> {
    const client = this.clients.get(clientId);
    
    if (!client) {
      logger.error('Client not found for message', {
        clientId,
        category: 'openai',
        source: 'openai'
      });
      return;
    }

    const { type } = data;

    switch (type) {
      case 'create_session':
        await this.handleCreateSession(clientId, data);
        break;
      
      case 'audio_data':
        await this.handleAudioData(clientId, data);
        break;
      
      case 'text_input':
        await this.handleTextInput(clientId, data);
        break;
      
      case 'end_session':
        await this.handleEndSession(clientId);
        break;
      
      default:
        logger.warn('Unknown message type from client', {
          type,
          clientId,
          category: 'openai',
          source: 'openai'
        });
    }
  }

  /**
   * Handle a client disconnecting
   */
  private handleClientDisconnect(clientId: string): void {
    const client = this.clients.get(clientId);
    
    if (!client) {
      return;
    }

    // Clean up OpenAI connection if it exists
    if (client.sessionId && this.openaiConnections.has(client.sessionId)) {
      const openaiSocket = this.openaiConnections.get(client.sessionId);
      if (openaiSocket && openaiSocket.readyState === WebSocket.OPEN) {
        openaiSocket.close();
      }
      this.openaiConnections.delete(client.sessionId);
    }

    // Remove client from our records
    this.clients.delete(clientId);

    logger.info('Client disconnected from WebSocket', {
      clientId,
      category: 'openai',
      source: 'openai'
    });
  }

  /**
   * Handle a request to create a new OpenAI Realtime session
   */
  private async handleCreateSession(clientId: string, data: any): Promise<void> {
    const client = this.clients.get(clientId);
    
    if (!client) {
      return;
    }

    try {
      // Create a session with OpenAI
      const sessionOptions = {
        voice: data.voice || 'alloy',
        instructions: data.instructions,
        temperature: data.temperature || 0.7
      };

      logger.info('Creating OpenAI Realtime session with options', {
        options: sessionOptions,
        clientId,
        category: 'openai',
        source: 'openai'
      });

      logger.info('Calling OpenAI Realtime service to create session', {
        clientId,
        sessionOptions,
        category: 'openai',
        source: 'openai'
      });
      
      const session = await openAIRealtimeService.createRealtimeSession(sessionOptions);
      
      logger.info('Successfully created OpenAI Realtime session', {
        sessionId: session.id,
        clientId,
        model: session.model,
        voice: session.voice,
        category: 'openai',
        source: 'openai'
      });
      
      // Store the session ID with the client
      client.sessionId = session.id;

      // Connect to OpenAI's WebSocket server
      logger.info('Connecting to OpenAI Realtime WebSocket server', {
        sessionId: session.id,
        clientId,
        category: 'openai',
        source: 'openai'
      });
      
      const openaiSocket = new WebSocket('wss://api.openai.com/v1/realtime/ws');
      
      // Store the OpenAI WebSocket connection
      this.openaiConnections.set(session.id, openaiSocket);

      // Set up event handlers for the OpenAI WebSocket
      openaiSocket.on('open', () => {
        logger.info('OpenAI WebSocket connection opened, authenticating session', {
          sessionId: session.id,
          clientId,
          category: 'openai',
          source: 'openai'
        });
        
        // Send authentication message to OpenAI
        openaiSocket.send(JSON.stringify({
          type: 'session.authenticate',
          session_token: session.client_secret.value
        }));

        // Notify the client that the session is ready
        client.socket.send(JSON.stringify({
          type: 'session_created',
          sessionId: session.id,
          voice: session.voice,
          message: 'Session created successfully'
        }));

        logger.info('Connected to OpenAI Realtime WebSocket', {
          sessionId: session.id,
          clientId,
          category: 'openai',
          source: 'openai'
        });
      });

      openaiSocket.on('message', (message) => {
        try {
          // Log incoming messages from OpenAI (without logging full audio data which would be too large)
          const messageString = message.toString();
          const parsedMessage = JSON.parse(messageString);
          
          // Create a safe copy for logging that doesn't include potentially large audio data
          const logMessage = { ...parsedMessage };
          if (logMessage.type === 'audio') {
            logMessage.audio = '[AUDIO_DATA]'; // Replace audio data with placeholder for logging
          }
          
          logger.info('Received message from OpenAI', {
            type: parsedMessage.type,
            messageType: logMessage.type,
            sessionId: session.id,
            clientId,
            category: 'openai',
            source: 'openai'
          });
          
          // Forward OpenAI's messages to the client
          if (client.socket.readyState === WebSocket.OPEN) {
            client.socket.send(messageString);
          }
        } catch (error) {
          logger.error('Error handling message from OpenAI', {
            error,
            sessionId: session.id,
            clientId,
            category: 'openai',
            source: 'openai'
          });
        }
      });

      openaiSocket.on('close', () => {
        logger.info('OpenAI WebSocket connection closed', {
          sessionId: session.id,
          clientId,
          category: 'openai',
          source: 'openai'
        });

        // Notify the client
        if (client.socket.readyState === WebSocket.OPEN) {
          client.socket.send(JSON.stringify({
            type: 'session_ended',
            sessionId: session.id,
            message: 'Session ended by OpenAI'
          }));
        }

        // Clean up
        this.openaiConnections.delete(session.id);
        if (client.sessionId === session.id) {
          client.sessionId = undefined;
        }
      });

      openaiSocket.on('error', (error) => {
        logger.error('Error with OpenAI WebSocket connection', {
          error,
          sessionId: session.id,
          clientId,
          category: 'openai',
          source: 'openai'
        });

        // Notify the client
        if (client.socket.readyState === WebSocket.OPEN) {
          client.socket.send(JSON.stringify({
            type: 'error',
            message: 'Connection error with OpenAI',
            details: error.message
          }));
        }
      });

    } catch (error) {
      logger.error('Failed to create OpenAI Realtime session', {
        error,
        clientId,
        category: 'openai',
        source: 'openai'
      });

      // Notify the client of the error
      client.socket.send(JSON.stringify({
        type: 'error',
        message: 'Failed to create session',
        details: error.message
      }));
    }
  }

  /**
   * Handle audio data from a client
   */
  private async handleAudioData(clientId: string, data: any): Promise<void> {
    const client = this.clients.get(clientId);
    
    if (!client || !client.sessionId) {
      logger.warn('Received audio data for client without active session', {
        clientId,
        hasClient: !!client,
        category: 'openai',
        source: 'openai'
      });
      return;
    }

    const openaiSocket = this.openaiConnections.get(client.sessionId);
    
    if (!openaiSocket || openaiSocket.readyState !== WebSocket.OPEN) {
      logger.warn('No active OpenAI connection for audio data', {
        clientId,
        sessionId: client.sessionId,
        hasOpenAISocket: !!openaiSocket,
        openAISocketState: openaiSocket ? openaiSocket.readyState : 'null',
        category: 'openai',
        source: 'openai'
      });
      
      client.socket.send(JSON.stringify({
        type: 'error',
        message: 'No active OpenAI connection'
      }));
      return;
    }

    try {
      // Log audio data receipt (without the actual audio data which is too large)
      logger.info('Forwarding audio data to OpenAI', {
        clientId,
        sessionId: client.sessionId,
        timestamp: data.timestamp || Date.now(),
        audioDataSize: data.audio ? data.audio.length : 0,
        category: 'openai',
        source: 'openai'
      });
      
      // Forward the audio data to OpenAI
      openaiSocket.send(JSON.stringify({
        type: 'audio',
        audio: data.audio,
        timestamp: data.timestamp || Date.now()
      }));
    } catch (error) {
      logger.error('Failed to send audio data to OpenAI', {
        error,
        clientId,
        sessionId: client.sessionId,
        category: 'openai',
        source: 'openai'
      });
    }
  }

  /**
   * Handle text input from a client
   */
  private async handleTextInput(clientId: string, data: any): Promise<void> {
    const client = this.clients.get(clientId);
    
    if (!client || !client.sessionId) {
      return;
    }

    const openaiSocket = this.openaiConnections.get(client.sessionId);
    
    if (!openaiSocket || openaiSocket.readyState !== WebSocket.OPEN) {
      client.socket.send(JSON.stringify({
        type: 'error',
        message: 'No active OpenAI connection'
      }));
      return;
    }

    try {
      // Forward the text input to OpenAI
      openaiSocket.send(JSON.stringify({
        type: 'message',
        content: data.text,
        role: 'user'
      }));
    } catch (error) {
      logger.error('Failed to send text input to OpenAI', {
        error,
        clientId,
        sessionId: client.sessionId,
        category: 'openai',
        source: 'openai'
      });
    }
  }

  /**
   * Handle a request to end the session
   */
  private async handleEndSession(clientId: string): Promise<void> {
    const client = this.clients.get(clientId);
    
    if (!client || !client.sessionId) {
      return;
    }

    const openaiSocket = this.openaiConnections.get(client.sessionId);
    
    if (openaiSocket && openaiSocket.readyState === WebSocket.OPEN) {
      openaiSocket.close();
    }

    this.openaiConnections.delete(client.sessionId);
    client.sessionId = undefined;

    client.socket.send(JSON.stringify({
      type: 'session_ended',
      message: 'Session ended by client'
    }));

    logger.info('Session ended by client', {
      clientId,
      category: 'openai',
      source: 'openai'
    });
  }
}

// Create and export a singleton instance
export const openAIRealtimeWebSocketService = new OpenAIRealtimeWebSocketService();