/**
 * OpenAI Realtime WebSocket service
 * 
 * This service creates a WebSocket server that acts as a bridge between
 * the browser client and OpenAI's Realtime API WebSocket server.
 */

import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './logger';
import { openAIRealtimeService } from './openaiRealtime';

// WebSocket constants
const WS_CONNECTING = 0;
const WS_OPEN = 1;
const WS_CLOSING = 2;
const WS_CLOSED = 3;

interface RealtimeWebSocketOptions {
  server: any; // Express server or HTTP/HTTPS server
  path?: string;
}

class OpenAIRealtimeWebSocketService {
  private wss: any = null;
  private clients: Map<string, {
    socket: any;
    sessionId?: string;
    userId?: number;
    role?: string;
  }> = new Map();
  private openaiConnections: Map<string, any> = new Map();
  private connectionTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private apiKey: string;
  
  constructor() {
    // Load OpenAI API key from environment
    this.apiKey = process.env.OPENAI_API_KEY || '';
    
    if (!this.apiKey) {
      console.error('OpenAI API key is missing');
    }
  }

  /**
   * Initialize the WebSocket server
   */
  public initialize(options: RealtimeWebSocketOptions): boolean {
    try {
      if (this.wss) {
        console.warn('WebSocket server already initialized');
        return true;
      }

      const { server, path = '/api/openai/realtime' } = options;

      // Use more explicit configuration
      this.wss = new WebSocketServer({ 
        server,
        path,
        perMessageDeflate: false,
        clientTracking: true,
        verifyClient: (info, callback) => {
          // Log the connection attempt
          console.info('WebSocket connection attempt:', {
            origin: info.origin,
            secure: info.secure,
            path: info.req.url
          });
          
          // Always accept the connection for now
          callback(true);
        }
      });

      // Log when server is listening
      this.wss.on('listening', () => {
        console.info('WebSocket server is listening:', {
          path,
          clients: this.wss?.clients?.size || 0
        });
      });

      // Handle errors at the server level
      this.wss.on('error', (error: any) => {
        console.error('WebSocket server error:', error, { path });
      });

      // Handle connections
      this.wss.on('connection', this.handleConnection.bind(this));

      console.info('OpenAI Realtime WebSocket server initialized:', { path });

      return true;
    } catch (error: any) {
      console.error('Failed to initialize WebSocket server:', error);
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

    console.info('Client connected to OpenAI Realtime WebSocket:', {
      clientId,
      userId,
      role
    });

    // Set up event handlers for the client socket
    clientSocket.on('message', async (message) => {
      try {
        // Check if the message is binary (for audio data)
        if (message instanceof Buffer || message instanceof ArrayBuffer) {
          // Handle binary audio data
          const client = this.clients.get(clientId);
          if (client && client.sessionId) {
            const openaiSocket = this.openaiConnections.get(client.sessionId);
            if (openaiSocket && openaiSocket.readyState === 1) { // 1 = OPEN
              // Forward binary audio data directly to OpenAI
              // Log size information - handle both Buffer and ArrayBuffer types
              const size = Buffer.isBuffer(message) 
                ? message.length 
                : (message as ArrayBuffer).byteLength;
              
              console.log(`Received binary audio data from client ${clientId}, size: ${size} bytes`);
              openaiSocket.send(message);
            } else {
              console.warn(`Received binary audio data from client ${clientId}, but OpenAI connection is not ready`);
              client.socket.send(JSON.stringify({
                type: 'error',
                message: 'No active OpenAI connection for audio data'
              }));
            }
          } else {
            console.warn(`Received binary audio data from client ${clientId}, but no session exists`);
          }
        } else {
          // Handle JSON message
          const data = JSON.parse(message.toString());
          await this.handleClientMessage(clientId, data);
        }
      } catch (error: any) {
        console.error('Error handling client message:', error, { clientId });
      }
    });

    clientSocket.on('close', () => {
      this.handleClientDisconnect(clientId);
    });

    clientSocket.on('error', (error: any) => {
      console.error('WebSocket error with client:', error, { clientId });
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
      console.error(`Client not found for message: ${clientId}`);
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
        
      case 'end_of_stream':
        await this.handleEndOfStream(clientId);
        break;
      
      case 'text_input':
        await this.handleTextInput(clientId, data);
        break;
      
      case 'end_session':
        await this.handleEndSession(clientId);
        break;
      
      default:
        console.warn(`Unknown message type from client: ${type} (clientId: ${clientId})`);
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
      if (openaiSocket && openaiSocket.readyState === 1) { // 1 = OPEN
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

    console.info(`Client disconnected from WebSocket: ${clientId}`);
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

      console.info(`Creating OpenAI Realtime session with options: voice=${sessionOptions.voice}, temperature=${sessionOptions.temperature} for client ${clientId}`);
      
      const session = await openAIRealtimeService.createRealtimeSession(sessionOptions);
      
      console.info(`Successfully created OpenAI Realtime session: ID=${session.id}, model=${session.model}, voice=${session.voice} for client ${clientId}`);
      
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
        console.log(`Connecting to OpenAI's WebSocket with session ID: ${session.id}`);
        
        // Use both URL parameters and headers for authentication
        // to ensure compatibility with different versions of the API
        
        // Include the API key in URL and also in Authorization header
        const wsUrl = `wss://api.openai.com/v1/realtime?intent=transcription`;
        console.log(`Connecting to OpenAI Realtime API with URL: ${wsUrl} (with Authentication header)`);
        
        const openaiSocket = new WebSocket(wsUrl, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'OpenAI-Beta': 'realtime=v1',
            'User-Agent': 'ShiFi Financial/1.0.0 Node.js WebSocket Client'
          }
        });
        
        // Store the OpenAI WebSocket connection
        this.openaiConnections.set(session.id, openaiSocket);
        
        // Set up a timeout to detect connection issues
        const timeoutId = setTimeout(() => {
          if (openaiSocket.readyState !== 1) { // 1 = OPEN
            console.error(`OpenAI WebSocket connection timed out for session ${session.id}`);
            
            try {
              openaiSocket.close();
            } catch (err) {
              console.error('Error closing timed-out OpenAI socket:', err);
            }
            
            // Notify the client about the timeout
            if (client.socket.readyState === 1) { // 1 = OPEN
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
          
          // Initialize a session update with authentication
          // Use the client_secret from the session as the authentication token in the URL
          // No need to send an explicit auth message as authentication is already
          // done via the Authorization header when connecting
          
          // Use transcription_session.update for transcription intent
          // Specify audio format explicitly as pcm16 (16-bit PCM at 24kHz sample rate)
          const sessionUpdatePayload = {
            type: 'transcription_session.update',
            event_id: `event_${uuidv4()}`,
            session: {
              input_audio_format: 'pcm16',
              turn_detection: {
                type: 'server_vad',
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: 500,
                create_response: true
              }
            }
          };
          console.log(`Sending transcription_session.update payload to OpenAI for session ${session.id}`);
          openaiSocket.send(JSON.stringify(sessionUpdatePayload));

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
            
            // Log received messages for debugging
            console.log(`Received message from OpenAI for session ${session.id}:`, parsedMessage);
            
            // Handle auth.ok message explicitly
            if (parsedMessage.type === 'auth.ok') {
              console.log(`Successfully authenticated with OpenAI for session ${session.id}`);
            }
            
            // Handle auth.error message explicitly
            if (parsedMessage.type === 'auth.error') {
              console.error(`Authentication error with OpenAI for session ${session.id}:`, parsedMessage);
            }
            
            // Forward OpenAI's messages to the client
            if (client.socket.readyState === 1) { // 1 = OPEN
              client.socket.send(messageString);
            }
          } catch (error: any) {
            console.error('Error handling message from OpenAI:', error);
          }
        });

        // Handle connection close
        openaiSocket.on('close', () => {
          console.log(`OpenAI WebSocket connection closed for session ${session.id}`);
          
          // Notify the client
          if (client.socket.readyState === 1) { // 1 = OPEN
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
          if (client.socket.readyState === 1) { // 1 = OPEN
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
    
    if (!openaiSocket || openaiSocket.readyState !== 1) { // 1 = OPEN
      client.socket.send(JSON.stringify({
        type: 'error',
        message: 'No active OpenAI connection'
      }));
      return;
    }

    try {
      // Check if data is in binary format (ArrayBuffer or Buffer)
      if (data.audio_binary) {
        // Send binary audio data directly (without JSON encoding)
        // This is the preferred method for audio data according to the OpenAI docs
        openaiSocket.send(data.audio_binary);
      } else if (data.audio) {
        // Legacy format - JSON with base64 encoded audio data
        // Forward the audio data to OpenAI using the input_audio_buffer.append event
        openaiSocket.send(JSON.stringify({
          type: 'input_audio_buffer.append',
          event_id: `event_${uuidv4()}`,
          data: data.audio,
          timestamp: data.timestamp || Date.now()
        }));
      } else {
        console.warn(`Received audio data without audio content from client ${clientId}`);
      }
    } catch (error: any) {
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
    
    if (!openaiSocket || openaiSocket.readyState !== 1) { // 1 = OPEN
      client.socket.send(JSON.stringify({
        type: 'error',
        message: 'No active OpenAI connection'
      }));
      return;
    }

    try {
      // Forward the text input to OpenAI using the conversation.item.create event
      openaiSocket.send(JSON.stringify({
        type: 'conversation.item.create',
        event_id: `event_${uuidv4()}`,
        content: {
          type: 'text',
          text: data.text
        },
        role: 'user'
      }));
    } catch (error: any) {
      console.error('Failed to send text input to OpenAI:', error);
    }
  }

  /**
   * Handle end of stream (audio streaming ended)
   */
  private async handleEndOfStream(clientId: string): Promise<void> {
    const client = this.clients.get(clientId);
    
    if (!client || !client.sessionId) {
      return;
    }

    const openaiSocket = this.openaiConnections.get(client.sessionId);
    
    if (!openaiSocket || openaiSocket.readyState !== 1) { // 1 = OPEN
      client.socket.send(JSON.stringify({
        type: 'error',
        message: 'No active OpenAI connection'
      }));
      return;
    }

    try {
      // Send end_of_stream message to OpenAI
      openaiSocket.send(JSON.stringify({
        type: 'end_of_stream',
        event_id: `event_${uuidv4()}`
      }));
      
      console.log(`Sent end_of_stream message to OpenAI for session ${client.sessionId}`);
    } catch (error: any) {
      console.error('Failed to send end_of_stream message to OpenAI:', error);
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
    
    if (openaiSocket && openaiSocket.readyState === 1) { // 1 = OPEN
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