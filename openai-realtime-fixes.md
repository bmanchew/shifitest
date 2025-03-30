# OpenAI Realtime Voice AI Fixes

## Implementation Steps

Follow these steps to fix the OpenAI Realtime Voice AI implementation:

### Step 1: Update OpenAI Realtime Service

Fix the model name and improve error handling in the OpenAI Realtime Service:

1. Open `server/services/openaiRealtime.ts`
2. Update the default model in the constructor:
   ```typescript
   private defaultModel: string = 'gpt-4o-realtime-preview';
   ```
3. Enhance the `createRealtimeSession` method to include better error reporting:
   ```typescript
   public async createRealtimeSession(options: RealtimeSessionOptions = {}): Promise<RealtimeSession> {
     try {
       // Existing validation code...

       logger.info({
         message: 'Creating OpenAI Realtime session',
         category: 'realtime',
         source: 'openai',
         metadata: {
           model: requestOptions.model,
           voice: requestOptions.voice
         }
       });

       const response = await axios.post(
         `${this.baseUrl}/realtime/sessions`,
         requestOptions,
         {
           headers: {
             'Content-Type': 'application/json',
             'Authorization': `Bearer ${this.apiKey}`
           }
         }
       );

       // Log successful response with more details
       logger.info({
         message: 'Created OpenAI Realtime session successfully',
         category: 'realtime',
         source: 'openai',
         metadata: {
           sessionId: response.data.id,
           model: response.data.model,
           voice: response.data.voice
         }
       });

       return response.data;
     } catch (error) {
       // Enhanced error logging
       if (axios.isAxiosError(error)) {
         logger.error({
           message: `Failed to create OpenAI Realtime session: ${error.message}`,
           category: 'realtime',
           source: 'openai',
           metadata: {
             status: error.response?.status,
             statusText: error.response?.statusText,
             data: error.response?.data,
             url: `${this.baseUrl}/realtime/sessions`,
             model: options.model || this.defaultModel
           }
         });
       } else {
         logger.error({
           message: `Failed to create OpenAI Realtime session: ${error instanceof Error ? error.message : String(error)}`,
           category: 'realtime',
           source: 'openai',
           metadata: {
             errorType: error instanceof Error ? error.name : typeof error
           }
         });
       }
       throw error;
     }
   }
   ```

### Step 2: Fix WebSocket Service

Update the WebSocket service to properly handle session creation:

1. Open `server/services/openaiRealtimeWebSocket.fixed.ts`
2. Update the `handleCreateSession` method with retry logic:
   ```typescript
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
       
       // Rest of existing code...
     } catch (error) {
       // Existing error handling...
     } finally {
       // Always mark session as no longer initializing, regardless of success/failure
       client.initializingSession = false;
     }
   }
   ```

3. Improve the reconnection logic:
   ```typescript
   private async reconnectToOpenAI(client: ClientConnection): Promise<void> {
     // Only attempt reconnection if we have a session ID
     if (!client.sessionId) {
       logger.warn({
         message: `Cannot reconnect client without sessionId: ${client.id}`,
         category: 'realtime',
         source: 'openai',
         metadata: { clientId: client.id }
       });
       return;
     }
     
     // Check if already reconnecting to avoid duplicate attempts
     if (client.openaiSocket && client.openaiSocket.readyState === WS_CONNECTING) {
       logger.info({
         message: `OpenAI reconnection already in progress for client: ${client.id}`,
         category: 'realtime',
         source: 'openai',
         metadata: { clientId: client.id }
       });
       return;
     }
     
     try {
       logger.info({
         message: `Attempting to reconnect OpenAI WebSocket for client: ${client.id}`,
         category: 'realtime',
         source: 'openai',
         metadata: { 
           clientId: client.id, 
           sessionId: client.sessionId 
         }
       });
       
       // Construct WebSocket URL using the session ID
       const sessionUrl = `wss://api.openai.com/v1/realtime/${client.sessionId}`;
       
       // Connect to OpenAI WebSocket
       await this.connectToOpenAI(client, sessionUrl, client.sessionId);
       
       logger.info({
         message: `Successfully reconnected OpenAI WebSocket for client: ${client.id}`,
         category: 'realtime',
         source: 'openai',
         metadata: { 
           clientId: client.id, 
           sessionId: client.sessionId 
         }
       });
     } catch (error) {
       logger.error({
         message: `Failed to reconnect OpenAI WebSocket for client: ${client.id}`,
         category: 'realtime',
         source: 'openai',
         metadata: { 
           clientId: client.id, 
           error: error instanceof Error ? error.stack : String(error) 
         }
       });
       
       // Notify client about reconnection failure
       if (client.socket && client.socket.readyState === WS_OPEN) {
         client.socket.send(JSON.stringify({
           type: 'error',
           message: 'Failed to reconnect to OpenAI',
           code: 'RECONNECT_FAILED',
           timestamp: new Date().toISOString()
         }));
       }
     }
   }
   ```

### Step 3: Improve Client-Side Implementation

Update the React component for better error handling:

1. Open `client/src/components/customer/RealtimeAudioSherpa.tsx`
2. Enhance the WebSocket message handler:
   ```tsx
   useEffect(() => {
     if (socket) {
       socket.onmessage = (event: MessageEvent) => {
         // Handle text messages (JSON)
         if (typeof event.data === 'string') {
           try {
             const data = JSON.parse(event.data);
             console.log('📩 Received message:', data);
             
             if (data.type === 'error') {
               console.error('⚠️ Error from server:', data);
               
               // Handle specific error codes
               if (data.code === 'NO_SESSION_EXISTS') {
                 console.log('📝 No session exists. Attempting to create new session...');
                 
                 // Retry session creation with delay if connection is still open
                 if (socket.readyState === WebSocket.OPEN && conversationState !== 'error') {
                   retryCreateSession();
                 }
               }
               
               // Handle fatal errors that should show UI feedback
               if (data.code === 'SESSION_INITIALIZATION_FAILED' || data.code === 'RECONNECT_FAILED') {
                 setConversationState('error');
                 toast({
                   title: 'Connection Error',
                   description: 'Unable to establish AI connection. Please try again later.',
                   variant: 'destructive',
                   duration: 5000
                 });
               }
             }
             
             // Handle session created confirmation
             if (data.type === 'session_created') {
               console.log('✅ Session created successfully:', data.sessionId);
               openaiSessionReadyRef.current = true;
               setConversationState('connected');
               addMessage({
                 id: uuidv4(),
                 role: 'assistant',
                 content: "Hi, I'm your Financial Sherpa. How can I help you today?",
                 timestamp: Date.now()
               });
             }
             
             // Rest of existing message handling...
           } catch (error) {
             console.error('Error parsing message:', error);
           }
         } else {
           // Handle binary messages (likely audio)
           // Existing binary handling...
         }
       };
     }
   }, [socket, conversationState]);
   
   // Add a helper function to retry session creation
   const retryCreateSession = useCallback(() => {
     if (!socket || socket.readyState !== WebSocket.OPEN) return;
     
     setTimeout(() => {
       const createSessionPayload = {
         type: 'create_session',
         voice: 'alloy',
         instructions: `You are the Financial Sherpa, a friendly and knowledgeable AI assistant for ${config.customerName || customerName || 'the customer'}...`,
         customerId: customerId || 0
       };
       
       console.log('📤 Retrying session creation...');
       socket.send(JSON.stringify(createSessionPayload));
     }, 1000);
   }, [socket, customerId, customerName, config]);
   ```

### Step 4: Testing Approach

Create a simple test script to verify the API integration:

1. Try the `test-openai-realtime-directly.js` script first to verify API key and basic functionality
2. Test the WebSocket session creation with `test-financial-sherpa-websocket.mjs`
3. Test the full integration in the browser UI

If issues persist, follow these debugging steps:

1. Check server logs for OpenAI API errors
2. Verify WebSocket connection status in browser console
3. Try different model parameters in the session creation
4. Ensure all environment variables are correctly set