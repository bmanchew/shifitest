# OpenAI Realtime API Implementation Solutions

## Issue Summary
We've identified several issues with our OpenAI Realtime Voice AI implementation:

1. Session creation is failing despite a valid API key
2. Client-side error handling needs improvement
3. WebSocket connection management has race conditions

## Recommended Fixes

### 1. Session Creation Enhancement

```typescript
// In openaiRealtimeWebSocket.fixed.ts - handleCreateSession method
private async handleCreateSession(client: ClientConnection, data: any): Promise<void> {
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
  
  // Existing code...
  
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
    
    // Rest of the existing code...
}
```

### 2. Improved Client-Side Error Handling

```tsx
// In RealtimeAudioSherpa.tsx
useEffect(() => {
  if (socket) {
    socket.onmessage = (event: MessageEvent) => {
      // Handle text messages (JSON)
      try {
        const data = JSON.parse(event.data);
        console.log('📩 Received message:', data);
        
        if (data.type === 'error') {
          console.error('⚠️ Error from server:', data);
          
          // Handle specific error codes
          if (data.code === 'NO_SESSION_EXISTS') {
            console.log('📝 No session exists. Attempting to create new session...');
            
            // Retry session creation with delay
            setTimeout(() => {
              const createSessionPayload = {
                type: 'create_session',
                voice: 'alloy',
                instructions: `You are the Financial Sherpa, a friendly and knowledgeable AI assistant...`,
                customerId: customerId || 0
              };
              
              if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify(createSessionPayload));
                console.log('📤 Resent create session request');
              }
            }, 1000);
          }
          
          // Update conversation state based on error
          if (data.code === 'SESSION_INITIALIZATION_FAILED') {
            setConversationState('error');
            toast({
              title: 'Connection Error',
              description: 'Unable to establish AI connection. Please try again later.',
              variant: 'destructive',
              duration: 5000
            });
          }
        }
        
        // Rest of existing message handling...
      } catch (error) {
        // Handle binary messages (likely audio)
        console.log('📩 Received binary data of size:', event.data.size);
        // Existing binary handling...
      }
    };
  }
}, [socket]);
```

### 3. Improved Connection State Management

```typescript
// In openaiRealtimeWebSocket.fixed.ts

// Add a new method to verify session state
private async verifyOpenAISessionState(client: ClientConnection): Promise<boolean> {
  if (!client.sessionId || !client.openaiSocket) {
    return false;
  }
  
  // Check if socket is open
  if (client.openaiSocket.readyState !== WS_OPEN) {
    return false;
  }
  
  // Ping OpenAI connection to verify it's still responsive
  try {
    // Send a ping message to verify connection
    const pingMsg = JSON.stringify({ type: 'ping' });
    client.openaiSocket.send(pingMsg);
    return true;
  } catch (error) {
    logger.warn({
      message: `Error verifying OpenAI session state: ${error instanceof Error ? error.message : String(error)}`,
      category: 'realtime',
      source: 'openai',
      metadata: { clientId: client.id, sessionId: client.sessionId }
    });
    return false;
  }
}

// Then modify handleAudioData to check session state first
private async handleAudioData(client: ClientConnection, data: any): Promise<void> {
  // Verify session is healthy before proceeding
  const sessionValid = await this.verifyOpenAISessionState(client);
  
  if (!sessionValid) {
    // Send error to client
    this.sendErrorWithThrottling(client, {
      type: 'error',
      message: 'Session is not active or ready',
      code: 'SESSION_NOT_READY',
      timestamp: new Date().toISOString()
    });
    
    // Attempt to reconnect if needed
    this.reconnectToOpenAI(client);
    return;
  }
  
  // Existing audio handling code...
}
```

## Testing Recommendations

1. Create a simple end-to-end test script that:
   - Connects to WebSocket
   - Creates a session
   - Sends a simple text message
   - Verifies response

2. Add more logging throughout the session creation process

3. Monitor OpenAI API error responses more carefully

## Implementation Plan

1. Update the OpenAI Realtime service first
2. Improve the WebSocket error handling
3. Enhance client-side error recovery
4. Add comprehensive logging
5. Test with basic functionality first, then add audio