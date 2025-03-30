import { FC, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle, Loader2, Mic, MicOff, RefreshCw, Volume2, VolumeX } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';

// Define the types for messages and conversation state
type Message = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
};

type ConversationState = 'idle' | 'connecting' | 'connected' | 'recording' | 'thinking' | 'responding' | 'error';

interface RealtimeAudioSherpaProps {
  customerId?: number;
  customerName?: string;
  financialData?: any;
}

const RealtimeAudioSherpa: FC<RealtimeAudioSherpaProps> = ({ 
  customerId,
  customerName,
  financialData 
}) => {
  const { toast } = useToast();
  
  // State for UI controls
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [recording, setRecording] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [transcription, setTranscription] = useState<string>('');
  const [loadingText, setLoadingText] = useState<string>('Connecting...');
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  
  // Use ref instead of state for openaiSessionReady to avoid race conditions with WebSocket
  const openaiSessionReadyRef = useRef(false);
  
  // For tracking last error notification time to avoid spamming
  const lastErrorNotificationRef = useRef<number | null>(null);
  
  // Store pending audio chunks before session is ready
  const pendingAudioChunksRef = useRef<Blob[]>([]);
  
  // Refs
  const webSocketRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioOutputRef = useRef<HTMLAudioElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
  // Keep track of conversation state
  const [conversationState, setConversationState] = useState<ConversationState>('idle');

  // Timer to check if session is ready - add timeout if server forgets to respond
  const sessionReadyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Add a new message to the conversation
  const addMessage = (message: Message) => {
    setMessages(prev => [...prev, message]);
  };
  
  // Initialize audio recording
  const initializeAudioRecording = async (): Promise<boolean> => {
    try {
      console.log('🎤 Initializing audio recording...');
      
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      console.log('✅ Microphone access granted');
      
      // Create MediaRecorder instance
      const recorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm', // Use webm for better compatibility
      });
      
      // Store recorder in ref
      mediaRecorderRef.current = recorder;
      
      // Set up event handlers
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          if (webSocketRef.current && 
              webSocketRef.current.readyState === WebSocket.OPEN && 
              openaiSessionReadyRef.current) {
            // If session is ready, send audio data immediately
            console.log(`📤 Sending audio chunk (${event.data.size} bytes) - OpenAI session ready: ${openaiSessionReadyRef.current}`);
            webSocketRef.current.send(event.data);
          } else {
            // If session is not ready, store chunks in a buffer to send once session is ready
            console.log(`⏳ Buffering audio chunk (${event.data.size} bytes) - OpenAI session not ready yet`);
            pendingAudioChunksRef.current.push(event.data);
            
            // If we've buffered too much audio (e.g., more than 3 seconds worth), warn the user
            if (pendingAudioChunksRef.current.length > 30) { // Assuming 100ms chunks, 30 = 3s
              console.warn('⚠️ Large audio buffer accumulating while waiting for session readiness');
              // Consider showing UI feedback if session is taking too long
              if (conversationState === 'recording') {
                toast({
                  title: 'AI Still Initializing',
                  description: 'Please wait a moment before continuing to speak',
                  variant: 'default',
                  duration: 2000
                });
              }
            }
          }
        }
      };
      
      recorder.onstop = async () => {
        console.log('🛑 MediaRecorder stopped');
        
        // Check if we have any audio chunks
        const hasLiveChunks = audioChunksRef.current.length > 0;
        const hasPendingChunks = pendingAudioChunksRef.current.length > 0;
        
        if (!hasLiveChunks && !hasPendingChunks) {
          console.warn('⚠️ No audio chunks recorded');
          return;
        }
        
        try {
          // Process pending chunks if any exist and OpenAI session is now ready
          if (hasPendingChunks && openaiSessionReadyRef.current && 
              webSocketRef.current && webSocketRef.current.readyState === WebSocket.OPEN) {
            console.log(`📤 Sending ${pendingAudioChunksRef.current.length} pending audio chunks now that session is ready`);
            
            // Send each pending chunk individually to maintain proper timing
            for (const chunk of pendingAudioChunksRef.current) {
              webSocketRef.current.send(chunk);
              // Small delay to avoid flooding the network
              await new Promise(resolve => setTimeout(resolve, 10));
            }
            
            // Clear the pending chunks after sending
            pendingAudioChunksRef.current = [];
          }
          
          // Process any additional chunks recorded in audioChunksRef
          if (hasLiveChunks) {
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            console.log(`🔊 Created audio blob of size: ${audioBlob.size} bytes`);
            audioChunksRef.current = [];
            
            // Try to send binary audio directly if WebSocket is available AND OpenAI session is ready
            if (webSocketRef.current && 
                webSocketRef.current.readyState === WebSocket.OPEN && 
                openaiSessionReadyRef.current) {
              try {
                console.log(`📤 Sending binary audio data to server - ${audioBlob.size} bytes`);
                
                // Send binary audio data directly for better performance
                webSocketRef.current.send(audioBlob);
                
                // Also send end_of_stream message to signal the end of audio data
                webSocketRef.current.send(JSON.stringify({
                  type: 'end_of_stream'
                }));
                
                setConversationState('thinking');
                setLoadingText('Transcribing...');
              } catch (error) {
                console.error('❌ Error sending binary audio data:', error);
                
                // Fallback to base64 encoding if binary send fails
                console.log('⚠️ Falling back to base64 encoding for audio data');
                
                // Convert to base64 as fallback
                const reader = new FileReader();
                reader.onloadend = () => {
                  const base64Audio = reader.result?.toString().split(',')[1];
                  
                  if (base64Audio && 
                      webSocketRef.current && 
                      webSocketRef.current.readyState === WebSocket.OPEN && 
                      openaiSessionReadyRef.current) {
                    console.log(`📤 Sending audio data to server - ${base64Audio.length} chars (base64)`);
                    // Send audio data to server
                    webSocketRef.current.send(JSON.stringify({
                      type: 'audio_data',
                      audio: base64Audio
                    }));
                    
                    // Also send end_of_stream message
                    webSocketRef.current.send(JSON.stringify({
                      type: 'end_of_stream'
                    }));
                  } else {
                    console.error(`❌ Cannot send audio data - WebSocket: ${webSocketRef.current?.readyState}, OpenAI ready: ${openaiSessionReadyRef.current}`);
                  }
                };
                reader.readAsDataURL(audioBlob);
              }
            } else {
              console.error('❌ Cannot send audio data - WebSocket not available or session not ready');
              console.log(`Debug info - WebSocket: ${webSocketRef.current?.readyState}, OpenAI ready: ${openaiSessionReadyRef.current}`);
              
              // Store this as pending audio if WebSocket is connected but OpenAI session isn't ready
              if (webSocketRef.current && 
                  webSocketRef.current.readyState === WebSocket.OPEN && 
                  !openaiSessionReadyRef.current) {
                console.log('⏳ Storing audio blob in pending buffer until session is ready');
                pendingAudioChunksRef.current.push(audioBlob);
              }
            }
          }

          // Add user message when transcription is available
          if (transcription) {
            console.log(`💬 Adding user message with transcription: ${transcription}`);
            addMessage({
              id: `user-${Date.now()}`,
              role: 'user',
              content: transcription,
              timestamp: Date.now()
            });
            setTranscription('');
          }
        } catch (error) {
          console.error('Error processing audio chunks:', error);
        }
      };
      
      console.log('✅ Audio recording setup complete and ready');
      return true;
    } catch (error) {
      console.error('❌ Error initializing audio recording:', error);
      
      // Provide more detailed error messages based on the type of error
      if (error instanceof DOMException) {
        if (error.name === 'NotAllowedError') {
          console.error('🚫 Microphone permission denied by user');
          toast({
            title: 'Microphone Access Required',
            description: 'Financial Sherpa needs microphone access to hear your voice. Click the lock/site info icon in your browser address bar and enable microphone access.',
            variant: 'destructive',
            duration: 8000 // Show for longer so user can read instructions
          });
        } else if (error.name === 'NotFoundError') {
          console.error('🚫 No microphone found on this device');
          toast({
            title: 'No Microphone Found',
            description: 'No microphone was detected on your device. Please connect a microphone or check your device settings and try again.',
            variant: 'destructive',
            duration: 8000
          });
        } else if (error.name === 'NotReadableError') {
          console.error('🚫 Microphone is already in use by another application');
          toast({
            title: 'Microphone Busy',
            description: 'Your microphone is being used by another application. Please close other apps using the microphone.',
            variant: 'destructive',
            duration: 8000
          });
        } else {
          toast({
            title: 'Microphone Access Error',
            description: `Error accessing microphone: ${error.message}. Try refreshing the page or checking browser settings.`,
            variant: 'destructive',
            duration: 8000
          });
        }
      } else {
        toast({
          title: 'Microphone Access Error',
          description: 'Please allow microphone access to use the voice feature. You may need to reload the page.',
          variant: 'destructive',
          duration: 8000
        });
      }
      return false;
    }
  };
  
  // Start recording audio
  const startRecording = async () => {
    if (conversationState !== 'connected' || !webSocketRef.current || webSocketRef.current.readyState !== WebSocket.OPEN) {
      console.warn('Cannot start recording - connection not ready.');
      return;
    }
    
    // Check if OpenAI session is fully ready
    if (!openaiSessionReadyRef.current) {
      console.warn('⚠️ OpenAI session not fully ready yet - waiting for transcription_session.created event');
      toast({
        title: 'AI Initializing',
        description: 'Please wait a moment for the AI to fully initialize',
        variant: 'default',
        duration: 2000
      });
      return;
    }

    // Initialize audio recording if not already done
    if (!mediaRecorderRef.current) {
      const initialized = await initializeAudioRecording();
      if (!initialized) return;
    }

    // Start recording
    if (mediaRecorderRef.current) {
      console.log('📢 Starting recording at:', new Date().toISOString());
      // Clear any previously pending audio chunks when starting a new recording
      pendingAudioChunksRef.current = [];
      audioChunksRef.current = [];
      mediaRecorderRef.current.start(100); // Collect data every 100ms
      setRecording(true);
      setConversationState('recording');
    }
  };
  
  // Stop recording audio
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };
  
  // Play audio from base64
  const playAudio = (base64Audio: string) => {
    if (!audioEnabled) return;

    try {
      // Create AudioContext if it doesn't exist
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      // Convert base64 to array buffer
      const binaryString = window.atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Create audio element
      const audio = new Audio();
      audio.src = URL.createObjectURL(new Blob([bytes.buffer], { type: 'audio/wav' }));
      audio.play();
      audioOutputRef.current = audio;
    } catch (error) {
      console.error('Error playing audio:', error);
    }
  };
  
  // Toggle audio output
  const toggleAudio = () => {
    setAudioEnabled(!audioEnabled);
  };
  
  // Handle error notifications with throttling
  const showErrorNotification = (title: string, message: string) => {
    const now = Date.now();
    // Only show one error notification per second
    if (!lastErrorNotificationRef.current || (now - lastErrorNotificationRef.current) > 1000) {
      lastErrorNotificationRef.current = now;
      toast({
        title,
        description: message,
        variant: 'destructive',
        duration: 3000
      });
    } else {
      console.log(`Suppressed error notification: "${title}" - too frequent`);
    }
  };
  
  // Handle incoming WebSocket messages
  const handleWebSocketMessage = (event: MessageEvent) => {
    try {
      // Check if the data is binary (e.g., audio data)
      if (event.data instanceof Blob || event.data instanceof ArrayBuffer) {
        console.log('📨 Binary WebSocket message received (likely audio data)');
        // Process binary data if needed
        return;
      }
      
      // For text data, try to parse as JSON
      console.log('📨 WebSocket message received:', 
        typeof event.data === 'string' 
          ? event.data.substring(0, 100) + (event.data.length > 100 ? '...' : '') 
          : 'Non-string data received');
      
      const data = JSON.parse(event.data);
      
      // Only log message types that aren't verbose
      if (data.type !== 'transcription' && data.type !== 'audio') {
        console.log('🔍 WebSocket message type:', data.type);
      }
      
      switch (data.type) {
        case 'welcome':
          console.log('🎉 Connected to WebSocket server:', data);
          // We don't change state here, we wait for session_created
          break;
        
        case 'session_created':
          console.log('✅ Session created successfully:', {
            sessionId: data.sessionId,
            voice: data.voice,
            timestamp: new Date().toISOString()
          });
          setSessionId(data.sessionId);
          
          // Set a 5-second fallback timeout for session readiness
          // If we don't receive transcription_session.created within this time,
          // force set the session to ready
          if (sessionReadyTimeoutRef.current) {
            clearTimeout(sessionReadyTimeoutRef.current);
          }
          
          sessionReadyTimeoutRef.current = setTimeout(() => {
            if (!openaiSessionReadyRef.current) {
              console.warn('⚠️ OpenAI session readiness timeout - forcing to ready state');
              // Force session to ready state after timeout
              openaiSessionReadyRef.current = true;
              
              // Ensure UI reflects the session is ready
              if (conversationState === 'connecting') {
                setConversationState('connected');
                setLoadingText('');
              }
            }
          }, 5000);
          
          // Note: We don't set openaiSessionReadyRef here, we wait for transcription_session.created event
          console.log('⏳ Waiting for OpenAI to complete session initialization...');
          
          // Add welcome message if not yet in connected state
          if (conversationState !== 'connected') {
            setConversationState('connected');
            setLoadingText('');
            
            const welcomeMessage = `Welcome to Financial Sherpa, ${customerName || 'there'}. You can now speak with me by pressing and holding the microphone button. How can I help you today?`;
            console.log('💬 Adding welcome message:', welcomeMessage);
            
            addMessage({
              id: `system-${Date.now()}`,
              role: 'system',
              content: welcomeMessage,
              timestamp: Date.now()
            });
          }
          break;
          
        case 'session_authenticate_success':
          console.log('🔐 OpenAI Session authenticated successfully');
          break;

        case 'transcription_session.created':
          console.log('🎯 Transcription session created event received at:', new Date().toISOString());
          // This is the critical event from OpenAI that tells us the session is truly ready
          // Set the session as ready for audio using ref for immediate effect
          openaiSessionReadyRef.current = true;
          
          // Clear any session ready timeout since we got the proper event
          if (sessionReadyTimeoutRef.current) {
            clearTimeout(sessionReadyTimeoutRef.current);
            sessionReadyTimeoutRef.current = null;
          }
          
          // If we're in 'connecting' state, change to 'connected'
          if (conversationState === 'connecting') {
            setConversationState('connected');
            setLoadingText('');
          }
          
          // Process any pending audio chunks that were collected before session was ready
          if (pendingAudioChunksRef.current.length > 0 && 
              webSocketRef.current && 
              webSocketRef.current.readyState === WebSocket.OPEN) {
            console.log(`📤 Processing ${pendingAudioChunksRef.current.length} pending audio chunks now that session is ready`);
            
            // Create a function to send chunks with a small delay
            const sendPendingChunks = async () => {
              if (!webSocketRef.current) return;
              
              for (const chunk of pendingAudioChunksRef.current) {
                if (webSocketRef.current.readyState === WebSocket.OPEN) {
                  webSocketRef.current.send(chunk);
                  // Small delay to avoid flooding the network
                  await new Promise(resolve => setTimeout(resolve, 10));
                }
              }
              
              // Signal end of stream after sending all pending chunks
              if (webSocketRef.current.readyState === WebSocket.OPEN) {
                webSocketRef.current.send(JSON.stringify({
                  type: 'end_of_stream'
                }));
              }
              
              // Clear the pending chunks
              pendingAudioChunksRef.current = [];
            };
            
            // Execute the async function
            sendPendingChunks();
          }
          
          // Log the exact state of the system when transcription_session.created received
          console.log('🔄 System State:', {
            sessionId: sessionId,
            connected: connected,
            conversationState: conversationState,
            recording: recording,
            openaiSessionReady: openaiSessionReadyRef.current,
            webSocketState: webSocketRef.current ? webSocketRef.current.readyState : 'no-websocket',
            pendingAudioChunks: pendingAudioChunksRef.current.length,
            mediaRecorderExists: !!mediaRecorderRef.current,
            timestamp: new Date().toISOString()
          });
          break;

        case 'transcription':
          // Don't log transcription updates to avoid console spam
          setTranscription(data.text);
          break;

        case 'message':
          if (data.role === 'assistant') {
            console.log('💬 Assistant message received:', data.content);
            setConversationState('responding');
            
            // Add assistant message
            addMessage({
              id: `assistant-${Date.now()}`,
              role: 'assistant',
              content: data.content,
              timestamp: Date.now()
            });
            
            // When message is done, go back to connected state
            setConversationState('connected');
          }
          break;

        case 'audio':
          if (audioEnabled && data.audio) {
            playAudio(data.audio);
          }
          break;

        case 'error':
          console.error('❌ Error from server at:', new Date().toISOString(), data);
          
          // Handle specific error codes differently
          if (data.code === 'NO_SESSION_EXISTS') {
            console.warn('⚠️ Received NO_SESSION_EXISTS error - session not ready or timed out');
            openaiSessionReadyRef.current = false; // Reset session ready state
            
            // If we're recording, stop recording to prevent sending more audio
            if (recording) {
              stopRecording();
            }
            
            // Show error notification with throttling
            showErrorNotification(
              'Session Error',
              'AI session initialization issue. Please wait a moment and try again.'
            );
            
            // Don't change overall state, allow the system to recover
          } else if (data.code === 'OPENAI_CONNECTION_NOT_READY') {
            console.warn('⚠️ OpenAI connection not ready yet');
            openaiSessionReadyRef.current = false; // Reset session ready state
            
            // Try again with a delay for non-critical errors
            if (webSocketRef.current && webSocketRef.current.readyState === WebSocket.OPEN) {
              setTimeout(() => {
                if (conversationState === 'connecting') {
                  console.log('🔄 Retrying session creation after delay...');
                  // Re-send the session creation request
                  webSocketRef.current?.send(JSON.stringify({
                    type: 'create_session',
                    voice: 'alloy',
                    instructions: `You are the Financial Sherpa, a friendly AI assistant for ${customerName || 'the customer'}.`,
                    customerId: customerId || 0
                  }));
                }
              }, 2000);
            }
            
            // Show error notification with throttling
            showErrorNotification(
              'Connection Initializing',
              'AI connection still initializing. Please wait a moment and try again.'
            );
          } else {
            // For other errors, reset the session and show notification
            openaiSessionReadyRef.current = false;
            
            // Show error notification with throttling
            showErrorNotification(
              'AI Assistant Error',
              data.message || 'An error occurred with the AI assistant. Please try again.'
            );
            
            // If this is a critical error, reset the conversation
            if (data.critical) {
              setConversationState('error');
            }
          }
          break;

        default:
          console.log(`📩 Unhandled message type: ${data.type}`);
      }
    } catch (error) {
      console.error('❌ Error handling WebSocket message:', error);
      showErrorNotification(
        'Message Processing Error',
        'Error processing response from AI assistant.'
      );
    }
  };
  
  // Initialize WebSocket connection
  const initializeWebSocket = async (): Promise<void> => {
    try {
      setConversationState('connecting');
      setLoadingText('Initializing Financial Sherpa...');
      
      console.log('🔄 Fetching Realtime configuration...');
      
      // Import the CSRF utility
      const { addCsrfHeader } = await import('@/lib/csrf');
      
      // Add CSRF token to headers
      const headers = await addCsrfHeader({
        'Content-Type': 'application/json',
      });
      
      // First fetch configuration from the API
      const response = await fetch('/api/financial-sherpa/realtime', {
        method: 'POST',
        headers,
        credentials: 'include', // Include cookies for CSRF validation
        body: JSON.stringify({
          customerId: customerId || 0,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to initialize: ${response.status} ${response.statusText}`);
      }
      
      const config = await response.json();
      
      if (!config.success) {
        throw new Error(config.error || 'Failed to get configuration');
      }
      
      console.log('✅ Received configuration:', config);
      
      // We'll log customer name and financial data if available from the server
      // (But we don't need to set them as they're already provided via props)
      if (config.customerName) {
        console.log('Customer name from config:', config.customerName);
      }
      
      if (config.financialData) {
        console.log('Financial data available from config');
      }
      
      setLoadingText('Connecting to AI...');
      
      // Determine the WebSocket URL using the endpoint from the config
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}${config.wsEndpoint}`;
      
      console.log(`🔌 Connecting to WebSocket: ${wsUrl}`);
      
      // Reset session ready state when starting a new connection
      openaiSessionReadyRef.current = false;
      
      // Create WebSocket
      console.log(`🔌 Creating WebSocket with URL: ${wsUrl}`);
      const socket = new WebSocket(wsUrl);
      webSocketRef.current = socket;
      console.log(`🔌 WebSocket created, current readyState: ${socket.readyState} (0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED)`);

      // Set up connection timeout
      const connectionTimeoutId = setTimeout(() => {
        if (conversationState === 'connecting') {
          console.error(`⏱️ WebSocket connection timed out after 15 seconds. Current readyState: ${socket.readyState}`);
          
          // Close the socket if it's still open but not fully initialized
          if (socket && socket.readyState === WebSocket.OPEN) {
            console.log('Closing timed out connection...');
            socket.close();
          }
          
          openaiSessionReadyRef.current = false; // Reset session ready state on timeout
          setConversationState('error');
          toast({
            title: 'Connection Timeout',
            description: 'Connection to AI timed out. Please try again later.',
            variant: 'destructive',
            duration: 5000
          });
        }
      }, 15000); // 15 second timeout
      
      console.log('⏱ Connection timeout set for 15 seconds');

      // Set up event handlers
      socket.onopen = () => {
        console.log('🟢 WebSocket connection established at:', new Date().toISOString());
        console.log(`🟢 Connection details: ${socket.url}, readyState=${socket.readyState}`);
        setConnected(true);
        
        // Wait for socket to be fully open before sending
        setTimeout(() => {
          // Request a new session
          const instructions = `You are the Financial Sherpa, a friendly and knowledgeable AI assistant for ShiFi Financial. Your role is to help ${config.customerName || customerName || 'the customer'} understand their financial data, provide insights on their contracts, and answer questions about financial products and services. Keep your responses friendly, concise, and professional. ${
            (config.financialData || financialData) ? 'Use the financial data available to provide personalized insights.' : 'Encourage connecting bank accounts to provide more personalized insights.'
          }`;
          
          console.log('📝 Sending session creation with instructions');
          
          // Send session creation request
          try {
            const createSessionPayload = {
              type: 'create_session',
              voice: 'alloy', // Valid voices: alloy, ash, ballad, coral, echo, sage, shimmer, verse
              instructions: instructions,
              customerId: customerId || 0
            };
            
            console.log('📤 Sending payload to create session');
            socket.send(JSON.stringify(createSessionPayload));
            
            console.log('✅ Session creation request sent successfully at:', new Date().toISOString());
          } catch (sendError) {
            console.error('❌ Error sending session creation request at:', new Date().toISOString(), sendError);
            clearTimeout(connectionTimeoutId);
            openaiSessionReadyRef.current = false; // Reset this flag on session creation errors
            setConversationState('error');
            toast({
              title: 'Connection Error',
              description: 'Failed to initialize AI session. Please try again later.',
              variant: 'destructive'
            });
          }
        }, 500); // 500ms delay to ensure connection is stable
      };

      socket.onmessage = (event) => {
        // Clear the connection timeout as soon as we receive any message
        clearTimeout(connectionTimeoutId);
        
        // Process the message
        handleWebSocketMessage(event);
      };

      socket.onerror = (error) => {
        console.error('WebSocket error at:', new Date().toISOString(), error);
        clearTimeout(connectionTimeoutId);
        openaiSessionReadyRef.current = false; // Ensure session is marked as not ready on error
        setConversationState('error');
        toast({
          title: 'Connection Error',
          description: 'Failed to connect to the audio service. Please try again later.',
          variant: 'destructive'
        });
      };

      socket.onclose = () => {
        console.log('WebSocket connection closed at:', new Date().toISOString());
        clearTimeout(connectionTimeoutId);
        
        // Clear any session readiness timeout
        if (sessionReadyTimeoutRef.current) {
          clearTimeout(sessionReadyTimeoutRef.current);
          sessionReadyTimeoutRef.current = null;
        }
        
        setConnected(false);
        setSessionId(null);
        openaiSessionReadyRef.current = false; // Reset this flag on connection close
        
        if (conversationState !== 'error') {
          setConversationState('idle');
        }
      };
      
    } catch (error) {
      console.error('❌ WebSocket initialization error at:', new Date().toISOString(), error);
      openaiSessionReadyRef.current = false; // Reset this flag on initialization errors
      setConversationState('error');
      toast({
        title: 'Connection Error',
        description: error instanceof Error ? error.message : 'Failed to connect to the AI service',
        variant: 'destructive'
      });
      throw error; // Re-throw to allow caller to handle it
    }
  };

  // Start a new conversation
  const startConversation = async () => {
    if (conversationState === 'idle') {
      // Clear previous conversation
      setMessages([]);
      
      console.log('⏳ Starting new conversation...');
      setLoadingText('Starting new conversation...');
      
      try {
        // Clear any pending audio chunks
        pendingAudioChunksRef.current = [];
        
        // Reset session ready state
        openaiSessionReadyRef.current = false;
        
        // Initialize WebSocket
        console.log('🔄 Initializing WebSocket connection...');
        await initializeWebSocket();
        console.log('✅ WebSocket connection initialized');
      } catch (error) {
        console.error('❌ Failed to start conversation at:', new Date().toISOString(), error);
        openaiSessionReadyRef.current = false; // Ensure this is reset on errors
        toast({
          title: 'Connection Error',
          description: 'Failed to initialize the AI conversation. Please try again later.',
          variant: 'destructive'
        });
        setConversationState('error');
      }
    } else {
      console.log(`🔄 Not starting new conversation because current state is: ${conversationState}`);
    }
  };
  
  // End the conversation
  const endConversation = () => {
    if (webSocketRef.current && webSocketRef.current.readyState === WebSocket.OPEN) {
      webSocketRef.current.send(JSON.stringify({
        type: 'end_session'
      }));
    }
    
    if (mediaRecorderRef.current) {
      if (mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    }
    
    // Clear any session readiness timeout
    if (sessionReadyTimeoutRef.current) {
      clearTimeout(sessionReadyTimeoutRef.current);
      sessionReadyTimeoutRef.current = null;
    }
    
    // Reset session ready state
    openaiSessionReadyRef.current = false;
    
    // Close WebSocket connection
    if (webSocketRef.current) {
      webSocketRef.current.close();
      webSocketRef.current = null;
    }
    
    setConnected(false);
    setSessionId(null);
    setConversationState('idle');
  };
  
  // Render loading state
  const renderLoadingState = () => {
    return (
      <div className="flex flex-col items-center justify-center py-10">
        <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
        <p className="text-center text-muted-foreground">{loadingText}</p>
      </div>
    );
  };

  // Render status badge
  const renderStatusBadge = () => {
    // Special case: connected but OpenAI session not fully ready
    if (conversationState === 'connected' && !openaiSessionReadyRef.current) {
      return (
        <div className="flex items-center gap-1">
          <Badge variant="outline" className="bg-yellow-100 text-yellow-800">Initializing...</Badge>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span><AlertCircle className="h-4 w-4 text-yellow-600" /></span>
              </TooltipTrigger>
              <TooltipContent>
                Please wait a moment until AI initialization is complete before speaking
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      );
    }
    
    switch (conversationState) {
      case 'idle':
        return <Badge variant="outline">Disconnected</Badge>;
      case 'connecting':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800">Connecting...</Badge>;
      case 'connected':
        return <Badge variant="outline" className="bg-green-100 text-green-800">Connected</Badge>;
      case 'recording':
        return <Badge variant="outline" className="bg-red-100 text-red-800">Recording...</Badge>;
      case 'thinking':
        return <Badge variant="outline" className="bg-blue-100 text-blue-800">Processing...</Badge>;
      case 'responding':
        return <Badge variant="outline" className="bg-purple-100 text-purple-800">Responding...</Badge>;
      case 'error':
        return <Badge variant="outline" className="bg-red-100 text-red-800">Error</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  // Auto-scroll to latest message
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);
  
  // Auto-start conversation when component mounts
  useEffect(() => {
    if (conversationState === 'idle') {
      startConversation();
      
      // For now, remove early microphone permission request as it might be causing premature audio data collection
      console.log('Deferring microphone permission request until recording starts');
    }
    
    // Cleanup function to end conversation when component unmounts
    return () => {
      if (conversationState !== 'idle') {
        endConversation();
      }
    };
  }, []);

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardContent className="p-6">
        {conversationState === 'idle' ? (
          <div className="flex flex-col items-center justify-center py-10">
            <Button onClick={startConversation} className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Connect to Financial Sherpa
            </Button>
          </div>
        ) : conversationState === 'connecting' ? (
          renderLoadingState()
        ) : (
          <>
            {/* Header with status and controls */}
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">Financial Sherpa</h3>
                {renderStatusBadge()}
              </div>
              <div className="flex items-center gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={toggleAudio}
                        className="h-8 w-8"
                      >
                        {audioEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {audioEnabled ? 'Mute AI voice' : 'Unmute AI voice'}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={endConversation}
                        className="h-8 w-8"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Restart conversation
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
            
            {/* Conversation area */}
            <div className="h-[400px] overflow-y-auto border rounded-md p-4 mb-4 bg-background">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <p>Your conversation will appear here. Begin by clicking and holding the microphone button to speak.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`flex gap-2 max-w-[80%] ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                        <Avatar className="h-8 w-8">
                          {message.role === 'user' ? (
                            <>
                              <AvatarImage src="/avatars/user.png" alt="User" />
                              <AvatarFallback>U</AvatarFallback>
                            </>
                          ) : message.role === 'assistant' ? (
                            <>
                              <AvatarImage src="/avatars/sherpa.png" alt="Financial Sherpa" />
                              <AvatarFallback>AI</AvatarFallback>
                            </>
                          ) : (
                            <>
                              <AvatarImage src="/avatars/system.png" alt="System" />
                              <AvatarFallback>S</AvatarFallback>
                            </>
                          )}
                        </Avatar>
                        <div className={`rounded-lg p-3 ${
                          message.role === 'user' 
                            ? 'bg-primary text-primary-foreground' 
                            : message.role === 'assistant'
                              ? 'bg-muted' 
                              : 'bg-muted border border-border'
                        }`}>
                          <p>{message.content}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {/* Transcription feedback */}
                  {recording && transcription && (
                    <div className="flex justify-end">
                      <div className="rounded-lg p-3 bg-primary/10 text-primary max-w-[80%] italic">
                        {transcription}
                      </div>
                    </div>
                  )}
                  
                  {/* Auto-scroll anchor */}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>
            
            {/* Recording controls */}
            <div className="flex justify-center">
              <Button
                size="lg"
                variant={recording ? "destructive" : openaiSessionReadyRef.current ? "default" : "outline"}
                className={`rounded-full w-16 h-16 p-0 ${!openaiSessionReadyRef.current ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={!openaiSessionReadyRef.current || conversationState === 'thinking' || conversationState === 'responding'}
                onMouseDown={() => startRecording()}
                onMouseUp={() => stopRecording()}
                onTouchStart={() => startRecording()}
                onTouchEnd={() => stopRecording()}
              >
                {recording ? (
                  <MicOff className="h-8 w-8" />
                ) : (
                  <Mic className="h-8 w-8" />
                )}
              </Button>
            </div>
            
            {/* Status text */}
            <div className="text-center mt-2 text-sm text-muted-foreground">
              {!openaiSessionReadyRef.current ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Financial Sherpa is initializing...</span>
                </div>
              ) : recording ? (
                <span>Release to send your message</span>
              ) : conversationState === 'thinking' ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Processing your request...</span>
                </div>
              ) : conversationState === 'responding' ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Financial Sherpa is responding...</span>
                </div>
              ) : (
                <span>Click and hold the microphone button to speak</span>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default RealtimeAudioSherpa;