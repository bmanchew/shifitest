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
          
          // Check if this client has an active session
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
              // Connection exists but isn't ready
              console.warn(`Received binary audio data from client ${clientId}, but OpenAI connection is not ready`);
              
              // Send a clear error message back to the client
              client.socket.send(JSON.stringify({
                type: 'error',
                message: 'OpenAI connection is initializing. Please wait for the AI Ready notification before speaking.',
                code: 'OPENAI_CONNECTION_NOT_READY',
                timestamp: new Date().toISOString()
              }));
            }
          } else {
            // No session exists for this client
            console.warn(`Received binary audio data from client ${clientId}, but no session exists`);
            
            // If we have a client socket, send an error message
            if (client && client.socket && client.socket.readyState === WS_OPEN) {
              // Get client status for detailed error reporting
              const hasActiveConnection = !!client.sessionId;
              const connectionTime = new Date().toISOString();
              
              client.socket.send(JSON.stringify({
                type: 'error',
                message: 'System is still initializing. Please wait for the AI Ready notification before speaking.',
                code: 'NO_SESSION_EXISTS',
                timestamp: connectionTime,
                details: {
                  hasActiveConnection,
                  connectionTime,
                  status: 'initializing'
                }
              }));
            }
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
        // First force-send a message to the client indicating we're initializing a session
        // This ensures the client UI shows a proper loading state
        const initialClient = this.clients.get(clientId);
        if (initialClient && initialClient.socket.readyState === 1) {
          console.log(`✅ Sending immediate connection acknowledgment to client ${clientId}`);
          initialClient.socket.send(JSON.stringify({
            type: 'server_event',
            event: 'openai_connection_established',
            message: 'Connection to OpenAI being established',
            timestamp: Date.now()
          }));
        }
        
        // Now handle the actual session creation
        await this.handleCreateSession(clientId, data);
        
        // We'll use a guaranteed callback approach to handle session initialization
        // Rather than multiple force-send approaches that might cause conflicts
        const initializationTimeout = setTimeout(() => {
          const client = this.clients.get(clientId);
          // Check we still have a client and socket is open
          if (client && client.socket.readyState === 1) {
            console.log(`🕐 Checking initialization status for client ${clientId} after timeout`);
            
            // If the client has a session but might be stuck in initialization
            if (client.sessionId) {
              console.log(`⚠️ Client ${clientId} has session ${client.sessionId} but might be stuck in initialization`);
              
              // Send a server event to check status and potentially trigger UI updates
              client.socket.send(JSON.stringify({
                type: 'server_event',
                event: 'openai_initialization_check',
                message: 'Checking OpenAI initialization status',
                timestamp: Date.now()
              }));
              
              // Note: We'll rely on the regular initialization events in the WebSocket to complete initialization
              // rather than forcing duplicate events here that might cause state conflicts
            }
          }
        }, 5000); // 5 seconds wait to see if normal initialization completes
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
    console.log(`🔄 Starting session creation for client ${clientId}`);
    const client = this.clients.get(clientId);
    
    if (!client) {
      console.error(`❌ Client ${clientId} not found for session creation`);
      return;
    }
    
    // Force remove any previous session to avoid conflicts
    if (client.sessionId && this.openaiConnections.has(client.sessionId)) {
      console.log(`⚠️ Removing previous session ${client.sessionId} for client ${clientId}`);
      const oldSocket = this.openaiConnections.get(client.sessionId);
      if (oldSocket && oldSocket.readyState !== 3) { // Not CLOSED
        oldSocket.close();
      }
      this.openaiConnections.delete(client.sessionId);
      
      // Clear any existing timeouts
      if (this.connectionTimeouts.has(client.sessionId)) {
        clearTimeout(this.connectionTimeouts.get(client.sessionId)!);
        this.connectionTimeouts.delete(client.sessionId);
      }
    }

    try {
      // Create a session with OpenAI
      const sessionOptions = {
        voice: data.voice || 'alloy',
        instructions: data.instructions,
        temperature: data.temperature || 0.7
      };

      console.info(`Creating OpenAI Realtime session with voice=${sessionOptions.voice}, temperature=${sessionOptions.temperature} for client ${clientId} (instructions redacted for privacy)`);
      
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
        
        // OpenAI Realtime API requires authentication in URL, not just headers
        // This is a critical fix for the WebSocket connection issues

        // Include the API key in URL as required by OpenAI spec
        const wsUrl = `wss://api.openai.com/v1/realtime?intent=transcription&authorization=Bearer%20${this.apiKey}`;
        console.log(`Connecting to OpenAI Realtime API with URL: ${wsUrl} (with authentication in URL)`);
        
        // Create WebSocket without authentication headers since auth is in URL
        const openaiSocket = new WebSocket(wsUrl);
        
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
          
          // Set a safety timeout to force-send transcription_session.created if not received from OpenAI
          // This ensures the client UI doesn't get stuck in initializing state
          // Using a shorter timeout to improve user experience
          const SESSION_READY_TIMEOUT = 3000; // 3 seconds (reduced from 5s)
          const readyTimeout = setTimeout(() => {
            console.log(`⏱️ OpenAI session initialization timeout reached for ${session.id}, force-sending ready event`);
            if (client.socket.readyState === 1) {
              // First send server event
              client.socket.send(JSON.stringify({
                type: 'server_event',
                event: 'openai_session_created',
                message: 'OpenAI session is ready for audio (timeout)',
                timestamp: Date.now()
              }));
              
              // Then send the transcription_session.created event that client is waiting for
              client.socket.send(JSON.stringify({
                type: 'transcription_session.created', // Use the exact same event type expected by client
                sessionId: session.id,
                timestamp: Date.now(),
                message: 'OpenAI transcription session is now ready for audio (timeout triggered)'
              }));
              
              console.log(`✅ Force-sent session ready events to client for session ${session.id}`);
            }
          }, SESSION_READY_TIMEOUT);
          
          // Store the timeout so we can clear it if transcription_session.created is received normally
          this.connectionTimeouts.set(session.id, readyTimeout);
          
          // Initialize a session with the correct 'create' event
          // This is critical for the OpenAI Realtime API to work properly
          // Based on OpenAI's documentation, we need to send 'transcription_session.create'
          
          // Use transcription_session.create to initialize the session (not update)
          // Specify audio format explicitly as pcm16 (16-bit PCM at 24kHz sample rate)
          const sessionCreatePayload = {
            type: 'transcription_session.create', // FIXED: Changed from 'update' to 'create'
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
          console.log(`Sending transcription_session.create payload to OpenAI for session ${session.id}`);
          openaiSocket.send(JSON.stringify(sessionCreatePayload));

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
            
            // Log received messages for debugging (redact content for privacy)
            console.log(`Received message from OpenAI for session ${session.id} of type: ${parsedMessage.type || 'unknown'} (content redacted for privacy)`);
            
            // Track critical session events
            if (parsedMessage.type === 'transcription_session.created') {
              console.log(`✅ Transcription session CREATED for session ${session.id} at ${new Date().toISOString()}`);
              
              // Clear any existing ready timeout since we received the real event
              if (this.connectionTimeouts.has(session.id)) {
                console.log(`Clearing ready timeout for session ${session.id} as real event was received`);
                clearTimeout(this.connectionTimeouts.get(session.id)!);
                this.connectionTimeouts.delete(session.id);
              }
              
              // Send a special event to the client that the session is fully initialized
              if (client.socket.readyState === 1) {
                client.socket.send(JSON.stringify({
                  type: 'server_event',
                  event: 'openai_session_created',
                  sessionId: session.id,
                  timestamp: Date.now(),
                  message: 'OpenAI transcription session is now ready for audio'
                }));
                
                // Also send the transcription_session.created event directly
                // This ensures the client receives the exact event type it expects
                client.socket.send(JSON.stringify({
                  type: 'transcription_session.created',
                  sessionId: session.id,
                  timestamp: Date.now()
                }));
              }
            }
            
            // Handle auth.ok message explicitly
            if (parsedMessage.type === 'auth.ok') {
              console.log(`Successfully authenticated with OpenAI for session ${session.id}`);
              
              // Notify client of successful authentication
              if (client.socket.readyState === 1) {
                client.socket.send(JSON.stringify({
                  type: 'session_authenticate_success',
                  sessionId: session.id,
                  timestamp: Date.now()
                }));
              }
            }
            
            // Handle auth.error message explicitly
            if (parsedMessage.type === 'auth.error') {
              console.error(`Authentication error with OpenAI for session ${session.id}:`, parsedMessage);
              
              // Notify client of authentication failure
              if (client.socket.readyState === 1) {
                client.socket.send(JSON.stringify({
                  type: 'error',
                  error: 'authentication_failed',
                  message: 'Failed to authenticate with OpenAI',
                  details: parsedMessage.error || 'Unknown authentication error'
                }));
              }
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