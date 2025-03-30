/**
 * RealtimeAudioSherpa Component
 * 
 * This component provides a real-time voice interface for the Financial Sherpa
 * using OpenAI's Realtime API for real-time audio conversations.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { Loader2, Mic, MicOff, Volume2, VolumeX, Info, MessageSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';

// The possible states of the conversation
type ConversationState = 
  | 'idle'           // No active conversation
  | 'connecting'     // Establishing connection
  | 'connected'      // Connection established but not recording
  | 'recording'      // Actively recording audio
  | 'thinking'       // AI is processing and generating a response
  | 'responding'     // AI is responding (possibly with audio)
  | 'error';         // An error has occurred

// Message object for storing conversation history
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  audioUrl?: string; // URL to the audio file, if available
}

// Props for the component
interface RealtimeAudioSherpaProps {
  customerId?: number;
  customerName?: string;
  financialData?: any;
}

const RealtimeAudioSherpa: React.FC<RealtimeAudioSherpaProps> = ({
  customerId,
  customerName: initialCustomerName = 'Customer',
  financialData: initialFinancialData
}) => {
  // State
  const [customerName, setCustomerName] = useState<string>(initialCustomerName);
  const [financialData, setFinancialData] = useState<any>(initialFinancialData);
  const [conversationState, setConversationState] = useState<ConversationState>('idle');
  const [messages, setMessages] = useState<Message[]>([]);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [recording, setRecording] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [transcription, setTranscription] = useState<string>('');
  const [loadingText, setLoadingText] = useState<string>('Connecting...');
  const [connected, setConnected] = useState(false);
  const [openaiSessionReady, setOpenaiSessionReady] = useState(false);

  // Refs
  const webSocketRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioOutputRef = useRef<HTMLAudioElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Toast hook for notifications
  const { toast } = useToast();

  // Add a message to the conversation
  const addMessage = (message: Message) => {
    setMessages(prevMessages => [...prevMessages, message]);
  };

  // Initialize audio recording
  const initializeAudioRecording = async (): Promise<boolean> => {
    console.log('🎤 Initializing audio recording and requesting microphone permissions');
    
    try {
      // Check if mediaDevices API is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error('❌ Media Devices API not supported in this browser');
        toast({
          title: 'Browser Not Supported',
          description: 'Your browser does not support audio recording. Please try a different browser.',
          variant: 'destructive'
        });
        return false;
      }
      
      // Request microphone access
      console.log('📢 Requesting microphone permissions...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      console.log('✅ Microphone permissions granted successfully');
      
      // Get audio tracks information
      const audioTracks = stream.getAudioTracks();
      console.log('🎙️ Audio tracks:', audioTracks.map(track => ({
        label: track.label,
        enabled: track.enabled,
        muted: track.muted,
        readyState: track.readyState
      })));
      
      // Create MediaRecorder with PCM 16-bit mono at 16kHz format
      // We're using PCM for direct streaming to OpenAI's Whisper API
      console.log('🔄 Creating MediaRecorder instance');
      
      // Attempt to use audio/webm;codecs=pcm format if supported
      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=pcm')) {
        console.log('✅ Using PCM codec in WebM container (preferred format)');
        mimeType = 'audio/webm;codecs=pcm';
      } else {
        console.log('⚠️ PCM codec not supported, falling back to default WebM codec');
      }
      
      const recorder = new MediaRecorder(stream, { 
        mimeType,
        audioBitsPerSecond: 16000 // Match OpenAI's preferred 16kHz sample rate
      });
      mediaRecorderRef.current = recorder;
      
      // Set up event handlers for real-time audio streaming
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          console.log(`📦 Audio data available: ${event.data.size} bytes`);
          
          // Store for batch processing on stop
          audioChunksRef.current.push(event.data);
          
          // CRITICAL: Only send audio data if the OpenAI session is fully ready
          // This prevents the "no session exists" errors
          if (webSocketRef.current && 
              webSocketRef.current.readyState === WebSocket.OPEN && 
              openaiSessionReady) {
            try {
              console.log(`📤 Sending audio chunk (${event.data.size} bytes) - OpenAI session ready: ${openaiSessionReady}`);
              // Send each chunk as binary data immediately for real-time processing
              webSocketRef.current.send(event.data);
            } catch (error) {
              console.warn('⚠️ Could not stream audio chunk in real-time:', error);
              // Just continue and we'll send the full audio on stop
            }
          } else {
            console.warn(`⚠️ Not sending audio chunk - WebSocket: ${webSocketRef.current?.readyState}, OpenAI ready: ${openaiSessionReady}`);
          }
        }
      };
      
      recorder.onstop = async () => {
        console.log(`🛑 Recording stopped, processing ${audioChunksRef.current.length} audio chunks`);
        // Process recorded audio
        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          console.log(`🔊 Created audio blob of size: ${audioBlob.size} bytes`);
          audioChunksRef.current = [];
          
          // Try to send binary audio directly if WebSocket is available AND OpenAI session is ready
          if (webSocketRef.current && 
              webSocketRef.current.readyState === WebSocket.OPEN && 
              openaiSessionReady) {
            try {
              console.log(`📤 Sending binary audio data to server - ${audioBlob.size} bytes - OpenAI session ready: ${openaiSessionReady}`);
              
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
                    openaiSessionReady) {
                  console.log(`📤 Sending audio data to server - ${base64Audio.length} chars (base64) - OpenAI session ready: ${openaiSessionReady}`);
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
                  console.error(`❌ Cannot send audio data - WebSocket: ${webSocketRef.current?.readyState}, OpenAI ready: ${openaiSessionReady}, base64 available: ${!!base64Audio}`);
                }
              };
              reader.readAsDataURL(audioBlob);
            }
          } else {
            console.error('❌ Cannot send audio data - WebSocket not available');
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
    if (!openaiSessionReady) {
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
      console.log('📨 WebSocket message received:', 
        typeof event.data === 'string' 
          ? event.data.substring(0, 100) + (event.data.length > 100 ? '...' : '') 
          : 'Non-string data received');
      
      const data = JSON.parse(event.data);
      console.log('🔍 WebSocket message type:', data.type, data);
      
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
          
          // Note: We don't set openaiSessionReady here, we wait for transcription_session.created event
          console.log('⏳ Waiting for OpenAI to complete session initialization...');
          
          // Log events for debugging
          if (data.events) {
            console.log('📝 Session events:', data.events);
          }
          
          // Add system welcome message
          const welcomeMessage = `Welcome to Financial Sherpa, ${customerName || 'there'}. You can now speak with me by pressing and holding the microphone button. How can I help you today?`;
          console.log('💬 Adding welcome message:', welcomeMessage);
          
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
          console.log('📝 Transcription received:', data.text);
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
          setOpenaiSessionReady(false); // Reset the session ready flag on any error
          
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
          console.log('📡 Server event received:', data);
          if (data.event === 'openai_session_created') {
            console.log('🎉 OpenAI session created on server side at:', new Date().toISOString());
            // Set the session as ready for audio
            setOpenaiSessionReady(true);
            toast({
              title: 'AI Ready',
              description: 'Financial Sherpa is ready for your voice questions',
              variant: 'default',
              duration: 3000
            });
          } else if (data.event === 'openai_connection_established') {
            console.log('🔗 OpenAI connection established on server side');
          } else if (data.event === 'openai_error') {
            console.error('⚠️ OpenAI error on server side at:', new Date().toISOString(), data.message);
            setOpenaiSessionReady(false); // Reset session ready state on OpenAI errors
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
          setOpenaiSessionReady(false);
          console.log('🔄 Session ended, reset openaiSessionReady state');
          break;

        case 'session.authenticate':
          console.log('🔐 Authentication message received');
          break;
          
        case 'session.status':
          console.log('📊 Session status update:', data);
          break;
          
        case 'transcription_session.created':
          console.log('🎯 Transcription session created event received directly from OpenAI at:', new Date().toISOString());
          // Set the session as ready for audio
          setOpenaiSessionReady(true);
          
          // Log the exact state of the system when transcription_session.created received
          console.log('🔄 System State:', {
            sessionId: sessionId,
            connected: connected,
            conversationState: conversationState,
            recording: recording,
            openaiSessionReady: true, // Will be updated by the next render
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
      
      console.log('✅ Received configuration:', config);
      
      // Update customer name and financial data if available from the server
      if (config.customerName && !customerName) {
        setCustomerName(config.customerName);
      }
      
      if (config.financialData) {
        setFinancialData(config.financialData);
      }
      
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
          
          setOpenaiSessionReady(false); // Reset session ready state on timeout
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
        
        // Request a new session
        const instructions = `You are the Financial Sherpa, a friendly and knowledgeable AI assistant for ShiFi Financial. Your role is to help ${config.customerName || customerName || 'the customer'} understand their financial data, provide insights on their contracts, and answer questions about financial products and services. Keep your responses friendly, concise, and professional. ${
          (config.financialData || financialData) ? 'Use the financial data available to provide personalized insights.' : 'Encourage connecting bank accounts to provide more personalized insights.'
        }`;
        
        console.log('📝 Sending session creation with instructions:', instructions);
        console.log('📝 Customer name:', config.customerName || customerName || 'unknown');
        console.log('📝 Financial data available:', !!config.financialData || !!financialData);
        
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
            
            console.log('📤 Sending payload:', JSON.stringify(createSessionPayload));
            socket.send(JSON.stringify(createSessionPayload));
            
            console.log('✅ Session creation request sent successfully at:', new Date().toISOString());
          } catch (sendError) {
            console.error('❌ Error sending session creation request at:', new Date().toISOString(), sendError);
            clearTimeout(connectionTimeoutId);
            setOpenaiSessionReady(false); // Reset this flag on session creation errors
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
        setOpenaiSessionReady(false); // Ensure session is marked as not ready on error
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
        setOpenaiSessionReady(false); // Reset this flag on connection close
        if (conversationState !== 'error') {
          setConversationState('idle');
        }
      };
      
    } catch (error) {
      console.error('❌ WebSocket initialization error at:', new Date().toISOString(), error);
      setOpenaiSessionReady(false); // Reset this flag on initialization errors
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
    setOpenaiSessionReady(false);
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
        setOpenaiSessionReady(false); // Ensure this is reset on errors
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
    if (conversationState === 'connected' && !openaiSessionReady) {
      return <Badge variant="outline" className="bg-yellow-100 text-yellow-800">Initializing...</Badge>;
    }
    
    switch (conversationState) {
      case 'idle':
        return <Badge variant="outline">Disconnected</Badge>;
      case 'connecting':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800">Connecting...</Badge>;
      case 'connected':
        return <Badge variant="outline" className="bg-green-100 text-green-800">Ready</Badge>;
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
          <div className="flex flex-col items-center justify-center py-16">
            <Button 
              onClick={startConversation} 
              className="h-32 w-32 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 shadow-lg hover:shadow-xl transition-all duration-300 mb-6 flex items-center justify-center"
              size="lg"
            >
              <Volume2 className="h-16 w-16 text-white" />
            </Button>
            <h3 className="text-xl font-semibold mb-2">Ask Financial Sherpa</h3>
            <p className="text-muted-foreground text-center max-w-md">
              Click to start your AI financial assistant
            </p>
          </div>
        ) : conversationState === 'connecting' ? (
          renderLoadingState()
        ) : (
          <>
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <Avatar className="h-10 w-10 bg-primary">
                  <Volume2 className="h-6 w-6 text-primary-foreground" />
                </Avatar>
                <div>
                  <h3 className="font-medium">Financial Sherpa</h3>
                  <p className="text-sm text-muted-foreground">AI Assistant</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {renderStatusBadge()}
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={toggleAudio}
                  title={audioEnabled ? "Mute audio" : "Unmute audio"}
                >
                  {audioEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
                </Button>
              </div>
            </div>
            
            {/* Messages display */}
            <ScrollArea className="h-[350px] mb-6">
              <div className="space-y-4">
                {messages.map((message) => (
                  <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`rounded-lg p-3 max-w-[80%] ${
                      message.role === 'user' 
                        ? 'bg-primary text-primary-foreground'
                        : message.role === 'system'
                          ? 'bg-muted text-muted-foreground'
                          : 'bg-secondary text-secondary-foreground'
                    }`}>
                      <p>{message.content}</p>
                      {message.audioUrl && (
                        <audio 
                          controls 
                          src={message.audioUrl} 
                          className="mt-2 w-full max-w-xs"
                          controlsList="nodownload"
                        ></audio>
                      )}
                    </div>
                  </div>
                ))}
                {transcription && (
                  <div className="flex justify-end">
                    <div className="rounded-lg p-3 max-w-[80%] bg-primary text-primary-foreground opacity-70">
                      <p>{transcription} ...</p>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
            
            <div className="flex justify-center items-center gap-4">
              {['thinking', 'responding'].includes(conversationState) ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted rounded-full px-4 py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{conversationState === 'thinking' ? 'Processing...' : 'Responding...'}</span>
                </div>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={endConversation}
                    disabled={['thinking', 'responding'].includes(conversationState)}
                    className="rounded-full"
                  >
                    End Conversation
                  </Button>
                  
                  <Button
                    size="icon"
                    variant="default"
                    className={`rounded-full h-16 w-16 ${recording ? 'bg-red-500 hover:bg-red-600 scale-110' : 'bg-gradient-to-r from-indigo-500 to-purple-600'} shadow-md transition-all duration-200`}
                    onMouseDown={startRecording}
                    onMouseUp={stopRecording}
                    onTouchStart={startRecording}
                    onTouchEnd={stopRecording}
                    disabled={
                      (conversationState !== 'connected' && conversationState !== 'recording') || 
                      (conversationState === 'connected' && !openaiSessionReady)
                    }
                    title={
                      conversationState === 'connected' && !openaiSessionReady 
                        ? "Waiting for AI session to fully initialize..." 
                        : "Press and hold to speak"
                    }
                  >
                    {recording ? <MicOff className="h-8 w-8 text-white" /> : <Mic className="h-8 w-8 text-white" />}
                  </Button>
                </>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default RealtimeAudioSherpa;