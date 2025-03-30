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
  
  // Refs
  const webSocketRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioOutputRef = useRef<HTMLAudioElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
  // Keep track of conversation state
  const [conversationState, setConversationState] = useState<ConversationState>('idle');
  
  // Add a new message to the conversation
  const addMessage = (message: Message) => {
    setMessages(prev => [...prev, message]);
  };
  
  // Initialize audio recording
  const initializeAudioRecording = async (): Promise<boolean> => {
    // Double-check OpenAI session ready state before initializing
    if (!openaiSessionReadyRef.current) {
      console.warn('❌ Cannot initialize audio recording - OpenAI session not fully ready');
      toast({
        title: 'AI Still Initializing',
        description: 'Please wait a moment before trying to record',
        variant: 'default',
        duration: 3000
      });
      return false;
    }
    
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
      
      // Check session ready state again after microphone permission granted
      if (!openaiSessionReadyRef.current) {
        console.warn('⚠️ OpenAI session is no longer ready after microphone setup');
        stream.getTracks().forEach(track => track.stop()); // Release microphone
        toast({
          title: 'Session Status Changed',
          description: 'The AI session needs to reinitialize',
          variant: 'destructive',
          duration: 3000
        });
        return false;
      }
      
      // Create MediaRecorder instance
      const recorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm', // Use webm for better compatibility
      });
      
      // Store recorder in ref
      mediaRecorderRef.current = recorder;
      
      // Set up event handlers
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          
          // Check if we can send this data immediately (if stream is active)
          if (webSocketRef.current && 
              webSocketRef.current.readyState === WebSocket.OPEN && 
              openaiSessionReadyRef.current) {
            console.log(`📤 Sending audio chunk (${event.data.size} bytes) - OpenAI session ready: ${openaiSessionReadyRef.current}`);
            webSocketRef.current.send(event.data);
          } else {
            console.warn(`⚠️ Not sending audio chunk - WebSocket: ${webSocketRef.current?.readyState}, OpenAI ready: ${openaiSessionReadyRef.current}`);
          }
        }
      };
      
      // Handle recording stop event
      recorder.onstop = () => {
        console.log('🛑 MediaRecorder stopped');
        
        if (audioChunksRef.current.length === 0) {
          console.warn('⚠️ No audio chunks recorded');
          return;
        }
        
        try {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          console.log(`🔊 Created audio blob of size: ${audioBlob.size} bytes`);
          audioChunksRef.current = [];
          
          // Double-check session readiness before sending audio
          // This is a critical check to ensure we don't send audio before OpenAI is fully ready
          if (!openaiSessionReadyRef.current) {
            console.warn('⚠️ OpenAI session not fully ready yet - cannot send audio');
            toast({
              title: 'AI Still Initializing',
              description: 'Please wait a moment for the AI to fully initialize before speaking',
              variant: 'default',
              duration: 3000
            });
            return;
          }
          
          // Process the audio data if WebSocket and OpenAI session are both ready
          processAudioData(audioBlob);
          
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
          console.error('❌ Error processing audio after recording:', error);
        }
      };
      
      // Helper function to process and send audio data
      const processAudioData = (audioBlob: Blob) => {
        // Try to send binary audio directly if WebSocket is available AND OpenAI session is ready
        if (webSocketRef.current && 
            webSocketRef.current.readyState === WebSocket.OPEN && 
            openaiSessionReadyRef.current) {
          try {
            console.log(`📤 Sending binary audio data to server - ${audioBlob.size} bytes - OpenAI session ready: ${openaiSessionReadyRef.current}`);
            
            // Send binary audio data directly for better performance
            // This bypasses the base64 encoding/decoding overhead
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
                console.log(`📤 Sending audio data to server - ${base64Audio.length} chars (base64) - OpenAI session ready: ${openaiSessionReadyRef.current}`);
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
                console.error(`❌ Cannot send audio data - WebSocket: ${webSocketRef.current?.readyState}, OpenAI ready: ${openaiSessionReadyRef.current}, base64 available: ${!!base64Audio}`);
              }
            };
            reader.readAsDataURL(audioBlob);
          }
        } else {
          console.error('❌ Cannot send audio data - WebSocket not available or OpenAI session not ready');
          console.log(`WebSocket ready: ${!!webSocketRef.current && webSocketRef.current.readyState === WebSocket.OPEN}, OpenAI session ready: ${openaiSessionReadyRef.current}`);
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
      console.warn('OpenAI session not fully ready yet - waiting for transcription_session.created event');
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
  
  // Handle incoming WebSocket messages
  const handleWebSocketMessage = (event: MessageEvent) => {
    try {
      // Check if the data is binary (e.g., audio data)
      if (event.data instanceof Blob || event.data instanceof ArrayBuffer) {
        console.log('📨 Binary WebSocket message received (likely audio data)');
        // Process binary data if needed
        // In this case, we don't need to do anything with binary responses as they're
        // not expected from our server. OpenAI would send audio as base64 in JSON.
        return;
      }
      
      // For text data, try to parse as JSON
      console.log('📨 WebSocket message received', 
        typeof event.data === 'string' 
          ? '(data content redacted for privacy)' 
          : '(binary data received)');
      
      const data = JSON.parse(event.data);
      console.log('🔍 WebSocket message type:', data.type, '(message content redacted for privacy)');
      
      // Update session state instantly on specific event types
      // This is a critical fix for ensuring we properly track session state
      if (data.type === 'transcription_session.created') {
        console.log('🎯 Setting OpenAI session ready state to TRUE');
        openaiSessionReadyRef.current = true;
      } else if (data.type === 'error' || data.type === 'session_ended') {
        console.log('🎯 Setting OpenAI session ready state to FALSE due to:', data.type);
        openaiSessionReadyRef.current = false;
      } else if (data.type === 'server_event' && data.event === 'openai_session_created') {
        console.log('🎯 Setting OpenAI session ready state to TRUE via server_event');
        openaiSessionReadyRef.current = true;
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
          setConversationState('connected');
          setLoadingText('');
          
          // Note: We don't set openaiSessionReadyRef here, we wait for transcription_session.created event
          console.log('⏳ Waiting for OpenAI to complete session initialization...');
          
          // Log events for debugging
          if (data.events) {
            console.log('📝 Session events:', data.events);
          }
          
          // Add system welcome message
          const welcomeMessage = `Welcome to Financial Sherpa, ${customerName || 'there'}. You can now speak with me by pressing and holding the microphone button. How can I help you today?`;
          console.log('💬 Adding welcome message (content redacted for privacy)');
          
          addMessage({
            id: `system-${Date.now()}`,
            role: 'system',
            content: welcomeMessage,
            timestamp: Date.now()
          });
          break;
          
        case 'session_authenticate_success':
          console.log('🔐 OpenAI Session authenticated successfully');
          break;

        case 'transcription':
          console.log('📝 Transcription received (content redacted for privacy)');
          setTranscription(data.text);
          break;

        case 'message':
          if (data.role === 'assistant') {
            console.log('💬 Assistant message received (content redacted for privacy)');
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
          if (audioEnabled) {
            console.log('🔊 Audio data received from OpenAI', {
              dataSize: data.audio ? data.audio.length : 0,
              timestamp: new Date().toISOString()
            });
            playAudio(data.audio);
          }
          break;

        case 'error':
          console.error('❌ Error from server at:', new Date().toISOString(), data);
          openaiSessionReadyRef.current = false; // Reset the session ready flag on any error
          
          // Handle specific error codes differently
          if (data.code === 'NO_SESSION_EXISTS') {
            console.warn('🛑 Received NO_SESSION_EXISTS error - waiting for session initialization');
            // Don't show a toast for this, as it's a normal part of initialization
            // Instead, force the conversationState to 'connecting' to prevent early audio recording
            if (conversationState !== 'connecting') {
              setConversationState('connecting');
              setLoadingText('Waiting for AI initialization...');
            }
          } else if (data.code === 'OPENAI_CONNECTION_NOT_READY') {
            console.warn('⏳ OpenAI connection not fully ready yet');
            toast({
              title: 'AI Initializing',
              description: 'Please wait a moment for the AI to fully initialize',
              variant: 'default',
              duration: 2000
            });
          } else {
            // Generic error handling for other cases
            toast({
              title: 'Connection Error',
              description: data.message || 'An error occurred with the AI connection',
              variant: 'destructive',
              duration: 5000
            });
          }
          break;
          
        // Handle server-side events  
        case 'server_event':
          console.log('📡 Server event received (details redacted for privacy)');
          if (data.event === 'openai_session_created') {
            console.log('🎉 OpenAI session created on server side at:', new Date().toISOString());
            // Set the session as ready for audio using ref for immediate effect
            openaiSessionReadyRef.current = true;
            
            // Update loading state if we're still in connecting mode
            if (conversationState === 'connecting') {
              setConversationState('connected');
              setLoadingText('');
            }
            
            // Force re-render status badge by toggling a state
            setConnected(prev => {
              setTimeout(() => setConnected(true), 0);
              return false;
            });
            
            toast({
              title: 'AI Ready',
              description: 'Financial Sherpa is ready for your voice questions',
              variant: 'default',
              duration: 3000
            });
          } else if (data.event === 'openai_connection_established') {
            console.log('🔗 OpenAI connection established on server side');
            
            // Update the UI to show we're making progress
            setLoadingText('AI connection established, finalizing setup...');
          } else if (data.event === 'openai_error') {
            console.error('⚠️ OpenAI error on server side at:', new Date().toISOString(), data.message);
            openaiSessionReadyRef.current = false; // Reset session ready state on OpenAI errors
            toast({
              title: 'OpenAI Error',
              description: data.message || 'Error with OpenAI service',
              variant: 'destructive',
              duration: 5000
            });
          }
          break;

        case 'session_ended':
          console.log('Session ended:', data);
          setSessionId(null);
          setConversationState('idle');
          openaiSessionReadyRef.current = false;
          console.log('🔄 Session ended, reset openaiSessionReady state');
          break;

        case 'session.authenticate':
          console.log('🔐 Authentication message received');
          break;
          
        case 'session.status':
          console.log('📊 Session status update (details redacted for privacy)');
          break;
          
        case 'transcription_session.created':
          console.log('🎯 Transcription session created event received at:', new Date().toISOString());
          // Set the session as ready for audio using ref for immediate effect
          openaiSessionReadyRef.current = true;
          
          // If we're in 'connecting' state, change to 'connected'
          if (conversationState === 'connecting') {
            setConversationState('connected');
            setLoadingText('');
          }
          
          // Log the exact state of the system when transcription_session.created received
          console.log('🔄 System State:', {
            sessionId: sessionId,
            connected: connected,
            conversationState: conversationState,
            recording: recording,
            openaiSessionReady: openaiSessionReadyRef.current,
            webSocketState: webSocketRef.current ? webSocketRef.current.readyState : 'no-websocket',
            mediaRecorderExists: !!mediaRecorderRef.current,
            timestamp: new Date().toISOString()
          });
          
          toast({
            title: 'AI Ready',
            description: 'Financial Sherpa is ready for your voice questions',
            variant: 'default',
            duration: 3000
          });
          break;

        default:
          console.log('⚠️ Unknown message type:', data);
      }
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
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
      
      console.log('✅ Received configuration (details redacted for privacy)');
      
      // Update customer name and financial data if available from the server
      // We can't use setCustomerName or setFinancialData here as they are passed as props
      // If needed, these values would be managed by parent component
      
      setLoadingText('Connecting to AI...');
      
      // Determine the WebSocket URL using the endpoint from the config
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}${config.wsEndpoint}`;
      
      console.log(`🔌 Connecting to WebSocket: ${wsUrl}`);
      
      // Create WebSocket - add verbose logging to help debug
      console.log(`🔌 Attempting to create WebSocket with URL: ${wsUrl}`);
      const socket = new WebSocket(wsUrl);
      webSocketRef.current = socket;
      console.log(`🔌 WebSocket created, current readyState: ${socket.readyState} (0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED)`);

      // Set up connection timeout
      const connectionTimeoutId = setTimeout(() => {
        if (conversationState === 'connecting') {
          console.error(`❌ WebSocket connection timed out at: ${new Date().toISOString()}. Current readyState: ${socket.readyState}`);
          
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
        
        // Clear the connection timeout as the connection is established
        clearTimeout(connectionTimeoutId);
        
        // Set a shorter timeout specifically for session creation
        // If we don't receive create_session acknowledgment, we'll retry
        const sessionInitTimeoutId = setTimeout(() => {
          // If we're still in the connecting state after 5 seconds, try sending the create_session message again
          if (conversationState === 'connecting' && socket && socket.readyState === WebSocket.OPEN) {
            console.log('⚠️ Session creation taking too long, resending create_session message');
            
            // Display toast to inform user
            toast({
              title: 'Initializing',
              description: 'Still connecting to AI assistant...',
              duration: 3000
            });
            
            // Resend the create session message
            try {
              const retryInstructions = `You are the Financial Sherpa, a friendly and knowledgeable AI assistant for ShiFi Financial. Your role is to help ${config.customerName || customerName || 'the customer'} understand their financial data, provide insights on their contracts, and answer questions about financial products and services. Keep your responses friendly, concise, and professional. RETRY ATTEMPT.`;
              
              console.log('🔄 Resending create_session message');
              socket.send(JSON.stringify({
                type: 'create_session',
                voice: 'alloy', // Or whatever voice is preferred
                instructions: retryInstructions,
                temperature: 0.7,
                customerId: config.customerId || customerId || 0,
                retry: true, // Flag to indicate this is a retry
              }));
            } catch (error) {
              console.error('⚠️ Error resending create_session message:', error);
            }
          }
        }, 8000); // 8 seconds timeout for session creation
        
        // Request a new session
        const instructions = `You are the Financial Sherpa, a friendly and knowledgeable AI assistant for ShiFi Financial. Your role is to help ${config.customerName || customerName || 'the customer'} understand their financial data, provide insights on their contracts, and answer questions about financial products and services. Keep your responses friendly, concise, and professional. ${
          (config.financialData || financialData) ? 'Use the financial data available to provide personalized insights.' : 'Encourage connecting bank accounts to provide more personalized insights.'
        }`;
        
        console.log('📝 Sending session creation with Financial Sherpa instructions');
        console.log('📝 Customer authenticated: Yes');
        console.log('📝 Data available for context:', (!!config.financialData || !!financialData) ? 'Yes' : 'No');
        
        // Add delay to ensure WebSocket is fully established before sending
        setTimeout(() => {
          // Send session creation request
          try {
            const createSessionPayload = {
              type: 'create_session',
              voice: 'alloy', // Valid voices: alloy, ash, ballad, coral, echo, sage, shimmer, verse
              instructions: instructions,
              customerId: customerId || 0
            };
            
            console.log('📤 Sending session creation payload (personal data redacted)');
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
      // Release microphone
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      mediaRecorderRef.current = null;
    }
    
    // Reset all session-related state
    setRecording(false);
    setConversationState('idle');
    setSessionId(null);
    openaiSessionReadyRef.current = false;
    console.log('🔄 Session ended, reset openaiSessionReady state');
  };

  // Start a conversation
  const startConversation = async () => {
    if (conversationState === 'idle') {
      // Clear previous conversation
      setMessages([]);
      
      console.log('⏳ Starting new conversation...');
      setLoadingText('Starting new conversation...');
      
      try {
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
        return (
          <div className="flex items-center gap-1">
            <Badge variant="outline" className="bg-green-100 text-green-800">Ready</Badge>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span><CheckCircle className="h-4 w-4 text-green-600" /></span>
                </TooltipTrigger>
                <TooltipContent>
                  AI is ready to receive your voice input
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        );
      case 'recording':
        return <Badge variant="outline" className="bg-red-100 text-red-800">Recording</Badge>;
      case 'thinking':
        return <Badge variant="outline" className="bg-blue-100 text-blue-800">Thinking...</Badge>;
      case 'responding':
        return <Badge variant="outline" className="bg-purple-100 text-purple-800">Responding</Badge>;
      case 'error':
        return <Badge variant="outline" className="bg-red-100 text-red-800">Error</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  // Effect for automatically scrolling to the bottom of the messages
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
            
            {/* Messages area */}
            <div className="mb-4 max-h-[400px] overflow-y-auto border rounded-md p-3 bg-card">
              {messages.length === 0 ? (
                <div className="text-center text-muted-foreground p-4">
                  {(conversationState === 'connected' && !openaiSessionReadyRef.current) ? 
                    'Waiting for AI initialization...' : 
                    'No messages yet. Start speaking to ask a question.'}
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div 
                      key={message.id} 
                      className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      {message.role !== 'user' && (
                        <Avatar className="h-8 w-8">
                          <AvatarImage src="/ShiFiMidesk.png" alt="Financial Sherpa" />
                          <AvatarFallback>FS</AvatarFallback>
                        </Avatar>
                      )}
                      <div className={`rounded-lg p-3 max-w-[80%] ${
                        message.role === 'user' 
                          ? 'bg-primary text-primary-foreground ml-auto' 
                          : message.role === 'system' 
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' 
                            : 'bg-muted text-muted-foreground'
                      }`}>
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      </div>
                      {message.role === 'user' && (
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>U</AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>
            
            {/* Microphone control */}
            <div className="flex justify-center">
              <div className="relative">
                {/* Show pulsing animation when connecting */}
                {(
                  (conversationState === 'connected' && !openaiSessionReadyRef.current) ||
                  conversationState === 'thinking'
                ) && (
                  <div className="absolute inset-0 rounded-full animate-ping bg-gray-200 opacity-40"></div>
                )}
                
                <Button
                  size="lg"
                  className={`rounded-full h-16 w-16 flex items-center justify-center transition-all duration-200 ${
                    recording 
                      ? 'bg-red-500 hover:bg-red-600 text-white'
                      : (conversationState === 'connected' && openaiSessionReadyRef.current)
                        ? 'bg-green-100 hover:bg-green-200 text-green-800' 
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                  onMouseDown={startRecording}
                  onMouseUp={stopRecording}
                  onTouchStart={startRecording}
                  onTouchEnd={stopRecording}
                  disabled={
                    conversationState !== 'connected' || 
                    !openaiSessionReadyRef.current
                  }
                >
                  {recording ? (
                    <MicOff className="h-8 w-8" />
                  ) : (
                    <Mic className="h-8 w-8" />
                  )}
                </Button>
              </div>
            </div>
            
            {/* Transcription display */}
            {transcription && (
              <div className="mt-4">
                <Separator className="mb-2" />
                <p className="text-sm text-muted-foreground">Heard: {transcription}</p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default RealtimeAudioSherpa;
