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
  private connectionTimeouts: Map<string, NodeJS.Timeout> = new Map();
  
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
      
      // Clear any timeouts associated with this session
      if (this.connectionTimeouts.has(client.sessionId)) {
        clearTimeout(this.connectionTimeouts.get(client.sessionId)!);
        this.connectionTimeouts.delete(client.sessionId);
      }
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

      // Make sure we don't have an old connection
      if (this.openaiConnections.has(session.id)) {
        try {
          const oldConnection = this.openaiConnections.get(session.id);
          if (oldConnection) {
            oldConnection.close();
          }
          this.openaiConnections.delete(session.id);
        } catch (closeError) {
          console.error('Error closing existing WebSocket:', closeError);
        }
      }
      
      // Create a new WebSocket connection to OpenAI
      try {
        const apiKey = process.env.OPENAI_API_KEY || '';
        const openaiSocket = new WebSocket('wss://api.openai.com/v1/realtime/ws');
        
        // Store the OpenAI WebSocket connection
        this.openaiConnections.set(session.id, openaiSocket);
        
        // Set up a timeout to detect connection issues
        const timeoutId = setTimeout(() => {
          if (openaiSocket.readyState !== WebSocket.OPEN) {
            console.error(`OpenAI WebSocket connection timed out for session ${session.id}`);
            
            try {
              openaiSocket.close();
            } catch (err) {
              console.error('Error closing timed-out OpenAI socket:', err);
            }
            
            // Notify the client about the timeout
            if (client.socket.readyState === WebSocket.OPEN) {
              client.socket.send(JSON.stringify({
                type: 'error',
                message: 'Connection to OpenAI timed out. Please try again later.',
                details: 'The connection to the OpenAI server timed out after 15 seconds.'
              }));
            }
            
            // Clean up
            this.openaiConnections.delete(session.id);
          }
        }, 15000);
        
        // Store the timeout ID for later cleanup
        this.connectionTimeouts.set(session.id, timeoutId);
        
        // Handle successful connection
        openaiSocket.on('open', () => {
          console.log(`OpenAI WebSocket connection opened for session ${session.id}`);
          
          // Clear the connection timeout
          if (this.connectionTimeouts.has(session.id)) {
            clearTimeout(this.connectionTimeouts.get(session.id)!);
            this.connectionTimeouts.delete(session.id);
          }
          
          // Send authentication message to OpenAI
          const authPayload = {
            type: 'session.authenticate',
            session_token: session.client_secret.value
          };
          openaiSocket.send(JSON.stringify(authPayload));

          // Notify the client that the session is ready
          client.socket.send(JSON.stringify({
            type: 'session_created',
            sessionId: session.id,
            voice: session.voice,
            message: 'Session created successfully'
          }));
        });

        // Handle messages from OpenAI
        openaiSocket.on('message', (message) => {
          try {
            const messageString = message.toString();
            const parsedMessage = JSON.parse(messageString);
            
            // Forward OpenAI's messages to the client
            if (client.socket.readyState === WebSocket.OPEN) {
              client.socket.send(messageString);
            }
          } catch (error) {
            console.error('Error handling message from OpenAI:', error);
          }
        });

        // Handle connection close
        openaiSocket.on('close', () => {
          console.log(`OpenAI WebSocket connection closed for session ${session.id}`);
          
          // Notify the client
          if (client.socket.readyState === WebSocket.OPEN) {
            client.socket.send(JSON.stringify({
              type: 'session_ended',
              message: 'Session ended by OpenAI'
            }));
          }
          
          // Clean up
          this.openaiConnections.delete(session.id);
          if (this.connectionTimeouts.has(session.id)) {
            clearTimeout(this.connectionTimeouts.get(session.id)!);
            this.connectionTimeouts.delete(session.id);
          }
        });

        // Handle errors
        openaiSocket.on('error', (err) => {
          console.error(`OpenAI WebSocket error for session ${session.id}:`, err);
          
          // Notify the client
          if (client.socket.readyState === WebSocket.OPEN) {
            client.socket.send(JSON.stringify({
              type: 'error',
              message: 'Connection error with OpenAI',
              details: err.message
            }));
          }
        });
      } catch (socketError: any) {
        console.error('Failed to create OpenAI WebSocket:', socketError);
        
        // Notify the client
        client.socket.send(JSON.stringify({
          type: 'error',
          message: 'Failed to create OpenAI WebSocket connection',
          details: socketError.message
        }));
      }
    } catch (error: any) {
      console.error('Failed to create OpenAI Realtime session:', error);
      
      // Notify the client
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
      // Forward the audio data to OpenAI
      openaiSocket.send(JSON.stringify({
        type: 'audio',
        audio: data.audio,
        timestamp: data.timestamp || Date.now()
      }));
    } catch (error) {
      console.error('Failed to send audio data to OpenAI:', error);
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
      console.error('Failed to send text input to OpenAI:', error);
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

    // Clean up
    this.openaiConnections.delete(client.sessionId);
    if (this.connectionTimeouts.has(client.sessionId)) {
      clearTimeout(this.connectionTimeouts.get(client.sessionId)!);
      this.connectionTimeouts.delete(client.sessionId);
    }
    client.sessionId = undefined;

    client.socket.send(JSON.stringify({
      type: 'session_ended',
      message: 'Session ended by client'
    }));
  }
}

// Create and export a singleton instance
export const openAIRealtimeWebSocketService = new OpenAIRealtimeWebSocketService();