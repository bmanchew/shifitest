# OpenAI Realtime API Requirements and Setup

This document outlines the requirements and setup process for using OpenAI's Realtime API in the Financial Sherpa voice assistant feature.

## API Access Requirements

### 1. OpenAI API Key

You need a valid OpenAI API key with access to:
- The OpenAI API in general
- The Realtime API beta specifically 
- The `gpt-4o-realtime-preview` model

### 2. Beta Access

The Realtime API is currently in beta, and access is granted on a case-by-case basis by OpenAI. To request access:

1. Visit [OpenAI's platform](https://platform.openai.com/)
2. Go to your account settings
3. Look for "Beta Features" or contact OpenAI support

### 3. Required Models

The following models are required for the Financial Sherpa feature:
- `gpt-4o-realtime-preview`: For real-time conversation
- `whisper-1` or similar: For audio transcription

## Authentication Flow

The authentication flow for connecting to the OpenAI Realtime API involves multiple steps:

1. **Create Session**: Make a REST API call to create a session
   ```
   POST https://api.openai.com/v1/realtime/sessions
   ```
   
   Headers:
   ```
   Content-Type: application/json
   Authorization: Bearer YOUR_API_KEY
   OpenAI-Beta: realtime=v1
   ```

2. **Extract Ephemeral Token**: From the response, extract the `client_secret.value`

3. **Connect to WebSocket**: Use the session ID and ephemeral token to connect to the WebSocket
   ```
   wss://api.openai.com/v1/realtime/{sessionId}?authorization=Bearer%20{client_secret.value}
   ```

   Headers:
   ```
   OpenAI-Beta: realtime=v1
   ```

## Error Codes and Troubleshooting

### Common Errors

| Error Code | Meaning | Solution |
|------------|---------|----------|
| 403 Forbidden | Your API key doesn't have access to the Realtime API | Request beta access from OpenAI |
| 400 Bad Request | Invalid request parameters | Check request body format |
| 401 Unauthorized | Invalid API key | Verify your API key is correct |
| 404 Not Found | Resource not found | Ensure session ID is correct |

### Troubleshooting

If you encounter a 403 Forbidden error when connecting to the WebSocket:

1. Verify your OpenAI account has beta access to the Realtime API
2. Ensure your API key has permission to use `gpt-4o-realtime-preview` model
3. Confirm you're using the ephemeral token (`client_secret.value`) correctly
4. Make sure you're formatting the WebSocket URL properly with the token in the query string
5. Include the required beta headers in both REST and WebSocket requests

## Testing API Access

Use the provided test script to verify your API key has the necessary permissions:

```bash
node test-openai-realtime-access.js
```

This script will:
1. Check if your API key is valid
2. Verify if the required models are available to your account
3. Attempt to create a realtime session
4. Display detailed error information if something fails

## Implementation Details

Our implementation follows a three-tier architecture:

1. **Client Component (React)**: Handles UI state, audio recording, and WebSocket connection to our server
2. **Server WebSocket Bridge**: Manages WebSocket connections between clients and OpenAI, handles buffering and reconnection
3. **OpenAI Service**: Communicates directly with OpenAI's API, creates sessions, and manages authentication

Key files:
- `client/src/components/customer/RealtimeAudioSherpa.tsx`: Client component
- `server/services/openaiRealtimeWebSocket.fixed.ts`: WebSocket bridge
- `server/services/openaiRealtime.ts`: OpenAI service
- `server/routes/financialSherpa.ts`: API routes

## Recent Fixes

The recent fixes to the OpenAI Realtime integration include:

1. Added required beta headers `OpenAI-Beta: realtime=v1`
2. Fixed WebSocket URL format to use query string parameter for authentication
3. Updated to use `client_secret.value` instead of session ID for authentication
4. Improved error handling and logging
5. Added session readiness detection and audio buffering
6. Implemented reconnection logic

## Next Steps

If you continue to encounter 403 errors after implementing these fixes, you will need to:

1. Contact OpenAI to request explicit access to the Realtime API beta
2. Verify your API key permissions include access to the required models
3. Consider testing with an alternative model if `gpt-4o-realtime-preview` is not available